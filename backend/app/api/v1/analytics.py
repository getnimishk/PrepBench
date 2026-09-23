# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.models.subject import Subject
from app.repositories.subject_repository import SubjectRepository
from app.schemas.analytics import DashboardOverview, DomainDetail, ScoreTrendPoint, DomainMasteryItem
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

SubjectFilter = Annotated[Optional[int], Query(
    description="Only this preparation's evidence. Omit for every preparation's.",
)]


def _subject(db: Session, subject_id: Optional[int]) -> Optional[Subject]:
    if subject_id is None:
        return None
    subject = SubjectRepository(db).get_by_id(subject_id)
    if subject is None:
        raise ResourceNotFoundException("Subject", subject_id)
    return subject


@router.get("/dashboard", response_model=DashboardOverview)
def get_dashboard_overview(db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    return service.get_dashboard_overview()

@router.get("/score-trends", response_model=List[ScoreTrendPoint])
def get_score_trends(subject_id: SubjectFilter = None, db: Session = Depends(get_db)):
    return AnalyticsService(db).get_score_trends(_subject(db, subject_id))

@router.get("/domain-performance", response_model=List[DomainMasteryItem])
def get_domain_performance(subject_id: SubjectFilter = None, db: Session = Depends(get_db)):
    return AnalyticsService(db).get_domain_performance(_subject(db, subject_id))

@router.get("/domain-detail", response_model=DomainDetail)
def get_domain_detail(
    subject_id: Annotated[int, Query(description="The preparation the area belongs to.")],
    domain: Annotated[str, Query(min_length=1, max_length=150, description="The area, exactly as named.")],
    db: Session = Depends(get_db),
):
    """One area of one preparation: accuracy, misses, what is due, its topics and questions.

    A query parameter rather than a path segment, because area names contain
    spaces and slashes. 404 when the preparation has neither questions nor
    answers in the area.
    """
    return AnalyticsService(db).get_domain_detail(_subject(db, subject_id), domain)
