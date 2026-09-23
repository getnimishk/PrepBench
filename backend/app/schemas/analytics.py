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


class DomainTopicItem(BaseModel):
    """A topic group inside one area, with the answers behind its figure."""
    topic: str
    answers: int
    correct: int
    accuracy_percentage: float


class DomainQuestionItem(BaseModel):
    id: int
    text: str
    topic: str
    # unseen: never answered. missed: answered wrong at least once. correct:
    # answered, and never wrong.
    state: str
    times_answered: int
    times_correct: int
    due: bool


class DomainDetail(BaseModel):
    """One area of one preparation, from every answer given in it (drills included)."""
    subject_id: int
    domain: str
    answers: int
    correct: int
    # None, never 0, when nothing in the area has been answered.
    accuracy_percentage: Optional[float] = None
    question_count: int
    attempted_questions: int
    missed_questions: int
    due_now: int
    # Wrong answers from mocks here that are still in the review queue.
    unreviewed_misses: int = 0
    # A topic is listed only once it has this many answers.
    min_answers_per_topic: int
    topics: List[DomainTopicItem]
    # Missed first, then due, then unseen, then correct. At most `questions_limit`.
    questions: List[DomainQuestionItem]
    questions_limit: int
