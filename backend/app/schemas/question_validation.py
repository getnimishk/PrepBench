# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from pydantic import BaseModel
from app.schemas.question import QuestionCreate

class ContentJudgment(BaseModel):
    judged_correct_options: List[str]        # e.g. ["B", "D"] — what the LLM independently judged
    stated_correct_options: List[str]        # what the stored question claims is correct
    agrees_with_stated_key: bool
    judge_reasoning: str
    grounding_chunk_ids: List[int] = []       # Scrum Guide grounding passages used
    error_category: str = "content"          # "structural" | "content" | "duplication"
    human_review_required: bool = False
    validation_status: str = "verified"       # "verified" | "unverified" | "skipped"
    validation_skipped: bool = False

class ValidationErrorItem(BaseModel):
    severity: str # "error", "warning", "info"
    field: str
    message: str
    error_category: str = "structural"       # "structural" | "content" | "duplication"

class ValidatedQuestionItem(BaseModel):
    index: int
    question: Optional[QuestionCreate] = None
    status: str # "valid", "warning", "error"
    issues: List[ValidationErrorItem] = []
    content_judgment: Optional[ContentJudgment] = None
    human_review_required: bool = False

class QuestionValidationReport(BaseModel):
    total_processed: int
    valid_count: int
    warning_count: int
    error_count: int
    items: List[ValidatedQuestionItem] = []
