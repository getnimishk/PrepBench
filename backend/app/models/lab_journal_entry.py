# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The Lakehouse Lab journal (design §4.6, PRD P0-10): what the learner actually
did, each entry labelled with where its result came from.

Its own table, not `learning_attempts`: an engine operation isn't a learning
attempt, and every mastery figure is derived from that table. An entry can point
at an attempt through `attempt_uid`.

Append-only. The API has no PUT or PATCH; an entry can be deleted by the learner,
never edited. `source='real_engine'` rows are written only by the server, inside
the operation handler -- a client can't claim a run that didn't happen.
"""
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, Integer, JSON, String

from app.core.database import Base


def _utc_now_naive():
    return datetime.now(UTC).replace(tzinfo=None)


class LabJournalEntry(Base):
    __tablename__ = "lab_journal_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entry_uid = Column(String(64), nullable=False, unique=True, index=True)
    pack_id = Column(String(100), nullable=False, index=True)
    station = Column(String(10), nullable=False)
    source = Column(String(20), nullable=False)  # 'real_engine' | 'simulation', never null
    op = Column(String(50), nullable=False)
    table_name = Column(String(200), nullable=True)
    result = Column(JSON, nullable=False, default=dict)
    attempt_uid = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utc_now_naive, index=True)
