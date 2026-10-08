# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
What Workspace and Evidence read, and whose it is.

Both surfaces are read models over rows other features already write. This
module holds the two things they share, written once:

  * ownership -- which rows a scope reaches. A scope is a preparation id, or
    None for "no preparation" (work that belongs to none). None is never "every
    preparation": the same rule as LearningAttempt's direct-uid requests.
  * reading a learning attempt -- which feature wrote it, told apart by the id
    conventions those features already use (frontend/src/services/*/attempts.ts),
    never by guessing.

Nothing here writes, and nothing is stored: an item is computed from its row on
every read, so it cannot disagree with the feature that owns the row.
"""
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Query, Session

from app.content import packs as pack_store
from app.models.interview_question import InterviewQuestion
from app.models.learning_attempt import LearningAttempt
from app.models.roadmap import Roadmap

# ---- ownership --------------------------------------------------------------------------------


def roadmap_owned_by(query: Query, subject_id: Optional[int]) -> Query:
    """Rows reached through a roadmap: owned by the roadmap's preparation."""
    return query.filter(Roadmap.subject_id.is_(None) if subject_id is None else Roadmap.subject_id == subject_id)


def question_owned_by(subject_id: Optional[int]):
    """An interview question's preparation -- the only owner a recording has."""
    return (
        InterviewQuestion.subject_id.is_(None)
        if subject_id is None
        else InterviewQuestion.subject_id == subject_id
    )


# ---- reading a learning attempt ----------------------------------------------------------------

ADF_LAB = re.compile(r"^ab:(\d+):([a-z][a-z.-]*):r(\d+):([a-z]+)$")
SCENARIO_CHECK = re.compile(r"^([a-z0-9][a-z0-9_-]*)/([^/]+)/check/(\d+)$")
SCENARIO_LENS = re.compile(r"^([a-z0-9][a-z0-9_-]*)/([^/]+)/lens/([a-z-]+)$")
PACK_VERSION = re.compile(r"pack_version=(\d+)")
UID_PACK_VERSION = re.compile(r"^s\d+:[a-z0-9_-]+@(\d+):")


@dataclass(frozen=True)
class AttemptKind:
    """Which feature wrote an attempt, and how to name and reach it."""

    family: str              # adf_lab | lakehouse | scenario_check | scenario_lens | chart_sandbox | other
    ref: Dict[str, str]      # the identifiers a client needs to name it (track, run, challenge_id, ...)
    href: str
    stage: Optional[str] = None      # ADF lab stage: predict | reason | apply | retrieve
    title: str = "Learning attempt"  # a plain fallback; the frontend names lab work from its registries


def _humanise(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").strip().capitalize() or "Untitled"


@lru_cache(maxsize=64)
def _scenario_title(pack_id: str, version: Optional[int], scenario_id: str) -> Optional[str]:
    """A scenario's title from its content pack, or None when the pack does not have it."""
    try:
        pack = pack_store.get(pack_id, version) or pack_store.get(pack_id, None)
    except Exception:  # an unreadable pack names nothing; it never fails the page
        return None
    if pack is None:
        return None
    for level in getattr(pack, "scenario_levels", []) or []:
        for scenario in getattr(level, "scenarios", []) or []:
            if str(getattr(scenario, "id", "")) == scenario_id:
                return getattr(scenario, "title", None)
    return None


def _pack_version(attempt: LearningAttempt) -> Optional[int]:
    match = PACK_VERSION.search(attempt.scenario_fingerprint or "") or UID_PACK_VERSION.match(attempt.attempt_uid)
    return int(match.group(1)) if match else None


def classify(attempt: LearningAttempt) -> AttemptKind:
    challenge = attempt.challenge_id or ""
    if challenge.startswith("adf.lab.") and (m := ADF_LAB.match(attempt.attempt_uid)):
        track, run, stage = m.group(2), m.group(3), m.group(4)
        slug, _, mode = track.partition(".")
        href = f"/lab/adf/{slug}" + (f"?mode={mode}" if mode else "")
        title = _humanise(slug) + (f" ({_humanise(mode).lower()})" if mode else "")
        return AttemptKind("adf_lab", {"track": track, "run": run, "stage": stage}, href, stage, title)
    if challenge.startswith("lakehouse."):
        return AttemptKind("lakehouse", {"challenge_id": challenge}, "/databricks-sandbox",
                           title=_humanise(challenge.rsplit(".", 1)[-1]))
    if m := SCENARIO_CHECK.match(challenge):
        pack_id, scenario_id, index = m.groups()
        title = _scenario_title(pack_id, _pack_version(attempt), scenario_id) or f"Scenario {scenario_id}"
        return AttemptKind("scenario_check", {"pack_id": pack_id, "scenario_id": scenario_id, "check": index},
                           f"/scenarios/{pack_id}/{scenario_id}", title=title)
    if m := SCENARIO_LENS.match(challenge):
        pack_id, scenario_id, role = m.groups()
        title = _scenario_title(pack_id, _pack_version(attempt), scenario_id) or f"Scenario {scenario_id}"
        return AttemptKind("scenario_lens", {"pack_id": pack_id, "scenario_id": scenario_id, "role": role},
                           f"/scenarios/{pack_id}/{scenario_id}", title=title)
    if attempt.subject_id is None:
        # The Chart Sandbox is the one writer of attempts with no preparation.
        return AttemptKind("chart_sandbox", {"concept_id": attempt.concept_id}, "/chart-sandbox",
                           title=_humanise(attempt.concept_id))
    return AttemptKind("other", {"challenge_id": challenge}, "/lab", title=_humanise(challenge))


def adf_runs(attempts: Iterable[Tuple[LearningAttempt, AttemptKind]]) -> Dict[Tuple[str, str], Dict[str, LearningAttempt]]:
    """The ADF lab's attempts by run: (track, run) -> {stage: attempt}."""
    runs: Dict[Tuple[str, str], Dict[str, LearningAttempt]] = {}
    for attempt, kind in attempts:
        if kind.family == "adf_lab" and kind.stage:
            runs.setdefault((kind.ref["track"], kind.ref["run"]), {})[kind.stage] = attempt
    return runs


def excerpt(text: Optional[str], limit: int = 280) -> Optional[str]:
    """The start of a learner's text, cut at a word, or None when there is none."""
    if not text or not text.strip():
        return None
    flat = " ".join(text.split())
    if len(flat) <= limit:
        return flat
    cut = flat[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


def latest(*moments) -> Optional[object]:
    present: List = [m for m in moments if m is not None]
    return max(present) if present else None
