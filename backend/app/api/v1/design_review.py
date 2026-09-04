# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.question import QuestionDifficulty
from app.schemas.design_review import (
    DesignReviewAnalytics,
    DesignReviewAttemptResponse,
    DesignReviewDetail,
    DesignReviewFilter,
    SubmitReviewAttemptRequest,
)
from app.services.design_review_service import DesignReviewService

router = APIRouter(prefix="/design-reviews", tags=["Design Review"])


@router.get("", response_model=dict)
def list_reviews(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    domain: Optional[str] = None,
    axis_label: Optional[str] = None,
    difficulty: Optional[QuestionDifficulty] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
):
    service = DesignReviewService(db)
    return service.list_reviews(
        skip=skip,
        limit=limit,
        filter_params=DesignReviewFilter(
            domain=domain, axis_label=axis_label, difficulty=difficulty, keyword=keyword
        ),
    )


# Registered before /{review_id} -- FastAPI matches in declaration order, so a
# literal path declared after the parameterised one is never reached and
# "domains" would be parsed as an integer id.
@router.get("/domains", response_model=list)
def list_domains(db: Session = Depends(get_db)):
    service = DesignReviewService(db)
    return service.list_domains()


@router.get("/axes", response_model=list)
def list_axes(db: Session = Depends(get_db)):
    """The deciding axes in the bank, for filtering practice to one of them."""
    service = DesignReviewService(db)
    return service.list_axes()


@router.get("/analytics", response_model=DesignReviewAnalytics)
def get_analytics(db: Session = Depends(get_db)):
    """Which axes get named and which get missed. Empty rather than zeroed when
    nothing has been graded."""
    service = DesignReviewService(db)
    return service.get_analytics()


@router.get("/attempts", response_model=dict)
def list_attempts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    service = DesignReviewService(db)
    return service.list_attempts(skip=skip, limit=limit)


@router.get("/attempts/{attempt_id}", response_model=DesignReviewAttemptResponse)
def get_attempt(attempt_id: int, db: Session = Depends(get_db)):
    service = DesignReviewService(db)
    return service.get_attempt(attempt_id)


@router.post("/attempts", response_model=DesignReviewAttemptResponse, status_code=status.HTTP_201_CREATED)
def submit_attempt(req: SubmitReviewAttemptRequest, db: Session = Depends(get_db)):
    """Answering unlocks the reveal, which comes back on the response."""
    service = DesignReviewService(db)
    return service.submit_attempt(req)


@router.get("/{review_id}", response_model=DesignReviewDetail)
def get_review(review_id: int, db: Session = Depends(get_db)):
    """The brief and both options. Never the deciding axis or the reveal."""
    service = DesignReviewService(db)
    return service.get_review(review_id)


@router.get("/{review_id}/latest-attempt", response_model=Optional[DesignReviewAttemptResponse])
def get_latest_attempt(review_id: int, db: Session = Depends(get_db)):
    """Null when the review has never been attempted."""
    service = DesignReviewService(db)
    return service.get_latest_attempt_for_review(review_id)
