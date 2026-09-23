# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Queries for learning attempts. No rules -- those live in LearningService."""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.learning_attempt import LearningAttempt


class LearningAttemptRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_uid(self, attempt_uid: str) -> Optional[LearningAttempt]:
        return (
            self.db.query(LearningAttempt)
            .filter(LearningAttempt.attempt_uid == attempt_uid)
            .first()
        )

    def list_attempts(
        self,
        subject_id: Optional[int] = None,
        concept_id: Optional[str] = None,
        limit: int = 500,
    ) -> List[LearningAttempt]:
        """Newest first.

        Mastery is derived from these on read, so the caller wants the whole
        history for a concept rather than a page of it -- hence a high default
        limit and no offset. The limit exists so a pathological history cannot
        take the page down, not to paginate.
        """
        query = self.db.query(LearningAttempt)
        if subject_id is not None:
            query = query.filter(LearningAttempt.subject_id == subject_id)
        if concept_id:
            query = query.filter(LearningAttempt.concept_id == concept_id)
        return (
            query.order_by(LearningAttempt.started_at.desc(), LearningAttempt.id.desc())
            .limit(limit)
            .all()
        )

    def add(self, attempt: LearningAttempt) -> LearningAttempt:
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def save(self, attempt: LearningAttempt) -> LearningAttempt:
        self.db.commit()
        self.db.refresh(attempt)
        return attempt
