# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The single HTTP client for every LLM call in the app.

Callers are constructed per-request, so no individual caller can own a client
without leaking sockets. One process-wide client with one connection pool is
shared instead. This was previously in services/llm_client.py; it lives here
now so there is one obvious home for it, and that module delegates.
"""
from typing import Optional, Tuple

import httpx

_shared_client: Optional[httpx.Client] = None


def get_shared_client() -> httpx.Client:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.Client(timeout=15.0)
    return _shared_client


def post_json(client: httpx.Client, url: str, payload: dict, timeout: float,
              headers: Optional[dict] = None) -> Tuple[Optional[dict], Optional[str]]:
    """POST returning (parsed_body, error). Never raises."""
    try:
        res = client.post(url, json=payload, timeout=timeout, headers=headers or None)
    except httpx.TimeoutException:
        # Worth distinguishing: on a local provider this nearly always means
        # the model is still working, not that anything is broken, and the
        # advice ("give it longer, or use a smaller model") differs entirely
        # from a connection failure's.
        return None, f"Timed out after {timeout:.0f}s waiting for the model"
    except httpx.ConnectError as e:
        return None, f"Could not connect to the provider: {e}"
    except Exception as e:
        return None, f"Network/HTTP Exception: {str(e)}"

    if res.status_code != 200:
        return None, f"HTTP {res.status_code}: {res.text[:150]}"
    try:
        return res.json(), None
    except Exception as e:
        return None, f"Response was not valid JSON: {str(e)}"


def get_json(client: httpx.Client, url: str, timeout: float,
             headers: Optional[dict] = None) -> Tuple[Optional[dict], Optional[str]]:
    """GET returning (parsed_body, error). Used for model discovery."""
    try:
        res = client.get(url, timeout=timeout, headers=headers or None)
    except httpx.TimeoutException:
        return None, f"Timed out after {timeout:.0f}s"
    except httpx.ConnectError as e:
        return None, f"Could not connect to the provider: {e}"
    except Exception as e:
        return None, f"Network/HTTP Exception: {str(e)}"

    if res.status_code != 200:
        return None, f"HTTP {res.status_code}: {res.text[:150]}"
    try:
        return res.json(), None
    except Exception as e:
        return None, f"Response was not valid JSON: {str(e)}"
