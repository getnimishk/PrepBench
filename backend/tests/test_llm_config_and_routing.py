# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Database-backed provider configuration: env import, routing, and capability
refusal.

These use the isolated test database from conftest, and clean up after
themselves so ordering against the rest of the suite stays irrelevant.
"""
import uuid

import pytest

from app.llm.bootstrap import import_env_provider_if_absent
from app.llm.gateway import ENV_FALLBACK_LABEL, LLMGateway
from app.llm.types import TASK_SPECS, LLMTask
from app.models.llm_config import LLMProviderConfig, LLMTaskBinding
from app.repositories.llm_repository import LLMConfigRepository
from tests.conftest import TestingSessionLocal
from tests.llm_fakes import (
    clear_env_provider,
    fake_openai_text_response,
    patch_gateway_transport,
    set_env_provider,
)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def clean_llm_tables():
    """
    Empty both tables around every test in this module.

    The env-import guard keys off the provider table being empty, so a row left
    behind by one test would silently change what the next one exercises.
    """
    def _wipe():
        session = TestingSessionLocal()
        try:
            session.query(LLMTaskBinding).delete()
            session.query(LLMProviderConfig).delete()
            session.commit()
        finally:
            session.close()

    _wipe()
    yield
    _wipe()


def _make_provider(db, **overrides) -> LLMProviderConfig:
    fields = dict(
        name=f"provider-{uuid.uuid4().hex[:8]}",
        profile_key="llamafile",
        is_enabled=True,
    )
    fields.update(overrides)
    return LLMConfigRepository(db).create_provider(**fields)


# ---- Env import -------------------------------------------------------

def test_env_key_is_imported_as_a_visible_provider_row(db, monkeypatch):
    set_env_provider(monkeypatch)

    created = import_env_provider_if_absent(db)

    assert created is not None
    assert created.name == ENV_FALLBACK_LABEL
    assert created.profile_key == "gemini"
    # A reference to the environment variable, never a copy of the key itself.
    assert created.api_key_ref == "env:GEMINI_API_KEY"


def test_env_import_is_idempotent(db, monkeypatch):
    set_env_provider(monkeypatch)

    first = import_env_provider_if_absent(db)
    second = import_env_provider_if_absent(db)

    assert first is not None
    assert second is None, "second boot must not create a duplicate"
    assert LLMConfigRepository(db).count_providers() == 1


def test_no_env_key_imports_nothing(db, monkeypatch):
    clear_env_provider(monkeypatch)
    assert import_env_provider_if_absent(db) is None
    assert LLMConfigRepository(db).count_providers() == 0


def test_env_import_skipped_when_the_user_already_configured_something(db, monkeypatch):
    """Guarded on the table being empty, so a deliberately deleted row is not
    silently resurrected on the next restart."""
    set_env_provider(monkeypatch)
    _make_provider(db, name="My Llamafile")

    assert import_env_provider_if_absent(db) is None
    assert LLMConfigRepository(db).count_providers() == 1


# ---- Routing ----------------------------------------------------------

def test_configured_provider_is_preferred_over_the_env_fallback(db, monkeypatch):
    set_env_provider(monkeypatch)
    _make_provider(db, name="My Llamafile", profile_key="llamafile",
                   default_text_model="qwen3-4b")

    conn, model, reason = LLMGateway(db).resolve(LLMTask.SYSTEM_DESIGN_GRADING)

    assert reason is None
    assert conn.profile_key == "llamafile"
    assert model == "qwen3-4b"


def test_disabled_provider_is_skipped(db, monkeypatch):
    clear_env_provider(monkeypatch)
    _make_provider(db, profile_key="llamafile", default_text_model="qwen3-4b", is_enabled=False)

    conn, _, reason = LLMGateway(db).resolve(LLMTask.SYSTEM_DESIGN_GRADING)

    assert conn is None
    assert reason is not None


def test_binding_routes_one_task_to_a_specific_provider(db, monkeypatch):
    """The 'grade in the cloud, generate locally' case."""
    set_env_provider(monkeypatch)
    local = _make_provider(db, name="Local", profile_key="llamafile", default_text_model="qwen3-4b")
    repo = LLMConfigRepository(db)
    repo.upsert_binding(LLMTask.INTERVIEW_QUESTION_GEN.value, local.id, "qwen3-4b")

    gateway = LLMGateway(db)

    bound_conn, bound_model, _ = gateway.resolve(LLMTask.INTERVIEW_QUESTION_GEN)
    assert bound_conn.profile_key == "llamafile" and bound_model == "qwen3-4b"

    # An unbound task still resolves independently.
    other_conn, _, _ = gateway.resolve(LLMTask.SYSTEM_DESIGN_GRADING)
    assert other_conn is not None


def test_deleting_a_bound_provider_degrades_to_the_default(db, monkeypatch):
    """ON DELETE SET NULL: routing falls back rather than orphaning or
    cascading. This only genuinely fires because the test engine enables
    foreign keys (see core/database.register_sqlite_pragmas)."""
    set_env_provider(monkeypatch)
    local = _make_provider(db, name="Local", profile_key="llamafile", default_text_model="qwen3-4b")
    repo = LLMConfigRepository(db)
    repo.upsert_binding(LLMTask.INTERVIEW_QUESTION_GEN.value, local.id, "qwen3-4b")

    db.query(LLMProviderConfig).filter(LLMProviderConfig.id == local.id).delete()
    db.commit()

    binding = repo.get_binding(LLMTask.INTERVIEW_QUESTION_GEN.value)
    assert binding is not None, "the binding row should survive"
    assert binding.provider_config_id is None, "its provider reference should be cleared"

    # And the task still resolves, via the env fallback.
    conn, _, _ = LLMGateway(db).resolve(LLMTask.INTERVIEW_QUESTION_GEN)
    assert conn is not None


def test_provider_without_the_capability_is_not_selected(db, monkeypatch):
    """A text-only local model must never be handed audio work. It reports
    unavailable rather than failing obscurely partway through."""
    clear_env_provider(monkeypatch)
    _make_provider(db, profile_key="llamafile", default_text_model="qwen3-4b")

    gateway = LLMGateway(db)

    assert gateway.is_available(LLMTask.SYSTEM_DESIGN_GRADING) is True
    assert gateway.is_available(LLMTask.RECORDING_ANALYSIS) is False

    result = gateway.run(LLMTask.RECORDING_ANALYSIS, "grade this", media_bytes=b"audio")
    assert result.status == "unavailable"
    assert result.data is None


def test_local_provider_gets_the_local_timeout_budget(db, monkeypatch):
    clear_env_provider(monkeypatch)
    _make_provider(db, profile_key="llamafile", default_text_model="qwen3-4b")

    captured = {}
    patch_gateway_transport(
        monkeypatch, fake_openai_text_response({"overall_score": 70}), capture=captured
    )
    LLMGateway(db).run(LLMTask.SYSTEM_DESIGN_GRADING, "prompt")

    assert captured["timeout"] == TASK_SPECS[LLMTask.SYSTEM_DESIGN_GRADING].local_timeout
    assert captured["timeout"] != TASK_SPECS[LLMTask.SYSTEM_DESIGN_GRADING].cloud_timeout


def test_a_local_provider_answers_end_to_end(db, monkeypatch):
    """The whole point of the change: same task, same call site, a local
    OpenAI-compatible provider answering instead of Gemini."""
    clear_env_provider(monkeypatch)
    _make_provider(db, name="My Llamafile", profile_key="llamafile", default_text_model="qwen3-4b")

    captured = {}
    patch_gateway_transport(monkeypatch, fake_openai_text_response(
        {"overall_score": 72, "summary": "decent"}
    ), capture=captured)

    result = LLMGateway(db).run(LLMTask.SYSTEM_DESIGN_GRADING, "grade my answer")

    assert result.ok
    assert result.data["overall_score"] == 72
    assert result.provider_name == "My Llamafile"
    assert captured["url"] == "http://localhost:8080/v1/chat/completions"
