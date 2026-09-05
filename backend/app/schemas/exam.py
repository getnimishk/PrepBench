# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.exam_session import ExamMode, ExamStatus
from app.repositories.subject_repository import MOCK, DRILL
from app.models.exam_answer import ConfidenceLevel
from app.schemas.question import QuestionResponse

class ExamCreateRequest(BaseModel):
    title: Optional[str] = "Exam Session"
    exam_mode: ExamMode = ExamMode.PRACTICE
    certification: Optional[str] = None
    topics: Optional[List[str]] = None
    # The exam-blueprint area, e.g. "Managing Products with Agility". This is
    # what "practise your weak area" actually restricts to.
    domains: Optional[List[str]] = None
    difficulties: Optional[List[str]] = None
    total_questions: int = Field(default=25, ge=1)
    time_allowed_minutes: Optional[int] = 60
    passing_percentage: float = 70.0
    randomize_questions: bool = True

    # A mock measures readiness; a drill closes gaps. The model and the
    # readiness rule have distinguished them since they were added, but the
    # request did not carry the field -- so every session the app created fell
    # back to the "drill" default and readiness could never leave
    # needs_evaluation through normal use.
    #
    # Defaults to drill deliberately: a caller that has not thought about it
    # is not taking an exam under exam conditions, and readiness must only
    # ever rise on evidence someone meant to produce.
    session_kind: str = DRILL

    # Which subject this session belongs to. Without it a session resolved to
    # a subject by certification string alone, so a skill subject -- which has
    # no certification -- could never own one.
    subject_id: Optional[int] = None

    @field_validator("session_kind")
    @classmethod
    def known_session_kind(cls, v):
        """Only the two words the rest of the app knows.

        An unrecognised value would be stored verbatim and then silently fail
        every mock filter, which reads as "the exam did not count" with
        nothing anywhere explaining why.
        """
        if v not in (MOCK, DRILL):
            raise ValueError(f"session_kind must be '{MOCK}' or '{DRILL}'")
        return v

class SaveAnswerRequest(BaseModel):
    question_id: int
    selected_option_ids: List[int]
    time_spent_seconds: int = 0
    confidence_level: ConfidenceLevel = ConfidenceLevel.NOT_SET
    is_flagged: bool = False
    is_bookmarked: bool = False
    user_notes: Optional[str] = None

class ExamAnswerResponse(BaseModel):
    id: int
    session_id: int
    question_id: int
    selected_option_ids: List[int] = []
    is_correct: Optional[bool] = None
    time_spent_seconds: int
    confidence_level: ConfidenceLevel
    is_flagged: bool
    is_bookmarked: bool
    user_notes: Optional[str] = None
    # When this answer was actually looked at after the mock. None means it
    # has not been. Exposed so the client can tell the difference -- without
    # it the review count could only ever be written to, never read, and
    # "90 unreviewed" was a number with no way down.
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ExamSessionResponse(BaseModel):
    id: int
    title: str
    exam_mode: ExamMode
    status: ExamStatus
    certification: Optional[str] = None

    # A mock must be identifiable wherever a session is shown. Without these
    # the UI could tell you your score but not whether it counted, which is
    # the one thing the score means.
    #
    # `source` is response-only on purpose -- there is no field for it on
    # ExamCreateRequest, so a client cannot declare its own provenance and
    # everything the app records is the learner's.
    session_kind: str = DRILL
    subject_id: Optional[int] = None
    total_questions: int
    answered_questions: int
    correct_count: int
    score_percentage: Optional[float] = None
    passing_percentage: float
    is_passed: Optional[str] = None
    time_allowed_seconds: Optional[int] = None
    time_spent_seconds: int
    current_question_index: int
    question_ids_order: List[int] = []
    start_time: datetime
    end_time: Optional[datetime] = None
    answers: List[ExamAnswerResponse] = []

    model_config = ConfigDict(from_attributes=True)

class ExamDetailResponse(ExamSessionResponse):
    questions: List[QuestionResponse] = []
