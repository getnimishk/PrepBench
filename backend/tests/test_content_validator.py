# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from app.core.database import SessionLocal
from app.schemas.question import QuestionCreate, QuestionOptionCreate
from app.models.question import QuestionType, QuestionDifficulty
from app.services.question_validator import QuestionValidator
from app.schemas.question_validation import ContentJudgment, ValidationErrorItem

def test_content_judgment_schema_integration():
    judgment = ContentJudgment(
        judged_correct_options=["B"],
        stated_correct_options=["A"],
        agrees_with_stated_key=False,
        judge_reasoning="The Scrum Guide states that Daily Scrum is held at the same time and place.",
        grounding_chunk_ids=[1, 2],
        error_category="content",
        human_review_required=True
    )
    assert judgment.agrees_with_stated_key is False
    assert judgment.human_review_required is True
    assert judgment.judged_correct_options == ["B"]

def test_question_validator_with_content_validation_fallback():
    db = SessionLocal()
    try:
        validator = QuestionValidator(db, enable_content_validator=False)
        
        q = QuestionCreate(
            text="What is the timebox for the Daily Scrum in a 1-month Sprint?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.EASY,
            domain="Agile & Scrum",
            topic="Daily Scrum",
            options=[
                QuestionOptionCreate(option_text="15 minutes", is_correct=True, order_index=0),
                QuestionOptionCreate(option_text="30 minutes", is_correct=False, order_index=1),
                QuestionOptionCreate(option_text="45 minutes", is_correct=False, order_index=2),
                QuestionOptionCreate(option_text="1 hour", is_correct=False, order_index=3)
            ]
        )

        result = validator.validate_question(q, index=1, validate_content=True)
        assert result.status == "valid"
        assert result.human_review_required is False
        assert len(result.issues) == 0
    finally:
        db.close()

def test_content_validator_is_available_true():
    from app.services.content_validator import ContentValidator
    cv = ContentValidator()
    assert cv.is_available() is True
    assert cv.retriever is not None
