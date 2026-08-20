from typing import Optional
from datetime import datetime, UTC
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
    InterviewQuestionUpdate,
    GenerateInterviewQuestionRequest,
    RoundTypeInfo,
)

ROUND_TYPE_LABELS = {
    InterviewRoundType.HR_SCREENING: "HR Screening",
    InterviewRoundType.HIRING_MANAGER: "Hiring Manager",
    InterviewRoundType.SYSTEM_DESIGN: "System Design",
    InterviewRoundType.BEHAVIORAL: "Behavioral",
}


class InterviewQuestionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InterviewQuestionRepository(db)
        self.gateway = LLMGateway(db)

    def list_questions(self, skip: int = 0, limit: int = 100, filter_params: Optional[InterviewQuestionFilter] = None) -> dict:
        items = self.repo.get_all(skip=skip, limit=limit, filter_params=filter_params)
        total = self.repo.count(filter_params=filter_params)
        return {
            "items": [InterviewQuestionResponse.model_validate(q) for q in items],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    def get_question(self, question_id: int) -> InterviewQuestionResponse:
        q = self.repo.get_by_id(question_id)
        if not q:
            raise ResourceNotFoundException("InterviewQuestion", question_id)
        return InterviewQuestionResponse.model_validate(q)

    def update_question(self, question_id: int, req: InterviewQuestionUpdate) -> InterviewQuestionResponse:
        updated = self.repo.update(question_id, req)
        if not updated:
            raise ResourceNotFoundException("InterviewQuestion", question_id)
        return InterviewQuestionResponse.model_validate(updated)

    def delete_question(self, question_id: int) -> None:
        deleted = self.repo.delete(question_id)
        if not deleted:
            raise ResourceNotFoundException("InterviewQuestion", question_id)

    def list_round_types(self) -> list:
        return [RoundTypeInfo(value=rt.value, label=ROUND_TYPE_LABELS[rt]) for rt in InterviewRoundType]

    def get_distinct_categories(self, round_type: Optional[str] = None) -> list:
        return self.repo.get_distinct_categories(round_type=round_type)

    def generate_question(self, req: GenerateInterviewQuestionRequest) -> InterviewQuestionResponse:
        """Mirrors SystemDesignService.generate_prompt's no-fabrication contract:
        no API key -> a clear error, never a silently-substituted bank question."""
        if not self.gateway.is_available(LLMTask.INTERVIEW_QUESTION_GEN):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI question generation is unavailable: no GEMINI_API_KEY configured. "
                       "Browse the built-in question bank instead, or configure an API key to enable generation.",
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
        topic_clause = f' focused on the topic/theme "{topic}"' if topic else ""

        round_guidance = {
            InterviewRoundType.HR_SCREENING: "a recruiter/HR screening call -- covering motivation, fit, logistics, or background, not technical depth",
            InterviewRoundType.HIRING_MANAGER: "a hiring manager round -- covering leadership, ownership, prioritization, or team fit",
            InterviewRoundType.SYSTEM_DESIGN: "a spoken/verbal system design round -- a realistic system design scenario suitable for a short spoken walkthrough",
            InterviewRoundType.BEHAVIORAL: "a behavioral round -- a 'tell me about a time...' style question suitable for a STAR-format answer",
        }[round_type]

        return f"""Generate one realistic interview question for {round_guidance}{topic_clause}.
This is for the "{round_label}" round of a job interview.

Respond ONLY in this exact JSON format, no other text:
{{
  "question_text": "<the interview question itself, phrased naturally as an interviewer would ask it>",
  "category": "<short category label, e.g. 'Leadership', 'Motivation & Fit', 'Conflict Resolution'>"
}}
"""
