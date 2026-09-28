# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Wire shapes for roles, their requirements and the diagnostic (skills plan §8).

There is deliberately no readiness field on any of them. A role has no mocks,
so it has no readiness; the page says "Needs evaluation" and why, and a test
pins that no response grows one.
"""
from datetime import date, datetime
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Lens = Literal["po", "pm", "dm", "em"]
RequirementKind = Literal["mandatory", "preferred"]
Confidence = Literal["not-yet", "partly", "confident"]
# Stripped before the length check, so "   " is refused rather than stored blank.
RoleName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
RequirementText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class RoleRequirementIn(BaseModel):
    text: RequirementText
    kind: RequirementKind = "mandatory"
    # Only a link the learner confirmed; the parser's suggestions never reach here.
    subject_id: Optional[int] = None


class RoleRequirementResponse(BaseModel):
    id: int
    order_index: int
    text: str
    kind: RequirementKind
    subject_id: Optional[int] = None
    # The linked preparation's name, for display; None when unlinked.
    subject_name: Optional[str] = None


class RoleCreate(BaseModel):
    name: RoleName
    interview_date: Optional[date] = None
    job_description: str = Field(default="", max_length=50000)
    lens: Lens = "po"
    requirements: List[RoleRequirementIn] = Field(default_factory=list, max_length=200)


class RoleUpdate(BaseModel):
    name: Optional[RoleName] = None
    interview_date: Optional[date] = None
    job_description: Optional[str] = Field(default=None, max_length=50000)
    lens: Optional[Lens] = None
    is_archived: Optional[bool] = None


class RoleRequirementsReplace(BaseModel):
    requirements: List[RoleRequirementIn] = Field(max_length=200)


class RoleSummary(BaseModel):
    id: int
    name: str
    interview_date: Optional[date] = None
    lens: Lens
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    requirement_count: int
    linked_count: int
    diagnostic_count: int


class RoleResponse(BaseModel):
    id: int
    name: str
    interview_date: Optional[date] = None
    job_description: str
    lens: Lens
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    requirements: List[RoleRequirementResponse]
    diagnostic_count: int


class DiagnosticItem(BaseModel):
    # "<pack>@<version>/diagnostic/<id>" or "<pack>@<version>/scenario/<id>/lens/<role>"
    question_ref: str = Field(min_length=1, max_length=200)
    answer: str = Field(default="", max_length=5000)
    covered: List[int] = Field(default_factory=list)
    confidence: Confidence
    # Chosen for one of the job's requirements, or a core topic. Never "matched".
    fits_requirement: bool = False

    model_config = ConfigDict(extra="forbid")


class DiagnosticCreate(BaseModel):
    lens: Lens
    items: List[DiagnosticItem] = Field(min_length=1, max_length=20)


class DiagnosticResponse(BaseModel):
    id: int
    role_id: int
    taken_at: datetime
    lens: Lens
    items: List[DiagnosticItem]

    model_config = ConfigDict(from_attributes=True)
