from fastapi.testclient import TestClient

from app.main import app
from app.services import recording_analysis_providers as providers_module
from app.services.recording_analysis_providers import DEFAULT_PROVIDER_NAME
from app.core.config import DATA_DIR

client = TestClient(app)
RECORDINGS_DIR = DATA_DIR / "recordings"


def _upload(title="Test Recording", content=b"FAKE_AUDIO_BYTES_FOR_TEST", interview_question_id=None):
    files = {"file": ("test.webm", content, "audio/webm")}
    data = {"title": title, "duration_seconds": "10"}
    if interview_question_id is not None:
        data["interview_question_id"] = str(interview_question_id)
    res = client.post("/api/v1/recordings", files=files, data=data)
    assert res.status_code == 201, res.text
    return res.json()


def _create_question(round_type="behavioral", question_text="Tell me about a time you handled a conflict."):
    # Created directly via the repository against the isolated test DB, same
    # reasoning as test_system_design.py's _create_prompt -- don't depend on
    # ambient lifespan seeding, which doesn't run for a plain TestClient(app)
    # used outside a `with` block.
    from tests.conftest import TestingSessionLocal
    from app.repositories.interview_question_repository import InterviewQuestionRepository
    from app.schemas.interview_question import InterviewQuestionCreate

    db = TestingSessionLocal()
    try:
        repo = InterviewQuestionRepository(db)
        created = repo.create(InterviewQuestionCreate(
            round_type=round_type,
            question_text=question_text,
            category="Test Category",
            is_ai_generated=False,
        ))
        return {"id": created.id, "question_text": created.question_text, "round_type": created.round_type.value}
    finally:
        db.close()


class _FakeProvider:
    def __init__(self, name, available, result=None, error=None):
        self.name = name
        self._available = available
        self._result = result
        self._error = error

    def is_available(self):
        return self._available

    def analyze(self, audio_bytes, mime_type, question_context=None):
        self.last_question_context = question_context
        return self._result, self._error


def _register_fake(monkeypatch, provider):
    """Registers a fake provider without disturbing other already-registered
    providers -- the registry is process-global/lazily-initialized, so tests
    add/override by name rather than resetting the whole dict."""
    providers_module._ensure_registered()
    monkeypatch.setitem(providers_module._PROVIDERS, provider.name, provider)


def test_upload_recording_saves_file_and_row():
    recording = _upload(title="Upload Test")
    assert recording["title"] == "Upload Test"
    assert recording["file_size_bytes"] == len(b"FAKE_AUDIO_BYTES_FOR_TEST")

    fetched = client.get(f"/api/v1/recordings/{recording['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == recording["id"]

    audio = client.get(f"/api/v1/recordings/{recording['id']}/audio")
    assert audio.status_code == 200
    assert audio.content == b"FAKE_AUDIO_BYTES_FOR_TEST"

    client.delete(f"/api/v1/recordings/{recording['id']}")


def test_delete_recording_removes_file_and_row():
    recording = _upload(title="Delete Test")
    # The on-disk filename is a generated UUID, not the id -- read it from the
    # isolated TEST database (TestClient's requests are routed there via the
    # dependency override in tests/conftest.py), not the real dev DB.
    from tests.conftest import TestingSessionLocal
    from app.models.practice_recording import PracticeRecording
    db = TestingSessionLocal()
    row = db.query(PracticeRecording).filter(PracticeRecording.id == recording["id"]).first()
    on_disk_path = RECORDINGS_DIR / row.file_path
    db.close()
    assert on_disk_path.exists()

    res = client.delete(f"/api/v1/recordings/{recording['id']}")
    assert res.status_code == 200

    assert not on_disk_path.exists(), "File was not removed from disk on delete."

    fetch = client.get(f"/api/v1/recordings/{recording['id']}")
    assert fetch.status_code == 404


def test_playback_endpoint_works_with_no_analysis_present():
    """Recording/playback must have zero AI dependency -- confirmed here by
    never touching the provider registry at all in this test."""
    recording = _upload(title="Playback Only")
    audio = client.get(f"/api/v1/recordings/{recording['id']}/audio")
    assert audio.status_code == 200

    analysis = client.get(f"/api/v1/recordings/{recording['id']}/analysis")
    assert analysis.status_code == 404  # no analysis has been run yet

    client.delete(f"/api/v1/recordings/{recording['id']}")


def test_analyze_no_provider_available_returns_unavailable_not_fabricated(monkeypatch):
    fake = _FakeProvider(DEFAULT_PROVIDER_NAME, available=False)
    _register_fake(monkeypatch, fake)

    recording = _upload(title="No Provider Test")
    res = client.post(f"/api/v1/recordings/{recording['id']}/analyze", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["analysis_status"] == "unavailable"
    assert body["transcript"] is None
    assert body["communication_scores"] == []
    assert body["filler_word_count"] is None

    client.delete(f"/api/v1/recordings/{recording['id']}")


def test_analyze_mocked_provider_success(monkeypatch):
    fake = _FakeProvider(DEFAULT_PROVIDER_NAME, available=True, result={
        "transcript": "So, um, I would design this by first, uh, clarifying requirements.",
        "communication_scores": [
            {"category": "Clarity", "score": 6, "max_score": 10, "feedback": "Mostly clear, some hedging."},
            {"category": "Filler-Word Usage", "score": 4, "max_score": 10, "feedback": "Frequent 'um' and 'uh'."},
        ],
        "filler_word_count": 5,
        "summary": "Understandable but hesitant delivery.",
    })
    _register_fake(monkeypatch, fake)

    recording = _upload(title="Success Test")
    res = client.post(f"/api/v1/recordings/{recording['id']}/analyze", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["analysis_status"] == "analyzed"
    assert "clarifying requirements" in body["transcript"]
    assert len(body["communication_scores"]) == 2
    assert body["filler_word_count"] == 5

    # Persisted -- a fresh GET returns the same analysis.
    fetch = client.get(f"/api/v1/recordings/{recording['id']}/analysis")
    assert fetch.status_code == 200
    assert fetch.json()["analysis_status"] == "analyzed"

    client.delete(f"/api/v1/recordings/{recording['id']}")


def test_analyze_mocked_provider_error_persists_error_status(monkeypatch):
    fake = _FakeProvider(DEFAULT_PROVIDER_NAME, available=True, result=None, error="LLM returned malformed JSON")
    _register_fake(monkeypatch, fake)

    recording = _upload(title="Error Test")
    res = client.post(f"/api/v1/recordings/{recording['id']}/analyze", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["analysis_status"] == "error"
    assert "malformed JSON" in body["analysis_error"]
    assert body["transcript"] is None

    client.delete(f"/api/v1/recordings/{recording['id']}")


def test_provider_registry_lists_availability_correctly(monkeypatch):
    real_default = _FakeProvider(DEFAULT_PROVIDER_NAME, available=True)
    always_off = _FakeProvider("always_off_test_provider", available=False)
    _register_fake(monkeypatch, real_default)
    _register_fake(monkeypatch, always_off)

    res = client.get("/api/v1/recordings/providers")
    assert res.status_code == 200
    by_name = {p["name"]: p["is_available"] for p in res.json()}
    assert by_name[DEFAULT_PROVIDER_NAME] is True
    assert by_name["always_off_test_provider"] is False


def test_analyze_recording_linked_to_question_gets_content_scores(monkeypatch):
    fake = _FakeProvider(DEFAULT_PROVIDER_NAME, available=True, result={
        "transcript": "I once had to give a teammate difficult feedback about missed deadlines.",
        "communication_scores": [{"category": "Clarity", "score": 7, "max_score": 10, "feedback": "Clear."}],
        "filler_word_count": 1,
        "summary": "Clear delivery.",
        "content_scores": [
            {"category": "STAR Structure", "score": 6, "max_score": 10, "feedback": "Situation and action present, result was vague."},
        ],
        "content_summary": "Decent example but the outcome wasn't quantified.",
    })
    _register_fake(monkeypatch, fake)

    question = _create_question("hiring_manager")
    recording = _upload(title="Linked Test", interview_question_id=question["id"])

    res = client.post(f"/api/v1/recordings/{recording['id']}/analyze", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["analysis_status"] == "analyzed"
    assert len(body["content_scores"]) == 1
    assert body["content_scores"][0]["category"] == "STAR Structure"
    assert "outcome" in body["content_summary"]

    # The provider actually received the question context -- proves the
    # service wired the linkage through, not just that content happened to
    # be in the mocked response.
    assert fake.last_question_context == {"round_type": "hiring_manager", "question_text": question["question_text"]}

    client.delete(f"/api/v1/recordings/{recording['id']}")


def test_analyze_freeform_recording_gets_empty_content_scores(monkeypatch):
    """Critical backward-compat regression test: a recording with no linked
    question must get exactly today's delivery-only behavior -- empty content
    fields, not nulls-that-happen-to-look-empty, and the provider must not
    even be asked for content grading (question_context is None)."""
    fake = _FakeProvider(DEFAULT_PROVIDER_NAME, available=True, result={
        "transcript": "Just practicing speaking out loud.",
        "communication_scores": [{"category": "Clarity", "score": 8, "max_score": 10, "feedback": "Clear."}],
        "filler_word_count": 0,
        "summary": "Clear and confident.",
        # Deliberately no content_scores/content_summary keys, matching what
        # a real provider would omit when it was never asked for content
        # grading in the first place.
    })
    _register_fake(monkeypatch, fake)

    recording = _upload(title="Freeform Test")  # no interview_question_id
    res = client.post(f"/api/v1/recordings/{recording['id']}/analyze", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["analysis_status"] == "analyzed"
    assert body["content_scores"] == []
    assert body["content_summary"] is None
    assert fake.last_question_context is None

    # Communication grading is unaffected by the absence of a question.
    assert len(body["communication_scores"]) == 1
    assert body["communication_scores"][0]["category"] == "Clarity"

    client.delete(f"/api/v1/recordings/{recording['id']}")


def test_analyze_linked_recording_communication_rubric_unaffected_by_question(monkeypatch):
    """The delivery rubric (communication_scores) must be identical in shape
    whether or not a question is attached -- only content_scores should
    depend on question presence."""
    fake = _FakeProvider(DEFAULT_PROVIDER_NAME, available=True, result={
        "transcript": "Some spoken answer.",
        "communication_scores": [
            {"category": "Clarity", "score": 5, "max_score": 10, "feedback": "Somewhat unclear."},
            {"category": "Pacing", "score": 6, "max_score": 10, "feedback": "A bit rushed."},
        ],
        "filler_word_count": 3,
        "summary": "Mixed delivery.",
        "content_scores": [{"category": "Relevance to Question", "score": 7, "max_score": 10, "feedback": "On topic."}],
        "content_summary": "Answered the question directly.",
    })
    _register_fake(monkeypatch, fake)

    question = _create_question("hr_screening")
    recording = _upload(title="Rubric Check", interview_question_id=question["id"])
    res = client.post(f"/api/v1/recordings/{recording['id']}/analyze", json={})
    body = res.json()

    assert {c["category"] for c in body["communication_scores"]} == {"Clarity", "Pacing"}
    assert body["filler_word_count"] == 3

    client.delete(f"/api/v1/recordings/{recording['id']}")
