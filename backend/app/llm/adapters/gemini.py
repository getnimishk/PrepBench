"""
Google Generative Language API.

Byte-for-byte the request shape the previous llm_client built, so existing
Gemini users see identical behaviour -- with one addition: responseMimeType is
now set when the caller wants JSON, which constrains decoding rather than
hoping the prompt is obeyed. The response shape is unchanged either way.
"""
from typing import Optional, Tuple

from app.llm.types import Capability, Connection, HttpRequestSpec, LLMRequest

_SUPPORTED = frozenset({Capability.TEXT_JSON, Capability.AUDIO_JSON, Capability.EMBEDDING})


class GeminiAdapter:
    key = "gemini"

    def supports(self, capability: Capability) -> bool:
        return capability in _SUPPORTED

    def _url(self, conn: Connection, model: str, verb: str) -> str:
        base = conn.base_url.rstrip("/")
        url = f"{base}/{model}:{verb}"
        # Gemini authenticates by query parameter rather than a header. The
        # parameter name comes from the profile, not a literal here.
        if conn.api_key:
            param = (conn.auth or {}).get("param", "key")
            url = f"{url}?{param}={conn.api_key}"
        return url

    def build_request(self, req: LLMRequest, conn: Connection) -> HttpRequestSpec:
        if req.capability is Capability.EMBEDDING:
            return HttpRequestSpec(
                method="POST",
                url=self._url(conn, req.model, "embedContent"),
                json_body={
                    "model": req.model,
                    "content": {"parts": [{"text": req.input_text or ""}]},
                },
            )

        if req.capability is Capability.TEXT_JSON:
            parts = [{"text": req.prompt}]
        elif req.capability is Capability.AUDIO_JSON:
            import base64

            if not req.media_bytes:
                raise ValueError("AUDIO_JSON request has no media_bytes")
            parts = [
                {"inline_data": {
                    "mime_type": req.media_mime or "audio/webm",
                    "data": base64.b64encode(req.media_bytes).decode("ascii"),
                }},
                {"text": req.prompt},
            ]
        else:
            raise ValueError(f"GeminiAdapter cannot build a {req.capability} request")

        body = {"contents": [{"parts": parts}]}
        if req.json_mode and conn.supports_json_mode:
            body["generationConfig"] = {"responseMimeType": "application/json"}

        return HttpRequestSpec(
            method="POST",
            url=self._url(conn, req.model, "generateContent"),
            json_body=body,
        )

    def parse_text_response(self, raw: dict) -> Tuple[Optional[str], Optional[str]]:
        candidates = (raw or {}).get("candidates")
        if not candidates:
            # A safety block returns no candidates but does say why, and that
            # reason is far more actionable than "no candidate parts".
            reason = ((raw or {}).get("promptFeedback") or {}).get("blockReason")
            if reason:
                return None, f"Gemini blocked the request: {reason}"
            return None, "LLM response contained no candidate parts"
        try:
            return candidates[0]["content"]["parts"][0]["text"], None
        except (KeyError, IndexError, TypeError):
            finish = (candidates[0] or {}).get("finishReason")
            if finish and finish != "STOP":
                return None, f"LLM stopped early ({finish}) without returning text"
            return None, "LLM response was missing the expected text part"

    def parse_embedding_response(self, raw: dict) -> Tuple[Optional[list], Optional[str]]:
        try:
            return (raw or {})["embedding"]["values"], None
        except (KeyError, TypeError):
            return None, "Embedding response missing expected 'embedding.values' field"

    def parse_model_list(self, raw: dict) -> list:
        return [m["name"] for m in (raw or {}).get("models", []) if isinstance(m, dict) and "name" in m]
