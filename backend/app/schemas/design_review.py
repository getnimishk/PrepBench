# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.question import QuestionDifficulty

VALID_CHOICES = {"A", "B", "ask_first"}


class FlowStage(BaseModel):
    label: str
    detail: Optional[str] = None
    # Marks the stage the option's cost or risk actually sits on, so the client
    # can draw attention to it rather than rendering an even row of boxes.
    emphasis: bool = False


class DesignOptionBase(BaseModel):
    label: str
    name: str
    summary: str
    flow: List[FlowStage] = []
    key_choices: List[str] = []
    holds_when: str
    breaks_when: str
    rough_cost: str


class DesignOptionCreate(DesignOptionBase):
    pass


class DesignOptionResponse(DesignOptionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class DesignReviewBase(BaseModel):
    title: str
    brief: str
    domain: str = "data_platform"
    difficulty: QuestionDifficulty = QuestionDifficulty.MEDIUM
    deciding_axis: str
    reveal: str
    elicit_answer: str
    concepts: List[str] = []


class DesignReviewCreate(DesignReviewBase):
    axis_label: Optional[str] = None
    options: List[DesignOptionCreate]

    @field_validator("options")
    @classmethod
    def exactly_two_labelled_a_and_b(cls, v):
        """A review is a choice between two. One option is a lecture; three is
        a different exercise with a different failure mode."""
        if len(v) != 2:
            raise ValueError("a design review needs exactly two options")
        if {o.label for o in v} != {"A", "B"}:
            raise ValueError("options must be labelled A and B")
        return v


class AxisPerformance(BaseModel):
    axis_label: str
    attempts: int
    named: int
    partial: int
    missed: int
    # None, not zero, when nothing on this axis has been graded -- an
    # ungraded axis has no rate, and inventing 0% would read as a failure.
    named_rate: Optional[float] = None


class DesignReviewAnalytics(BaseModel):
    total_attempts: int
    graded_attempts: int
    reviews_completed: int
    reviews_available: int
    by_axis: List[AxisPerformance] = []
    # The single most useful sentence this feature produces, or None when
    # there is not yet enough graded work to name one honestly.
    weakest_axis: Optional[AxisPerformance] = None


class DesignReviewSummary(BaseModel):
    """List-view shape. Deliberately omits deciding_axis, reveal and
    elicit_answer -- the answer key must not travel to a client rendering a
    review the learner has not yet answered, exactly as the exam endpoints
    strip `reveal` from an unanswered question."""
    id: int
    title: str
    domain: str
    difficulty: QuestionDifficulty
    # Safe to list: the short axis name says which decision the review is
    # about without giving away which way it goes.
    axis_label: Optional[str] = None
    concepts: List[str] = []
    attempted: bool = False

    model_config = ConfigDict(from_attributes=True)


class DesignReviewDetail(BaseModel):
    """What the learner sees while deciding: the brief and both options, and
    nothing that gives the answer away."""
    id: int
    title: str
    brief: str
    domain: str
    difficulty: QuestionDifficulty
    concepts: List[str] = []
    options: List[DesignOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class DesignReviewReveal(BaseModel):
    """Released once an attempt exists, never before."""
    deciding_axis: str
    reveal: str
    elicit_answer: str


class DesignReviewFilter(BaseModel):
    domain: Optional[str] = None
    axis_label: Optional[str] = None
    difficulty: Optional[QuestionDifficulty] = None
    keyword: Optional[str] = None


# Words that make a sentence a question even without the punctuation. A real
# answer is as often "I would want to know the actual latency budget" as it is
# a sentence ending in a question mark.
INTERROGATIVES = (
    "what", "how", "who", "when", "which", "where", "why", "whether",
    "is there", "are there", "do they", "does the", "can we", "want to know",
    "need to know", "ask ",
)


class SubmitReviewAttemptRequest(BaseModel):
    review_id: int
    choice: str
    justification: str = Field(..., min_length=1)
    time_spent_seconds: int = 0

    @field_validator("choice")
    @classmethod
    def known_choice(cls, v):
        if v not in VALID_CHOICES:
            raise ValueError(f"choice must be one of {sorted(VALID_CHOICES)}")
        return v

    @field_validator("justification")
    @classmethod
    def not_only_whitespace(cls, v):
        if not v.strip():
            raise ValueError("justification cannot be empty")
        return v

    @model_validator(mode="after")
    def declining_to_choose_requires_a_question(self):
        """"Neither" has to name what you would ask.

        Otherwise it is the one answer that can be given without thinking, and
        the exercise quietly acquires an opt-out. Accepts an implied question
        as well as a punctuated one, because "I would want to know the actual
        latency budget" is the same move as asking it outright.
        """
        if self.choice != "ask_first":
            return self
        text = self.justification.strip().lower()
        if "?" not in text and not any(word in text for word in INTERROGATIVES):
            raise ValueError(
                "Say what you would ask. Declining to choose is a strong answer only "
                "when it names the question that would settle it."
            )
        return self


class DesignReviewAttemptResponse(BaseModel):
    id: int
    review_id: int
    review_title: Optional[str] = None
    choice: str
    justification: str
    grading_status: str
    axis_verdict: Optional[str] = None
    feedback: Optional[str] = None
    time_spent_seconds: int
    created_at: datetime

    # Bundled with the attempt because the reveal is what the learner came for
    # and it is unlocked by the act of answering.
    reveal: Optional[DesignReviewReveal] = None

    model_config = ConfigDict(from_attributes=True)
