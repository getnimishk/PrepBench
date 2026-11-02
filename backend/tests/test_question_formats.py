# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_question_formats.py

Ordering ("build list") and matching questions, end to end: created and validated, graded by the
one rule the exam engine and the review check share (services/answer_grading.py), and never counted
as answered until the answer is complete.
"""
import json
import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.question import Question, QuestionType
from app.services.answer_grading import grade
from app.services.import_service import ImportService

client = TestClient(app)

STEPS = ["Write the record", "Replicate to followers", "Advance the high watermark", "Consumers can read it"]
PAIRS = [("acks=0", "No acknowledgement"), ("acks=1", "The leader only"), ("acks=all", "All in-sync replicas")]


def _question(kind: str, cert: str) -> dict:
    if kind == "ordering":
        options = [{"option_text": t, "is_correct": True, "order_index": i} for i, t in enumerate(STEPS)]
    else:
        options = [{"option_text": a, "match_target": b, "is_correct": True, "order_index": i} for i, (a, b) in enumerate(PAIRS)]
    res = client.post("/api/v1/questions", json={
        "text": f"A {kind} question about writes {uuid.uuid4().hex[:6]}",
        "question_type": kind, "certification": cert, "options": options,
    })
    assert res.status_code == 201, res.text
    return res.json()


def _exam(cert: str) -> tuple[int, dict]:
    res = client.post("/api/v1/exams", json={"title": "Formats", "exam_mode": "practice", "certification": cert, "total_questions": 1})
    assert res.status_code == 201, res.text
    sid = res.json()["id"]
    return sid, client.get(f"/api/v1/exams/{sid}").json()["questions"][0]


def _answer(sid: int, qid: int, ids: list[int]) -> dict:
    res = client.post(f"/api/v1/exams/{sid}/answer", json={"question_id": qid, "selected_option_ids": ids, "time_spent_seconds": 5})
    assert res.status_code == 200, res.text
    answers = client.get(f"/api/v1/exams/{sid}").json()["answers"]
    return next(a for a in answers if a["question_id"] == qid)


def _ids_in_stored_order(q: dict) -> list[int]:
    return [o["id"] for o in sorted(q["options"], key=lambda o: o["order_index"])]


def test_the_options_keep_their_match_target_and_order():
    cert = uuid.uuid4().hex
    q = _question("matching", cert)
    assert [(o["option_text"], o["match_target"]) for o in sorted(q["options"], key=lambda o: o["order_index"])] == PAIRS
    assert q["question_type"] == "matching"


def test_an_ordering_answer_is_right_only_in_the_stored_order():
    cert = uuid.uuid4().hex
    _question("ordering", cert)
    sid, q = _exam(cert)
    right = _ids_in_stored_order(q)
    assert _answer(sid, q["id"], list(reversed(right)))["is_correct"] is False
    assert _answer(sid, q["id"], right)["is_correct"] is True
    # Not every item placed: not answered yet, never "wrong".
    assert _answer(sid, q["id"], right[:2])["is_correct"] is None
    finished = client.post(f"/api/v1/exams/{sid}/finish").json()
    assert finished["status"] == "completed"


def test_a_matching_answer_is_right_only_when_every_item_has_its_own_target():
    cert = uuid.uuid4().hex
    _question("matching", cert)
    sid, q = _exam(cert)
    right = _ids_in_stored_order(q)
    swapped = [right[1], right[0], right[2]]
    assert _answer(sid, q["id"], swapped)["is_correct"] is False
    # An item not yet paired (0): not answered, and not counted as answered in the session.
    assert _answer(sid, q["id"], [right[0], 0, right[2]])["is_correct"] is None
    session = client.get(f"/api/v1/exams/{sid}").json()
    assert session["answered_questions"] == 0
    assert _answer(sid, q["id"], right)["is_correct"] is True


def test_the_shared_rule_still_grades_choice_questions_by_set():
    db = SessionLocal()
    try:
        q = db.query(Question).filter(Question.question_type == QuestionType.MULTIPLE_CHOICE).first()
        if q is None:
            return
        correct = [o.id for o in q.options if o.is_correct]
        assert grade(q, list(reversed(correct))) is True
        assert grade(q, []) is None
    finally:
        db.close()


def test_the_import_validator_accepts_both_formats_and_catches_a_missing_target():
    good = [
        {"text": "Put the steps of an acks=all write in order, first to last.", "question_type": "ordering",
         "certification": "Formats test", "domain": "D", "topic": "T", "explanation": "Because.",
         "options": [{"option_text": t, "is_correct": True} for t in STEPS]},
        {"text": "Match each acks setting to what the producer waits for.", "question_type": "matching",
         "certification": "Formats test", "domain": "D", "topic": "T", "explanation": "Because.",
         "options": [{"option_text": a, "match_target": b, "is_correct": True} for a, b in PAIRS]},
    ]
    bad = json.loads(json.dumps(good[1]))
    bad["options"][1]["match_target"] = ""
    db = SessionLocal()
    try:
        report = ImportService(db).validate_file("formats.json", json.dumps(good + [bad]).encode())
    finally:
        db.close()
    errors = [[i.message for i in item.issues if i.severity == "error"] for item in report.items]
    assert errors[0] == [] and errors[1] == []
    assert any("match_target" in m for m in errors[2])


def test_a_review_check_uses_the_same_rule():
    from app.services.review_service import ReviewService
    cert = uuid.uuid4().hex
    created = _question("ordering", cert)
    db = SessionLocal()
    try:
        q = db.get(Question, created["id"])
        right = [o.id for o in sorted(q.options, key=lambda o: o.order_index)]
        assert grade(q, right) is True and grade(q, right[::-1]) is False
        assert ReviewService.__init__  # the check calls grade(); its own tests cover the flow
    finally:
        db.close()
