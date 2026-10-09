# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Attaching, upgrading and detaching a Skill preparation's built-in content pack.

Packs themselves are read-only files (`app/content/packs.py`); this is the one
place that touches the database link (D3/D4/D5): a subject pins a pack
version, and upgrading is something the learner chooses, never something that
happens under them.
"""
import re
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.content import packs as pack_store
from app.core.exceptions import ConflictException, InvalidExamStateException, ResourceNotFoundException
from app.models.roadmap import Roadmap, RoadmapTopic
from app.models.subject import Subject, SubjectKind
from app.models.subject_content_pack import SubjectContentPack
from app.schemas.content_pack import ContentPackSummary, SubjectContentPackResponse
from app.schemas.roadmap import MappedGuideChapter


def list_packs() -> List[ContentPackSummary]:
    """Every shipped pack, latest version, for the "start from a built-in
    guide" step."""
    return [
        ContentPackSummary(
            pack_id=pack.pack_id,
            latest_version=pack.version,
            title=pack.title,
            summary=pack.summary,
            chapter_count=pack.chapter_count,
            scenario_count=pack.scenario_count,
            written_scenario_count=pack.written_scenario_count,
        )
        for pack in pack_store.all_latest()
    ]


def get_pack(pack_id: str, version: Optional[int] = None):
    pack = pack_store.get(pack_id, version)
    if pack is None:
        raise ResourceNotFoundException("Content pack", f"{pack_id}@{version or 'latest'}")
    return pack


def _require_subject(db: Session, subject_id: int) -> Subject:
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if subject is None:
        raise ResourceNotFoundException("Subject", subject_id)
    return subject


def _to_response(link: SubjectContentPack) -> SubjectContentPackResponse:
    pack = pack_store.get(link.pack_id, link.pack_version)
    latest_pack = pack_store.latest(link.pack_id)
    return SubjectContentPackResponse(
        pack_id=link.pack_id,
        pack_version=link.pack_version,
        latest_version=latest_pack.version if latest_pack else link.pack_version,
        title=(pack or latest_pack).title if (pack or latest_pack) else link.pack_id,
        chapter_count=len(pack.chapters) if pack else 0,
        written_scenario_count=(
            sum(1 for level in pack.scenario_levels for s in level.scenarios if s.content) if pack else 0
        ),
    )


def content_packs_for(db: Session, subject_id: int) -> List[SubjectContentPackResponse]:
    links = (
        db.query(SubjectContentPack)
        .filter(SubjectContentPack.subject_id == subject_id)
        .order_by(SubjectContentPack.attached_at.asc())
        .all()
    )
    return [_to_response(link) for link in links]


def attach(db: Session, subject_id: int, pack_id: str) -> SubjectContentPackResponse:
    subject = _require_subject(db, subject_id)
    if subject.kind != SubjectKind.SKILL:
        raise InvalidExamStateException(
            "Content packs are for Skill preparations, and "
            f"{subject.name!r} is a certification. A certification's content "
            "is its own questions, not a built-in pack."
        )

    pack = pack_store.latest(pack_id)
    if pack is None:
        raise ResourceNotFoundException("Content pack", pack_id)

    already = ConflictException(f"{subject.name!r} already has the {pack.title!r} pack attached.")
    if _attached(db, subject_id, pack_id) is not None:
        raise already

    link = SubjectContentPack(subject_id=subject_id, pack_id=pack_id, pack_version=pack.version)
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        # Two attaches of the same pack arrived together (a double-click), both
        # passed the check above, and the other insert won. That is the same
        # answer as the check's -- already attached -- not a 500.
        db.rollback()
        if _attached(db, subject_id, pack_id) is not None:
            raise already
        raise
    db.refresh(link)
    return _to_response(link)


def _attached(db: Session, subject_id: int, pack_id: str) -> Optional[SubjectContentPack]:
    return (
        db.query(SubjectContentPack)
        .filter(
            SubjectContentPack.subject_id == subject_id,
            SubjectContentPack.pack_id == pack_id,
        )
        .first()
    )


def upgrade(db: Session, subject_id: int, pack_id: str, version: int) -> SubjectContentPackResponse:
    _require_subject(db, subject_id)
    link = (
        db.query(SubjectContentPack)
        .filter(
            SubjectContentPack.subject_id == subject_id,
            SubjectContentPack.pack_id == pack_id,
        )
        .first()
    )
    if link is None:
        raise ResourceNotFoundException("Content pack link", pack_id)

    target = pack_store.get(pack_id, version)
    if target is None:
        raise ResourceNotFoundException("Content pack version", f"{pack_id}@{version}")
    if version <= link.pack_version:
        raise InvalidExamStateException(
            f"{pack_id!r} is already pinned at version {link.pack_version}; "
            f"version {version} is not newer, so there's nothing to upgrade to."
        )

    link.pack_version = version
    db.commit()
    db.refresh(link)
    return _to_response(link)


def detach(db: Session, subject_id: int, pack_id: str) -> None:
    """Removes the link only. Anything already recorded against the pack --
    learning attempts, saved interview questions -- is kept, per D7."""
    _require_subject(db, subject_id)
    link = (
        db.query(SubjectContentPack)
        .filter(
            SubjectContentPack.subject_id == subject_id,
            SubjectContentPack.pack_id == pack_id,
        )
        .first()
    )
    if link is None:
        raise ResourceNotFoundException("Content pack link", pack_id)
    db.delete(link)
    db.commit()


# --------------------------------------------------- Roadmap Study Guide Alignment

_ALIGNMENT_PATTERN = re.compile(
    r"-\s+\*\*Topic\s+(\d+)\s+[—–-]\s+([^*]+)\*\*\s+\(([^)]+)\)"
    r"(?:[^\n]*\n\s+-\s+\*Relevant sections:\*\s*([^\n]+))?"
    r"(?:[^\n]*\n\s+-\s+\*Learning evidence:\*\s*([^\n]+))?"
)


def normalize_topic_title(title: str) -> str:
    cleaned = re.sub(r"^(?:topic\s*)?\d+[\s.:–-]+", "", title.strip(), flags=re.IGNORECASE)
    return cleaned.strip().lower()


@lru_cache(maxsize=32)
def get_pack_roadmap_alignments(pack_id: str, version: Optional[int] = None) -> Dict[str, List[MappedGuideChapter]]:
    """Index of mapped chapters by normalized topic title and topic number string."""
    pack = pack_store.get(pack_id, version)
    if not pack:
        return {}

    mapping: Dict[str, List[MappedGuideChapter]] = {}
    for ch_idx, ch in enumerate(pack.chapters, 1):
        for b in ch.blocks:
            if b.heading == "Roadmap alignment" and b.md:
                for m in _ALIGNMENT_PATTERN.finditer(b.md):
                    t_num = int(m.group(1))
                    t_title = m.group(2).strip()
                    t_cov = m.group(3).strip()
                    rel_sec = m.group(4).strip() if m.group(4) else None
                    lrn_evi = m.group(5).strip() if m.group(5) else None

                    item = MappedGuideChapter(
                        pack_id=pack.pack_id,
                        pack_title=pack.title,
                        chapter_id=ch.id,
                        chapter_number=ch_idx,
                        chapter_title=ch.title,
                        chapter_summary=ch.summary,
                        topic_number=t_num,
                        topic_title=t_title,
                        coverage=t_cov,
                        relevant_sections=rel_sec,
                        learning_evidence=lrn_evi,
                    )
                    norm_key = normalize_topic_title(t_title)
                    mapping.setdefault(norm_key, []).append(item)
                    mapping.setdefault(str(t_num), []).append(item)
    return mapping


# A topic's own number, when its title states one: a bare "12", or "Topic 12" with
# or without a name after it. Anything else -- "3D Printing", "10 Things" -- is a
# title, not a number, and is never read as one.
_TOPIC_NUMBER = re.compile(r"^\s*(?:topic\s+(\d+)\b.*|(\d+))\s*$", re.IGNORECASE)


def linked_pack_for_roadmap(db: Session, roadmap: Roadmap) -> Optional[Tuple[str, str, int]]:
    """The content pack a roadmap's topics are mapped against: (pack_id, title, version).

    Only a pack attached to the roadmap's own preparation, at the version that
    preparation pinned, and only one whose chapters carry "Roadmap alignment" blocks.
    Nothing is guessed: a roadmap with no preparation, or one whose preparation has
    no aligned pack, maps to nothing -- never to a pack whose name happens to appear
    in its title, filename or topics.
    """
    if roadmap.subject_id is None:
        return None
    links = (
        db.query(SubjectContentPack)
        .filter(SubjectContentPack.subject_id == roadmap.subject_id)
        .order_by(SubjectContentPack.id)
        .all()
    )
    for link in links:
        pack = pack_store.get(link.pack_id, link.pack_version)
        if pack and get_pack_roadmap_alignments(pack.pack_id, pack.version):
            return (pack.pack_id, pack.title, pack.version)
    return None


def chapters_for_topic_title(
    alignments: Dict[str, List[MappedGuideChapter]], title: str
) -> List[MappedGuideChapter]:
    """A topic's chapters, from the pack's own alignment: by its title, or by the
    number its title explicitly states. Never by position."""
    if not alignments:
        return []
    by_title = alignments.get(normalize_topic_title(title or ""))
    if by_title:
        return by_title
    m = _TOPIC_NUMBER.match(title or "")
    if m:
        return alignments.get(m.group(1) or m.group(2), [])
    return []


def find_mapped_chapters_for_topic(
    db: Session, roadmap_id: int, topic: RoadmapTopic
) -> List[MappedGuideChapter]:
    """Built-in study guide chapters mapped to one roadmap topic, or none."""
    roadmap = getattr(topic, "roadmap", None)
    if not roadmap:
        roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).first()
    if not roadmap:
        return []
    linked = linked_pack_for_roadmap(db, roadmap)
    if not linked:
        return []
    return chapters_for_topic_title(get_pack_roadmap_alignments(linked[0], linked[2]), topic.title)

