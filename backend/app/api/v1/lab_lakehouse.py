# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""The Lakehouse Lab API (design §4.10). Thin: the rules live in services/lab/."""
from typing import List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ResourceNotFoundException
from app.schemas.lab import (
    CriteriaFeedbackRequest, CriteriaFeedbackResponse, EngineStatus, JournalEntry,
    JournalEntryIn, LabOperation, LabOperationResult, LabPackDetail, LabPackSummary,
    LabResetResult, SourceIndexRow,
)
from app.services.lab import (
    criteria_feedback, dataset_service, engine, journal_service, notebook_service,
    operations, pack_service,
)

router = APIRouter(prefix="/lab/lakehouse", tags=["Lakehouse Lab"])


def _pack(pack_id: str):
    pack = pack_service.get_pack(pack_id)
    if pack is None:
        raise ResourceNotFoundException("Lab pack", pack_id)
    return pack


def _summary(pack) -> dict:
    m = pack.manifest
    return dict(id=m.id, version=m.version, title=m.title, summary=m.summary, fictional=m.fictional,
                stations=list(m.stations), notebook_verified_on=m.notebook_verified_on)


@router.get("/engine", response_model=EngineStatus)
def engine_status():
    """Whether the optional Delta engine is installed. Never a server error."""
    return engine.status()


@router.get("/packs", response_model=List[LabPackSummary])
def list_packs():
    return [_summary(p) for p in pack_service.list_packs()]


@router.get("/packs/{pack_id}", response_model=LabPackDetail)
def get_pack(pack_id: str):
    pack = _pack(pack_id)
    return LabPackDetail(
        **_summary(pack), scenario_md=pack.scenario_md, dataset=pack.dataset, factory=pack.factory, pipeline=pack.pipeline,
        tables=pack.tables(), defect_manifest=dataset_service.generate(pack).manifest,
    )


@router.get("/packs/{pack_id}/source-index", response_model=List[SourceIndexRow])
def source_index(pack_id: str, table: Optional[str] = Query(None)):
    """Each source row's key, when it changed and whether it's deleted, for the simulations."""
    pack = _pack(pack_id)
    if table is not None and table not in pack.dataset.tables:
        raise ResourceNotFoundException("Lab table", table)
    return dataset_service.source_index(pack, table)


@router.get("/packs/{pack_id}/dataset/{table}.csv")
def dataset_csv(pack_id: str, table: str, copy: Literal["clean", "legacy", "cdc"] = Query("clean")):
    """One copy of a dataset table as CSV, for uploading to a Databricks Volume."""
    pack = _pack(pack_id)
    if table not in pack.dataset.tables:
        raise ResourceNotFoundException("Lab table", table)
    data = dataset_service.generate(pack).tables[table]
    if copy == "legacy":
        body, name = dataset_service.to_csv(data.spec.columns, data.legacy), f"{table}_legacy.csv"
    elif copy == "cdc":
        body, name = dataset_service.to_csv(dataset_service.cdc_columns(data), data.cdc), f"{table}_cdc.csv"
    else:
        body, name = dataset_service.to_csv(data.spec.columns, data.clean), f"{table}.csv"
    return Response(content=body, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.post("/ops", response_model=LabOperationResult)
def run_operation(op: LabOperation = Body(...), db: Session = Depends(get_db)):
    """One allow-listed operation on the real engine. 503 without the engine; an
    engine refusal comes back as `ok: false` with the engine's own words."""
    return operations.run(db, op)


@router.post("/packs/{pack_id}/reset", response_model=LabResetResult)
def reset_pack(pack_id: str, db: Session = Depends(get_db)):
    """Delete this pack's lab tables. The journal is kept."""
    return operations.reset(db, pack_id)


@router.get("/packs/{pack_id}/notebook")
def notebook(pack_id: str, station: Literal["c"] = Query("c")):
    """Station C as a Databricks source notebook. Marked unverified until someone has run it."""
    pack = _pack(pack_id)
    return Response(
        content=notebook_service.render(pack), media_type="text/x-python",
        headers={"Content-Disposition": f'attachment; filename="lakehouse-lab-{pack.manifest.id}-station-{station}.py"'},
    )


@router.get("/journal", response_model=List[JournalEntry])
def list_journal(pack_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return journal_service.list_entries(db, pack_id)


@router.post("/journal", response_model=JournalEntry, status_code=status.HTTP_201_CREATED)
def add_journal_entry(req: JournalEntryIn, db: Session = Depends(get_db)):
    """A simulation station's entry. An entry claiming to be a real-engine run is refused."""
    return journal_service.add_simulation(db, req)


@router.get("/journal/export.md")
def export_journal(pack_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return Response(
        content=journal_service.export_markdown(db, pack_id), media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="lakehouse-lab-journal.md"'},
    )


@router.delete("/journal/{entry_uid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_entry(entry_uid: str, db: Session = Depends(get_db)):
    """The only change a journal entry allows."""
    journal_service.delete_entry(db, entry_uid)


@router.post("/criteria/feedback", response_model=CriteriaFeedbackResponse)
def criteria_ai_feedback(req: CriteriaFeedbackRequest, db: Session = Depends(get_db)):
    """AI advice on written acceptance criteria. Never raises a server error; never stores anything."""
    return criteria_feedback.get_criteria_feedback(db, req.criteria)
