# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Annotated, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.subject_repository import SubjectRepository
from app.services.home_service import HomeService

router = APIRouter(prefix="/home", tags=["Home"])


class ResumableResponse(BaseModel):
    session_id: int
    title: str
    session_kind: str
    answered: int
    total: int
    seconds_remaining: Optional[int] = None
    started_at: Optional[datetime] = None


class SubjectCounts(BaseModel):
    subject_id: int
    unreviewed: int
    # The unfinished session for this preparation only. The top-level `resumable`
    # stays the newest across all of them, for a caller with no preparation.
    resumable: Optional[ResumableResponse] = None


class HomeResponse(BaseModel):
    """Everything Home renders, and deliberately nothing more.

    There is no `suggested` or `next_actions` field. A ranked list of what to
    do next was put to the user and rejected as nagging, so the client is
    given state and the person chooses.
    """
    resumable: Optional[ResumableResponse] = None
    unreviewed_total: int = 0
    mock_count: int = 0
    # None, never 0.0, when no mock has been taken. An absent measurement
    # is not a failing one.
    mock_accuracy: Optional[float] = None
    subjects_total: int = 0
    subjects_ready: int = 0
    due_for_review: int = 0
    per_subject: List[SubjectCounts] = []


class CertificationGoal(BaseModel):
    """Today's certification review goal for one preparation.

    `target` is min(daily_cap, due_for_review + done) -- so it follows what the
    schedule actually has due and is never a quota. A `target` of 0 with state
    "nothing_due" is the system working, not a missed day.
    """
    subject_id: int
    subject_name: str
    target: int
    done: int
    remaining: int
    due_for_review: int
    queued_beyond_today: int
    daily_cap: int
    state: str  # nothing_due | not_started | in_progress | done
    weakest_area: Optional[str] = None


class InterviewGoal(BaseModel):
    """Today's interview goal: a flat target, not tied to a preparation.

    The signals are None until an answer has actually been analysed. None is
    never 0 -- an unavailable AI provider produces no signal, and a 0% would
    blame the learner for a missing API key.

    `longest_since_round` is the round practised longest ago, or never. It is a
    recency fact, deliberately not called a recommendation: there is no model of
    which round has gone stale.
    """
    target: int
    done: int
    remaining: int
    recorded_today: int
    state: str  # not_started | done
    latest_content_signal: Optional[float] = None
    latest_delivery_signal: Optional[float] = None
    latest_analysed_at: Optional[datetime] = None
    longest_since_round: Optional[str] = None
    longest_since_round_never_practised: bool = False


class DailyGoalsResponse(BaseModel):
    # None when no preparation was named, so the client cannot mistake an absent
    # goal for a finished one.
    certification: Optional[CertificationGoal] = None
    interview: InterviewGoal


class CoverageItem(BaseModel):
    key: str
    label: str
    count: int
    completed: int
    available: bool
    detail: str


class OtherPreparationItem(BaseModel):
    key: str
    label: str
    detail: str
    href: str


class ActivityItem(BaseModel):
    kind: str
    at: Optional[datetime] = None
    title: str
    detail: str
    href: str


class FocusTopic(BaseModel):
    """One weak topic, with the evidence that made it weak.

    The counts travel with the name on purpose. "Daily Scrum" alone is a
    verdict the reader has to take on trust; "6 of 11 in your mocks" is the
    same verdict with its working shown, and it is the difference between a
    surface that instructs and one that informs.
    """
    topic: str
    answered: int
    correct: int
    accuracy_percentage: float


def _subject_counts(service: HomeService, subject) -> SubjectCounts:
    resumable = service.get_resumable(subject)
    return SubjectCounts(
        subject_id=subject.id,
        unreviewed=service.unreviewed_count(subject),
        resumable=ResumableResponse(**resumable) if resumable else None,
    )


@router.get("", response_model=HomeResponse)
def get_home(db: Session = Depends(get_db)):
    service = HomeService(db)
    resumable = service.get_resumable()
    totals = service.mock_totals()
    return HomeResponse(
        resumable=ResumableResponse(**resumable) if resumable else None,
        **totals,
        unreviewed_total=service.unreviewed_count(),
        due_for_review=service.due_for_review_count(),
        per_subject=[_subject_counts(service, s) for s in SubjectRepository(db).get_all()],
    )


@router.get("/daily-goals", response_model=DailyGoalsResponse)
def get_daily_goals(
    subject_id: Optional[int] = Query(
        None,
        description=(
            "The preparation whose certification goal to compute. Omit it and the "
            "certification goal is null -- a review goal only means something for "
            "a particular preparation's queue."
        ),
    ),
    db: Session = Depends(get_db),
):
    """The two standing daily goals Home leads with.

    A sub-route of /home, like /home/focus-topics and /home/subjects/{id}/coverage,
    rather than a field on GET /home: that response is not scoped to a
    preparation, and the certification goal has to be.

    Everything here is derived from the rows that caused it on every request, so
    a goal cannot drift from its evidence.
    """
    subject = None
    if subject_id is not None:
        subject = SubjectRepository(db).get_by_id(subject_id)
        if subject is None:
            raise ResourceNotFoundException("Subject", subject_id)
    return HomeService(db).daily_goals(subject)


@router.get("/activity", response_model=List[ActivityItem])
def get_activity(
    limit: int = Query(40, ge=1, le=200),
    subject_id: Annotated[Optional[int], Query(
        description=(
            "Only this preparation's exam sessions. Formats that belong to no "
            "preparation yet are left out rather than filed under it."
        ),
    )] = None,
    db: Session = Depends(get_db),
):
    """One timeline across every practice format, replacing the separate
    Exam History and System Design History pages."""
    subject = None
    if subject_id is not None:
        subject = SubjectRepository(db).get_by_id(subject_id)
        if subject is None:
            raise ResourceNotFoundException("Subject", subject_id)
    return HomeService(db).activity(limit=limit, subject=subject)


@router.get("/other-preparation", response_model=List[OtherPreparationItem])
def get_other_preparation(db: Session = Depends(get_db)):
    """What has been practised outside the exam, counted from real rows."""
    return HomeService(db).other_preparation()


@router.get("/focus-topics", response_model=List[FocusTopic])
def get_focus_topics(
    subject_id: Annotated[Optional[int], Query(
        description=(
            "Only this preparation's weak topics. Omit for every preparation's, "
            "which is the default so no existing caller changes."
        ),
    )] = None,
    db: Session = Depends(get_db),
):
    """The weak topics, worst first, with their counts.

    Reads AnalyticsRepository.get_weak_topics -- the same query, and therefore
    the same definition of weak, that the weak-topic drill draws from. Home
    must never be able to name a topic the drill would not then offer, and a
    drill for one preparation does not offer another's topics.
    """
    if subject_id is not None and SubjectRepository(db).get_by_id(subject_id) is None:
        raise ResourceNotFoundException("Subject", subject_id)
    return AnalyticsRepository(db).get_weak_topics(subject_id=subject_id)


@router.get("/subjects/{subject_id}/coverage", response_model=List[CoverageItem])
def get_coverage(subject_id: int, db: Session = Depends(get_db)):
    """Every practice format for a subject, including the ones with no content.

    An unavailable format is returned rather than omitted: an empty row is the
    only way the application can say that a subject has no exam questions.
    """
    subject = SubjectRepository(db).get_by_id(subject_id)
    if not subject:
        raise ResourceNotFoundException("Subject", subject_id)
    return HomeService(db).coverage_for(subject)
