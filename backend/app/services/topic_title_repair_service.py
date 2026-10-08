# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Repairing topic titles that an import left as bare numbers (Phase 7, D1).

Before the importer fix, a workbook whose header read "Phase, Topic #, Topic, ..."
was imported with the number column as the title, so a roadmap's topics read "1",
"2", "3". This puts the real names back, and nothing else:

  * it runs only when the learner asks, from the roadmap's own workbook, and shows
    every change before applying any;
  * a topic is matched by its phase and its number -- the bare number that is its
    title now -- never by position;
  * only `title` changes. Ids, status, progress, dates, notes, objectives, hours,
    demonstrations and guide sections are untouched; nothing is created, deleted
    or reordered, and no other roadmap is read or written;
  * any ambiguity (a number twice in one phase, in the workbook or the roadmap), a
    topic with no row in the workbook, or a name that is itself a number blocks the
    whole repair;
  * it is idempotent: a topic that already has a name is left alone.

Titles are written through RoadmapService's topic write path; a title that would
also move any other field (an inconsistent row the reconcile step would correct)
refuses the repair instead, so a title repair can never change anything but titles.
"""
import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.exceptions import InvalidExamStateException, ResourceNotFoundException
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic
from app.schemas.roadmap import (
    RoadmapTopicUpdate,
    TopicTitleRepairChange,
    TopicTitleRepairPreview,
    TopicTitleRepairResult,
)
from app.services.roadmap_import_service import RoadmapImportService
from app.services.roadmap_service import RoadmapService

BARE_NUMBER = re.compile(r"^\d+$")

# Every field a title repair must leave exactly as it was.
PRESERVED = (
    "status", "progress_percentage", "started_at", "completed_at", "evidence_notes",
    "learning_objective", "success_criteria", "estimated_hours", "phase_id", "order_index", "roadmap_id",
)


def _phase_key(name: Optional[str]) -> str:
    return " ".join((name or "").split()).casefold()


class TopicTitleRepairService:
    def __init__(self, db: Session):
        self.db = db

    def preview(self, roadmap_id: int, filename: str, content: bytes) -> TopicTitleRepairPreview:
        changes, already_named, problems = self._plan(roadmap_id, filename, content)
        return TopicTitleRepairPreview(
            roadmap_id=roadmap_id,
            source_filename=filename or "",
            changes=changes,
            already_named=already_named,
            problems=problems,
            can_apply=not problems and bool(changes),
        )

    def apply(self, roadmap_id: int, filename: str, content: bytes, topic_ids: List[int]) -> TopicTitleRepairResult:
        """Apply the repair the learner saw. The plan is computed again from the same
        workbook, and must be exactly the one confirmed: if the roadmap or the file
        changed since the preview, nothing is written."""
        changes, _, problems = self._plan(roadmap_id, filename, content)
        if problems:
            raise InvalidExamStateException("The repair cannot be applied: " + " ".join(problems))
        if not changes:
            raise InvalidExamStateException("Nothing to repair: every topic in this roadmap already has a name.")
        if sorted(set(topic_ids)) != sorted(c.topic_id for c in changes):
            raise InvalidExamStateException(
                "The roadmap or the workbook changed since the preview. Nothing was changed; preview again."
            )

        topics = {t.id: t for t in self.db.query(RoadmapTopic).filter(RoadmapTopic.roadmap_id == roadmap_id).all()}
        try:
            for change in changes:
                topic = topics[change.topic_id]
                before = {field: getattr(topic, field) for field in PRESERVED}
                RoadmapService._apply_topic_update(topic, RoadmapTopicUpdate(title=change.new_title))
                moved = [field for field in PRESERVED if getattr(topic, field) != before[field]]
                if moved:
                    raise InvalidExamStateException(
                        f"Topic {change.number} ({change.phase}) has inconsistent progress fields that saving "
                        f"it would also correct ({', '.join(moved)}). Nothing was changed; fix that topic "
                        "first, then repair the titles."
                    )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return TopicTitleRepairResult(roadmap_id=roadmap_id, repaired=changes)

    # ---- the plan ----------------------------------------------------------------------------

    def _plan(self, roadmap_id: int, filename: str, content: bytes) -> Tuple[List[TopicTitleRepairChange], int, List[str]]:
        if self.db.query(Roadmap.id).filter(Roadmap.id == roadmap_id).first() is None:
            raise ResourceNotFoundException("Roadmap", roadmap_id)
        rows = RoadmapImportService(self.db).numbered_topics(filename, content)
        problems: List[str] = []
        if not rows:
            problems.append(
                "The workbook has no syllabus sheet with both a topic-number column and a topic column."
            )

        # The workbook: (phase, number) -> name. A pair named twice is ambiguous.
        names: Dict[Tuple[str, str], str] = {}
        twice: List[str] = []
        for phase, number, title in rows:
            key = (_phase_key(phase), number)
            if key in names and names[key] != title:
                twice.append(f"{number} in '{phase}'")
            names.setdefault(key, title)
        if twice:
            problems.append(f"The workbook numbers more than one topic the same way: {', '.join(twice[:5])}.")

        topics = (
            self.db.query(RoadmapTopic, RoadmapPhase)
            .join(RoadmapPhase, RoadmapTopic.phase_id == RoadmapPhase.id)
            .filter(RoadmapTopic.roadmap_id == roadmap_id)
            .order_by(RoadmapPhase.order_index, RoadmapTopic.order_index, RoadmapTopic.id)
            .all()
        )
        numbered = [(t, p) for t, p in topics if BARE_NUMBER.match((t.title or "").strip())]
        already_named = len(topics) - len(numbered)

        seen: Dict[Tuple[str, str], int] = {}
        for topic, phase in numbered:
            key = (_phase_key(phase.name), topic.title.strip())
            seen[key] = seen.get(key, 0) + 1
        clashes = [f"{num} in '{ph}'" for (ph, num), n in seen.items() if n > 1]
        if clashes:
            problems.append(f"This roadmap has more than one topic numbered the same way: {', '.join(clashes[:5])}.")

        changes: List[TopicTitleRepairChange] = []
        missing: List[str] = []
        for topic, phase in numbered:
            number = topic.title.strip()
            new_title = names.get((_phase_key(phase.name), number))
            if new_title is None:
                missing.append(f"{number} in '{phase.name}'")
                continue
            if BARE_NUMBER.match(new_title):
                problems.append(f"The workbook's name for topic {number} is itself a number ('{new_title}').")
                continue
            changes.append(TopicTitleRepairChange(
                topic_id=topic.id, phase=phase.name, number=number, old_title=topic.title, new_title=new_title,
            ))
        if missing and rows:
            problems.append(
                f"{len(missing)} numbered topic(s) have no row in the workbook: {', '.join(missing[:5])}."
            )
        return changes, already_named, problems
