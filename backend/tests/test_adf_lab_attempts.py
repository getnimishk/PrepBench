# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_adf_lab_attempts.py

The ADF Behaviour Lab (Phase 5) keeps no table of its own: every stage of every
experiment is a row in learning_attempts, written through LearningService. These
tests hold the server's rules for the lab's ids exactly as the frontend writes them
(frontend/src/services/adfLab/attempts.ts):

    attempt_uid           ab:<subjectId>:<slug>:r<run>:<stage>
    challenge_id          adf.lab.<slug>.<stage>
    scenario_fingerprint  adf-lab=<slug>;run=<run>;model=semiconductor-v1

-- so the lock that makes a prediction a prediction cannot be routed around by the
lab, and one preparation's runs never show up under another.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

BASE = "/api/v1/learning/attempts"


def _subject(kind: str = "skill") -> int:
    name = f"ADF lab {uuid.uuid4().hex[:8]}"
    created = client.post("/api/v1/subjects", json={"name": name, "kind": kind})
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _open(subject_id: int, stage: str, run: int = 1, slug: str = "watermark", mode: str = "guided") -> dict:
    payload = {
        "attempt_uid": f"ab:{subject_id}:{slug}:r{run}:{stage}",
        "challenge_id": f"adf.lab.{slug}.{stage}",
        "concept_id": f"adf.lab.{slug}",
        "scenario_fingerprint": f"adf-lab={slug};run={run};model=semiconductor-v1",
        "mode": mode,
        "subject_id": subject_id,
    }
    response = client.post(BASE, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _patch(uid: str, body: dict):
    return client.patch(f"{BASE}/{uid}", json=body)


def test_the_predict_stage_keeps_its_prediction_write_once():
    sid = _subject()
    uid = _open(sid, "predict")["attempt_uid"]

    assert _patch(uid, {"prediction": "missing"}).status_code == 200
    assert _patch(uid, {"prediction": "missing"}).status_code == 200  # a retry, not an amendment
    changed = _patch(uid, {"prediction": "complete"})
    assert changed.status_code == 400
    assert client.get(f"{BASE}/{uid}").json()["prediction"] == "missing"


def test_nothing_about_the_run_is_recorded_before_the_prediction():
    """The lever change, the model's result and the learner's words all come after."""
    sid = _subject()
    uid = _open(sid, "predict")["attempt_uid"]

    for body in (
        {"manipulation": {"sink": {"from": "append", "to": "upsert"}}},
        {"observed": {"result": {"label": "What the destination holds", "before": "missing", "after": "complete"}}},
        {"explanation_text": "Because."},
        {"completed": True, "correct": True},
    ):
        assert _patch(uid, body).status_code == 400, body

    after = client.get(f"{BASE}/{uid}").json()
    assert after["manipulation"] is None and after["observed"] is None and after["completed_at"] is None


def test_the_observation_is_recorded_once_with_the_grade_in_one_write():
    sid = _subject()
    uid = _open(sid, "predict")["attempt_uid"]
    assert _patch(uid, {"prediction": "missing"}).status_code == 200

    record = {
        "manipulation": {"sink": {"from": "append", "to": "upsert"}, "retries": {"from": 0, "to": 1}},
        "observed": {"result": {"label": "What the destination holds", "before": "missing", "after": "complete"},
                     "source": "simulation"},
        "completed": True,
        "correct": True,
    }
    recorded = _patch(uid, record)
    assert recorded.status_code == 200, recorded.text
    body = recorded.json()
    assert body["manipulation"]["sink"] == {"from": "append", "to": "upsert"}
    assert body["correct"] is True and body["completed_at"] is not None

    # A different record is refused; the run that was observed stays the run on the record.
    other = _patch(uid, {"manipulation": {"retries": {"from": 0, "to": 3}}})
    assert other.status_code == 400
    assert _patch(uid, {"explanation_text": "The completion exit ran on failure."}).status_code == 200


def test_graded_stages_are_their_own_rows_and_transfer_is_recorded_once():
    sid = _subject()
    reason = _open(sid, "reason")["attempt_uid"]
    applied = _open(sid, "apply")["attempt_uid"]
    retrieve = _open(sid, "retrieve", mode="retrieval")

    assert _patch(reason, {"prediction": "watermark-timing", "explanation_mechanisms": ["watermark-timing"],
                           "completed": True, "correct": True}).status_code == 200
    first = _patch(applied, {"prediction": "retry-upsert", "completed": True, "correct": True, "transfer": True})
    assert first.status_code == 200 and first.json()["transfer"] is True
    # Completing again is a no-op: the transfer verdict cannot be rewritten afterwards.
    again = _patch(applied, {"completed": True, "correct": False, "transfer": False})
    assert again.status_code == 200 and again.json()["transfer"] is True and again.json()["correct"] is True

    assert retrieve["mode"] == "retrieval"


def test_one_preparation_never_sees_another_preparations_runs():
    mine, theirs = _subject(), _subject()
    _open(mine, "predict")
    _open(theirs, "predict")
    _open(theirs, "predict", run=2)

    listed = client.get(BASE, params={"subject_id": mine}).json()
    uids = {a["attempt_uid"] for a in listed}
    assert f"ab:{mine}:watermark:r1:predict" in uids
    assert not any(u.startswith(f"ab:{theirs}:") for u in uids)
    assert all(a["subject_id"] == mine for a in listed)


def test_a_run_is_correlated_by_its_ids_and_fingerprint_alone():
    """No correlation table: the run is readable from the existing columns."""
    sid = _subject()
    for stage in ("predict", "reason", "apply"):
        _open(sid, stage, run=3)
    rows = [a for a in client.get(BASE, params={"subject_id": sid}).json() if a["challenge_id"].startswith("adf.lab.")]
    assert {a["attempt_uid"].rsplit(":", 1)[0] for a in rows} == {f"ab:{sid}:watermark:r3"}
    assert {a["scenario_fingerprint"] for a in rows} == {"adf-lab=watermark;run=3;model=semiconductor-v1"}


def test_fault_tolerance_modes_are_two_tracks_of_one_experiment():
    """Each fault mode is its own run of the one experiment: the track carries the mode, the
    concept is the experiment's, and a run in one mode is never mistaken for the other."""
    sid = _subject()
    for track in ("fault-tolerance.dependency", "fault-tolerance.bad-rows"):
        for stage in ("predict", "reason", "apply", "retrieve"):
            row = client.post(BASE, json={
                "attempt_uid": f"ab:{sid}:{track}:r1:{stage}",
                "challenge_id": f"adf.lab.{track}.{stage}",
                "concept_id": "adf.lab.fault-tolerance",
                "scenario_fingerprint": f"adf-lab={track};run=1;model=faultToleranceModel",
                "mode": "retrieval" if stage == "retrieve" else "guided",
                "subject_id": sid,
            })
            assert row.status_code == 201, row.text
            assert len(row.json()["attempt_uid"]) <= 64

    rows = [a for a in client.get(BASE, params={"subject_id": sid}).json() if a["challenge_id"].startswith("adf.lab.")]
    assert {a["concept_id"] for a in rows} == {"adf.lab.fault-tolerance"}
    by_run = {}
    for a in rows:
        by_run.setdefault(a["attempt_uid"].rsplit(":", 1)[0], set()).add(a["attempt_uid"].rsplit(":", 1)[1])
    assert by_run == {
        f"ab:{sid}:fault-tolerance.dependency:r1": {"predict", "reason", "apply", "retrieve"},
        f"ab:{sid}:fault-tolerance.bad-rows:r1": {"predict", "reason", "apply", "retrieve"},
    }


def test_the_longest_lab_id_fits_the_server():
    """The longest track and stage, with a large preparation id and run number, still fits 64."""
    uid = "ab:9999999:fault-tolerance.bad-rows:r9999:retrieve"
    assert len(uid) <= 64
    sid = _subject()
    row = client.post(BASE, json={
        "attempt_uid": uid.replace("9999999", str(sid)), "challenge_id": "adf.lab.fault-tolerance.bad-rows.retrieve",
        "concept_id": "adf.lab.fault-tolerance", "scenario_fingerprint": "", "mode": "retrieval", "subject_id": sid,
    })
    assert row.status_code == 201, row.text
