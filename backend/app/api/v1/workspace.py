# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Workspace and Evidence: two read models over the rows the features already keep.

Both are scoped the way every single-preparation read is: `subject_id` is the
preparation asking, and omitted means work that belongs to no preparation --
never every preparation. Neither writes anything. See
docs/implementation/PHASE-6-CONTRACT.md.
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.repositories.subject_repository import SubjectRepository
from app.schemas.evidence import EvidenceResponse
from app.schemas.workspace import WorkspaceResponse
from app.services.evidence_service import EvidenceService
from app.services.workspace_service import WorkspaceService

router = APIRouter(tags=["Workspace & Evidence"])

Scope = Annotated[Optional[int], Query(
    description=(
        "The preparation asking. Omitted, only work that belongs to no preparation is returned "
        "-- never every preparation's."
    ),
)]


def _subject(db: Session, subject_id: Optional[int]):
    if subject_id is None:
        return None
    subject = SubjectRepository(db).get_by_id(subject_id)
    if subject is None:
        raise ResourceNotFoundException("Subject", subject_id)
    return subject


@router.get("/workspace", response_model=WorkspaceResponse)
def get_workspace(subject_id: Scope = None, db: Session = Depends(get_db)):
    """The learner's own work in one scope: lab runs, case notes, prepared answers,
    recordings, topic guides and notes -- each linked to where it lives."""
    _subject(db, subject_id)
    return WorkspaceService(db).workspace(subject_id)


@router.get("/evidence", response_model=EvidenceResponse)
def get_evidence(subject_id: Scope = None, db: Session = Depends(get_db)):
    """What the record shows was demonstrated in one scope, each item graded
    activity, completed, demonstrated or evidenced -- never a readiness verdict."""
    return EvidenceService(db).evidence(_subject(db, subject_id))
