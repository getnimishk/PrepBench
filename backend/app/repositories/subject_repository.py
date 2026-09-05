# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Dict, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import case, func

from app.models.subject import Subject
from app.models.exam_session import ExamSession, ExamStatus
from app.models.exam_answer import ExamAnswer
from app.models.question import Question
from app.services.readiness import MockResult

# The one place the word is written. A session is a mock only if it says so.
MOCK = "mock"
DRILL = "drill"

# Provenance. Only LEARNER rows may reach a learner-facing number.
LEARNER = "learner"
TEST = "test"


class SubjectRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Subject]:
        return (
            self.db.query(Subject)
            .order_by(Subject.display_order.asc(), Subject.name.asc())
            .all()
        )

    def get_by_id(self, subject_id: int) -> Optional[Subject]:
        return self.db.query(Subject).filter(Subject.id == subject_id).first()

    def get_by_slug(self, slug: str) -> Optional[Subject]:
        return self.db.query(Subject).filter(Subject.slug == slug).first()

    def get_existing_names(self) -> Set[str]:
        return {r[0] for r in self.db.query(Subject.name).all() if r[0]}

    def count(self) -> int:
        return self.db.query(func.count(Subject.id)).scalar() or 0

    def create(self, **kwargs) -> Subject:
        subject = Subject(**kwargs)
        self.db.add(subject)
        self.db.commit()
        self.db.refresh(subject)
        return subject

    # ---- the readiness query ----------------------------------------

    def get_mock_results(self, subject: Subject) -> List[MockResult]:
        """Completed full mocks for a subject, oldest first.

        The drill exclusion lives here rather than in the service, so that no
        future caller can widen it by forgetting a filter. A drill is not a
        weaker measurement of readiness -- it is not a measurement of it.

        Sessions are matched by subject_id where set, falling back to the
        certification string, so mocks recorded before subjects existed still
        resolve to the right subject.

        The provenance filter sits beside the drill filter for the same
        reason: a regression test that happened to be a mock would otherwise
        be indistinguishable from a paper someone sat.
        """
        query = self.db.query(ExamSession).filter(
            ExamSession.session_kind == MOCK,
            ExamSession.source == LEARNER,
            ExamSession.status == ExamStatus.COMPLETED,
            ExamSession.score_percentage.isnot(None),
        )
        if subject.certification:
            query = query.filter(
                (ExamSession.subject_id == subject.id)
                | (ExamSession.certification == subject.certification)
            )
        else:
            query = query.filter(ExamSession.subject_id == subject.id)

        sessions = query.order_by(ExamSession.start_time.asc()).all()
        if not sessions:
            return []

        domain_counts = self._domain_counts_by_session([s.id for s in sessions])
        return [
            MockResult(
                session_id=s.id,
                score_pct=float(s.score_percentage),
                taken_at=s.end_time or s.start_time,
                domain_counts=domain_counts.get(s.id, {}),
            )
            for s in sessions
        ]

    def _domain_counts_by_session(self, session_ids: List[int]) -> Dict[int, Dict[str, tuple]]:
        """(correct, answered) per domain per session, in one query.

        Grouped in SQL rather than walked in Python because the alternative is
        a query per session and then a query per answer for its question.
        """
        if not session_ids:
            return {}

        rows = (
            self.db.query(
                ExamAnswer.session_id,
                Question.domain,
                func.count(ExamAnswer.id),
                # Counted with CASE rather than SUM(is_correct), because
                # is_correct is a Boolean column and SQLAlchemy coerces the
                # sum back through the Boolean result processor -- every
                # domain came back with exactly one correct answer, which
                # silently made the largest domain the "weakest" one.
                func.sum(case((ExamAnswer.is_correct.is_(True), 1), else_=0)),
            )
            .join(Question, Question.id == ExamAnswer.question_id)
            .filter(ExamAnswer.session_id.in_(session_ids))
            .group_by(ExamAnswer.session_id, Question.domain)
            .all()
        )

        out: Dict[int, Dict[str, tuple]] = {}
        for session_id, domain, answered, correct in rows:
            if not domain:
                continue
            out.setdefault(session_id, {})[domain] = (int(correct or 0), int(answered or 0))
        return out
