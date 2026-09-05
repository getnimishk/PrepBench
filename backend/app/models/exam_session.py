# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import enum
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, JSON, ForeignKey
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

    # Mock or drill, and the most consequential column in the schema.
    #
    # A mock is the full paper under exam conditions: fixed length, timed,
    # drawn in exam proportions, no configuration. A drill is targeted
    # practice: any length, untimed, instant feedback.
    #
    # Only mocks may move a readiness signal. Averaging the two is what made
    # "Overall Accuracy 72%" unable to answer whether you would pass, because
    # it mixed ten-question warm-ups with full papers.
    #
    # Defaults to "drill" so that every session recorded before this column
    # existed is treated as practice. Historical data cannot inflate readiness.
    session_kind = Column(String(10), nullable=False, default="drill", server_default="drill", index=True)

    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)

    # Where this row came from, and the only thing that can say "that was not
    # me studying".
    #
    # A product built on the principle that evidence must be honest had no way
    # to distinguish a regression test from a study session: three sessions
    # named "Repro", "Randomize Options Regression Test" and "Skipped Answer
    # Regression Test" sat in the working database and were averaged into
    # every headline number alongside six real 80-question papers.
    #
    # Two values, because there are only two producers. The app creates
    # LEARNER rows and nothing else; TEST is set by the quarantine migration
    # for rows that are provably not learner activity. A third "system" value
    # was considered and dropped -- nothing in PrepBench generates a session
    # on its own, so it would have been an empty category.
    #
    # Defaults to LEARNER: a row whose provenance is unknown is the learner's
    # until something proves otherwise. Quarantining by guesswork would be
    # fabricating provenance, which is the same sin as fabricating a score.
    source = Column(String(10), nullable=False, default="learner", server_default="learner", index=True)

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
    # Loaded on demand, not on every query. ExamRepository.get_session_by_id
    # eager-loads them explicitly because it is the read that needs them;
    # listing sessions for a timeline or a trend does not.
    answers = relationship("ExamAnswer", back_populates="session", cascade="all, delete-orphan")
