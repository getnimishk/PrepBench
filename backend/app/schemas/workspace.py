# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Workspace: the learner's own work, read from the rows the features already keep."""
from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel

WorkspaceKind = Literal[
    "lab_run",               # ADF Behaviour Lab: one run's prediction, levers, observation, explanation
    "lakehouse_challenge",   # Lakehouse Lab: a challenge with a committed prediction
    "scenario_notes",        # Scenario lens: case notes and the Say-it answer
    "interview_answer",      # An interview question with the learner's prepared answer
    "recording",             # A practice recording
    "topic_guide",           # A roadmap topic's guide sections
    "topic_note",            # A roadmap topic's notes
    "system_design_answer",  # System design answer or saved draft (no preparation only)
    "design_review_call",    # Design review choice and justification (no preparation only)
    "sandbox_run",           # Chart Sandbox run (no preparation only)
]
WorkspaceSource = Literal["learning_lab", "scenarios", "interview", "roadmap"]


class WorkspaceItem(BaseModel):
    id: str
    kind: WorkspaceKind
    source: WorkspaceSource
    title: str
    # Where it sits: "Run 2", the roadmap's title, the question asked.
    context: Optional[str] = None
    # The start of the learner's own words, when there are any.
    excerpt: Optional[str] = None
    # One line of status, from the row: "3 of 4 stages finished".
    detail: Optional[str] = None
    # Where to continue it.
    href: str
    # When it last changed, from the row. Null when the row records no time.
    updated_at: Optional[datetime] = None
    # The identifiers a client needs to name it from its own registries (track, run, challenge_id).
    ref: Dict[str, str] = {}


class WorkspaceResponse(BaseModel):
    # The scope answered: a preparation, or null for work that belongs to none.
    subject_id: Optional[int] = None
    items: List[WorkspaceItem]
