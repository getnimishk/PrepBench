# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Read and write shapes for built-in content packs and their subject links."""
from typing import List, Optional

from pydantic import BaseModel, Field

from app.content.packs import Chapter, DiagnosticQuestion, ScenarioLevel


class ContentPackSummary(BaseModel):
    """One row of `GET /content-packs`: enough to offer a pack, not read it."""

    pack_id: str
    latest_version: int
    title: str
    summary: str
    chapter_count: int
    scenario_count: int
    written_scenario_count: int


class ContentPackDetail(BaseModel):
    """The full pack, `GET /content-packs/{pack_id}`."""

    pack_id: str
    version: int
    title: str
    summary: str
    docs_url: str
    source_notes: str
    chapters: List[Chapter]
    scenario_levels: List[ScenarioLevel]
    diagnostic_questions: List[DiagnosticQuestion]


class ContentPackAttachRequest(BaseModel):
    pack_id: str = Field(min_length=1)


class ContentPackUpgradeRequest(BaseModel):
    version: int = Field(ge=1)


class SubjectContentPackResponse(BaseModel):
    """A pack as attached to one subject: the pinned version, and what's newer."""

    pack_id: str
    pack_version: int
    latest_version: int
    title: str
