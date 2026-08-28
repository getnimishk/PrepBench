# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.interview_question import InterviewRoundType
from app.schemas.interview_question import (
    InterviewQuestionResponse,
    InterviewQuestionFilter,
    InterviewQuestionUpdate,
    InterviewQuestionImportResult,
    GenerateInterviewQuestionRequest,
    RoundTypeInfo,
)
from app.services.interview_question_service import InterviewQuestionService
from app.services.interview_question_import_service import InterviewQuestionImportService

router = APIRouter(prefix="/interview-questions", tags=["Interview Questions"])


@router.get("/round-types", response_model=List[RoundTypeInfo])
def list_round_types(db: Session = Depends(get_db)):
    service = InterviewQuestionService(db)
    return service.list_round_types()


@router.get("/categories", response_model=list)
def list_categories(round_type: Optional[InterviewRoundType] = None, db: Session = Depends(get_db)):
    service = InterviewQuestionService(db)
    return service.get_distinct_categories(round_type=round_type.value if round_type else None)


@router.post("/generate", response_model=InterviewQuestionResponse)
def generate_question(req: GenerateInterviewQuestionRequest, db: Session = Depends(get_db)):
    service = InterviewQuestionService(db)
    return service.generate_question(req)


@router.post("/import", response_model=InterviewQuestionImportResult)
async def import_questions(
    default_round_type: InterviewRoundType = Form(...),
    default_category: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    if file is not None:
        content_bytes = await file.read()
        filename = file.filename or "upload.txt"
    elif text:
        content_bytes = text.encode("utf-8")
        filename = "pasted.txt"
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide either a file or pasted text to import.")

    service = InterviewQuestionImportService(db)
    return service.parse_and_import(content_bytes, filename, default_round_type, default_category)


@router.get("", response_model=dict)
def list_questions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    round_type: Optional[InterviewRoundType] = None,
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
):
    filter_params = InterviewQuestionFilter(round_type=round_type, category=category, keyword=keyword)
    service = InterviewQuestionService(db)
    return service.list_questions(skip=skip, limit=limit, filter_params=filter_params)


@router.get("/{question_id}", response_model=InterviewQuestionResponse)
def get_question(question_id: int, db: Session = Depends(get_db)):
    service = InterviewQuestionService(db)
    return service.get_question(question_id)


@router.put("/{question_id}", response_model=InterviewQuestionResponse)
def update_question(question_id: int, req: InterviewQuestionUpdate, db: Session = Depends(get_db)):
    service = InterviewQuestionService(db)
    return service.update_question(question_id, req)


@router.delete("/{question_id}", status_code=status.HTTP_200_OK)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    service = InterviewQuestionService(db)
    service.delete_question(question_id)
    return {"status": "success", "deleted_id": question_id}
