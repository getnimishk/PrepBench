# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Lakehouse Lab P1-1: interview questions saved from lab results.

- SubjectWithReadiness exposes `lab_interview_question_count: int`.
- It counts rows in `interview_questions` where `subject_id == subject.id` and
  `source_ref` starts with `lab/`.
- Strict subject isolation: saving for one preparation never alters another's count.
- Saving with the same source_ref updates the existing row (count remains 1).
- Deleting the question decrements the count back to 0.
- Another preparation cannot read the saved question (404 in-scope guard).
"""

import uuid
import pytest


def _create_skill(client, name=None, slug=None):
    name = name or f"Test Skill {uuid.uuid4().hex[:6]}"
    payload = {"name": name, "kind": "skill"}
    if slug:
        payload["slug"] = slug
    res = client.post("/api/v1/subjects", json=payload)
    assert res.status_code in (200, 201), res.text
    body = res.json()
    return body.get("subject", body)


def _save_lab_question(client, subject_id, source_ref=None, **overrides):
    ref = source_ref or f"lab/semiconductor-v1@1/station/c/{uuid.uuid4().hex[:6]}"
    payload = {
        "source_ref": ref,
        "subject_id": subject_id,
        "round_type": "technical",
        "question_text": "How does Delta Lake handle duplicate keys during a merge operation?",
        "prepared_answer": "It enforces primary key semantics or isolates conflicts based on merge conditions.",
        "key_talking_points": [
            "Observed result: duplicate-keys",
            "Operation status: Refused",
            "Delta table version: 2",
        ],
        "category": "Databricks Lakehouse",
    }
    payload.update(overrides)
    return client.put("/api/v1/interview-questions/by-source", json=payload)


def test_lab_interview_question_count_initial_is_zero(client):
    skill = _create_skill(client, name=f"Databricks {uuid.uuid4().hex[:6]}")
    res = client.get(f"/api/v1/subjects/{skill['id']}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "lab_interview_question_count" in data
    assert data["lab_interview_question_count"] == 0


def test_saving_lab_question_increments_count_and_preserves_isolation(client):
    subj_a = _create_skill(client, name=f"Databricks {uuid.uuid4().hex[:6]}")
    subj_b = _create_skill(client, name=f"Other Prep {uuid.uuid4().hex[:6]}")

    ref = f"lab/semiconductor-v1@1/station/c/test-iso-{uuid.uuid4().hex[:6]}"
    save_res = _save_lab_question(client, subj_a["id"], source_ref=ref)
    assert save_res.status_code == 200, save_res.text
    save_body = save_res.json()
    assert save_body["created"] is True
    question_id = save_body["question"]["id"]

    # Subject A count is now 1
    res_a = client.get(f"/api/v1/subjects/{subj_a['id']}")
    assert res_a.status_code == 200
    assert res_a.json()["lab_interview_question_count"] == 1

    # Subject B count is still 0 (strict subject isolation)
    res_b = client.get(f"/api/v1/subjects/{subj_b['id']}")
    assert res_b.status_code == 200
    assert res_b.json()["lab_interview_question_count"] == 0

    # Also visible in list_subjects
    list_res = client.get("/api/v1/subjects")
    assert list_res.status_code == 200
    items = {s["id"]: s for s in list_res.json()}
    assert items[subj_a["id"]]["lab_interview_question_count"] == 1
    assert items[subj_b["id"]]["lab_interview_question_count"] == 0

    # Question is isolated: subject B cannot access it
    isolated_get = client.get(
        f"/api/v1/interview-questions/{question_id}",
        params={"subject_id": subj_b["id"]},
    )
    assert isolated_get.status_code == 404


def test_non_lab_questions_do_not_increment_count(client):
    skill = _create_skill(client)

    # Save a scenario question (prefix adf@ or scenario/)
    scenario_ref = f"adf@1/scenario/1/lens/po/{uuid.uuid4().hex[:6]}"
    res_scen = client.put(
        "/api/v1/interview-questions/by-source",
        json={
            "source_ref": scenario_ref,
            "subject_id": skill["id"],
            "round_type": "technical",
            "question_text": "Scenario question?",
            "category": "Azure Data Factory",
        },
    )
    assert res_scen.status_code == 200

    # Save an imported/manual question (source_ref is None)
    res_import = client.post(
        "/api/v1/interview-questions/import",
        data={
            "default_round_type": "technical",
            "text": "What is ACID compliance in database systems?",
        },
    )
    assert res_import.status_code == 200

    res = client.get(f"/api/v1/subjects/{skill['id']}")
    assert res.status_code == 200
    # lab_interview_question_count only counts source_ref like 'lab/%'
    assert res.json()["lab_interview_question_count"] == 0


def test_re_saving_updates_in_place_without_incrementing_count(client):
    skill = _create_skill(client)
    ref = f"lab/semiconductor-v1@1/station/c/upsert-{uuid.uuid4().hex[:6]}"

    first = _save_lab_question(client, skill["id"], source_ref=ref)
    assert first.status_code == 200
    assert first.json()["created"] is True

    # Re-save with updated talking points
    second = _save_lab_question(
        client,
        skill["id"],
        source_ref=ref,
        key_talking_points=["Updated point 1", "Updated point 2"],
    )
    assert second.status_code == 200
    assert second.json()["created"] is False
    assert second.json()["question"]["key_talking_points"] == ["Updated point 1", "Updated point 2"]

    res = client.get(f"/api/v1/subjects/{skill['id']}")
    assert res.json()["lab_interview_question_count"] == 1


def test_deleting_lab_question_decrements_count(client):
    skill = _create_skill(client)
    ref = f"lab/semiconductor-v1@1/station/c/del-{uuid.uuid4().hex[:6]}"

    save_res = _save_lab_question(client, skill["id"], source_ref=ref)
    qid = save_res.json()["question"]["id"]

    res_before = client.get(f"/api/v1/subjects/{skill['id']}")
    assert res_before.json()["lab_interview_question_count"] == 1

    del_res = client.delete(
        f"/api/v1/interview-questions/{qid}",
        params={"subject_id": skill["id"]},
    )
    assert del_res.status_code == 200

    res_after = client.get(f"/api/v1/subjects/{skill['id']}")
    assert res_after.json()["lab_interview_question_count"] == 0
