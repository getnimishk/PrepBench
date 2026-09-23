# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
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


def _known_sections(value):
    from app.services.system_design_sections import SECTION_KEYS

    if value is not None:
        unknown = set(value) - set(SECTION_KEYS)
        if unknown:
            raise ValueError(f"Unknown answer sections: {', '.join(sorted(unknown))}")
    return value


class SubmitAttemptRequest(BaseModel):
    prompt_id: int
    # The whole answer, for a caller that does not send sections. When sections
    # are sent the server builds this from them.
    answer_text: str = ""
    sections: Optional[Dict[str, str]] = None
    target_role: Optional[str] = None
    time_spent_seconds: int = 0

    @field_validator("sections")
    @classmethod
    def only_known_sections(cls, v):
        return _known_sections(v)


class DraftRequest(BaseModel):
    """What the answer page has in the box right now.

    `answer_text` has no min_length: clearing the box is a real edit, and a
    draft that refuses to record an emptied one would restore deleted text on
    the next visit.
    """
    answer_text: str = ""
    sections: Optional[Dict[str, str]] = None
    target_role: Optional[str] = None

    @field_validator("sections")
    @classmethod
    def only_known_sections(cls, v):
        return _known_sections(v)


class DraftResponse(BaseModel):
    prompt_id: int
    answer_text: str
    sections: Optional[Dict[str, str]] = None
    target_role: Optional[str] = None
    updated_at: Optional[datetime] = None
    # False when there is nothing saved for this prompt. The page needs to know
    # the difference between "resumed an empty draft" and "never started".
    exists: bool = True


class SystemDesignAttemptResponse(BaseModel):
    id: int
    prompt_id: int
    answer_text: str
    sections: Optional[Dict[str, str]] = None
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
