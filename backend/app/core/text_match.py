# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Substring matching for text a person typed into a search box."""

LIKE_ESCAPE = "\\"


def contains_pattern(text: str) -> str:
    """`%text%` for ILIKE, with the text's own `%` and `_` matched as themselves.

    Typed into a search box, "100%" means the characters 1, 0, 0 and %, not "100
    followed by anything", and "event_id" does not mean "event, any one
    character, id". Pass LIKE_ESCAPE as the `escape` argument of `ilike`.
    """
    escaped = (
        text.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", LIKE_ESCAPE + "%")
        .replace("_", LIKE_ESCAPE + "_")
    )
    return f"%{escaped}%"
