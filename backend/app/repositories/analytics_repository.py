# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import re
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.exam_session import ExamSession, ExamStatus
from app.models.exam_answer import ExamAnswer
from app.models.question import Question
from app.repositories.subject_repository import LEARNER, MOCK, session_belongs_to


# Every learner-facing figure in this file is computed over the same
# population: completed sessions the learner actually sat. Written once and
# spread with * so that a new query cannot quietly widen it by forgetting a
# filter -- which is precisely how three regression-test sessions ended up
# inside the headline accuracy, indistinguishable from six real papers.
def _learner_evidence():
    return (
        ExamSession.status == ExamStatus.COMPLETED,
        ExamSession.source == LEARNER,
    )


# How many answers a topic needs before "below 70%" means anything. See
# get_weak_topic_names for why this is three and why it is not ten.
MIN_ANSWERS_PER_TOPIC = 3


def topic_group(topic: Optional[str]) -> str:
    """The leading phrase of a raw topic, up to its first '(' or ':'.

    See get_topic_group_performance for why: raw topics are near-unique per
    question in real banks, so grouping by them is mostly single-answer noise.
    """
    return re.split(r'[:(]', topic or "General", maxsplit=1)[0].strip() or "General"


class AnalyticsRepository:
    def __init__(self, db: Session):
        self.db = db

    def _completed_answers_base(self):
        """Base query: ExamAnswer rows from completed sessions the learner sat."""
        return (
            self.db.query(ExamAnswer)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(*_learner_evidence())
        )

    def get_overall_stats(self) -> Dict:
        total_exams = (
            self.db.query(func.count(ExamSession.id))
            .filter(*_learner_evidence())
            .scalar() or 0
        )

        base = self._completed_answers_base()

        # All three metrics draw from the same population as total_exams above.
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
                *_learner_evidence(),
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
                *_learner_evidence(),
                ExamAnswer.is_correct != None,
            )
            .all()
        )

        groups: Dict[str, Dict] = {}
        for topic, domain, is_correct in results:
            group_name = topic_group(topic)
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

    def get_domain_performance(self, subject_id: Optional[int] = None) -> List[Dict]:
        query = (
            self.db.query(
                Question.domain,
                func.count(ExamAnswer.id).label("total_attempted"),
                func.sum(case((ExamAnswer.is_correct == True, 1), else_=0)).label("correct_count"),
            )
            .join(ExamAnswer, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                *_learner_evidence(),
                ExamAnswer.is_correct != None,
            )
        )
        # PER PREPARATION when one is named, by the question's own subject_id --
        # the same column the weak-topic query and the drill use. Pooled, a
        # second preparation's domains appeared in the first one's Insights.
        if subject_id is not None:
            query = query.filter(Question.subject_id == subject_id)
        results = query.group_by(Question.domain).all()

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
            .filter(*_learner_evidence())
            .order_by(ExamSession.end_time.desc())
            .limit(limit)
            .all()
        )

    def get_recent_completed_sessions_chronological(
        self, limit: int, subject=None
    ) -> List[ExamSession]:
        """
        The most recent `limit` completed sessions, oldest first.

        Ordered newest-first for the LIMIT and reversed afterwards, so the cap
        keeps the *latest* N exams rather than the first N a long-running
        database ever recorded. Returned oldest-first so a rolling average can
        be accumulated in a single pass.
        """
        query = self.db.query(ExamSession).filter(*_learner_evidence())
        # A session belongs to a preparation the way readiness decides it does.
        if subject is not None:
            query = query.filter(session_belongs_to(subject))
        sessions = query.order_by(ExamSession.end_time.desc()).limit(limit).all()
        sessions.reverse()
        return sessions

    # ---- one area in detail ----------------------------------------------

    def get_domain_questions(self, subject_id: int, domain: str) -> List:
        """(id, text, topic) for every question this preparation has in the area."""
        return (
            self.db.query(Question.id, Question.text, Question.topic)
            .filter(Question.subject_id == subject_id, Question.domain == domain)
            .order_by(Question.id.asc())
            .all()
        )

    def count_domain_unreviewed_misses(self, subject_id: int, domain: str) -> int:
        """Wrong answers from mocks in the area whose explanation has not been read.

        The review queue's own definition (HomeService.unreviewed_count): mocks
        only, because a drill gives its feedback as you go.
        """
        return (
            self.db.query(func.count(ExamAnswer.id))
            .join(Question, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                *_learner_evidence(),
                ExamSession.session_kind == MOCK,
                ExamAnswer.is_correct.is_(False),
                ExamAnswer.reviewed_at.is_(None),
                Question.subject_id == subject_id,
                Question.domain == domain,
            )
            .scalar()
        ) or 0

    def get_domain_answers(self, subject_id: int, domain: str) -> List:
        """(question_id, topic, is_correct) for every answer given in the area.

        The same population as get_domain_performance -- completed sessions the
        learner sat, drills included, answered questions only -- so the detail
        agrees with the row it was opened from.
        """
        return (
            self.db.query(ExamAnswer.question_id, Question.topic, ExamAnswer.is_correct)
            .join(Question, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                *_learner_evidence(),
                ExamAnswer.is_correct.isnot(None),
                Question.subject_id == subject_id,
                Question.domain == domain,
            )
            .all()
        )

    def get_weak_topic_names(
        self,
        below_percent: float = 70.0,
        min_answers: int = MIN_ANSWERS_PER_TOPIC,
        subject_id: Optional[int] = None,
    ) -> List[str]:
        """The weak topics, by name.

        Delegates to get_weak_topics so that the definition of "weak" exists in
        exactly one query. Home renders the same topics with the counts behind
        them; a second query shaped for that surface is how two definitions get
        into a product, and this file has already paid for that once.
        """
        return [
            row["topic"] for row in self.get_weak_topics(below_percent, min_answers, subject_id)
        ]

    def get_weak_topics(
        self,
        below_percent: float = 70.0,
        min_answers: int = MIN_ANSWERS_PER_TOPIC,
        subject_id: Optional[int] = None,
    ) -> List[Dict]:
        """
        Topics the learner is measurably weak at, on the evidence the product trusts.

        Returned with the evidence behind each one -- answered, correct, and the
        percentage -- because a surface that says "Daily Scrum" and nothing else
        is asking to be taken on faith, and this one can show its working.

        Counts only answered questions. is_correct is NULL for skipped or
        never-answered questions -- those are auto-saved on navigation -- so
        including them would inflate the denominator and report topics as weak
        that were never actually attempted.

        Two rules were added after measuring this query against the working
        database, where it qualified **77 of 267 topics** and 61 of those had a
        sample of two answers or fewer.

        MOCKS ONLY. This used to count every completed learner session, drills
        included -- and a drill deliberately draws from what you are getting
        wrong. So practising a weak topic pushed its pooled accuracy *down* and
        kept it on the list: the feedback loop ran backwards, and the only way
        off the list was to stop practising. Nineteen of the 77 were weak
        solely because of drill answers. Measuring over mocks is the same rule
        readiness uses and the one Insights already explains to the learner in
        as many words -- "a drill deliberately draws from what you are getting
        wrong. Neither figure is the other's correction." Now a drill cannot
        confirm a weakness or clear one; only a paper can.

        A MINIMUM SAMPLE. Under three answers, "less than 70%" is decided by a
        single question: 0/1 and 0/2 both qualify, and both are noise. Three is
        the smallest floor at which the threshold means anything (0/3, 1/3 and
        2/3 qualify; 3/3 does not) and it is deliberately far below
        readiness.MIN_QUESTIONS_PER_DOMAIN -- a topic is a much finer unit than
        a domain, and a floor of ten would leave exactly one topic in this
        bank. The two numbers are different because the questions they answer
        are different: one guards a verdict the learner is told, the other
        guards which questions get drawn.

        On this database the two rules together take the list from 77 topics to
        8 -- Daily Scrum at 6/11, Sprint Planning at 4/6, and six others -- over
        38 bank questions, which is a real practice set instead of a haystack.
        """
        query = (
            self.db.query(
                Question.topic,
                func.count(ExamAnswer.id).label("answered"),
                func.sum(case((ExamAnswer.is_correct == True, 1), else_=0)).label("correct"),
            )
            .join(ExamAnswer, Question.id == ExamAnswer.question_id)
            .join(ExamSession, ExamAnswer.session_id == ExamSession.id)
            .filter(
                *_learner_evidence(),
                ExamSession.session_kind == MOCK,
                ExamAnswer.is_correct.isnot(None),
            )
        )
        # PER PREPARATION when one is named, by the question's own subject_id --
        # the column the weak-topic drill draws from. Topic names are free text
        # and repeat across banks ("Security" is in AWS and Databricks alike), so
        # a pooled list let one preparation's weakness decide another's drill,
        # and Home listed a Databricks topic under PSM I.
        if subject_id is not None:
            query = query.filter(Question.subject_id == subject_id)
        rows = (
            query
            .group_by(Question.topic)
            .having(func.count(ExamAnswer.id) >= min_answers)
            .having(
                (func.sum(case((ExamAnswer.is_correct == True, 1), else_=0)) * 100.0
                 / func.count(ExamAnswer.id)) < below_percent
            )
            .all()
        )

        out = []
        for topic, answered, correct in rows:
            answered = answered or 0
            correct = correct or 0
            out.append({
                "topic": topic,
                "answered": answered,
                "correct": correct,
                "accuracy_percentage": round(correct / answered * 100.0, 1) if answered else 0.0,
            })
        # Worst first: the list is a place to start, not an inventory.
        out.sort(key=lambda t: (t["accuracy_percentage"], -t["answered"]))
        return out
