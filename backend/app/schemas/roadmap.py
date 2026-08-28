# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.roadmap import RoadmapTopicStatus


# ---------------------------------------------------------------- topics

class RoadmapTopicBase(BaseModel):
    title: str
    learning_objective: Optional[str] = None
    success_criteria: Optional[str] = None
    estimated_hours: Optional[float] = Field(default=None, ge=0)


class RoadmapTopicCreate(RoadmapTopicBase):
    phase_id: int
    order_index: Optional[int] = None


class RoadmapTopicUpdate(BaseModel):
    """
    PATCH payload. Every field optional, and the service applies it with
    `model_dump(exclude_unset=True)` so that omitting a field leaves it alone
    while explicitly sending null clears it -- the two are otherwise
    indistinguishable, and the UI needs to be able to clear evidence_notes.
    """

    title: Optional[str] = None
    learning_objective: Optional[str] = None
    success_criteria: Optional[str] = None
    estimated_hours: Optional[float] = Field(default=None, ge=0)
    status: Optional[RoadmapTopicStatus] = None
    progress_percentage: Optional[int] = Field(default=None, ge=0, le=100)
    evidence_notes: Optional[str] = None
    phase_id: Optional[int] = None
    order_index: Optional[int] = None


class RoadmapTopicResponse(RoadmapTopicBase):
    id: int
    roadmap_id: int
    phase_id: int
    order_index: int
    status: RoadmapTopicStatus
    progress_percentage: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    evidence_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- phases

class RoadmapPhaseCreate(BaseModel):
    name: str
    order_index: Optional[int] = None


class RoadmapPhaseUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None


class RoadmapPhaseResponse(BaseModel):
    id: int
    roadmap_id: int
    name: str
    order_index: int
    topics: List[RoadmapTopicResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------- resources

class RoadmapResourceCreate(BaseModel):
    title: str
    columns: List[str] = []
    rows: List[List[str]] = []
    order_index: Optional[int] = None


class RoadmapResourceResponse(BaseModel):
    id: int
    roadmap_id: int
    title: str
    order_index: int
    columns: List[str] = []
    rows: List[List[str]] = []

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------- progress

class RoadmapProgress(BaseModel):
    total_topics: int
    not_started_count: int
    in_progress_count: int
    completed_count: int
    skipped_count: int

    # Null, never 0, when there is nothing to measure. A roadmap with no
    # topics is not "0% complete" -- that is a claim about progress it has no
    # basis to make, the same class of error as showing a fabricated score for
    # an ungraded attempt.
    completion_percentage: Optional[float] = None

    # Null unless *every* non-skipped topic carries an estimate. Averaging over
    # only the subset that happens to have hours yields a confidently wrong
    # number, so this is all-or-nothing on purpose.
    hours_percentage: Optional[float] = None
    total_estimated_hours: Optional[float] = None
    completed_estimated_hours: Optional[float] = None


# -------------------------------------------------------------- roadmaps

class RoadmapCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    weekly_hours_budget: Optional[float] = Field(default=None, gt=0)


class RoadmapUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    weekly_hours_budget: Optional[float] = Field(default=None, gt=0)
    is_archived: Optional[bool] = None


class RoadmapSummaryResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    source_filename: Optional[str] = None
    start_date: Optional[date] = None
    weekly_hours_budget: Optional[float] = None
    is_archived: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    progress: RoadmapProgress

    model_config = ConfigDict(from_attributes=True)


class RoadmapDetailResponse(RoadmapSummaryResponse):
    phases: List[RoadmapPhaseResponse] = []
    resources: List[RoadmapResourceResponse] = []


# -------------------------------------------------------------- schedule

class RoadmapScheduleItem(BaseModel):
    topic_id: int
    phase_id: int
    phase_name: str
    title: str
    status: RoadmapTopicStatus
    estimated_hours: Optional[float] = None

    # "actual"        -- completed, using its real started/completed dates
    # "projected"     -- forecast from remaining hours against the weekly budget
    # "unschedulable" -- no estimated_hours, so it gets no bar rather than an
    #                    invented duration
    schedule_status: str
    start: Optional[date] = None
    end: Optional[date] = None


class RoadmapPhaseScheduleItem(BaseModel):
    phase_id: int
    phase_name: str
    start: Optional[date] = None
    end: Optional[date] = None
    schedule_status: str


class RoadmapSchedule(BaseModel):
    schedule_available: bool
    # One of: no_topics | no_start_date | no_weekly_budget | no_time_estimates
    reason: Optional[str] = None
    start_date: Optional[date] = None
    weekly_hours_budget: Optional[float] = None
    projected_end_date: Optional[date] = None
    unschedulable_topic_count: int = 0
    items: List[RoadmapScheduleItem] = []
    phases: List[RoadmapPhaseScheduleItem] = []


# ---------------------------------------------------------------- import

class RoadmapImportTopic(BaseModel):
    title: str
    phase_name: str
    learning_objective: Optional[str] = None
    success_criteria: Optional[str] = None
    estimated_hours: Optional[float] = Field(default=None, ge=0)
    status: RoadmapTopicStatus = RoadmapTopicStatus.NOT_STARTED
    progress_percentage: int = Field(default=0, ge=0, le=100)

    # Carried through from a progress sheet when it has them. Left null
    # otherwise -- importing a row that says "Completed" without a date must
    # not stamp today, which would claim you finished it on import day.
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    evidence_notes: Optional[str] = None


class RoadmapImportResource(BaseModel):
    title: str
    columns: List[str] = []
    rows: List[List[str]] = []


class RoadmapImportPreview(BaseModel):
    """What the staged-review UI renders before anything is written."""

    title: str
    description: Optional[str] = None
    source_filename: Optional[str] = None
    phases: List[str] = []
    topics: List[RoadmapImportTopic] = []
    resources: List[RoadmapImportResource] = []
    warnings: List[str] = []
    ignored_sheets: List[str] = []

    @property
    def topic_count(self) -> int:
        return len(self.topics)


class RoadmapImportConfirm(BaseModel):
    """The (possibly user-edited) preview, sent back to be committed."""

    title: str
    description: Optional[str] = None
    source_filename: Optional[str] = None
    topics: List[RoadmapImportTopic] = []
    resources: List[RoadmapImportResource] = []
    start_date: Optional[date] = None
    weekly_hours_budget: Optional[float] = Field(default=None, gt=0)


class RoadmapImportResult(BaseModel):
    roadmap_id: int
    title: str
    phase_count: int
    topic_count: int
    resource_count: int
