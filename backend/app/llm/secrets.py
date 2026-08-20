"""
Resolving a provider's credential from a reference.

The database stores a *reference* to a secret, never the secret. Phase 1 needs
exactly one scheme -- "env:NAME" -- because the only provider that exists yet
is the one imported from an existing .env, and that key already lives there.
Copying it into the database would create a second copy to keep in sync and
leak, for no benefit.

The other schemes are declared here so the column's contract is settled now
rather than being invented later: "keyring:NAME" for the OS credential store
and "file:NAME" for the fallback, both arriving with the Settings UI that lets
a user actually type a key.
"""
import os
from typing import Optional

from app.core.config import settings
from app.core.logging_config import logger

ENV_SCHEME = "env:"
KEYRING_SCHEME = "keyring:"
FILE_SCHEME = "file:"


def resolve_secret(ref: Optional[str]) -> Optional[str]:
    """
    Look up the value behind a reference. Returns None when there isn't one --
    which is a normal state (local providers need no credential), not an error.
    """
    if not ref:
        return None

    if ref.startswith(ENV_SCHEME):
        name = ref[len(ENV_SCHEME):]
        # settings first: pydantic-settings has already read backend/.env, and
        # the test suite monkeypatches the settings attribute to simulate an
        # unconfigured app.
        from_settings = getattr(settings, name, None)
        return from_settings or os.environ.get(name) or None

    if ref.startswith((KEYRING_SCHEME, FILE_SCHEME)):
        logger.warning(
            f"Secret reference {ref!r} uses a scheme that is not implemented yet; "
            "treating this provider as having no credential."
        )
        return None

    logger.warning(f"Unrecognised secret reference scheme in {ref!r}; ignoring.")
    return None


def env_ref(name: str) -> str:
    return f"{ENV_SCHEME}{name}"
