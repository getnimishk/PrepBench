# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Whether reading a miss actually taught you anything.

Until this table existed, the whole effect of reviewing a wrong answer was a
timestamp. `reviewed_at` recorded that the explanation had been on screen, and
nothing anywhere asked whether the explanation had landed -- the schedule was
driven only by answering, so an evening spent reading twenty explanations left
the product's model of the learner unchanged apart from twenty timestamps.

A check is one different question on the same concept, asked straight after
the explanation. Getting it right is transfer; getting it wrong is the honest
signal that reading was not enough. It is kept out of `exam_answers`
deliberately: a check is not exam evidence and must never reach domain
accuracy, the weak-topic list or readiness, all of which read that table.
"""
from datetime import datetime, UTC

from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.exam_answer import ConfidenceLevel


class ReviewCheck(Base):
    __tablename__ = "review_checks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # The miss this check was verifying.
    answer_id = Column(
        Integer, ForeignKey("exam_answers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # The different question that was asked.
    question_id = Column(
        Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False,
    )

    selected_option_ids = Column(JSON, default=list)
    passed = Column(Boolean, nullable=False)
    confidence_level = Column(Enum(ConfidenceLevel), default=ConfidenceLevel.NOT_SET)

    created_at = Column(
        DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None),
        nullable=False, index=True,
    )

    answer = relationship("ExamAnswer")
    question = relationship("Question")
