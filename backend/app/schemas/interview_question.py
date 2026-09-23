# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.interview_question import InterviewRoundType


class InterviewQuestionBase(BaseModel):
    round_type: InterviewRoundType
    question_text: str
    category: Optional[str] = None
    prepared_answer: Optional[str] = None
    key_talking_points: Optional[List[str]] = None


class InterviewQuestionCreate(InterviewQuestionBase):
    is_ai_generated: bool = False
    source_topic: Optional[str] = None


class InterviewQuestionResponse(InterviewQuestionBase):
    id: int
    is_ai_generated: bool
    created_at: datetime
    # How many takes of this question have been recorded. Filled by the list
    # endpoint; 0 elsewhere rather than a guess.
    practice_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class InterviewQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    category: Optional[str] = None
    prepared_answer: Optional[str] = None
    key_talking_points: Optional[List[str]] = None


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
    # Guidance for answering this round -- see services/interview_rounds.py.
    # Defaults keep the shape valid for any caller that builds one bare.
    target_min_seconds: int = 0
    target_max_seconds: int = 0
    thinking_seconds: int = 0
    plan_prompt: str = ""
    listening_for: str = ""
    content_categories: List[str] = []
