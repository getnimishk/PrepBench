import enum
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class QuestionType(str, enum.Enum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SCENARIO = "scenario"
    CASE_STUDY = "case_study"
    IMAGE = "image"
    CODE = "code"
    DRAG_AND_DROP = "drag_and_drop"

class QuestionDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), default=QuestionType.SINGLE_CHOICE, nullable=False)
    difficulty = Column(Enum(QuestionDifficulty), default=QuestionDifficulty.MEDIUM, nullable=False)
    
    domain = Column(String(150), index=True, nullable=False, default="General")
    topic = Column(String(150), index=True, nullable=False, default="General")
    subtopic = Column(String(150), index=True, nullable=True)
    certification = Column(String(150), index=True, nullable=False, default="General Prep")
    source = Column(String(200), nullable=True)
    
    tags = Column(JSON, default=list)  # List of string tags
    
    code_snippet = Column(Text, nullable=True)
    case_study_text = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    
    explanation = Column(Text, nullable=True)
    reference_url = Column(String(500), nullable=True)

    is_reviewed = Column(Boolean, default=False, nullable=False, server_default="0")

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None), onupdate=lambda: datetime.now(UTC).replace(tzinfo=None))

    # Relationships
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan", lazy="joined")
    answers = relationship("ExamAnswer", back_populates="question", cascade="all, delete-orphan")
    sr_item = relationship("SpacedRepetition", back_populates="question", uselist=False, cascade="all, delete-orphan")
    notes = relationship("UserNote", back_populates="question", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="question", cascade="all, delete-orphan")
