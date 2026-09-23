# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
One attempt at one learning challenge.

The only persisted entity of the learning layer. Mastery, placement and
recommendations are all *derived from these on read* and never stored, so the
rules behind them can be revised without migrating anybody's history. That
design predates this table and is deliberately kept.

Why the table exists at all: this evidence lived in the browser, under
localStorage key `prepbench.learning.attempts.v1`, which made a browser the
system of record for the learner's own history -- one cleared cache and the
sandbox's entire record of what they had understood was gone. The client-side
module that owned it anticipated the move:

    "the storage boundary is deliberately thin so a later move to the backend
     touches this file and nothing else"

The columns below therefore mirror `frontend/src/types/learning.ts::Attempt`
field for field, so that move stays a swap of two functions rather than a
reshape of the model.
"""
from datetime import datetime, UTC

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Text
)
from app.core.database import Base


def _utc_now_naive():
    return datetime.now(UTC).replace(tzinfo=None)


class LearningAttempt(Base):
    __tablename__ = "learning_attempts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # The client's own id for this attempt, carried through rather than
    # reassigned. Two reasons, and the second is the important one:
    #
    #   1. an attempt started offline keeps its identity when it arrives
    #   2. it makes the write idempotent -- a retried POST updates the same
    #      row instead of recording a second attempt at the same challenge,
    #      which would quietly inflate every count derived from this table
    attempt_uid = Column(String(64), nullable=False, unique=True, index=True)

    # SET NULL rather than CASCADE, as everywhere else: deleting a preparation
    # must not delete the evidence of what was learned in it.
    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    challenge_id = Column(String(100), nullable=False, index=True)
    concept_id = Column(String(100), nullable=False, index=True)

    # Identifies the parameterisation, so transfer can be checked mechanically
    # rather than assumed from a repeated challenge id. Every parameter as
    # key=value, which is about 480 characters for today's model. It was 200,
    # which refused every real attempt; SQLite does not enforce VARCHAR lengths,
    # so widening it needs no data migration.
    scenario_fingerprint = Column(String(1000), nullable=False, default="")
    mode = Column(String(20), nullable=False, default="guided")

    started_at = Column(DateTime, nullable=False, default=_utc_now_naive)

    # Set once, then immutable. The service refuses to move either of these
    # after the fact, and so must any future writer: an amended prediction
    # after the outcome is visible is hindsight wearing a prediction's
    # clothes, and it would turn every accuracy number derived from this
    # table into a measure of nothing.
    committed_at = Column(DateTime, nullable=True)
    prediction = Column(String(100), nullable=True)

    completed_at = Column(DateTime, nullable=True)

    explanation_mechanisms = Column(JSON, nullable=False, default=list)
    selected_alternative_ids = Column(JSON, nullable=False, default=list)

    # Binary coverage of structured reasoning -- which parts of a defensible
    # answer the learner selected. Never a speech-quality score.
    rubric_coverage = Column(JSON, nullable=False, default=dict)

    # Both nullable on purpose. An uncommitted attempt has nothing to be right
    # or wrong about, and completeAttempt() already refuses to score one.
    # NULL says "not established"; False would invent a wrong answer.
    correct = Column(Boolean, nullable=True)
    transfer = Column(Boolean, nullable=True)

    hint_count = Column(Integer, nullable=False, default=0)
    duration_ms = Column(Integer, nullable=True)

    # The experiment, as it ran. `manipulation` is what was changed from the
    # baseline ({param: {from, to}}); `observed` is what the model then showed
    # ({outcome: {label, before, after}}). Both recorded only after a prediction
    # is committed, so "what happened" can never be written before "what I
    # expected". The comparison the learner sees is built from these values.
    manipulation = Column(JSON, nullable=True)
    observed = Column(JSON, nullable=True)

    # The learner's own account of why it moved, after seeing it. Their words,
    # never graded.
    explanation_text = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=_utc_now_naive)
    updated_at = Column(
        DateTime, nullable=False, default=_utc_now_naive, onupdate=_utc_now_naive
    )
