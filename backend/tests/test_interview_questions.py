# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import json
import uuid
from fastapi.testclient import TestClient

from app.main import app
from tests.llm_fakes import (
    clear_env_provider,
    fake_gemini_text_response,
    patch_gateway_transport,
    set_env_provider,
)

client = TestClient(app)


def _clear_api_key(monkeypatch):
    clear_env_provider(monkeypatch)


def test_round_types_lists_all_four():
    res = client.get("/api/v1/interview-questions/round-types")
    assert res.status_code == 200
    values = {r["value"] for r in res.json()}
    assert values == {"hr_screening", "hiring_manager", "system_design", "behavioral"}


def test_seed_function_creates_questions_for_every_round():
    """Exercises the actual seed function directly against the isolated test
    DB -- app-level lifespan seeding only runs when TestClient is used as a
    context manager (which these tests, matching this file's established
    TestClient(app) pattern, don't do), so this is the reliable way to verify
    the seed data itself rather than depending on ambient startup wiring."""
    from tests.conftest import TestingSessionLocal
    from app.utils.seed_interview_questions import seed_interview_questions
    from app.repositories.interview_question_repository import InterviewQuestionRepository
    from app.schemas.interview_question import InterviewQuestionFilter

    db = TestingSessionLocal()
    try:
        seed_interview_questions(db)  # no-ops if already seeded by an earlier test
        repo = InterviewQuestionRepository(db)
        for round_type in ["hr_screening", "hiring_manager", "system_design", "behavioral"]:
            count = repo.count(InterviewQuestionFilter(round_type=round_type))
            assert count > 0, f"No seeded questions for round_type={round_type}"
    finally:
        db.close()


def test_get_unknown_question_404s():
    res = client.get("/api/v1/interview-questions/999999999")
    assert res.status_code == 404


def test_generate_question_no_api_key_returns_clear_error(monkeypatch):
    _clear_api_key(monkeypatch)
    res = client.post("/api/v1/interview-questions/generate", json={"round_type": "hr_screening"})
    assert res.status_code == 503
    detail = res.json()["detail"]
    assert "GEMINI" not in detail.upper()
    assert "AI Providers" in detail


def test_generate_question_mocked_gemini_with_save_to_bank(monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "question_text": "Tell me about a time you managed a difficult stakeholder.",
        "category": "Stakeholder Management",
    }))

    before = client.get("/api/v1/interview-questions?round_type=hiring_manager&limit=500").json()["total"]
    res = client.post("/api/v1/interview-questions/generate", json={
        "round_type": "hiring_manager",
        "topic": "stakeholder management",
        "save_to_bank": True,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["is_ai_generated"] is True
    assert body["id"] != 0
    assert body["round_type"] == "hiring_manager"

    after = client.get("/api/v1/interview-questions?round_type=hiring_manager&limit=500").json()["total"]
    assert after == before + 1


def test_generate_question_not_saved_returns_ephemeral_sentinel(monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response(
        {"question_text": "Why do you want this job?", "category": "Motivation"}
    ))

    before = client.get("/api/v1/interview-questions?round_type=hr_screening&limit=500").json()["total"]
    res = client.post("/api/v1/interview-questions/generate", json={
        "round_type": "hr_screening",
        "save_to_bank": False,
    })
    assert res.status_code == 200
    assert res.json()["id"] == 0

    after = client.get("/api/v1/interview-questions?round_type=hr_screening&limit=500").json()["total"]
    assert after == before  # not persisted


def test_category_filter_scoped_to_round_type():
    from tests.conftest import TestingSessionLocal
    from app.utils.seed_interview_questions import seed_interview_questions

    db = TestingSessionLocal()
    try:
        seed_interview_questions(db)
    finally:
        db.close()

    res = client.get("/api/v1/interview-questions/categories?round_type=behavioral")
    assert res.status_code == 200
    categories = res.json()
    assert isinstance(categories, list)
    assert len(categories) > 0


# ---- Import ----------------------------------------------------------

def test_import_plain_text_creates_questions_with_default_round():
    before = client.get("/api/v1/interview-questions?round_type=behavioral&limit=500").json()["total"]
    res = client.post("/api/v1/interview-questions/import", data={
        "default_round_type": "behavioral",
        "text": "Tell me about a time you overcame a challenge.\n\nDescribe your ideal work environment.",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["imported_count"] == 2
    assert body["skipped_count"] == 0
    assert body["errors"] == []

    after = client.get("/api/v1/interview-questions?round_type=behavioral&limit=500").json()["total"]
    assert after == before + 2


def test_import_json_with_per_item_round_type_and_category():
    # Unique text per run: if the isolated test DB's teardown doesn't fire
    # cleanly between separate pytest invocations (observed to happen in this
    # environment), a fixed literal string would collide with a leftover row
    # from a prior run and break the "exactly 1 match" assertion below.
    marker = uuid.uuid4().hex[:8]
    question_text = f"Design a parking garage system out loud [{marker}]."
    res = client.post(
        "/api/v1/interview-questions/import",
        data={"default_round_type": "hiring_manager"},
        files={"file": ("questions.json", json.dumps([
            {"question_text": question_text, "round_type": "system_design", "category": "Object Design"}
        ]).encode(), "application/json")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported_count"] == 1
    assert body["skipped_count"] == 0

    listing = client.get("/api/v1/interview-questions?round_type=system_design&limit=500").json()
    matches = [q for q in listing["items"] if q["question_text"] == question_text]
    assert len(matches) == 1
    assert matches[0]["category"] == "Object Design"


def test_import_csv_header_row_parsed_correctly():
    marker = uuid.uuid4().hex[:8]
    question_text = f"Why do you want to work here specifically [{marker}]?"
    csv_content = f"round_type,question_text,category\nhr_screening,{question_text},Motivation\n".encode()
    res = client.post(
        "/api/v1/interview-questions/import",
        data={"default_round_type": "behavioral"},
        files={"file": ("questions.csv", csv_content, "text/csv")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported_count"] == 1

    listing = client.get("/api/v1/interview-questions?round_type=hr_screening&limit=500").json()
    matches = [q for q in listing["items"] if q["question_text"] == question_text]
    assert len(matches) == 1
    assert matches[0]["category"] == "Motivation"


def test_import_json_carries_prepared_answer_and_talking_points():
    # These were once dropped on import, so a file with a full answer plan
    # arrived as bare questions and a graded take had nothing to measure.
    marker = uuid.uuid4().hex[:8]
    question_text = f"What is the hardest part of a platform migration [{marker}]?"
    res = client.post(
        "/api/v1/interview-questions/import",
        data={"default_round_type": "hiring_manager"},
        files={"file": ("questions.json", json.dumps({"questions": [{
            "question_text": question_text,
            "prepared_answer": "  Governance and identity redesign, not the code.  ",
            "key_talking_points": ["Code conversion is mechanical", "  ", "Identity is its own workstream"],
        }]}).encode(), "application/json")},
    )
    assert res.status_code == 200
    assert res.json()["imported_count"] == 1

    listing = client.get("/api/v1/interview-questions?round_type=hiring_manager&limit=500").json()
    match = next(q for q in listing["items"] if q["question_text"] == question_text)
    assert match["prepared_answer"] == "Governance and identity redesign, not the code."
    assert match["key_talking_points"] == ["Code conversion is mechanical", "Identity is its own workstream"]


def test_import_csv_splits_talking_points_on_pipe_and_newline():
    marker = uuid.uuid4().hex[:8]
    question_text = f"How would you sequence migration waves [{marker}]?"
    csv_content = (
        "question_text,round_type,prepared_answer,key_talking_points\n"
        f'{question_text},hiring_manager,"Pilot first, critical domains last.","Pilot waves first | Rising criticality\nCritical domains last"\n'
    ).encode()
    res = client.post(
        "/api/v1/interview-questions/import",
        data={"default_round_type": "behavioral"},
        files={"file": ("questions.csv", csv_content, "text/csv")},
    )
    assert res.status_code == 200
    assert res.json()["imported_count"] == 1

    listing = client.get("/api/v1/interview-questions?round_type=hiring_manager&limit=500").json()
    match = next(q for q in listing["items"] if q["question_text"] == question_text)
    assert match["prepared_answer"] == "Pilot first, critical domains last."
    assert match["key_talking_points"] == ["Pilot waves first", "Rising criticality", "Critical domains last"]


def test_import_without_answer_fields_leaves_them_empty():
    marker = uuid.uuid4().hex[:8]
    question_text = f"Freeform question with no plan [{marker}]."
    res = client.post(
        "/api/v1/interview-questions/import",
        data={"default_round_type": "behavioral"},
        files={"file": ("q.json", json.dumps([{"question_text": question_text}]).encode(), "application/json")},
    )
    assert res.json()["imported_count"] == 1

    listing = client.get("/api/v1/interview-questions?round_type=behavioral&limit=500").json()
    match = next(q for q in listing["items"] if q["question_text"] == question_text)
    assert match["prepared_answer"] is None
    assert match["key_talking_points"] is None


def test_import_rejects_malformed_answer_fields_instead_of_dropping_them():
    data = json.dumps([
        {"question_text": "Points are not strings", "key_talking_points": ["ok", 3]},
        {"question_text": "Points are an object", "key_talking_points": {"a": "b"}},
        {"question_text": "Answer is a list", "prepared_answer": ["not", "text"]},
    ]).encode()
    res = client.post(
        "/api/v1/interview-questions/import",
        data={"default_round_type": "behavioral"},
        files={"file": ("q.json", data, "application/json")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported_count"] == 0
    assert body["skipped_count"] == 3
    assert len(body["errors"]) == 3


def test_import_skips_invalid_rows_and_reports_errors_without_failing_whole_batch():
    data = b'[{"question_text": "Valid question here"}, {"question_text": ""}, {"question_text": "bad round", "round_type": "not_a_real_round"}, "not-a-dict"]'
    res = client.post(
        "/api/v1/interview-questions/import",
        data={"default_round_type": "behavioral"},
        files={"file": ("q.json", data, "application/json")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported_count"] == 1
    assert body["skipped_count"] == 3
    assert len(body["errors"]) == 3


# ---- Update / Delete ---------------------------------------------------

def test_update_question_changes_text_and_category():
    created = client.post("/api/v1/interview-questions/import", data={
        "default_round_type": "behavioral",
        "text": "Original question text.",
    }).json()
    assert created["imported_count"] == 1
    listing = client.get("/api/v1/interview-questions?round_type=behavioral&limit=500").json()
    qid = next(q["id"] for q in listing["items"] if q["question_text"] == "Original question text.")

    res = client.put(f"/api/v1/interview-questions/{qid}", json={
        "question_text": "Updated question text.",
        "category": "New Category",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["question_text"] == "Updated question text."
    assert body["category"] == "New Category"

    refetched = client.get(f"/api/v1/interview-questions/{qid}").json()
    assert refetched["question_text"] == "Updated question text."


def test_update_unknown_question_404s():
    res = client.put("/api/v1/interview-questions/999999999", json={"question_text": "x"})
    assert res.status_code == 404


def test_delete_question_removes_it():
    created = client.post("/api/v1/interview-questions/import", data={
        "default_round_type": "behavioral",
        "text": "Question to be deleted.",
    }).json()
    assert created["imported_count"] == 1
    listing = client.get("/api/v1/interview-questions?round_type=behavioral&limit=500").json()
    qid = next(q["id"] for q in listing["items"] if q["question_text"] == "Question to be deleted.")

    res = client.delete(f"/api/v1/interview-questions/{qid}")
    assert res.status_code == 200
    assert res.json()["deleted_id"] == qid

    fetch = client.get(f"/api/v1/interview-questions/{qid}")
    assert fetch.status_code == 404


def test_delete_unknown_question_404s():
    res = client.delete("/api/v1/interview-questions/999999999")
    assert res.status_code == 404


def test_delete_question_with_linked_recording_does_not_error():
    """Edge case found during implementation: a question that already has a
    practice recording pointing at it must still be deletable -- the FK is
    nullable specifically so this doesn't become a hard dependency. Confirms
    the delete doesn't raise and the recording survives with its link
    cleared, rather than leaving an orphaned/dangling reference."""
    from tests.conftest import TestingSessionLocal
    from app.repositories.recording_repository import PracticeRecordingRepository

    created = client.post("/api/v1/interview-questions/import", data={
        "default_round_type": "behavioral",
        "text": "Question that will have a recording attached.",
    }).json()
    listing = client.get("/api/v1/interview-questions?round_type=behavioral&limit=500").json()
    qid = next(q["id"] for q in listing["items"] if q["question_text"] == "Question that will have a recording attached.")

    db = TestingSessionLocal()
    try:
        repo = PracticeRecordingRepository(db)
        recording = repo.create(
            title="Linked to a soon-to-be-deleted question",
            file_path="does-not-need-to-exist.webm",
            mime_type="audio/webm",
            duration_seconds=5,
            file_size_bytes=10,
            interview_question_id=qid,
        )
        recording_id = recording.id
    finally:
        db.close()

    res = client.delete(f"/api/v1/interview-questions/{qid}")
    assert res.status_code == 200

    db = TestingSessionLocal()
    try:
        repo = PracticeRecordingRepository(db)
        survived = repo.get_by_id(recording_id)
        assert survived is not None, "Recording was unexpectedly deleted along with its linked question."
        assert survived.interview_question_id is None, "Recording's question link should be cleared, not dangling."
    finally:
        db.close()


def test_update_question_saves_prepared_answer_and_talking_points():
    created = client.post("/api/v1/interview-questions/import", data={
        "default_round_type": "behavioral",
        "text": "Tell me about a time you led a project.",
    }).json()
    assert created["imported_count"] == 1
    listing = client.get("/api/v1/interview-questions?round_type=behavioral&limit=500").json()
    qid = next(q["id"] for q in listing["items"] if q["question_text"] == "Tell me about a time you led a project.")

    res = client.put(f"/api/v1/interview-questions/{qid}", json={
        "prepared_answer": "Situation: Legacy migration with tight deadline.\nAction: Formed cross-functional task force.\nResult: 40% latency reduction.",
        "key_talking_points": ["40% latency reduction", "Cross-functional task force of 6", "Zero downtime deploy"],
    })
    assert res.status_code == 200
    body = res.json()
    assert "Situation: Legacy migration" in body["prepared_answer"]
    assert len(body["key_talking_points"]) == 3
    assert "Zero downtime deploy" in body["key_talking_points"]

    refetched = client.get(f"/api/v1/interview-questions/{qid}").json()
    assert refetched["prepared_answer"] == body["prepared_answer"]
    assert refetched["key_talking_points"] == ["40% latency reduction", "Cross-functional task force of 6", "Zero downtime deploy"]

