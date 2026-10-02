# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The question-bank integrity check: a source file against the database.

It exists to catch the kind of loss that once went unnoticed -- an import that
dropped answer options -- so what it must never do is call a damaged bank
clean. The database side is a fixed set of questions here, independent of
whatever else the test database holds.
"""

from types import SimpleNamespace

import pytest

from app.repositories.question_repository import QuestionRepository
from app.services.integrity_check_service import IntegrityCheckService


def db_question(qid, text, *options):
    return SimpleNamespace(id=qid, text=text, options=[SimpleNamespace(option_text=o) for o in options])


def source_question(sid, text, *options):
    return {"id": sid, "text": text, "options": [{"option_text": o} for o in options]}


@pytest.fixture
def bank(monkeypatch):
    """Replace the database's questions with the list the test sets."""
    holder = {"questions": []}
    monkeypatch.setattr(QuestionRepository, "get_all_unpaginated", lambda self: holder["questions"])
    return holder


def check(source):
    return IntegrityCheckService(db=None).compare_against_source(source)


def test_a_bank_that_matches_its_source_is_clean(bank):
    bank["questions"] = [db_question(1, "What is a Sprint?", "A timebox", "A meeting")]
    result = check([source_question("s1", "What is a Sprint?", "A timebox", "A meeting")])
    assert result["is_clean"] is True
    assert (result["source_total"], result["db_total"]) == (1, 1)
    assert result["missing_questions"] == result["option_mismatches"] == result["extra_questions"] == []


def test_questions_match_by_normalised_text_not_by_spacing_or_case(bank):
    bank["questions"] = [db_question(1, "what is a  sprint", "A timebox")]
    assert check([source_question("s1", "What is a Sprint?", "A timebox")])["is_clean"] is True


def test_a_question_missing_from_the_bank_is_reported_and_not_clean(bank):
    bank["questions"] = []
    result = check([source_question("s7", "Who owns the Product Backlog?", "The Product Owner")])
    assert result["is_clean"] is False
    assert result["missing_questions"] == [{"source_id": "s7", "text": "Who owns the Product Backlog?"}]


def test_a_lost_option_is_reported_with_its_counts_and_not_clean(bank):
    # The original bug: the question imported, one of its options did not.
    bank["questions"] = [db_question(4, "Pick two", "A", "B")]
    result = check([source_question("s4", "Pick two", "A", "B", "C")])
    assert result["is_clean"] is False
    assert result["option_mismatches"] == [{
        "db_id": 4, "source_id": "s4", "text": "Pick two",
        "expected_option_count": 3, "actual_option_count": 2, "missing_options": ["C"],
    }]


def test_extra_questions_in_the_bank_are_listed_but_do_not_make_it_unclean(bank):
    # The bank holds more than one source file's questions; that is normal.
    bank["questions"] = [db_question(1, "In source", "A"), db_question(2, "Imported from elsewhere", "B")]
    result = check([source_question("s1", "In source", "A")])
    assert result["is_clean"] is True
    assert result["extra_questions"] == [{"db_id": 2, "text": "Imported from elsewhere"}]


def test_a_duplicated_question_in_the_bank_is_reported_not_hidden(bank):
    """Two rows with the same question: the second copy is an extra row.

    The check kept one question per text, so the second copy vanished -- not
    matched, not extra, counted in db_total and reported nowhere -- the very
    damage (a double import) this check is for.
    """
    bank["questions"] = [db_question(1, "What is a Sprint?", "A timebox"), db_question(9, "What is a sprint", "A timebox")]
    result = check([source_question("s1", "What is a Sprint?", "A timebox")])
    assert result["db_total"] == 2
    assert result["extra_questions"] == [{"db_id": 9, "text": "What is a sprint", "duplicate_of": 1}]


def test_long_texts_are_cut_to_120_characters_in_the_report(bank):
    bank["questions"] = []
    long_text = "Q" * 500
    assert check([source_question("s1", long_text)])["missing_questions"][0]["text"] == "Q" * 120


def test_a_source_entry_without_text_or_options_does_not_crash_the_check(bank):
    bank["questions"] = [db_question(1, "Something", "A")]
    result = check([{"id": "broken"}])
    assert result["missing_questions"] == [{"source_id": "broken", "text": ""}]
