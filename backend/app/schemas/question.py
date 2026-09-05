# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator, Field, AliasChoices
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
    # NULL-tolerant because the column is nullable and the response model is
    # not. A single row with tags IS NULL -- which the app never writes, but a
    # hand-loaded bank can carry -- raised a ValidationError inside the list
    # comprehension that builds the page, so one bad row 500'd the entire
    # Question Bank and the screen said "check backend connection" over a
    # backend that was running perfectly. No tags and an absent tags list are
    # the same statement; a crash is not a third option.
    tags: List[str] = []
    code_snippet: Optional[str] = None
    case_study_text: Optional[str] = None
    image_url: Optional[str] = None
    explanation: Optional[str] = None
    reference_url: Optional[str] = None

    @field_validator("tags", mode="before")
    @classmethod
    def _tags_never_null(cls, v):
        return [] if v is None else v


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
