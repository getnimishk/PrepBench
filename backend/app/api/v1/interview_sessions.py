# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.interview_question import InterviewRoundType
from app.schemas.interview_session import (
    InterviewSessionCreate, InterviewSessionReport, InterviewSessionResponse, PlannedQuestion,
)
from app.services.interview_session_service import InterviewSessionService

router = APIRouter(prefix="/interview-sessions", tags=["Interview sessions"])


@router.get("/plan", response_model=List[PlannedQuestion])
def plan_session(
    round_type: InterviewRoundType,
    category: Optional[str] = None,
    question_count: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
):
    """The questions a session with these settings would ask, without starting it."""
    return InterviewSessionService(db).plan(round_type, category, question_count)


@router.post("", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(body: InterviewSessionCreate, db: Session = Depends(get_db)):
    return InterviewSessionService(db).create(
        body.round_type, body.category, body.question_count, body.thinking
    )


@router.get("/{session_id}", response_model=InterviewSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    return InterviewSessionService(db).get(session_id)


@router.post("/{session_id}/finish", response_model=InterviewSessionResponse)
def finish_session(session_id: int, db: Session = Depends(get_db)):
    """Mark the session ended. Idempotent; answers already given are kept either way."""
    return InterviewSessionService(db).finish(session_id)


@router.get("/{session_id}/report", response_model=InterviewSessionReport)
def session_report(session_id: int, db: Session = Depends(get_db)):
    return InterviewSessionService(db).report(session_id)
