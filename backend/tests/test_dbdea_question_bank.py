# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_dbdea_question_bank.py

The Databricks Certified Data Engineer Associate question bank
(`backend/app/content/question_banks/dbdea/`) is a JSON file the learner imports
on the Question Bank screen, built from one source file per exam section by
`scripts/build_question_bank.py`. These tests hold it to:

  * its sources (the shipped file is what they build to) and the import
    validator (no errors or warnings);
  * the exam guide (August 2026): seven sections by weight, multiple-choice
    items with four or more options;
  * the research notes: every question cites a section of
    docs/research/databricks-documentation-notes.md;
  * fairness: right answers spread over the positions, and the right answer not
    usually the longest option, overall and per section;
  * accuracy rules from the notes: Unity Catalog SQL has no DENY statement, and
    Databricks publishes no pass mark, so the bank states none.
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

BANK = build_question_bank.output_path("dbdea")
CERTIFICATION = "Databricks Certified Data Engineer Associate"
SECTIONS = {
    # The August 2026 exam guide's sections and weights; the bank's planned size for each
    # (300 in all, in proportion). A section is checked once its questions exist.
    "Databricks Intelligence Platform": 18,           # 6%
    "Data Ingestion and Loading": 63,                 # 21%
    "Data Transformation and Modeling": 66,           # 22%
    "Working with Lakeflow Jobs": 48,                 # 16%
    "Implementing CI/CD": 30,                         # 10%
    "Troubleshooting, Monitoring, and Optimization": 30,  # 10%
    "Governance and Security": 45,                    # 15%
}


def _bank():
    return json.loads(BANK.read_text(encoding="utf-8"))


def _right(q):
    return [i for i, o in enumerate(q["options"]) if o["is_correct"]]


def test_the_shipped_bank_is_what_the_sources_build_to():
    built = build_question_bank.render(build_question_bank.build("dbdea"))
    assert built == BANK.read_text(encoding="utf-8"), "out of date: run scripts/build_question_bank.py dbdea"


def test_each_part_file_holds_exactly_its_sections_of_the_bank():
    # A learner who imported part 1 (sections 2, 3 and 7) imports only the part that is new; the import
    # warns about duplicates but adds them, so a part must hold its sections and nothing else.
    parts = build_question_bank.part_paths("dbdea")
    assert parts, "the bank declares its parts in src/bank.json"
    whole = _bank()
    for path, sections in parts.items():
        assert path.read_text(encoding="utf-8") == build_question_bank.render(
            build_question_bank.build("dbdea", sections=sections)), f"{path.name} is out of date"
        part = json.loads(path.read_text(encoding="utf-8"))
        assert {q["domain"] for q in part} == {d for i, d in enumerate(SECTIONS, start=1) if i in sections}
        assert all(q in whole for q in part)


def test_the_whole_bank_covers_every_section():
    assert set(Counter(q["domain"] for q in _bank())) == set(SECTIONS)
    assert len(_bank()) == sum(SECTIONS.values()) == 300


def test_every_question_belongs_to_the_certification_and_an_exam_section():
    for q in _bank():
        assert q["certification"] == CERTIFICATION, q["tags"]
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
        right = _right(q)
        assert len(q["options"]) >= 4, q["tags"]
        if q["question_type"] == "single_choice":
            assert len(right) == 1, q["tags"]
        else:
            assert q["question_type"] == "multiple_choice"
            assert 2 <= len(right) < len(q["options"]) - 1, q["tags"]
            assert re.search(r"\(Choose (two|three)\.\)$", q["text"]), q["tags"]
        assert q["explanation"].strip() and q["reference_url"].startswith("https://"), q["tags"]
        assert q["text"] == q["text"].strip() and "  " not in q["text"], q["tags"]
        for o in q["options"]:
            assert o["is_correct"] or o["explanation_why_incorrect"], (q["tags"], o["option_text"])


def test_every_question_cites_research_that_exists():
    # build() raises on a citation of a section the research file lacks; this checks the
    # cited sections are named in the explanation the learner reads.
    for q in _bank():
        assert re.search(r"Sources: notes §\d+", q["explanation"]), q["tags"]


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


def test_no_right_answer_teaches_a_deny_statement_in_unity_catalog():
    """Unity Catalog SQL has no DENY statement (notes §6.3, §19); only an ABAC DENY policy (Beta) exists."""
    for q in _bank():
        for i in _right(q):
            text = q["options"][i]["option_text"]
            if "DENY" in text:
                assert re.search(r"no DENY|ABAC|legacy|Beta", text), (q["tags"], text)


def test_no_pass_mark_is_stated():
    """Databricks publishes no pass mark for this exam (notes §1, §19)."""
    for q in _bank():
        blob = q["text"] + " " + q["explanation"] + " " + " ".join(o["option_text"] for o in q["options"])
        assert not re.search(r"pass(ing)? (mark|score)", blob, re.IGNORECASE), q["tags"]
