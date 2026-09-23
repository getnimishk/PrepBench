# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The wrong answers, and what to understand from them.

Until now the product could *count* unreviewed misses and could not show
them. Home's one action said "Review them", Review restated the number, and
there the trail ended -- a ninety-item debt with no way to pay it. A count
you cannot act on is a guilt mechanic whatever the tone of the sentence
around it.

Two rules shape the queue:

  Bounded. It returns a session's worth, newest mock first, and says how many
  are behind it without making that the headline. An unbounded queue is the
  backlog again.

  Freshest first. A miss from last night's mock is worth more than one from
  six weeks ago, because the reasoning that produced it is still recoverable.
"""
from typing import Annotated, List, Optional
from datetime import datetime, timedelta, UTC

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.models.exam_answer import ConfidenceLevel, ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.question import Question
from app.models.review_check import ReviewCheck
from app.repositories.subject_repository import LEARNER, MOCK, SubjectRepository, session_belongs_to
from app.repositories.settings_repository import SettingsRepository
from app.services.home_service import HomeService
from app.services.review_service import ReviewService

router = APIRouter(prefix="/review", tags=["Review"])

# A session's worth. Twenty wrong answers, read properly, is a real evening;
# it is also the point past which people stop reading and start clicking.
#
# Now the *default* for the learner's own setting (app_settings.review_daily_cap)
# rather than the only value. The route still refuses anything above
# MAX_REVIEW_DAILY_CAP whatever is stored, and the handler clamps to the stored
# cap -- so a caller can ask for fewer, never more.
DAILY_REVIEW_CAP = 20
MAX_REVIEW_DAILY_CAP = 200

# How far back "recently strengthened" looks.
VERIFIED_WINDOW_DAYS = 30


class ReviewOption(BaseModel):
    id: int
    text: str
    is_correct: bool
    # Why this particular option is wrong, where the bank carries it. This is
    # the difference between "you picked B, the answer is C" and knowing what
    # made B attractive.
    why_incorrect: Optional[str] = None


class CheckQuestion(BaseModel):
    """One different question on the same concept.

    Sent with the miss rather than fetched afterwards, so the check appears the
    instant the explanation has been read instead of after a spinner. `None` on
    a ReviewItem is a real answer, not a failure: a topic with one question in
    the bank cannot be checked, and saying so is better than asking about
    something else and calling it verification.
    """
    question_id: int
    question_text: str
    is_multiple: bool
    options: List[ReviewOption]


class ReviewItem(BaseModel):
    answer_id: int
    session_id: int
    question_id: int
    session_title: str
    taken_at: Optional[datetime] = None
    domain: str
    question_text: str
    options: List[ReviewOption]
    selected_option_ids: List[int]
    explanation: Optional[str] = None
    check: Optional[CheckQuestion] = None


class ReviewQueue(BaseModel):
    items: List[ReviewItem]
    # What is behind the cap. Reported so the queue is honest about being a
    # slice, never rendered as a debt.
    remaining: int
    total_unreviewed: int
    # A different queue: questions the spaced schedule has brought round again.
    # Same scope as the items above, so Review never offers a memory drill for
    # one preparation on the strength of another's schedule.
    spaced_due: int = 0
    # What the checks have shown, per miss, by its most recent check. A miss
    # whose last check failed has not transferred yet; one whose last check
    # passed within VERIFIED_WINDOW_DAYS was recently strengthened. A miss read
    # without a check is in neither: nothing verified it either way.
    needs_retry: int = 0
    verified_recently: int = 0
    verified_window_days: int = 0


class ReviewCounts(BaseModel):
    """How much review is waiting, without the review itself.

    For the navigation's badge, which is read on every screen. The queue carries
    each miss with its options, explanation and a check question; a number in the
    sidebar needs none of that.
    """
    unreviewed: int
    spaced_due: int


class CheckRequest(BaseModel):
    answer_id: int
    question_id: int
    selected_option_ids: List[int]
    confidence_level: ConfidenceLevel = ConfidenceLevel.NOT_SET


class CheckResult(BaseModel):
    passed: bool
    correct_option_ids: List[int]
    explanation: Optional[str] = None
    # Said in words rather than left to the ticks, and it is the honest half of
    # the feature: a failed check is the product finding out that reading was
    # not enough, which is the thing it could never find out before.
    verdict: str


def _unreviewed_query(db: Session, subject=None):
    query = (
        db.query(ExamAnswer)
        .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
        .filter(
            ExamSession.session_kind == MOCK,
            ExamSession.source == LEARNER,
            ExamSession.status == ExamStatus.COMPLETED,
            ExamAnswer.is_correct.is_(False),
            ExamAnswer.reviewed_at.is_(None),
        )
    )
    if subject is not None:
        # The same ownership rule Home's daily goal counts with, so "Nothing due"
        # on Home and an empty queue here are the same fact, not two guesses.
        query = query.filter(session_belongs_to(subject))
    return query


def _check_outcomes(db: Session, subject, now: Optional[datetime] = None) -> tuple[int, int]:
    """(needs retry, verified recently), each miss counted once by its latest check.

    One grouped query for the latest check of every checked miss in scope, so a
    concept checked five times is one concept, and a failure followed by a pass
    is a pass.
    """
    now = now or datetime.now(UTC).replace(tzinfo=None)
    latest = (
        db.query(ReviewCheck.answer_id, func.max(ReviewCheck.id).label("last_id"))
        .group_by(ReviewCheck.answer_id)
        .subquery()
    )
    query = (
        db.query(ReviewCheck.passed, ReviewCheck.created_at)
        .join(latest, ReviewCheck.id == latest.c.last_id)
        .join(ExamAnswer, ExamAnswer.id == ReviewCheck.answer_id)
        .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
        .filter(ExamSession.source == LEARNER)
    )
    if subject is not None:
        query = query.filter(session_belongs_to(subject))
    cutoff = now - timedelta(days=VERIFIED_WINDOW_DAYS)
    needs_retry = verified = 0
    for passed, created_at in query.all():
        if not passed:
            needs_retry += 1
        elif created_at is not None and created_at >= cutoff:
            verified += 1
    return needs_retry, verified


@router.get("/queue", response_model=ReviewQueue)
def review_queue(
    limit: Optional[int] = Query(None, ge=1, le=MAX_REVIEW_DAILY_CAP),
    # Annotated, so the Python default is a real None. The tests call this route
    # function directly; with `= Query(None)` as the default they would receive the
    # Query marker object instead of None and try to look up a subject by it.
    subject_id: Annotated[Optional[int], Query(
        description=(
            "Only this preparation's mistakes. Omit for all of them, which is the "
            "default so no existing caller changes. Without it, switching to another "
            "preparation left the queue listing the first one's mistakes."
        ),
    )] = None,
    db: Session = Depends(get_db),
):
    """Today's review: the newest unreviewed misses, with their explanations.

    Bounded twice, and both halves matter. The route refuses any `limit` above
    MAX_REVIEW_DAILY_CAP, so the bound is not merely a default a caller can argue
    past. The handler then clamps to the learner's own review_daily_cap, so the
    queue never serves more than the day's goal says -- a caller may ask for
    fewer, never more.
    """
    cap = SettingsRepository(db).get_or_create().review_daily_cap or DAILY_REVIEW_CAP
    limit = cap if limit is None else min(limit, cap)

    subject = None
    if subject_id is not None:
        subject = SubjectRepository(db).get_by_id(subject_id)
        if subject is None:
            raise ResourceNotFoundException("Subject", subject_id)

    total = _unreviewed_query(db, subject).with_entities(func.count(ExamAnswer.id)).scalar() or 0

    rows = (
        _unreviewed_query(db, subject)
        .options(joinedload(ExamAnswer.question).joinedload(Question.options))
        .order_by(ExamSession.start_time.desc(), ExamAnswer.id.asc())
        .limit(limit)
        .all()
    )

    service = ReviewService(db)
    items: List[ReviewItem] = []
    for a in rows:
        q = a.question
        if q is None:
            # The question was deleted out from under the answer. Skip it
            # rather than render a review of nothing.
            continue

        check_q = service.pick_check_question(a)
        items.append(
            ReviewItem(
                answer_id=a.id,
                session_id=a.session_id,
                question_id=a.question_id,
                session_title=a.session.title,
                taken_at=a.session.end_time or a.session.start_time,
                domain=q.domain,
                question_text=q.text,
                options=[_option(o) for o in _ordered(q.options)],
                selected_option_ids=list(a.selected_option_ids or []),
                explanation=q.explanation,
                check=(
                    CheckQuestion(
                        question_id=check_q.id,
                        question_text=check_q.text,
                        is_multiple=check_q.question_type.value == "multiple_choice",
                        # The check's options carry `is_correct` like every
                        # other option in this file, and the client must not
                        # render it before the answer is submitted. Sending it
                        # keeps the check a single round trip; the reveal is
                        # the client's job either way, because the miss above
                        # it is already showing its own correct answer.
                        options=[_option(o) for o in _ordered(check_q.options)],
                    )
                    if check_q is not None
                    else None
                ),
            )
        )

    needs_retry, verified = _check_outcomes(db, subject)
    return ReviewQueue(
        items=items,
        remaining=max(0, total - len(items)),
        total_unreviewed=total,
        spaced_due=HomeService(db).due_for_review_count(subject),
        needs_retry=needs_retry,
        verified_recently=verified,
        verified_window_days=VERIFIED_WINDOW_DAYS,
    )


@router.get("/counts", response_model=ReviewCounts)
def review_counts(
    subject_id: Annotated[Optional[int], Query(
        description="Only this preparation's review. Omit for every preparation's.",
    )] = None,
    db: Session = Depends(get_db),
):
    """Unreviewed mock misses and spaced-repetition questions due, counted the way
    the queue counts them."""
    subject = None
    if subject_id is not None:
        subject = SubjectRepository(db).get_by_id(subject_id)
        if subject is None:
            raise ResourceNotFoundException("Subject", subject_id)
    home = HomeService(db)
    return ReviewCounts(
        unreviewed=_unreviewed_query(db, subject).with_entities(func.count(ExamAnswer.id)).scalar() or 0,
        spaced_due=home.due_for_review_count(subject),
    )


def _ordered(options):
    return sorted(options, key=lambda o: (o.order_index or 0, o.id))


def _option(o) -> ReviewOption:
    return ReviewOption(
        id=o.id,
        text=o.option_text,
        is_correct=bool(o.is_correct),
        why_incorrect=o.explanation_why_incorrect,
    )


@router.post("/checks", response_model=CheckResult)
def submit_check(req: CheckRequest, db: Session = Depends(get_db)):
    """Answer the check, and record what it proved.

    This is the endpoint that makes reviewing produce evidence. Before it,
    reviewing a miss set a timestamp and nothing else: the schedule was driven
    only by answering, so twenty explanations read carefully left the product's
    model of the learner exactly where it started.

    Marking the miss read happens here too. Reaching the check means the
    explanation was on screen and worked through, which is a stronger claim
    than the old one -- that the page had been open.
    """
    answer = db.query(ExamAnswer).filter(ExamAnswer.id == req.answer_id).first()
    if not answer:
        raise ResourceNotFoundException("ExamAnswer", req.answer_id)

    question = (
        db.query(Question)
        .options(joinedload(Question.options))
        .filter(Question.id == req.question_id)
        .first()
    )
    if not question:
        raise ResourceNotFoundException("Question", req.question_id)

    service = ReviewService(db)
    check = service.record_check(
        answer, question, req.selected_option_ids, req.confidence_level
    )

    if answer.reviewed_at is None:
        answer.reviewed_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()

    return CheckResult(
        passed=check.passed,
        correct_option_ids=[o.id for o in question.options if o.is_correct],
        explanation=question.explanation,
        verdict=(
            "That one transferred. The concept is holding on a question you had not seen."
            if check.passed
            else "It did not transfer yet. This concept is back near the front of the "
                 "schedule, so it will come round again soon."
        ),
    )
