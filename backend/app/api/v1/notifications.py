# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.notifications import NotificationList
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationList)
def list_notifications(db: Session = Depends(get_db)):
    """What the evidence says is worth doing next, across every active preparation.

    Computed on read and filtered by the triggers turned on in settings. Nothing
    to mark read: each one clears when its condition does.
    """
    return NotificationService(db).list()
