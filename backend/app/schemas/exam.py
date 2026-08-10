from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.exam_session import ExamMode, ExamStatus
from app.models.exam_answer import ConfidenceLevel
from app.schemas.question import QuestionResponse

class ExamCreateRequest(BaseModel):
    title: Optional[str] = "Exam Session"
    exam_mode: ExamMode = ExamMode.PRACTICE
    certification: Optional[str] = None
    topics: Optional[List[str]] = None
    difficulties: Optional[List[str]] = None
    total_questions: int = Field(default=25, ge=1)
    time_allowed_minutes: Optional[int] = 60
    passing_percentage: float = 70.0
    randomize_questions: bool = True
    randomize_options: bool = True

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

    model_config = ConfigDict(from_attributes=True)

class ExamSessionResponse(BaseModel):
    id: int
    title: str
    exam_mode: ExamMode
    status: ExamStatus
    certification: Optional[str] = None
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
