# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
One-time import of pre-existing environment configuration.

Before this layer, the only way to configure AI was GEMINI_API_KEY in
backend/.env. Anyone who did that must not have to do anything again, and must
be able to see -- in the Settings UI, once it exists -- that a provider is
configured. So the first boot after upgrade turns that environment variable
into a real provider row.

The row stores a *reference* to the environment variable, not a copy of the
key: the key already lives in .env, and duplicating it into the database would
create a second copy to leak and keep in sync for no benefit.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.logging_config import logger
from app.llm.gateway import ENV_FALLBACK_KEY_NAME, ENV_FALLBACK_LABEL, ENV_FALLBACK_PROFILE
from app.llm.secrets import env_ref, resolve_secret
from app.models.llm_config import LLMProviderConfig
from app.repositories.llm_repository import LLMConfigRepository


def import_env_provider_if_absent(db: Session) -> Optional[LLMProviderConfig]:
    """
    Create the imported provider row, exactly once.

    Guarded on the table being empty rather than on the row being missing, so a
    user who deliberately deletes it does not get it silently recreated on the
    next restart.

    Returns the created row, or None when nothing needed doing.
    """
    repo = LLMConfigRepository(db)

    if repo.count_providers() > 0:
        return None

    if not resolve_secret(env_ref(ENV_FALLBACK_KEY_NAME)):
        return None

    try:
        created = repo.create_provider(
            name=ENV_FALLBACK_LABEL,
            profile_key=ENV_FALLBACK_PROFILE,
            api_key_ref=env_ref(ENV_FALLBACK_KEY_NAME),
            is_enabled=True,
        )
    except Exception as exc:
        # Never block startup over this. Without the row the gateway still
        # falls back to reading the environment directly, so the app keeps
        # working exactly as it did before.
        db.rollback()
        logger.error(f"Could not import {ENV_FALLBACK_KEY_NAME} into a provider row: {exc}")
        return None

    logger.info(
        f"Imported {ENV_FALLBACK_KEY_NAME} from the environment as provider "
        f"{created.name!r} (id={created.id})."
    )
    return created
