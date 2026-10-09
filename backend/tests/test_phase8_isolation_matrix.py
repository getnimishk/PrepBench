# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Phase 8: one isolation matrix across every preparation-scoped surface.

Seven preparations shaped like the real ones -- a Scrum-style certification with a
bank, a Kafka-style certification with none, Databricks with ADLS, System Design,
Agentic AI, and two preparations on the ADF pack -- each given its own roadmap,
topic, guide section, demonstration, learning attempt and (for the certification)
question. Then, for every ordered pair, the second must see none of the first's
work through any surface, and asking as no preparation must see none of anyone's.

Each work item carries a unique marker string, and a surface leaks if any of
another preparation's markers appears anywhere in its response.
"""

import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

KINDS = {
    "psm": ("certification", None, True),
    "kafka": ("certification", None, False),
    "databricks": ("skill", "adls", False),
    "system_design": ("skill", None, False),
    "agentic": ("skill", None, False),
    "adf": ("skill", "adf", False),
    "adf_twin": ("skill", "adf", False),
}


def _preparation(label: str, kind: str, pack: str | None) -> dict:
    tag = uuid.uuid4().hex[:8]
    body = {"name": f"P8 {label} {tag}", "kind": kind}
    if kind == "certification":
        body.update(pass_mark=80, exam_question_count=20, exam_minutes=30, certification=f"P8-CERT-{tag}")
    made = client.post("/api/v1/subjects", json=body)
    assert made.status_code == 201, made.text
    prep = made.json()
    if pack:
        assert client.post(f"/api/v1/subjects/{prep['id']}/content-packs", json={"pack_id": pack}).status_code == 201
    return prep


def _work(label: str, prep: dict, with_question: bool) -> dict:
    """Everything a learner keeps under one preparation, each marked so a leak is visible."""
    sid = prep["id"]
    m = f"MARK-{label}-{uuid.uuid4().hex[:8]}"
    rid = client.post("/api/v1/roadmaps", json={"title": f"{m} roadmap", "subject_id": sid}).json()["id"]
    phase = client.post(f"/api/v1/roadmaps/{rid}/phases", json={"name": f"{m} phase"}).json()["id"]
    tid = client.post(f"/api/v1/roadmaps/{rid}/topics", json={
        "phase_id": phase, "title": f"{m} topic", "success_criteria": "Explain it.",
    }).json()["id"]
    assert client.post(f"/api/v1/roadmaps/{rid}/topics/{tid}/guide/sections",
                       json={"title": f"{m} section", "body": "Notes."}).status_code in (200, 201)
    assert client.post(f"/api/v1/roadmaps/{rid}/topics/{tid}/demonstrations",
                       json={"response_text": f"{m} demonstration", "self_grade": "partial"}).status_code in (200, 201)
    uid = f"p8:{sid}:{uuid.uuid4().hex[:8]}"
    opened = client.post("/api/v1/learning/attempts", json={
        "attempt_uid": uid, "challenge_id": "wip-limit-1", "concept_id": "wip", "subject_id": sid,
    })
    assert opened.status_code == 201, opened.text
    assert client.patch(f"/api/v1/learning/attempts/{uid}", params={"subject_id": sid}, json={
        "prediction": "option-a", "completed": True, "correct": True, "explanation_text": f"{m} explanation",
    }).status_code == 200
    saved = client.put("/api/v1/interview-questions/by-source", json={
        "source_ref": f"p8/{label}/{uuid.uuid4().hex[:8]}", "subject_id": sid,
        "question_text": f"{m} interview question", "category": "Phase 8",
    })
    assert saved.status_code == 200, saved.text
    interview_question = saved.json()["question"]["id"]
    question = None
    if with_question:
        q = client.post("/api/v1/questions", json={
            "text": f"{m} question", "question_type": "single_choice", "difficulty": "medium",
            "domain": "Scrum Theory", "topic": "Empiricism", "certification": prep["certification"],
            "explanation": "Seeded by the Phase 8 isolation matrix.",
            "options": [{"option_text": "Right", "is_correct": True, "order_index": 0},
                        {"option_text": "Wrong", "is_correct": False, "order_index": 1}],
        })
        assert q.status_code == 201, q.text
        question = q.json()["id"]
    return {"sid": sid, "mark": m, "roadmap": rid, "topic": tid, "uid": uid, "question": question,
            "interview_question": interview_question}


@pytest.fixture(scope="module")
def world():
    preps = {label: _preparation(label, kind, pack) for label, (kind, pack, _) in KINDS.items()}
    work = {label: _work(label, preps[label], KINDS[label][2]) for label in KINDS}
    # Work that belongs to no preparation: the Chart Sandbox's kind, and a roadmap with no owner.
    loose_uid = f"p8:none:{uuid.uuid4().hex[:8]}"
    assert client.post("/api/v1/learning/attempts", json={
        "attempt_uid": loose_uid, "challenge_id": "wip-limit-1", "concept_id": "wip",
    }).status_code == 201
    loose_roadmap = client.post("/api/v1/roadmaps", json={"title": f"MARK-none-{uuid.uuid4().hex[:8]} roadmap"}).json()["id"]
    return {"preps": preps, "work": work, "loose_uid": loose_uid, "loose_roadmap": loose_roadmap}


def _surfaces(sid):
    """Every preparation-scoped read, as text, for one preparation (or None = no preparation)."""
    scope = {} if sid is None else {"subject_id": sid}
    reads = {
        "roadmaps": client.get("/api/v1/roadmaps", params={"unassigned": "true"} if sid is None else scope),
        "workspace": client.get("/api/v1/workspace", params=scope),
        "evidence": client.get("/api/v1/evidence", params=scope),
        "attempts": client.get("/api/v1/learning/attempts", params=scope),
    }
    if sid is not None:
        reads["questions"] = client.get("/api/v1/questions", params={"subject_id": sid, "limit": 200})
        reads["review"] = client.get("/api/v1/review/queue", params={"subject_id": sid})
    reads["interview"] = client.get("/api/v1/interview-questions", params={**scope, "limit": 500})
    out = {}
    for name, r in reads.items():
        assert r.status_code == 200, f"{name} for {sid}: {r.status_code} {r.text[:200]}"
        out[name] = json.dumps(r.json())
    return out


PAIRS = [(a, b) for a in KINDS for b in KINDS if a != b]


@pytest.mark.parametrize("owner,reader", PAIRS, ids=[f"{a}->{b}" for a, b in PAIRS])
def test_no_preparation_sees_anothers_work_on_any_surface(world, owner, reader):
    mark = world["work"][owner]["mark"]
    for surface, text in _surfaces(world["preps"][reader]["id"]).items():
        assert mark not in text, f"{owner}'s work leaked into {reader}'s {surface}"


@pytest.mark.parametrize("label", list(KINDS))
def test_each_preparation_still_sees_its_own_work(world, label):
    """The positive control: the matrix above passes only because each surface works."""
    w = world["work"][label]
    s = _surfaces(w["sid"])
    assert w["mark"] in s["roadmaps"] and w["mark"] in s["workspace"] and w["uid"] in s["attempts"]
    assert w["mark"] in s["interview"]
    if w["question"]:
        assert w["mark"] in s["questions"]
    detail = client.get(f"/api/v1/subjects/{w['sid']}").json()
    assert detail["roadmap_count"] == 1  # its own, and nobody else's


def test_no_preparation_means_none_of_them_never_all(world):
    s = _surfaces(None)
    for label, w in world["work"].items():
        for surface, text in s.items():
            assert w["mark"] not in text, f"{label}'s work appeared with no preparation, in {surface}"
    # ...and it is the work that belongs to no preparation.
    assert world["loose_uid"] in s["attempts"]
    assert str(world["loose_roadmap"]) in s["roadmaps"]


def test_an_attempt_list_with_no_preparation_returns_only_unowned_attempts(world):
    """Phase 8: the list used to return every preparation's attempts when subject_id was omitted."""
    listed = client.get("/api/v1/learning/attempts").json()
    assert listed, "the unowned attempt should be listed"
    assert all(a["subject_id"] is None for a in listed)
    assert world["loose_uid"] in {a["attempt_uid"] for a in listed}


def test_curriculum_never_crosses_preparations(world):
    """A roadmap's pack is its own preparation's: same pack twins map alike, others map nothing."""
    preps, work = world["preps"], world["work"]
    for label, w in work.items():
        detail = client.get(f"/api/v1/roadmaps/{w['roadmap']}").json()
        expected = {"adf": "adf", "adf_twin": "adf"}.get(label)  # ADLS has no roadmap alignment
        assert detail["linked_pack_id"] == expected, label
        topic = detail["phases"][0]["topics"][0]
        # A topic titled with a marker matches no chapter by title or number: nothing is guessed.
        assert topic["mapped_chapters"] == []
    packs = {label: {p["pack_id"] for p in client.get(f"/api/v1/subjects/{p['id']}").json()["content_packs"]}
             for label, p in preps.items()}
    assert packs["databricks"] == {"adls"} and packs["adf"] == packs["adf_twin"] == {"adf"}
    assert packs["psm"] == packs["kafka"] == packs["system_design"] == packs["agentic"] == set()


def test_a_deleted_preparations_reused_id_inherits_nothing():
    gone = _preparation("Gone", "skill", "adf")
    w = _work("gone", gone, False)
    deleted = client.request("DELETE", f"/api/v1/subjects/{gone['id']}", json={"confirm_name": gone["name"]})
    assert deleted.status_code in (200, 204), deleted.text
    reborn = _preparation("Reborn", "skill", None)
    for surface, text in _surfaces(reborn["id"]).items():
        assert w["mark"] not in text, f"a deleted preparation's work reached a new one through {surface}"


def test_the_shared_interview_library_holds_no_preparations_own_questions(world):
    """Phase 8: a question a preparation saved (ADF's Say-it answers) is never the shared library's."""
    shared = client.get("/api/v1/interview-questions", params={"limit": 500}).json()
    assert all(q["subject_id"] is None for q in shared["items"])


@pytest.mark.parametrize("owner,reader", PAIRS, ids=[f"{a}->{b}" for a, b in PAIRS])
def test_no_preparation_reaches_anothers_interview_question_by_id(world, owner, reader):
    """Knowing an id grants nothing: detail, update and delete are refused like an unknown id,
    and the owner's question is left exactly as it was."""
    qid = world["work"][owner]["interview_question"]
    other = world["preps"][reader]["id"]
    path = f"/api/v1/interview-questions/{qid}"
    assert client.get(path, params={"subject_id": other}).status_code == 404
    assert client.put(path, params={"subject_id": other}, json={"question_text": "Overwritten"}).status_code == 404
    assert client.delete(path, params={"subject_id": other}).status_code == 404
    kept = client.get(path, params={"subject_id": world["work"][owner]["sid"]})
    assert kept.status_code == 200
    assert kept.json()["question_text"] == f"{world['work'][owner]['mark']} interview question"


@pytest.mark.parametrize("label", list(KINDS))
def test_no_preparation_cannot_reach_a_preparations_interview_question_by_id(world, label):
    qid = world["work"][label]["interview_question"]
    path = f"/api/v1/interview-questions/{qid}"
    assert client.get(path).status_code == 404
    assert client.put(path, json={"category": "Changed with no preparation"}).status_code == 404
    assert client.delete(path).status_code == 404
    assert client.get(path, params={"subject_id": world["work"][label]["sid"]}).json()["category"] == "Phase 8"
