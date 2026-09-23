# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.schemas.exam import MockHistoryItem
from app.models.subject import SubjectKind
from app.repositories.question_repository import QuestionRepository
from app.repositories.subject_repository import SubjectRepository
from app.schemas.subject import (
    SubjectCreate,
    SubjectDeleteRequest,
    SubjectDeleteResult,
    SubjectUpdate,
)
from app.services import readiness as readiness_rules
from app.services.subject_service import SubjectService

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


class ReadinessRulesResponse(BaseModel):
    """The numbers the verdict was computed with. See readiness.rules()."""
    min_mocks_for_ready: int
    consecutive_mocks_at_pass: int
    domain_floor_pct: float
    recency_days: int
    plateau_min_mocks: int
    plateau_max_spread: float
    min_questions_per_domain: int


def _rules() -> ReadinessRulesResponse:
    return ReadinessRulesResponse(**readiness_rules.rules())


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
    # What it would take to change the verdict is stated from these, never from
    # numbers copied into a page.
    rules: ReadinessRulesResponse = Field(default_factory=_rules)


class SubjectResponse(BaseModel):
    id: int
    name: str
    slug: str
    kind: SubjectKind
    description: Optional[str] = None
    certification: Optional[str] = None
    pass_mark: Optional[float] = None
    exam_question_count: Optional[int] = None
    exam_minutes: Optional[int] = None
    target_exam_date: Optional[date] = None
    is_archived: bool = False
    display_order: int = 100
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
    """How many questions this preparation owns.

    Reads Question.subject_id, which is the same column ExamEngine draws from.
    That agreement is the whole value of the number: it is here so a surface can
    tell whether a preparation can be sat *before* it offers to start one, and a
    count sourced differently from the engine can promise an exam the engine then
    refuses.

    It used to match on `Question.certification == subject.certification`, which
    reported 0 for any preparation whose questions were bound by id rather than
    inherited from a matching name -- so every skill subject, which has no
    certification string at all, and every preparation a learner assigns
    questions to by hand.
    """
    return QuestionRepository(db).count_for_subject(subject.id)


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


def _with_readiness(db: Session, repo: SubjectRepository, subject) -> "SubjectWithReadiness":
    return SubjectWithReadiness(
        **SubjectResponse.model_validate(subject).model_dump(),
        readiness=_readiness_for(repo, subject),
        question_count=_question_count(db, subject),
    )


@router.get("", response_model=List[SubjectWithReadiness])
def list_subjects(
    include_archived: bool = Query(
        True,
        description=(
            "Archived preparations are included by default. The default is True "
            "for compatibility: Home, the Practice hub, Analytics, Exam Setup and "
            "the subject page all call this with no arguments, and flipping it "
            "would silently remove rows from all of them. The picker asks for "
            "False."
        ),
    ),
    db: Session = Depends(get_db),
):
    """Every subject with its readiness. This is what Home renders."""
    repo = SubjectRepository(db)
    return [
        _with_readiness(db, repo, s)
        for s in repo.get_all(include_archived=include_archived)
    ]


@router.post("", response_model=SubjectWithReadiness, status_code=status.HTTP_201_CREATED)
def create_subject(req: SubjectCreate, db: Session = Depends(get_db)):
    """Add a preparation.

    Returns the full read shape rather than a bare id, so the picker can render
    the new preparation without a second round trip.

    A new preparation adopts any unowned questions that already carry its
    certification string, which is visible here as a non-zero `question_count` on
    the response -- the learner who imported a bank first and added the
    preparation second sees the two found each other.
    """
    service = SubjectService(db)
    subject, _result = service.create(req)
    return _with_readiness(db, service.repo, subject)


@router.put("/{subject_id}", response_model=SubjectWithReadiness)
def update_subject(subject_id: int, req: SubjectUpdate, db: Session = Depends(get_db)):
    """Edit a preparation, or archive it by sending `is_archived: true`.

    Every field is optional and omitted fields are left alone, so a form that
    sends one changed field cannot clobber the rest. `slug` and `kind` are not
    editable -- see SubjectUpdate for why.
    """
    service = SubjectService(db)
    subject = service.update(subject_id, req)
    return _with_readiness(db, service.repo, subject)


@router.delete("/{subject_id}", response_model=SubjectDeleteResult)
def delete_subject(
    subject_id: int, req: SubjectDeleteRequest, db: Session = Depends(get_db)
):
    """Destroy a preparation, its questions and its exam evidence.

    Irreversible, and this application has no backup mechanism, so `confirm_name`
    must equal the preparation's name exactly. A mismatch deletes nothing and
    returns 400.

    Archiving (`PUT` with `is_archived: true`) is the reversible option and keeps
    everything.

    The response reports every count -- deleted and merely unlinked -- so the
    surface can say what actually happened rather than repeating what it promised.
    """
    return SubjectService(db).delete(subject_id, req.confirm_name)


@router.get("/{subject_id}/mocks", response_model=List[MockHistoryItem])
def list_mocks(
    subject_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """The mocks sat for this preparation, newest first."""
    repo = SubjectRepository(db)
    subject = repo.get_by_id(subject_id)
    if not subject:
        raise ResourceNotFoundException("Subject", subject_id)
    return [
        MockHistoryItem(
            session_id=s.id,
            title=s.title,
            taken_at=s.end_time or s.start_time,
            score_percentage=s.score_percentage,
            passed=(
                None if subject.pass_mark is None or s.score_percentage is None
                else s.score_percentage >= subject.pass_mark
            ),
            correct_count=s.correct_count or 0,
            total_questions=s.total_questions or 0,
            time_spent_seconds=s.time_spent_seconds or 0,
        )
        for s in repo.get_mock_sessions(subject, limit)
    ]


@router.get("/{subject_id}", response_model=SubjectWithReadiness)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    repo = SubjectRepository(db)
    subject = repo.get_by_id(subject_id)
    if not subject:
        raise ResourceNotFoundException("Subject", subject_id)
    return _with_readiness(db, repo, subject)
