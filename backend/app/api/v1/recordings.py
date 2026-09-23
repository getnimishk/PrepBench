# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import RECORDINGS_DIR, recording_file
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

RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

# Roughly 3 hours of Opus-encoded speech -- far beyond any realistic interview
# answer, while still bounding what a mistaken file pick can consume.
MAX_RECORDING_BYTES = 100 * 1024 * 1024

# MediaRecorder reports audio-only WebM as either audio/webm or video/webm
# depending on the browser, so both are legitimate here.
ALLOWED_MIME_PREFIXES = ("audio/",)
ALLOWED_MIME_EXACT = {"video/webm"}
FALLBACK_MIME = "audio/webm"


def _safe_mime_type(raw: str | None) -> str:
    """
    Constrain the stored MIME type to audio.

    It is echoed straight back on download via FileResponse(media_type=...),
    so accepting whatever the client sends would let a file be served from
    this origin under an attacker-chosen type. Anything unrecognised is
    rejected rather than silently coerced, so a genuine format mismatch
    surfaces at upload instead of as a broken player later.
    """
    if not raw:
        return FALLBACK_MIME
    normalized = raw.split(";")[0].strip().lower()
    if normalized.startswith(ALLOWED_MIME_PREFIXES) or normalized in ALLOWED_MIME_EXACT:
        return normalized
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported recording type '{normalized}'. Expected an audio format.",
    )


@router.post("", response_model=PracticeRecordingResponse, status_code=status.HTTP_201_CREATED)
async def upload_recording(
    file: UploadFile = File(...),
    title: str = Form("Untitled Recording"),
    duration_seconds: int = Form(None),
    interview_question_id: int = Form(None),
    session_id: int = Form(None),
    plan_note: str = Form(None),
    db: Session = Depends(get_db),
):
    # Validate the declared type before reading the body, so an obviously
    # wrong upload is rejected without buffering it at all.
    mime_type = _safe_mime_type(file.content_type)

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded recording is empty.")
    if len(contents) > MAX_RECORDING_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Recording exceeds the {MAX_RECORDING_BYTES // (1024 * 1024)}MB limit.",
        )

    if interview_question_id is not None:
        question_repo = InterviewQuestionRepository(db)
        if not question_repo.get_by_id(interview_question_id):
            raise ResourceNotFoundException("InterviewQuestion", interview_question_id)

    if session_id is not None:
        from app.models.interview_session import InterviewSession

        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if session is None:
            raise ResourceNotFoundException("InterviewSession", session_id)
        # A take filed under a session must answer one of its questions, or the
        # session report would count an answer to something it never asked.
        if interview_question_id is None or interview_question_id not in (session.question_ids or []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This answer is not to one of the session's questions.",
            )

    plan_note = (plan_note or "").strip() or None

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
        session_id=session_id,
        plan_note=plan_note,
    )
    return PracticeRecordingResponse.model_validate(obj)


def _with_analysis_summary(recording) -> PracticeRecordingResponse:
    analysis = recording.analysis
    analysed = analysis is not None and analysis.analysis_status == "analyzed"
    return PracticeRecordingResponse.model_validate(recording).model_copy(update={
        "analysis_status": analysis.analysis_status if analysis is not None else None,
        "content_percent": RecordingAnalysisService._avg_pct(analysis.content_scores or []) if analysed else None,
        "delivery_percent": RecordingAnalysisService._avg_pct(analysis.communication_scores or []) if analysed else None,
    })


@router.get("", response_model=dict)
def list_recordings(
    skip: int = 0,
    limit: int = 100,
    interview_question_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Recordings, newest first. With interview_question_id, only that question's
    takes -- what a take is compared against."""
    repo = PracticeRecordingRepository(db)
    items = repo.get_all(skip=skip, limit=limit, interview_question_id=interview_question_id)
    return {
        "items": [_with_analysis_summary(r) for r in items],
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

    try:
        file_path = recording_file(obj.file_path)
    except ValueError as outside:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(outside))
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

    try:
        file_path = recording_file(obj.file_path)
    except ValueError:
        # The row is still removable; only the file beside it is not this one's to delete.
        file_path = None
    deleted = repo.delete(recording_id)

    # Remove the file from disk after the DB row is gone, so a failed delete
    # never leaves an orphaned DB row pointing at a missing file.
    if file_path is not None and file_path.exists():
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
