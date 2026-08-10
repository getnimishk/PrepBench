from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.exam import ExamCreateRequest, SaveAnswerRequest, ExamSessionResponse, ExamDetailResponse
from app.services.exam_engine import ExamEngine
from app.repositories.exam_repository import ExamRepository

router = APIRouter(prefix="/exams", tags=["Exams Engine"])

@router.post("", response_model=ExamSessionResponse, status_code=status.HTTP_201_CREATED)
def start_exam(req: ExamCreateRequest, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.create_exam(req)

@router.get("", response_model=List[ExamSessionResponse])
def list_exams(skip: int = Query(0, ge=0), limit: int = Query(50, ge=1), db: Session = Depends(get_db)):
    repo = ExamRepository(db)
    sessions = repo.get_all_sessions(skip=skip, limit=limit)
    return [ExamSessionResponse.model_validate(s) for s in sessions]

@router.get("/{session_id}", response_model=ExamDetailResponse)
def get_exam_details(session_id: int, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.get_exam_details(session_id)

@router.post("/{session_id}/answer", response_model=ExamSessionResponse)
def save_answer(session_id: int, req: SaveAnswerRequest, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.save_answer(session_id, req)

@router.post("/{session_id}/finish", response_model=ExamDetailResponse)
def finish_exam(session_id: int, db: Session = Depends(get_db)):
    engine = ExamEngine(db)
    return engine.finish_exam(session_id)
