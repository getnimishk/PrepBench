# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_learning_attempts.py

The server-side half of the learning layer's integrity rules.

frontend/src/services/learning/integrity.test.ts already holds these lines in
the browser, and did so while localStorage was the system of record. Now that
the rows are on the server, the same rules have to hold here -- a rule enforced
only on the client is not enforced, because anything that can POST can route
around it, and every accuracy figure in the product is derived from these rows.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

BASE = "/api/v1/learning/attempts"


def _uid() -> str:
    return "att_" + uuid.uuid4().hex


def _start(**overrides) -> dict:
    payload = {
        "attempt_uid": _uid(),
        "challenge_id": "wip-limit-1",
        "concept_id": "little-law",
        "scenario_fingerprint": "wip=6;tp=2",
        "mode": "guided",
    }
    payload.update(overrides)
    response = client.post(BASE, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# ---- 1. an attempt starts with nothing established ----------------------


def test_a_new_attempt_has_no_prediction_and_no_verdict():
    """Null, not false.

    `correct: false` on an attempt nobody has answered would be a wrong answer
    that was never given, and it would count as one everywhere mastery is
    derived.
    """
    attempt = _start()

    assert attempt["prediction"] is None
    assert attempt["committed_at"] is None
    assert attempt["completed_at"] is None
    assert attempt["correct"] is None
    assert attempt["transfer"] is None


def test_an_attempt_cannot_be_created_carrying_its_own_result():
    """The create schema has no result fields, so a result cannot arrive early.

    Extra keys are ignored rather than rejected, which is the point worth
    testing: what must not happen is a client opening an attempt that is already
    correct.
    """
    uid = _uid()
    response = client.post(BASE, json={
        "attempt_uid": uid,
        "challenge_id": "wip-limit-1",
        "concept_id": "little-law",
        "prediction": "option-a",
        "correct": True,
        "completed": True,
    })
    assert response.status_code == 201, response.text

    body = response.json()
    assert body["prediction"] is None
    assert body["correct"] is None
    assert body["completed_at"] is None


# ---- 2. idempotency -----------------------------------------------------


def test_posting_the_same_attempt_uid_twice_does_not_create_a_second_attempt():
    """A retry is the same request arriving twice, not a conflict.

    A duplicate row would inflate every count derived from this table, so an
    attempt count that climbs on bad wifi is not evidence of anything.
    """
    uid = _uid()
    first = _start(attempt_uid=uid)
    second = _start(attempt_uid=uid)

    assert first["id"] == second["id"]

    listed = client.get(BASE, params={"concept_id": "little-law"})
    assert listed.status_code == 200
    assert [a["attempt_uid"] for a in listed.json()].count(uid) == 1


def test_a_retried_create_does_not_overwrite_progress_already_recorded():
    """The retry must be inert, not a reset.

    Returning the existing row is only safe if it also leaves it alone -- a
    create that quietly cleared a committed prediction would be a far worse bug
    than a duplicate.
    """
    uid = _uid()
    _start(attempt_uid=uid)
    committed = client.patch(f"{BASE}/{uid}", json={"prediction": "option-b"})
    assert committed.status_code == 200, committed.text

    again = _start(attempt_uid=uid)

    assert again["prediction"] == "option-b"
    assert again["committed_at"] is not None


# ---- 3. the rule the table exists for ----------------------------------


def test_a_prediction_can_be_committed_once():
    uid = _uid()
    _start(attempt_uid=uid)

    response = client.patch(f"{BASE}/{uid}", json={"prediction": "option-a"})

    assert response.status_code == 200, response.text
    assert response.json()["prediction"] == "option-a"
    assert response.json()["committed_at"] is not None


def test_a_committed_prediction_cannot_be_amended():
    """The single most important assertion in this file.

    An amended prediction after the outcome is visible is hindsight wearing a
    prediction's clothes. Refused rather than ignored: a client that got a 200
    would go on displaying the new value, and the disagreement would surface
    later as a number nobody can reconcile.
    """
    uid = _uid()
    _start(attempt_uid=uid)
    client.patch(f"{BASE}/{uid}", json={"prediction": "option-a"})

    response = client.patch(f"{BASE}/{uid}", json={"prediction": "option-b"})

    assert response.status_code == 400, response.text
    assert "cannot be changed" in response.json()["detail"]

    # And the original survived the attempt to change it.
    assert client.get(f"{BASE}/{uid}").json()["prediction"] == "option-a"


def test_a_prediction_cannot_be_amended_after_the_attempt_is_completed():
    """The same rule at the moment it matters most -- the result is now visible."""
    uid = _uid()
    _start(attempt_uid=uid)
    client.patch(f"{BASE}/{uid}", json={"prediction": "option-a"})
    client.patch(f"{BASE}/{uid}", json={"completed": True, "correct": False})

    response = client.patch(f"{BASE}/{uid}", json={"prediction": "option-b"})

    assert response.status_code == 400, response.text
    assert client.get(f"{BASE}/{uid}").json()["correct"] is False


# ---- 4. completion ------------------------------------------------------


def test_an_uncommitted_attempt_cannot_be_completed():
    """With no recorded prediction there is nothing to be right or wrong about.

    Scoring it would invent evidence, which is the one thing this table must
    never contain.
    """
    uid = _uid()
    _start(attempt_uid=uid)

    response = client.patch(f"{BASE}/{uid}", json={"completed": True, "correct": True})

    assert response.status_code == 400, response.text
    assert "no committed prediction" in response.json()["detail"]
    assert client.get(f"{BASE}/{uid}").json()["completed_at"] is None


def test_completing_twice_is_a_no_op_rather_than_an_error():
    """Unlike a prediction, a repeated completion carries no new claim.

    So a retried request should succeed and change nothing, rather than failing
    and making the client look broken.
    """
    uid = _uid()
    _start(attempt_uid=uid)
    client.patch(f"{BASE}/{uid}", json={"prediction": "option-a"})
    first = client.patch(f"{BASE}/{uid}", json={"completed": True, "correct": True})
    assert first.status_code == 200, first.text

    second = client.patch(f"{BASE}/{uid}", json={"completed": True, "correct": False})

    assert second.status_code == 200, second.text
    assert second.json()["completed_at"] == first.json()["completed_at"]
    assert second.json()["correct"] is True, (
        "a second completion rewrote the verdict of the first"
    )


# ---- 5. hints and reasoning are recorded, never blocked ----------------


def test_a_hint_taken_after_committing_is_still_recorded():
    """Support is not a punishment, and a hint after the prediction is free.

    The prediction is already on the record by then, so there is nothing left to
    protect -- and a product that stopped counting hints at that point would
    lose the signal that someone needed help understanding the result.
    """
    uid = _uid()
    _start(attempt_uid=uid)
    client.patch(f"{BASE}/{uid}", json={"prediction": "option-a"})

    response = client.patch(f"{BASE}/{uid}", json={"hint_count": 3})

    assert response.status_code == 200, response.text
    assert response.json()["hint_count"] == 3


def test_rubric_coverage_and_mechanisms_round_trip():
    uid = _uid()
    _start(attempt_uid=uid)

    response = client.patch(f"{BASE}/{uid}", json={
        "explanation_mechanisms": ["queueing", "batch-size"],
        "selected_alternative_ids": ["alt-2"],
        "rubric_coverage": {"named-the-axis": True, "quantified": False},
    })

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["explanation_mechanisms"] == ["queueing", "batch-size"]
    assert body["selected_alternative_ids"] == ["alt-2"]
    assert body["rubric_coverage"] == {"named-the-axis": True, "quantified": False}


# ---- 6. not found ------------------------------------------------------


def test_patching_an_unknown_attempt_is_a_404():
    response = client.patch(f"{BASE}/{_uid()}", json={"prediction": "option-a"})
    assert response.status_code == 404, response.text


def test_getting_an_unknown_attempt_is_a_404():
    assert client.get(f"{BASE}/{_uid()}").status_code == 404


# ---- 5. the experiment and the explanation ------------------------------------

MANIPULATION = {"wip": {"from": 4, "to": 8}}
OBSERVED = {"cycle_time": {"label": "Cycle time", "before": 5.2, "after": 9.1}}


def test_what_happened_cannot_be_recorded_before_the_prediction():
    """The order predict -> see is the server's to keep, not the client's."""
    uid = _uid()
    _start(attempt_uid=uid)

    for body in ({"observed": OBSERVED}, {"manipulation": MANIPULATION}, {"explanation_text": "Because WIP."}):
        refused = client.patch(f"{BASE}/{uid}", json=body)
        assert refused.status_code == 400, body


def test_the_experiment_is_kept_with_the_prediction_in_one_commit():
    uid = _uid()
    _start(attempt_uid=uid)

    committed = client.patch(f"{BASE}/{uid}", json={
        "prediction": "option-b", "manipulation": MANIPULATION, "observed": OBSERVED,
        "completed": True, "correct": True, "transfer": False,
    })

    assert committed.status_code == 200, committed.text
    stored = client.get(f"{BASE}/{uid}").json()
    assert stored["manipulation"] == MANIPULATION
    assert stored["observed"] == OBSERVED
    assert stored["correct"] is True


def test_what_was_observed_cannot_be_rewritten_but_a_retry_is_fine():
    uid = _uid()
    _start(attempt_uid=uid)
    client.patch(f"{BASE}/{uid}", json={"prediction": "option-a", "observed": OBSERVED})

    assert client.patch(f"{BASE}/{uid}", json={"observed": OBSERVED}).status_code == 200
    changed = {"cycle_time": {"label": "Cycle time", "before": 5.2, "after": 3.0}}
    assert client.patch(f"{BASE}/{uid}", json={"observed": changed}).status_code == 400
    assert client.get(f"{BASE}/{uid}").json()["observed"] == OBSERVED


def test_the_learners_explanation_is_kept_and_can_be_reworded():
    uid = _uid()
    _start(attempt_uid=uid)
    client.patch(f"{BASE}/{uid}", json={"prediction": "option-a", "completed": True, "correct": False})

    first = client.patch(f"{BASE}/{uid}", json={"explanation_text": "  More started work queues longer.  "})
    assert first.status_code == 200
    assert first.json()["explanation_text"] == "More started work queues longer."

    client.patch(f"{BASE}/{uid}", json={"explanation_text": "WIP up, so each item waits longer."})
    assert client.get(f"{BASE}/{uid}").json()["explanation_text"] == "WIP up, so each item waits longer."


def test_browser_history_keeps_its_own_times_within_the_attempt():
    """Attempts recorded in the browser before the server kept them come across with their times."""
    uid = _uid()
    _start(attempt_uid=uid, started_at="2026-08-01T09:00:00")

    moved = client.patch(f"{BASE}/{uid}", json={
        "prediction": "option-a", "committed_at": "2026-08-01T09:01:00",
        "completed": True, "correct": True, "completed_at": "2026-08-01T09:01:05",
    })
    assert moved.status_code == 200, moved.text
    assert moved.json()["committed_at"].startswith("2026-08-01T09:01:00")

    other = _uid()
    _start(attempt_uid=other, started_at="2026-08-01T09:00:00")
    before_start = client.patch(f"{BASE}/{other}", json={"prediction": "option-a", "committed_at": "2026-07-01T00:00:00"})
    assert before_start.status_code == 400
    future = client.patch(f"{BASE}/{other}", json={"prediction": "option-a", "committed_at": "2099-01-01T00:00:00"})
    assert future.status_code == 400


def test_a_client_clock_a_moment_ahead_is_taken_as_now_not_refused():
    """A browser a few seconds ahead of the server is skew, not a time from the future."""
    from datetime import datetime, timedelta, UTC

    uid = _uid()
    _start(attempt_uid=uid)
    ahead = (datetime.now(UTC) + timedelta(seconds=20)).isoformat()
    moved = client.patch(f"{BASE}/{uid}", json={"prediction": "option-a", "committed_at": ahead})
    assert moved.status_code == 200, moved.text
    committed = datetime.fromisoformat(moved.json()["committed_at"])
    assert committed <= datetime.now(UTC).replace(tzinfo=None)


def test_an_offset_start_time_is_stored_as_utc():
    uid = _uid()
    created = _start(attempt_uid=uid, started_at="2026-08-01T14:30:00+05:30")
    assert created["started_at"].startswith("2026-08-01T09:00:00")


def test_a_real_sandbox_fingerprint_is_accepted():
    """The client names a scenario by every parameter it has: about 480 characters today."""
    params = {
        "automation": 0.5, "automationRecoveryGain": 0.7, "avgPointsPerItem": 3,
        "baseChangeFailRate": 0.1, "baseDefectRate": 0.15, "baseHappiness": 4,
        "baseRecoveryHours": 8, "baseUnplannedDays": 1, "batchFailPressure": 0.05,
        "capacityVariation": 0.1, "constrainedStateCapacity": 1, "deploymentIncidentRate": 0.4,
        "escapeRate": 0.25, "externalIncidentsPerSprint": 0.5, "incidentCostDays": 0.5,
        "incidentDurationHours": 4, "overloadHappinessDecay": 2, "reworkPerIncident": 0.8,
        "slo": 0.99, "sprintLengthDays": 10, "sprints": 12, "throughput": 12, "wip": 4,
        "wipDefectPressure": 0.6,
    }
    fingerprint = "|".join(f"{k}={v}" for k, v in sorted(params.items()))
    assert len(fingerprint) > 400

    created = _start(scenario_fingerprint=fingerprint)
    assert client.get(f"{BASE}/{created['attempt_uid']}").json()["scenario_fingerprint"] == fingerprint


def test_the_same_prediction_arriving_twice_is_a_retry_not_an_amendment():
    """Two saves can cross. The second claims nothing new, so it is not refused."""
    uid = _uid()
    _start(attempt_uid=uid, started_at="2026-08-01T09:00:00")
    first = client.patch(f"{BASE}/{uid}", json={"prediction": "option-a", "committed_at": "2026-08-01T09:01:00"})
    assert first.status_code == 200, first.text

    again = client.patch(f"{BASE}/{uid}", json={
        "prediction": "option-a", "committed_at": "2026-08-01T09:02:00",
        "explanation_text": "Queues form behind the constraint.",
    })
    assert again.status_code == 200, again.text
    body = again.json()
    assert body["committed_at"].startswith("2026-08-01T09:01:00")
    assert body["explanation_text"] == "Queues form behind the constraint."

    changed = client.patch(f"{BASE}/{uid}", json={"prediction": "option-b"})
    assert changed.status_code == 400


def test_a_retried_create_returns_a_finished_attempt_with_everything_it_recorded():
    """The Chart Sandbox saves an explanation by sending the attempt again: the
    create first (a no-op for an existing uid), then the change. So the create
    has to answer for an attempt that is already complete -- manipulation,
    observation, verdict and all -- exactly as it answers for a fresh one.
    """
    from datetime import datetime, timedelta, UTC

    def iso(minutes_ago: int) -> str:
        return (datetime.now(UTC) - timedelta(minutes=minutes_ago)).isoformat().replace("+00:00", "Z")

    uid = _uid()
    _start(attempt_uid=uid, hint_count=0, started_at=iso(10))
    finished = client.patch(f"{BASE}/{uid}", json={
        "hint_count": 0,
        "prediction": "option-b",
        "committed_at": iso(5),
        "manipulation": {"wip": 12},
        "observed": {"cycle_time": {"before": 3, "after": 6}, "throughput": {"before": 2, "after": 2}},
        "completed": True,
        "correct": True,
        "transfer": None,
        "completed_at": iso(5),
        "duration_ms": 5000,
    })
    assert finished.status_code == 200, finished.text

    again = client.post(BASE, json={
        "attempt_uid": uid,
        "challenge_id": "wip-limit-1",
        "concept_id": "little-law",
        "scenario_fingerprint": "wip=6;tp=2",
        "mode": "guided",
        "started_at": iso(10),
        "hint_count": 0,
    })
    assert again.status_code == 201, again.text
    body = again.json()
    assert body["prediction"] == "option-b"
    assert body["observed"]["cycle_time"] == {"before": 3, "after": 6}

    worded = client.patch(f"{BASE}/{uid}", json={"explanation_text": "More work in progress means more waiting."})
    assert worded.status_code == 200, worded.text
    assert worded.json()["explanation_text"] == "More work in progress means more waiting."


def test_two_creates_racing_for_one_uid_answer_with_the_same_attempt(monkeypatch):
    """Both requests look before either inserts, so both try to insert.

    Seen in the browser: saving an explanation while the prediction's save was
    still in flight sent two creates for one attempt, and the loser got a 500 --
    "Your explanation was not saved" for words the server had every reason to
    keep. The race is reproduced by making the lookup miss once.
    """
    from app.repositories.learning_attempt_repository import LearningAttemptRepository

    uid = _uid()
    first = _start(attempt_uid=uid)

    real_lookup = LearningAttemptRepository.get_by_uid
    missed = {"once": False}

    def lookup_that_misses_once(self, attempt_uid):
        if attempt_uid == uid and not missed["once"]:
            missed["once"] = True
            return None
        return real_lookup(self, attempt_uid)

    monkeypatch.setattr(LearningAttemptRepository, "get_by_uid", lookup_that_misses_once)
    second = client.post(BASE, json={"attempt_uid": uid, "challenge_id": "wip-limit-1", "concept_id": "little-law"})

    assert missed["once"], "the race was not reproduced"
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first["id"]
    listed = client.get(BASE, params={"concept_id": "little-law"})
    assert [a["attempt_uid"] for a in listed.json()].count(uid) == 1
