# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime
from typing import List, Optional

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

    def _due_query(
        self, now: datetime, subject_id: Optional[int] = None, domain: Optional[str] = None
    ):
        query = self.db.query(SpacedRepetition.question_id).filter(
            SpacedRepetition.next_review_date <= now
        )
        if subject_id is not None or domain is not None:
            # By the question's own preparation -- the column an exam for that
            # preparation draws from, so the count and the drill cannot disagree.
            from app.models.question import Question

            query = query.join(Question, Question.id == SpacedRepetition.question_id)
            if subject_id is not None:
                query = query.filter(Question.subject_id == subject_id)
            if domain is not None:
                query = query.filter(Question.domain == domain)
        return query

    def due_items(
        self,
        now: datetime,
        subject_id: Optional[int] = None,
        limit: Optional[int] = None,
        domain: Optional[str] = None,
    ) -> List[SpacedRepetition]:
        """Due schedule entries with their questions, most overdue first."""
        from app.models.question import Question

        query = (
            self.db.query(SpacedRepetition)
            .join(Question, Question.id == SpacedRepetition.question_id)
            .filter(SpacedRepetition.next_review_date <= now)
        )
        if subject_id is not None:
            query = query.filter(Question.subject_id == subject_id)
        if domain is not None:
            query = query.filter(Question.domain == domain)
        query = query.order_by(SpacedRepetition.next_review_date.asc(), SpacedRepetition.id.asc())
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def due_question_ids(
        self, now: datetime, subject_id: Optional[int] = None, domain: Optional[str] = None
    ) -> List[int]:
        return [row[0] for row in self._due_query(now, subject_id, domain).all()]

    def count_due(
        self, now: datetime, subject_id: Optional[int] = None, domain: Optional[str] = None
    ) -> int:
        return self._due_query(now, subject_id, domain).count()

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, item: SpacedRepetition) -> None:
        self.db.refresh(item)
