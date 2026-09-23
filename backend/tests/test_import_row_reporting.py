# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_import_row_reporting.py

An import report must account for every row in the file.

The CSV/Excel parser used to drop rows silently -- no text, no options, or an
exception, all skipped with nothing in the report -- and to replace an
unrecognised difficulty or question type with medium or single choice without a
word. So a file with 20 bad rows out of 100 reported "80 valid", and the row
numbers in what it did report counted parsed questions rather than file rows, so
they pointed at the wrong line.

Plan section 12: import failures must identify the row, field, error, warning,
reason and action. These tests hold each of those.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

HEADER = "text,question_type,difficulty,domain,topic,certification,explanation,option_1,option_1_correct,option_2,option_2_correct\n"


def _row(text, question_type="single_choice", difficulty="medium", explanation="Because it is.", opt1="Right", opt2="Wrong"):
    return (
        f'"{text}",{question_type},{difficulty},Scrum,Events,Import Test Cert,'
        f'"{explanation}",{opt1},true,{opt2},false\n'
    )


def _validate(csv_text: str) -> dict:
    response = client.post(
        "/api/v1/imports/validate",
        files={"file": ("questions.csv", csv_text.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _unique(stem: str) -> str:
    return f"{stem} {uuid.uuid4().hex[:10]} — what does the Scrum Guide say?"


def test_every_row_is_accounted_for_including_the_ones_that_produced_nothing():
    csv_text = (
        HEADER
        + _row(_unique("Good question one"))
        # row 3: other cells filled but no question text
        + ',single_choice,medium,Scrum,Events,Import Test Cert,"x",Right,true,Wrong,false\n'
        + _row(_unique("Good question two"))
        # row 5: question text but no choices at all
        + f'"{_unique("No choices")}",single_choice,medium,Scrum,Events,Import Test Cert,"x",,,,\n'
    )

    report = _validate(csv_text)

    # Four data rows in, four items out -- nothing vanished.
    assert report["total_processed"] == 4
    rows = {item["source_row"]: item for item in report["items"]}
    assert set(rows) == {2, 3, 4, 5}

    assert rows[3]["status"] == "error" and rows[3]["question"] is None
    assert "no question text" in rows[3]["issues"][0]["message"]
    assert rows[5]["status"] == "error" and rows[5]["question"] is None
    assert "no answer choices" in rows[5]["issues"][0]["message"]
    assert report["error_count"] >= 2


def test_row_numbers_are_the_rows_a_spreadsheet_shows():
    """The header is row 1, so the first question is row 2 -- even after a skip."""
    csv_text = (
        HEADER
        + ',single_choice,medium,Scrum,Events,Import Test Cert,"x",Right,true,Wrong,false\n'  # row 2, skipped
        + _row(_unique("Lands on row three"))  # row 3
    )

    report = _validate(csv_text)

    good = [i for i in report["items"] if i["question"] is not None]
    assert len(good) == 1
    assert good[0]["source_row"] == 3, (
        "a row number counting parsed questions, not file rows, points at the wrong line"
    )


def test_an_unrecognised_difficulty_is_reported_not_silently_replaced():
    report = _validate(HEADER + _row(_unique("Bad difficulty"), difficulty="expert"))

    item = report["items"][0]
    assert item["status"] == "warning"
    difficulty_issues = [i for i in item["issues"] if i["field"] == "difficulty"]
    assert len(difficulty_issues) == 1
    assert "'expert'" in difficulty_issues[0]["message"]
    assert "medium" in difficulty_issues[0]["message"]
    assert difficulty_issues[0]["action"]
    # Still importable -- the value is reported, not refused.
    assert item["question"]["difficulty"] == "medium"


def test_an_unrecognised_question_type_is_reported_not_silently_replaced():
    report = _validate(HEADER + _row(_unique("Bad type"), question_type="matching"))

    item = report["items"][0]
    type_issues = [i for i in item["issues"] if i["field"] == "question_type"]
    assert len(type_issues) == 1
    assert "'matching'" in type_issues[0]["message"]
    assert "single_choice" in type_issues[0]["action"]


def test_a_missing_explanation_is_a_warning_with_an_action():
    report = _validate(HEADER + _row(_unique("No explanation"), explanation=""))

    item = report["items"][0]
    assert item["status"] == "warning", "a missing explanation must not block the import"
    explanation_issues = [i for i in item["issues"] if i["field"] == "explanation"]
    assert explanation_issues and explanation_issues[0]["severity"] == "warning"
    assert explanation_issues[0]["action"]


def test_every_issue_says_what_to_do():
    """`message` says what is wrong; `action` says how to fix it."""
    csv_text = (
        HEADER
        + _row(_unique("Bad everything"), question_type="matching", difficulty="expert", explanation="")
        + ',single_choice,medium,Scrum,Events,Import Test Cert,"x",Right,true,Wrong,false\n'
    )

    report = _validate(csv_text)

    issues = [issue for item in report["items"] for issue in item["issues"]]
    assert issues
    assert all(issue.get("action") for issue in issues), [
        issue for issue in issues if not issue.get("action")
    ]


def test_a_clean_row_is_still_valid():
    """The counterpart: reporting more must not start flagging good rows."""
    report = _validate(HEADER + _row(_unique("Perfectly fine question")))

    assert report["items"][0]["status"] == "valid"
    assert report["items"][0]["issues"] == []
    assert report["items"][0]["source_row"] == 2
