import enum
from datetime import datetime, UTC
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, Date, DateTime, Enum, JSON, ForeignKey
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def _utc_now_naive():
    return datetime.now(UTC).replace(tzinfo=None)


class RoadmapTopicStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    # Not in the source spreadsheet's three states, but needed so material you
    # already know doesn't pin you below 100% forever. Skipped topics leave the
    # progress denominator entirely (see RoadmapService.build_progress).
    SKIPPED = "skipped"


class Roadmap(Base):
    """
    A curriculum and your progress through it, collapsed into one tree.

    Deliberately NOT split into template + enrollment. In a single-user offline
    app you traverse a roadmap once; the split would add a join to every query
    and a "which enrollment?" concept to every URL to serve a use case (two
    simultaneous passes over the same curriculum) that does not exist here.
    Re-importing produces a second roadmap; restarting is a bulk update. If
    multi-pass tracking is ever wanted the migration is additive -- add an
    enrollments table and move the five progress columns off RoadmapTopic.
    """

    __tablename__ = "roadmaps"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(250), nullable=False)
    description = Column(Text, nullable=True)

    # Provenance for imported roadmaps, e.g. "Apache_Kafka_Mastery_Roadmap.xlsx".
    source_filename = Column(String(300), nullable=True)

    # Both nullable, and both required before any schedule can be projected.
    # When either is missing the schedule endpoint reports *why* it is
    # unavailable rather than inventing an anchor date or a study pace.
    start_date = Column(Date, nullable=True)
    weekly_hours_budget = Column(Float, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False, server_default="0")

    created_at = Column(DateTime, default=_utc_now_naive)
    updated_at = Column(DateTime, default=_utc_now_naive, onupdate=_utc_now_naive)

    phases = relationship(
        "RoadmapPhase",
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapPhase.order_index",
    )
    topics = relationship(
        "RoadmapTopic",
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapTopic.order_index",
    )
    resources = relationship(
        "RoadmapResource",
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapResource.order_index",
    )


class RoadmapPhase(Base):
    __tablename__ = "roadmap_phases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(250), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=_utc_now_naive)

    roadmap = relationship("Roadmap", back_populates="phases")
    topics = relationship(
        "RoadmapTopic",
        back_populates="phase",
        cascade="all, delete-orphan",
        order_by="RoadmapTopic.order_index",
    )


class RoadmapTopic(Base):
    __tablename__ = "roadmap_topics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # roadmap_id is denormalised alongside phase_id: the dominant query is
    # "every topic in roadmap X" (progress math, schedule, table view), and
    # carrying it here avoids joining through phases every time. The service
    # layer is the only writer and always derives it from the parent phase, so
    # the two can't drift.
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False, index=True)
    phase_id = Column(Integer, ForeignKey("roadmap_phases.id", ondelete="CASCADE"), nullable=False, index=True)

    order_index = Column(Integer, nullable=False, default=0)

    # Curriculum side -- from the syllabus.
    title = Column(String(300), nullable=False)
    learning_objective = Column(Text, nullable=True)
    success_criteria = Column(Text, nullable=True)
    estimated_hours = Column(Float, nullable=True)

    # Progress side -- yours. Kept coherent with each other by
    # RoadmapService._reconcile_topic_state on every write.
    status = Column(
        Enum(RoadmapTopicStatus),
        nullable=False,
        default=RoadmapTopicStatus.NOT_STARTED,
        index=True,
    )
    progress_percentage = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    evidence_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_utc_now_naive)
    updated_at = Column(DateTime, default=_utc_now_naive, onupdate=_utc_now_naive)

    roadmap = relationship("Roadmap", back_populates="topics")
    phase = relationship("RoadmapPhase", back_populates="topics")


class RoadmapResource(Base):
    """
    A free-form reference table attached to a roadmap -- a cheat sheet, not
    trackable work.

    The source workbook carries two of these ("CLI Command Reference",
    "Kafka Mental Model") alongside its syllabus. Without somewhere to put
    them, importing that file would silently discard half of it.
    """

    __tablename__ = "roadmap_resources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(250), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    columns = Column(JSON, default=list)  # list[str] header row
    rows = Column(JSON, default=list)     # list[list[str]] body rows

    created_at = Column(DateTime, default=_utc_now_naive)

    roadmap = relationship("Roadmap", back_populates="resources")
