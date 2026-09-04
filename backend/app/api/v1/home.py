# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
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


class HomeResponse(BaseModel):
    """Everything Home renders, and deliberately nothing more.

    There is no `suggested` or `next_actions` field. A ranked list of what to
    do next was put to the user and rejected as nagging, so the client is
    given state and the person chooses.
    """
    resumable: Optional[ResumableResponse] = None
    unreviewed_total: int = 0
    due_for_review: int = 0
    per_subject: List[SubjectCounts] = []


class CoverageItem(BaseModel):
    key: str
    label: str
    count: int
    completed: int
    available: bool
    detail: str


class ActivityItem(BaseModel):
    kind: str
    at: Optional[datetime] = None
    title: str
    detail: str
    href: str


@router.get("", response_model=HomeResponse)
def get_home(db: Session = Depends(get_db)):
    service = HomeService(db)
    resumable = service.get_resumable()
    return HomeResponse(
        resumable=ResumableResponse(**resumable) if resumable else None,
        unreviewed_total=service.unreviewed_count(),
        due_for_review=service.due_for_review_count(),
        per_subject=[
            SubjectCounts(subject_id=s.id, unreviewed=service.unreviewed_count(s))
            for s in SubjectRepository(db).get_all()
        ],
    )


@router.get("/activity", response_model=List[ActivityItem])
def get_activity(limit: int = Query(40, ge=1, le=200), db: Session = Depends(get_db)):
    """One timeline across every practice format, replacing the separate
    Exam History and System Design History pages."""
    return HomeService(db).activity(limit=limit)


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
