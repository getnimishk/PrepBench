from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
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

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    analysis = relationship(
        "RecordingAnalysis", back_populates="recording", uselist=False, cascade="all, delete-orphan"
    )
    interview_question = relationship("InterviewQuestion", back_populates="recordings")
