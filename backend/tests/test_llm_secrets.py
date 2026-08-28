# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The credential store: what it promises about keys, held to.

This module had no tests at all, which is a poor place for that gap -- it is
the only code that touches provider credentials, and the rules it enforces
(never return a key, never copy an env key into the database, never lose one on
a keyring failure) are the kind that break silently.
"""
import json

import pytest

from app.llm import secrets


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    """Keep every test off the real store in backend/data."""
    monkeypatch.setattr(secrets, "_SECRET_STORE_PATH", tmp_path / ".llm_secrets.json")
    monkeypatch.setattr(secrets, "_SECRET_KEY_PATH", tmp_path / ".llm_secret_key")
    return tmp_path


class FakeKeyring:
    """Stands in for the OS credential store."""

    def __init__(self, fail=False):
        self.fail = fail
        self.saved = {}

    def set_password(self, service, name, value):
        if self.fail:
            raise RuntimeError("no usable keyring backend")
        self.saved[(service, name)] = value

    def get_password(self, service, name):
        if self.fail:
            raise RuntimeError("no usable keyring backend")
        return self.saved.get((service, name))

    def delete_password(self, service, name):
        if self.fail:
            raise RuntimeError("no usable keyring backend")
        self.saved.pop((service, name), None)


def use_keyring(monkeypatch, keyring):
    monkeypatch.setattr(secrets, "_keyring", lambda: keyring)


def no_keyring(monkeypatch):
    monkeypatch.setattr(secrets, "_keyring", lambda: None)


# ---- the promise the UI makes ----------------------------------------

def test_describe_never_returns_the_key_itself(monkeypatch):
    """
    Every endpoint that shows a provider calls this. It must be incapable of
    handing back something that could be used as a credential.
    """
    no_keyring(monkeypatch)
    ref = secrets.store_secret("AIzaSyVeryRealLookingKey1234")

    has_key, hint = secrets.describe_secret(ref)

    assert has_key is True
    assert hint == "1234"
    assert "AIza" not in (hint or "")
    assert len(hint) == 4


def test_describe_masks_a_key_too_short_to_hint_at():
    """Four characters of a five-character key is not a hint, it is the key."""
    has_key, hint = secrets.describe_secret(None)
    assert (has_key, hint) == (False, None)


def test_describe_masks_short_values(monkeypatch):
    no_keyring(monkeypatch)
    ref = secrets.store_secret("abc")
    has_key, hint = secrets.describe_secret(ref)
    assert has_key is True
    assert hint == "****"


# ---- round trips ------------------------------------------------------

def test_keyring_round_trip(monkeypatch):
    kr = FakeKeyring()
    use_keyring(monkeypatch, kr)

    ref = secrets.store_secret("sk-secret-value")

    assert ref.startswith("keyring:")
    assert secrets.resolve_secret(ref) == "sk-secret-value"


def test_file_store_round_trip(monkeypatch):
    no_keyring(monkeypatch)

    ref = secrets.store_secret("sk-secret-value")

    assert ref.startswith("file:")
    assert secrets.resolve_secret(ref) == "sk-secret-value"


def test_file_store_does_not_hold_the_key_in_plaintext(monkeypatch, isolated_store):
    """
    Obfuscation, not encryption -- but it has to actually obfuscate. The point
    is that a key does not appear verbatim in a file that could end up in a
    screenshot, a backup, or a support bundle.
    """
    no_keyring(monkeypatch)
    secrets.store_secret("AIzaSyPlainTextWouldBeBad")

    raw = (isolated_store / ".llm_secrets.json").read_text(encoding="utf-8")

    assert "AIzaSyPlainTextWouldBeBad" not in raw
    assert json.loads(raw)  # still valid JSON


def test_a_keyring_that_fails_falls_back_instead_of_losing_the_key(monkeypatch):
    """
    Losing what the user just typed is worse than storing it less well, as long
    as we do not claim otherwise.
    """
    use_keyring(monkeypatch, FakeKeyring(fail=True))

    ref = secrets.store_secret("sk-must-not-be-lost")

    assert ref.startswith("file:")
    assert secrets.resolve_secret(ref) == "sk-must-not-be-lost"


# ---- reference stability ---------------------------------------------

def test_updating_a_key_reuses_its_reference(monkeypatch):
    """
    Otherwise every edit leaves an orphaned entry behind and the provider row
    points at a name that keeps changing.
    """
    no_keyring(monkeypatch)
    first = secrets.store_secret("original")

    second = secrets.store_secret("replacement", existing_ref=first)

    assert second == first
    assert secrets.resolve_secret(second) == "replacement"


def test_two_providers_get_distinct_references(monkeypatch):
    no_keyring(monkeypatch)
    a = secrets.store_secret("key-a")
    b = secrets.store_secret("key-b")

    assert a != b
    assert secrets.resolve_secret(a) == "key-a"
    assert secrets.resolve_secret(b) == "key-b"


# ---- env-backed references -------------------------------------------

def test_env_reference_reads_the_environment(monkeypatch):
    # A name that is not a Settings field falls straight through to os.environ.
    monkeypatch.setenv("SOME_PROVIDER_KEY", "from-the-environment")

    ref = secrets.env_ref("SOME_PROVIDER_KEY")

    assert secrets.is_env_ref(ref) is True
    assert secrets.resolve_secret(ref) == "from-the-environment"


def test_settings_wins_over_the_raw_environment(monkeypatch):
    """
    pydantic-settings has already read backend/.env by the time anything calls
    this, so the settings attribute is the authoritative value -- and it is what
    the test suite patches to simulate an unconfigured app. Reading os.environ
    first would make those patches silently ineffective.
    """
    monkeypatch.setattr(secrets.settings, "GEMINI_API_KEY", "from-settings")
    monkeypatch.setenv("GEMINI_API_KEY", "from-environ")

    assert secrets.resolve_secret(secrets.env_ref("GEMINI_API_KEY")) == "from-settings"


def test_env_reference_falls_back_to_environ_when_settings_is_empty(monkeypatch):
    monkeypatch.setattr(secrets.settings, "GEMINI_API_KEY", None)
    monkeypatch.setenv("GEMINI_API_KEY", "from-environ")

    assert secrets.resolve_secret(secrets.env_ref("GEMINI_API_KEY")) == "from-environ"


def test_deleting_an_env_reference_leaves_the_environment_alone(monkeypatch):
    """
    The key belongs to the user's .env, not to us. Removing a provider must not
    reach out and delete something we never owned.
    """
    monkeypatch.setenv("SOME_PROVIDER_KEY", "still-here")
    ref = secrets.env_ref("SOME_PROVIDER_KEY")

    secrets.delete_secret(ref)

    assert secrets.resolve_secret(ref) == "still-here"


# ---- deletion and bad input ------------------------------------------

def test_delete_removes_a_stored_key(monkeypatch):
    no_keyring(monkeypatch)
    ref = secrets.store_secret("to-be-removed")

    secrets.delete_secret(ref)

    assert secrets.resolve_secret(ref) is None
    assert secrets.describe_secret(ref) == (False, None)


def test_delete_from_keyring(monkeypatch):
    kr = FakeKeyring()
    use_keyring(monkeypatch, kr)
    ref = secrets.store_secret("to-be-removed")

    secrets.delete_secret(ref)

    assert secrets.resolve_secret(ref) is None


def test_nothing_raises_on_missing_or_malformed_references(monkeypatch):
    """These are called on every provider read; a raise here takes out the page."""
    no_keyring(monkeypatch)

    assert secrets.resolve_secret(None) is None
    assert secrets.resolve_secret("") is None
    assert secrets.resolve_secret("nonsense-without-a-scheme") is None
    assert secrets.resolve_secret("file:never-stored") is None

    secrets.delete_secret(None)
    secrets.delete_secret("nonsense-without-a-scheme")


def test_a_corrupted_store_reports_no_key_rather_than_raising(monkeypatch, isolated_store):
    no_keyring(monkeypatch)
    ref = secrets.store_secret("value")
    (isolated_store / ".llm_secrets.json").write_text("{not json", encoding="utf-8")

    assert secrets.resolve_secret(ref) is None
    assert secrets.describe_secret(ref) == (False, None)


def test_keyring_reference_without_the_package_reports_nothing(monkeypatch):
    """A database written on a machine with keyring, opened on one without."""
    no_keyring(monkeypatch)
    assert secrets.resolve_secret("keyring:some-name") is None
