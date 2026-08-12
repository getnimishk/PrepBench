import uuid
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import DATA_DIR
from app.core.exceptions import ResourceNotFoundException
from app.repositories.recording_repository import PracticeRecordingRepository
from app.repositories.interview_question_repository import InterviewQuestionRepository
from app.schemas.recording import (
    PracticeRecordingResponse,
    RecordingAnalysisResponse,
    AnalyzeRecordingRequest,
    ProviderInfo,
    RecordingAnalytics,
)
from app.services.recording_analysis_service import RecordingAnalysisService

router = APIRouter(prefix="/recordings", tags=["Recordings"])

RECORDINGS_DIR = DATA_DIR / "recordings"
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("", response_model=PracticeRecordingResponse, status_code=status.HTTP_201_CREATED)
async def upload_recording(
    file: UploadFile = File(...),
    title: str = Form("Untitled Recording"),
    duration_seconds: int = Form(None),
    interview_question_id: int = Form(None),
    db: Session = Depends(get_db),
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded recording is empty.")

    if interview_question_id is not None:
        question_repo = InterviewQuestionRepository(db)
        if not question_repo.get_by_id(interview_question_id):
            raise ResourceNotFoundException("InterviewQuestion", interview_question_id)

    mime_type = file.content_type or "audio/webm"
    ext = ".webm"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = RECORDINGS_DIR / filename
    dest_path.write_bytes(contents)

    repo = PracticeRecordingRepository(db)
    obj = repo.create(
        title=title,
        file_path=filename,  # stored relative to RECORDINGS_DIR
        mime_type=mime_type,
        duration_seconds=duration_seconds,
        file_size_bytes=len(contents),
        interview_question_id=interview_question_id,
    )
    return PracticeRecordingResponse.model_validate(obj)


@router.get("", response_model=dict)
def list_recordings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    repo = PracticeRecordingRepository(db)
    items = repo.get_all(skip=skip, limit=limit)
    return {
        "items": [PracticeRecordingResponse.model_validate(r) for r in items],
        "skip": skip,
        "limit": limit,
    }


@router.get("/providers", response_model=List[ProviderInfo])
def list_analysis_providers(db: Session = Depends(get_db)):
    service = RecordingAnalysisService(db)
    return service.list_providers()


@router.get("/analytics", response_model=RecordingAnalytics)
def get_recordings_analytics(db: Session = Depends(get_db)):
    service = RecordingAnalysisService(db)
    return service.get_analytics()


@router.get("/{recording_id}", response_model=PracticeRecordingResponse)
def get_recording(recording_id: int, db: Session = Depends(get_db)):
    repo = PracticeRecordingRepository(db)
    obj = repo.get_by_id(recording_id)
    if not obj:
        raise ResourceNotFoundException("PracticeRecording", recording_id)
    return PracticeRecordingResponse.model_validate(obj)


@router.get("/{recording_id}/audio")
def get_recording_audio(recording_id: int, db: Session = Depends(get_db)):
    repo = PracticeRecordingRepository(db)
    obj = repo.get_by_id(recording_id)
    if not obj:
        raise ResourceNotFoundException("PracticeRecording", recording_id)

    file_path = RECORDINGS_DIR / obj.file_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording file missing from disk.")

    # FileResponse (Starlette) natively supports Range requests, so the
    # browser <audio> element can seek without downloading the whole file.
    return FileResponse(path=str(file_path), media_type=obj.mime_type, filename=f"{obj.title}.webm")


@router.delete("/{recording_id}", status_code=status.HTTP_200_OK)
def delete_recording(recording_id: int, db: Session = Depends(get_db)):
    repo = PracticeRecordingRepository(db)
    obj = repo.get_by_id(recording_id)
    if not obj:
        raise ResourceNotFoundException("PracticeRecording", recording_id)

    file_path = RECORDINGS_DIR / obj.file_path
    deleted = repo.delete(recording_id)

    # Remove the file from disk after the DB row is gone, so a failed delete
    # never leaves an orphaned DB row pointing at a missing file.
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            pass

    return {"status": "success", "deleted_id": recording_id}


@router.post("/{recording_id}/analyze", response_model=RecordingAnalysisResponse)
def analyze_recording(recording_id: int, req: AnalyzeRecordingRequest, db: Session = Depends(get_db)):
    service = RecordingAnalysisService(db)
    return service.analyze_recording(recording_id, provider_name=req.provider)


@router.get("/{recording_id}/analysis", response_model=RecordingAnalysisResponse)
def get_recording_analysis(recording_id: int, db: Session = Depends(get_db)):
    service = RecordingAnalysisService(db)
    analysis = service.get_analysis(recording_id)
    if not analysis:
        raise ResourceNotFoundException("RecordingAnalysis", recording_id)
    return analysis
