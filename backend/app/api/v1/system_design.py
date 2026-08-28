# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.question import QuestionDifficulty
from app.schemas.system_design import (
    SystemDesignPromptResponse,
    SystemDesignPromptFilter,
    GeneratePromptRequest,
    SubmitAttemptRequest,
    SystemDesignAttemptResponse,
    SystemDesignAnalytics,
)
from app.services.system_design_service import SystemDesignService

router = APIRouter(prefix="/system-design", tags=["System Design"])


@router.get("/prompts", response_model=dict)
def list_prompts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    category: Optional[str] = None,
    difficulty: Optional[QuestionDifficulty] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
):
    filter_params = SystemDesignPromptFilter(category=category, difficulty=difficulty, keyword=keyword)
    service = SystemDesignService(db)
    return service.list_prompts(skip=skip, limit=limit, filter_params=filter_params)


@router.get("/prompts/categories", response_model=list)
def list_prompt_categories(db: Session = Depends(get_db)):
    service = SystemDesignService(db)
    return service.prompt_repo.get_distinct_categories()


@router.get("/prompts/{prompt_id}", response_model=SystemDesignPromptResponse)
def get_prompt(prompt_id: int, db: Session = Depends(get_db)):
    service = SystemDesignService(db)
    return service.get_prompt(prompt_id)


@router.post("/prompts/generate", response_model=SystemDesignPromptResponse)
def generate_prompt(req: GeneratePromptRequest, db: Session = Depends(get_db)):
    service = SystemDesignService(db)
    return service.generate_prompt(req)


@router.post("/attempts", response_model=SystemDesignAttemptResponse, status_code=status.HTTP_201_CREATED)
def submit_attempt(req: SubmitAttemptRequest, db: Session = Depends(get_db)):
    service = SystemDesignService(db)
    return service.submit_attempt(req)


@router.get("/attempts", response_model=dict)
def list_attempts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    service = SystemDesignService(db)
    return service.list_attempts(skip=skip, limit=limit)


@router.get("/attempts/{attempt_id}", response_model=SystemDesignAttemptResponse)
def get_attempt(attempt_id: int, db: Session = Depends(get_db)):
    service = SystemDesignService(db)
    return service.get_attempt(attempt_id)


@router.get("/analytics", response_model=SystemDesignAnalytics)
def get_analytics(db: Session = Depends(get_db)):
    service = SystemDesignService(db)
    return service.get_analytics()
