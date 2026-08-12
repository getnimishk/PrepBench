import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.services import system_design_service as sds_module
from app.services import llm_client

client = TestClient(app)


def _clear_api_key(monkeypatch):
    """Force SystemDesignService to see no configured API key, regardless of
    what's in the real .env file (which has a real key for the dev app)."""
    monkeypatch.setattr(sds_module.settings, "GEMINI_API_KEY", None)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


def _create_prompt(**overrides):
    # There's no public "create prompt" endpoint (prompts come from seeding or
    # AI generation), so tests create rows directly via the repository --
    # using the isolated TEST database (tests/conftest.py's TestingSessionLocal),
    # not app.core.database.SessionLocal, since that's the real dev DB and the
    # TestClient's requests are routed to the test DB via a dependency override.
    from tests.conftest import TestingSessionLocal
    from app.repositories.system_design_repository import SystemDesignPromptRepository
    from app.schemas.system_design import SystemDesignPromptCreate
    from app.models.question import QuestionDifficulty

    db = TestingSessionLocal()
    try:
        repo = SystemDesignPromptRepository(db)
        created = repo.create(SystemDesignPromptCreate(
            title=overrides.get("title", f"Test Prompt {uuid.uuid4().hex[:8]}"),
            prompt_text=overrides.get("prompt_text", "Design a system that does something."),
            category=overrides.get("category", "Test Category"),
            difficulty=overrides.get("difficulty", QuestionDifficulty.MEDIUM),
            is_ai_generated=False,
        ))
        return created.id
    finally:
        db.close()


def test_generate_prompt_no_api_key_returns_clear_error(monkeypatch):
    _clear_api_key(monkeypatch)
    res = client.post("/api/v1/system-design/prompts/generate", json={})
    assert res.status_code == 503
    assert "GEMINI_API_KEY" in res.json()["detail"]


def test_submit_attempt_no_api_key_returns_ungraded_not_fabricated_score(monkeypatch):
    _clear_api_key(monkeypatch)
    prompt_id = _create_prompt()

    res = client.post("/api/v1/system-design/attempts", json={
        "prompt_id": prompt_id,
        "answer_text": "My answer to the prompt.",
    })
    assert res.status_code == 201
    body = res.json()
    assert body["grading_status"] == "unavailable"
    assert body["overall_score"] is None
    assert body["category_scores"] == []
    assert body["strengths"] == []
    assert body["improvements"] == []

    # Persisted, not lost.
    fetch = client.get(f"/api/v1/system-design/attempts/{body['id']}")
    assert fetch.status_code == 200
    assert fetch.json()["grading_status"] == "unavailable"


def test_submit_attempt_unknown_prompt_id_404s(monkeypatch):
    _clear_api_key(monkeypatch)
    res = client.post("/api/v1/system-design/attempts", json={
        "prompt_id": 999999999,
        "answer_text": "Doesn't matter.",
    })
    assert res.status_code == 404


def test_submit_attempt_mocked_gemini_success(monkeypatch):
    monkeypatch.setattr(sds_module.settings, "GEMINI_API_KEY", "fake-key-for-test")

    def fake_call_gemini(client_, api_key, model, prompt, timeout=15.0):
        return {
            "category_scores": [
                {"category": "Requirements Clarification", "score": 8, "max_score": 10, "feedback": "Good."},
                {"category": "High-Level Architecture", "score": 6, "max_score": 10, "feedback": "Ok."},
            ],
            "overall_score": 70,
            "strengths": ["Clear structure"],
            "improvements": ["Discuss scaling more"],
            "summary": "Solid but could go deeper on scale.",
        }, None

    monkeypatch.setattr(llm_client, "call_gemini", fake_call_gemini)

    prompt_id = _create_prompt()
    res = client.post("/api/v1/system-design/attempts", json={
        "prompt_id": prompt_id,
        "answer_text": "A thorough answer.",
    })
    assert res.status_code == 201
    body = res.json()
    assert body["grading_status"] == "graded"
    assert body["overall_score"] == 70
    assert len(body["category_scores"]) == 2
    assert body["strengths"] == ["Clear structure"]
    assert body["improvements"] == ["Discuss scaling more"]
    assert "scale" in body["summary"]


def test_submit_attempt_mocked_gemini_malformed_json_falls_back_gracefully(monkeypatch):
    monkeypatch.setattr(sds_module.settings, "GEMINI_API_KEY", "fake-key-for-test")

    def fake_call_gemini(client_, api_key, model, prompt, timeout=15.0):
        return None, "LLM returned malformed JSON: Expecting value: line 1 column 1 (char 0)"

    monkeypatch.setattr(llm_client, "call_gemini", fake_call_gemini)

    prompt_id = _create_prompt()
    res = client.post("/api/v1/system-design/attempts", json={
        "prompt_id": prompt_id,
        "answer_text": "An answer.",
    })
    assert res.status_code == 201
    body = res.json()
    assert body["grading_status"] == "error"
    assert body["overall_score"] is None
    assert "malformed JSON" in body["grading_error"]


def test_target_role_conditions_prompt_text():
    service = sds_module.SystemDesignService.__new__(sds_module.SystemDesignService)
    generic = service._build_grading_prompt("Design X.", "My answer.", target_role=None)
    tailored = service._build_grading_prompt("Design X.", "My answer.", target_role="Senior Backend Engineer, fintech")

    assert "Senior Backend Engineer, fintech" not in generic
    assert "Senior Backend Engineer, fintech" in tailored

    # Same requested JSON schema section either way.
    schema_marker = '"category_scores"'
    assert schema_marker in generic and schema_marker in tailored
    generic_schema_section = generic.split("Respond ONLY")[1]
    tailored_schema_section = tailored.split("Respond ONLY")[1]
    assert generic_schema_section == tailored_schema_section


def test_system_design_analytics_empty_state_returns_zeros_not_error(monkeypatch):
    """Global aggregate endpoint -- other tests in this file/session create
    real graded attempts in the shared test DB, so this asserts the empty-
    state BRANCH of the service logic directly (by making the repository
    report zero graded attempts) rather than depending on the whole test DB
    genuinely having none, which would be a fragile, order-dependent
    assumption."""
    from tests.conftest import TestingSessionLocal
    from app.repositories.system_design_repository import SystemDesignAttemptRepository

    monkeypatch.setattr(SystemDesignAttemptRepository, "get_graded_ordered_by_date", lambda self: [])

    db = TestingSessionLocal()
    try:
        service = sds_module.SystemDesignService(db)
        analytics = service.get_analytics()
    finally:
        db.close()

    assert analytics.graded_count == 0
    assert analytics.average_score is None
    assert analytics.score_trend == []
    assert analytics.category_averages == []
    assert analytics.recent_attempts == []


def test_system_design_analytics_computes_correct_average_and_category_means(monkeypatch):
    from tests.conftest import TestingSessionLocal
    from app.repositories.system_design_repository import SystemDesignAttemptRepository
    from app.models.system_design_attempt import SystemDesignAttempt
    from app.models.system_design_prompt import SystemDesignPrompt
    from app.models.question import QuestionDifficulty
    from datetime import datetime, UTC

    prompt = SystemDesignPrompt(
        id=1, title="Design a URL Shortener", prompt_text="...",
        category="Distributed Systems", difficulty=QuestionDifficulty.MEDIUM,
        is_ai_generated=False, created_at=datetime.now(UTC).replace(tzinfo=None),
    )
    fake_attempts = [
        SystemDesignAttempt(
            id=1, prompt_id=1, answer_text="a1", overall_score=60.0,
            category_scores=[
                {"category": "Requirements Clarification", "score": 8, "max_score": 10, "feedback": ""},
                {"category": "High-Level Architecture", "score": 4, "max_score": 10, "feedback": ""},
            ],
            grading_status="graded", created_at=datetime(2026, 1, 1),
        ),
        SystemDesignAttempt(
            id=2, prompt_id=1, answer_text="a2", overall_score=80.0,
            category_scores=[
                {"category": "Requirements Clarification", "score": 6, "max_score": 10, "feedback": ""},
                {"category": "High-Level Architecture", "score": 8, "max_score": 10, "feedback": ""},
            ],
            grading_status="graded", created_at=datetime(2026, 1, 2),
        ),
    ]
    for a in fake_attempts:
        a.prompt = prompt

    monkeypatch.setattr(SystemDesignAttemptRepository, "get_graded_ordered_by_date", lambda self: fake_attempts)

    db = TestingSessionLocal()
    try:
        service = sds_module.SystemDesignService(db)
        analytics = service.get_analytics()
    finally:
        db.close()

    assert analytics.graded_count == 2
    assert analytics.average_score == 70.0  # (60 + 80) / 2

    by_category = {c.category: c.score for c in analytics.category_averages}
    assert by_category["Requirements Clarification"] == 7.0  # (8 + 6) / 2
    assert by_category["High-Level Architecture"] == 6.0     # (4 + 8) / 2

    assert len(analytics.score_trend) == 2
    assert analytics.score_trend[0].score == 60.0
    assert analytics.score_trend[1].score == 80.0
    assert analytics.score_trend[1].rolling_avg == 70.0  # rolling avg of both

    assert len(analytics.recent_attempts) == 2
    assert analytics.recent_attempts[0].id == 2  # newest first


def test_generate_prompt_mocked_gemini_with_save_to_bank(monkeypatch):
    monkeypatch.setattr(sds_module.settings, "GEMINI_API_KEY", "fake-key-for-test")

    def fake_call_gemini(client_, api_key, model, prompt, timeout=15.0):
        return {
            "title": "Design a Rate Limiter Variant",
            "prompt_text": "Design a token-bucket rate limiter for an API gateway.",
            "category": "Distributed Systems",
            "difficulty": "medium",
        }, None

    monkeypatch.setattr(llm_client, "call_gemini", fake_call_gemini)

    before = client.get("/api/v1/system-design/prompts?limit=500").json()["total"]
    res = client.post("/api/v1/system-design/prompts/generate", json={
        "topic": "rate limiting",
        "save_to_bank": True,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["is_ai_generated"] is True
    assert body["id"] != 0

    after = client.get("/api/v1/system-design/prompts?limit=500").json()["total"]
    assert after == before + 1
