# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import enum
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class ExamMode(str, enum.Enum):
    PRACTICE = "practice"
    TIMED = "timed"
    CUSTOM = "custom"
    WEAK_TOPIC = "weak_topic"
    SPACED_REPETITION = "spaced_repetition"

class ExamStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"

class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, default="Exam Session")
    exam_mode = Column(Enum(ExamMode), nullable=False, default=ExamMode.PRACTICE)
    status = Column(Enum(ExamStatus), nullable=False, default=ExamStatus.IN_PROGRESS)
    
    certification = Column(String(150), nullable=True)
    total_questions = Column(Integer, nullable=False, default=0)
    answered_questions = Column(Integer, nullable=False, default=0)
    correct_count = Column(Integer, nullable=False, default=0)
    
    score_percentage = Column(Float, nullable=True)
    passing_percentage = Column(Float, nullable=False, default=70.0)
    is_passed = Column(String(10), nullable=True) # "passed" or "failed"
    
    time_allowed_seconds = Column(Integer, nullable=True) # None for unlimited practice mode
    time_spent_seconds = Column(Integer, nullable=False, default=0)
    
    current_question_index = Column(Integer, nullable=False, default=0)
    question_ids_order = Column(JSON, nullable=False, default=list) # Ordered list of question IDs
    
    start_time = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    end_time = Column(DateTime, nullable=True)

    # Relationships
    answers = relationship("ExamAnswer", back_populates="session", cascade="all, delete-orphan", lazy="joined")
