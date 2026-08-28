# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.llm_config import LLMProviderConfig, LLMTaskBinding


class LLMConfigRepository:
    def __init__(self, db: Session):
        self.db = db

    # ---- Providers ---------------------------------------------------

    def get_provider(self, provider_id: int) -> Optional[LLMProviderConfig]:
        return self.db.query(LLMProviderConfig).filter(LLMProviderConfig.id == provider_id).first()

    def get_provider_by_name(self, name: str) -> Optional[LLMProviderConfig]:
        return self.db.query(LLMProviderConfig).filter(LLMProviderConfig.name == name).first()

    def list_providers(self, enabled_only: bool = False) -> List[LLMProviderConfig]:
        query = self.db.query(LLMProviderConfig)
        if enabled_only:
            query = query.filter(LLMProviderConfig.is_enabled.is_(True))
        # Stable ordering by id so "the first provider that can do X" resolves
        # to the same one across restarts rather than whatever the database
        # happens to return first.
        return query.order_by(LLMProviderConfig.id.asc()).all()

    def count_providers(self) -> int:
        return self.db.query(LLMProviderConfig).count()

    def create_provider(self, **fields) -> LLMProviderConfig:
        obj = LLMProviderConfig(**fields)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete_provider(self, provider_id: int) -> bool:
        obj = self.get_provider(provider_id)
        if not obj:
            return False
        # ORM delete rather than a bulk query delete, so SQLAlchemy emits a
        # single-row DELETE and SQLite applies the ON DELETE SET NULL on
        # llm_task_binding.provider_config_id.
        self.db.delete(obj)
        self.db.commit()
        return True

    def commit(self) -> None:
        """Persist in-place edits made by the service on a fetched row."""
        self.db.commit()

    # ---- Task bindings -----------------------------------------------

    def get_binding(self, task: str) -> Optional[LLMTaskBinding]:
        return self.db.query(LLMTaskBinding).filter(LLMTaskBinding.task == task).first()

    def list_bindings(self) -> List[LLMTaskBinding]:
        return self.db.query(LLMTaskBinding).order_by(LLMTaskBinding.task.asc()).all()

    def upsert_binding(self, task: str, provider_config_id: Optional[int], model: Optional[str]) -> LLMTaskBinding:
        existing = self.get_binding(task)
        if existing:
            existing.provider_config_id = provider_config_id
            existing.model = model
            self.db.commit()
            self.db.refresh(existing)
            return existing

        obj = LLMTaskBinding(task=task, provider_config_id=provider_config_id, model=model)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj
