# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Iterable, Set
from sqlalchemy.orm import Session
from app.models.seeded_content import SeededContent


class SeededContentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_keys(self, namespace: str) -> Set[str]:
        """Every key recorded under a namespace, as one query."""
        rows = (
            self.db.query(SeededContent.content_key)
            .filter(SeededContent.namespace == namespace)
            .all()
        )
        return {r[0] for r in rows if r[0]}

    def mark_seeded(self, namespace: str, keys: Iterable[str]) -> int:
        """Record keys as offered, skipping any already recorded.

        Deduplicated and filtered against what is already stored rather than
        relying on the unique constraint to reject them, because a constraint
        violation would abort the whole transaction and take an otherwise
        successful seeding run down with it.
        """
        candidates = list(dict.fromkeys(keys))
        if not candidates:
            return 0

        existing = self.get_keys(namespace)
        new_keys = [k for k in candidates if k not in existing]
        if not new_keys:
            return 0

        self.db.add_all([
            SeededContent(namespace=namespace, content_key=k) for k in new_keys
        ])
        self.db.commit()
        return len(new_keys)
