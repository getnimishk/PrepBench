# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel

# How well a card was recalled, in the learner's words. Mapped to SM-2 quality in
# SpacedReviewService; the client never sends a number it could get wrong.
Grade = Literal["again", "hard", "good", "easy"]


class SpacedCard(BaseModel):
    """One due question, as a card: recall first, then reveal.

    `answer` and `explanation` travel with the card so the reveal is one round
    trip. The client must not render them before "Show answer" -- the point of
    the card is recall, and an answer on screen turns it into recognition.
    """
    question_id: int
    question_text: str
    domain: Optional[str] = None
    topic: Optional[str] = None
    is_multiple: bool
    answer: List[str]
    explanation: Optional[str] = None
    due_since: datetime
    repetition: int
    # The interval, in days, that each grade would set -- computed by the same
    # SM-2 step that grading runs, so the preview cannot disagree with the result.
    intervals: Dict[str, int]


class SpacedDeck(BaseModel):
    cards: List[SpacedCard]
    # Everything due for the scope, of which `cards` is the first slice.
    due_total: int


class SpacedGradeRequest(BaseModel):
    question_id: int
    grade: Grade


class SpacedGradeResult(BaseModel):
    question_id: int
    grade: Grade
    interval_days: int
    next_review_date: datetime
