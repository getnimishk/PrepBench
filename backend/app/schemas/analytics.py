# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Dict, Optional
from pydantic import BaseModel

class TopicMasteryItem(BaseModel):
    topic: str
    domain: str
    total_attempted: int
    correct_count: int
    accuracy_percentage: float

class DomainMasteryItem(BaseModel):
    domain: str
    total_attempted: int
    correct_count: int
    accuracy_percentage: float

class ScoreTrendPoint(BaseModel):
    date: str
    score: float
    rolling_avg: float
    exam_title: str

class ActivityHeatmapItem(BaseModel):
    date: str
    count: int

class DashboardOverview(BaseModel):
    total_exams: int
    total_questions_attempted: int
    overall_accuracy_percentage: float
    average_time_per_question_seconds: float
    weak_topics: List[TopicMasteryItem]
    strong_topics: List[TopicMasteryItem]
    spaced_repetition_due_count: int
    recent_exams: List[Dict]
