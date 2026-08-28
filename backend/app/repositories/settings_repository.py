# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Optional

from sqlalchemy.orm import Session

from app.core.database import Base
from app.models.settings import AppSettings

# The settings row is a singleton; everything addresses it by this id.
SETTINGS_ID = 1


class SettingsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self) -> Optional[AppSettings]:
        return self.db.query(AppSettings).filter(AppSettings.id == SETTINGS_ID).first()

    def get_or_create(self) -> AppSettings:
        """
        The settings row on a fresh install, created from column defaults.

        Nothing is passed but the id, so the defaults declared on the model stay
        the single source of truth for what "default" means -- the same values a
        reset restores.
        """
        existing = self.get()
        if existing:
            return existing

        created = AppSettings(id=SETTINGS_ID)
        self.db.add(created)
        self.db.commit()
        self.db.refresh(created)
        return created

    def update(self, fields: dict) -> AppSettings:
        settings = self.get()
        if not settings:
            settings = AppSettings(id=SETTINGS_ID)
            self.db.add(settings)

        for field, value in fields.items():
            setattr(settings, field, value)

        self.db.commit()
        self.db.refresh(settings)
        return settings

    def delete_all_rows(self) -> None:
        """
        Empty every table in the schema.

        Driven from the mapper metadata rather than a hand-written list, because
        the hand-written list is what went stale: it covered seven tables while
        the schema grew to nineteen, and a reset silently kept recordings,
        roadmaps and the configured AI provider. A new model now joins this
        automatically.

        sorted_tables orders parents before children, so deletion walks it
        backwards -- children first -- and never trips a foreign key with
        SQLite's foreign_keys pragma on.
        """
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()
