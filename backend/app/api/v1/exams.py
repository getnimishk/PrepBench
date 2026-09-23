# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.exam import (
    ExamCreateRequest, ExamDetailResponse, ExamPreviewResponse, ExamSessionResponse, SaveAnswerRequest,
)
from app.services.exam_engine import ExamEngine

router = APIRouter(prefix="/exams", tags=["Exams Engine"])

@router.post("", response_model=ExamSessionResponse, status_code=status.HTTP_201_CREATED)
def start_exam(req: ExamCreateRequest, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.create_exam(req)


@router.post("/preview", response_model=ExamPreviewResponse)
def preview_exam(req: ExamCreateRequest, db: Session = Depends(get_db)):
    """The same request as starting an exam, answered without starting one.

    Practice shows it as the filters change, so "Custom practice must actually
    change the session composition" is something the learner can watch happen.
    A refusal comes back as 200 with can_start false: it is an answer to the
    question asked, not a failed request.
    """
    return ExamEngine(db).preview_exam(req)

# There is no GET /exams. It returned every session with every answer
# embedded -- fifty sessions of eighty answers in one payload -- and its only
# caller was the standalone exam-history page, which is now folded into
# Review. Review reads /home/activity, which is one timeline across every
# format and carries no answer bodies at all.

@router.get("/{session_id}", response_model=ExamDetailResponse)
def get_exam_details(session_id: int, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.get_exam_details(session_id)

@router.post("/{session_id}/answer", response_model=ExamSessionResponse)
def save_answer(session_id: int, req: SaveAnswerRequest, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.save_answer(session_id, req)

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_exam(session_id: int, db: Session = Depends(get_db)):
    """Discard an unfinished session. 409 for a submitted one, which is evidence."""
    ExamEngine(db).discard_exam(session_id)


@router.post("/{session_id}/finish", response_model=ExamDetailResponse)
def finish_exam(session_id: int, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.finish_exam(session_id)


@router.post("/{session_id}/answers/{question_id}/reviewed", response_model=dict)
def mark_answer_reviewed(session_id: int, question_id: int, db: Session = Depends(get_db)):
    """Record that this answer has been looked at after the mock.

    Review is where the score actually moves, and until now nothing recorded
    whether it happened. The count of unreviewed wrong answers is the only
    thing the product surfaces unprompted -- and it is a count, not an
    instruction to go and do something.
    """
    from datetime import datetime, UTC
    from app.models.exam_answer import ExamAnswer
    from app.core.exceptions import ResourceNotFoundException

    answer = (
        db.query(ExamAnswer)
        .filter(ExamAnswer.session_id == session_id, ExamAnswer.question_id == question_id)
        .first()
    )
    if not answer:
        raise ResourceNotFoundException("ExamAnswer", question_id)

    # Set once. Re-opening a reviewed answer is not a second review, and
    # bumping the timestamp would make "when did you last revise this" wrong.
    if answer.reviewed_at is None:
        answer.reviewed_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()

    return {"status": "ok", "reviewed_at": answer.reviewed_at}


@router.get("/{session_id}/unreviewed", response_model=dict)
def get_unreviewed(session_id: int, db: Session = Depends(get_db)):
    """Which wrong answers in this session still need looking at."""
    from app.models.exam_answer import ExamAnswer

    rows = (
        db.query(ExamAnswer.question_id)
        .filter(
            ExamAnswer.session_id == session_id,
            ExamAnswer.is_correct.is_(False),
            ExamAnswer.reviewed_at.is_(None),
        )
        .all()
    )
    question_ids = [r[0] for r in rows]
    return {"session_id": session_id, "count": len(question_ids), "question_ids": question_ids}
