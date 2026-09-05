# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.models.question import Question
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


class BlockerResponse(BaseModel):
    """One unmet condition of READY. The surface phrases it; the rule owns it."""
    kind: str
    domain: Optional[str] = None
    value: Optional[float] = None
    target: Optional[float] = None
    count: Optional[int] = None


class MovementResponse(BaseModel):
    """A domain that improved between the last two mocks."""
    domain: str
    before_pct: float
    after_pct: float
    points: float


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
    # Why this is not READY, most actionable first. Empty when it is.
    blockers: List[BlockerResponse] = []
    most_improved: Optional[MovementResponse] = None


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
    # How many questions this subject actually has behind it.
    #
    # A fresh install seeds three subjects and no exam questions, so Home's
    # first action was "Take your first mock" against an empty bank -- which
    # the engine correctly refuses, leaving a new user's only offered action
    # an error message. A subject with nothing to draw from cannot be sat,
    # and the surface has to be able to know that before it offers.
    question_count: int = 0


def _question_count(db: Session, subject) -> int:
    if not subject.certification:
        return 0
    return (
        db.query(func.count(Question.id))
        .filter(Question.certification == subject.certification)
        .scalar()
    ) or 0


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
        blockers=[
            BlockerResponse(
                kind=b.kind, domain=b.domain, value=b.value, target=b.target, count=b.count
            )
            for b in result.blockers
        ],
        most_improved=(
            MovementResponse(
                domain=result.most_improved.domain,
                before_pct=result.most_improved.before_pct,
                after_pct=result.most_improved.after_pct,
                points=result.most_improved.points,
            )
            if result.most_improved
            else None
        ),
    )


@router.get("", response_model=List[SubjectWithReadiness])
def list_subjects(db: Session = Depends(get_db)):
    """Every subject with its readiness. This is what Home renders."""
    repo = SubjectRepository(db)
    return [
        SubjectWithReadiness(
            **SubjectResponse.model_validate(s).model_dump(),
            readiness=_readiness_for(repo, s),
            question_count=_question_count(db, s),
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
        question_count=_question_count(db, subject),
    )
