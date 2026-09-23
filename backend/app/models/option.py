# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # Indexed: Question.options is loaded with a join on every question fetch,
    # and SQLite does not index foreign keys by itself -- unindexed, drawing an
    # 80-question mock from a 5,000-question bank scanned every option once per
    # question and took over five seconds.
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    explanation_why_incorrect = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)

    # Relationships
    question = relationship("Question", back_populates="options")
