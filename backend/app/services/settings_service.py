# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from sqlalchemy.orm import Session

from app.core.logging_config import logger
from app.llm.bootstrap import import_env_provider_if_absent
from app.repositories.settings_repository import SettingsRepository
from app.schemas.settings import AppSettingsSchema
from app.utils.seed_interview_questions import seed_interview_questions
from app.utils.seed_system_design_prompts import seed_system_design_prompts
from app.utils.seed_design_reviews import seed_design_reviews


class SettingsService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SettingsRepository(db)

    def get_settings(self) -> AppSettingsSchema:
        return AppSettingsSchema.model_validate(self.repo.get_or_create())

    def update_settings(self, obj_in: AppSettingsSchema) -> AppSettingsSchema:
        return AppSettingsSchema.model_validate(self.repo.update(obj_in.model_dump()))

    def reset_application(self) -> dict:
        """
        Return the app to the state a first-time install starts in.

        That means two things people conflate: every table emptied, *and* the
        built-in content put back. A reset that only empties leaves someone with
        no practice prompts and no interview questions until they happen to
        restart the server, which does not look like a fresh install at all --
        so this runs exactly the same seeding that startup does.
        """
        self.repo.delete_all_rows()

        # Recreate the singleton from model defaults before anything reads it.
        self.repo.get_or_create()

        prompts = seed_system_design_prompts(self.db)
        questions = seed_interview_questions(self.db)
        reviews = seed_design_reviews(self.db)
        # A pre-existing GEMINI_API_KEY becomes a provider row again, exactly as
        # it would on a first boot. The key itself lives in .env and was never
        # in the database to delete.
        import_env_provider_if_absent(self.db)

        logger.info(
            f"Application reset: all tables cleared, reseeded {prompts} system design "
            f"prompts, {questions} interview questions and {reviews} design reviews."
        )

        return {
            "status": "success",
            "message": "Application has been completely reset to fresh empty state.",
        }
