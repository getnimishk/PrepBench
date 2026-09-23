# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.repositories.subject_repository import SubjectRepository
from app.schemas.spaced import SpacedDeck, SpacedGradeRequest, SpacedGradeResult
from app.services.spaced_review_service import SpacedReviewService

router = APIRouter(prefix="/spaced", tags=["Spaced repetition"])

# A session's worth, as the prototype sizes it. The rest stay due for the next one.
DEFAULT_DECK = 8


@router.get("/deck", response_model=SpacedDeck)
def get_deck(
    limit: int = Query(DEFAULT_DECK, ge=1, le=50),
    subject_id: Annotated[Optional[int], Query(
        description="Only this preparation's due questions. Omit for every preparation's.",
    )] = None,
    domain: Annotated[Optional[str], Query(
        max_length=150,
        description="Only questions in this area, so a count shown for one area opens that area's cards.",
    )] = None,
    db: Session = Depends(get_db),
):
    """The due cards, most overdue first, and how many are due in all."""
    subject = None
    if subject_id is not None:
        subject = SubjectRepository(db).get_by_id(subject_id)
        if subject is None:
            raise ResourceNotFoundException("Subject", subject_id)
    return SpacedReviewService(db).deck(subject, limit, domain=domain)


@router.post("/grades", response_model=SpacedGradeResult)
def grade_card(body: SpacedGradeRequest, db: Session = Depends(get_db)):
    """Record how well a due card was recalled, and move its schedule on.

    409 when the card is not due: a second grade for one recall would push it
    forward twice.
    """
    return SpacedReviewService(db).grade(body.question_id, body.grade)
