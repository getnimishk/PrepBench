# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The parts of a written system-design answer, in the order an interviewer expects them.

The plan's chain is prompt -> requirements -> architecture -> data model -> failure
handling -> trade-offs -> submit. Each is its own field, saved as it is typed. The
grader still reads one answer: the sections are joined under their headings, so the
rubric sees what the learner wrote in the shape they wrote it.
"""
from typing import Dict, Optional

SECTIONS = [
    ("requirements", "Requirements & scale assumptions"),
    ("architecture", "High-level architecture"),
    ("data_model", "Data model & storage"),
    ("failure_handling", "Failure handling"),
    ("trade_offs", "Trade-offs"),
]
SECTION_KEYS = [key for key, _ in SECTIONS]
SECTION_LABELS = dict(SECTIONS)


def clean_sections(raw: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
    """Every known section, trimmed; None when none was given at all."""
    if raw is None:
        return None
    return {key: (raw.get(key) or "").strip() for key in SECTION_KEYS}


def compose_answer(sections: Dict[str, str]) -> str:
    """The sections under their headings, empty ones left out."""
    parts = [
        f"## {SECTION_LABELS[key]}\n{sections[key]}"
        for key in SECTION_KEYS
        if sections.get(key)
    ]
    return "\n\n".join(parts)
