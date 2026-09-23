# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_topic_demonstrations.py

A roadmap topic is completed by demonstrating it, not by setting it.

Plan section 11: "Completion must not be a fake Mark complete action. It must be
based on evidence/success criteria." These tests hold both halves: every route
that used to set "completed" directly is refused, and the one route that remains
-- a demonstration graded against the success criterion -- moves the topic,
records the evidence, and schedules the recheck.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

GOOD_ANSWER = (
    "A partition is an append-only log, so ordering holds within a partition "
    "but not across partitions; the key decides which partition a record lands in."
)


@pytest.fixture
def topic():
    """A fresh roadmap with one topic that has an objective and a criterion."""
    roadmap = client.post("/api/v1/roadmaps", json={"title": f"Demo roadmap {uuid.uuid4().hex[:6]}"})
    assert roadmap.status_code == 201, roadmap.text
    roadmap_id = roadmap.json()["id"]
    phase = client.post(f"/api/v1/roadmaps/{roadmap_id}/phases", json={"name": "Phase 1"})
    created = client.post(
        f"/api/v1/roadmaps/{roadmap_id}/topics",
        json={
            "phase_id": phase.json()["id"],
            "title": "Topics, Partitions, Offsets",
            "learning_objective": "Understand Kafka's append-only log storage model.",
            "success_criteria": "Explain partition ordering guarantees and how offsets work.",
            "estimated_hours": 3,
        },
    )
    assert created.status_code == 201, created.text
    yield roadmap_id, created.json()["id"]
    client.delete(f"/api/v1/roadmaps/{roadmap_id}")


def _demonstrate(roadmap_id, topic_id, grade, text=GOOD_ANSWER):
    return client.post(
        f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}/demonstrations",
        json={"response_text": text, "self_grade": grade},
    )


def _topic(roadmap_id, topic_id):
    detail = client.get(f"/api/v1/roadmaps/{roadmap_id}").json()
    return next(t for ph in detail["phases"] for t in ph["topics"] if t["id"] == topic_id)


# ---- 1. the routes that no longer complete a topic ---------------------


def test_patching_status_to_completed_is_refused(topic):
    roadmap_id, topic_id = topic

    response = client.patch(
        f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}", json={"status": "completed"}
    )

    assert response.status_code == 400, response.text
    assert "demonstrat" in response.json()["detail"].lower()
    assert _topic(roadmap_id, topic_id)["status"] == "not_started"


def test_patching_progress_to_100_is_refused_because_it_implies_completed(topic):
    """The second, quieter route to the same place."""
    roadmap_id, topic_id = topic

    response = client.patch(
        f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}", json={"progress_percentage": 100}
    )

    assert response.status_code == 400, response.text
    assert _topic(roadmap_id, topic_id)["status"] == "not_started"


def test_skipping_is_still_allowed_because_it_claims_nothing(topic):
    """The honest escape hatch for material you already know.

    Skipped leaves the progress total instead of inflating it, so it does not
    claim a demonstration that never happened.
    """
    roadmap_id, topic_id = topic

    response = client.patch(
        f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}", json={"status": "skipped"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "skipped"


# ---- 2. what a demonstration does ---------------------------------------


def test_a_yes_demonstration_completes_the_topic(topic):
    roadmap_id, topic_id = topic

    response = _demonstrate(roadmap_id, topic_id, "yes")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["topic"]["status"] == "completed"
    assert body["topic"]["progress_percentage"] == 100
    assert body["topic"]["completed_at"] is not None
    assert body["demonstration"]["self_grade"] == "yes"
    assert body["demonstration"]["next_recheck_at"] is not None


@pytest.mark.parametrize("grade", ["partial", "not_yet"])
def test_a_partial_or_failed_demonstration_leaves_the_topic_in_progress(topic, grade):
    roadmap_id, topic_id = topic
    client.patch(f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}", json={"progress_percentage": 20})

    body = _demonstrate(roadmap_id, topic_id, grade).json()

    assert body["topic"]["status"] == "in_progress"
    assert body["topic"]["completed_at"] is None


def test_a_demonstration_does_not_invent_a_progress_percentage(topic):
    """The prototype sets 65% and 30%. Nothing measured those numbers.

    Plan section 37: a number on screen needs a traceable source. So partial and
    not-yet leave the learner's own figure exactly where it was.
    """
    roadmap_id, topic_id = topic
    client.patch(f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}", json={"progress_percentage": 20})

    body = _demonstrate(roadmap_id, topic_id, "partial").json()

    assert body["topic"]["progress_percentage"] == 20


def test_a_failed_recheck_moves_a_completed_topic_back(topic):
    """New evidence that it cannot be done unprompted any more."""
    roadmap_id, topic_id = topic
    assert _demonstrate(roadmap_id, topic_id, "yes").json()["topic"]["status"] == "completed"

    body = _demonstrate(roadmap_id, topic_id, "not_yet").json()

    assert body["topic"]["status"] == "in_progress"
    assert body["topic"]["completed_at"] is None


def test_a_one_word_answer_is_not_a_demonstration(topic):
    roadmap_id, topic_id = topic

    response = _demonstrate(roadmap_id, topic_id, "yes", text="offsets")

    assert response.status_code == 422, response.text
    assert _topic(roadmap_id, topic_id)["status"] == "not_started"


def test_whitespace_padding_does_not_satisfy_the_minimum(topic):
    roadmap_id, topic_id = topic

    response = _demonstrate(roadmap_id, topic_id, "yes", text="ok" + " " * 40)

    assert response.status_code == 422, response.text


# ---- 3. the recheck schedule --------------------------------------------


def test_repeated_passes_space_the_recheck_further_out(topic):
    """The same SM-2 step question reviews use: 1 day, then 6, then longer."""
    roadmap_id, topic_id = topic

    first = _demonstrate(roadmap_id, topic_id, "yes").json()["demonstration"]
    second = _demonstrate(roadmap_id, topic_id, "yes").json()["demonstration"]
    third = _demonstrate(roadmap_id, topic_id, "yes").json()["demonstration"]

    assert first["interval_days"] == 1
    assert second["interval_days"] == 6
    assert third["interval_days"] > second["interval_days"]


def test_a_failed_attempt_resets_the_recheck_to_tomorrow(topic):
    roadmap_id, topic_id = topic
    _demonstrate(roadmap_id, topic_id, "yes")
    _demonstrate(roadmap_id, topic_id, "yes")

    failed = _demonstrate(roadmap_id, topic_id, "not_yet").json()["demonstration"]

    assert failed["repetition"] == 0
    assert failed["interval_days"] == 1


# ---- 4. history is evidence ---------------------------------------------


def test_every_attempt_is_kept_newest_first(topic):
    roadmap_id, topic_id = topic
    _demonstrate(roadmap_id, topic_id, "not_yet")
    _demonstrate(roadmap_id, topic_id, "partial")
    _demonstrate(roadmap_id, topic_id, "yes")

    history = client.get(
        f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}/demonstrations"
    ).json()

    assert [d["self_grade"] for d in history] == ["yes", "partial", "not_yet"]
    assert all(d["response_text"] == GOOD_ANSWER for d in history)


def test_deleting_a_topic_removes_its_demonstrations(topic):
    """CASCADE: a demonstration of a topic that no longer exists is not evidence."""
    from tests.conftest import TestingSessionLocal
    from app.models.roadmap import TopicDemonstration

    roadmap_id, topic_id = topic
    _demonstrate(roadmap_id, topic_id, "yes")

    assert client.delete(f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}").status_code == 204

    db = TestingSessionLocal()
    try:
        remaining = db.query(TopicDemonstration).filter(TopicDemonstration.topic_id == topic_id).count()
    finally:
        db.close()
    assert remaining == 0


def test_demonstrating_a_topic_on_another_roadmap_is_a_404(topic):
    roadmap_id, topic_id = topic
    other = client.post("/api/v1/roadmaps", json={"title": f"Other {uuid.uuid4().hex[:6]}"}).json()["id"]
    try:
        response = _demonstrate(other, topic_id, "yes")
        assert response.status_code == 404, response.text
    finally:
        client.delete(f"/api/v1/roadmaps/{other}")
