# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Learning attempts.

Its own router rather than an extension of an existing one: no current router
owns the learning domain, and hanging it off /questions or /roadmaps would put
an unrelated resource behind one of theirs.

Only attempts are exposed. Mastery, placement and recommendations are derived
from these on read and are deliberately not stored or served as their own
resources -- the rules behind them can then change without migrating anyone's
history.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.learning import (
    LearningAttemptCreate,
    LearningAttemptResponse,
    LearningAttemptUpdate,
)
from app.services.learning_service import LearningService

router = APIRouter(prefix="/learning", tags=["Learning"])


@router.get("/attempts", response_model=List[LearningAttemptResponse])
def list_attempts(
    subject_id: Optional[int] = Query(
        None,
        description="This preparation's attempts. Omitted: the attempts that belong to no preparation -- never every preparation's.",
    ),
    concept_id: Optional[str] = Query(None, description="Only attempts at this concept."),
    db: Session = Depends(get_db),
):
    return LearningService(db).list_attempts(subject_id=subject_id, concept_id=concept_id)


# The preparation asking, on every request that reaches one attempt by its uid.
# Omitted, it asks as no preparation -- never as any preparation.
_SCOPE = Query(
    None,
    description=(
        "The preparation asking. Another preparation's attempt is answered as an unknown uid. "
        "Omitted, only attempts with no preparation are reached."
    ),
)


@router.get("/attempts/{attempt_uid}", response_model=LearningAttemptResponse)
def get_attempt(attempt_uid: str, subject_id: Optional[int] = _SCOPE, db: Session = Depends(get_db)):
    """One attempt, read from one preparation.

    Read from any other preparation it is answered exactly like an unknown uid,
    so the reply does not reveal that the uid exists elsewhere.
    """
    return LearningService(db).get_attempt(attempt_uid, subject_id=subject_id)


@router.post(
    "/attempts",
    response_model=LearningAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_attempt(req: LearningAttemptCreate, db: Session = Depends(get_db)):
    """Open an attempt.

    Idempotent on `attempt_uid`: posting the same uid twice returns the attempt
    that already exists rather than creating a second one or failing. A retry is
    the same request arriving twice, not a conflict -- and a duplicate row would
    inflate every count derived from this table.

    A uid another preparation holds is refused with 409, carrying none of that
    attempt.
    """
    return LearningService(db).start_attempt(req)


@router.patch("/attempts/{attempt_uid}", response_model=LearningAttemptResponse)
def update_attempt(
    attempt_uid: str,
    req: LearningAttemptUpdate,
    subject_id: Optional[int] = _SCOPE,
    db: Session = Depends(get_db),
):
    """Commit a prediction, record hints and reasoning, or complete the attempt.

    PATCH rather than PUT because the client sends one transition at a time, and
    a full-representation contract would let a later write clobber a prediction
    that is supposed to be immutable.

    Sending a second `prediction` is refused with 400, not merged. That refusal
    is the point of the endpoint.

    Scoped like the read: another preparation's attempt is not found, so it can
    be neither changed nor read back through the response.
    """
    return LearningService(db).update_attempt(attempt_uid, req, subject_id=subject_id)
