# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Shared helpers for testing against the LLM layer without a network.

Tests patch LLMGateway._send -- the single I/O point of the whole layer -- so
everything above it runs for real: provider resolution, model selection,
timeout selection, the adapter's request building and response parsing, and
the JSON extraction ladder. That is deliberately more coverage than the
previous fakes gave, which stubbed the vendor call itself and so never
exercised any of it.
"""
import json
from typing import Optional

from app.core.config import settings
from app.llm.gateway import LLMGateway


def clear_env_provider(monkeypatch):
    """
    Make the gateway resolve nothing at all.

    Three things have to go, because the gateway resolves in three steps: a task
    binding, then the first enabled capable provider row, then the environment.
    Neutralising only the environment was enough before providers lived in the
    database; afterwards it quietly stopped being enough, and a single leftover
    provider row would make an "AI is not configured" test resolve a provider
    and fail somewhere unrelated.

    The settings attribute is separate from the environment variable because
    pydantic-settings already read it at import time.
    """
    from app.models.llm_config import LLMProviderConfig, LLMTaskBinding
    from tests.conftest import TestingSessionLocal

    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    db = TestingSessionLocal()
    try:
        db.query(LLMTaskBinding).delete()
        db.query(LLMProviderConfig).delete()
        db.commit()
    finally:
        db.close()


def set_env_provider(monkeypatch, key: str = "fake-key-for-test"):
    """Give the gateway exactly one resolvable provider: env-configured Gemini."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", key)


def fake_gemini_text_response(payload) -> dict:
    """
    A response shaped the way Gemini actually replies.

    Accepts a dict (serialised to JSON, the normal case) or a raw string, so a
    test can feed deliberately malformed output to the extraction ladder.
    """
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return {"candidates": [{"content": {"parts": [{"text": text}]}}]}


def fake_openai_text_response(payload) -> dict:
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return {"choices": [{"message": {"content": text}, "finish_reason": "stop"}]}


def fake_gemini_embedding_response(vector) -> dict:
    return {"embedding": {"values": vector}}


def patch_gateway_transport(monkeypatch, response: Optional[dict], error: Optional[str] = None,
                            capture: Optional[dict] = None):
    """
    Replace the gateway's only network call.

    Pass `capture` to record the outgoing request -- useful for asserting that
    the right URL, model and body were built without inspecting the adapter
    directly.
    """
    def fake_send(self, spec_req, timeout):
        if capture is not None:
            capture["url"] = spec_req.url
            capture["body"] = spec_req.json_body
            capture["headers"] = spec_req.headers
            capture["timeout"] = timeout
        return response, error

    monkeypatch.setattr(LLMGateway, "_send", fake_send)
