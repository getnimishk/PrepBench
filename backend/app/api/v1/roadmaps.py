from typing import List
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.roadmap import (
    RoadmapCreate, RoadmapUpdate, RoadmapSummaryResponse, RoadmapDetailResponse,
    RoadmapPhaseCreate, RoadmapPhaseUpdate, RoadmapPhaseResponse,
    RoadmapTopicCreate, RoadmapTopicUpdate, RoadmapTopicResponse,
    RoadmapSchedule, RoadmapImportPreview, RoadmapImportConfirm, RoadmapImportResult,
)
from app.services.roadmap_service import RoadmapService
from app.services.roadmap_import_service import RoadmapImportService

router = APIRouter(prefix="/roadmaps", tags=["Learning Roadmaps"])


# ---------------------------------------------------------------- import
# Registered before the "/{roadmap_id}" routes below. FastAPI matches in
# declaration order, so a literal path that could otherwise be shadowed by a
# parameterised one has to come first -- the same ordering convention the
# other routers in this package follow.

@router.post("/import/validate", response_model=RoadmapImportPreview)
async def validate_roadmap_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    return RoadmapImportService(db).build_preview(file.filename, content)


@router.post("/import/confirm", response_model=RoadmapImportResult, status_code=status.HTTP_201_CREATED)
def confirm_roadmap_import(req: RoadmapImportConfirm, db: Session = Depends(get_db)):
    return RoadmapImportService(db).commit(req)


# -------------------------------------------------------------- roadmaps

@router.get("", response_model=List[RoadmapSummaryResponse])
def list_roadmaps(include_archived: bool = Query(False), db: Session = Depends(get_db)):
    return RoadmapService(db).list_roadmaps(include_archived=include_archived)


@router.post("", response_model=RoadmapDetailResponse, status_code=status.HTTP_201_CREATED)
def create_roadmap(req: RoadmapCreate, db: Session = Depends(get_db)):
    return RoadmapService(db).create_roadmap(req)


@router.get("/{roadmap_id}", response_model=RoadmapDetailResponse)
def get_roadmap(roadmap_id: int, db: Session = Depends(get_db)):
    return RoadmapService(db).get_detail(roadmap_id)


@router.put("/{roadmap_id}", response_model=RoadmapDetailResponse)
def update_roadmap(roadmap_id: int, req: RoadmapUpdate, db: Session = Depends(get_db)):
    return RoadmapService(db).update_roadmap(roadmap_id, req)


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roadmap(roadmap_id: int, db: Session = Depends(get_db)):
    RoadmapService(db).delete_roadmap(roadmap_id)


@router.get("/{roadmap_id}/schedule", response_model=RoadmapSchedule)
def get_roadmap_schedule(roadmap_id: int, db: Session = Depends(get_db)):
    return RoadmapService(db).build_schedule(roadmap_id)


# ---------------------------------------------------------------- phases

@router.post("/{roadmap_id}/phases", response_model=RoadmapPhaseResponse, status_code=status.HTTP_201_CREATED)
def add_phase(roadmap_id: int, req: RoadmapPhaseCreate, db: Session = Depends(get_db)):
    return RoadmapService(db).add_phase(roadmap_id, req)


@router.put("/{roadmap_id}/phases/{phase_id}", response_model=RoadmapPhaseResponse)
def update_phase(roadmap_id: int, phase_id: int, req: RoadmapPhaseUpdate, db: Session = Depends(get_db)):
    return RoadmapService(db).update_phase(roadmap_id, phase_id, req)


@router.delete("/{roadmap_id}/phases/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phase(roadmap_id: int, phase_id: int, db: Session = Depends(get_db)):
    RoadmapService(db).delete_phase(roadmap_id, phase_id)


# ---------------------------------------------------------------- topics

@router.post("/{roadmap_id}/topics", response_model=RoadmapTopicResponse, status_code=status.HTTP_201_CREATED)
def add_topic(roadmap_id: int, req: RoadmapTopicCreate, db: Session = Depends(get_db)):
    return RoadmapService(db).add_topic(roadmap_id, req)


@router.patch("/{roadmap_id}/topics/{topic_id}", response_model=RoadmapTopicResponse)
def update_topic(roadmap_id: int, topic_id: int, req: RoadmapTopicUpdate, db: Session = Depends(get_db)):
    """
    PATCH rather than PUT: the UI sends a single field -- usually just
    `status` from a dropdown -- and a full-representation contract would force
    it to round-trip the whole topic and risk clobbering evidence_notes.
    """
    return RoadmapService(db).update_topic(roadmap_id, topic_id, req)


@router.delete("/{roadmap_id}/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(roadmap_id: int, topic_id: int, db: Session = Depends(get_db)):
    RoadmapService(db).delete_topic(roadmap_id, topic_id)
