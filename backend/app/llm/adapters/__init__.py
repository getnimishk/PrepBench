# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Wire-protocol adapters.

One per *protocol*, not per vendor. Adding Groq, Together, DeepSeek or a new
local runner needs no code here at all -- they speak the OpenAI protocol, so
they are entries in llm_profiles.json. A new adapter is only warranted when a
genuinely different request/response shape appears.
"""
from typing import Dict, Optional

from app.llm.adapters.base import LLMAdapter
from app.llm.adapters.anthropic import AnthropicAdapter
from app.llm.adapters.gemini import GeminiAdapter
from app.llm.adapters.openai_compatible import OpenAICompatibleAdapter

_ADAPTERS: Dict[str, LLMAdapter] = {
    a.key: a for a in (OpenAICompatibleAdapter(), GeminiAdapter(), AnthropicAdapter())
}


def get_adapter(key: str) -> Optional[LLMAdapter]:
    return _ADAPTERS.get(key)


def list_adapter_keys() -> list:
    return sorted(_ADAPTERS)


__all__ = ["LLMAdapter", "get_adapter", "list_adapter_keys"]
