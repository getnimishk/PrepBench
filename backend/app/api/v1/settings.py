# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.settings import AppSettingsSchema
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=AppSettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    return SettingsService(db).get_settings()


@router.put("", response_model=AppSettingsSchema)
def update_settings(obj_in: AppSettingsSchema, db: Session = Depends(get_db)):
    return SettingsService(db).update_settings(obj_in)


@router.post("/reset-app", status_code=status.HTTP_200_OK)
def reset_application_data(db: Session = Depends(get_db)):
    """Completely resets the application state to a fresh empty state."""
    return SettingsService(db).reset_application()
