# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Tests for Lakehouse Lab item P1-6: AI feedback on acceptance criteria.

The endpoint gives advice only:
- no score, no verdict, no "correct" field
- status is "feedback" or "not_graded"
- on any provider failure / missing provider, returns "not_graded" with a reason
- stores nothing (no learning_attempts row, no table write)
"""
from app.models.learning_attempt import LearningAttempt
from app.models.interview_question import InterviewQuestion
from app.schemas.lab import CriteriaFeedbackResponse
from tests.llm_fakes import (
    clear_env_provider,
    fake_gemini_text_response,
    patch_gateway_transport,
    set_env_provider,
)

ENDPOINT = "/api/v1/lab/lakehouse/criteria/feedback"
SAMPLE_CRITERIA = (
    "Given a batch with a new column, when it is appended, then it is rejected and nothing is written. "
    "If it is not, the load rolls back. The data owner signs off within 1 day."
)


def test_feedback_schema_has_no_score_or_verdict_or_correct():
    """P1-6 exit criteria: The response schema has no score or verdict field."""
    fields = set(CriteriaFeedbackResponse.model_fields.keys())
    assert "score" not in fields
    assert "verdict" not in fields
    assert "correct" not in fields
    assert fields == {"status", "points", "reason"}


def test_feedback_with_configured_provider_returns_feedback_points(client, monkeypatch):
    set_env_provider(monkeypatch)
    points = [
        "Be specific about which error type triggers the rollback.",
        "Define an automated check for the data owner sign-off SLA.",
    ]
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({"points": points}))

    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "feedback"
    assert data["points"] == points
    assert data["reason"] is None


def test_feedback_without_provider_returns_not_graded_and_says_why(client, monkeypatch):
    clear_env_provider(monkeypatch)

    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_graded"
    assert data["points"] == []
    assert data["reason"] and "provider" in data["reason"].lower()


def test_feedback_on_provider_error_returns_not_graded(client, monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, None, error="Connection refused by provider")

    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_graded"
    assert data["points"] == []
    assert data["reason"] and "refused" in data["reason"].lower()


def test_feedback_on_timeout_returns_not_graded(client, monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, None, error="Request timed out after 20.0s.")

    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_graded"
    assert data["points"] == []
    assert data["reason"] and "timed out" in data["reason"].lower()


def test_feedback_on_unparseable_reply_returns_not_graded(client, monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response("non-json output"))

    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_graded"
    assert data["points"] == []
    assert data["reason"] and ("parse" in data["reason"].lower() or "json" in data["reason"].lower())


def test_feedback_on_empty_points_list_returns_not_graded(client, monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({"points": []}))

    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_graded"
    assert data["points"] == []
    assert data["reason"]


def test_feedback_stores_nothing_and_never_touches_database(client, monkeypatch):
    """Hard rule: P1-6 stores nothing. No attempt, no question, no table row."""
    from tests.conftest import TestingSessionLocal

    set_env_provider(monkeypatch)
    patch_gateway_transport(
        monkeypatch,
        fake_gemini_text_response({"points": ["Clarify the rollback condition."]})
    )

    db = TestingSessionLocal()
    try:
        attempt_count_before = db.query(LearningAttempt).count()
        question_count_before = db.query(InterviewQuestion).count()
    finally:
        db.close()

    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    assert res.json()["status"] == "feedback"

    db = TestingSessionLocal()
    try:
        assert db.query(LearningAttempt).count() == attempt_count_before
        assert db.query(InterviewQuestion).count() == question_count_before
    finally:
        db.close()

def test_an_unexpected_exception_never_shows_its_text_to_the_learner(client, monkeypatch):
    # An exception can carry request details; the learner sees a plain reason, the log keeps the rest.
    from app.llm.gateway import LLMGateway

    set_env_provider(monkeypatch)

    def boom(self, *args, **kwargs):
        raise RuntimeError("GET https://provider.example/v1?key=SECRET-KEY-123 failed")

    monkeypatch.setattr(LLMGateway, "run", boom)
    res = client.post(ENDPOINT, json={"criteria": SAMPLE_CRITERIA})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_graded" and data["points"] == []
    assert data["reason"]
    assert "SECRET-KEY-123" not in res.text and "https://" not in res.text
