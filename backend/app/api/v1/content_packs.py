# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.content_pack import (
    ContentPackAttachRequest,
    ContentPackDetail,
    ContentPackSummary,
    ContentPackUpgradeRequest,
    SubjectContentPackResponse,
)
from app.services import content_pack_service

router = APIRouter(tags=["Content Packs"])


@router.get("/content-packs", response_model=List[ContentPackSummary])
def list_content_packs():
    """Every shipped pack, for the "start from a built-in guide" step."""
    return content_pack_service.list_packs()


@router.get("/content-packs/{pack_id}", response_model=ContentPackDetail)
def get_content_pack(pack_id: str, version: Optional[int] = Query(default=None, ge=1)):
    """The full pack -- its latest version, or a specific one."""
    pack = content_pack_service.get_pack(pack_id, version)
    return ContentPackDetail(**pack.model_dump())


@router.post("/subjects/{subject_id}/content-packs", response_model=SubjectContentPackResponse, status_code=201)
def attach_content_pack(subject_id: int, req: ContentPackAttachRequest, db: Session = Depends(get_db)):
    """Attach a built-in pack to a Skill preparation, at its latest version."""
    return content_pack_service.attach(db, subject_id, req.pack_id)


@router.put("/subjects/{subject_id}/content-packs/{pack_id}", response_model=SubjectContentPackResponse)
def upgrade_content_pack(
    subject_id: int, pack_id: str, req: ContentPackUpgradeRequest, db: Session = Depends(get_db)
):
    """Move the pin to a newer version. Never silent -- the learner asked for this."""
    return content_pack_service.upgrade(db, subject_id, pack_id, req.version)


@router.delete("/subjects/{subject_id}/content-packs/{pack_id}", status_code=204)
def detach_content_pack(subject_id: int, pack_id: str, db: Session = Depends(get_db)):
    """Detach the pack. Learning attempts and saved interview questions stay."""
    content_pack_service.detach(db, subject_id, pack_id)
