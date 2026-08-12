from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.interview_question import InterviewRoundType


class InterviewQuestionBase(BaseModel):
    round_type: InterviewRoundType
    question_text: str
    category: Optional[str] = None


class InterviewQuestionCreate(InterviewQuestionBase):
    is_ai_generated: bool = False
    source_topic: Optional[str] = None


class InterviewQuestionResponse(InterviewQuestionBase):
    id: int
    is_ai_generated: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InterviewQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    category: Optional[str] = None


class InterviewQuestionImportResult(BaseModel):
    imported_count: int
    skipped_count: int
    errors: List[str] = []


class InterviewQuestionFilter(BaseModel):
    round_type: Optional[InterviewRoundType] = None
    category: Optional[str] = None
    keyword: Optional[str] = None


class GenerateInterviewQuestionRequest(BaseModel):
    round_type: InterviewRoundType
    topic: Optional[str] = None
    save_to_bank: bool = False


class RoundTypeInfo(BaseModel):
    value: str
    label: str
