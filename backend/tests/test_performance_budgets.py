# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The parts of the performance gate that are exact, so they belong in the suite.

Timings vary by machine and live in scripts/perf_gate.py. What does not vary is
how many statements a read issues, and whether a faster algorithm still gives the
same answer. A list whose query count grows with its length is an N+1, and one
crept in unnoticed: the recordings list loaded each recording's analysis on its
own.
"""
import difflib

from fastapi.testclient import TestClient
from sqlalchemy import event

from app.main import app
from app.models.practice_recording import PracticeRecording
from app.models.recording_analysis import RecordingAnalysis
from app.schemas.question import QuestionCreate
from app.services.question_validator import QuestionValidator
from tests.conftest import TestingSessionLocal, test_engine

client = TestClient(app)


def _statements(call) -> int:
    count = 0

    def before(*_args, **_kwargs):
        nonlocal count
        count += 1

    event.listen(test_engine, "before_cursor_execute", before)
    try:
        call()
    finally:
        event.remove(test_engine, "before_cursor_execute", before)
    return count


def test_the_recordings_list_issues_as_many_queries_for_fifty_rows_as_for_five():
    db = TestingSessionLocal()
    made = []
    try:
        for i in range(60):
            recording = PracticeRecording(title=f"Budget take {i}", file_path=f"budget-{i}.webm", file_size_bytes=1)
            db.add(recording)
            db.flush()
            db.add(RecordingAnalysis(
                recording_id=recording.id, transcript="spoken words " * 500, analysis_status="analyzed",
                content_scores=[{"category": "Structure", "score": 5, "max_score": 10, "feedback": ""}],
                communication_scores=[{"category": "Clarity", "score": 8, "max_score": 10, "feedback": ""}],
            ))
            made.append(recording.id)
        db.commit()

        five = _statements(lambda: client.get("/api/v1/recordings?limit=5"))
        fifty = _statements(lambda: client.get("/api/v1/recordings?limit=50"))
        assert fifty == five

        # And the summary the list shows is still read from each analysis.
        item = next(r for r in client.get("/api/v1/recordings?limit=50").json()["items"] if r["id"] == made[-1])
        assert item["analysis_status"] == "analyzed"
        assert item["content_percent"] == 50
        assert item["delivery_percent"] == 80
    finally:
        db.query(PracticeRecording).filter(PracticeRecording.id.in_(made)).delete(synchronize_session=False)
        db.commit()
        db.close()


def _question(text: str) -> QuestionCreate:
    return QuestionCreate(
        text=text, question_type="single_choice", difficulty="medium", domain="Scrum", topic="Roles",
        certification="PSM I", explanation="Because.",
        options=[{"option_text": "Yes", "is_correct": True}, {"option_text": "No", "is_correct": False}],
    )


def _old_near_duplicate(bank, text):
    """The check exactly as it was written before the index: every bank text,
    normalised afresh, in bank order, the first match at 85% or more."""
    norm_q = QuestionValidator._normalize(text)
    for existing in bank:
        existing_norm = QuestionValidator._normalize(existing)
        if not existing_norm:
            continue
        if abs(len(norm_q) - len(existing_norm)) / max(len(norm_q), len(existing_norm), 1) > 0.15:
            continue
        ratio = difflib.SequenceMatcher(None, norm_q, existing_norm).ratio()
        if ratio >= 0.85:
            return f"Near-duplicate question ({int(ratio * 100)}% similarity) detected in your Question Bank."
    return None


def test_the_faster_near_duplicate_check_finds_the_same_question_at_the_same_similarity():
    bank = [
        "Who is accountable for ordering the Product Backlog in Scrum?",
        "Who creates the Increment during a Sprint?",
        "Who is accountable for ordering the Product Backlog in Scrum teams?",
        "What is the maximum length of a Sprint Review for a one-month Sprint?",
        "",
        "Which event closes the Sprint and plans improvements?",
    ]
    validator = QuestionValidator(db=None, enable_content_validator=False)
    validator.index_existing(bank)

    candidates = [
        "Who is accountable for ordering the Product Backlog in a Scrum?",   # near two of them
        "What is the maximum length of the Sprint Review for a one month Sprint?",
        "Which event closes a Sprint and plans improvement?",
        "Who creates the Increment during a Sprint?",                          # exact
        "An unrelated question about the colour of the Scrum board?",
    ]
    for index, text in enumerate(candidates):
        result = validator.validate_question(_question(text), index)
        found = [i.message for i in result.issues if i.field == "duplicate"]
        exact = QuestionValidator._normalize(text) in validator.existing_hashes
        expected = (["A question with identical text already exists in your Question Bank."] if exact
                    else [m for m in [_old_near_duplicate(bank, text)] if m])
        assert found == expected, text
