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
from datetime import datetime, timedelta, UTC
from math import floor
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.design_review import DesignReview, DesignReviewAttempt
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.practice_recording import PracticeRecording
from app.models.recording_analysis import RecordingAnalysis
from app.models.roadmap import RoadmapTopic, RoadmapTopicStatus
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject import Subject
from app.models.system_design_attempt import SystemDesignAttempt
from app.models.system_design_prompt import SystemDesignPrompt
from app.repositories.question_repository import QuestionRepository
from app.repositories.subject_repository import SubjectRepository, LEARNER, MOCK, session_belongs_to
from app.services import readiness as readiness_rules


# How recently a session must have been started for "pick it up" to be the
# right thing to say about it. Three days rather than one: a paper begun on
# Friday and returned to on Monday is still the same sitting.
RESUMABLE_WITHIN_DAYS = 3


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


def _rubric_percent(scores) -> Optional[float]:
    """A rubric's scores as one percentage, or None if there is nothing to add up.

    Each entry is {category, score, max_score}. An empty or malformed list is
    None rather than 0: a rubric that produced no scores has not scored the
    learner at zero.
    """
    if not scores:
        return None
    earned = 0.0
    possible = 0.0
    for entry in scores:
        try:
            earned += float(entry.get("score", 0))
            possible += float(entry.get("max_score", 10) or 0)
        except (AttributeError, TypeError, ValueError):
            continue
    if possible <= 0:
        return None
    return round(100.0 * earned / possible, 1)


def _graded_clause(total: int, graded: int) -> str:
    """How much of that work actually came back with feedback.

    "System Design 4 attempts" is true and misleading when three of the four
    failed to grade: it reads as four pieces of practice with feedback behind
    them, and the reader has no way to find out otherwise from this line. The
    rule already applied elsewhere on this page -- interview counts *analysed*
    answers, not recordings, because a take nobody looked at is an audio file
    -- is applied here too, except that a written design answer is real work
    whether or not a model ever read it. So the attempts are still counted,
    and the line says what came back.
    """
    if graded == total:
        return ""
    if graded == 0:
        return " · none graded yet"
    return f" · {graded} graded"


class HomeService:
    def __init__(self, db: Session):
        self.db = db
        self.subjects = SubjectRepository(db)
        self.questions = QuestionRepository(db)

    # ---- resume -----------------------------------------------------

    def get_resumable(self, subject: Optional[Subject] = None) -> Optional[dict]:
        """The session you are actually in the middle of, if there is one.

        For one preparation when `subject` is given, by the same ownership rule as
        its mocks and its review queue. Unscoped, Home and Practice for PSM I
        offered "Continue" on a Databricks drill, which opened the other
        preparation's runner under a picker that still said PSM I.

        Surfaced above everything on Home, because stopping mid-session
        should not be a decision the learner has to make again from scratch.

        Bounded by RESUMABLE_WITHIN_DAYS, and that bound is the whole point.
        Without it this returned a paper started a month earlier and left at
        question 3 of 80 -- and Home offered "pick it up" as its single
        continuation, ahead of ninety unreviewed misses that were genuinely
        worth doing. A session left for weeks is not one you are in the
        middle of; it is one you abandoned, and treating the two the same way
        turns the most prominent action on the page into stale debt.
        """
        cutoff = _now() - timedelta(days=RESUMABLE_WITHIN_DAYS)
        query = self.db.query(ExamSession).filter(
            ExamSession.status.in_([ExamStatus.IN_PROGRESS, ExamStatus.PAUSED]),
            ExamSession.source == LEARNER,
            ExamSession.start_time >= cutoff,
        )
        if subject is not None:
            query = query.filter(session_belongs_to(subject))
        session = query.order_by(ExamSession.start_time.desc()).first()
        if not session:
            return None

        # By the wall clock from the start, as the runner's timer counts and as the
        # server enforces the limit. time_spent_seconds is only summed at submit,
        # so it said a paper left open for an hour still had its whole time left.
        remaining = None
        if session.time_allowed_seconds:
            elapsed = (_now() - session.start_time).total_seconds()
            remaining = max(0, int(session.time_allowed_seconds - elapsed))

        return {
            "session_id": session.id,
            "title": session.title,
            "session_kind": session.session_kind,
            "answered": session.answered_questions,
            "total": session.total_questions,
            "seconds_remaining": remaining,
            "started_at": session.start_time,
        }

    # ---- the two standing daily goals -------------------------------
    #
    # Derived, never stored. Each number is recomputed from the rows that caused
    # it, so a goal cannot drift from the evidence it summarises -- a stored
    # "reviewed today: 6" counter is one missed increment away from lying.
    #
    # Deliberately not a quota. The certification goal is min(cap, what the
    # schedule actually has due), so on a day with nothing due the goal is zero
    # and that is reported as the system working rather than as a missed day.
    #
    # "Today" is the learner's local calendar day. Timestamps are stored as naive
    # UTC, and the boundary comes from timeutils rather than date(created_at) in
    # SQL, which would put midnight in the wrong place for anyone not on UTC.

    INTERVIEW_DAILY_TARGET = 1

    def daily_goals(self, subject: Optional[Subject]) -> dict:
        return {
            "certification": self._certification_goal(subject) if subject else None,
            "interview": self._interview_goal(),
        }

    def _certification_goal(self, subject: Subject) -> dict:
        from app.core.timeutils import local_day_start_as_naive_utc
        from app.repositories.settings_repository import SettingsRepository

        day_start = local_day_start_as_naive_utc()
        cap = SettingsRepository(self.db).get_or_create().review_daily_cap or 20

        # Still waiting: the review queue for this preparation.
        due = self.unreviewed_count(subject)

        # Already done today. Counted from exam_answers.reviewed_at rather than
        # from review_checks, because a miss with no suitable check question is
        # marked reviewed without a check row -- counting checks would under-report
        # exactly the reviews that had nothing to verify against.
        reviewed_today = (
            self.db.query(func.count(ExamAnswer.id))
            .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
            .filter(
                ExamSession.session_kind == MOCK,
                ExamSession.source == LEARNER,
                ExamAnswer.is_correct.is_(False),
                ExamAnswer.reviewed_at.isnot(None),
                ExamAnswer.reviewed_at >= day_start,
                self._session_belongs_to(subject),
            )
            .scalar()
        ) or 0

        # Today's work is what is still due plus what was already done; the goal
        # is that, capped. So the cap can make a day smaller but never larger
        # than the schedule says.
        target = min(cap, due + reviewed_today)
        done = min(reviewed_today, target)
        queued_beyond_today = max(0, due + reviewed_today - target)

        if target == 0:
            state = "nothing_due"
        elif done >= target:
            state = "done"
        elif done > 0:
            state = "in_progress"
        else:
            state = "not_started"

        readiness = readiness_rules.compute(
            self.subjects.get_mock_results(subject),
            pass_mark=subject.pass_mark,
            has_exam_profile=subject.has_exam_profile,
        )

        return {
            "subject_id": subject.id,
            "subject_name": subject.name,
            "target": target,
            "done": done,
            "remaining": target - done,
            "due_for_review": due,
            "queued_beyond_today": queued_beyond_today,
            "daily_cap": cap,
            "state": state,
            # From readiness, so Home can only ever name a weak area the
            # readiness rules would also name. None when there is no evidence to
            # call anything weak -- never a guess.
            "weakest_area": readiness.weakest_domain,
        }

    def _interview_goal(self) -> dict:
        from app.core.timeutils import local_day_start_as_naive_utc
        from app.models.interview_question import InterviewQuestion, InterviewRoundType

        day_start = local_day_start_as_naive_utc()

        recorded_today = (
            self.db.query(func.count(PracticeRecording.id))
            .filter(PracticeRecording.created_at >= day_start)
            .scalar()
        ) or 0
        target = self.INTERVIEW_DAILY_TARGET
        done = min(recorded_today, target)

        latest = (
            self.db.query(RecordingAnalysis)
            .filter(RecordingAnalysis.analysis_status == "analyzed")
            .order_by(RecordingAnalysis.created_at.desc(), RecordingAnalysis.id.desc())
            .first()
        )

        # The round practised longest ago -- or never. Stated as exactly that and
        # not as a "recommendation": there is no model of which round has gone
        # stale, and calling a recency sort a recommendation would claim a
        # judgement the product does not make. Never-practised rounds come first,
        # in the enum's own order so the answer is stable from one visit to the
        # next.
        last_by_round = dict(
            self.db.query(InterviewQuestion.round_type, func.max(PracticeRecording.created_at))
            .join(PracticeRecording, PracticeRecording.interview_question_id == InterviewQuestion.id)
            .group_by(InterviewQuestion.round_type)
            .all()
        )
        never = [r for r in InterviewRoundType if r not in last_by_round]
        if never:
            longest_since = never[0]
        elif last_by_round:
            longest_since = min(last_by_round, key=lambda r: last_by_round[r])
        else:
            longest_since = None

        return {
            "target": target,
            "done": done,
            "remaining": target - done,
            "recorded_today": recorded_today,
            "state": "done" if done >= target else "not_started",
            # Percentages of the rubric, or None. None whenever no answer has
            # been analysed -- an AI that was unavailable has produced no signal,
            # and reporting 0% would blame the learner for a missing API key.
            "latest_content_signal": _rubric_percent(latest.content_scores) if latest else None,
            "latest_delivery_signal": _rubric_percent(latest.communication_scores) if latest else None,
            "latest_analysed_at": latest.created_at if latest else None,
            "longest_since_round": longest_since.value if longest_since else None,
            "longest_since_round_never_practised": bool(never) if longest_since else False,
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
                ExamSession.source == LEARNER,
                ExamSession.status == ExamStatus.COMPLETED,
                ExamAnswer.is_correct.is_(False),
                ExamAnswer.reviewed_at.is_(None),
            )
        )
        if subject is not None:
            query = query.filter(self._session_belongs_to(subject))
        return query.scalar() or 0

    def due_for_review_count(self, subject: Optional[Subject] = None) -> int:
        """Questions the spaced-repetition engine has scheduled for today.

        The engine has existed in the codebase with no route, no navigation
        entry and no registration. This is the first thing that reads it.

        Scoped to a preparation when one is given, through the same repository
        rule the spaced drill uses. Unscoped, Review offered a memory drill for a
        preparation with nothing due, and the engine then refused it.
        """
        from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository

        return SpacedRepetitionRepository(self.db).count_due(
            _now(), subject.id if subject is not None else None
        )

    def mock_totals(self) -> dict:
        """Headline numbers that count mocks alone.

        The existing dashboard's `overall_accuracy_percentage` averages
        ten-question warm-ups with full timed mocks, which is why it cannot
        answer whether you would pass. These are the honest counterparts, and
        accuracy is None rather than 0.0 when there is nothing to average --
        no measurement is not a bad measurement.
        """
        rows = (
            self.db.query(ExamSession.score_percentage)
            .filter(
                ExamSession.session_kind == MOCK,
                ExamSession.source == LEARNER,
                ExamSession.status == ExamStatus.COMPLETED,
                ExamSession.score_percentage.isnot(None),
            )
            .all()
        )
        scores = [r[0] for r in rows]
        subjects = self.subjects.get_all()
        return {
            "mock_count": len(scores),
            "mock_accuracy": round(sum(scores) / len(scores), 1) if scores else None,
            "subjects_total": len(subjects),
            "subjects_ready": sum(
                1 for s in subjects
                if readiness_rules.compute(
                    self.subjects.get_mock_results(s),
                    pass_mark=s.pass_mark,
                    has_exam_profile=s.has_exam_profile,
                ).state is readiness_rules.ReadinessState.READY
            ),
        }

    def other_preparation(self) -> List[dict]:
        """The formats that are not the exam, with what has actually been done.

        Every row is a count of real rows in this database. A format with
        nothing behind it is left out rather than shown as zero -- "System
        Design 0 attempts" is a reproach for not having done something the
        learner never said they wanted to do, and a Home made of those is the
        task list the product refuses to be.

        The Chart Sandbox is deliberately absent: what it tracks lives in the
        browser, so any figure here would be invented.
        """
        out: List[dict] = []

        design_reviews = (
            self.db.query(func.count(func.distinct(DesignReviewAttempt.review_id))).scalar()
        ) or 0
        if design_reviews:
            graded = (
                self.db.query(func.count(func.distinct(DesignReviewAttempt.review_id)))
                .filter(DesignReviewAttempt.grading_status == "graded")
                .scalar()
            ) or 0
            out.append({
                "key": "design_review",
                "label": "Design Review",
                "detail": (
                    f"{design_reviews} decision{'' if design_reviews == 1 else 's'} called"
                    + _graded_clause(design_reviews, graded)
                ),
                "href": "/design-reviews",
            })

        system_design = self.db.query(func.count(SystemDesignAttempt.id)).scalar() or 0
        if system_design:
            sd_graded = (
                self.db.query(func.count(SystemDesignAttempt.id))
                .filter(SystemDesignAttempt.grading_status == "graded")
                .scalar()
            ) or 0
            out.append({
                "key": "system_design",
                "label": "System Design",
                "detail": (
                    f"{system_design} attempt{'' if system_design == 1 else 's'}"
                    + _graded_clause(system_design, sd_graded)
                ),
                "href": "/system-design",
            })

        # Analysed answers, not recordings: a take you never had looked at is
        # not interview practice, it is an audio file.
        #
        # Filtered to analysis_status == "analyzed", matching the System Design
        # count above it, which filters to "graded". This used to count every
        # RecordingAnalysis row -- including "error" and "unavailable", which are
        # the rows written when analysis FAILED -- so a single failed analysis
        # was reported as "1 analysed answer" while Home's interview goal, reading
        # the same table correctly, said nothing had been analysed. The comment
        # above was right about the intent; the query did not do it.
        analysed = (
            self.db.query(func.count(RecordingAnalysis.id))
            .filter(RecordingAnalysis.analysis_status == "analyzed")
            .scalar()
        ) or 0
        if analysed:
            out.append({
                "key": "interview",
                "label": "Interview",
                "detail": f"{analysed} analysed answer{'' if analysed == 1 else 's'}",
                "href": "/interview-practice",
            })

        topics = (
            self.db.query(RoadmapTopic.status)
            .filter(RoadmapTopic.status != RoadmapTopicStatus.SKIPPED)
            .all()
        )
        done = sum(1 for (st,) in topics if st == RoadmapTopicStatus.COMPLETED)
        if topics and done:
            out.append({
                "key": "roadmap",
                "label": "Roadmap",
                "detail": f"{round(done / len(topics) * 100)}% complete",
                "href": "/roadmaps",
            })

        return out

    def _session_belongs_to(self, subject: Subject):
        # The shared definition -- see subject_repository.session_belongs_to.
        return session_belongs_to(subject)

    # ---- coverage ---------------------------------------------------

    def coverage_for(self, subject: Subject) -> List[FormatCoverage]:
        """Every practice format for a subject, including the empty ones."""
        out: List[FormatCoverage] = []

        # Question.subject_id, which is the column ExamEngine draws from.
        #
        # Counting by `certification` string instead reported 0 for every skill
        # subject -- a skill has no certification name to match -- and for any
        # preparation whose questions were bound by id. `can_mock` below is
        # computed from this number, so a count that disagrees with the engine
        # produces a surface that offers an exam the engine then refuses, or
        # hides one it would have run.
        question_count = self.questions.count_for_subject(subject.id)

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

        # No query at all for a subject that owns no design-review domain.
        # This used to compare against the sentinel string "__none__", which
        # worked only for as long as no review was ever seeded carrying that
        # value -- and a review that did would have been attributed to every
        # unmapped subject at once. Absence is expressed as absence.
        design_domain = self._design_domain(subject)
        review_count = 0 if design_domain is None else (
            self.db.query(func.count(DesignReview.id))
            .filter(DesignReview.domain == design_domain)
            .scalar()
        ) or 0
        reviews_done = 0 if design_domain is None else (
            self.db.query(func.count(func.distinct(DesignReviewAttempt.review_id)))
            .join(DesignReview, DesignReview.id == DesignReviewAttempt.review_id)
            .filter(DesignReview.domain == design_domain)
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

        # System design prompts, interview questions and roadmaps carry no
        # subject scope in the schema -- they are one global pool each. They
        # used to be counted here unfiltered, so the PSM I page reported "32
        # prompts" and "34 questions" as though they were Scrum content. A
        # global number wearing a subject's heading is a lie the learner
        # cannot check, and it is the same error as counting a drill towards
        # readiness: the figure is real, its label is not.
        #
        # Rather than add a subject_id to three tables to generalise a model
        # with one populated member, the one editorial mapping that does hold
        # is written down, next to the design-review mapping that already
        # works this way. A subject reports a format only if it owns it.
        if self._owns_system_design(subject):
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

        return out

    def _owns_system_design(self, subject: Subject) -> bool:
        """Whether system design prompts are this subject's content.

        Written as a slug check rather than inferred, for the same reason
        _design_domain is: the mapping is an editorial judgement, and an
        editorial judgement should be visible in the source rather than
        emerge from a heuristic.
        """
        return subject.slug == "system-design"

    # Design reviews carry a `domain` string and no subject_id, so ownership
    # is this dictionary. Reviewed in phase 50 and deliberately kept, with
    # the reasoning recorded here rather than in a commit message.
    #
    # It is not a general mapping layer and should not become one. Two of the
    # three seeded subjects appear; the third (psm-i) owns no design reviews,
    # which is a fact about the content, not a gap in the table.
    #
    # WHEN TO REPLACE IT: when design reviews need to belong to a subject the
    # editorial team did not enumerate here -- i.e. when reviews become
    # user-importable, or when a fourth subject ships with its own reviews.
    # At that point `domain` becomes `subject_id` on design_reviews and this
    # method goes away. Doing it now would add a column, a migration and a
    # backfill to generalise a table with one populated domain in it.
    #
    # WHY IT IS SAFE UNTIL THEN: the only two failure modes are a subject
    # reporting reviews it does not own, and a subject reporting none when it
    # owns some. The first cannot happen -- the mapping is explicit, slugs are
    # unique, and an unmapped subject runs no query at all. The second is
    # visible on the subject page as "No reviews for this subject", which is
    # a claim someone can read and contradict.
    _DESIGN_REVIEW_DOMAIN_BY_SUBJECT = {
        "databricks": "data_platform",
        "system-design": "request_serving",
    }

    def _design_domain(self, subject: Subject) -> Optional[str]:
        """Which design-review domain this subject owns, or None if it owns none."""
        return self._DESIGN_REVIEW_DOMAIN_BY_SUBJECT.get(subject.slug)

    # ---- unified activity -------------------------------------------

    @staticmethod
    def _pct(value: float) -> str:
        """A whole-number percentage, rounded the way the client rounds.

        `f"{92.5:.0f}"` is "92": Python rounds halves to even. Every screen
        in the client uses Math.round, which rounds halves up and gives
        "93". The activity list was the only place formatting a score
        server-side, so one 92.5% mock appeared as 93% in the verdict at the
        top of Home and 92% in the history further down -- the same paper,
        two numbers, no way for a reader to tell which was the real one.

        Scores are percentages in [0, 100], so this is exact.
        """
        return f"{floor(value + 0.5):.0f}%"

    def activity(self, limit: int = 40, subject: Optional[Subject] = None) -> List[dict]:
        """One timeline across every format.

        Replaces the separate Exam History and System Design History pages.
        Two of four practice modes had their own history page and the other
        two had none, so nowhere answered "what have I been doing".

        With `subject`, only that preparation's exam sessions. Design reviews,
        system design and interview recordings belong to no preparation yet, so a
        scoped timeline leaves them out rather than filing them under one.
        """
        items: List[dict] = []

        sessions = self.db.query(ExamSession).filter(
            ExamSession.status == ExamStatus.COMPLETED,
            ExamSession.source == LEARNER,
        )
        if subject is not None:
            sessions = sessions.filter(session_belongs_to(subject))
        for s in sessions.order_by(ExamSession.start_time.desc()).limit(limit).all():
            items.append({
                "kind": "mock" if s.session_kind == MOCK else "drill",
                "at": s.end_time or s.start_time,
                "title": s.title,
                "detail": (self._pct(s.score_percentage) if s.score_percentage is not None
                           else "not scored"),
                "href": f"/exam-review/{s.id}",
            })

        if subject is not None:
            return items[:limit]

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
                "detail": (self._pct(a.overall_score) if a.overall_score is not None
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
