from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.question import QuestionDifficulty


class SystemDesignPrompt(Base):
    __tablename__ = "system_design_prompts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(300), nullable=False)
    prompt_text = Column(Text, nullable=False)
    category = Column(String(150), index=True, nullable=False, default="General")
    difficulty = Column(Enum(QuestionDifficulty), nullable=False, default=QuestionDifficulty.MEDIUM)

    is_ai_generated = Column(Boolean, default=False, nullable=False, server_default="0")
    source_topic = Column(String(200), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    attempts = relationship(
        "SystemDesignAttempt", back_populates="prompt", cascade="all, delete-orphan"
    )
