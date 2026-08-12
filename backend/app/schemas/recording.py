from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.analytics import ScoreTrendPoint


class PracticeRecordingResponse(BaseModel):
    id: int
    title: str
    mime_type: str
    duration_seconds: Optional[int] = None
    file_size_bytes: int
    interview_question_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecordingCommunicationScore(BaseModel):
    category: str
    score: float
    max_score: float = 10.0
    feedback: str


class RecordingAnalysisResponse(BaseModel):
    id: int
    recording_id: int
    provider: Optional[str] = None
    transcript: Optional[str] = None
    communication_scores: List[RecordingCommunicationScore] = []
    filler_word_count: Optional[int] = None
    summary: Optional[str] = None
    content_scores: List[RecordingCommunicationScore] = []
    content_summary: Optional[str] = None
    analysis_status: str
    analysis_error: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnalyzeRecordingRequest(BaseModel):
    provider: Optional[str] = None


class ProviderInfo(BaseModel):
    name: str
    is_available: bool


class RoundAnalyticsItem(BaseModel):
    round_type: str
    round_label: str
    attempt_count: int
    avg_content_score_pct: Optional[float] = None
    avg_delivery_score_pct: Optional[float] = None


class WeakestContentCategory(BaseModel):
    category: str
    round_label: str
    avg_score_pct: float


class RecordingAnalytics(BaseModel):
    total_recordings: int
    analyzed_count: int
    by_round: List[RoundAnalyticsItem] = []
    delivery_trend: List[ScoreTrendPoint] = []
    weakest_content_category: Optional[WeakestContentCategory] = None
