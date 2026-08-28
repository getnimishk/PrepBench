# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import enum
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, Boolean, String, Text, DateTime, ForeignKey, Enum, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class ConfidenceLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    NOT_SET = "not_set"

class ExamAnswer(Base):
    __tablename__ = "exam_answers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)

    # Enforce at the DB level: one answer per question per session.
    # This makes the check-then-act in save_answer fail loudly on a race
    # rather than silently creating a duplicate row.
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_exam_answer_session_question"),
    )

    selected_option_ids = Column(JSON, default=list) # List of option IDs selected by user
    is_correct = Column(Boolean, nullable=True)
    time_spent_seconds = Column(Integer, default=0)
    
    confidence_level = Column(Enum(ConfidenceLevel), default=ConfidenceLevel.NOT_SET)
    is_flagged = Column(Boolean, default=False)
    is_bookmarked = Column(Boolean, default=False)
    user_notes = Column(Text, nullable=True)
    
    answered_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None), onupdate=lambda: datetime.now(UTC).replace(tzinfo=None))

    # Set once and never bumped. answered_at carries onupdate=, and the client
    # re-saves an answer on every navigation, flag, and bookmark toggle -- so
    # merely paging back through a week-old in-progress exam re-stamps those
    # rows to now. Counting "questions practiced today" off answered_at
    # therefore counts rows *touched* today, not answered today.
    first_answered_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None), index=True)

    # Relationships
    session = relationship("ExamSession", back_populates="answers")
    question = relationship("Question", back_populates="answers")
