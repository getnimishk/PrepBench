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
    subject_id: Optional[int] = None
    source_ref: Optional[str] = None

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
    subject_id: Optional[int] = None
    source_ref: Optional[str] = None


class InterviewQuestionSourceSave(BaseModel):
    """A question saved from built-in content, e.g. a scenario's Say-it step.

    Matched on `source_ref`: the first save creates the question, every later
    one updates that same row. The technical round is the default (D14): these
    answers say how the learner would handle something, not a story of having
    done it, and the hiring-manager rubric would mark that down.
    """

    source_ref: str = Field(min_length=1, max_length=150)
    subject_id: Optional[int] = None
    round_type: InterviewRoundType = InterviewRoundType.TECHNICAL
    question_text: str = Field(min_length=1)
    category: Optional[str] = Field(default=None, max_length=150)
    prepared_answer: Optional[str] = None
    key_talking_points: Optional[List[str]] = None


class InterviewQuestionSourceSaveResult(BaseModel):
    question: InterviewQuestionResponse
    # False when an earlier save of the same source was updated.
    created: bool


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
