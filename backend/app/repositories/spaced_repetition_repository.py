from datetime import datetime
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.spaced_repetition import SpacedRepetition


class SpacedRepetitionRepository:
    """
    Persistence for the SM-2 review schedule.

    Three different callers were each writing their own version of "which items
    are due" -- SM2Service, AnalyticsService and ExamEngine -- against the same
    table with the same comparison. One place now owns that.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_by_question(self, question_id: int) -> Optional[SpacedRepetition]:
        return (
            self.db.query(SpacedRepetition)
            .filter(SpacedRepetition.question_id == question_id)
            .first()
        )

    def create_for_question(self, question_id: int, now: datetime) -> SpacedRepetition:
        """
        A new schedule entry, with every field set explicitly.

        SQLAlchemy column defaults only apply after a flush, so leaving these
        unset would mean arithmetic on None the first time an item is reviewed.
        """
        item = SpacedRepetition(
            question_id=question_id,
            repetition=0,
            interval_days=1,
            ease_factor=2.5,
            next_review_date=now,
        )
        self.db.add(item)
        self.db.flush()
        return item

    def count_due(self, now: datetime) -> int:
        return (
            self.db.query(func.count(SpacedRepetition.id))
            .filter(SpacedRepetition.next_review_date <= now)
            .scalar() or 0
        )

    def due_question_ids(self, now: datetime) -> List[int]:
        return [
            row[0]
            for row in self.db.query(SpacedRepetition.question_id)
            .filter(SpacedRepetition.next_review_date <= now)
            .all()
        ]

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, item: SpacedRepetition) -> None:
        self.db.refresh(item)
