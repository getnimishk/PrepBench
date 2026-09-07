# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Work in progress on a system-design prompt.

The answer page held its text in React state and nowhere else. No autosave, no
localStorage, no beforeunload guard: forty minutes of design work was one
stray click on the sidebar away from being gone, and nothing on the screen
suggested otherwise. The exam runner has warned before unloading since it was
written; the one surface in the product where a learner types for half an hour
had no protection at all.

Deliberately its own table rather than a `grading_status='draft'` attempt.
A draft is not an attempt: `list_attempts`, the analytics, Home's "other
preparation" count and the activity timeline all read SystemDesignAttempt, and
unsubmitted work must not appear in any of them as something that was done.

One row per prompt. Resuming means picking up the last thing you typed, not
choosing between six saved versions of it.
"""
from datetime import datetime, UTC

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def _now():
    return datetime.now(UTC).replace(tzinfo=None)


class SystemDesignDraft(Base):
    __tablename__ = "system_design_drafts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    prompt_id = Column(
        Integer, ForeignKey("system_design_prompts.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    answer_text = Column(Text, nullable=False, default="")
    target_role = Column(String(200), nullable=True)

    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    prompt = relationship("SystemDesignPrompt")
