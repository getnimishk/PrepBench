# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_learning_attempt_isolation.py

Every request that reaches one learning attempt by its uid is answered for one
preparation, the `subject_id` it asks as:

    GET   /learning/attempts/{uid}?subject_id=   read
    PATCH /learning/attempts/{uid}?subject_id=   write (and the attempt it returns)
    POST  /learning/attempts                     a retried create returns the stored row
    POST  /lab/lakehouse/ops                     an op tied to an attempt (predict first)

The attempt's preparation must be the one asking. Another preparation's attempt
is answered exactly like an unknown uid -- nothing of it comes back: not its
prediction, experiment, explanation, verdict or times, and not the fact that the
uid exists. A create for a uid another preparation holds is a 409 with none of
that attempt in it. Asking as no preparation (subject_id omitted) reaches only
attempts that have none -- the Chart Sandbox's -- never "any preparation". And
an attempt cannot be moved to another preparation.

A preparation is a `subjects` row, including every learner-created one, so two
preparations built on the same content pack are two subject ids and are kept
apart by the same rule.

The list endpoint (GET /learning/attempts?subject_id=) is unchanged; its
filtering is pinned here as a regression.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

BASE = "/api/v1/learning/attempts"
OPS = "/api/v1/lab/lakehouse/ops"

# Every field the response carries about the attempt itself. None of these may
# appear in an answer given to the wrong preparation.
ATTEMPT_FIELDS = {
    "id", "attempt_uid", "subject_id", "challenge_id", "concept_id", "scenario_fingerprint", "mode",
    "started_at", "committed_at", "completed_at", "prediction", "manipulation", "observed",
    "explanation_text", "explanation_mechanisms", "correct", "transfer", "hint_count", "rubric_coverage",
}


def _preparation(name: str, kind: str, pack: str | None = None, **exam_profile) -> int:
    body = {"name": f"{name} {uuid.uuid4().hex[:6]}", "kind": kind, **exam_profile}
    created = client.post("/api/v1/subjects", json=body)
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    if pack:
        attached = client.post(f"/api/v1/subjects/{sid}/content-packs", json={"pack_id": pack})
        assert attached.status_code == 201, attached.text
    return sid


def _scope(subject_id: int | None) -> dict:
    return {} if subject_id is None else {"subject_id": subject_id}


def _get(uid: str, subject_id: int | None):
    return client.get(f"{BASE}/{uid}", params=_scope(subject_id))


def _patch(uid: str, subject_id: int | None, body: dict):
    return client.patch(f"{BASE}/{uid}", params=_scope(subject_id), json=body)


def _open(uid: str, subject_id: int | None, prefix: str = "x"):
    body = {"attempt_uid": uid, "challenge_id": f"{prefix}.challenge", "concept_id": f"{prefix}.concept",
            "scenario_fingerprint": f"{prefix}=1", "mode": "guided", **_scope(subject_id)}
    return client.post(BASE, json=body)


def _finished_attempt(subject_id: int | None, prefix: str) -> str:
    """An attempt with everything on the record: prediction, experiment, result,
    explanation, verdict -- the data a wrong preparation must never see."""
    uid = f"{prefix}:{uuid.uuid4().hex[:12]}"
    assert _open(uid, subject_id, prefix).status_code == 201
    done = _patch(uid, subject_id, {
        "prediction": "secret-prediction",
        "manipulation": {"lever": {"from": 1, "to": 2}},
        "observed": {"result": {"label": "Result", "before": 1, "after": 2}},
        "completed": True, "correct": True, "transfer": True,
    })
    assert done.status_code == 200, done.text
    assert _patch(uid, subject_id, {"explanation_text": "secret explanation"}).status_code == 200
    return uid


def _assert_not_found_and_silent(response, uid: str) -> None:
    """Refused the way an unknown uid is, with nothing of the attempt in the body."""
    assert response.status_code == 404, response.text
    body = response.json()
    assert body == {"detail": f"LearningAttempt with ID '{uid}' not found."}
    assert not ATTEMPT_FIELDS & set(body)
    assert "secret" not in response.text


def _assert_untouched(uid: str, subject_id: int | None) -> None:
    """The owner still sees exactly what it recorded."""
    body = _get(uid, subject_id).json()
    assert body["subject_id"] == subject_id
    assert body["prediction"] == "secret-prediction"
    assert body["explanation_text"] == "secret explanation"
    assert body["correct"] is True and body["transfer"] is True


# ---- TEST 1: the same preparation reads its own attempt ------------------------


def test_the_attempts_own_preparation_reads_it():
    sid = _preparation("Own preparation", "skill")
    uid = _finished_attempt(sid, "own")

    response = _get(uid, sid)

    assert response.status_code == 200, response.text
    assert response.json()["attempt_uid"] == uid
    _assert_untouched(uid, sid)


# ---- TEST 2: any other preparation is told it does not exist -------------------


def test_another_preparation_gets_the_unknown_uid_answer_and_no_data():
    mine, theirs = _preparation("Asker", "skill"), _preparation("Owner", "skill")
    uid = _finished_attempt(theirs, "owned")

    _assert_not_found_and_silent(_get(uid, mine), uid)
    # Indistinguishable from a uid that was never created.
    never = f"owned:{uuid.uuid4().hex[:12]}"
    assert _get(never, mine).json() == {"detail": f"LearningAttempt with ID '{never}' not found."}
    _assert_untouched(uid, theirs)


# ---- TEST 3: PSM I vs Kafka ----------------------------------------------------


def test_kafka_cannot_read_a_psm_i_attempt():
    psm = _preparation("Scrum / PSM I", "certification", pass_mark=85, exam_question_count=80, exam_minutes=60)
    kafka = _preparation("Confluent Certified Developer for Apache Kafka", "certification",
                         pass_mark=70, exam_question_count=60, exam_minutes=90)
    uid = _finished_attempt(psm, "psm")

    _assert_not_found_and_silent(_get(uid, kafka), uid)
    _assert_not_found_and_silent(_patch(uid, kafka, {}), uid)
    _assert_untouched(uid, psm)


# ---- TEST 4: Databricks vs ADF, both ways --------------------------------------


def test_databricks_and_adf_cannot_reach_each_others_attempts():
    databricks = _preparation("Databricks Data Platform", "skill")
    adf = _preparation("Azure Data Factory", "skill", pack="adf")
    lakehouse_uid = _finished_attempt(databricks, "lakehouse")
    adf_uid = _finished_attempt(adf, "ab")

    for uid, other in ((lakehouse_uid, adf), (adf_uid, databricks)):
        _assert_not_found_and_silent(_get(uid, other), uid)
        _assert_not_found_and_silent(_patch(uid, other, {}), uid)
    _assert_untouched(lakehouse_uid, databricks)
    _assert_untouched(adf_uid, adf)


def test_two_preparations_on_the_adf_pack_are_still_two_preparations():
    """Sharing a content pack is not sharing evidence: each is its own subject id."""
    first = _preparation("ADF preparation A", "skill", pack="adf")
    second = _preparation("ADF preparation B", "skill", pack="adf")
    uid = _finished_attempt(first, "ab")

    _assert_not_found_and_silent(_get(uid, second), uid)
    _assert_not_found_and_silent(_patch(uid, second, {}), uid)
    _assert_untouched(uid, first)


# ---- TEST 5: many attempts, many preparations ----------------------------------


def test_each_preparation_reaches_only_its_own_attempts():
    preps = [_preparation(f"Preparation {n}", "skill") for n in range(3)]
    owned = {sid: [_finished_attempt(sid, f"p{n}") for _ in range(2)] for n, sid in enumerate(preps)}

    for asker in preps:
        for owner, uids in owned.items():
            for uid in uids:
                read, write = _get(uid, asker), _patch(uid, asker, {})
                if owner == asker:
                    assert read.status_code == 200 and read.json()["subject_id"] == asker
                    assert write.status_code == 200 and write.json()["subject_id"] == asker
                else:
                    _assert_not_found_and_silent(read, uid)
                    _assert_not_found_and_silent(write, uid)


# ---- TEST 6: unknown uid, no preparation ---------------------------------------


def test_an_unknown_uid_is_still_a_404():
    sid = _preparation("Unknown uid", "skill")
    uid = f"none:{uuid.uuid4().hex}"
    assert _get(uid, sid).status_code == 404
    assert _get(uid, None).status_code == 404
    assert _patch(uid, sid, {"prediction": "a"}).status_code == 404


def test_asking_as_no_preparation_reaches_only_attempts_with_none():
    """Omitting subject_id is not a default and not a wildcard: it is the scope of the
    attempts that belong to no preparation (the Chart Sandbox records these)."""
    sid = _preparation("Owns one", "skill")
    owned = _finished_attempt(sid, "owned")
    unowned = _finished_attempt(None, "chart")

    _assert_not_found_and_silent(_get(owned, None), owned)
    _assert_not_found_and_silent(_patch(owned, None, {}), owned)
    _assert_untouched(owned, sid)

    _assert_not_found_and_silent(_get(unowned, sid), unowned)
    _assert_not_found_and_silent(_patch(unowned, sid, {}), unowned)
    _assert_untouched(unowned, None)
    assert unowned in {a["attempt_uid"] for a in client.get(BASE).json()}


# ---- writes: the other preparation can change nothing --------------------------


def test_another_preparation_cannot_write_to_an_attempt():
    mine, theirs = _preparation("Writer", "skill"), _preparation("Written to", "skill")
    uid = _finished_attempt(theirs, "w")

    for body in (
        {"prediction": "secret-prediction"},
        {"explanation_text": "rewritten"},
        {"hint_count": 9},
        {"explanation_mechanisms": ["changed"]},
        {"completed": True, "correct": False},
    ):
        _assert_not_found_and_silent(_patch(uid, mine, body), uid)
    after = _get(uid, theirs).json()
    assert after["hint_count"] == 0 and after["explanation_mechanisms"] == []
    _assert_untouched(uid, theirs)


def test_an_attempt_cannot_be_moved_to_another_preparation():
    """Moving it would carry one preparation's evidence into another, and let anyone
    who can name a uid take a row somewhere they can then read it."""
    own, other = _preparation("Keeps it", "skill"), _preparation("Would take it", "skill")
    uid = _finished_attempt(own, "keep")

    moved = _patch(uid, own, {"subject_id": other})
    assert moved.status_code == 400, moved.text
    assert "cannot be moved" in moved.json()["detail"]
    # From the other side it does not even exist.
    _assert_not_found_and_silent(_patch(uid, other, {"subject_id": other}), uid)
    # Naming its own preparation again is not a move.
    assert _patch(uid, own, {"subject_id": own}).status_code == 200

    _assert_not_found_and_silent(_get(uid, other), uid)
    _assert_untouched(uid, own)

    unowned = _finished_attempt(None, "orphan")
    assert _patch(unowned, None, {"subject_id": own}).status_code == 400
    _assert_not_found_and_silent(_get(unowned, own), unowned)


# ---- creates: a retry is answered, someone else's uid is not -------------------


def test_a_create_for_another_preparations_uid_is_a_409_with_none_of_its_data():
    mine, theirs = _preparation("Creator", "skill"), _preparation("Holder", "skill")
    uid = _finished_attempt(theirs, "held")

    taken = _open(uid, mine, "held")

    assert taken.status_code == 409, taken.text
    assert set(taken.json()) == {"detail"}
    assert "another preparation" in taken.json()["detail"]
    assert "secret" not in taken.text
    _assert_untouched(uid, theirs)
    # The same preparation's retry is still answered with the attempt, as before.
    again = _open(uid, theirs, "held")
    assert again.status_code == 201 and again.json()["prediction"] == "secret-prediction"


def test_a_deleted_preparations_reused_id_does_not_inherit_its_attempts():
    """SQLite gives the highest subject id out again after a delete, and the deleted
    preparation's attempts stay (subject_id NULL) under uids that name that id. A new
    preparation opening the same uid is refused -- it does not get the old answers."""
    old = _preparation("Deleted later", "skill")
    uid = f"ab:{old}:watermark:r1:predict"
    assert _open(uid, old, "adf.lab.watermark").status_code == 201
    assert _patch(uid, old, {"prediction": "secret-prediction"}).status_code == 200
    name = client.get(f"/api/v1/subjects/{old}").json()["name"]
    deleted = client.request("DELETE", f"/api/v1/subjects/{old}", json={"confirm_name": name})
    assert deleted.status_code == 200, deleted.text

    orphan = _get(uid, None).json()
    assert orphan["subject_id"] is None and orphan["prediction"] == "secret-prediction"

    newer = _preparation("Created after", "skill")
    taken = _open(uid, newer, "adf.lab.watermark")
    assert taken.status_code == 409 and "secret" not in taken.text
    _assert_not_found_and_silent(_patch(uid, newer, {"prediction": "mine"}), uid)
    assert _get(uid, None).json()["prediction"] == "secret-prediction"


def test_an_unowned_uid_cannot_be_claimed_by_a_preparation_and_vice_versa():
    sid = _preparation("Claimer", "skill")
    unowned = _finished_attempt(None, "chart")
    owned = _finished_attempt(sid, "mine")

    assert _open(unowned, sid, "chart").status_code == 409
    assert _open(owned, None, "mine").status_code == 409
    _assert_untouched(unowned, None)
    _assert_untouched(owned, sid)


# ---- TEST 7: the Phase 5 ADF Behaviour Lab's own ids ---------------------------


def test_an_adf_lab_run_is_reached_only_from_its_own_preparation():
    """The lab's ids exactly as frontend/src/services/adfLab/attempts.ts writes them."""
    adf = _preparation("ADF Behaviour Lab", "skill", pack="adf")
    other = _preparation("ADF Behaviour Lab, someone else", "skill", pack="adf")
    track = "fault-tolerance.bad-rows"
    uid = f"ab:{adf}:{track}:r1:predict"
    assert client.post(BASE, json={
        "attempt_uid": uid, "challenge_id": f"adf.lab.{track}.predict", "concept_id": "adf.lab.fault-tolerance",
        "scenario_fingerprint": f"adf-lab={track};run=1;model=faultToleranceModel", "mode": "guided",
        "subject_id": adf,
    }).status_code == 201
    assert _patch(uid, adf, {"prediction": "fails"}).status_code == 200
    assert _patch(uid, adf, {
        "manipulation": {"skip": {"from": False, "to": True}},
        "observed": {"result": {"label": "Copy activity", "before": "Failed", "after": "Succeeded"}},
        "completed": True, "correct": False,
    }).status_code == 200

    read = _get(uid, adf)
    assert read.status_code == 200, read.text
    assert read.json()["prediction"] == "fails"
    assert read.json()["observed"]["result"]["after"] == "Succeeded"
    # The write-once lock is untouched by the scope.
    assert _patch(uid, adf, {"prediction": "succeeds"}).status_code == 400
    assert _get(uid, adf).json()["prediction"] == "fails"

    _assert_not_found_and_silent(_get(uid, other), uid)
    _assert_not_found_and_silent(_patch(uid, other, {"prediction": "succeeds"}), uid)
    assert client.post(BASE, json={
        "attempt_uid": uid, "challenge_id": f"adf.lab.{track}.predict", "concept_id": "adf.lab.fault-tolerance",
        "subject_id": other,
    }).status_code == 409


# ---- the Lakehouse op gate counts only the asking preparation's prediction -----


@pytest.fixture
def no_engine(monkeypatch):
    """The engine reported missing, so an op that passes the attempt check stops at 503."""
    from app.schemas.lab import EngineStatus
    from app.services.lab import engine

    monkeypatch.setattr(engine, "status", lambda: EngineStatus(
        available=False, install_command=engine.INSTALL_COMMAND, detail="deltalake is not installed.",
    ))


def test_a_lakehouse_op_cannot_lean_on_another_preparations_prediction(no_engine):
    mine, theirs = _preparation("Lakehouse, mine", "skill"), _preparation("Lakehouse, theirs", "skill")
    uid = f"lk:{theirs}:{uuid.uuid4().hex[:12]}"
    assert _open(uid, theirs, "lakehouse.c.create").status_code == 201
    assert _patch(uid, theirs, {"prediction": "1000"}).status_code == 200
    op = {"pack_id": "semiconductor-v1", "op": "history", "table": "bronze.defects", "attempt_uid": uid}

    borrowed = client.post(OPS, json={**op, "subject_id": mine})
    assert borrowed.status_code == 400, borrowed.text
    assert "No learning attempt" in borrowed.json()["detail"]
    assert client.post(OPS, json=op).status_code == 400  # as no preparation, either

    # The owner's committed prediction passes the gate (and stops at the missing engine).
    assert client.post(OPS, json={**op, "subject_id": theirs}).status_code == 503


# ---- TEST 8: the list endpoint is unchanged ------------------------------------


def test_the_list_still_returns_only_the_asked_preparations_attempts():
    a, b = _preparation("List A", "skill"), _preparation("List B", "skill")
    a_uids = {_finished_attempt(a, "la") for _ in range(2)}
    b_uid = _finished_attempt(b, "lb")

    listed = client.get(BASE, params={"subject_id": a})

    assert listed.status_code == 200
    rows = listed.json()
    assert {r["attempt_uid"] for r in rows} == a_uids
    assert all(r["subject_id"] == a for r in rows)
    assert b_uid not in {r["attempt_uid"] for r in rows}
