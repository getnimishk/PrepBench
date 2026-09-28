# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
A job the learner is preparing for, read from its job description (D8).

Roles are their own tables, not a third subject kind: a subject kind would
touch every readiness and kind switch in the app, and a role is not something
you take mocks in. It *borrows* evidence instead -- each requirement can link to
one of the learner's Skill preparations, but only a link the learner confirmed.
The parser only suggests.

A role has no readiness number, anywhere. Readiness comes from full mocks,
which a role doesn't have; the page says "Needs evaluation" and why. The
diagnostic is the learner's own rating, kept as a before/after record.
"""
from datetime import datetime, UTC

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


def _utc_now_naive():
    return datetime.now(UTC).replace(tzinfo=None)


# The four role lenses of the scenario packs (types/contentPack.ts ScenarioRole).
ROLE_LENSES = ("po", "pm", "dm", "em")
REQUIREMENT_KINDS = ("mandatory", "preferred")
CONFIDENCE_LEVELS = ("not-yet", "partly", "confident")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    interview_date = Column(Date, nullable=True)
    job_description = Column(Text, nullable=False, default="")
    # The lens the learner answers as: chosen by them, defaulted from the title.
    lens = Column(String(10), nullable=False, default="po")
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=_utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=_utc_now_naive, onupdate=_utc_now_naive)

    requirements = relationship(
        "RoleRequirement", back_populates="role", cascade="all, delete-orphan",
        passive_deletes=True, order_by="RoleRequirement.order_index",
    )
    diagnostics = relationship(
        "RoleDiagnosticAttempt", back_populates="role", cascade="all, delete-orphan",
        passive_deletes=True, order_by="RoleDiagnosticAttempt.taken_at",
    )


class RoleRequirement(Base):
    __tablename__ = "role_requirements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, nullable=False, default=0)
    text = Column(Text, nullable=False)
    kind = Column(String(10), nullable=False, default="mandatory")
    # A link the learner confirmed (D8), never one the parser guessed. SET NULL:
    # deleting the Skill leaves the requirement, now a gap again.
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    role = relationship("Role", back_populates="requirements")
    subject = relationship("Subject")


class RoleDiagnosticAttempt(Base):
    __tablename__ = "role_diagnostic_attempts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    taken_at = Column(DateTime, nullable=False, default=_utc_now_naive)
    lens = Column(String(10), nullable=False)
    # [{question_ref, answer, covered: [int], confidence, fits_requirement}]
    # question_ref: "<pack>@<version>/diagnostic/<id>" or
    # "<pack>@<version>/scenario/<id>/lens/<role>", so an attempt keeps pointing
    # at the exact text it was answered against (D4).
    items = Column(JSON, nullable=False, default=list)

    role = relationship("Role", back_populates="diagnostics")
