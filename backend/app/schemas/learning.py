# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Wire shapes for learning attempts.

Field names are the snake_case of `frontend/src/types/learning.ts::Attempt`, so
the client's existing objects map across by case conversion alone rather than by
a translation layer nobody would keep in step.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class LearningAttemptCreate(BaseModel):
    """Opening an attempt. Deliberately cannot carry a result.

    No `prediction`, no `correct`, no `completed_at`. An attempt is created when
    it starts and its outcome arrives later through PATCH, which is what makes
    the ordering -- predict, then see -- something the server enforces rather
    than something the client is trusted to have done.
    """

    attempt_uid: str = Field(min_length=8, max_length=64)
    challenge_id: str = Field(min_length=1, max_length=100)
    concept_id: str = Field(min_length=1, max_length=100)
    scenario_fingerprint: str = Field(default="", max_length=1000)
    mode: str = Field(default="guided", max_length=20)
    subject_id: Optional[int] = None
    started_at: Optional[datetime] = None
    hint_count: int = Field(default=0, ge=0)


class LearningAttemptUpdate(BaseModel):
    """Every field optional, and every one of them write-once or additive.

    The service rejects a second `prediction` and a second `completed_at`
    outright rather than merging them. See LearningService for why that refusal
    is the whole value of the table.
    """

    prediction: Optional[str] = Field(default=None, max_length=100)
    completed: Optional[bool] = None
    correct: Optional[bool] = None
    transfer: Optional[bool] = None
    hint_count: Optional[int] = Field(default=None, ge=0)
    duration_ms: Optional[int] = Field(default=None, ge=0)
    explanation_mechanisms: Optional[List[str]] = None
    selected_alternative_ids: Optional[List[str]] = None
    rubric_coverage: Optional[Dict[str, bool]] = None
    subject_id: Optional[int] = None

    # The experiment and the explanation. See LearningAttempt for the rules.
    manipulation: Optional[Dict[str, Any]] = None
    observed: Optional[Dict[str, Any]] = None
    explanation_text: Optional[str] = Field(default=None, max_length=4000)

    # When the transitions really happened, for history recorded in the browser
    # before it was kept here. Bounded by the service: never in the future, never
    # before the attempt started. Omitted, the server's clock is used.
    committed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class LearningAttemptResponse(BaseModel):
    id: int
    attempt_uid: str
    subject_id: Optional[int] = None
    challenge_id: str
    concept_id: str
    scenario_fingerprint: str
    mode: str

    started_at: datetime
    committed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    prediction: Optional[str] = None
    explanation_mechanisms: List[str] = []
    selected_alternative_ids: List[str] = []
    rubric_coverage: Dict[str, bool] = {}

    # Null, not false, where nothing has been established. An uncommitted
    # attempt has no correctness to report and `false` would read as a wrong
    # answer nobody gave.
    correct: Optional[bool] = None
    transfer: Optional[bool] = None

    hint_count: int = 0
    duration_ms: Optional[int] = None

    manipulation: Optional[Dict[str, Any]] = None
    observed: Optional[Dict[str, Any]] = None
    explanation_text: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
