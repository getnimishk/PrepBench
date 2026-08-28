# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Anthropic Messages API.

Text only. There is no JSON mode, so the profile sets supports_json_mode=false
and the extraction ladder in json_extract does the work -- which is exactly the
case it was built for.
"""
from typing import Optional, Tuple

from app.llm.types import Capability, Connection, HttpRequestSpec, LLMRequest

_SUPPORTED = frozenset({Capability.TEXT_JSON})

# Required by the API on every request. Pinned rather than tracking latest, so
# a server-side default change cannot alter response shapes underneath us.
ANTHROPIC_VERSION = "2023-06-01"

# Generous enough for the longest thing PrepBench asks for (a full system
# design grade with six rubric categories), without inviting a runaway.
DEFAULT_MAX_TOKENS = 4096


class AnthropicAdapter:
    key = "anthropic"

    def supports(self, capability: Capability) -> bool:
        return capability in _SUPPORTED

    def build_request(self, req: LLMRequest, conn: Connection) -> HttpRequestSpec:
        if req.capability is not Capability.TEXT_JSON:
            raise ValueError(f"AnthropicAdapter cannot build a {req.capability} request")

        headers = {
            "Content-Type": "application/json",
            "anthropic-version": ANTHROPIC_VERSION,
        }
        if conn.api_key:
            header_name = (conn.auth or {}).get("header", "x-api-key")
            headers[header_name] = conn.api_key

        return HttpRequestSpec(
            method="POST",
            url=f"{conn.base_url.rstrip('/')}/messages",
            json_body={
                "model": req.model,
                "max_tokens": DEFAULT_MAX_TOKENS,
                "messages": [{"role": "user", "content": req.prompt}],
            },
            headers=headers,
        )

    def parse_text_response(self, raw: dict) -> Tuple[Optional[str], Optional[str]]:
        blocks = (raw or {}).get("content")
        if not blocks:
            err = (raw or {}).get("error")
            if err:
                message = err.get("message") if isinstance(err, dict) else str(err)
                return None, f"Provider returned an error: {message}"
            return None, "LLM response contained no content blocks"

        # Skip any non-text block (a thinking block, for instance) rather than
        # assuming the first block is the answer.
        for block in blocks:
            if isinstance(block, dict) and block.get("type") == "text" and block.get("text"):
                return block["text"], None

        if (raw or {}).get("stop_reason") == "max_tokens":
            return None, "LLM hit its output limit before producing any text"
        return None, "LLM response was missing a text block"

    def parse_embedding_response(self, raw: dict) -> Tuple[Optional[list], Optional[str]]:
        return None, "Anthropic does not provide an embeddings endpoint"

    def parse_model_list(self, raw: dict) -> list:
        return [m["id"] for m in (raw or {}).get("data", []) if isinstance(m, dict) and "id" in m]
