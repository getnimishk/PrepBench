# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Evidence: what the persisted record shows the learner has demonstrated, and how strongly."""
from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel

# activity < completed < demonstrated < evidenced. See docs/implementation/PHASE-6-CONTRACT.md §5.
EvidenceLevel = Literal["activity", "completed", "demonstrated", "evidenced"]
# Who judged it. Only model, answer_key and exam can make something demonstrated.
AssessedBy = Literal["model", "answer_key", "exam", "self", "ai", "not_assessed"]
EvidenceSource = Literal["learning_lab", "scenarios", "roadmap", "certification", "interview"]
EvidenceKind = Literal[
    "lab_stage", "lakehouse_challenge", "scenario_check", "scenario_lens", "sandbox_prediction",
    "learning_attempt", "topic_demonstration", "mock_exam", "recording", "system_design", "design_review",
]


class EvidenceItem(BaseModel):
    id: str
    source: EvidenceSource
    kind: EvidenceKind
    level: EvidenceLevel
    assessed_by: AssessedBy
    title: str
    # What it is evidence of: the experiment stage, the scenario check, the topic.
    demonstrates: Optional[str] = None
    # Exactly what in the record supports the level, in plain words.
    basis: str
    href: str
    # When it happened, from the row. Null when the row records no time.
    at: Optional[datetime] = None
    ref: Dict[str, str] = {}


class EvidenceCounts(BaseModel):
    activity: int = 0
    completed: int = 0
    demonstrated: int = 0
    evidenced: int = 0


class EvidenceResponse(BaseModel):
    # The scope answered: a preparation, or null for work that belongs to none.
    subject_id: Optional[int] = None
    counts: EvidenceCounts
    items: List[EvidenceItem]
