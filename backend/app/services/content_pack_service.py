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
from typing import List, Optional

from sqlalchemy.orm import Session

from app.content import packs as pack_store
from app.core.exceptions import ConflictException, InvalidExamStateException, ResourceNotFoundException
from app.models.subject import Subject, SubjectKind
from app.models.subject_content_pack import SubjectContentPack
from app.schemas.content_pack import ContentPackSummary, SubjectContentPackResponse


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

    existing = (
        db.query(SubjectContentPack)
        .filter(
            SubjectContentPack.subject_id == subject_id,
            SubjectContentPack.pack_id == pack_id,
        )
        .first()
    )
    if existing is not None:
        raise ConflictException(
            f"{subject.name!r} already has the {pack.title!r} pack attached."
        )

    link = SubjectContentPack(subject_id=subject_id, pack_id=pack_id, pack_version=pack.version)
    db.add(link)
    db.commit()
    db.refresh(link)
    return _to_response(link)


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
