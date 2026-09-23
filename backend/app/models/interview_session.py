# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime, UTC

from sqlalchemy import JSON, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class InterviewSession(Base):
    """One sitting of interview practice: a round, and the questions asked in it.

    The questions are fixed when the session is created -- least-practised first
    -- and kept in order, so a reload mid-session asks the same questions. Each
    answer is a PracticeRecording pointing back here; a retake is another one.
    """
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # The InterviewRoundType value. A string rather than the Enum column so a
    # session outlives a round being renamed in code.
    round_type = Column(String(30), nullable=False)
    category = Column(String(150), nullable=True)
    question_ids = Column(JSON, nullable=False, default=list)
    thinking_seconds = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    ended_at = Column(DateTime, nullable=True)

    recordings = relationship("PracticeRecording", back_populates="session")
