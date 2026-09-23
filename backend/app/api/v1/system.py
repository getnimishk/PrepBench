# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import os
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.core.database import get_db
from app.schemas.system import AboutReport, ReviewScheduleRules, StorageReport
from app.services.system_service import SystemService

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/health")
def health():
    """Whether the server is answering. No database work, so it is cheap to poll."""
    from app.core.config import settings as app_settings

    return {"status": "ok", "version": app_settings.VERSION}


@router.get("/storage", response_model=StorageReport)
def get_storage(db: Session = Depends(get_db)):
    """The database file the server is using, what is in it, and the recordings folder."""
    return SystemService(db).storage()


@router.get("/backup")
def download_backup(db: Session = Depends(get_db)):
    """A consistent copy of the database, as a file to keep.

    API keys are not in it: the database holds a reference to each key, and the
    key itself lives in the OS keychain, the environment, or a file beside it.
    """
    handle, name = tempfile.mkstemp(prefix="prepbench-backup-", suffix=".db")
    os.close(handle)
    path = Path(name)
    try:
        SystemService(db).backup_to(path)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    return FileResponse(
        path,
        media_type="application/vnd.sqlite3",
        filename=f"prepbench-backup-{stamp}.db",
        background=BackgroundTask(lambda: path.unlink(missing_ok=True)),
    )


@router.get("/about", response_model=AboutReport)
def get_about(db: Session = Depends(get_db)):
    """What this build is, where the data sits, and what would leave the machine."""
    return SystemService(db).about()


@router.get("/review-schedule", response_model=ReviewScheduleRules)
def get_review_schedule(db: Session = Depends(get_db)):
    """The spaced-repetition numbers the engine uses. Fixed, not settings."""
    return SystemService(db).review_schedule()
