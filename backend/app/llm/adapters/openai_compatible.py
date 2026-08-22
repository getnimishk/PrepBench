"""
The OpenAI chat-completions protocol.

This one adapter covers most of the ecosystem: llamafile, Ollama, LM Studio,
vLLM and LocalAI locally; OpenAI, Groq, Together, DeepSeek, Mistral and
OpenRouter remotely. All of them are profile entries, none of them are code.

Audio is deliberately not implemented here. OpenAI can take audio in chat
completions, but no local runner using this protocol can, and advertising a
capability the code has not been exercised against is how you end up returning
a confident wrong answer.
"""
from typing import Optional, Tuple

from app.llm.types import Capability, Connection, HttpRequestSpec, LLMRequest

_SUPPORTED = frozenset({Capability.TEXT_JSON, Capability.EMBEDDING})


class OpenAICompatibleAdapter:
    key = "openai_compatible"

    def supports(self, capability: Capability) -> bool:
        return capability in _SUPPORTED

    def _headers(self, conn: Connection) -> dict:
        headers = {"Content-Type": "application/json"}
        style = (conn.auth or {}).get("style", "none")
        # Local runners take no key at all; "optional_bearer" is for a custom
        # endpoint that may or may not sit behind one.
        if conn.api_key and style in ("bearer", "optional_bearer"):
            headers["Authorization"] = f"Bearer {conn.api_key}"
        return headers

    def build_request(self, req: LLMRequest, conn: Connection) -> HttpRequestSpec:
        base = conn.base_url.rstrip("/")

        if req.capability is Capability.EMBEDDING:
            return HttpRequestSpec(
                method="POST",
                url=f"{base}/embeddings",
                json_body={"model": req.model, "input": req.input_text or ""},
                headers=self._headers(conn),
            )

        if req.capability is not Capability.TEXT_JSON:
            raise ValueError(f"OpenAICompatibleAdapter cannot build a {req.capability} request")

        body = {
            "model": req.model,
            "messages": [{"role": "user", "content": req.prompt}],
        }
        if req.json_mode and conn.supports_json_mode:
            body["response_format"] = {"type": "json_object"}

        return HttpRequestSpec(
            method="POST",
            url=f"{base}/chat/completions",
            json_body=body,
            headers=self._headers(conn),
        )

    def parse_text_response(self, raw: dict) -> Tuple[Optional[str], Optional[str]]:
        choices = (raw or {}).get("choices")
        if not choices:
            # Local runners report a failed load or a bad model name through
            # this field rather than an HTTP status.
            err = (raw or {}).get("error")
            if err:
                message = err.get("message") if isinstance(err, dict) else str(err)
                return None, f"Provider returned an error: {message}"
            return None, "LLM response contained no choices"
        try:
            content = choices[0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return None, "LLM response was missing the expected message content"

        if content is None or not str(content).strip():
            finish = (choices[0] or {}).get("finish_reason")
            if finish == "length":
                return None, "LLM hit its output limit before producing any content"
            return None, "LLM returned empty content"
        return content, None

    def parse_embedding_response(self, raw: dict) -> Tuple[Optional[list], Optional[str]]:
        try:
            return (raw or {})["data"][0]["embedding"], None
        except (KeyError, IndexError, TypeError):
            return None, "Embedding response missing expected 'data[0].embedding' field"

    def parse_model_list(self, raw: dict) -> list:
        return [m["id"] for m in (raw or {}).get("data", []) if isinstance(m, dict) and "id" in m]
