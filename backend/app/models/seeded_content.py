# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint
from app.core.database import Base


class SeededContent(Base):
    """A record that a built-in item has been offered to this install.

    Kept apart from the content itself, because the question it answers --
    "has this install ever been given this built-in?" -- has to survive the
    user deleting the row. Without somewhere to keep that answer, a seeder has
    only two options and both are wrong: seed once and never again, so content
    added by a later version never arrives; or match against the bank's current
    contents, so anything the user deletes reappears at the next restart and
    deleting a built-in becomes impossible.
    """
    __tablename__ = "seeded_content"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Which built-in list the key belongs to, so two lists can use the same
    # natural key without colliding.
    namespace = Column(String(50), nullable=False, index=True)

    # The item's identity within its list -- a prompt title, a question's round
    # and text. Deliberately the readable value rather than a hash, so the
    # ledger can be inspected directly when a built-in is missing and nobody
    # can work out why.
    content_key = Column(Text, nullable=False)

    seeded_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    __table_args__ = (
        UniqueConstraint("namespace", "content_key", name="uq_seeded_content_namespace_key"),
    )
