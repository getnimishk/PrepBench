# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
A system-design answer in sections: requirements, architecture, data model,
failure handling, trade-offs.

What these hold: each section is saved as typed and comes back on reload; the
grader reads the sections under their headings; an empty answer is not submitted;
an answer saved without a grade can be graded later, and a graded one keeps its
grade; and a retry starts from the last attempt's sections.
"""
import json

from fastapi.testclient import TestClient

from app.main import app
from app.services.system_design_sections import SECTION_KEYS, compose_answer
from tests.llm_fakes import (
    clear_env_provider,
    fake_gemini_text_response,
    patch_gateway_transport,
    set_env_provider,
)
from tests.test_system_design import _create_prompt

client = TestClient(app)

SECTIONS = {
    "requirements": "10M notifications/hour at peak; at-least-once.",
    "architecture": "API -> queue -> channel workers -> providers.",
    "data_model": "",
    "failure_handling": "Dead-letter queue; retries with backoff.",
    "trade_offs": "At-least-once over exactly-once: dedupe at the consumer.",
}

GRADE = {
    "category_scores": [
        {"category": "Requirements Clarification", "score": 8, "max_score": 10, "feedback": "Scale stated."},
        {"category": "Data Modeling & Storage", "score": 3, "max_score": 10, "feedback": "No data model."},
    ],
    "overall_score": 62,
    "strengths": ["Clear failure story"],
    "improvements": ["Say what is stored and how it is keyed."],
    "summary": "Good shape, no data model.",
}


def test_each_section_is_saved_and_comes_back():
    pid = _create_prompt()

    saved = client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"sections": SECTIONS})
    assert saved.status_code == 200, saved.text
    restored = client.get(f"/api/v1/system-design/prompts/{pid}/draft").json()

    assert restored["sections"] == SECTIONS
    # The whole answer is built from the sections under their headings, empty ones left out.
    assert restored["answer_text"].startswith("## Requirements & scale assumptions\n10M")
    assert "Data model" not in restored["answer_text"]


def test_an_unknown_section_is_refused():
    pid = _create_prompt()
    response = client.put(f"/api/v1/system-design/prompts/{pid}/draft", json={"sections": {"vibes": "x"}})
    assert response.status_code == 422


def test_the_grader_reads_the_sections_under_their_headings(monkeypatch):
    set_env_provider(monkeypatch)
    capture = {}
    patch_gateway_transport(monkeypatch, fake_gemini_text_response(GRADE), capture=capture)
    pid = _create_prompt()

    response = client.post("/api/v1/system-design/attempts", json={"prompt_id": pid, "sections": SECTIONS})

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["sections"] == SECTIONS
    assert body["grading_status"] == "graded"
    sent = json.dumps(capture["body"])
    assert "## Failure handling" in sent and "Dead-letter queue" in sent


def test_an_empty_answer_is_not_submitted(monkeypatch):
    clear_env_provider(monkeypatch)
    pid = _create_prompt()

    response = client.post(
        "/api/v1/system-design/attempts",
        json={"prompt_id": pid, "sections": {key: "   " for key in SECTION_KEYS}},
    )

    assert response.status_code == 400
    assert "nothing to grade" in response.json()["detail"]


def test_an_ungraded_answer_can_be_graded_later_and_a_graded_one_keeps_its_grade(monkeypatch):
    clear_env_provider(monkeypatch)
    pid = _create_prompt()
    attempt = client.post("/api/v1/system-design/attempts", json={"prompt_id": pid, "sections": SECTIONS}).json()
    assert attempt["grading_status"] == "unavailable"
    assert attempt["overall_score"] is None

    # Still no provider: grading again says so, and invents nothing.
    again = client.post(f"/api/v1/system-design/attempts/{attempt['id']}/grade").json()
    assert again["grading_status"] == "unavailable" and again["overall_score"] is None

    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response(GRADE))
    graded = client.post(f"/api/v1/system-design/attempts/{attempt['id']}/grade")
    assert graded.status_code == 200, graded.text
    assert graded.json()["grading_status"] == "graded"
    assert graded.json()["overall_score"] == 62
    assert graded.json()["sections"] == SECTIONS, "grading must not change what was written"

    assert client.post(f"/api/v1/system-design/attempts/{attempt['id']}/grade").status_code == 409
    assert client.post("/api/v1/system-design/attempts/999999/grade").status_code == 404


def test_a_retry_starts_from_the_last_attempts_sections(monkeypatch):
    clear_env_provider(monkeypatch)
    pid = _create_prompt()
    client.post("/api/v1/system-design/attempts", json={"prompt_id": pid, "sections": SECTIONS})

    draft = client.get(f"/api/v1/system-design/prompts/{pid}/draft").json()

    assert draft["exists"] is True
    assert draft["sections"] == SECTIONS


def test_an_answer_written_before_sections_still_reads_as_one_answer(monkeypatch):
    clear_env_provider(monkeypatch)
    pid = _create_prompt()

    body = client.post(
        "/api/v1/system-design/attempts", json={"prompt_id": pid, "answer_text": "One long answer."}
    ).json()

    assert body["sections"] is None
    assert body["answer_text"] == "One long answer."


def test_composing_leaves_out_empty_sections():
    assert compose_answer({key: "" for key in SECTION_KEYS}) == ""
    assert compose_answer({**{key: "" for key in SECTION_KEYS}, "trade_offs": "Cost vs latency"}) == (
        "## Trade-offs\nCost vs latency"
    )
