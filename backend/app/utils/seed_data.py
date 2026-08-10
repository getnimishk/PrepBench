import os
from pathlib import Path
from sqlalchemy.orm import Session
from app.repositories.question_repository import QuestionRepository
from app.schemas.question import QuestionCreate, QuestionOptionCreate
from app.models.settings import AppSettings
from app.models.question import Question
from app.models.option import QuestionOption
from app.services.import_service import ImportService
from app.core.logging_config import logger

SAMPLE_QUESTIONS = [
    {
        "text": "Who is responsible for managing the progress of work during a Sprint in Scrum?",
        "question_type": "single_choice",
        "difficulty": "easy",
        "domain": "Domain 1: Understanding & Applying Scrum",
        "topic": "Scrum Roles",
        "certification": "PSM I - Professional Scrum Master",
        "explanation": "The Developers are solely responsible for tracking and managing their progress toward the Sprint Goal during the Sprint.",
        "options": [
            {"option_text": "The Scrum Master", "is_correct": False},
            {"option_text": "The Product Owner", "is_correct": False},
            {"option_text": "The Developers", "is_correct": True},
            {"option_text": "The Project Manager", "is_correct": False}
        ]
    }
]

def seed_database_if_empty(db: Session, force: bool = False):
    # Ensure default settings record exists
    app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not app_settings:
        app_settings = AppSettings(id=1, initial_seed_completed=False)
        db.add(app_settings)
        db.commit()
        db.refresh(app_settings)

    repo = QuestionRepository(db)
    current_count = repo.count()

    # Auto-importing is disabled. Seeding only occurs if force=True is explicitly invoked.
    if force:
        from app.core.config import settings as app_cfg
        logger.info("Force re-seed requested. Loading default PSM I Question Bank (PSM_I_Question_Bank.json)...")

        base_dir = Path(__file__).resolve().parent.parent
        primary_json = app_cfg.DEFAULT_QUESTION_BANK_PATH
        fallback_json = base_dir / "data" / "PSM_I_Question_Bank.json"
        md_fallback = base_dir / "data" / "psm1_500_master_bank.md"

        target_file = None
        if primary_json.exists():
            target_file = primary_json
        elif fallback_json.exists():
            target_file = fallback_json

        seeded_count = 0
        import_service = ImportService(db)

        if target_file and target_file.exists():
            try:
                with open(target_file, "r", encoding="utf-8") as f:
                    json_str = f.read()
                res = import_service.import_from_json(json_str)
                seeded_count = res.success_count
                logger.info(f"Successfully seeded {seeded_count} questions from '{target_file}' into database.")
            except Exception as e:
                db.rollback()
                logger.error(f"Error seeding default JSON question bank from '{target_file}': {str(e)}.")
                seeded_count = 0

        if seeded_count == 0 and md_fallback.exists():
            try:
                with open(md_fallback, "r", encoding="utf-8") as f:
                    md_text = f.read()
                parsed = import_service.parse_questions_from_markdown(md_text)
                res = import_service.import_validated_batch(parsed)
                seeded_count = res.success_count
                logger.info(f"Seeded {seeded_count} questions from markdown fallback '{md_fallback}'.")
            except Exception as e:
                db.rollback()
                logger.error(f"Error seeding from markdown fallback: {str(e)}")

        if seeded_count == 0:
            for q_data in SAMPLE_QUESTIONS:
                opts = [QuestionOptionCreate(**opt) for opt in q_data.get("options", [])]
                q_fields = {k: v for k, v in q_data.items() if k != "options"}
                q_create = QuestionCreate(**q_fields, options=opts)
                repo.create(q_create)
            logger.info("Seeded fallback sample questions into database.")

        app_settings.initial_seed_completed = True
        db.commit()
