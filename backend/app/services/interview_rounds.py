# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
What each interview round asks of an answer, in one place.

The rubric categories are the ones the analysis provider grades against
(recording_analysis_providers.CONTENT_CATEGORIES_BY_ROUND) and are read from there
rather than restated. The rest is guidance shown to the learner before and while
answering: how long a good answer runs, how long to think first, a shape to plan
with, and what the interviewer is listening for. None of it is a score.
"""
from typing import Dict, Tuple, TypedDict

from app.services.recording_analysis_providers import CONTENT_CATEGORIES_BY_ROUND


class RoundRule(TypedDict):
    target_seconds: Tuple[int, int]
    thinking_seconds: int
    plan_prompt: str
    listening_for: str


ROUND_RULES: Dict[str, RoundRule] = {
    "hr_screening": {
        "target_seconds": (45, 105),
        "thinking_seconds": 20,
        "plan_prompt": "Where you are now → why this role → what you want next",
        "listening_for": (
            "A recruiter is checking three things: that your history makes sense, that you "
            "want this role, and that you can be brief. Answer what was asked, in under two "
            "minutes, without walking the whole CV."
        ),
    },
    "hiring_manager": {
        "target_seconds": (90, 180),
        "thinking_seconds": 45,
        "plan_prompt": "Situation → what you owned → what you decided → what changed",
        "listening_for": (
            "Your future manager is listening for what you decided, not what the team did. "
            "Name the call you made, what you gave up to make it, and what changed as a result."
        ),
    },
    "behavioral": {
        "target_seconds": (90, 180),
        "thinking_seconds": 45,
        "plan_prompt": "Situation → task → action → result",
        "listening_for": (
            "Set the situation in two sentences, spend most of the answer on what you actually "
            "did, and land on a result with a number in it. A story with no outcome reads as an "
            "anecdote, not evidence."
        ),
    },
    "system_design": {
        "target_seconds": (180, 420),
        "thinking_seconds": 60,
        "plan_prompt": "Requirements → rough shape → data → bottleneck → trade-off",
        "listening_for": (
            "Clarify scale, read/write mix and consistency before drawing anything. Then the "
            "rough shape, then where it breaks first. Naming the bottleneck earns more than "
            "adding another box."
        ),
    },
}


def rule_for(round_type: str) -> RoundRule:
    return ROUND_RULES.get(round_type, ROUND_RULES["behavioral"])


def content_categories_for(round_type: str) -> list:
    return list(CONTENT_CATEGORIES_BY_ROUND.get(round_type, CONTENT_CATEGORIES_BY_ROUND["behavioral"]))
