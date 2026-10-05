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


def get_linked_pack_for_roadmap(db: Session, roadmap: Roadmap) -> Optional[Tuple[str, str]]:
    """Determine the associated built-in content pack (pack_id, pack_title) for a roadmap.

    Checks:
    1. subject_content_packs if roadmap is linked to a subject
    2. Roadmap title / source_filename keyword matching ('adf' -> 'adf', 'adls' -> 'adls')
    3. Topic matching against available packs
    """
    if roadmap.subject_id is not None:
        links = db.query(SubjectContentPack).filter(SubjectContentPack.subject_id == roadmap.subject_id).all()
        for link in links:
            pack = pack_store.get(link.pack_id, link.pack_version)
            if pack:
                return (pack.pack_id, pack.title)

    title_lower = (roadmap.title or "").lower()
    source_lower = (roadmap.source_filename or "").lower()

    if "adf" in title_lower or "data factory" in title_lower or "adf" in source_lower:
        pack = pack_store.latest("adf")
        if pack:
            return (pack.pack_id, pack.title)

    if "adls" in title_lower or "data lake" in title_lower or "adls" in source_lower:
        pack = pack_store.latest("adls")
        if pack:
            return (pack.pack_id, pack.title)

    # Fallback: check if the roadmap's first few topics match any known pack
    for pack in pack_store.all_latest():
        alignments = get_pack_roadmap_alignments(pack.pack_id, pack.version)
        if alignments and any(normalize_topic_title(t.title) in alignments for t in getattr(roadmap, "topics", [])[:5]):
            return (pack.pack_id, pack.title)

    return None


def find_mapped_chapters_for_topic(
    db: Session, roadmap_id: int, topic: RoadmapTopic
) -> List[MappedGuideChapter]:
    """Find built-in study guide chapters mapped to a specific roadmap topic."""
    roadmap = getattr(topic, "roadmap", None)
    if not roadmap:
        from app.models.roadmap import Roadmap
        roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).first()
    if not roadmap:
        return []

    linked = get_linked_pack_for_roadmap(db, roadmap)
    if not linked:
        # Check all latest packs for title match
        for pack in pack_store.all_latest():
            alignments = get_pack_roadmap_alignments(pack.pack_id, pack.version)
            norm = normalize_topic_title(topic.title)
            if norm in alignments:
                return alignments[norm]
        return []

    pack_id, _ = linked
    alignments = get_pack_roadmap_alignments(pack_id)
    if not alignments:
        return []

    # 1. Match by normalized topic title
    norm_title = normalize_topic_title(topic.title)
    if norm_title in alignments:
        return alignments[norm_title]

    # 2. Match by topic number extracted from title (e.g. "Topic 1: ...")
    num_match = re.search(r"^(?:topic\s*)?(\d+)", topic.title.strip(), re.IGNORECASE)
    if num_match and num_match.group(1) in alignments:
        return alignments[num_match.group(1)]

    # 3. Match by 1-based order_index if title doesn't match
    order_key = str(topic.order_index + 1)
    if order_key in alignments:
        return alignments[order_key]

    return []

