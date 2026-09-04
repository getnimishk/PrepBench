# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.models.subject import SubjectKind
from app.repositories.subject_repository import SubjectRepository
from app.services import readiness as readiness_rules

router = APIRouter(prefix="/subjects", tags=["Subjects"])


class DomainReadinessResponse(BaseModel):
    domain: str
    state: str
    answered: int
    # None, never 0, below the reporting threshold. Too few questions to judge
    # is not the same as a bad score.
    score_pct: Optional[float] = None


class ReadinessResponse(BaseModel):
    state: str
    mock_count: int
    pass_mark: Optional[float] = None
    recent_scores: List[float] = []
    latest_taken_at: Optional[datetime] = None
    is_stale: bool = False
    domains: List[DomainReadinessResponse] = []
    weakest_domain: Optional[str] = None
    points_per_mock: Optional[float] = None
    mocks_to_pass_estimate: Optional[int] = None


class SubjectResponse(BaseModel):
    id: int
    name: str
    slug: str
    kind: SubjectKind
    pass_mark: Optional[float] = None
    exam_question_count: Optional[int] = None
    exam_minutes: Optional[int] = None
    has_exam_profile: bool

    model_config = ConfigDict(from_attributes=True)


class SubjectWithReadiness(SubjectResponse):
    readiness: ReadinessResponse


def _readiness_for(repo: SubjectRepository, subject) -> ReadinessResponse:
    result = readiness_rules.compute(
        repo.get_mock_results(subject),
        pass_mark=subject.pass_mark,
        has_exam_profile=subject.has_exam_profile,
    )
    return ReadinessResponse(
        state=result.state.value,
        mock_count=result.mock_count,
        pass_mark=result.pass_mark,
        recent_scores=result.recent_scores,
        latest_taken_at=result.latest_taken_at,
        is_stale=result.is_stale,
        domains=[
            DomainReadinessResponse(
                domain=d.domain, state=d.state.value, answered=d.answered, score_pct=d.score_pct
            )
            for d in result.domains
        ],
        weakest_domain=result.weakest_domain,
        points_per_mock=result.points_per_mock,
        mocks_to_pass_estimate=result.mocks_to_pass_estimate,
    )


@router.get("", response_model=List[SubjectWithReadiness])
def list_subjects(db: Session = Depends(get_db)):
    """Every subject with its readiness. This is what Home renders."""
    repo = SubjectRepository(db)
    return [
        SubjectWithReadiness(
            **SubjectResponse.model_validate(s).model_dump(),
            readiness=_readiness_for(repo, s),
        )
        for s in repo.get_all()
    ]


@router.get("/{subject_id}", response_model=SubjectWithReadiness)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    repo = SubjectRepository(db)
    subject = repo.get_by_id(subject_id)
    if not subject:
        raise ResourceNotFoundException("Subject", subject_id)
    return SubjectWithReadiness(
        **SubjectResponse.model_validate(subject).model_dump(),
        readiness=_readiness_for(repo, subject),
    )
