# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import date
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.roadmap import (
    RoadmapCreate, RoadmapUpdate, RoadmapPlanUpdate, RoadmapSummaryResponse, RoadmapDetailResponse,
    RoadmapPhaseCreate, RoadmapPhaseUpdate, RoadmapPhaseResponse,
    RoadmapTopicCreate, RoadmapTopicUpdate, RoadmapTopicResponse,
    RoadmapSchedule, RoadmapImportPreview, RoadmapImportConfirm, RoadmapImportResult,
    TopicDemonstrationCreate, TopicDemonstrationResponse, TopicDemonstrationResult,
    TopicGuideDraftResult, TopicGuideResponse, TopicGuideSectionResponse, TopicGuideSectionWrite,
)
from app.services.roadmap_service import RoadmapService
from app.services.roadmap_import_service import RoadmapImportService
from app.services.topic_guide_service import TopicGuideService

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
def list_roadmaps(
    include_archived: bool = Query(False),
    subject_id: Optional[int] = Query(
        None,
        description=(
            "Return only this preparation's roadmaps. Omit for all of them, "
            "which is the default so that no existing caller's results change. "
            "Roadmaps with no preparation are never folded into a filtered "
            "result -- they belong to none, and the list screen shows them as "
            "unassigned."
        ),
    ),
    db: Session = Depends(get_db),
):
    return RoadmapService(db).list_roadmaps(
        include_archived=include_archived, subject_id=subject_id
    )


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


@router.put("/{roadmap_id}/plan", response_model=RoadmapDetailResponse)
def save_roadmap_plan(roadmap_id: int, req: RoadmapPlanUpdate, db: Session = Depends(get_db)):
    """The plan editor's save: title, start date, weekly budget, and every phase's
    name and position, with removed phases' topics moved where the learner chose.
    All of it or none of it."""
    return RoadmapService(db).save_plan(roadmap_id, req)


@router.get("/{roadmap_id}/schedule", response_model=RoadmapSchedule)
def get_roadmap_schedule(
    roadmap_id: int,
    draft: Annotated[bool, Query(
        description=(
            "Project the start date and weekly budget given here instead of the saved ones, "
            "without saving them. A missing one counts as not set."
        ),
    )] = False,
    start_date: Annotated[Optional[date], Query()] = None,
    weekly_hours_budget: Annotated[Optional[float], Query(gt=0, le=168)] = None,
    db: Session = Depends(get_db),
):
    service = RoadmapService(db)
    if draft:
        return service.build_schedule(
            roadmap_id, draft={"start_date": start_date, "weekly_hours_budget": weekly_hours_budget},
        )
    return service.build_schedule(roadmap_id)


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


@router.get(
    "/{roadmap_id}/topics/{topic_id}/demonstrations",
    response_model=List[TopicDemonstrationResponse],
)
def list_demonstrations(roadmap_id: int, topic_id: int, db: Session = Depends(get_db)):
    """Every attempt at this topic, newest first. The newest carries the recheck date."""
    return RoadmapService(db).list_demonstrations(roadmap_id, topic_id)


@router.post(
    "/{roadmap_id}/topics/{topic_id}/demonstrations",
    response_model=TopicDemonstrationResult,
    status_code=status.HTTP_201_CREATED,
)
def record_demonstration(
    roadmap_id: int, topic_id: int, req: TopicDemonstrationCreate, db: Session = Depends(get_db)
):
    """Demonstrate a topic against its success criterion.

    The only way a topic becomes completed. `self_grade` is "yes" (completed),
    "partial" or "not_yet" (in progress -- including a completed topic whose
    recheck failed). Nested under the topic, on the router that already owns
    topics, rather than a new resource.
    """
    return RoadmapService(db).record_demonstration(roadmap_id, topic_id, req)


# ---------------------------------------------------------- study guide

@router.get("/{roadmap_id}/topics/{topic_id}/guide", response_model=TopicGuideResponse)
def get_topic_guide(roadmap_id: int, topic_id: int, db: Session = Depends(get_db)):
    """The topic's study guide, and whether an AI draft can be made right now."""
    return TopicGuideService(db).get_guide(roadmap_id, topic_id)


@router.post("/{roadmap_id}/topics/{topic_id}/guide/draft", response_model=TopicGuideDraftResult)
def draft_topic_guide(roadmap_id: int, topic_id: int, db: Session = Depends(get_db)):
    """Ask the configured AI to draft sections, appended to any that exist.

    Returns 200 in every case, with `status` saying what happened: "drafted",
    "unavailable" (no provider -- nothing saved) or "failed" (nothing usable came
    back -- nothing saved). Never invents content.
    """
    return TopicGuideService(db).draft_with_ai(roadmap_id, topic_id)


@router.post(
    "/{roadmap_id}/topics/{topic_id}/guide/sections",
    response_model=TopicGuideSectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_topic_guide_section(
    roadmap_id: int, topic_id: int, req: TopicGuideSectionWrite, db: Session = Depends(get_db)
):
    return TopicGuideService(db).add_section(roadmap_id, topic_id, req)


@router.put(
    "/{roadmap_id}/topics/{topic_id}/guide/sections/{section_id}",
    response_model=TopicGuideSectionResponse,
)
def update_topic_guide_section(
    roadmap_id: int, topic_id: int, section_id: int, req: TopicGuideSectionWrite,
    db: Session = Depends(get_db),
):
    return TopicGuideService(db).update_section(roadmap_id, topic_id, section_id, req)


@router.delete(
    "/{roadmap_id}/topics/{topic_id}/guide/sections/{section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_topic_guide_section(
    roadmap_id: int, topic_id: int, section_id: int, db: Session = Depends(get_db)
):
    TopicGuideService(db).delete_section(roadmap_id, topic_id, section_id)


@router.put(
    "/{roadmap_id}/topics/{topic_id}/guide/sections/{section_id}/read",
    response_model=TopicGuideSectionResponse,
)
def mark_topic_guide_section_read(
    roadmap_id: int, topic_id: int, section_id: int,
    read: bool = Query(True, description="True to mark read, false to undo."),
    db: Session = Depends(get_db),
):
    """Record that a section was read. Not evidence -- completion is still earned
    by demonstration."""
    return TopicGuideService(db).set_read(roadmap_id, topic_id, section_id, read)


@router.delete("/{roadmap_id}/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(roadmap_id: int, topic_id: int, db: Session = Depends(get_db)):
    RoadmapService(db).delete_topic(roadmap_id, topic_id)
