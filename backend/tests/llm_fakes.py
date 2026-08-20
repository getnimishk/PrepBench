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

    The developer .env holds a real key, so tests that assert unavailable
    behaviour must neutralise both the settings attribute (which
    pydantic-settings already read at import time) and the live environment.
    """
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


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
