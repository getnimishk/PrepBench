# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class QuestionHit(BaseModel):
    id: int
    text: str
    domain: str
    topic: str
    difficulty: str


class GuideSectionHit(BaseModel):
    section_id: int
    title: str
    # The sentence around the match, or the start of the section when only its
    # title matched. Never the whole body: a guide section can run to pages.
    excerpt: Optional[str] = None
    # "ai" | "learner" -- who wrote the section, shown with it so a model's draft
    # is not presented as reference material.
    written_by: str
    read: bool
    topic_id: int
    topic_title: str
    roadmap_id: int
    roadmap_title: str


class RoadmapHit(BaseModel):
    id: int
    title: str
    phase_count: int
    topic_count: int
    # False for a roadmap that belongs to no preparation. It is still found, and
    # labelled, the way the roadmap list shows it rather than hiding it.
    linked: bool


class TopicHit(BaseModel):
    id: int
    title: str
    status: str
    phase_name: str
    roadmap_id: int
    roadmap_title: str


class RecordingHit(BaseModel):
    id: int
    title: str
    question_text: Optional[str] = None
    created_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    # None when the take was never analysed.
    analysis_status: Optional[str] = None


class QuestionResults(BaseModel):
    total: int
    items: List[QuestionHit]


class GuideSectionResults(BaseModel):
    total: int
    items: List[GuideSectionHit]


class RoadmapResults(BaseModel):
    total: int
    items: List[RoadmapHit]


class TopicResults(BaseModel):
    total: int
    items: List[TopicHit]


class RecordingResults(BaseModel):
    total: int
    items: List[RecordingHit]


class SearchResponse(BaseModel):
    """Every kind of thing that matched, each counted in full and listed in part.

    `total` is every match; `items` is at most the requested limit of them, so a
    page can say "6 of 212" and link to where all 212 are.
    """

    query: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    questions: QuestionResults
    guides: GuideSectionResults
    roadmaps: RoadmapResults
    topics: TopicResults
    # Interview recordings belong to no preparation, so these come from all of
    # them whichever one is picked -- the page says so.
    recordings: RecordingResults
