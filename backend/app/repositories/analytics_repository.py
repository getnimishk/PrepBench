import re
from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.exam_session import ExamSession, ExamStatus
from app.models.exam_answer import ExamAnswer
from app.models.question import Question


class AnalyticsRepository:
    def __init__(self, db: Session):
        self.db = db

    def _completed_answers_base(self):
        """Base query: ExamAnswer rows that belong to COMPLETED sessions only."""
        return (
            self.db.query(ExamAnswer)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(ExamSession.status == ExamStatus.COMPLETED)
        )

    def get_overall_stats(self) -> Dict:
        total_exams = (
            self.db.query(func.count(ExamSession.id))
            .filter(ExamSession.status == ExamStatus.COMPLETED)
            .scalar() or 0
        )

        base = self._completed_answers_base()

        # All three metrics now draw from the same population: completed sessions only.
        total_attempted = base.filter(ExamAnswer.is_correct != None).count()
        correct_count   = base.filter(ExamAnswer.is_correct == True).count()

        # Use >= 0 (not > 0) so legitimately fast (rounded-to-zero) answers aren't
        # silently excluded and don't bias the average upward.
        # func.avg already ignores NULLs natively, so the filter only needs to
        # exclude negative sentinel values (none currently exist, but defensive).
        avg_time = (
            base.filter(ExamAnswer.time_spent_seconds >= 0)
            .with_entities(func.avg(ExamAnswer.time_spent_seconds))
            .scalar() or 0.0
        )

        accuracy = (correct_count / total_attempted * 100.0) if total_attempted > 0 else 0.0

        return {
            "total_exams": total_exams,
            "total_questions_attempted": total_attempted,
            "overall_accuracy_percentage": round(accuracy, 1),
            "average_time_per_question_seconds": round(float(avg_time), 1),
        }

    def get_topic_performance(self) -> List[Dict]:
        results = (
            self.db.query(
                Question.topic,
                Question.domain,
                func.count(ExamAnswer.id).label("total_attempted"),
                func.sum(case((ExamAnswer.is_correct == True, 1), else_=0)).label("correct_count"),
            )
            .join(ExamAnswer, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                ExamSession.status == ExamStatus.COMPLETED,
                ExamAnswer.is_correct != None,
            )
            .group_by(Question.topic, Question.domain)
            .all()
        )

        out = []
        for row in results:
            total   = row.total_attempted or 0
            correct = row.correct_count or 0
            acc     = (correct / total * 100.0) if total > 0 else 0.0
            out.append({
                "topic":              row.topic,
                "domain":             row.domain,
                "total_attempted":    total,
                "correct_count":      correct,
                "accuracy_percentage": round(acc, 1),
            })
        return out

    def get_topic_group_performance(self) -> List[Dict]:
        """
        Groups by a normalized "topic group": the leading phrase of the raw
        `topic` field, up to its first '(' or ':'. The imported question bank
        uses `topic` as a near-unique label per question (hundreds of distinct
        values across a few hundred questions, e.g. "Anti-pattern recognition
        (Sprint 0 / phase staging traps)" and "Anti-pattern recognition (Story
        Points mandatory)" as separate topics), so grouping by the raw field
        produces mostly single-attempt noise. `domain` (a handful of values)
        is the other extreme -- accurate but too broad to point at anything
        specific. The leading phrase recovers a genuine, reusable mid-level
        grouping (e.g. "Anti-pattern recognition", "Sprint Planning", "Daily
        Scrum") with real sample sizes, without requiring any data changes.
        """
        results = (
            self.db.query(Question.topic, Question.domain, ExamAnswer.is_correct)
            .join(ExamAnswer, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                ExamSession.status == ExamStatus.COMPLETED,
                ExamAnswer.is_correct != None,
            )
            .all()
        )

        groups: Dict[str, Dict] = {}
        for topic, domain, is_correct in results:
            group_name = re.split(r'[:(]', topic or "General", maxsplit=1)[0].strip() or "General"
            g = groups.setdefault(group_name, {"domain": domain, "total": 0, "correct": 0})
            g["total"] += 1
            if is_correct:
                g["correct"] += 1

        out = []
        for name, g in groups.items():
            total = g["total"]
            correct = g["correct"]
            acc = (correct / total * 100.0) if total > 0 else 0.0
            out.append({
                "topic":              name,
                "domain":             g["domain"],
                "total_attempted":    total,
                "correct_count":      correct,
                "accuracy_percentage": round(acc, 1),
            })
        return out

    def get_domain_performance(self) -> List[Dict]:
        results = (
            self.db.query(
                Question.domain,
                func.count(ExamAnswer.id).label("total_attempted"),
                func.sum(case((ExamAnswer.is_correct == True, 1), else_=0)).label("correct_count"),
            )
            .join(ExamAnswer, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                ExamSession.status == ExamStatus.COMPLETED,
                ExamAnswer.is_correct != None,
            )
            .group_by(Question.domain)
            .all()
        )

        out = []
        for row in results:
            total   = row.total_attempted or 0
            correct = row.correct_count or 0
            acc     = (correct / total * 100.0) if total > 0 else 0.0
            out.append({
                "domain":             row.domain,
                "total_attempted":    total,
                "correct_count":      correct,
                "accuracy_percentage": round(acc, 1),
            })
        return out

    # ---- session and answer reads ------------------------------------
    #
    # These moved out of AnalyticsService, which was querying ExamSession,
    # ExamAnswer and AppSettings directly. Every other service in the codebase
    # reaches persistence through a repository; analytics was reaching around
    # the one it already held.

    def get_recent_completed_sessions(self, limit: int = 5) -> List[ExamSession]:
        return (
            self.db.query(ExamSession)
            .filter(ExamSession.status == ExamStatus.COMPLETED)
            .order_by(ExamSession.end_time.desc())
            .limit(limit)
            .all()
        )

    def get_recent_completed_sessions_chronological(self, limit: int) -> List[ExamSession]:
        """
        The most recent `limit` completed sessions, oldest first.

        Ordered newest-first for the LIMIT and reversed afterwards, so the cap
        keeps the *latest* N exams rather than the first N a long-running
        database ever recorded. Returned oldest-first so a rolling average can
        be accumulated in a single pass.
        """
        sessions = (
            self.db.query(ExamSession)
            .filter(ExamSession.status == ExamStatus.COMPLETED)
            .order_by(ExamSession.end_time.desc())
            .limit(limit)
            .all()
        )
        sessions.reverse()
        return sessions

    def count_practice_answers_since(self, moment: datetime) -> int:
        """
        Answers that count as practice, from `moment` onwards.

        Two details that are easy to get wrong, both fixed on main and kept
        here:

        first_answered_at, not answered_at -- the latter carries onupdate=, so
        any later write to the row bumps it to now and yesterday's work would
        silently start counting as today's.

        is_correct IS NULL means nothing was selected (see
        ExamEngine.save_answer), which is how a question merely navigated past
        gets recorded. Those are not practice.
        """
        return (
            self.db.query(ExamAnswer)
            .filter(
                ExamAnswer.first_answered_at >= moment,
                ExamAnswer.is_correct.isnot(None),
            )
            .count()
        )

    def get_completed_exam_end_times(self) -> List[datetime]:
        """
        Raw completion timestamps of completed exams, for the streak.

        Deliberately not grouped by SQL date(): that extracts the *UTC* date,
        which is off by one for anyone not on UTC. The caller converts to local
        calendar dates in Python, where the timezone rule is explicit.
        """
        return [
            row[0]
            for row in self.db.query(ExamSession.end_time)
            .filter(ExamSession.status == ExamStatus.COMPLETED, ExamSession.end_time.isnot(None))
            .all()
        ]

    def get_weak_topic_names(self, below_percent: float = 70.0) -> List[str]:
        """
        Topics answered correctly less than `below_percent` of the time.

        Counts only answered questions in completed sessions. is_correct is NULL
        for skipped or never-answered questions -- those are auto-saved on
        navigation -- so including them would inflate the denominator and report
        topics as weak that were never actually attempted.
        """
        rows = (
            self.db.query(Question.topic)
            .join(ExamAnswer, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                ExamSession.status == ExamStatus.COMPLETED,
                ExamAnswer.is_correct.isnot(None),
            )
            .group_by(Question.topic)
            .having(
                (func.sum(case((ExamAnswer.is_correct == True, 1), else_=0)) * 100.0
                 / func.count(ExamAnswer.id)) < below_percent
            )
            .all()
        )
        return [row[0] for row in rows]
