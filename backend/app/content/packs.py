# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Built-in content packs: guides and scenarios for a Skill preparation.

A pack is a versioned JSON file, `<pack_id>/v<version>.json`, reviewed through
PRs like code (skills-and-content-packs-plan.md D3). Nothing here writes to the
database -- a subject's *link* to a pack is `SubjectContentPack`
(models/subject_content_pack.py); this module only reads the files.

Loading is forgiving on purpose: a malformed pack file is logged and skipped,
never fatal, so one bad JSON file cannot take the app down at startup (same
spirit as the rest of this app's content loaders).
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict

from app.core.logging_config import logger

PACKS_DIR = Path(__file__).resolve().parent / "packs"


class GuideTable(BaseModel):
    head: List[str]
    rows: List[List[str]]

    model_config = ConfigDict(extra="forbid")


class GuideBlock(BaseModel):
    heading: Optional[str] = None
    md: Optional[str] = None
    table: Optional[GuideTable] = None

    model_config = ConfigDict(extra="forbid")


class PracticeLink(BaseModel):
    scenario_id: str
    label: str

    model_config = ConfigDict(extra="forbid")


class Chapter(BaseModel):
    id: str
    title: str
    summary: str
    sources: str
    blocks: List[GuideBlock]
    practice_links: List[PracticeLink] = []

    model_config = ConfigDict(extra="forbid")


class Scenario(BaseModel):
    id: str
    number: int
    title: str
    outcome: str
    sources: str
    chapter: str
    # Absent for a *planned* scenario, which is listed but can't be opened.
    # Structure is the prototype's UnitContent (services/adf/units.ts); the
    # backend treats it as opaque data and never interprets it.
    content: Optional[dict] = None

    model_config = ConfigDict(extra="forbid")


class ScenarioLevel(BaseModel):
    name: str
    about: str
    scenarios: List[Scenario]

    model_config = ConfigDict(extra="forbid")


class DiagnosticQuestion(BaseModel):
    id: str
    topic: str
    question: str
    points: List[str]
    keywords: List[str]
    chapter: str

    model_config = ConfigDict(extra="forbid")


class ContentPack(BaseModel):
    pack_id: str
    version: int
    title: str
    summary: str
    docs_url: str
    source_notes: str
    chapters: List[Chapter]
    scenario_levels: List[ScenarioLevel] = []
    diagnostic_questions: List[DiagnosticQuestion] = []

    model_config = ConfigDict(extra="forbid")

    @property
    def chapter_count(self) -> int:
        return len(self.chapters)

    @property
    def scenario_count(self) -> int:
        return sum(len(level.scenarios) for level in self.scenario_levels)

    @property
    def written_scenario_count(self) -> int:
        return sum(
            1
            for level in self.scenario_levels
            for scenario in level.scenarios
            if scenario.content is not None
        )


def _load_from_disk(base_dir: Path) -> Dict[str, Dict[int, ContentPack]]:
    """Every `<pack_id>/v<version>.json` under `base_dir`, grouped by pack id.

    A pack whose file doesn't parse as JSON, or doesn't match the schema, is
    logged and skipped -- it never stops the rest of the packs (or the app)
    from loading.
    """
    packs: Dict[str, Dict[int, ContentPack]] = {}
    if not base_dir.exists():
        return packs

    for pack_dir in sorted(p for p in base_dir.iterdir() if p.is_dir()):
        for version_file in sorted(pack_dir.glob("v*.json")):
            try:
                raw = json.loads(version_file.read_text(encoding="utf-8"))
                pack = ContentPack.model_validate(raw)
            except Exception as exc:
                logger.warning(f"Skipping malformed content pack {version_file}: {exc}")
                continue
            packs.setdefault(pack.pack_id, {})[pack.version] = pack
    return packs


@lru_cache(maxsize=None)
def _load_cached(base_dir_str: str) -> Dict[str, Dict[int, ContentPack]]:
    return _load_from_disk(Path(base_dir_str))


def load_packs(base_dir: Optional[Path] = None) -> Dict[str, Dict[int, ContentPack]]:
    """Every shipped pack, `{pack_id: {version: ContentPack}}`, cached by directory.

    `base_dir` is only ever overridden by tests, to check that a malformed file
    is skipped without touching the real, shipped packs.
    """
    return _load_cached(str(base_dir or PACKS_DIR))


def clear_cache() -> None:
    """Test-only: forget every cached directory's packs."""
    _load_cached.cache_clear()


def all_latest(base_dir: Optional[Path] = None) -> List[ContentPack]:
    """The latest version of every shipped pack, in a stable order."""
    packs = load_packs(base_dir)
    return [packs[pack_id][max(packs[pack_id])] for pack_id in sorted(packs)]


def latest(pack_id: str, base_dir: Optional[Path] = None) -> Optional[ContentPack]:
    versions = load_packs(base_dir).get(pack_id)
    if not versions:
        return None
    return versions[max(versions)]


def get(pack_id: str, version: Optional[int] = None, base_dir: Optional[Path] = None) -> Optional[ContentPack]:
    """A pack at a specific version, or its latest if `version` is None."""
    if version is None:
        return latest(pack_id, base_dir)
    return load_packs(base_dir).get(pack_id, {}).get(version)
