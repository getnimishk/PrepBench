from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class SpacedRepetition(Base):
    __tablename__ = "spaced_repetition"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    repetition = Column(Integer, default=0, nullable=False)
    interval_days = Column(Integer, default=1, nullable=False)
    ease_factor = Column(Float, default=2.5, nullable=False) # SM-2 standard default ease factor
    
    last_reviewed_at = Column(DateTime, nullable=True)
    next_review_date = Column(DateTime, default=utc_now_naive, nullable=False, index=True)

    # Relationship
    question = relationship("Question", back_populates="sr_item")
