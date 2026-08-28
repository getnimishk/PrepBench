# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.interview_question import InterviewQuestion
from app.schemas.interview_question import InterviewQuestionCreate, InterviewQuestionFilter, InterviewQuestionUpdate


class InterviewQuestionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, question_id: int) -> Optional[InterviewQuestion]:
        return self.db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id).first()

    def _apply_filters(self, query, filter_params: Optional[InterviewQuestionFilter]):
        if not filter_params:
            return query
        if filter_params.round_type:
            query = query.filter(InterviewQuestion.round_type == filter_params.round_type)
        if filter_params.category:
            query = query.filter(InterviewQuestion.category == filter_params.category)
        if filter_params.keyword:
            kw = f"%{filter_params.keyword}%"
            query = query.filter(or_(
                InterviewQuestion.question_text.ilike(kw),
                InterviewQuestion.category.ilike(kw),
            ))
        return query

    def get_all(self, skip: int = 0, limit: int = 100, filter_params: Optional[InterviewQuestionFilter] = None) -> List[InterviewQuestion]:
        query = self._apply_filters(self.db.query(InterviewQuestion), filter_params)
        return query.order_by(InterviewQuestion.id.desc()).offset(skip).limit(limit).all()

    def count(self, filter_params: Optional[InterviewQuestionFilter] = None) -> int:
        query = self._apply_filters(self.db.query(func.count(InterviewQuestion.id)), filter_params)
        return query.scalar() or 0

    def create(self, obj_in: InterviewQuestionCreate) -> InterviewQuestion:
        db_obj = InterviewQuestion(
            round_type=obj_in.round_type,
            question_text=obj_in.question_text,
            category=obj_in.category,
            is_ai_generated=obj_in.is_ai_generated,
            source_topic=obj_in.source_topic,
        )
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def update(self, question_id: int, obj_in: InterviewQuestionUpdate) -> Optional[InterviewQuestion]:
        db_obj = self.get_by_id(question_id)
        if not db_obj:
            return None
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, question_id: int) -> bool:
        db_obj = self.get_by_id(question_id)
        if not db_obj:
            return False
        self.db.delete(db_obj)
        self.db.commit()
        return True

    def get_distinct_categories(self, round_type: Optional[str] = None) -> List[str]:
        query = self.db.query(InterviewQuestion.category)
        if round_type:
            query = query.filter(InterviewQuestion.round_type == round_type)
        rows = query.distinct().all()
        return sorted({r[0] for r in rows if r[0]})
