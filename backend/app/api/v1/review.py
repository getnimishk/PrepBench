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
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.question import Question
from app.repositories.subject_repository import LEARNER, MOCK

router = APIRouter(prefix="/review", tags=["Review"])

# A session's worth. Twenty wrong answers, read properly, is a real evening;
# it is also the point past which people stop reading and start clicking.
DAILY_REVIEW_CAP = 20


class ReviewOption(BaseModel):
    id: int
    text: str
    is_correct: bool
    # Why this particular option is wrong, where the bank carries it. This is
    # the difference between "you picked B, the answer is C" and knowing what
    # made B attractive.
    why_incorrect: Optional[str] = None


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


class ReviewQueue(BaseModel):
    items: List[ReviewItem]
    # What is behind the cap. Reported so the queue is honest about being a
    # slice, never rendered as a debt.
    remaining: int
    total_unreviewed: int


def _unreviewed_query(db: Session):
    return (
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


@router.get("/queue", response_model=ReviewQueue)
def review_queue(
    limit: int = Query(DAILY_REVIEW_CAP, ge=1, le=DAILY_REVIEW_CAP),
    db: Session = Depends(get_db),
):
    """Today's review: the newest unreviewed misses, with their explanations."""
    total = _unreviewed_query(db).with_entities(func.count(ExamAnswer.id)).scalar() or 0

    rows = (
        _unreviewed_query(db)
        .options(joinedload(ExamAnswer.question).joinedload(Question.options))
        .order_by(ExamSession.start_time.desc(), ExamAnswer.id.asc())
        .limit(limit)
        .all()
    )

    items: List[ReviewItem] = []
    for a in rows:
        q = a.question
        if q is None:
            # The question was deleted out from under the answer. Skip it
            # rather than render a review of nothing.
            continue
        items.append(
            ReviewItem(
                answer_id=a.id,
                session_id=a.session_id,
                question_id=a.question_id,
                session_title=a.session.title,
                taken_at=a.session.end_time or a.session.start_time,
                domain=q.domain,
                question_text=q.text,
                options=[
                    ReviewOption(
                        id=o.id,
                        text=o.option_text,
                        is_correct=bool(o.is_correct),
                        why_incorrect=o.explanation_why_incorrect,
                    )
                    for o in sorted(q.options, key=lambda o: (o.order_index or 0, o.id))
                ],
                selected_option_ids=list(a.selected_option_ids or []),
                explanation=q.explanation,
            )
        )

    return ReviewQueue(
        items=items,
        remaining=max(0, total - len(items)),
        total_unreviewed=total,
    )
