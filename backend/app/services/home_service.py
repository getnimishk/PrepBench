# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
What Home and the subject pages render.

Home shows two things: what you were doing, and where each subject
stands. Deliberately not a third -- a ranked list of what to do next was
put to the user and rejected as nagging, so this service returns state
and never an ordered recommendation.

Coverage is the other half. A subject page lists every practice format
including the ones with no content, because an empty row is the only way
the application can tell you that Databricks has ten design reviews and
zero exam questions.
"""
from dataclasses import dataclass
from datetime import datetime, UTC
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.design_review import DesignReview, DesignReviewAttempt
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.interview_question import InterviewQuestion
from app.models.practice_recording import PracticeRecording
from app.models.question import Question
from app.models.roadmap import Roadmap
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject import Subject
from app.models.system_design_attempt import SystemDesignAttempt
from app.models.system_design_prompt import SystemDesignPrompt
from app.repositories.subject_repository import SubjectRepository, MOCK


def _now() -> datetime:
    """Naive UTC, matching how every timestamp in this app is stored."""
    return datetime.now(UTC).replace(tzinfo=None)


@dataclass
class FormatCoverage:
    """One practice format for one subject, present or absent.

    `available` false with a `count` of zero is the whole point of this
    object: it is rendered as a row saying there is nothing here yet, rather
    than being hidden.
    """
    key: str
    label: str
    count: int
    completed: int
    available: bool
    detail: str


class HomeService:
    def __init__(self, db: Session):
        self.db = db
        self.subjects = SubjectRepository(db)

    # ---- resume -----------------------------------------------------

    def get_resumable(self) -> Optional[dict]:
        """The unfinished session, if there is one.

        Surfaced above everything on Home. An abandoned mock was previously
        invisible the next day, which made stopping mid-session a decision
        the learner had to make again from scratch.
        """
        session = (
            self.db.query(ExamSession)
            .filter(ExamSession.status.in_([ExamStatus.IN_PROGRESS, ExamStatus.PAUSED]))
            .order_by(ExamSession.start_time.desc())
            .first()
        )
        if not session:
            return None

        remaining = None
        if session.time_allowed_seconds:
            remaining = max(0, session.time_allowed_seconds - (session.time_spent_seconds or 0))

        return {
            "session_id": session.id,
            "title": session.title,
            "session_kind": session.session_kind,
            "answered": session.answered_questions,
            "total": session.total_questions,
            "seconds_remaining": remaining,
            "started_at": session.start_time,
        }

    # ---- the counts that appear beside a subject --------------------

    def unreviewed_count(self, subject: Optional[Subject] = None) -> int:
        """Wrong answers from completed mocks that have not been looked at.

        Mocks only. A drill gives instant feedback as you go, so there is no
        separate review step to be behind on.
        """
        query = (
            self.db.query(func.count(ExamAnswer.id))
            .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
            .filter(
                ExamSession.session_kind == MOCK,
                ExamSession.status == ExamStatus.COMPLETED,
                ExamAnswer.is_correct.is_(False),
                ExamAnswer.reviewed_at.is_(None),
            )
        )
        if subject is not None:
            query = query.filter(self._session_belongs_to(subject))
        return query.scalar() or 0

    def due_for_review_count(self) -> int:
        """Questions the spaced-repetition engine has scheduled for today.

        The engine has existed in the codebase with no route, no navigation
        entry and no registration. This is the first thing that reads it.
        """
        return (
            self.db.query(func.count(SpacedRepetition.id))
            .filter(SpacedRepetition.next_review_date <= _now())
            .scalar()
        ) or 0

    def _session_belongs_to(self, subject: Subject):
        if subject.certification:
            return (
                (ExamSession.subject_id == subject.id)
                | (ExamSession.certification == subject.certification)
            )
        return ExamSession.subject_id == subject.id

    # ---- coverage ---------------------------------------------------

    def coverage_for(self, subject: Subject) -> List[FormatCoverage]:
        """Every practice format for a subject, including the empty ones."""
        out: List[FormatCoverage] = []

        question_count = 0
        if subject.certification:
            question_count = (
                self.db.query(func.count(Question.id))
                .filter(Question.certification == subject.certification)
                .scalar()
            ) or 0

        mocks = len(self.subjects.get_mock_results(subject)) if subject.certification else 0

        # A mock needs both an exam profile and enough questions to fill it.
        can_mock = subject.has_exam_profile and question_count >= (subject.exam_question_count or 0)
        out.append(FormatCoverage(
            key="mock",
            label="Full mock",
            count=question_count,
            completed=mocks,
            available=can_mock,
            detail=(
                f"{subject.exam_question_count} questions, {subject.exam_minutes} min, timed"
                if can_mock else
                "No exam profile for this subject" if not subject.has_exam_profile
                else f"Needs {subject.exam_question_count} questions, has {question_count}"
            ),
        ))

        out.append(FormatCoverage(
            key="drill",
            label="Drill",
            count=question_count,
            completed=0,
            available=question_count > 0,
            detail=f"{question_count} questions" if question_count else "No questions yet",
        ))

        review_count = (
            self.db.query(func.count(DesignReview.id))
            .filter(DesignReview.domain == self._design_domain(subject))
            .scalar()
        ) or 0
        reviews_done = (
            self.db.query(func.count(func.distinct(DesignReviewAttempt.review_id)))
            .join(DesignReview, DesignReview.id == DesignReviewAttempt.review_id)
            .filter(DesignReview.domain == self._design_domain(subject))
            .scalar()
        ) or 0
        out.append(FormatCoverage(
            key="design_review",
            label="Design Review",
            count=review_count,
            completed=reviews_done,
            available=review_count > 0,
            detail=(f"{review_count} reviews, {reviews_done} done" if review_count
                    else "No reviews for this subject"),
        ))

        prompt_count = self.db.query(func.count(SystemDesignPrompt.id)).scalar() or 0
        prompt_done = self.db.query(func.count(func.distinct(SystemDesignAttempt.prompt_id))).scalar() or 0
        out.append(FormatCoverage(
            key="system_design",
            label="System Design",
            count=prompt_count,
            completed=prompt_done,
            available=prompt_count > 0,
            detail=f"{prompt_count} prompts" if prompt_count else "No prompts yet",
        ))

        iq_count = self.db.query(func.count(InterviewQuestion.id)).scalar() or 0
        recordings = self.db.query(func.count(PracticeRecording.id)).scalar() or 0
        out.append(FormatCoverage(
            key="interview",
            label="Interview Practice",
            count=iq_count,
            completed=recordings,
            available=iq_count > 0,
            detail=f"{iq_count} questions" if iq_count else "Not set up",
        ))

        roadmaps = self.db.query(func.count(Roadmap.id)).scalar() or 0
        out.append(FormatCoverage(
            key="roadmap",
            label="Roadmap",
            count=roadmaps,
            completed=0,
            available=roadmaps > 0,
            detail=f"{roadmaps} imported" if roadmaps else "None imported",
        ))

        return out

    def _design_domain(self, subject: Subject) -> str:
        """Map a subject onto the design review domain vocabulary.

        A stopgap until design reviews carry a subject_id of their own; the
        two vocabularies already agree in practice.
        """
        return {
            "databricks": "data_platform",
            "system-design": "request_serving",
        }.get(subject.slug, "__none__")

    # ---- unified activity -------------------------------------------

    def activity(self, limit: int = 40) -> List[dict]:
        """One timeline across every format.

        Replaces the separate Exam History and System Design History pages.
        Two of four practice modes had their own history page and the other
        two had none, so nowhere answered "what have I been doing".
        """
        items: List[dict] = []

        for s in (
            self.db.query(ExamSession)
            .filter(ExamSession.status == ExamStatus.COMPLETED)
            .order_by(ExamSession.start_time.desc()).limit(limit).all()
        ):
            items.append({
                "kind": "mock" if s.session_kind == MOCK else "drill",
                "at": s.end_time or s.start_time,
                "title": s.title,
                "detail": (f"{s.score_percentage:.0f}%" if s.score_percentage is not None
                           else "not scored"),
                "href": f"/exam-review/{s.id}",
            })

        for a in (
            self.db.query(DesignReviewAttempt)
            .order_by(DesignReviewAttempt.created_at.desc()).limit(limit).all()
        ):
            items.append({
                "kind": "design_review",
                "at": a.created_at,
                "title": a.review.title if a.review else "Design review",
                "detail": {"A": "chose A", "B": "chose B"}.get(a.choice, "asked first"),
                "href": f"/design-reviews/{a.review_id}",
            })

        for a in (
            self.db.query(SystemDesignAttempt)
            .order_by(SystemDesignAttempt.created_at.desc()).limit(limit).all()
        ):
            items.append({
                "kind": "system_design",
                "at": a.created_at,
                "title": a.prompt.title if a.prompt else "System design",
                "detail": (f"{a.overall_score:.0f}%" if a.overall_score is not None
                           else "not graded"),
                "href": f"/system-design/attempts/{a.id}",
            })

        for r in (
            self.db.query(PracticeRecording)
            .order_by(PracticeRecording.created_at.desc()).limit(limit).all()
        ):
            items.append({
                "kind": "recording",
                "at": r.created_at,
                "title": "Interview practice",
                "detail": "recording saved",
                "href": "/recordings",
            })

        items.sort(key=lambda i: i["at"] or datetime.min, reverse=True)
        return items[:limit]
