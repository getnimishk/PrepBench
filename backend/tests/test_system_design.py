# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.services import system_design_service as sds_module
from tests.llm_fakes import (
    clear_env_provider,
    fake_gemini_text_response,
    patch_gateway_transport,
    set_env_provider,
)

client = TestClient(app)


def _clear_api_key(monkeypatch):
    """Force the gateway to resolve no provider, regardless of what's in the
    real .env file (which has a real key for the dev app)."""
    clear_env_provider(monkeypatch)


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
    # Vendor-neutral and actionable: it points at the setup flow, not at one
    # vendor's API key, since a local model is an equally valid answer.
    detail = res.json()["detail"]
    assert "GEMINI" not in detail.upper()
    assert "AI Providers" in detail


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
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "category_scores": [
            {"category": "Requirements Clarification", "score": 8, "max_score": 10, "feedback": "Good."},
            {"category": "High-Level Architecture", "score": 6, "max_score": 10, "feedback": "Ok."},
        ],
        "overall_score": 70,
        "strengths": ["Clear structure"],
        "improvements": ["Discuss scaling more"],
        "summary": "Solid but could go deeper on scale.",
    }))

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
    set_env_provider(monkeypatch)
    # Unparseable even after the extraction ladder and the single repair retry.
    patch_gateway_transport(monkeypatch, fake_gemini_text_response("this is not JSON at all"))

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
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "title": "Design a Rate Limiter Variant",
        "prompt_text": "Design a token-bucket rate limiter for an API gateway.",
        "category": "Distributed Systems",
        "difficulty": "medium",
    }))

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


# ---- drafts ------------------------------------------------------------
#
# The answer page held its text in React state and nowhere else. No autosave,
# no localStorage, no beforeunload guard: forty minutes of design work was one
# stray sidebar click away from being gone, and nothing on the screen suggested
# otherwise. The exam runner has warned before unloading since it was written.


def test_a_prompt_with_no_history_reports_no_draft_rather_than_an_empty_one():
    """The page needs the difference between "resumed nothing" and "never started"."""
    pid = _create_prompt()
    res = client.get(f"/api/v1/system-design/prompts/{pid}/draft")

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["exists"] is False
    assert body["answer_text"] == ""


def test_a_draft_survives_leaving_the_page():
    pid = _create_prompt()

    saved = client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={
        "answer_text": "Start with the write path: an append-only log, partitioned by tenant.",
        "target_role": "Senior Backend Engineer",
    })
    assert saved.status_code == 200, saved.text

    # A completely separate request, as a fresh page load would make.
    body = client.get(f"/api/v1/system-design/prompts/{pid}/draft").json()
    assert body["exists"] is True
    assert body["answer_text"].startswith("Start with the write path")
    assert body["target_role"] == "Senior Backend Engineer"
    assert body["updated_at"] is not None


def test_saving_again_replaces_rather_than_accumulates():
    pid = _create_prompt()
    client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"answer_text": "first"})
    client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"answer_text": "second"})

    assert client.get(f"/api/v1/system-design/prompts/{pid}/draft").json()["answer_text"] == "second"


def test_clearing_the_box_is_a_real_edit():
    """A draft that refused to record an emptied box would restore deleted text."""
    pid = _create_prompt()
    client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"answer_text": "something"})
    client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"answer_text": ""})

    assert client.get(f"/api/v1/system-design/prompts/{pid}/draft").json()["answer_text"] == ""


def test_a_draft_never_appears_as_an_attempt(monkeypatch):
    """Unsubmitted work must not be counted as something that was done.

    list_attempts, the analytics, Home's "other preparation" count and the
    activity timeline all read system_design_attempts. This is why a draft is
    its own table rather than a draft-flavoured attempt row.
    """
    _clear_api_key(monkeypatch)
    pid = _create_prompt()
    before = client.get("/api/v1/system-design/attempts").json()["total"]

    client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"answer_text": "half an idea"})

    assert client.get("/api/v1/system-design/attempts").json()["total"] == before


def test_submitting_ends_the_draft(monkeypatch):
    _clear_api_key(monkeypatch)
    pid = _create_prompt()
    client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"answer_text": "the design"})

    submitted = client.post("/api/v1/system-design/attempts", json={
        "prompt_id": pid, "answer_text": "the design", "time_spent_seconds": 900,
    })
    assert submitted.status_code == 201, submitted.text

    # Not "nothing to resume": the last submitted answer is what a revision
    # starts from. Starting version two in a blank box is a rewrite.
    body = client.get(f"/api/v1/system-design/prompts/{pid}/draft").json()
    assert body["exists"] is True
    assert body["answer_text"] == "the design"


def test_a_new_draft_after_a_submission_wins_over_the_submitted_answer(monkeypatch):
    _clear_api_key(monkeypatch)
    pid = _create_prompt()
    client.post("/api/v1/system-design/attempts", json={
        "prompt_id": pid, "answer_text": "version one", "time_spent_seconds": 60,
    })
    client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"answer_text": "version two"})

    assert client.get(f"/api/v1/system-design/prompts/{pid}/draft").json()["answer_text"] \
        == "version two"


def test_a_draft_for_an_unknown_prompt_404s():
    assert client.get("/api/v1/system-design/prompts/99999999/draft").status_code == 404
    assert client.put(
        "/api/v1/system-design/prompts/99999999/draft", json={"answer_text": "x"}
    ).status_code == 404


# ---- attempt history ---------------------------------------------------
#
# GET /system-design/attempts has existed since System Design shipped and no
# page ever called it, so a learner who answered the same prompt three times
# had no way to see whether the third was better than the first. "Am I
# improving at this?" was a question the product stored the answer to and
# never asked.


def test_one_attempt_is_history_with_nothing_to_compare(monkeypatch):
    _clear_api_key(monkeypatch)
    pid = _create_prompt()
    client.post("/api/v1/system-design/attempts", json={
        "prompt_id": pid, "answer_text": "only attempt", "time_spent_seconds": 60,
    })

    body = client.get(f"/api/v1/system-design/prompts/{pid}/attempts").json()
    assert len(body["items"]) == 1
    assert body["items"][0]["change_vs_previous"] is None


def test_two_ungraded_attempts_produce_no_trend(monkeypatch):
    """An ungraded attempt has no score, and a trend through a missing number
    is a fabricated one."""
    _clear_api_key(monkeypatch)
    pid = _create_prompt()
    for text in ("first", "second"):
        client.post("/api/v1/system-design/attempts", json={
            "prompt_id": pid, "answer_text": text, "time_spent_seconds": 60,
        })

    body = client.get(f"/api/v1/system-design/prompts/{pid}/attempts").json()
    assert body["graded_count"] == 0
    assert all(i["change_vs_previous"] is None for i in body["items"])
    assert all(i["overall_score"] is None for i in body["items"])


def test_the_change_is_measured_between_graded_attempts_only():
    """A graded attempt either side of an ungraded one still compares to the
    last *graded* one -- skipping the gap rather than inventing a value for it."""
    from tests.conftest import TestingSessionLocal
    from app.models.system_design_attempt import SystemDesignAttempt

    pid = _create_prompt()
    db = TestingSessionLocal()
    made = []
    try:
        for status, score in [("graded", 40.0), ("error", None), ("graded", 62.0)]:
            a = SystemDesignAttempt(
                prompt_id=pid, answer_text="x", grading_status=status, overall_score=score,
            )
            db.add(a)
            db.commit()
            db.refresh(a)
            made.append(a)

        body = client.get(f"/api/v1/system-design/prompts/{pid}/attempts").json()
        # Newest first.
        newest, middle, oldest = body["items"]
        assert oldest["overall_score"] == 40.0 and oldest["change_vs_previous"] is None
        assert middle["overall_score"] is None and middle["change_vs_previous"] is None
        assert newest["overall_score"] == 62.0
        assert newest["change_vs_previous"] == 22.0
        assert body["graded_count"] == 2
    finally:
        for a in made:
            db.delete(a)
        db.commit()
        db.close()


def test_history_for_an_unknown_prompt_404s():
    assert client.get("/api/v1/system-design/prompts/99999999/attempts").status_code == 404
