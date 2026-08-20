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
    from app.utils.seed_interview_questions import seed_interview_questions_if_empty
    from app.repositories.interview_question_repository import InterviewQuestionRepository
    from app.schemas.interview_question import InterviewQuestionFilter

    db = TestingSessionLocal()
    try:
        seed_interview_questions_if_empty(db)  # no-ops if already seeded by an earlier test
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
    assert "GEMINI_API_KEY" in res.json()["detail"]


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
    from app.utils.seed_interview_questions import seed_interview_questions_if_empty

    db = TestingSessionLocal()
    try:
        seed_interview_questions_if_empty(db)
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
