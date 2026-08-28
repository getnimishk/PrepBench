# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class SystemDesignAttempt(Base):
    __tablename__ = "system_design_attempts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    prompt_id = Column(Integer, ForeignKey("system_design_prompts.id", ondelete="CASCADE"), nullable=False, index=True)

    answer_text = Column(Text, nullable=False)
    target_role = Column(String(200), nullable=True)

    overall_score = Column(Float, nullable=True)  # 0-100, null while ungraded
    category_scores = Column(JSON, default=list)  # list of {category, score, max_score, feedback}
    strengths = Column(JSON, default=list)         # list[str]
    improvements = Column(JSON, default=list)       # list[str]
    summary = Column(Text, nullable=True)

    # "graded" | "unavailable" (no API key configured) | "error" (LLM call/parse failed)
    grading_status = Column(String(20), nullable=False, default="unavailable")
    grading_error = Column(Text, nullable=True)

    time_spent_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    prompt = relationship("SystemDesignPrompt", back_populates="attempts")
