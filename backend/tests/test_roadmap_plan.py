# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The plan editor: a roadmap's title, budget, start date and phases, saved at once.

What matters most here is what the editor must never do. Reshaping a plan does
not change a topic's status and does not delete a topic, so removing a phase
moves its topics -- demonstrations and all -- to a phase the learner chose.
"""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic, TopicDemonstration
from tests.conftest import TestingSessionLocal

client = TestClient(app)


@pytest.fixture
def roadmap_ids():
    created = []
    yield created
    db = TestingSessionLocal()
    try:
        if created:
            db.query(Roadmap).filter(Roadmap.id.in_(created)).delete(synchronize_session=False)
            db.commit()
    finally:
        db.close()


def _roadmap(roadmap_ids, phases: dict[str, list[tuple[str, float | None]]], **fields) -> dict:
    """A roadmap with the given phases, each holding (title, estimated_hours) topics."""
    roadmap = client.post("/api/v1/roadmaps", json={"title": "Kafka plan", **fields}).json()
    roadmap_ids.append(roadmap["id"])
    for name, topics in phases.items():
        phase = client.post(f"/api/v1/roadmaps/{roadmap['id']}/phases", json={"name": name}).json()
        for title, hours in topics:
            response = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
                "phase_id": phase["id"], "title": title, "estimated_hours": hours,
                "success_criteria": "Explain it without notes.",
            })
            assert response.status_code == 201, response.text
    return client.get(f"/api/v1/roadmaps/{roadmap['id']}").json()


def _save(roadmap_id: int, **plan):
    return client.put(f"/api/v1/roadmaps/{roadmap_id}/plan", json=plan)


def _phase_ids(detail: dict) -> dict[str, int]:
    return {phase["name"]: phase["id"] for phase in detail["phases"]}


def test_title_budget_start_date_and_phase_names_and_order_save_together(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Topics", 2)], "Streams": [("KStreams", 3)]})
    ids = _phase_ids(detail)

    response = _save(
        detail["id"],
        title="  Kafka, properly  ",
        weekly_hours_budget=6,
        start_date="2026-09-10",
        phases=[
            {"id": ids["Streams"], "name": "Stream processing"},
            {"id": None, "name": "Operations"},
            {"id": ids["Basics"], "name": "Basics"},
        ],
    )

    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["title"] == "Kafka, properly"
    assert saved["weekly_hours_budget"] == 6
    assert saved["start_date"] == "2026-09-10"
    assert [(p["name"], p["order_index"]) for p in saved["phases"]] == [
        ("Stream processing", 0), ("Operations", 1), ("Basics", 2),
    ]
    assert [t["title"] for t in saved["phases"][0]["topics"]] == ["KStreams"]
    assert saved["phases"][1]["topics"] == []
    # The schedule reads the new order: KStreams is scheduled before Topics.
    schedule = client.get(f"/api/v1/roadmaps/{detail['id']}/schedule").json()
    assert [item["title"] for item in schedule["items"]] == ["KStreams", "Topics"]


def test_clearing_the_budget_and_start_date_is_a_real_choice(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Topics", 2)]}, weekly_hours_budget=5, start_date="2026-01-01")

    saved = _save(
        detail["id"], title="Kafka plan", weekly_hours_budget=None, start_date=None,
        phases=[{"id": detail["phases"][0]["id"], "name": "Basics"}],
    ).json()

    assert saved["weekly_hours_budget"] is None and saved["start_date"] is None


def test_removing_a_phase_moves_its_topics_and_keeps_their_evidence(roadmap_ids):
    detail = _roadmap(roadmap_ids, {
        "Basics": [("Topics", 2)],
        "Extras": [("Connect", 1), ("Schema registry", 1)],
    })
    ids = _phase_ids(detail)
    connect = next(t for p in detail["phases"] for t in p["topics"] if t["title"] == "Connect")
    demonstrated = client.post(
        f"/api/v1/roadmaps/{detail['id']}/topics/{connect['id']}/demonstrations",
        json={"response_text": "Connectors move data in and out without custom code.", "self_grade": "yes"},
    )
    assert demonstrated.status_code in (200, 201), demonstrated.text

    response = _save(
        detail["id"], title="Kafka plan",
        phases=[{"id": ids["Basics"], "name": "Basics"}],
        removed_phases=[{"id": ids["Extras"], "move_topics_to": 0}],
    )

    assert response.status_code == 200, response.text
    saved = response.json()
    assert [p["name"] for p in saved["phases"]] == ["Basics"]
    moved = saved["phases"][0]["topics"]
    # After what the phase already held, in their own order.
    assert [t["title"] for t in moved] == ["Topics", "Connect", "Schema registry"]
    assert [t["order_index"] for t in moved] == sorted(t["order_index"] for t in moved)
    # Status and evidence are untouched.
    assert next(t for t in moved if t["title"] == "Connect")["status"] == "completed"
    db = TestingSessionLocal()
    try:
        assert db.query(TopicDemonstration).filter(TopicDemonstration.topic_id == connect["id"]).count() == 1
        assert db.get(RoadmapPhase, ids["Extras"]) is None
        assert db.get(RoadmapTopic, connect["id"]).phase_id == ids["Basics"]
    finally:
        db.close()


def test_topics_can_move_into_a_phase_added_in_the_same_save(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Old": [("Topics", 2), ("Partitions", 1)]})

    saved = _save(
        detail["id"], title="Kafka plan",
        phases=[{"id": None, "name": "New home"}],
        removed_phases=[{"id": detail["phases"][0]["id"], "move_topics_to": 0}],
    ).json()

    assert [p["name"] for p in saved["phases"]] == ["New home"]
    assert [t["title"] for t in saved["phases"][0]["topics"]] == ["Topics", "Partitions"]


def test_an_empty_phase_is_removed_without_anywhere_to_move_to(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Topics", 2)], "Empty": []})
    ids = _phase_ids(detail)

    saved = _save(
        detail["id"], title="Kafka plan",
        phases=[{"id": ids["Basics"], "name": "Basics"}],
        removed_phases=[{"id": ids["Empty"]}],
    ).json()

    assert [p["name"] for p in saved["phases"]] == ["Basics"]


def test_removing_a_phase_with_topics_and_nowhere_to_put_them_saves_nothing(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Topics", 2)], "Extras": [("Connect", 1)]})
    ids = _phase_ids(detail)

    for removal in ({"id": ids["Extras"]}, {"id": ids["Extras"], "move_topics_to": 5}):
        response = _save(
            detail["id"], title="Renamed", phases=[{"id": ids["Basics"], "name": "Basics"}],
            removed_phases=[removal],
        )
        assert response.status_code == 400
        assert response.json()["detail"] == '"Extras" holds 1 topic. Choose a phase to move them to before removing it.'

    unchanged = client.get(f"/api/v1/roadmaps/{detail['id']}").json()
    assert unchanged["title"] == "Kafka plan"
    assert [p["name"] for p in unchanged["phases"]] == ["Basics", "Extras"]


def test_a_phase_the_editor_did_not_know_about_refuses_the_save(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Topics", 2)]})
    # Added after the editor read the plan -- another tab, or a re-import.
    client.post(f"/api/v1/roadmaps/{detail['id']}/phases", json={"name": "Added elsewhere"})

    response = _save(detail["id"], title="Renamed", phases=[{"id": detail["phases"][0]["id"], "name": "Basics"}])

    assert response.status_code == 409
    assert "Nothing was saved" in response.json()["detail"]
    after = client.get(f"/api/v1/roadmaps/{detail['id']}").json()
    assert after["title"] == "Kafka plan"
    assert [p["name"] for p in after["phases"]] == ["Basics", "Added elsewhere"]


def test_a_phase_listed_twice_or_kept_and_removed_is_refused(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [], "Extras": []})
    ids = _phase_ids(detail)

    twice = _save(detail["id"], title="T", phases=[
        {"id": ids["Basics"], "name": "A"}, {"id": ids["Basics"], "name": "B"}, {"id": ids["Extras"], "name": "C"},
    ])
    both = _save(detail["id"], title="T", phases=[
        {"id": ids["Basics"], "name": "A"}, {"id": ids["Extras"], "name": "C"},
    ], removed_phases=[{"id": ids["Extras"]}])

    assert twice.status_code == 400 and both.status_code == 400


def test_a_phase_from_another_roadmap_cannot_be_claimed(roadmap_ids):
    mine = _roadmap(roadmap_ids, {"Mine": []})
    theirs = _roadmap(roadmap_ids, {"Theirs": [("Theirs topic", 1)]})

    response = _save(mine["id"], title="T", phases=[
        {"id": mine["phases"][0]["id"], "name": "Mine"},
        {"id": theirs["phases"][0]["id"], "name": "Stolen"},
    ])

    assert response.status_code == 409
    assert client.get(f"/api/v1/roadmaps/{theirs['id']}").json()["phases"][0]["name"] == "Theirs"


@pytest.mark.parametrize("plan", [
    {"title": "   ", "phases": []},
    {"title": "T", "phases": [{"id": None, "name": "   "}]},
    {"title": "T", "phases": [], "weekly_hours_budget": 0},
    {"title": "T", "phases": [], "weekly_hours_budget": 169},
])
def test_a_plan_that_makes_no_sense_is_rejected(roadmap_ids, plan):
    detail = _roadmap(roadmap_ids, {})
    assert _save(detail["id"], **plan).status_code == 422


def test_an_unknown_roadmap_is_not_found():
    assert _save(999999, title="T", phases=[]).status_code == 404


# ---- the draft projection --------------------------------------------------


def test_a_draft_budget_is_projected_without_being_saved(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Topics", 7), ("Partitions", 7)]})
    start = (date.today() + timedelta(days=3)).isoformat()

    draft = client.get(
        f"/api/v1/roadmaps/{detail['id']}/schedule",
        params={"draft": "true", "start_date": start, "weekly_hours_budget": 7},
    ).json()

    assert draft["schedule_available"] is True
    assert draft["weekly_hours_budget"] == 7 and draft["start_date"] == start
    assert draft["remaining_estimated_hours"] == 14
    # Nothing was written.
    saved = client.get(f"/api/v1/roadmaps/{detail['id']}").json()
    assert saved["weekly_hours_budget"] is None and saved["start_date"] is None
    assert client.get(f"/api/v1/roadmaps/{detail['id']}/schedule").json()["reason"] == "no_start_date"

    # And once saved, the schedule is the one the draft showed.
    _save(detail["id"], title="Kafka plan", start_date=start, weekly_hours_budget=7,
          phases=[{"id": detail["phases"][0]["id"], "name": "Basics"}])
    assert client.get(f"/api/v1/roadmaps/{detail['id']}/schedule").json()["projected_end_date"] == draft["projected_end_date"]


def test_a_draft_with_no_budget_says_so_even_when_one_is_saved(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Topics", 3)]}, weekly_hours_budget=5, start_date="2026-01-01")

    draft = client.get(
        f"/api/v1/roadmaps/{detail['id']}/schedule", params={"draft": "true", "start_date": "2026-01-01"},
    ).json()

    assert draft["schedule_available"] is False
    assert draft["reason"] == "no_weekly_budget"
    assert draft["remaining_estimated_hours"] == 3


def test_remaining_hours_leave_out_finished_and_skipped_work_and_count_progress(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Done", 4), ("Skipped", 4), ("Half", 10), ("Unestimated", None)]})
    topics = {t["title"]: t for t in detail["phases"][0]["topics"]}
    rid = detail["id"]
    client.post(f"/api/v1/roadmaps/{rid}/topics/{topics['Done']['id']}/demonstrations",
                json={"response_text": "A full explanation of the finished topic.", "self_grade": "yes"})
    client.patch(f"/api/v1/roadmaps/{rid}/topics/{topics['Skipped']['id']}", json={"status": "skipped"})
    client.patch(f"/api/v1/roadmaps/{rid}/topics/{topics['Half']['id']}",
                 json={"status": "in_progress", "progress_percentage": 50})

    schedule = client.get(f"/api/v1/roadmaps/{rid}/schedule").json()

    assert schedule["remaining_estimated_hours"] == 5


def test_remaining_hours_are_unknown_when_nothing_is_estimated(roadmap_ids):
    detail = _roadmap(roadmap_ids, {"Basics": [("Unestimated", None)]})
    assert client.get(f"/api/v1/roadmaps/{detail['id']}/schedule").json()["remaining_estimated_hours"] is None
