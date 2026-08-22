"""
Storing and resolving provider credentials.

The database holds a *reference*, never the secret. Three schemes:

  env:NAME      the value lives in the environment / backend/.env. Used by the
                one-time import of a pre-existing GEMINI_API_KEY, which is left
                where it already is rather than copied.
  keyring:NAME  the OS credential store (Windows Credential Manager, macOS
                Keychain, Secret Service). Used when the `keyring` package is
                installed.
  file:NAME     a local obfuscated store, used when no keyring is available.

Be clear about what the file fallback is: obfuscation, not encryption. The
key sits beside the data on a single-user offline desktop, so anyone who can
read one can read the other. What it genuinely prevents is casual leakage --
the key showing up in a screenshot, a support log, a backup, or a shared
.env -- and that is the threat that actually occurs here. It is never
described in the UI as anything stronger.
"""
import base64
import json
import os
import uuid
from typing import Optional, Tuple

from app.core.config import DATA_DIR, settings
from app.core.logging_config import logger

ENV_SCHEME = "env:"
KEYRING_SCHEME = "keyring:"
FILE_SCHEME = "file:"

KEYRING_SERVICE = "PrepBench"

_SECRET_STORE_PATH = DATA_DIR / ".llm_secrets.json"
_SECRET_KEY_PATH = DATA_DIR / ".llm_secret_key"


# ---- keyring (optional dependency) -----------------------------------

def _keyring():
    """Return the keyring module, or None when it isn't installed/usable."""
    try:
        import keyring  # noqa: PLC0415 -- optional, probed at call time

        # An unusable backend (headless Linux with no Secret Service) raises
        # only when used, so probing the backend name here is not enough.
        return keyring
    except Exception:
        return None


# ---- obfuscated file fallback ----------------------------------------

def _obfuscation_key() -> bytes:
    if _SECRET_KEY_PATH.exists():
        return _SECRET_KEY_PATH.read_bytes()

    key = os.urandom(32)
    _SECRET_KEY_PATH.write_bytes(key)
    try:
        # Best effort: meaningless on Windows, real on POSIX.
        os.chmod(_SECRET_KEY_PATH, 0o600)
    except OSError:
        pass
    return key


def _xor(data: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def _read_file_store() -> dict:
    if not _SECRET_STORE_PATH.exists():
        return {}
    try:
        return json.loads(_SECRET_STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.error(f"Could not read the local secret store: {exc}")
        return {}


def _write_file_store(store: dict) -> None:
    _SECRET_STORE_PATH.write_text(json.dumps(store), encoding="utf-8")
    try:
        os.chmod(_SECRET_STORE_PATH, 0o600)
    except OSError:
        pass


def _file_set(name: str, value: str) -> None:
    store = _read_file_store()
    store[name] = base64.b64encode(_xor(value.encode("utf-8"), _obfuscation_key())).decode("ascii")
    _write_file_store(store)


def _file_get(name: str) -> Optional[str]:
    blob = _read_file_store().get(name)
    if not blob:
        return None
    try:
        return _xor(base64.b64decode(blob), _obfuscation_key()).decode("utf-8")
    except Exception as exc:
        logger.error(f"Could not decode stored secret {name!r}: {exc}")
        return None


def _file_delete(name: str) -> None:
    store = _read_file_store()
    if store.pop(name, None) is not None:
        _write_file_store(store)


# ---- public API -------------------------------------------------------

def resolve_secret(ref: Optional[str]) -> Optional[str]:
    """
    Look up the value behind a reference.

    None is a normal outcome, not an error -- local providers need no
    credential at all.
    """
    if not ref:
        return None

    if ref.startswith(ENV_SCHEME):
        name = ref[len(ENV_SCHEME):]
        # settings first: pydantic-settings has already read backend/.env, and
        # the test suite patches the settings attribute to simulate an
        # unconfigured app.
        return getattr(settings, name, None) or os.environ.get(name) or None

    if ref.startswith(KEYRING_SCHEME):
        name = ref[len(KEYRING_SCHEME):]
        kr = _keyring()
        if kr is None:
            logger.warning(f"Secret {ref!r} needs the keyring package, which is not installed.")
            return None
        try:
            return kr.get_password(KEYRING_SERVICE, name)
        except Exception as exc:
            logger.error(f"Could not read {ref!r} from the OS keyring: {exc}")
            return None

    if ref.startswith(FILE_SCHEME):
        return _file_get(ref[len(FILE_SCHEME):])

    logger.warning(f"Unrecognised secret reference scheme in {ref!r}; ignoring.")
    return None


def store_secret(value: str, existing_ref: Optional[str] = None) -> str:
    """
    Persist a credential and return the reference to store in the database.

    Reuses `existing_ref`'s name when updating, so a provider's reference stays
    stable across edits and no orphaned entries accumulate.
    """
    name = None
    if existing_ref and existing_ref.startswith((KEYRING_SCHEME, FILE_SCHEME)):
        name = existing_ref.split(":", 1)[1]
    if not name:
        name = f"provider-{uuid.uuid4().hex[:12]}"

    kr = _keyring()
    if kr is not None:
        try:
            kr.set_password(KEYRING_SERVICE, name, value)
            return f"{KEYRING_SCHEME}{name}"
        except Exception as exc:
            # Fall through to the file store rather than failing the save --
            # losing the user's typed key would be worse than storing it less
            # well, as long as we do not claim otherwise.
            logger.warning(f"OS keyring unavailable ({exc}); using the local obfuscated store.")

    _file_set(name, value)
    return f"{FILE_SCHEME}{name}"


def delete_secret(ref: Optional[str]) -> None:
    """Remove a stored credential. Never raises; env-backed refs are left alone."""
    if not ref:
        return

    if ref.startswith(KEYRING_SCHEME):
        name = ref[len(KEYRING_SCHEME):]
        kr = _keyring()
        if kr is not None:
            try:
                kr.delete_password(KEYRING_SERVICE, name)
            except Exception:
                pass
        return

    if ref.startswith(FILE_SCHEME):
        _file_delete(ref[len(FILE_SCHEME):])


def describe_secret(ref: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    (has_key, hint) for display. The hint is the last four characters, which is
    enough to tell two keys apart and not enough to use one.

    The value itself is never returned to a caller that might serialise it.
    """
    value = resolve_secret(ref)
    if not value:
        return False, None
    return True, value[-4:] if len(value) >= 4 else "****"


def is_env_ref(ref: Optional[str]) -> bool:
    return bool(ref and ref.startswith(ENV_SCHEME))


def env_ref(name: str) -> str:
    return f"{ENV_SCHEME}{name}"
