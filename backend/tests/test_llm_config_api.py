# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The provider-management API behind the Settings UI.

The invariant these exist to protect: a credential the user types must never
come back out of the API, and a binding that could never run must be refused
at the point it is made rather than discovered when a feature fails.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.llm_config import LLMProviderConfig, LLMTaskBinding
from tests.conftest import TestingSessionLocal
from tests.llm_fakes import clear_env_provider

client = TestClient(app)

BASE = "/api/v1/llm"


@pytest.fixture(autouse=True)
def clean_llm_tables():
    """
    Empty both tables around every test.

    Resolution depends on which providers exist, so a row left behind by one
    test silently changes what the next one exercises.
    """
    def _wipe():
        db = TestingSessionLocal()
        try:
            db.query(LLMTaskBinding).delete()
            db.query(LLMProviderConfig).delete()
            db.commit()
        finally:
            db.close()

    _wipe()
    yield
    _wipe()


def _create(**overrides):
    payload = {
        "name": f"Test Provider {uuid.uuid4().hex[:8]}",
        "profile_key": "llamafile",
        "default_text_model": "qwen3-4b",
    }
    payload.update(overrides)
    res = client.post(f"{BASE}/providers", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


# ---- Profiles ---------------------------------------------------------

def test_profiles_include_local_and_cloud_options():
    res = client.get(f"{BASE}/profiles")
    assert res.status_code == 200
    by_key = {p["key"]: p for p in res.json()}

    assert "llamafile" in by_key and by_key["llamafile"]["is_local"] is True
    assert "gemini" in by_key and by_key["gemini"]["is_local"] is False
    # Local runners take no key; a cloud API does. The UI hides/shows the key
    # field on this flag.
    assert by_key["llamafile"]["requires_api_key"] is False
    assert by_key["gemini"]["requires_api_key"] is True


def test_local_profiles_are_listed_before_cloud_ones():
    """A privacy-first product should not bury the private option."""
    profiles = client.get(f"{BASE}/profiles").json()
    first_cloud = next(i for i, p in enumerate(profiles) if p["is_local"] is not True)
    local_indexes = [i for i, p in enumerate(profiles) if p["is_local"] is True]
    assert local_indexes, "expected at least one local profile"
    assert max(local_indexes) < first_cloud


# ---- Credentials ------------------------------------------------------

def test_api_key_is_never_returned_by_any_endpoint():
    secret = "sk-super-secret-value-1234"
    created = _create(profile_key="openai", base_url="https://api.example.com/v1", api_key=secret)

    assert created["has_api_key"] is True
    assert created["api_key_hint"] == "1234"
    assert secret not in str(created)

    fetched = client.get(f"{BASE}/providers/{created['id']}").json()
    assert secret not in str(fetched)

    listed = client.get(f"{BASE}/providers").json()
    assert secret not in str(listed)


def test_api_key_can_be_replaced_and_cleared():
    created = _create(profile_key="openai", base_url="https://api.example.com/v1", api_key="first-key-aaaa")
    pid = created["id"]

    replaced = client.patch(f"{BASE}/providers/{pid}", json={"api_key": "second-key-bbbb"}).json()
    assert replaced["api_key_hint"] == "bbbb"

    # Absent from the payload means "leave it alone" -- PATCH semantics, the
    # same as everywhere else in this app.
    untouched = client.patch(f"{BASE}/providers/{pid}", json={"name": "Renamed"}).json()
    assert untouched["has_api_key"] is True
    assert untouched["api_key_hint"] == "bbbb"

    # An explicit empty string removes it.
    cleared = client.patch(f"{BASE}/providers/{pid}", json={"api_key": ""}).json()
    assert cleared["has_api_key"] is False
    assert cleared["api_key_hint"] is None


# ---- Validation -------------------------------------------------------

def test_duplicate_provider_name_is_rejected():
    created = _create(name="Unique Name")
    res = client.post(f"{BASE}/providers", json={"name": "Unique Name", "profile_key": "llamafile"})
    assert res.status_code == 409
    assert created["id"]


def test_unknown_profile_is_rejected():
    res = client.post(f"{BASE}/providers", json={"name": "Nonsense", "profile_key": "not-a-real-vendor"})
    assert res.status_code == 400


def test_custom_endpoint_requires_a_server_address():
    """The custom profile has no default URL, so one must be supplied."""
    res = client.post(f"{BASE}/providers", json={"name": "My Server", "profile_key": "custom_openai"})
    assert res.status_code == 400
    assert "address" in res.json()["detail"].lower()


def test_custom_endpoint_locality_is_inferred_from_its_host():
    """Locality decides the timeout budget, so it has to be right even when the
    profile cannot declare it up front."""
    local = _create(name="Local Custom", profile_key="custom_openai", base_url="http://localhost:9999/v1")
    remote = _create(name="Remote Custom", profile_key="custom_openai", base_url="https://api.example.com/v1")

    assert local["is_local"] is True
    assert remote["is_local"] is False


# ---- Task routing -----------------------------------------------------

def test_binding_a_task_to_an_incapable_provider_is_refused():
    """A text-only local model cannot analyse audio. Refusing here means the
    user finds out while configuring, not when a recording silently fails."""
    text_only = _create(name="Text Only", profile_key="llamafile")

    res = client.put(f"{BASE}/tasks/recording_analysis", json={"provider_id": text_only["id"]})
    assert res.status_code == 400
    assert "audio" in res.json()["detail"].lower()


def test_binding_a_task_to_a_capable_provider_is_accepted():
    text_only = _create(name="Text Only", profile_key="llamafile")

    res = client.put(f"{BASE}/tasks/system_design_grading", json={"provider_id": text_only["id"]})
    assert res.status_code == 200
    body = res.json()
    assert body["bound_provider_id"] == text_only["id"]
    assert body["resolved_provider_name"] == "Text Only"


def test_unknown_task_404s():
    res = client.put(f"{BASE}/tasks/not_a_task", json={"provider_id": None})
    assert res.status_code == 404


def test_tasks_report_both_timeout_budgets():
    """The UI tells the user a local model will be slower; that has to come
    from the same table the gateway actually uses."""
    tasks = {t["task"]: t for t in client.get(f"{BASE}/tasks").json()}
    grading = tasks["system_design_grading"]
    assert grading["cloud_timeout_seconds"] == 25
    assert grading["local_timeout_seconds"] == 300


def test_deleting_a_bound_provider_clears_the_binding_not_the_task(monkeypatch):
    clear_env_provider(monkeypatch)
    provider = _create(name="Doomed", profile_key="llamafile")
    client.put(f"{BASE}/tasks/system_design_grading", json={"provider_id": provider["id"]})

    assert client.delete(f"{BASE}/providers/{provider['id']}").status_code == 200

    tasks = {t["task"]: t for t in client.get(f"{BASE}/tasks").json()}
    grading = tasks["system_design_grading"]
    assert grading["bound_provider_id"] is None
    # With nothing left to run it, the task reports honestly rather than
    # pretending it still works.
    assert grading["is_available"] is False


def test_disabled_provider_is_not_used(monkeypatch):
    clear_env_provider(monkeypatch)
    provider = _create(name="Switched Off", profile_key="llamafile")

    tasks = {t["task"]: t for t in client.get(f"{BASE}/tasks").json()}
    assert tasks["system_design_grading"]["is_available"] is True

    client.patch(f"{BASE}/providers/{provider['id']}", json={"is_enabled": False})

    tasks = {t["task"]: t for t in client.get(f"{BASE}/tasks").json()}
    assert tasks["system_design_grading"]["is_available"] is False


def test_verify_reports_unreachable_with_advice_rather_than_a_stack_trace():
    """Nothing is listening on this port, which is the single most common state
    a user will hit -- the message has to tell them what to do about it."""
    provider = _create(name="Not Running", profile_key="llamafile",
                       base_url="http://127.0.0.1:59999/v1")

    res = client.post(f"{BASE}/providers/{provider['id']}/verify")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert body["readiness"] == "unreachable"
    assert "start your local model server" in body["message"].lower()

    # And it is remembered, so the list shows the problem without re-probing.
    fetched = client.get(f"{BASE}/providers/{provider['id']}").json()
    assert fetched["last_verify_error"]
    assert fetched["last_verified_at"]


def test_unknown_provider_404s():
    assert client.get(f"{BASE}/providers/999999").status_code == 404
    assert client.patch(f"{BASE}/providers/999999", json={"name": "x"}).status_code == 404
    assert client.delete(f"{BASE}/providers/999999").status_code == 404
    assert client.post(f"{BASE}/providers/999999/verify").status_code == 404
