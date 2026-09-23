# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.interview_question import InterviewRoundType


class InterviewSessionCreate(BaseModel):
    round_type: InterviewRoundType
    category: Optional[str] = None
    # The prototype offers 1, 3 or 5. Bounded rather than enumerated so a caller
    # asking for two is not refused for a reason that has nothing to do with it.
    question_count: int = Field(default=3, ge=1, le=10)
    # Whether to give the round's thinking time before each answer.
    thinking: bool = True


class PlannedQuestion(BaseModel):
    id: int
    question_text: str
    category: Optional[str] = None
    practice_count: int
    last_practised_at: Optional[datetime] = None


class SessionTake(BaseModel):
    """One recorded answer in a session, with only what the analysis actually said."""
    recording_id: int
    interview_question_id: Optional[int] = None
    duration_seconds: Optional[int] = None
    created_at: datetime
    # None until analysed; then "analyzed" | "unavailable" | "error".
    analysis_status: Optional[str] = None
    # Averages of the graded categories, 0-100. None unless analysed -- an
    # unavailable provider produced no reading, and 0 would blame the learner.
    content_percent: Optional[float] = None
    delivery_percent: Optional[float] = None


class SessionQuestion(PlannedQuestion):
    takes: List[SessionTake] = []


class InterviewSessionResponse(BaseModel):
    id: int
    round_type: str
    round_label: str
    category: Optional[str] = None
    thinking_seconds: int
    target_min_seconds: int
    target_max_seconds: int
    plan_prompt: str
    listening_for: str
    created_at: datetime
    ended_at: Optional[datetime] = None
    questions: List[SessionQuestion]


class InterviewSessionReport(BaseModel):
    """A session, summarised from the latest take of each question.

    Averages cover analysed takes only, and say how many that was. With none
    analysed they are None and `not_graded_reason` says why -- never a zero.
    """
    session: InterviewSessionResponse
    total_questions: int
    answered: int
    analysed: int
    spoken_seconds: int
    content_percent: Optional[float] = None
    delivery_percent: Optional[float] = None
    weakest_category: Optional[str] = None
    weakest_category_percent: Optional[float] = None
    not_graded_reason: Optional[str] = None
