# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
A Skill preparation's link to a built-in content pack (D3/D4).

The pack version is *pinned*: a learner's guide chapters and scenarios keep
pointing at the exact text they were attached to, even after a newer version
ships, until the learner chooses to upgrade (PUT). Deleting the subject
deletes this link too -- it means nothing without the subject it's attached
to -- but the pack file itself, and any learning_attempts/interview_questions
already recorded against it, are untouched.
"""
from datetime import datetime, UTC

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class SubjectContentPack(Base):
    __tablename__ = "subject_content_packs"
    __table_args__ = (
        UniqueConstraint("subject_id", "pack_id", name="uq_subject_content_pack"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    pack_id = Column(String(50), nullable=False)
    pack_version = Column(Integer, nullable=False)
    attached_at = Column(
        DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None),
        nullable=False,
    )

    subject = relationship("Subject")
