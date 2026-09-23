# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.question_repository import QuestionRepository
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionFilter, QuestionResponse
from app.core.exceptions import ResourceNotFoundException

class QuestionService:
    def __init__(self, db: Session):
        self.repo = QuestionRepository(db)

    def get_question(self, question_id: int) -> QuestionResponse:
        q = self.repo.get_by_id(question_id)
        if not q:
            raise ResourceNotFoundException("Question", question_id)
        return QuestionResponse.model_validate(q)

    def get_filters(self, subject_id: Optional[int] = None) -> dict:
        return self.repo.get_distinct_filters(subject_id)

    def list_questions(
        self,
        skip: int = 0,
        limit: int = 100,
        filter_params: Optional[QuestionFilter] = None,
        include_evidence: bool = False,
    ):
        questions = self.repo.get_all(skip=skip, limit=limit, filter_params=filter_params)
        total = self.repo.count(filter_params=filter_params)
        if include_evidence:
            # One page's worth: two grouped queries, whatever the page size.
            from app.services.question_evidence import evidence_for
            from app.schemas.question import QuestionEvidence, QuestionWithEvidence
            evidence = evidence_for(self.repo.db, [q.id for q in questions])
            items = [
                QuestionWithEvidence(
                    **QuestionResponse.model_validate(q).model_dump(),
                    evidence=QuestionEvidence(
                        answered=evidence[q.id].answered,
                        correct=evidence[q.id].correct,
                        missed=evidence[q.id].missed,
                        due=evidence[q.id].due,
                    ),
                )
                for q in questions
            ]
        else:
            items = [QuestionResponse.model_validate(q) for q in questions]
        return {
            "items": items,
            "total": total,
            "skip": skip,
            "limit": limit
        }

    def create_question(self, obj_in: QuestionCreate) -> QuestionResponse:
        q = self.repo.create(obj_in)
        return QuestionResponse.model_validate(q)

    def update_question(self, question_id: int, obj_in: QuestionUpdate) -> QuestionResponse:
        q = self.repo.update(question_id, obj_in)
        if not q:
            raise ResourceNotFoundException("Question", question_id)
        return QuestionResponse.model_validate(q)

    def delete_question(self, question_id: int) -> bool:
        success = self.repo.delete(question_id)
        if not success:
            raise ResourceNotFoundException("Question", question_id)
        return True

    def clear_all_questions(self) -> int:
        return self.repo.clear_all()

    def bulk_delete_questions(self, ids: List[int]) -> int:
        return self.repo.bulk_delete(ids)
