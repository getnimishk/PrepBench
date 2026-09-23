# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import random
import re
from collections import Counter
from datetime import datetime, UTC, timedelta
from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.repositories.exam_repository import ExamRepository
from app.repositories.question_repository import QuestionRepository
from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository
from app.repositories.subject_repository import SubjectRepository, MOCK
from app.models.exam_session import ExamSession, ExamMode, ExamStatus
from app.models.exam_answer import ExamAnswer
from app.models.question import Question
from app.models.spaced_repetition import SpacedRepetition
from app.schemas.exam import ExamCreateRequest, SaveAnswerRequest, ExamDetailResponse, ExamSessionResponse
from app.schemas.question import QuestionResponse
from app.services.sm2_service import SM2Service
from app.core.exceptions import ConflictException, ResourceNotFoundException, InvalidExamStateException

# "Not answered recently" means not in this many days.
RECENTLY_SEEN_DAYS = 7

# Seconds past the time limit an answer is still accepted. Covers a save that
# left the browser as the clock reached zero; it is not extra time.
ANSWER_GRACE_SECONDS = 30


def _apportion(counts: Dict[str, int], n: int) -> Dict[str, int]:
    """Share n out across groups in proportion to their size (largest remainder).

    Never gives a group more than it has, and the shares always add up to
    min(n, total). Ties go to the larger group, then alphabetically, so the same
    bank always produces the same plan.
    """
    total = sum(counts.values())
    if total == 0 or n <= 0:
        return {group: 0 for group in counts}
    n = min(n, total)
    exact = {group: size * n / total for group, size in counts.items()}
    plan = {group: int(exact[group]) for group in counts}
    left = n - sum(plan.values())
    order = sorted(counts, key=lambda g: (-(exact[g] - plan[g]), -counts[g], g))
    for group in order[:left]:
        plan[group] += 1
    return plan


def _empty_composition() -> dict:
    return {
        "previously_missed": 0,
        "due_for_review": 0,
        "never_attempted": 0,
        "answered_correctly": 0,
    }


class ExamEngine:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ExamRepository(db)
        self.question_repo = QuestionRepository(db)
        self.analytics_repo = AnalyticsRepository(db)
        self.sr_repo = SpacedRepetitionRepository(db)

    @staticmethod
    def _refuse_mock_without_a_profile(req: ExamCreateRequest, subject) -> None:
        """A mock needs a subject with a pass mark, a length and a time limit.

        A precondition on the subject, so it takes no notice of the question
        bank and runs before the bank is queried. A skill subject has no pass
        mark, so there is nothing for a mock to measure against -- and the
        refusal must say that rather than blaming the filter.
        """
        if req.session_kind != MOCK:
            return
        if subject is None or not subject.has_exam_profile:
            raise InvalidExamStateException(
                "A mock needs a subject with an exam profile -- a question count, "
                "a time limit and a pass mark. This session would have nothing to "
                "measure against."
            )

    @staticmethod
    def _describe_filters(req: ExamCreateRequest, certification=None) -> str:
        """The selection, in the learner's own words, for the no-match error.

        Says what was actually asked for rather than "no results", so the
        person can see which part of the selection was too narrow without
        opening the request in a network tab.
        """
        parts = []
        if certification and certification.strip():
            parts.append(certification.strip())
        if req.domains:
            parts.append(", ".join(req.domains))
        if req.topics:
            parts.append("topics " + ", ".join(req.topics))
        if req.difficulties:
            parts.append("difficulty " + ", ".join(req.difficulties))
        if req.exam_mode == ExamMode.WEAK_TOPIC:
            parts.append("your weakest topics, of which there are none yet")
        elif req.exam_mode == ExamMode.SPACED_REPETITION:
            parts.append("questions due for review, of which there are none")
        return "; ".join(parts) if parts else "the current selection"

    def create_exam(self, req: ExamCreateRequest) -> ExamSessionResponse:
        subject, available_questions = self._select(req)
        certification = req.certification

        if req.session_kind == MOCK:
            # A mock takes each domain in proportion to its share of the bank, so
            # the paper has the bank's shape rather than whatever a shuffle
            # happened to produce. PrepBench has no official blueprint for any
            # exam, and the setup page says this is what it does instead.
            selected_questions = self._draw_by_domain(
                available_questions, req.total_questions, req.randomize_questions
            )
        else:
            if req.randomize_questions:
                random.shuffle(available_questions)
            selected_questions = available_questions[:req.total_questions]

        # There is deliberately no option-shuffling step, and no setting that
        # claims there is one.
        #
        # It used to call random.shuffle(q.options) on the SQLAlchemy
        # relationship collection, which is destructive: Question.options has
        # cascade="all, delete-orphan", and shuffle's in-place swaps are
        # instrumented __setitem__ calls that SQLAlchemy can read as items
        # leaving the collection -- silently DELETING those options on the
        # next commit. Confirmed by direct reproduction: a 4-option question
        # dropped to 3 after exactly this shuffle+commit sequence.
        #
        # It was a no-op even before it was destructive -- get_exam_details()
        # re-queries the questions in a separate session, so the shuffled
        # in-memory order was never read back. The switch that offered it has
        # been removed rather than left inert: a control that provably does
        # nothing is a false statement about the product, and the learner has
        # no way to catch it.
        question_ids = [q.id for q in selected_questions]

        return self._create_session(req, subject, certification, question_ids)

    def preview_exam(self, req: ExamCreateRequest) -> dict:
        """What starting this exam would draw from, without starting it.

        Runs the same selection as create_exam, so a preview cannot promise a set
        the engine then refuses, or describe a pool it does not draw from. When
        the engine would refuse, the refusal is returned as the reason -- the
        same sentence the learner would otherwise meet after pressing Start.

        The composition describes the whole matching pool, not the questions that
        will be drawn: a drill draws at random, so naming "the twenty you will
        get" before they are drawn would be a guess presented as a fact.
        """
        try:
            _subject, available = self._select(req)
        except InvalidExamStateException as refusal:
            return {
                "can_start": False, "reason": refusal.detail,
                "available": 0, "will_draw": 0, **_empty_composition(), "domain_plan": [],
            }

        domain_plan = []
        if req.session_kind == MOCK:
            sizes = Counter(q.domain or "" for q in available)
            drawn = _apportion(dict(sizes), req.total_questions)
            domain_plan = [
                {"domain": domain or "No domain", "available": size, "will_draw": drawn[domain]}
                for domain, size in sorted(sizes.items(), key=lambda kv: (-kv[1], kv[0]))
            ]
        return {
            "can_start": True, "reason": None,
            "available": len(available),
            "will_draw": min(len(available), req.total_questions),
            **self._composition([q.id for q in available]),
            "domain_plan": domain_plan,
        }

    @staticmethod
    def _draw_by_domain(available: list, n: int, randomize: bool) -> list:
        """n questions, each domain contributing its share of the pool."""
        by_domain: Dict[str, list] = {}
        for question in available:
            by_domain.setdefault(question.domain or "", []).append(question)
        plan = _apportion({d: len(qs) for d, qs in by_domain.items()}, n)
        drawn = []
        for domain, questions in by_domain.items():
            take = plan[domain]
            drawn.extend(random.sample(questions, take) if randomize else questions[:take])
        if randomize:
            random.shuffle(drawn)
        return drawn

    def _seen_question_ids(self, question_ids: list, since: Optional[datetime]) -> set:
        """Which of these questions the learner has answered, optionally since a time.

        Answers in completed learner sessions only -- the rows every evidence
        surface counts -- and a skipped question is not an answered one.
        """
        from sqlalchemy import func

        from app.repositories.subject_repository import LEARNER

        seen = set()
        for start in range(0, len(question_ids), 900):
            chunk = question_ids[start:start + 900]
            query = (
                self.db.query(ExamAnswer.question_id)
                .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
                .filter(
                    ExamSession.status == ExamStatus.COMPLETED,
                    ExamSession.source == LEARNER,
                    ExamAnswer.is_correct.isnot(None),
                    ExamAnswer.question_id.in_(chunk),
                )
            )
            if since is not None:
                query = query.filter(
                    func.coalesce(ExamSession.end_time, ExamSession.start_time) >= since
                )
            seen.update(row[0] for row in query.distinct().all())
        return seen

    def _composition(self, question_ids: list) -> dict:
        """The pool, by what the learner's own evidence says about each question.

        Exclusive, and ranked in the order a focused session should care about
        them: missed at least once, then due on the spaced schedule, then never
        attempted, then answered correctly every time so far.

        Evidence is answers in completed learner sessions -- the same rows every
        other evidence surface counts -- and an answer with no correctness
        recorded (skipped) is not an attempt.
        """
        from app.services.question_evidence import evidence_for

        out = _empty_composition()
        if not question_ids:
            return out

        for evidence in evidence_for(self.db, question_ids).values():
            if evidence.missed:
                out["previously_missed"] += 1
            elif evidence.due:
                out["due_for_review"] += 1
            elif not evidence.attempted:
                out["never_attempted"] += 1
            else:
                out["answered_correctly"] += 1
        return out

        attempts = {}
        due = set()
        now = datetime.now(UTC).replace(tzinfo=None)
        # Chunked: a whole bank can exceed what one SQLite IN list accepts.
        for start in range(0, len(question_ids), 900):
            chunk = question_ids[start:start + 900]
            rows = (
                self.db.query(
                    ExamAnswer.question_id,
                    func.count(ExamAnswer.id),
                    func.sum(case((ExamAnswer.is_correct.is_(True), 1), else_=0)),
                )
                .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
                .filter(
                    ExamSession.status == ExamStatus.COMPLETED,
                    ExamSession.source == LEARNER,
                    ExamAnswer.is_correct.isnot(None),
                    ExamAnswer.question_id.in_(chunk),
                )
                .group_by(ExamAnswer.question_id)
                .all()
            )
            for question_id, answered, correct in rows:
                attempts[question_id] = (int(answered or 0), int(correct or 0))
            due.update(
                row[0]
                for row in self.db.query(SpacedRepetition.question_id)
                .filter(
                    SpacedRepetition.next_review_date <= now,
                    SpacedRepetition.question_id.in_(chunk),
                )
                .all()
            )

        for question_id in question_ids:
            answered, correct = attempts.get(question_id, (0, 0))
            if answered and correct < answered:
                out["previously_missed"] += 1
            elif question_id in due:
                out["due_for_review"] += 1
            elif not answered:
                out["never_attempted"] += 1
            else:
                out["answered_correctly"] += 1
        return out

    def _select(self, req: ExamCreateRequest):
        """The questions this request may draw from, or the reason it may not.

        Returns (subject, matching questions). Every refusal the engine makes
        about a selection is raised here, so starting and previewing agree.
        """
        # Filter pieces are assembled here -- what a certification token means,
        # what counts as a weak topic -- and handed to the repository to run.
        certification_conditions = None
        restrict_to_topics = None
        restrict_to_ids = None

        subject = None
        if req.subject_id is not None:
            subject = SubjectRepository(self.db).get_by_id(req.subject_id)
            if subject is None:
                raise ResourceNotFoundException("Subject", req.subject_id)

        # A subject that was named is the scope. The client sends the subject
        # and the server resolves what that means, rather than the client
        # restating a certification string it would have had to look up --
        # which is how a session ends up filed under a subject whose questions
        # it was not actually drawn from.
        certification = req.certification

        # Two scoping paths, and the asymmetry between them is deliberate.
        #
        #   subject_id  -> precise. One indexed foreign key, nothing else.
        #   certification string -> lenient. The old token/ILIKE match, kept
        #                           only so existing callers keep working.
        #
        # The string match is how another preparation's questions reached a PSM
        # I mock: it ORs an ILIKE for every token of the certification name
        # across BOTH Question.certification AND Question.domain, so
        # "PSM I - Professional Scrum Master" matches any question whose domain
        # contains "Master". A word in common is not evidence of ownership.
        #
        # So a named subject no longer falls back to its certification string.
        # It scopes by Question.subject_id, which the migration backfilled by
        # exact certification equality. This also closes the second half of the
        # same hole: a skill subject has no certification at all, which used to
        # mean no filter was applied and a drill drew from every question in the
        # database. Now it draws from the questions bound to it, and if there
        # are none the refusal below says so rather than inventing a bank.
        #
        # Nothing in the frontend sends `certification` -- ExamSetupPage sends
        # subject_id only -- so the lenient path is reached by tests and by any
        # older client, and it is left exactly as it was.
        subject_scope_id = subject.id if subject is not None else None

        # Refused before a single question is fetched, because it is a fact
        # about the subject and not about the bank.
        #
        # This used to sit after selection, alongside the length check, and the
        # ordering stopped being harmless once a named subject began scoping by
        # subject_id: a skill subject owns no questions, so "no questions match
        # those filters -- widen the selection" fired first and sent the learner
        # off to change a filter when the real answer is that a skill has no
        # pass mark and a mock of it could not measure anything. Same refusal,
        # same status, but the message has to name the actual reason.
        self._refuse_mock_without_a_profile(req, subject)

        if subject_scope_id is None and certification and certification.strip():
            cert_val = certification.strip()
            # Smart token extraction (e.g. "PSM I - Professional Scrum Master" -> tokens: PSM, Scrum, Master)
            tokens = [t for t in re.split(r'[\s\-\—™:\(\)]+', cert_val) if len(t) > 1 and t.lower() not in ['and', 'the', 'for', 'prep', 'exam', 'practice', 'hard', 'easy', 'medium']]
            
            conditions = [
                Question.certification == cert_val,
                Question.certification.ilike(f"%{cert_val}%"),
                Question.domain.ilike(f"%{cert_val}%")
            ]
            
            if tokens:
                # Add conditions for token matches
                for t in tokens:
                    conditions.append(Question.certification.ilike(f"%{t}%"))
                    conditions.append(Question.domain.ilike(f"%{t}%"))

            certification_conditions = conditions

        # Both of these modes are defined entirely by what they restrict to.
        # An empty restriction used to be dropped, which turned "practise my
        # weakest topics" into "eighty questions from anywhere" without a
        # word -- the same silent broadening as an over-narrow filter, and
        # harder to notice because the exam looks perfectly normal.
        if req.exam_mode == ExamMode.WEAK_TOPIC:
            restrict_to_topics = self.analytics_repo.get_weak_topic_names(
                below_percent=70.0, subject_id=subject_scope_id
            )
            if not restrict_to_topics:
                # Says which evidence is missing, because the two cases have
                # different answers. Weakness is measured over full mocks --
                # a drill draws from what you are getting wrong, so letting
                # drills decide would mean practising a topic kept it on the
                # list. Someone who has never sat a paper is not told to
                # answer more questions; they are told to sit one.
                where = f" in {subject.name}" if subject is not None else ""
                raise InvalidExamStateException(
                    f"Nothing{where} is measurably weak yet. Weak areas are read from full "
                    "mocks, not from drills — a drill draws from what you are already "
                    "getting wrong, so it cannot tell you what to work on. Sit a mock, "
                    "or start a different kind of exam."
                )

        elif req.exam_mode == ExamMode.SPACED_REPETITION:
            now = datetime.now(UTC).replace(tzinfo=None)
            restrict_to_ids = self.sr_repo.due_question_ids(now, subject_id=subject_scope_id)
            if not restrict_to_ids:
                # Named, because "nothing is due" is false when another
                # preparation has plenty and this one has none.
                where = f" in {subject.name}" if subject is not None else ""
                raise InvalidExamStateException(
                    f"Nothing{where} is due for review right now. Come back when the "
                    "schedule brings questions round again."
                )

        available_questions = self.question_repo.find_for_exam(
            subject_id=subject_scope_id,
            certification_conditions=certification_conditions,
            topics=list(req.topics) if req.topics else None,
            domains=list(req.domains) if req.domains else None,
            difficulties=list(req.difficulties) if req.difficulties else None,
            restrict_to_ids=restrict_to_ids,
            restrict_to_topics=restrict_to_topics,
        )

        # A filter that matches nothing fails here. It used to fall back to the
        # whole question bank, which is the worst available behaviour: the
        # learner asked for Sprint Planning at hard difficulty, got eighty
        # questions from every domain in the bank, and nothing anywhere said
        # so. Every number downstream -- the score, the weak-topic list, the
        # domain breakdown -- then describes an exam nobody chose to sit.
        #
        # Silently widening scope is worse than failing, because the learner
        # cannot tell it happened.
        if not available_questions:
            if self.question_repo.count() == 0:
                raise InvalidExamStateException(
                    "The question bank is empty. Import some questions first."
                )
            # "Widen the selection" is not advice a learner can act on when the
            # preparation itself has no questions -- there is no filter to
            # loosen, and the only thing that helps is importing a bank. Worth
            # separating because it is the normal state of a newly added
            # preparation, so it is the first thing many people will see.
            if subject is not None and self.question_repo.count_for_subject(subject.id) == 0:
                raise InvalidExamStateException(
                    f"{subject.name} has no questions yet, so there is nothing to "
                    f"draw an exam from. Import a question bank for it, or switch "
                    f"to a preparation that has one."
                )
            raise InvalidExamStateException(
                "No questions match those filters: "
                # The subject's name, not its certification string: the learner
                # chose a preparation from a picker and has very likely never
                # seen the certification text the old message quoted at them.
                + self._describe_filters(req, subject.name if subject else certification)
                + ". Widen the selection and try again."
            )

        # The question source narrows what matched to what the learner has not
        # answered -- recently, or ever. It runs after the no-match refusal so
        # that "nothing matches" and "nothing unseen is left" stay two different
        # sentences, because they have different remedies.
        if req.question_source != "all":
            unseen_only = req.question_source == "unseen"
            since = None if unseen_only else (
                datetime.now(UTC).replace(tzinfo=None) - timedelta(days=RECENTLY_SEEN_DAYS)
            )
            seen = self._seen_question_ids([q.id for q in available_questions], since)
            available_questions = [q for q in available_questions if q.id not in seen]
            if not available_questions:
                where = subject.name if subject is not None else "this selection"
                raise InvalidExamStateException(
                    f"You have answered every question in {where} before, so there are "
                    "no unseen ones left. Draw from the whole bank instead."
                    if unseen_only else
                    f"You have answered every question in {where} in the last "
                    f"{RECENTLY_SEEN_DAYS} days. Draw from the whole bank instead."
                )

        # A mock is only worth what it claims if it is actually the full paper.
        #
        # Nothing else in the system checks this. session_kind is a string on
        # the request, so without this a five-question warm-up could be filed
        # as a mock and would then be averaged into readiness with the same
        # weight as an eighty-question sitting -- and a short mock is worse
        # than a drill, because it is a drill wearing a measurement's label.
        #
        # Only the LENGTH check waits for the selection, so that a bank too
        # small to fill the paper fails here too instead of quietly producing a
        # short one. The exam-profile precondition is checked further up, before
        # any question is looked at -- see _refuse_mock_without_a_profile.
        if req.session_kind == MOCK:
            required = subject.exam_question_count or 0
            # The number that would be drawn: the request's length, capped by
            # what matched. Same arithmetic as slicing the shuffled pool.
            drawable = min(len(available_questions), req.total_questions)
            if drawable < required:
                raise InvalidExamStateException(
                    f"A {subject.name} mock is {required} questions and only "
                    f"{drawable} are available. Import more questions, "
                    f"or run a drill instead."
                )

        return subject, available_questions

    def _create_session(self, req: ExamCreateRequest, subject, certification, question_ids):
        time_allowed = None
        if req.exam_mode == ExamMode.TIMED and req.time_allowed_minutes:
            time_allowed = req.time_allowed_minutes * 60

        session = ExamSession(
            title=req.title or f"{req.exam_mode.capitalize()} Exam",
            exam_mode=req.exam_mode,
            status=ExamStatus.IN_PROGRESS,
            certification=certification or "General",
            # The seam the readiness rule depends on. Without these two the
            # model's default made every session a drill, and a subject with
            # no certification string could never own one at all.
            session_kind=req.session_kind,
            subject_id=req.subject_id,
            total_questions=len(question_ids),
            passing_percentage=req.passing_percentage,
            time_allowed_seconds=time_allowed,
            question_ids_order=question_ids,
            start_time=datetime.now(UTC).replace(tzinfo=None)
        )
        saved_session = self.repo.create_session(session)
        return ExamSessionResponse.model_validate(saved_session)

    def get_exam_details(self, session_id: int) -> ExamDetailResponse:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise ResourceNotFoundException("ExamSession", session_id)

        questions_dict = {
            q.id: q for q in self.question_repo.get_by_ids(session.question_ids_order)
        }
        ordered_questions = [questions_dict[qid] for qid in session.question_ids_order if qid in questions_dict]

        res = ExamDetailResponse.model_validate(session)
        res.questions = [QuestionResponse.model_validate(q) for q in ordered_questions]
        return res

    def save_answer(self, session_id: int, req: SaveAnswerRequest) -> ExamSessionResponse:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise ResourceNotFoundException("ExamSession", session_id)
        if session.status == ExamStatus.COMPLETED:
            raise InvalidExamStateException("Cannot modify answer for completed exam.")

        # The time limit is the server's, not the page's. Enforced only in the
        # browser, a paper could be answered after its clock ran out by leaving the
        # tab closed until the time was up and then reopening it -- and a timed
        # mock is only readiness evidence if the time was real.
        if session.time_allowed_seconds:
            deadline = session.start_time + timedelta(
                seconds=session.time_allowed_seconds + ANSWER_GRACE_SECONDS
            )
            if datetime.now(UTC).replace(tzinfo=None) > deadline:
                raise InvalidExamStateException(
                    "Time is up for this exam. Answers saved before the limit are kept; "
                    "submit it to see the result."
                )

        if req.question_id not in session.question_ids_order:
            raise InvalidExamStateException(
                f"Question {req.question_id} is not part of this exam session."
            )

        question = self.question_repo.get_by_id(req.question_id)
        if not question:
            raise ResourceNotFoundException("Question", req.question_id)

        correct_option_ids = set([opt.id for opt in question.options if opt.is_correct])
        selected_ids = set(req.selected_option_ids)
        # None (not False) when nothing is selected: the frontend calls this on
        # every navigation/flag/bookmark toggle, including for questions the user
        # hasn't actually answered yet. Recording those as `is_correct=False`
        # would count them as wrong answers in analytics (get_topic_performance,
        # get_overall_stats all filter on `is_correct != None` to mean
        # "attempted"), silently dragging down every topic's accuracy with
        # skipped-not-wrong questions and corrupting the weak-topics list.
        is_correct = (correct_option_ids == selected_ids) if selected_ids else None

        answer_obj = ExamAnswer(
            session_id=session_id,
            question_id=req.question_id,
            selected_option_ids=req.selected_option_ids,
            is_correct=is_correct,
            time_spent_seconds=req.time_spent_seconds,
            confidence_level=req.confidence_level,
            is_flagged=req.is_flagged,
            is_bookmarked=req.is_bookmarked,
            user_notes=req.user_notes
        )
        self.repo.save_answer(answer_obj)

        # The spaced-repetition schedule is NOT advanced here.
        #
        # It used to be, on every call -- and the client calls this on every
        # navigation, every flag toggle and every confidence change, not only
        # when an answer is given. SM2Service.update_item is not idempotent:
        # each call increments `repetition` and multiplies `interval_days`, so
        # flipping back and forth between two questions pushed them weeks into
        # the future off the back of no recall at all. In the working database
        # thirteen of 369 scheduled items carry a repetition count higher than
        # the number of sessions the question has ever appeared in; one sits at
        # repetition 5 and a 41-day interval having been answered twice.
        #
        # It now runs once per session, in finish_exam, over the answers as
        # they finally stand. That gives exactly one recall event per question
        # per sitting, uses the confidence the learner ended on rather than the
        # one they had before they were asked, and ties the schedule to the
        # same COMPLETED sessions that every other evidence surface counts.

        answers = session.answers
        session.answered_questions = len([a for a in answers if a.selected_option_ids])
        if (
            req.current_question_index is not None
            and req.current_question_index < len(session.question_ids_order or [])
        ):
            session.current_question_index = req.current_question_index
        
        self.repo.update_session(session)
        return ExamSessionResponse.model_validate(session)

    def discard_exam(self, session_id: int) -> None:
        """Throw away a session that was never submitted.

        An unfinished session is not evidence -- nothing reads it except Continue --
        so discarding one loses nothing the product counts. A submitted one is
        evidence, and is refused.
        """
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise ResourceNotFoundException("ExamSession", session_id)
        if session.status == ExamStatus.COMPLETED:
            raise ConflictException(
                "A submitted exam is part of your evidence, so it cannot be discarded."
            )
        self.repo.delete_session(session)

    def finish_exam(self, session_id: int) -> ExamDetailResponse:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise ResourceNotFoundException("ExamSession", session_id)

        # Finishing is idempotent. Without this, a double-click on "Submit &
        # Finish" (or any client retry) re-stamps end_time and recomputes the
        # duration, inflating it a little further on every extra call.
        if session.status == ExamStatus.COMPLETED:
            return self.get_exam_details(session_id)

        answers = session.answers
        correct_count = sum(1 for a in answers if a.is_correct is True)
        total = session.total_questions

        score_pct = (correct_count / total * 100.0) if total > 0 else 0.0
        is_passed = "passed" if score_pct >= session.passing_percentage else "failed"

        session.correct_count = correct_count
        session.score_percentage = round(score_pct, 1)
        session.is_passed = is_passed
        session.status = ExamStatus.COMPLETED
        session.end_time = datetime.now(UTC).replace(tzinfo=None)

        # Sum of the per-question time the client actually measured, NOT the
        # wall-clock gap between start_time and end_time. Practice mode is
        # untimed by design, so a session left open overnight would otherwise
        # report every idle hour as study time -- corrupting the History
        # duration column, both exported reports, and the dashboard's recent
        # exam list, all of which read this field.
        session.time_spent_seconds = sum(a.time_spent_seconds or 0 for a in answers)

        self.repo.update_session(session)

        # One recall event per answered question, once, at the end. See the
        # note in save_answer for why it is not done there. Guarded by the
        # idempotence check at the top of this method, so a retried submit does
        # not schedule the same sitting twice.
        for a in answers:
            if a.selected_option_ids:
                SM2Service.update_item(
                    self.db, a.question_id, bool(a.is_correct), a.confidence_level
                )

        return self.get_exam_details(session_id)
