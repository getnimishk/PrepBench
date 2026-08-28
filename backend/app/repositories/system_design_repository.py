# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from app.models.system_design_prompt import SystemDesignPrompt
from app.models.system_design_attempt import SystemDesignAttempt
from app.schemas.system_design import SystemDesignPromptCreate, SystemDesignPromptFilter


class SystemDesignPromptRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, prompt_id: int) -> Optional[SystemDesignPrompt]:
        return self.db.query(SystemDesignPrompt).filter(SystemDesignPrompt.id == prompt_id).first()

    def _apply_filters(self, query, filter_params: Optional[SystemDesignPromptFilter]):
        if not filter_params:
            return query
        if filter_params.category:
            query = query.filter(SystemDesignPrompt.category == filter_params.category)
        if filter_params.difficulty:
            query = query.filter(SystemDesignPrompt.difficulty == filter_params.difficulty)
        if filter_params.keyword:
            kw = f"%{filter_params.keyword}%"
            query = query.filter(or_(
                SystemDesignPrompt.title.ilike(kw),
                SystemDesignPrompt.prompt_text.ilike(kw),
                SystemDesignPrompt.category.ilike(kw),
            ))
        return query

    def get_all(self, skip: int = 0, limit: int = 100, filter_params: Optional[SystemDesignPromptFilter] = None) -> List[SystemDesignPrompt]:
        query = self._apply_filters(self.db.query(SystemDesignPrompt), filter_params)
        return query.order_by(SystemDesignPrompt.id.desc()).offset(skip).limit(limit).all()

    def count(self, filter_params: Optional[SystemDesignPromptFilter] = None) -> int:
        query = self._apply_filters(self.db.query(func.count(SystemDesignPrompt.id)), filter_params)
        return query.scalar() or 0

    def create(self, obj_in: SystemDesignPromptCreate) -> SystemDesignPrompt:
        db_obj = SystemDesignPrompt(
            title=obj_in.title,
            prompt_text=obj_in.prompt_text,
            category=obj_in.category,
            difficulty=obj_in.difficulty,
            is_ai_generated=obj_in.is_ai_generated,
            source_topic=obj_in.source_topic,
        )
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def get_distinct_categories(self) -> List[str]:
        rows = self.db.query(SystemDesignPrompt.category).distinct().all()
        return sorted({r[0] for r in rows if r[0]})


class SystemDesignAttemptRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, attempt: SystemDesignAttempt) -> SystemDesignAttempt:
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def get_by_id(self, attempt_id: int) -> Optional[SystemDesignAttempt]:
        return self.db.query(SystemDesignAttempt).filter(SystemDesignAttempt.id == attempt_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[SystemDesignAttempt]:
        return (
            self.db.query(SystemDesignAttempt)
            .order_by(SystemDesignAttempt.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count(self) -> int:
        return self.db.query(func.count(SystemDesignAttempt.id)).scalar() or 0

    def get_graded_ordered_by_date(self) -> List[SystemDesignAttempt]:
        """Chronological (oldest-first) list of graded attempts, prompt eager-loaded
        so analytics can read the prompt title without an N+1 query per attempt."""
        return (
            self.db.query(SystemDesignAttempt)
            .options(joinedload(SystemDesignAttempt.prompt))
            .filter(SystemDesignAttempt.grading_status == "graded")
            .order_by(SystemDesignAttempt.created_at.asc())
            .all()
        )
