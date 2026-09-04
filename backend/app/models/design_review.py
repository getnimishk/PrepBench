# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
A design review is two defensible architectures for one requirement.

The learner picks one and says why. What is scored is not which option they
picked -- often either is right -- but whether their reasoning named the axis
the decision actually turns on. That is what `deciding_axis` holds, and keeping
it as one short sentence is what makes grading a narrow question rather than an
expert judgement about architecture quality.
"""
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.question import QuestionDifficulty


class DesignReview(Base):
    __tablename__ = "design_reviews"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False)

    # The situation, with numbers and a tension. Deliberately not "design X".
    brief = Column(Text, nullable=False)

    # Shares vocabulary with the system design prompt bank so the two features
    # can eventually be filtered together.
    domain = Column(String(50), nullable=False, default="data_platform", index=True)
    difficulty = Column(Enum(QuestionDifficulty), nullable=False, default=QuestionDifficulty.MEDIUM)

    # The one thing this review is about, in a sentence. The answer key.
    deciding_axis = Column(Text, nullable=False)

    # The same axis as a short name -- "Cost", "Freshness" -- so attempts can be
    # grouped by it and the learner can be told, in words, which one they keep
    # missing. Nullable because rows created before this column existed have no
    # value until the seeder backfills them.
    axis_label = Column(String(60), nullable=True, index=True)

    # What actually separates the two options, shown after the learner commits.
    reveal = Column(Text, nullable=False)

    # What "neither -- I would ask first" should contain. Present on every
    # review: refusing to choose until you know something is frequently the
    # correct professional answer, and it is the skill this format can teach
    # for free.
    elicit_answer = Column(Text, nullable=False)

    # Vocabulary this review introduces, so the terms can be listed and, later,
    # cross-referenced the way the Chart Sandbox lists its concepts.
    concepts = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    options = relationship(
        "DesignOption",
        back_populates="review",
        cascade="all, delete-orphan",
        order_by="DesignOption.label",
    )
    attempts = relationship(
        "DesignReviewAttempt",
        back_populates="review",
        cascade="all, delete-orphan",
    )


class DesignOption(Base):
    """One of the two architectures. Both must be defensible.

    `holds_when` and `breaks_when` are required rather than optional because an
    option with no stated failure mode is not a real alternative -- it is the
    right answer wearing a disguise, and a review built from one stops teaching
    after the learner notices the pattern.
    """
    __tablename__ = "design_options"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("design_reviews.id", ondelete="CASCADE"), nullable=False, index=True)

    label = Column(String(1), nullable=False)  # "A" or "B"
    name = Column(String(200), nullable=False)
    summary = Column(Text, nullable=False)

    # The pipeline as ordered stages -- [{"label": ..., "detail": ...}] -- and
    # rendered as boxes and arrows by the client. Structured rather than a
    # diagram source string so it needs no diagram library, inherits the app
    # theme for free, and stays writable by hand in the seed file.
    flow = Column(JSON, nullable=False, default=list)

    key_choices = Column(JSON, nullable=False, default=list)
    holds_when = Column(Text, nullable=False)
    breaks_when = Column(Text, nullable=False)

    # Always states the assumption it rests on. A bare number here would be a
    # coefficient presented as a measurement, which this app does not do.
    rough_cost = Column(Text, nullable=False)

    review = relationship("DesignReview", back_populates="options")


class DesignReviewAttempt(Base):
    __tablename__ = "design_review_attempts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("design_reviews.id", ondelete="CASCADE"), nullable=False, index=True)

    choice = Column(String(10), nullable=False)  # "A" | "B" | "ask_first"
    justification = Column(Text, nullable=False)

    # pending | graded | not_graded. "not_graded" is a real, displayable state:
    # with no AI provider configured the attempt still saves and the reveal
    # still shows, and the verdict reads "Not graded" rather than a zero.
    grading_status = Column(String(20), nullable=False, default="not_graded")
    axis_verdict = Column(String(20), nullable=True)  # named | partial | missed
    feedback = Column(Text, nullable=True)

    time_spent_seconds = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    review = relationship("DesignReview", back_populates="attempts")
