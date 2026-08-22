"""
Getting a JSON object out of whatever the model actually said.

Every call site in PrepBench expects a JSON object back. A hosted frontier
model is reliable at that; a 4B quantised model running locally is not -- it
wraps the object in prose, leaves a trailing comma, or stops mid-string when
it hits the token limit. The previous implementation stripped code fences and
called json.loads once, which is enough for Gemini and not enough for anything
running on a laptop.

Stages run in order and stop at the first success, cheapest first. Each is a
strictly larger net than the one before, so a response that would have parsed
before still parses now, identically.
"""
import json
import re
from typing import Optional, Tuple

_FENCE_RE = re.compile(r"^\s*```(?:json|JSON)?\s*|\s*```\s*$")
_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")


def _strip_fences(text: str) -> str:
    """Remove a leading ```json / trailing ``` wrapper, if present."""
    out = _FENCE_RE.sub("", text.strip())
    # A model sometimes emits fences around *and* inside; the historical
    # implementation removed every occurrence, so keep doing that.
    return out.replace("```json", "").replace("```", "").strip()


def _scan_balanced_object(text: str) -> Optional[str]:
    """
    Return the first complete top-level {...} in `text`, or None.

    Quote- and escape-aware, so a brace inside a string value (common in
    feedback text: 'use {user_id} as the key') does not end the scan early.
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False

    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _close_truncated(text: str) -> Optional[str]:
    """
    Repair output that was cut off mid-object by a token limit.

    Walks the structure, then closes whatever is still open. Recovers the
    fields the model did finish rather than discarding the whole response --
    which matters most on local models, where hitting the limit is routine.
    """
    start = text.find("{")
    if start == -1:
        return None

    stack = []
    in_string = False
    escaped = False
    string_start = -1  # where the currently-open string began

    for idx in range(start, len(text)):
        ch = text[idx]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            string_start = idx
        elif ch in "{[":
            stack.append(ch)
        elif ch in "}]":
            if stack:
                stack.pop()

    if not stack and not in_string:
        return None  # nothing was open; this isn't a truncation

    repaired = text[start:]

    if in_string:
        # Cut mid-string. Whether that string was a value or a key decides what
        # can be salvaged, and the two look identical at the end of the text --
        # only what precedes the opening quote tells them apart. A value just
        # needs its closing quote (a visibly cut-off sentence is more use than
        # a silently dropped field); a key with no value has to go entirely.
        if text[start:string_start].rstrip().endswith(":"):
            repaired += '"'
        else:
            repaired = text[start:string_start]

    # Drop a key left dangling by a cut that landed *outside* a string, e.g.
    # '{"a": 1, "b":'. Requires the colon, so a complete pair repaired above is
    # not matched and destroyed.
    repaired = re.sub(r',?\s*"[^"]*"\s*:\s*$', "", repaired.rstrip())
    repaired = repaired.rstrip().rstrip(",")
    for opener in reversed(stack):
        repaired += "}" if opener == "{" else "]"
    return repaired


def _loads_object(candidate: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as err:
        return None, f"LLM returned malformed JSON: {err}"
    if not isinstance(parsed, dict):
        return None, f"LLM returned non-dictionary JSON structure ({type(parsed).__name__})"
    return parsed, None


def extract_json_object(raw_text: Optional[str]) -> Tuple[Optional[dict], Optional[str]]:
    """
    Best-effort parse of a model's text into a JSON object.

    Returns (parsed, None) or (None, error). Never raises, matching the
    contract every call site in this app already relies on.
    """
    if raw_text is None or not raw_text.strip():
        return None, "LLM returned an empty response"

    cleaned = _strip_fences(raw_text)

    # 1. The response is already clean JSON (the overwhelmingly common case).
    parsed, _ = _loads_object(cleaned)
    if parsed is not None:
        return parsed, None

    # 2. The object is embedded in commentary ("Sure! Here's the analysis: {...}").
    scanned = _scan_balanced_object(cleaned)
    if scanned:
        parsed, _ = _loads_object(scanned)
        if parsed is not None:
            return parsed, None

    # 3. Structurally sound but for trailing commas, which small models emit
    #    constantly and json.loads rejects outright.
    for candidate in (scanned, cleaned):
        if not candidate:
            continue
        parsed, _ = _loads_object(_TRAILING_COMMA_RE.sub(r"\1", candidate))
        if parsed is not None:
            return parsed, None

    # 4. Cut off by a token limit -- salvage the completed fields.
    closed = _close_truncated(cleaned)
    if closed:
        parsed, _ = _loads_object(_TRAILING_COMMA_RE.sub(r"\1", closed))
        if parsed is not None:
            return parsed, None

    # 5. Out of options. Report the original failure, not the repair attempts'.
    _, error = _loads_object(cleaned)
    return None, error
