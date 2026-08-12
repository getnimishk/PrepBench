"""
Shared low-level Gemini-calling helpers.

Extracted out of ContentValidator (which was the sole consumer until the
System Design grading and Recording analysis features were added) so every
LLM call site in this app shares one implementation of the "never raise,
always return (parsed_dict_or_None, error_msg_or_None)" contract, instead of
each new feature re-implementing the same POST/parse/strip-code-fences logic.
"""
import json
from typing import Optional, Tuple
import httpx

# Shared client, lazily created. Callers are typically instantiated per-request
# (see ContentValidator, and the new services that reuse this module), so no
# individual caller should own its own httpx.Client -- that would leak
# sockets/connections with no owner to close them. A single process-wide
# client with its own connection pool is reused across every caller instead.
_shared_client: Optional[httpx.Client] = None


def get_shared_client() -> httpx.Client:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.Client(timeout=15.0)
    return _shared_client


def post_json(client: httpx.Client, url: str, payload: dict, timeout: float) -> Tuple[Optional[dict], Optional[str]]:
    """Low-level POST + status/parse handling shared by every Gemini call."""
    try:
        res = client.post(url, json=payload, timeout=timeout)
    except Exception as e:
        return None, f"Network/HTTP Exception: {str(e)}"
    if res.status_code != 200:
        return None, f"HTTP {res.status_code}: {res.text[:150]}"
    try:
        return res.json(), None
    except Exception as e:
        return None, f"Response was not valid JSON: {str(e)}"


def _extract_json_from_candidates(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    if "candidates" not in data or not data["candidates"]:
        return None, "LLM response contained no candidate parts"

    raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as err:
        return None, f"LLM returned malformed JSON: {str(err)}"

    if not isinstance(parsed, dict):
        return None, f"LLM returned non-dictionary JSON structure ({type(parsed).__name__})"

    return parsed, None


def call_gemini(
    client: httpx.Client,
    api_key: Optional[str],
    model: str,
    prompt: str,
    timeout: float = 15.0,
) -> Tuple[Optional[dict], Optional[str]]:
    """Text-only Gemini call expecting a JSON object back. Never raises."""
    if not api_key:
        return None, "Gemini API key not configured"
    url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    data, error_msg = post_json(client, url, payload, timeout)
    if error_msg:
        return None, error_msg

    return _extract_json_from_candidates(data)


def call_gemini_multimodal(
    client: httpx.Client,
    api_key: Optional[str],
    model: str,
    prompt: str,
    media_bytes: bytes,
    mime_type: str,
    timeout: float = 30.0,
) -> Tuple[Optional[dict], Optional[str]]:
    """
    Gemini call with an inline media part (e.g. recorded audio) alongside the
    text prompt, expecting a JSON object back. Same never-raises contract as
    call_gemini -- only the request payload differs (an extra inline_data part
    ahead of the text part, and a larger default timeout since audio requests
    take longer than pure-text ones).
    """
    if not api_key:
        return None, "Gemini API key not configured"

    import base64
    encoded = base64.b64encode(media_bytes).decode("ascii")

    url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": mime_type, "data": encoded}},
                {"text": prompt},
            ]
        }]
    }

    data, error_msg = post_json(client, url, payload, timeout)
    if error_msg:
        return None, error_msg

    return _extract_json_from_candidates(data)
