from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.analytics import DashboardOverview, ScoreTrendPoint, DomainMasteryItem
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard", response_model=DashboardOverview)
def get_dashboard_overview(db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    return service.get_dashboard_overview()

@router.get("/score-trends", response_model=List[ScoreTrendPoint])
def get_score_trends(db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    return service.get_score_trends()

@router.get("/domain-performance", response_model=List[DomainMasteryItem])
def get_domain_performance(db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    return service.get_domain_performance()
