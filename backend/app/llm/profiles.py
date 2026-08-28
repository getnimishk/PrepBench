# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Loads the provider catalogue.

Two files, merged: the built-in one that ships with the app, and an optional
user-supplied one in the writable data directory. The second is what makes
this genuinely vendor-agnostic rather than "agnostic across the vendors we
happened to list" -- someone can point PrepBench at a provider that did not
exist when their copy was built, without waiting for a release.
"""
import json
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import urlparse

from app.core.config import BASE_DIR, DATA_DIR
from app.core.logging_config import logger
from app.llm.types import Capability

BUILTIN_PROFILES_PATH = BASE_DIR / "app" / "data" / "llm_profiles.json"
CUSTOM_PROFILES_PATH = DATA_DIR / "llm_profiles.custom.json"

# Hosts that mean "this machine". Used to infer is_local for a custom endpoint
# the user typed, which determines which timeout budget the task gets.
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"}

_cache: Optional[Dict[str, dict]] = None


def _read(path: Path) -> Dict[str, dict]:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        # A malformed custom file must not take the app down -- it degrades to
        # the built-in catalogue, loudly.
        logger.error(f"Could not read LLM profiles from {path}: {exc}")
        return {}
    if not isinstance(raw, dict):
        logger.error(f"LLM profiles at {path} is not a JSON object; ignoring.")
        return {}
    return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, dict)}


def load_profiles(refresh: bool = False) -> Dict[str, dict]:
    global _cache
    if _cache is None or refresh:
        merged = _read(BUILTIN_PROFILES_PATH)
        merged.update(_read(CUSTOM_PROFILES_PATH))
        _cache = merged
    return _cache


def get_profile(profile_key: str) -> Optional[dict]:
    return load_profiles().get(profile_key)


def profile_capabilities(profile: dict) -> frozenset:
    """Parse the declared capability list, skipping anything unrecognised."""
    out = set()
    for raw in profile.get("capabilities", []):
        try:
            out.add(Capability(raw))
        except ValueError:
            logger.warning(f"Unknown capability {raw!r} in LLM profile; ignoring.")
    return frozenset(out)


def default_model_for(profile: dict, capability: Capability) -> Optional[str]:
    return (profile.get("default_models") or {}).get(capability.value)


def infer_is_local(profile: dict, base_url: Optional[str]) -> bool:
    """
    A profile states is_local outright; a custom endpoint leaves it null and we
    infer it from the host. Getting this right matters beyond labelling -- it
    picks the timeout budget, and a local model given a cloud timeout will be
    cut off mid-answer.
    """
    declared = profile.get("is_local")
    if isinstance(declared, bool):
        return declared
    if not base_url:
        return False
    try:
        host = (urlparse(base_url).hostname or "").lower()
    except ValueError:
        return False
    return host in _LOCAL_HOSTS
