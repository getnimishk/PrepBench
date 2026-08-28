# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class RecordingAnalysis(Base):
    __tablename__ = "recording_analyses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    recording_id = Column(Integer, ForeignKey("practice_recordings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    provider = Column(String(50), nullable=True)  # e.g. "gemini" -- the provider that produced this analysis
    transcript = Column(Text, nullable=True)

    # Delivery ("how you said it") -- always computed, question or no question.
    communication_scores = Column(JSON, default=list)  # list of {category, score, max_score, feedback}
    filler_word_count = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)

    # Content ("what you said") -- only populated when the recording is linked
    # to an interview_question (recording.interview_question_id is set). Stays
    # empty/null for freeform "General Practice" recordings.
    content_scores = Column(JSON, default=list)  # list of {category, score, max_score, feedback}
    content_summary = Column(Text, nullable=True)

    # "analyzed" | "unavailable" (no provider configured) | "error" (call/parse failed)
    analysis_status = Column(String(20), nullable=False, default="unavailable")
    analysis_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    recording = relationship("PracticeRecording", back_populates="analysis")
