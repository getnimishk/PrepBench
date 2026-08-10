from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.exam_session import ExamSession, ExamStatus
from app.models.exam_answer import ExamAnswer


class ExamRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_session_by_id(self, session_id: int) -> Optional[ExamSession]:
        return self.db.query(ExamSession).filter(ExamSession.id == session_id).first()

    def get_all_sessions(self, skip: int = 0, limit: int = 500) -> List[ExamSession]:
        """
        Return sessions ordered newest-first.
        Default limit raised to 500 — enough for years of daily practice without
        silently truncating.  The companion count_sessions() returns the true
        total so the UI can show pagination or a warning if needed.
        """
        return (
            self.db.query(ExamSession)
            .order_by(ExamSession.start_time.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_sessions(self) -> int:
        return self.db.query(func.count(ExamSession.id)).scalar() or 0

    def create_session(self, session: ExamSession) -> ExamSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def update_session(self, session: ExamSession) -> ExamSession:
        """
        Persist mutations on `session` regardless of whether the object is
        already attached to this Session's identity map.

        Using merge() is safe for both cases:
        - If the caller mutated an object they fetched from this same repository
          (the common path), merge() is a no-op attachment and commit() persists
          the changes.
        - If the caller passes in a detached or transient object, merge() re-
          attaches it (or copies its state onto the existing tracked instance)
          before commit(), so the write is never silently dropped.
        """
        merged = self.db.merge(session)
        self.db.commit()
        self.db.refresh(merged)
        return merged

    def get_answer(self, session_id: int, question_id: int) -> Optional[ExamAnswer]:
        return (
            self.db.query(ExamAnswer)
            .filter(
                ExamAnswer.session_id == session_id,
                ExamAnswer.question_id == question_id,
            )
            .first()
        )

    def save_answer(self, answer: ExamAnswer) -> ExamAnswer:
        """
        Upsert an exam answer for a (session_id, question_id) pair.

        The explicit check-then-act pattern is retained for clarity, but the
        UniqueConstraint on (session_id, question_id) defined in the model now
        provides a hard DB-level backstop: if two concurrent requests both see
        existing=None and both attempt an INSERT, one will get an IntegrityError
        rather than silently creating a duplicate row.
        """
        existing = self.get_answer(answer.session_id, answer.question_id)
        if existing:
            existing.selected_option_ids = answer.selected_option_ids
            existing.is_correct          = answer.is_correct
            existing.time_spent_seconds  = answer.time_spent_seconds
            existing.confidence_level    = answer.confidence_level
            existing.is_flagged          = answer.is_flagged
            existing.is_bookmarked       = answer.is_bookmarked
            existing.user_notes          = answer.user_notes
            self.db.commit()
            self.db.refresh(existing)
            return existing
        else:
            self.db.add(answer)
            self.db.commit()
            self.db.refresh(answer)
            return answer
