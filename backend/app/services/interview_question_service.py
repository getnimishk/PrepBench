# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Optional
from datetime import datetime, UTC
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.exceptions import ResourceNotFoundException
from app.core.logging_config import logger
from app.llm.gateway import LLMGateway
from app.llm.types import LLMTask
from app.repositories.interview_question_repository import InterviewQuestionRepository
from app.models.interview_question import InterviewRoundType
from app.schemas.interview_question import (
    InterviewQuestionCreate,
    InterviewQuestionFilter,
    InterviewQuestionResponse,
    InterviewQuestionSourceSave,
    InterviewQuestionSourceSaveResult,
    InterviewQuestionUpdate,
    GenerateInterviewQuestionRequest,
    RoundTypeInfo,
)
from app.llm.prompts import as_material

def practice_counts(db, question_ids=None) -> dict:
    """{question_id: (takes recorded, when last taken)} for these questions.

    One grouped query, used by the library's "answered N times" and by a session's
    least-practised-first order, so the two can never disagree about what is new.
    """
    from sqlalchemy import func

    from app.models.practice_recording import PracticeRecording

    query = (
        db.query(
            PracticeRecording.interview_question_id,
            func.count(PracticeRecording.id),
            func.max(PracticeRecording.created_at),
        )
        .filter(PracticeRecording.interview_question_id.isnot(None))
    )
    if question_ids is not None:
        if not question_ids:
            return {}
        query = query.filter(PracticeRecording.interview_question_id.in_(question_ids))
    rows = query.group_by(PracticeRecording.interview_question_id).all()
    return {qid: (int(n or 0), last) for qid, n, last in rows}


ROUND_TYPE_LABELS = {
    InterviewRoundType.HR_SCREENING: "HR Screening",
    InterviewRoundType.HIRING_MANAGER: "Hiring Manager",
    InterviewRoundType.SYSTEM_DESIGN: "System Design",
    InterviewRoundType.BEHAVIORAL: "Behavioral",
    InterviewRoundType.TECHNICAL: "Technical",
}


class InterviewQuestionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InterviewQuestionRepository(db)
        self.gateway = LLMGateway(db)

    def list_questions(self, skip: int = 0, limit: int = 100, filter_params: Optional[InterviewQuestionFilter] = None) -> dict:
        items = self.repo.get_all(skip=skip, limit=limit, filter_params=filter_params)
        total = self.repo.count(filter_params=filter_params)
        counts = practice_counts(self.db, [q.id for q in items])
        return {
            "items": [
                InterviewQuestionResponse.model_validate(q).model_copy(
                    update={"practice_count": counts.get(q.id, (0, None))[0]}
                )
                for q in items
            ],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    def _in_scope(self, question_id: int, subject_id: Optional[int]):
        """The question this scope may reach, or the same 404 as an unknown id.

        A named preparation that does not exist is refused, rather than read as "no
        preparation" -- which would quietly widen nothing, but would hide a wrong id."""
        from app.models.subject import Subject

        if subject_id is not None and self.db.get(Subject, subject_id) is None:
            raise ResourceNotFoundException("Subject", subject_id)
        q = self.repo.get_in_scope(question_id, subject_id)
        if q is None:
            raise ResourceNotFoundException("InterviewQuestion", question_id)
        return q

    def get_question(self, question_id: int, subject_id: Optional[int] = None) -> InterviewQuestionResponse:
        return InterviewQuestionResponse.model_validate(self._in_scope(question_id, subject_id))

    def save_from_source(self, req: InterviewQuestionSourceSave) -> InterviewQuestionSourceSaveResult:
        """Create the question for this source and preparation, or update the one saved before.

        The text, prepared answer, talking points, round and preparation are
        the source's and are replaced on every save. The category is only set
        when the row is created: after that it is the learner's to change in
        the library, and a re-save shouldn't undo it.
        """
        from app.models.interview_question import InterviewQuestion
        from app.models.subject import Subject

        if req.subject_id is not None and self.db.get(Subject, req.subject_id) is None:
            raise ResourceNotFoundException("Subject", req.subject_id)

        def write(question) -> None:
            question.round_type = req.round_type
            question.question_text = req.question_text
            question.prepared_answer = req.prepared_answer
            question.key_talking_points = req.key_talking_points
            self.db.commit()
            self.db.refresh(question)

        question = self.repo.get_by_source(req.source_ref, req.subject_id)
        created = question is None
        if created:
            question = InterviewQuestion(
                source_ref=req.source_ref,
                subject_id=req.subject_id,
                category=req.category,
                is_ai_generated=False,
            )
            self.db.add(question)
        try:
            write(question)
        except IntegrityError:
            # Two first saves of the same source arrived together and the other
            # insert won. Still one question: update the row that exists.
            self.db.rollback()
            question = self.repo.get_by_source(req.source_ref, req.subject_id)
            if question is None:
                raise
            created = False
            write(question)

        taken = practice_counts(self.db, [question.id]).get(question.id, (0, None))[0]
        return InterviewQuestionSourceSaveResult(
            question=InterviewQuestionResponse.model_validate(question).model_copy(
                update={"practice_count": taken}
            ),
            created=created,
        )

    def update_question(
        self, question_id: int, req: InterviewQuestionUpdate, subject_id: Optional[int] = None,
    ) -> InterviewQuestionResponse:
        self._in_scope(question_id, subject_id)
        updated = self.repo.update(question_id, req)
        if not updated:
            raise ResourceNotFoundException("InterviewQuestion", question_id)
        return InterviewQuestionResponse.model_validate(updated)

    def delete_question(self, question_id: int, subject_id: Optional[int] = None) -> None:
        self._in_scope(question_id, subject_id)
        deleted = self.repo.delete(question_id)
        if not deleted:
            raise ResourceNotFoundException("InterviewQuestion", question_id)

    def list_round_types(self) -> list:
        from app.services.interview_rounds import content_categories_for, rule_for

        out = []
        for rt in InterviewRoundType:
            rule = rule_for(rt.value)
            out.append(RoundTypeInfo(
                value=rt.value,
                label=ROUND_TYPE_LABELS[rt],
                target_min_seconds=rule["target_seconds"][0],
                target_max_seconds=rule["target_seconds"][1],
                thinking_seconds=rule["thinking_seconds"],
                plan_prompt=rule["plan_prompt"],
                listening_for=rule["listening_for"],
                content_categories=content_categories_for(rt.value),
            ))
        return out

    def get_distinct_categories(self, round_type: Optional[str] = None) -> list:
        return self.repo.get_distinct_categories(round_type=round_type)

    def generate_question(self, req: GenerateInterviewQuestionRequest) -> InterviewQuestionResponse:
        """Mirrors SystemDesignService.generate_prompt's no-fabrication contract:
        no API key -> a clear error, never a silently-substituted bank question."""
        if not self.gateway.is_available(LLMTask.INTERVIEW_QUESTION_GEN):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No AI provider is set up yet. Add one in Settings -> AI Providers "
                       "-- a local model is free and keeps your answers on this machine. "
                       "Meanwhile, the built-in question bank works without any AI.",
            )

        prompt = self._build_generation_prompt(req.round_type, req.topic)
        parsed, error_msg = self.gateway.run(LLMTask.INTERVIEW_QUESTION_GEN, prompt).as_tuple()

        if not parsed or error_msg:
            logger.warning(f"Interview question generation failed: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI question generation failed: {error_msg}",
            )

        question_text = str(parsed.get("question_text") or "")
        category = parsed.get("category")

        if not question_text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI question generation returned an empty question_text.",
            )

        if req.save_to_bank:
            created = self.repo.create(InterviewQuestionCreate(
                round_type=req.round_type,
                question_text=question_text,
                category=category,
                is_ai_generated=True,
                source_topic=req.topic,
            ))
            return InterviewQuestionResponse.model_validate(created)

        # Not persisted -- ephemeral response, id=0 sentinel (same convention
        # as SystemDesignService.generate_prompt).
        return InterviewQuestionResponse(
            id=0,
            round_type=req.round_type,
            question_text=question_text,
            category=category,
            is_ai_generated=True,
            created_at=datetime.now(UTC).replace(tzinfo=None),
        )

    def _build_generation_prompt(self, round_type: InterviewRoundType, topic: Optional[str]) -> str:
        round_label = ROUND_TYPE_LABELS[round_type]
        topic_clause = f" focused on the topic/theme below" if topic else ""
        topic_block = f"\n\n{as_material('topic', topic, 'the learner')}" if topic else ""

        round_guidance = {
            InterviewRoundType.HR_SCREENING: "a recruiter/HR screening call -- covering motivation, fit, logistics, or background, not technical depth",
            InterviewRoundType.HIRING_MANAGER: "a hiring manager round -- covering leadership, ownership, prioritization, or team fit",
            InterviewRoundType.SYSTEM_DESIGN: "a spoken/verbal system design round -- a realistic system design scenario suitable for a short spoken walkthrough",
            InterviewRoundType.BEHAVIORAL: "a behavioral round -- a 'tell me about a time...' style question suitable for a STAR-format answer",
            InterviewRoundType.TECHNICAL: "a technical round -- how a specific technology works, where it breaks, and what the candidate would do about it, answerable without a personal story",
        }[round_type]

        return f"""Generate one realistic interview question for {round_guidance}{topic_clause}.
This is for the "{round_label}" round of a job interview.{topic_block}

Respond ONLY in this exact JSON format, no other text:
{{
  "question_text": "<the interview question itself, phrased naturally as an interviewer would ask it>",
  "category": "<short category label, e.g. 'Leadership', 'Motivation & Fit', 'Conflict Resolution'>"
}}
"""
