# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import enum
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class InterviewRoundType(str, enum.Enum):
    HR_SCREENING = "hr_screening"
    HIRING_MANAGER = "hiring_manager"
    SYSTEM_DESIGN = "system_design"
    BEHAVIORAL = "behavioral"
    # How a technology works and where it breaks, answered as "what I'd do and
    # why" -- not a story. Scenario Say-it answers are saved here (skills plan
    # D14) because hiring_manager's rubric grades a real STAR story, which a
    # learner without one is told not to invent.
    TECHNICAL = "technical"


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    # One row per source per preparation: saving a scenario's Say-it answer
    # again updates the question it made rather than adding a second copy.
    # Per preparation, because source_ref names the content (pack, version,
    # scenario, role), and two Skill preparations with the same pack are two
    # learners' worth of answers, not one. NULLs don't collide, so every
    # question typed or imported by hand is unaffected.
    __table_args__ = (
        Index("uq_interview_questions_source", "source_ref", "subject_id", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    round_type = Column(Enum(InterviewRoundType), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    category = Column(String(150), nullable=True)  # e.g. "Leadership", "Motivation & Fit"

    # The learner's saved prepared answer / model outline (e.g. STAR notes)
    # and essential key talking points/metrics to hit during practice.
    prepared_answer = Column(Text, nullable=True)
    key_talking_points = Column(JSON, nullable=True)  # list of strings

    is_ai_generated = Column(Boolean, default=False, nullable=False, server_default="0")
    source_topic = Column(String(200), nullable=True)

    # The preparation a question was saved from, e.g. the Skill whose scenario
    # produced it. SET NULL, as everywhere else: deleting a preparation must not
    # delete the learner's interview questions.
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    # Where the question came from, when it came from built-in content:
    # "<pack>@<version>/scenario/<id>/lens/<role>". NULL for anything typed,
    # imported or generated.
    source_ref = Column(String(150), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    recordings = relationship("PracticeRecording", back_populates="interview_question")
