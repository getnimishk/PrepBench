"""
Tests for the vendor-agnostic LLM layer.

Adapter tests use recorded vendor responses and never touch the network --
build_request performs no I/O by design, so no mocking library is needed.
"""
import pytest

from app.llm import profiles as profile_store
from app.llm.adapters import get_adapter, list_adapter_keys
from app.llm.gateway import LLMGateway
from app.llm.json_extract import extract_json_object
from app.llm.types import TASK_SPECS, Capability, Connection, LLMRequest, LLMTask
from tests.llm_fakes import (
    clear_env_provider,
    fake_gemini_embedding_response,
    fake_gemini_text_response,
    fake_openai_text_response,
    patch_gateway_transport,
    set_env_provider,
)


def _conn(profile_key: str, **overrides) -> Connection:
    """Build a Connection the way the gateway would, from a real profile."""
    profile = profile_store.get_profile(profile_key)
    assert profile is not None, f"missing profile {profile_key}"
    defaults = dict(
        provider_name=f"test-{profile_key}",
        profile_key=profile_key,
        adapter_key=profile["adapter"],
        base_url=profile.get("base_url") or "http://localhost:9999/v1",
        auth=profile.get("auth") or {},
        api_key="test-key",
        is_local=bool(profile.get("is_local")),
        supports_json_mode=bool(profile.get("supports_json_mode")),
        capabilities=profile_store.profile_capabilities(profile),
        model_discovery=profile.get("model_discovery"),
    )
    defaults.update(overrides)
    return Connection(**defaults)


# ---- Profiles ---------------------------------------------------------

def test_every_profile_names_an_installed_adapter():
    """A profile pointing at a missing adapter would fail only at call time,
    on a user's machine, with an obscure message."""
    installed = set(list_adapter_keys())
    for key, profile in profile_store.load_profiles().items():
        assert profile.get("adapter") in installed, f"profile {key!r} names an unknown adapter"


def test_profiles_only_advertise_capabilities_their_adapter_implements():
    """The no-fabrication rule at the configuration layer: advertising a
    capability the code cannot deliver would surface as a confusing failure
    mid-task rather than an honest 'unsupported'."""
    for key, profile in profile_store.load_profiles().items():
        adapter = get_adapter(profile["adapter"])
        for capability in profile_store.profile_capabilities(profile):
            assert adapter.supports(capability), (
                f"profile {key!r} advertises {capability.value} but adapter "
                f"{profile['adapter']!r} does not implement it"
            )


def test_custom_endpoint_is_local_inferred_from_host():
    profile = profile_store.get_profile("custom_openai")
    assert profile_store.infer_is_local(profile, "http://localhost:8080/v1") is True
    assert profile_store.infer_is_local(profile, "http://127.0.0.1:1234/v1") is True
    assert profile_store.infer_is_local(profile, "https://api.example.com/v1") is False


# ---- Adapters ---------------------------------------------------------

def test_gemini_adapter_builds_the_documented_request():
    adapter = get_adapter("gemini")
    conn = _conn("gemini")
    spec = adapter.build_request(
        LLMRequest(capability=Capability.TEXT_JSON, model="models/gemini-flash-latest", prompt="hi"),
        conn,
    )
    assert spec.url.endswith("/models/gemini-flash-latest:generateContent?key=test-key")
    assert spec.json_body["contents"][0]["parts"][0]["text"] == "hi"
    assert spec.json_body["generationConfig"]["responseMimeType"] == "application/json"


def test_gemini_adapter_encodes_audio_inline():
    adapter = get_adapter("gemini")
    spec = adapter.build_request(
        LLMRequest(
            capability=Capability.AUDIO_JSON, model="m", prompt="grade this",
            media_bytes=b"RAWAUDIO", media_mime="audio/webm",
        ),
        _conn("gemini"),
    )
    parts = spec.json_body["contents"][0]["parts"]
    assert parts[0]["inline_data"]["mime_type"] == "audio/webm"
    assert parts[0]["inline_data"]["data"]  # base64, non-empty
    assert parts[1]["text"] == "grade this"


def test_openai_adapter_builds_chat_completions_with_bearer_auth():
    adapter = get_adapter("openai_compatible")
    spec = adapter.build_request(
        LLMRequest(capability=Capability.TEXT_JSON, model="gpt-4o-mini", prompt="hi"),
        _conn("openai"),
    )
    assert spec.url.endswith("/chat/completions")
    assert spec.headers["Authorization"] == "Bearer test-key"
    assert spec.json_body["messages"][0]["content"] == "hi"
    assert spec.json_body["response_format"] == {"type": "json_object"}


def test_local_openai_provider_sends_no_auth_header():
    """Llamafile and Ollama take no key; sending an empty Authorization header
    makes some runners reject the request outright."""
    adapter = get_adapter("openai_compatible")
    spec = adapter.build_request(
        LLMRequest(capability=Capability.TEXT_JSON, model="qwen", prompt="hi"),
        _conn("llamafile", api_key=None),
    )
    assert "Authorization" not in spec.headers


def test_anthropic_adapter_uses_header_auth_and_omits_json_mode():
    adapter = get_adapter("anthropic")
    conn = _conn("anthropic")
    spec = adapter.build_request(
        LLMRequest(capability=Capability.TEXT_JSON, model="claude-sonnet-4-5", prompt="hi"),
        conn,
    )
    assert spec.headers["x-api-key"] == "test-key"
    assert spec.headers["anthropic-version"]
    assert "response_format" not in spec.json_body  # no JSON mode on this API


def test_adapters_refuse_capabilities_they_do_not_implement():
    with pytest.raises(ValueError):
        get_adapter("openai_compatible").build_request(
            LLMRequest(capability=Capability.AUDIO_JSON, model="m", prompt="x", media_bytes=b"a"),
            _conn("openai"),
        )


@pytest.mark.parametrize("adapter_key, response, expected", [
    ("gemini", fake_gemini_text_response("hello"), "hello"),
    ("openai_compatible", fake_openai_text_response("hello"), "hello"),
    ("anthropic", {"content": [{"type": "text", "text": "hello"}]}, "hello"),
])
def test_every_adapter_extracts_text_from_its_own_response_shape(adapter_key, response, expected):
    text, error = get_adapter(adapter_key).parse_text_response(response)
    assert error is None
    assert text == expected


def test_adapter_reports_a_useful_reason_when_there_is_no_text():
    text, error = get_adapter("gemini").parse_text_response(
        {"promptFeedback": {"blockReason": "SAFETY"}}
    )
    assert text is None
    assert "SAFETY" in error

    text, error = get_adapter("openai_compatible").parse_text_response(
        {"choices": [{"message": {"content": ""}, "finish_reason": "length"}]}
    )
    assert text is None
    assert "output limit" in error


# ---- JSON extraction ladder -------------------------------------------

def test_clean_json_parses():
    parsed, error = extract_json_object('{"a": 1}')
    assert error is None and parsed == {"a": 1}


def test_code_fenced_json_parses():
    parsed, error = extract_json_object('```json\n{"a": 1}\n```')
    assert error is None and parsed == {"a": 1}


def test_json_wrapped_in_commentary_parses():
    parsed, error = extract_json_object('Sure! Here is the result:\n{"a": 1}\nHope that helps.')
    assert error is None and parsed == {"a": 1}


def test_braces_inside_string_values_do_not_end_the_scan():
    parsed, error = extract_json_object('prefix {"tip": "use {user_id} as the key", "n": 2} suffix')
    assert error is None
    assert parsed["tip"] == "use {user_id} as the key"
    assert parsed["n"] == 2


def test_trailing_commas_are_repaired():
    parsed, error = extract_json_object('{"a": 1, "b": [1, 2,],}')
    assert error is None and parsed == {"a": 1, "b": [1, 2]}


def test_output_truncated_by_token_limit_keeps_completed_fields():
    """A local model hitting its limit mid-object should not cost the user the
    fields it did finish."""
    parsed, error = extract_json_object('{"summary": "good answer", "scores": [1, 2], "next": "unfini')
    assert error is None
    assert parsed["summary"] == "good answer"
    assert parsed["scores"] == [1, 2]


def test_truncation_mid_value_keeps_the_partial_value():
    """A cut-off sentence is visibly cut off, and more use to the reader than a
    field that silently vanished."""
    parsed, error = extract_json_object('{"summary": "the delivery was clear but the pac')
    assert error is None
    assert parsed["summary"].startswith("the delivery was clear")


def test_truncation_mid_key_drops_the_valueless_key():
    """The mirror case: a key cut off before its value cannot be kept, because
    there is no value to keep."""
    parsed, error = extract_json_object('{"score": 7, "feedb')
    assert error is None
    assert parsed == {"score": 7}


def test_truncation_just_after_a_colon_drops_the_dangling_key():
    parsed, error = extract_json_object('{"score": 7, "feedback": ')
    assert error is None
    assert parsed == {"score": 7}


def test_truncation_inside_a_nested_array_closes_every_level():
    parsed, error = extract_json_object('{"scores": [{"category": "Clarity", "score": 8')
    assert error is None
    assert parsed["scores"][0]["category"] == "Clarity"
    assert parsed["scores"][0]["score"] == 8


def test_genuinely_unparseable_output_fails_honestly():
    parsed, error = extract_json_object("I am afraid I cannot help with that.")
    assert parsed is None
    assert "malformed JSON" in error


def test_empty_response_fails_honestly():
    parsed, error = extract_json_object("")
    assert parsed is None and "empty" in error


def test_json_array_is_rejected_not_coerced():
    parsed, error = extract_json_object("[1, 2, 3]")
    assert parsed is None
    assert "non-dictionary" in error


# ---- Task specs -------------------------------------------------------

def test_every_task_has_a_spec():
    for task in LLMTask:
        assert task in TASK_SPECS, f"{task.value} has no TaskSpec"


def test_local_timeouts_exceed_cloud_timeouts():
    """Local inference is far slower; a local provider given a cloud timeout
    gets cut off mid-answer."""
    for task, spec in TASK_SPECS.items():
        assert spec.local_timeout > spec.cloud_timeout, f"{task.value} local budget is not larger"


def test_cloud_timeouts_match_the_values_the_call_sites_used():
    """Phase 1 must not change behaviour for existing cloud users."""
    assert TASK_SPECS[LLMTask.CONTENT_VALIDATION].cloud_timeout == 15.0
    assert TASK_SPECS[LLMTask.INTERVIEW_QUESTION_GEN].cloud_timeout == 20.0
    assert TASK_SPECS[LLMTask.SYSTEM_DESIGN_PROMPT_GEN].cloud_timeout == 20.0
    assert TASK_SPECS[LLMTask.SYSTEM_DESIGN_GRADING].cloud_timeout == 25.0
    assert TASK_SPECS[LLMTask.RECORDING_ANALYSIS].cloud_timeout == 45.0


# ---- Gateway resolution ----------------------------------------------

def test_no_configuration_resolves_to_nothing_and_says_why(monkeypatch):
    clear_env_provider(monkeypatch)
    gateway = LLMGateway(None)
    conn, model, reason = gateway.resolve(LLMTask.SYSTEM_DESIGN_GRADING)
    assert conn is None and model is None
    assert "system_design_grading" in reason
    assert gateway.is_available(LLMTask.SYSTEM_DESIGN_GRADING) is False


def test_env_key_alone_resolves_to_the_historical_gemini_defaults(monkeypatch):
    """The compatibility guarantee: an existing .env keeps working untouched,
    with exactly the model the old constants named."""
    set_env_provider(monkeypatch)
    conn, model, reason = LLMGateway(None).resolve(LLMTask.SYSTEM_DESIGN_GRADING)
    assert reason is None
    assert conn.profile_key == "gemini"
    assert model == "models/gemini-flash-latest"

    _, embed_model, _ = LLMGateway(None).resolve(LLMTask.EMBEDDING)
    assert embed_model == "models/gemini-embedding-001"


def test_unavailable_is_distinct_from_error(monkeypatch):
    """Callers treat these differently -- 'nothing configured' is honest
    absence, 'the provider failed' is a fault worth reporting."""
    clear_env_provider(monkeypatch)
    result = LLMGateway(None).run(LLMTask.SYSTEM_DESIGN_GRADING, "prompt")
    assert result.status == "unavailable"
    assert result.data is None

    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, None, error="HTTP 500: upstream exploded")
    result = LLMGateway(None).run(LLMTask.SYSTEM_DESIGN_GRADING, "prompt")
    assert result.status == "error"
    assert "upstream exploded" in result.error


def test_run_reports_which_provider_and_model_answered(monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({"ok": True}))
    result = LLMGateway(None).run(LLMTask.SYSTEM_DESIGN_GRADING, "prompt")
    assert result.ok
    assert result.provider_name and result.model == "models/gemini-flash-latest"
    assert result.latency_ms is not None


def test_timeout_budget_follows_the_provider_not_the_task(monkeypatch):
    set_env_provider(monkeypatch)
    captured = {}
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({"ok": True}), capture=captured)
    LLMGateway(None).run(LLMTask.SYSTEM_DESIGN_GRADING, "prompt")
    # Gemini is a cloud profile, so the cloud budget applies.
    assert captured["timeout"] == TASK_SPECS[LLMTask.SYSTEM_DESIGN_GRADING].cloud_timeout


def test_unparseable_response_is_retried_exactly_once(monkeypatch):
    set_env_provider(monkeypatch)
    calls = []

    def fake_send(self, spec_req, timeout):
        calls.append(spec_req.json_body["contents"][0]["parts"][0]["text"])
        return fake_gemini_text_response("still not json"), None

    monkeypatch.setattr(LLMGateway, "_send", fake_send)
    result = LLMGateway(None).run(LLMTask.SYSTEM_DESIGN_GRADING, "original prompt")

    assert result.status == "error"
    assert len(calls) == 2, "expected exactly one repair retry"
    assert "not valid JSON" in calls[1], "retry should tell the model what went wrong"


def test_transport_failures_are_not_retried(monkeypatch):
    """A refused connection will be refused again; on a local provider a blind
    retry could mean another five minutes of waiting."""
    set_env_provider(monkeypatch)
    calls = []

    def fake_send(self, spec_req, timeout):
        calls.append(1)
        return None, "Could not connect to the provider: connection refused"

    monkeypatch.setattr(LLMGateway, "_send", fake_send)
    result = LLMGateway(None).run(LLMTask.SYSTEM_DESIGN_GRADING, "prompt")

    assert result.status == "error"
    assert len(calls) == 1


def test_embedding_returns_a_vector(monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_embedding_response([0.1, 0.2, 0.3]))
    result = LLMGateway(None).embed("some text")
    assert result.ok and result.vector == [0.1, 0.2, 0.3]
