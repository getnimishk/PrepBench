# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
A subject is the thing a person is preparing for.

Subjects, not formats, are what the navigation grows with: exams,
interviews, system design and design reviews are a fixed set, while
Scrum, Databricks and AI keep arriving. Giving each subject a row means
adding one costs a row rather than a screen.

Two kinds, and the difference is a pass mark:

  certification   has a real exam with a real pass mark, so readiness is
                  computable and the product can say "book it"
  skill           has no exam, so it can never be "ready" -- only
                  practised
"""
import enum
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Boolean, Enum
from app.core.database import Base


class SubjectKind(str, enum.Enum):
    CERTIFICATION = "certification"
    SKILL = "skill"


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)
    slug = Column(String(80), nullable=False, unique=True, index=True)
    kind = Column(Enum(SubjectKind), nullable=False, default=SubjectKind.SKILL)

    # Matches Question.certification for a certification subject, so existing
    # questions can be resolved to a subject without a data migration.
    certification = Column(String(150), nullable=True, index=True)

    # The exam profile. Null for a skill subject, and null is what makes
    # readiness uncomputable rather than zero -- a subject with no pass mark
    # must never be reported as ready.
    pass_mark = Column(Float, nullable=True)
    exam_question_count = Column(Integer, nullable=True)
    exam_minutes = Column(Integer, nullable=True)

    # The one-line description shown under the name on Home and in the picker.
    description = Column(String(300), nullable=True)

    # When the exam is booked for, if it is.
    #
    # Nullable, and null is a real answer rather than a missing one: a skill has
    # no exam, and a certification may not be booked yet. A guessed date would
    # drive a countdown the learner never set.
    target_exam_date = Column(Date, nullable=True)

    # Hidden from the picker, everything kept. A distinct action from delete,
    # which destroys -- the two are separate rows in the prototype's danger zone
    # and have to behave differently. Shape matches roadmaps.is_archived.
    is_archived = Column(Boolean, nullable=False, default=False, server_default="0")

    display_order = Column(Integer, nullable=False, default=100)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    @property
    def has_exam_profile(self) -> bool:
        """Whether a full mock can be assembled and scored for this subject."""
        return (
            self.pass_mark is not None
            and self.exam_question_count is not None
            and self.exam_minutes is not None
        )
