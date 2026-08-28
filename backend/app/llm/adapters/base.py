# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""The contract every wire-protocol adapter implements."""
from typing import Optional, Protocol, Tuple

from app.llm.types import Capability, Connection, HttpRequestSpec, LLMRequest


class LLMAdapter(Protocol):
    key: str

    def supports(self, capability: Capability) -> bool:
        """
        Whether this adapter implements the capability at all.

        Distinct from whether a *provider* offers it: the profile says what the
        vendor sells, this says what the code can actually build a request for.
        A task needs both.
        """
        ...

    def build_request(self, req: LLMRequest, conn: Connection) -> HttpRequestSpec:
        """
        Describe the HTTP call. Performs no I/O -- see HttpRequestSpec for why.

        Raises ValueError for a capability it does not support; the gateway
        checks supports() first, so reaching that is a programming error.
        """
        ...

    def parse_text_response(self, raw: dict) -> Tuple[Optional[str], Optional[str]]:
        """Pull the model's text out of a vendor response. Returns (text, error)."""
        ...

    def parse_embedding_response(self, raw: dict) -> Tuple[Optional[list], Optional[str]]:
        """Pull the vector out of a vendor response. Returns (vector, error)."""
        ...

    def parse_model_list(self, raw: dict) -> list:
        """Model ids from a discovery response. Empty list if the shape is unfamiliar."""
        ...
