# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionResponse, QuestionFilter, QuestionBulkDeleteRequest
from app.services.question_service import QuestionService
from app.models.question import QuestionDifficulty

from app.schemas.research import QuestionResearchResponse
from app.services.content_validator import ContentValidator

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.get("", response_model=dict)
def list_questions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    keyword: Optional[str] = None,
    domain: Optional[str] = None,
    topic: Optional[str] = None,
    certification: Optional[str] = None,
    difficulty: Optional[QuestionDifficulty] = None,
    is_reviewed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    filter_params = QuestionFilter(
        keyword=keyword,
        domain=domain,
        topic=topic,
        certification=certification,
        difficulty=difficulty,
        is_reviewed=is_reviewed
    )
    service = QuestionService(db)
    return service.list_questions(skip=skip, limit=limit, filter_params=filter_params)

@router.get("/filters", response_model=dict)
def get_question_filters(db: Session = Depends(get_db)):
    service = QuestionService(db)
    return service.get_filters()

@router.get("/{question_id}", response_model=QuestionResponse)
def get_question(question_id: int, db: Session = Depends(get_db)):
    service = QuestionService(db)
    return service.get_question(question_id)

@router.post("", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(obj_in: QuestionCreate, db: Session = Depends(get_db)):
    service = QuestionService(db)
    return service.create_question(obj_in)

@router.put("/{question_id}", response_model=QuestionResponse)
def update_question(question_id: int, obj_in: QuestionUpdate, db: Session = Depends(get_db)):
    service = QuestionService(db)
    return service.update_question(question_id, obj_in)

@router.post("/{question_id}/research", response_model=QuestionResearchResponse)
def research_question(question_id: int, db: Session = Depends(get_db)):
    service = QuestionService(db)
    q = service.get_question(question_id)
    validator = ContentValidator()
    opts = [{"option_text": opt.option_text, "is_correct": opt.is_correct} for opt in q.options]
    research_res = validator.research_question(
        question_id=q.id,
        question_text=q.text,
        options=opts
    )
    return QuestionResearchResponse.model_validate(research_res)

@router.delete("/clear-all", status_code=status.HTTP_200_OK)
def clear_all_questions(db: Session = Depends(get_db)):
    service = QuestionService(db)
    count = service.clear_all_questions()
    return {"message": f"Successfully deleted {count} questions from question bank.", "deleted_count": count}

@router.delete("/bulk", status_code=status.HTTP_200_OK)
def bulk_delete_questions(payload: QuestionBulkDeleteRequest, db: Session = Depends(get_db)):
    service = QuestionService(db)
    count = service.bulk_delete_questions(payload.ids)
    return {"message": f"Successfully deleted {count} questions.", "deleted_count": count}

@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    service = QuestionService(db)
    service.delete_question(question_id)
    return None
