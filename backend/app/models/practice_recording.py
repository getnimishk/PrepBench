# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class PracticeRecording(Base):
    __tablename__ = "practice_recordings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(300), nullable=False, default="Untitled Recording")
    file_path = Column(String(500), nullable=False)  # relative to backend/data/recordings/
    mime_type = Column(String(100), nullable=False, default="audio/webm")
    duration_seconds = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=False, default=0)

    # NULL means a freeform/"General Practice" recording, not tied to any
    # specific interview question -- must stay nullable so recording/playback
    # keeps working with zero dependency on the interview-question feature.
    interview_question_id = Column(Integer, ForeignKey("interview_questions.id", ondelete="SET NULL"), nullable=True, index=True)

    # The interview session this answer was given in. NULL for a take recorded
    # on its own, which keeps single-question practice working unchanged.
    session_id = Column(Integer, ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True, index=True)

    # What the learner planned to say, written before answering. Kept with the
    # take so what they meant and what they said can be read side by side.
    plan_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    analysis = relationship(
        "RecordingAnalysis", back_populates="recording", uselist=False, cascade="all, delete-orphan"
    )
    interview_question = relationship("InterviewQuestion", back_populates="recordings")
    session = relationship("InterviewSession", back_populates="recordings")
