from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, AliasChoices
from app.models.question import QuestionType, QuestionDifficulty

class QuestionOptionBase(BaseModel):
    option_text: str
    is_correct: bool = Field(default=False, validation_alias=AliasChoices('is_correct', 'isCorrect'))
    explanation_why_incorrect: Optional[str] = None
    order_index: int = 0

class QuestionOptionCreate(QuestionOptionBase):
    pass

class QuestionOptionResponse(QuestionOptionBase):
    id: int
    question_id: int

    model_config = ConfigDict(from_attributes=True)

class QuestionBase(BaseModel):
    text: str
    question_type: QuestionType = QuestionType.SINGLE_CHOICE
    difficulty: QuestionDifficulty = QuestionDifficulty.MEDIUM
    domain: str = "General"
    topic: str = "General"
    subtopic: Optional[str] = None
    certification: str = "General Prep"
    source: Optional[str] = None
    tags: List[str] = []
    code_snippet: Optional[str] = None
    case_study_text: Optional[str] = None
    image_url: Optional[str] = None
    explanation: Optional[str] = None
    reference_url: Optional[str] = None

class QuestionCreate(QuestionBase):
    options: List[QuestionOptionCreate]

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    question_type: Optional[QuestionType] = None
    difficulty: Optional[QuestionDifficulty] = None
    domain: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    certification: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    code_snippet: Optional[str] = None
    case_study_text: Optional[str] = None
    image_url: Optional[str] = None
    explanation: Optional[str] = None
    reference_url: Optional[str] = None
    is_reviewed: Optional[bool] = None
    options: Optional[List[QuestionOptionCreate]] = None

class QuestionResponse(QuestionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    is_reviewed: bool = False
    options: List[QuestionOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)

class QuestionFilter(BaseModel):
    keyword: Optional[str] = None
    domain: Optional[str] = None
    topic: Optional[str] = None
    certification: Optional[str] = None
    difficulty: Optional[QuestionDifficulty] = None
    tag: Optional[str] = None
    is_reviewed: Optional[bool] = None

class QuestionBulkDeleteRequest(BaseModel):
    ids: List[int]
