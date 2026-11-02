# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The CCDAK question bank (backend/app/content/question_banks/ccdak/).

The learner imports `ccdak_question_bank.json` on the Question Bank screen; it is
built from one source file per exam section by `scripts/build_question_bank.py`.
These tests hold the bank to its sources (docs/research/ccdak-exam-research.md and
kafka-documentation-notes.md), to Confluent's exam guide (its six sections, at
least four options per question) and to the import's own validator, and keep it
from being answerable by pattern: the right answer's position is spread, and it
is not usually the longest option.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

from app.core.database import SessionLocal
from app.services.import_service import ImportService

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import build_question_bank  # noqa: E402

BANK = build_question_bank.output_path("ccdak")
SECTIONS = {
    # Confluent's April 2025 exam guide, sections 1-6 and their weights; the bank's planned size
    # for each (300 in all, in proportion), plus one matching and one build-list (ordering) question
    # per section, the guide's two other item formats (2026-10-30). 312 in all.
    "Apache Kafka Fundamentals": 69 + 2,          # 23%
    "Apache Kafka Application Development": 84 + 2,  # 28%
    "Apache Kafka Streams": 36 + 2,               # 12%
    "Kafka Connect": 45 + 2,                      # 15%
    "Application Testing": 24 + 2,                # 8%
    "Application Observability": 42 + 2,          # 13%
}
STRUCTURED = ("ordering", "matching")
# The guide's "Out of scope" list. ZooKeeper is no exam topic either: 4.x removed it.
OUT_OF_SCOPE = re.compile(r"ksqlDB|\bRBAC\b|Confluent for Kubernetes|\bCFK\b|ZooKeeper", re.IGNORECASE)


def _bank():
    return json.loads(BANK.read_text(encoding="utf-8"))


def _right(q):
    return [i for i, o in enumerate(q["options"]) if o["is_correct"]]


def test_the_shipped_bank_is_what_the_sources_build_to():
    built = build_question_bank.render(build_question_bank.build("ccdak"))
    assert built == BANK.read_text(encoding="utf-8"), "out of date: run scripts/build_question_bank.py ccdak"


def test_each_part_file_holds_exactly_its_sections_of_the_bank():
    # A learner who imported an earlier version imports only the part that is new; the import
    # warns about duplicates but adds them, so a part must hold its sections and nothing else.
    parts = build_question_bank.part_paths("ccdak")
    assert parts, "the bank declares its parts in src/bank.json"
    whole = _bank()
    for path, spec in parts.items():
        assert path.read_text(encoding="utf-8") == build_question_bank.render(
            build_question_bank.build_part("ccdak", spec)), f"{path.name} is out of date"
        part = json.loads(path.read_text(encoding="utf-8"))
        assert all(q in whole for q in part)
        if isinstance(spec, dict):
            # The formats part: exactly the matching and ordering questions, one of each per section.
            assert {q["question_type"] for q in part} == set(spec["types"])
            assert Counter(q["domain"] for q in part) == {d: 2 for d in SECTIONS}
        else:
            # A section part is its sections' choice questions, as first published.
            assert {q["domain"] for q in part} == {d for i, d in enumerate(SECTIONS, start=1) if i in spec}
            assert all(q["question_type"] not in STRUCTURED for q in part)


def test_every_question_belongs_to_the_ccdak_certification_and_an_exam_section():
    for q in _bank():
        assert q["certification"] == "CCDAK", q["tags"]
        assert q["domain"] in SECTIONS, q["domain"]


def test_each_section_has_its_planned_number_of_questions():
    counts = Counter(q["domain"] for q in _bank())
    for domain, n in counts.items():
        assert n == SECTIONS[domain], (domain, n)
    # Readiness needs at least ten questions per domain to judge it.
    assert all(n >= 10 for n in counts.values())


def test_ids_are_unique():
    ids = [q["tags"][1] for q in _bank()]
    assert len(ids) == len(set(ids))


def test_the_import_validator_finds_nothing_wrong():
    db = SessionLocal()
    try:
        report = ImportService(db).validate_file(BANK.name, BANK.read_bytes())
    finally:
        db.close()
    problems = [(item.index, i.severity, i.message) for item in report.items for i in item.issues]
    assert report.total_processed == len(_bank())
    assert problems == []


def test_questions_have_the_exam_guides_shape():
    for q in _bank():
        if q["question_type"] in STRUCTURED:
            # Matching and build list: every item is part of the answer, at least three of them.
            assert len(q["options"]) >= 3 and all(o["is_correct"] for o in q["options"]), q["tags"]
            assert [o["order_index"] for o in q["options"]] == list(range(len(q["options"]))), q["tags"]
            if q["question_type"] == "matching":
                targets = [o["match_target"] for o in q["options"]]
                assert all(targets) and len(set(targets)) == len(targets), q["tags"]
            assert q["explanation"].strip() and q["reference_url"].startswith("https://"), q["tags"]
            continue
        right = _right(q)
        assert len(q["options"]) >= 4, q["tags"]  # "four (4) or more response options"
        if q["question_type"] == "single_choice":
            assert len(right) == 1, q["tags"]
        else:
            assert q["question_type"] == "multiple_choice"
            assert 2 <= len(right) < len(q["options"]) - 1, q["tags"]
        assert q["explanation"].strip() and q["reference_url"].startswith("https://"), q["tags"]
        for o in q["options"]:
            assert o["is_correct"] or o["explanation_why_incorrect"], (q["tags"], o["option_text"])


def test_every_question_cites_research_that_exists():
    # build() raises on a citation of a section the research files lack; this checks the
    # cited sections are named in the explanation the learner reads.
    for q in _bank():
        assert re.search(r"Sources: (notes|ccdak) §\d+", q["explanation"]), q["tags"]


def test_the_right_answer_is_spread_over_positions():
    singles = [q for q in _bank() if q["question_type"] == "single_choice"]
    positions = Counter(_right(q)[0] for q in singles)
    for p in range(4):
        share = positions[p] / len(singles)
        assert 0.18 <= share <= 0.32, (p, positions)


def test_the_right_answer_is_not_usually_the_longest_option():
    # Checked per section as well as overall: a drill on one section must not be passable by
    # always picking the longest option, and a whole-bank figure can hide a section that is.
    singles = [q for q in _bank() if q["question_type"] == "single_choice"]

    def longest_share(qs):
        hits = 0
        for q in qs:
            lengths = [len(o["option_text"]) for o in q["options"]]
            hits += lengths[_right(q)[0]] == max(lengths)
        return hits / len(qs)

    assert longest_share(singles) <= 0.30
    for domain in {q["domain"] for q in singles}:
        share = longest_share([q for q in singles if q["domain"] == domain])
        assert share <= 0.40, (domain, round(share, 2))


def test_the_guides_four_item_formats_are_all_there():
    """Multiple-choice, multiple-response, matching and build list (ccdak §1)."""
    types = Counter(q["question_type"] for q in _bank())
    assert set(types) == {"single_choice", "multiple_choice", "matching", "ordering"}
    assert types["matching"] == types["ordering"] == 6


def test_nothing_out_of_scope_is_asked_or_taught_as_right():
    for q in _bank():
        right_text = " ".join(q["options"][i]["option_text"] for i in _right(q))
        assert not OUT_OF_SCOPE.search(q["text"] + " " + right_text), q["tags"]
