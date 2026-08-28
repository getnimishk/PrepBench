# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.question import QuestionDifficulty
from app.schemas.analytics import ScoreTrendPoint


class CategoryScore(BaseModel):
    category: str
    score: float
    max_score: float = 10.0
    feedback: str


class SystemDesignPromptBase(BaseModel):
    title: str
    prompt_text: str
    category: str = "General"
    difficulty: QuestionDifficulty = QuestionDifficulty.MEDIUM


class SystemDesignPromptCreate(SystemDesignPromptBase):
    is_ai_generated: bool = False
    source_topic: Optional[str] = None


class SystemDesignPromptResponse(SystemDesignPromptBase):
    id: int
    is_ai_generated: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SystemDesignPromptFilter(BaseModel):
    category: Optional[str] = None
    difficulty: Optional[QuestionDifficulty] = None
    keyword: Optional[str] = None


class GeneratePromptRequest(BaseModel):
    topic: Optional[str] = None
    difficulty: Optional[QuestionDifficulty] = None
    save_to_bank: bool = False


class SubmitAttemptRequest(BaseModel):
    prompt_id: int
    answer_text: str = Field(..., min_length=1)
    target_role: Optional[str] = None
    time_spent_seconds: int = 0


class SystemDesignAttemptResponse(BaseModel):
    id: int
    prompt_id: int
    answer_text: str
    target_role: Optional[str] = None
    overall_score: Optional[float] = None
    category_scores: List[CategoryScore] = []
    strengths: List[str] = []
    improvements: List[str] = []
    summary: Optional[str] = None
    grading_status: str
    grading_error: Optional[str] = None
    time_spent_seconds: int
    created_at: datetime
    prompt: Optional[SystemDesignPromptResponse] = None

    model_config = ConfigDict(from_attributes=True)


class RecentAttemptItem(BaseModel):
    id: int
    prompt_title: str
    overall_score: Optional[float] = None
    created_at: datetime


class SystemDesignAnalytics(BaseModel):
    total_attempts: int
    graded_count: int
    average_score: Optional[float] = None
    score_trend: List[ScoreTrendPoint] = []
    category_averages: List[CategoryScore] = []
    recent_attempts: List[RecentAttemptItem] = []
