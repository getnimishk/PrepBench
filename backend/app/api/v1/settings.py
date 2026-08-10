from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.settings import AppSettings
from app.schemas.settings import AppSettingsSchema
from app.models.option import QuestionOption
from app.models.exam_answer import ExamAnswer
from app.models.note_bookmark import UserNote, Bookmark
from app.models.spaced_repetition import SpacedRepetition
from app.models.question import Question
from app.models.exam_session import ExamSession

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=AppSettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return AppSettingsSchema.model_validate(settings)

@router.put("", response_model=AppSettingsSchema)
def update_settings(obj_in: AppSettingsSchema, db: Session = Depends(get_db)):
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)

    for field, val in obj_in.model_dump().items():
        setattr(settings, field, val)

    db.commit()
    db.refresh(settings)
    return AppSettingsSchema.model_validate(settings)

@router.post("/reset-app", status_code=status.HTTP_200_OK)
def reset_application_data(db: Session = Depends(get_db)):
    """Completely resets the application state to a fresh empty state."""
    db.query(QuestionOption).delete(synchronize_session=False)
    db.query(ExamAnswer).delete(synchronize_session=False)
    db.query(UserNote).delete(synchronize_session=False)
    db.query(Bookmark).delete(synchronize_session=False)
    db.query(SpacedRepetition).delete(synchronize_session=False)
    db.query(Question).delete(synchronize_session=False)
    db.query(ExamSession).delete(synchronize_session=False)

    # Re-initialize default settings. Only `id` and `initial_seed_completed` are set
    # explicitly; every other field is left unset so SQLAlchemy applies the column
    # defaults declared on the AppSettings model — the single source of truth for
    # what "default" means, also used by GET /settings for a fresh install.
    db.query(AppSettings).delete(synchronize_session=False)
    default_settings = AppSettings(id=1, initial_seed_completed=False)
    db.add(default_settings)
    db.commit()

    return {
        "status": "success",
        "message": "Application has been completely reset to fresh empty state."
    }
