# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Literal, Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    # Which preparation this roadmap serves. Optional, because a roadmap
    # imported before preparations were linked is a real thing and refusing to
    # accept one without an owner would make the import stricter than the data.
    subject_id: Optional[int] = None


class RoadmapUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    weekly_hours_budget: Optional[float] = Field(default=None, gt=0)
    is_archived: Optional[bool] = None
    # How an unassigned roadmap gets assigned -- one PATCH-shaped PUT from the
    # list screen. Sending null explicitly unassigns it, which the service's
    # exclude_unset handling distinguishes from omitting the field.
    subject_id: Optional[int] = None


class RoadmapPlanPhase(BaseModel):
    """One phase as the plan editor leaves it. Its position in the list is its order."""

    # None for a phase added in the editor.
    id: Optional[int] = None
    name: str = Field(min_length=1, max_length=250)

    @field_validator("name")
    @classmethod
    def _name_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A phase needs a name.")
        return value


class RoadmapPlanRemoval(BaseModel):
    id: int
    # Where the removed phase's topics go: a position in `phases`. Required when
    # the phase holds topics. Removing a phase never deletes topics -- their
    # status, notes and demonstrations are evidence, and the plan editor is not
    # where evidence is thrown away.
    move_topics_to: Optional[int] = Field(default=None, ge=0)


class RoadmapPlanUpdate(BaseModel):
    """The whole plan, saved at once or not at all.

    Every existing phase must be accounted for, either in `phases` or in
    `removed_phases`. One that is in neither means the roadmap changed after the
    editor read it, and the save is refused rather than guessing what to do.
    """

    title: str = Field(min_length=1, max_length=250)
    start_date: Optional[date] = None
    # A week has 168 hours; anything above that is a typo, not a plan.
    weekly_hours_budget: Optional[float] = Field(default=None, gt=0, le=168)
    phases: List[RoadmapPlanPhase] = Field(default_factory=list, max_length=500)
    removed_phases: List[RoadmapPlanRemoval] = Field(default_factory=list, max_length=500)

    @field_validator("title")
    @classmethod
    def _title_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A roadmap needs a title.")
        return value


class RoadmapSummaryResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    source_filename: Optional[str] = None
    # None means "not linked to a preparation". The list screen groups those
    # under a label rather than hiding them: the learner imported the roadmap,
    # and dropping it out of view would be worse than saying it is unassigned.
    subject_id: Optional[int] = None
    start_date: Optional[date] = None
    weekly_hours_budget: Optional[float] = None
    is_archived: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # The plan's shape at a glance, for the list: the prototype's roadmap card
    # reads "10 phases · 45 topics · 134h".
    phase_count: int = 0
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
    # Estimated hours still to do: topics neither completed nor skipped, less the
    # progress already made on each. None when no topic has an estimate. Reported
    # even when no schedule can be projected, because it is what a budget divides.
    remaining_estimated_hours: Optional[float] = None
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


# -------------------------------------------------------- demonstrations

class TopicDemonstrationCreate(BaseModel):
    """An attempt to meet a topic's success criterion unprompted.

    `response_text` has a floor of 20 characters. A demonstration is an
    explanation; a single word or an empty box submitted to reach "completed" is
    the fake completion this whole mechanism exists to replace.
    """

    response_text: str = Field(min_length=20, max_length=20000)
    self_grade: Literal["not_yet", "partial", "yes"]

    @field_validator("response_text")
    @classmethod
    def _not_just_whitespace(cls, value: str) -> str:
        if len(value.strip()) < 20:
            raise ValueError(
                "Write the explanation you would give a colleague -- at least a "
                "sentence. A demonstration is what you can produce unprompted."
            )
        return value.strip()


class TopicDemonstrationResponse(BaseModel):
    id: int
    topic_id: int
    response_text: str
    self_grade: str
    repetition: int
    interval_days: int
    ease_factor: float
    next_recheck_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TopicDemonstrationResult(BaseModel):
    """The demonstration, and what it did to the topic."""

    demonstration: TopicDemonstrationResponse
    topic: RoadmapTopicResponse


# ----------------------------------------------------------- study guide

class TopicGuideSectionResponse(BaseModel):
    id: int
    topic_id: int
    order_index: int
    title: str
    body: str
    example: Optional[str] = None
    common_mistake: Optional[str] = None
    check_question: Optional[str] = None
    check_answer: Optional[str] = None
    source: str
    generated_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TopicGuideSectionWrite(BaseModel):
    """A section the learner writes or edits. Title and body are required."""

    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=40000)
    example: Optional[str] = Field(default=None, max_length=20000)
    common_mistake: Optional[str] = Field(default=None, max_length=20000)
    check_question: Optional[str] = Field(default=None, max_length=4000)
    check_answer: Optional[str] = Field(default=None, max_length=20000)


class TopicGuideResponse(BaseModel):
    """A topic's guide, plus whether an AI draft could be produced right now.

    `drafting_available` lets the page offer "Draft with AI" only when it would
    work, and say why not otherwise, instead of offering a button that fails.
    """

    sections: List[TopicGuideSectionResponse]
    read_count: int
    drafting_available: bool
    drafting_unavailable_reason: Optional[str] = None


class TopicGuideDraftResult(BaseModel):
    """What happened when a draft was requested.

    status: "drafted" -- sections were written and saved
            "unavailable" -- no AI provider is configured for this; nothing saved
            "failed" -- a provider was asked and did not produce usable sections;
                        nothing saved
    Nothing is ever invented on the unavailable or failed paths.
    """

    status: Literal["drafted", "unavailable", "failed"]
    message: str
    guide: TopicGuideResponse
