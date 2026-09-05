# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import random
import re
from datetime import datetime, UTC
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
from app.core.exceptions import ResourceNotFoundException, InvalidExamStateException

class ExamEngine:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ExamRepository(db)
        self.question_repo = QuestionRepository(db)
        self.analytics_repo = AnalyticsRepository(db)
        self.sr_repo = SpacedRepetitionRepository(db)

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
        if not (certification and certification.strip()) and subject is not None:
            certification = subject.certification

        if certification and certification.strip():
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
            restrict_to_topics = self.analytics_repo.get_weak_topic_names(below_percent=70.0)
            if not restrict_to_topics:
                raise InvalidExamStateException(
                    "No weak topics yet — nothing is below 70%. Answer more questions "
                    "first, or start a different kind of exam."
                )

        elif req.exam_mode == ExamMode.SPACED_REPETITION:
            now = datetime.now(UTC).replace(tzinfo=None)
            restrict_to_ids = self.sr_repo.due_question_ids(now)
            if not restrict_to_ids:
                raise InvalidExamStateException(
                    "Nothing is due for review right now. Come back when the schedule "
                    "brings questions round again."
                )

        available_questions = self.question_repo.find_for_exam(
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
            raise InvalidExamStateException(
                "No questions match those filters: "
                + self._describe_filters(req, certification)
                + ". Widen the selection and try again."
            )

        if req.randomize_questions:
            random.shuffle(available_questions)

        selected_questions = available_questions[:req.total_questions]

        # A mock is only worth what it claims if it is actually the full paper.
        #
        # Nothing else in the system checks this. session_kind is a string on
        # the request, so without this a five-question warm-up could be filed
        # as a mock and would then be averaged into readiness with the same
        # weight as an eighty-question sitting -- and a short mock is worse
        # than a drill, because it is a drill wearing a measurement's label.
        #
        # Checked after selection rather than before, so that a bank too small
        # to fill the paper fails here too instead of quietly producing a
        # short one.
        if req.session_kind == MOCK:
            if subject is None or not subject.has_exam_profile:
                raise InvalidExamStateException(
                    "A mock needs a subject with an exam profile -- a question count, "
                    "a time limit and a pass mark. This session would have nothing to "
                    "measure against."
                )
            required = subject.exam_question_count or 0
            if len(selected_questions) < required:
                raise InvalidExamStateException(
                    f"A {subject.name} mock is {required} questions and only "
                    f"{len(selected_questions)} are available. Import more questions, "
                    f"or run a drill instead."
                )

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
            total_questions=len(selected_questions),
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

        if selected_ids:
            SM2Service.update_item(self.db, req.question_id, is_correct, req.confidence_level)

        answers = session.answers
        session.answered_questions = len([a for a in answers if a.selected_option_ids])
        
        self.repo.update_session(session)
        return ExamSessionResponse.model_validate(session)

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
        return self.get_exam_details(session_id)
