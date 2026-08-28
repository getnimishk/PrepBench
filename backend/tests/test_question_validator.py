# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import pytest
from app.core.database import SessionLocal
from app.schemas.question import QuestionCreate, QuestionOptionCreate
from app.models.question import QuestionType, QuestionDifficulty
from app.services.question_validator import QuestionValidator

def test_question_validator_basic_rules():
    db = SessionLocal()
    try:
        validator = QuestionValidator(db)

        # 1. Valid Question
        valid_q = QuestionCreate(
            text="What is the primary role of the Scrum Master during Sprint Planning?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.MEDIUM,
            domain="Scrum",
            topic="Roles",
            certification="PSM I",
            options=[
                QuestionOptionCreate(option_text="Option A", is_correct=True),
                QuestionOptionCreate(option_text="Option B", is_correct=False),
            ]
        )
        res_valid = validator.validate_question(valid_q, 1)
        assert res_valid.status == "valid"
        assert len(res_valid.issues) == 0

        # 2. Invalid Question - Single choice with 2 correct answers
        invalid_q = QuestionCreate(
            text="Which of the following are Scrum artifacts?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.MEDIUM,
            domain="Scrum",
            topic="Artifacts",
            certification="PSM I",
            options=[
                QuestionOptionCreate(option_text="Option A", is_correct=True),
                QuestionOptionCreate(option_text="Option B", is_correct=True),
            ]
        )
        res_invalid = validator.validate_question(invalid_q, 2)
        assert res_invalid.status == "error"
        assert any("cannot have 2 correct answers" in i.message for i in res_invalid.issues)

        # 3. Duplicate Option Text
        dup_opt_q = QuestionCreate(
            text="What is the maximum length of a Sprint in Scrum?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.EASY,
            domain="Scrum",
            topic="Events",
            certification="PSM I",
            options=[
                QuestionOptionCreate(option_text="One Month", is_correct=True),
                QuestionOptionCreate(option_text="one month", is_correct=False),
            ]
        )
        res_dup = validator.validate_question(dup_opt_q, 3)
        assert res_dup.status == "error"
        assert any("Duplicate choice text found" in i.message for i in res_dup.issues)
    finally:
        db.close()


def test_prompt_intent_mismatch():
    db = SessionLocal()
    try:
        validator = QuestionValidator(db)

        # Prompt says "Choose 2 answers", but only 1 option is marked correct
        mismatch_q = QuestionCreate(
            text="Which of the following are primary accountabilities in Scrum? (Choose 2 answers)",
            question_type=QuestionType.MULTIPLE_CHOICE,
            difficulty=QuestionDifficulty.MEDIUM,
            domain="Scrum",
            topic="Accountabilities",
            certification="PSM I",
            options=[
                QuestionOptionCreate(option_text="Scrum Master", is_correct=True),
                QuestionOptionCreate(option_text="Project Manager", is_correct=False),
                QuestionOptionCreate(option_text="Developers", is_correct=False),
            ]
        )
        res = validator.validate_question(mismatch_q, 1)
        assert res.status == "error"
        assert any("Prompt explicitly requests '2' answers" in i.message for i in res.issues)
    finally:
        db.close()


def test_explanation_cross_reference_mismatch():
    db = SessionLocal()
    try:
        validator = QuestionValidator(db)

        # Explanation says Option C is correct, but Option A is marked correct
        expl_q = QuestionCreate(
            text="Who is accountable for managing the Product Backlog?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.MEDIUM,
            domain="Scrum",
            topic="Roles",
            certification="PSM I",
            explanation="Option C is correct because the Product Owner owns the Product Backlog.",
            options=[
                QuestionOptionCreate(option_text="Scrum Master", is_correct=True),
                QuestionOptionCreate(option_text="Developers", is_correct=False),
                QuestionOptionCreate(option_text="Product Owner", is_correct=False),
            ]
        )
        res = validator.validate_question(expl_q, 1)
        assert res.status == "error"
        assert any("Explanation claims Option C is correct, but Option C is marked incorrect" in i.message for i in res.issues)
    finally:
        db.close()


def test_option_hygiene_and_positional_warning():
    db = SessionLocal()
    try:
        validator = QuestionValidator(db)

        # Option 1 contains redundant label prefix "A. " and "All of the above" at position #1
        opt_q = QuestionCreate(
            text="Which Scrum events are time-boxed?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.EASY,
            domain="Scrum",
            topic="Events",
            certification="PSM I",
            options=[
                QuestionOptionCreate(option_text="A. All of the above", is_correct=True),
                QuestionOptionCreate(option_text="Sprint Planning", is_correct=False),
            ]
        )
        res = validator.validate_question(opt_q, 1)
        assert res.status == "warning"
        messages = [i.message for i in res.issues]
        assert any("redundant label prefix" in m for m in messages)
        assert any("Positional choice" in m for m in messages)
    finally:
        db.close()


def test_intra_batch_deduplication():
    db = SessionLocal()
    try:
        validator = QuestionValidator(db)

        q1 = QuestionCreate(
            text="What is the recommended size for a Development Team?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.MEDIUM,
            domain="Scrum",
            topic="Team",
            certification="PSM I",
            options=[
                QuestionOptionCreate(option_text="3 to 9 members", is_correct=True),
                QuestionOptionCreate(option_text="10 to 15 members", is_correct=False),
            ]
        )
        # Identical question text in same batch
        q2 = QuestionCreate(
            text="What is the recommended size for a Development Team?",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.MEDIUM,
            domain="Scrum",
            topic="Team",
            certification="PSM I",
            options=[
                QuestionOptionCreate(option_text="3 to 9 members", is_correct=True),
                QuestionOptionCreate(option_text="10 to 15 members", is_correct=False),
            ]
        )
        report = validator.validate_batch([q1, q2])
        assert report.items[1].status == "warning"
        assert any("Duplicate question text found (identical to question #1 in this batch)" in i.message for i in report.items[1].issues)
    finally:
        db.close()
