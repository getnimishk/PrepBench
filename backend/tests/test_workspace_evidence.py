# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_workspace_evidence.py

Phase 6: GET /workspace and GET /evidence are read models over rows the features
already keep (docs/implementation/PHASE-6-CONTRACT.md). These tests hold:

  * scope -- a preparation sees only what it owns; omitted subject_id is "no
    preparation" (work with no owner), never every preparation; an unknown
    preparation is a 404. Across subjects, across two preparations of one pack,
    and for a deleted preparation whose id is given out again.
  * levels -- activity, completed, demonstrated, evidenced are computed from the
    row exactly as the contract says; self- and AI-assessed work never rises above
    completed; a mock never states readiness.
  * read only -- neither endpoint writes.
"""
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.design_review import DesignReview, DesignReviewAttempt
from app.models.exam_session import ExamMode, ExamSession, ExamStatus
from app.models.interview_question import InterviewQuestion, InterviewRoundType
from app.models.practice_recording import PracticeRecording
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic, TopicDemonstration, TopicGuideSection
from app.models.system_design_attempt import SystemDesignAttempt
from app.models.system_design_prompt import SystemDesignPrompt
from tests.conftest import TestingSessionLocal

client = TestClient(app)

ATTEMPTS = "/api/v1/learning/attempts"


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _preparation(name: str, kind: str = "skill", pack: str | None = None, **profile) -> dict:
    created = client.post("/api/v1/subjects", json={"name": f"{name} {uuid.uuid4().hex[:6]}", "kind": kind, **profile})
    assert created.status_code == 201, created.text
    body = created.json()
    if pack:
        assert client.post(f"/api/v1/subjects/{body['id']}/content-packs", json={"pack_id": pack}).status_code == 201
    return body


def _certification(name: str) -> dict:
    return _preparation(name, "certification", pass_mark=80, exam_question_count=20, exam_minutes=30)


def _attempt(subject_id: int | None, uid: str, challenge: str, concept: str, fingerprint: str = "",
             mode: str = "guided", **patch) -> str:
    body = {"attempt_uid": uid, "challenge_id": challenge, "concept_id": concept,
            "scenario_fingerprint": fingerprint, "mode": mode}
    if subject_id is not None:
        body["subject_id"] = subject_id
    assert client.post(ATTEMPTS, json=body).status_code == 201
    params = {} if subject_id is None else {"subject_id": subject_id}
    if "prediction" in patch:
        assert client.patch(f"{ATTEMPTS}/{uid}", params=params, json={"prediction": patch.pop("prediction")}).status_code == 200
    if patch:
        explanation = patch.pop("explanation_text", None)
        if patch:
            done = client.patch(f"{ATTEMPTS}/{uid}", params=params, json=patch)
            assert done.status_code == 200, done.text
        if explanation:
            assert client.patch(f"{ATTEMPTS}/{uid}", params=params, json={"explanation_text": explanation}).status_code == 200
    return uid


def _adf_run(sid: int, run: int = 1, *, explain: bool = True) -> None:
    """One ADF lab run, as frontend/src/services/adfLab/attempts.ts writes it."""
    fp = f"adf-lab=watermark;run={run};model=semiconductor-v1"
    _attempt(sid, f"ab:{sid}:watermark:r{run}:predict", "adf.lab.watermark.predict", "adf.lab.watermark", fp,
             prediction="missing", manipulation={"sink": {"from": "append", "to": "upsert"}},
             observed={"result": {"before": "missing", "after": "complete"}, "source": "simulation"},
             completed=True, correct=True,
             **({"explanation_text": "The completion exit ran on failure."} if explain else {}))
    _attempt(sid, f"ab:{sid}:watermark:r{run}:reason", "adf.lab.watermark.reason", "adf.lab.watermark", fp,
             prediction="watermark-timing", completed=True, correct=False)
    _attempt(sid, f"ab:{sid}:watermark:r{run}:apply", "adf.lab.watermark.apply", "adf.lab.watermark", fp,
             prediction="retry-upsert", completed=True, correct=True, transfer=True)
    _attempt(sid, f"ab:{sid}:watermark:r{run}:retrieve", "adf.lab.watermark.retrieve", "adf.lab.watermark", fp,
             mode="retrieval", prediction="0", completed=True, correct=True)


def _scenario(sid: int) -> None:
    """A scenario check (answer key) and a lens (case notes), as ScenarioPage writes them."""
    _attempt(sid, f"s{sid}:adf@1:1:c0", "adf/1/check/0", "adf/incremental", "pack_version=1",
             prediction="2", completed=True, correct=True)
    _attempt(sid, f"s{sid}:adf@1:1:lens:po", "adf/1/lens/po", "adf/incremental", "pack_version=1;role=po",
             prediction="case-notes", completed=True, explanation_text="a) Who owns the watermark?\nThe pipeline.")


def _roadmap_work(db, sid: int | None, tag: str) -> dict:
    roadmap = Roadmap(title=f"Roadmap {tag}", subject_id=sid)
    db.add(roadmap)
    db.flush()
    phase = RoadmapPhase(roadmap_id=roadmap.id, name="Phase 1")
    db.add(phase)
    db.flush()
    topic = RoadmapTopic(roadmap_id=roadmap.id, phase_id=phase.id, title=f"Topic {tag}",
                         evidence_notes=f"My notes on {tag}")
    db.add(topic)
    db.flush()
    db.add_all([
        TopicGuideSection(topic_id=topic.id, title=f"Guide {tag}", body="Body", source="learner"),
        TopicGuideSection(topic_id=topic.id, title=f"AI draft {tag}", body="Body", source="ai"),
        TopicDemonstration(topic_id=topic.id, response_text=f"Demonstration {tag}", self_grade="yes",
                           next_recheck_at=datetime(2026, 11, 1)),
    ])
    db.commit()
    return {"roadmap": roadmap.id, "topic": topic.id}


def _interview_work(db, sid: int | None, tag: str) -> dict:
    question = InterviewQuestion(round_type=InterviewRoundType.BEHAVIORAL, question_text=f"Question {tag}?",
                                 prepared_answer=f"My answer {tag}", key_talking_points=["one", "two"],
                                 subject_id=sid)
    db.add(question)
    db.flush()
    recording = PracticeRecording(title=f"Take {tag}", file_path=f"{tag}.webm", interview_question_id=question.id)
    db.add(recording)
    db.commit()
    return {"question": question.id, "recording": recording.id}


def _mock(db, sid: int, score: float, passing: float | None = 80) -> int:
    session = ExamSession(title=f"Mock {score}", exam_mode=ExamMode.TIMED, status=ExamStatus.COMPLETED,
                          session_kind="mock", subject_id=sid, source="learner", total_questions=20,
                          answered_questions=20, score_percentage=score, passing_percentage=passing,
                          start_time=datetime(2026, 10, 1, 9), end_time=datetime(2026, 10, 1, 10))
    db.add(session)
    db.commit()
    return session.id


def _ids(items) -> set:
    return {i["id"] for i in items}


def _workspace(sid: int | None) -> dict:
    response = client.get("/api/v1/workspace", params={} if sid is None else {"subject_id": sid})
    assert response.status_code == 200, response.text
    return response.json()


def _evidence(sid: int | None) -> dict:
    response = client.get("/api/v1/evidence", params={} if sid is None else {"subject_id": sid})
    assert response.status_code == 200, response.text
    return response.json()


# ---- empty -------------------------------------------------------------------------------------


def test_a_new_preparation_has_an_empty_workspace_and_no_evidence():
    sid = _preparation("Brand new")["id"]
    assert _workspace(sid) == {"subject_id": sid, "items": []}
    assert _evidence(sid) == {"subject_id": sid, "items": [],
                              "counts": {"activity": 0, "completed": 0, "demonstrated": 0, "evidenced": 0}}


def test_an_unknown_preparation_is_a_404_not_a_fallback():
    assert client.get("/api/v1/workspace", params={"subject_id": 999_999}).status_code == 404
    assert client.get("/api/v1/evidence", params={"subject_id": 999_999}).status_code == 404


# ---- the ADF lab, as Workspace and as Evidence -------------------------------------------------


def test_an_adf_lab_run_is_one_workspace_notebook_and_four_graded_stages():
    sid = _preparation("ADF lab", pack="adf")["id"]
    _adf_run(sid)

    items = _workspace(sid)["items"]
    assert [i["kind"] for i in items] == ["lab_run"]
    run = items[0]
    assert run["ref"] == {"track": "watermark", "run": "1"}
    assert run["href"] == "/lab/adf/watermark"
    assert run["context"] == "Run 1"
    assert run["detail"] == "4 of 4 graded stages finished"
    assert run["excerpt"] == "The completion exit ran on failure."
    assert run["updated_at"] is not None

    evidence = _evidence(sid)
    by_stage = {i["ref"]["stage"]: i for i in evidence["items"]}
    # Predict: correct and explained -> evidenced. Apply: correct and transferred -> evidenced.
    assert by_stage["predict"]["level"] == "evidenced"
    assert "your explanation is recorded (not graded)" in by_stage["predict"]["basis"]
    assert by_stage["apply"]["level"] == "evidenced"
    assert "applied to a changed constraint" in by_stage["apply"]["basis"]
    # Reason: answered wrong -> completed, never demonstrated.
    assert by_stage["reason"]["level"] == "completed"
    assert by_stage["reason"]["basis"].endswith("not correct")
    # Retrieve: correct, nothing more on record -> demonstrated.
    assert by_stage["retrieve"]["level"] == "demonstrated"
    assert all(i["assessed_by"] == "model" and i["source"] == "learning_lab" for i in evidence["items"])
    assert evidence["counts"] == {"activity": 0, "completed": 1, "demonstrated": 1, "evidenced": 2}


def test_a_committed_but_unfinished_prediction_is_activity():
    sid = _preparation("Started", pack="adf")["id"]
    _attempt(sid, f"ab:{sid}:triggers:r1:predict", "adf.lab.triggers.predict", "adf.lab.triggers",
             "adf-lab=triggers;run=1;model=semiconductor-v1", prediction="x")
    _attempt(sid, f"ab:{sid}:triggers:r1:reason", "adf.lab.triggers.reason", "adf.lab.triggers")  # only opened

    evidence = _evidence(sid)
    assert [(i["ref"]["stage"], i["level"]) for i in evidence["items"]] == [("predict", "activity")]
    assert evidence["items"][0]["basis"] == "Prediction committed; not finished yet"
    workspace = _workspace(sid)["items"]
    assert workspace[0]["detail"] == "0 of 4 graded stages finished"
    assert workspace[0]["excerpt"] is None


def test_an_opened_run_with_no_prediction_is_not_listed_anywhere():
    sid = _preparation("Opened only", pack="adf")["id"]
    _attempt(sid, f"ab:{sid}:concurrency:r1:predict", "adf.lab.concurrency.predict", "adf.lab.concurrency")
    assert _workspace(sid)["items"] == []
    assert _evidence(sid)["items"] == []


# ---- scenarios ------------------------------------------------------------------------------------


def test_scenario_checks_are_answer_key_evidence_and_lens_notes_are_workspace():
    sid = _preparation("Scenarios", pack="adf")["id"]
    _scenario(sid)

    workspace = _workspace(sid)["items"]
    assert [i["kind"] for i in workspace] == ["scenario_notes"]
    notes = workspace[0]
    assert notes["title"] == "The missing lots"  # from the content pack, not invented
    assert notes["context"] == "PO lens"
    assert notes["href"] == "/scenarios/adf/1"
    assert "Who owns the watermark?" in notes["excerpt"]

    evidence = {i["kind"]: i for i in _evidence(sid)["items"]}
    check = evidence["scenario_check"]
    assert check["level"] == "demonstrated" and check["assessed_by"] == "answer_key"
    assert check["demonstrates"] == "Check question 1"
    lens = evidence["scenario_lens"]
    # Case notes are not graded: completed, never demonstrated, even with an explanation.
    assert lens["level"] == "completed" and lens["assessed_by"] == "not_assessed"


# ---- roadmap, interview, certification --------------------------------------------------------


def test_roadmap_and_interview_work_is_listed_and_self_assessment_stays_completed(db):
    sid = _preparation("Roadmap and interview")["id"]
    ids = _roadmap_work(db, sid, "R1")
    asked = _interview_work(db, sid, "I1")

    kinds = {i["kind"]: i for i in _workspace(sid)["items"]}
    assert set(kinds) == {"topic_guide", "topic_note", "interview_answer", "recording"}
    assert kinds["topic_guide"]["detail"] == "2 sections: 1 written by you, 1 AI draft"
    assert kinds["topic_guide"]["href"] == f"/roadmaps/{ids['roadmap']}/topics/{ids['topic']}/guide"
    assert kinds["topic_note"]["excerpt"] == "My notes on R1"
    assert kinds["interview_answer"]["excerpt"] == "My answer I1"
    assert kinds["interview_answer"]["detail"] == "2 key talking points"
    assert kinds["recording"]["href"] == f"/recordings/{asked['recording']}"
    assert kinds["recording"]["detail"] == "Not analysed"

    evidence = {i["kind"]: i for i in _evidence(sid)["items"]}
    demo = evidence["topic_demonstration"]
    assert demo["level"] == "completed" and demo["assessed_by"] == "self"
    assert "self-graded 'yes'" in demo["basis"]
    recording = evidence["recording"]
    assert recording["level"] == "completed" and recording["assessed_by"] == "not_assessed"


def test_a_mock_is_demonstrated_only_at_its_pass_mark_and_never_states_readiness(db):
    sid = _certification("Mocks")["id"]  # pass mark 80
    passed = _mock(db, sid, 85)
    below = _mock(db, sid, 60)
    # Judged by the preparation's pass mark, as the readiness engine judges it -- not by the
    # mark a session stored when it was sat. 88 against a stored 95 is still passed at 80.
    stored_higher = _mock(db, sid, 88, passing=95)

    items = {i["id"]: i for i in _evidence(sid)["items"]}
    assert items[f"mock:{passed}"]["level"] == "demonstrated"
    assert items[f"mock:{below}"]["level"] == "completed"
    assert "below the 80% pass mark" in items[f"mock:{below}"]["basis"]
    assert items[f"mock:{stored_higher}"]["level"] == "demonstrated"
    assert "80% pass mark" in items[f"mock:{stored_higher}"]["basis"]
    for item in items.values():
        assert item["assessed_by"] == "exam" and item["level"] != "evidenced"
        assert "Readiness to pass is decided on Certification" in item["basis"]
    # Mocks are evidence, not workspace work.
    assert _workspace(sid)["items"] == []


def test_a_drill_is_not_evidence(db):
    sid = _certification("Drills")["id"]
    db.add(ExamSession(title="Drill", exam_mode=ExamMode.PRACTICE, status=ExamStatus.COMPLETED, session_kind="drill",
                       subject_id=sid, source="learner", total_questions=5, score_percentage=100.0,
                       start_time=datetime(2026, 10, 1)))
    db.commit()
    assert _evidence(sid)["items"] == []


# ---- isolation ----------------------------------------------------------------------------------


def test_two_preparations_on_the_adf_pack_never_see_each_others_work(db):
    a = _preparation("ADF A", pack="adf")["id"]
    b = _preparation("ADF B", pack="adf")["id"]
    _adf_run(a)
    _scenario(a)
    _roadmap_work(db, a, "A")
    _interview_work(db, a, "A")

    assert _workspace(b)["items"] == []
    assert _evidence(b)["items"] == []
    assert _workspace(a)["items"] and _evidence(a)["items"]
    assert not any(str(b) in i["id"] for i in _workspace(a)["items"] if i["kind"] == "lab_run")


def test_different_subjects_are_isolated_both_ways(db):
    psm = _certification("PSM I")["id"]
    kafka = _certification("Kafka CCDAK")["id"]
    databricks = _preparation("Databricks")["id"]
    adf = _preparation("ADF", pack="adf")["id"]

    mock = _mock(db, psm, 90)
    _attempt(databricks, f"lk:{databricks}:semiconductor-v1@1:schema-enforcement", "lakehouse.c.schema-enforcement",
             "lakehouse.c.schema-enforcement", "pack=semiconductor-v1@1", prediction="refused",
             observed={"result": "refused", "ok": False}, completed=True, correct=True,
             explanation_text="Given a new column, the write is refused.")
    _adf_run(adf)

    # Kafka has 0 questions and no work: it shows nothing, never PSM I's mock.
    assert _evidence(kafka)["items"] == [] and _workspace(kafka)["items"] == []
    assert f"mock:{psm}" not in _ids(_evidence(kafka)["items"])
    assert f"mock:{mock}" in _ids(_evidence(psm)["items"])

    db_items, adf_items = _evidence(databricks)["items"], _evidence(adf)["items"]
    assert {i["kind"] for i in db_items} == {"lakehouse_challenge"}
    assert {i["kind"] for i in adf_items} == {"lab_stage"}
    assert not _ids(db_items) & _ids(adf_items)
    lakehouse = db_items[0]
    assert lakehouse["level"] == "evidenced"
    assert "real Delta engine" in lakehouse["basis"]
    assert {i["kind"] for i in _workspace(databricks)["items"]} == {"lakehouse_challenge"}
    assert {i["kind"] for i in _workspace(adf)["items"]} == {"lab_run"}


def test_no_preparation_means_work_with_no_owner_never_every_preparation(db):
    owned = _preparation("Owner", pack="adf")["id"]
    _adf_run(owned)
    _roadmap_work(db, owned, "owned")
    unowned_roadmap = _roadmap_work(db, None, "unowned")
    _interview_work(db, None, "library")
    _attempt(None, f"att_{uuid.uuid4().hex}", "wip-limit-1", "wip", prediction="option-a",
             completed=True, correct=True, explanation_text="More WIP, longer waits.")

    prompt = SystemDesignPrompt(title="Design a URL shortener", prompt_text="...")
    db.add(prompt)
    db.flush()
    db.add(SystemDesignAttempt(prompt_id=prompt.id, answer_text="Hash and store.", grading_status="graded"))
    review = DesignReview(title="Queue or stream", brief="b", deciding_axis="d", reveal="r", elicit_answer="e")
    db.add(review)
    db.flush()
    db.add(DesignReviewAttempt(review_id=review.id, choice="A", justification="Ordering matters.",
                               grading_status="not_graded"))
    db.commit()

    none_workspace = _workspace(None)
    assert none_workspace["subject_id"] is None
    kinds = {i["kind"] for i in none_workspace["items"]}
    assert {"system_design_answer", "design_review_call", "sandbox_run", "interview_answer", "recording",
            "topic_guide", "topic_note"} <= kinds
    # The owned ADF run is not here. (Checked by its own id: other tests may leave runs
    # that belong to no preparation, and those rightly are.)
    assert not any(i["id"].startswith(f"lab_run:{owned}:") for i in none_workspace["items"])
    assert all(":" not in i["id"] or f":{owned}:" not in i["id"] for i in none_workspace["items"])
    assert f"topic_guide:{unowned_roadmap['topic']}" in _ids(none_workspace["items"])

    none_evidence = _evidence(None)["items"]
    # Nothing of the owned preparation's -- its lab stages, its mocks -- by owner, not by kind:
    # other tests may leave unowned lab runs, and those rightly are here.
    assert not any(i["kind"] == "mock_exam" for i in none_evidence)
    assert not any(i["kind"] == "lab_stage" and i["ref"].get("track") and i["id"].find(f":{owned}:") >= 0 for i in none_evidence)
    sd = next(i for i in none_evidence if i["kind"] == "system_design")
    assert sd["level"] == "completed" and sd["assessed_by"] == "ai"  # AI-graded is not verified
    dr = next(i for i in none_evidence if i["kind"] == "design_review")
    assert dr["level"] == "completed" and dr["assessed_by"] == "not_assessed"
    sandbox = next(i for i in none_evidence if i["kind"] == "sandbox_prediction")
    assert sandbox["level"] == "evidenced"

    # And the owner sees its own work, none of the unowned formats.
    owner_kinds = {i["kind"] for i in _workspace(owned)["items"]}
    assert owner_kinds == {"lab_run", "topic_guide", "topic_note"}
    assert f"topic_guide:{unowned_roadmap['topic']}" not in _ids(_workspace(owned)["items"])


def test_a_deleted_preparations_work_does_not_follow_its_id(db):
    """A deleted preparation's rows lose their owner. A preparation created later --
    even one given the same id again -- does not inherit them."""
    old = _preparation("Deleted later", pack="adf")
    _adf_run(old["id"])
    _roadmap_work(db, old["id"], "gone")
    assert client.request("DELETE", f"/api/v1/subjects/{old['id']}",
                          json={"confirm_name": old["name"]}).status_code == 200

    newer = _preparation("Created after", pack="adf")["id"]
    assert _workspace(newer)["items"] == []
    assert _evidence(newer)["items"] == []
    # The old work is now in the no-preparation scope, labelled as such.
    orphaned = _ids(_workspace(None)["items"])
    assert any(i.startswith("lab_run:None:watermark") for i in orphaned)


# ---- read only --------------------------------------------------------------------------------


def test_reading_workspace_and_evidence_writes_nothing():
    sid = _preparation("Read only", pack="adf")["id"]
    _adf_run(sid)
    before = client.get(ATTEMPTS, params={"subject_id": sid}).json()
    for _ in range(2):
        _workspace(sid)
        _evidence(sid)
    assert client.get(ATTEMPTS, params={"subject_id": sid}).json() == before
    assert client.post("/api/v1/workspace").status_code == 405
    assert client.post("/api/v1/evidence").status_code == 405

def test_a_station_d_claim_is_worded_as_a_claim_not_a_prediction(db):
    # Station D records a defect the learner claims, backed by an engine result they cited, and checks it
    # against the pack's planted defects (P1-2). It is not a prediction checked against what the engine did.
    databricks = _preparation("Databricks")["id"]
    _attempt(databricks, f"lk:{databricks}:semiconductor-v1@1:d-precision", "lakehouse.d.precision",
             "lakehouse.d.precision", "pack=semiconductor-v1@1", prediction="precision",
             observed={"claim": "precision", "basis": "300 rows differ in yield_pct", "source": "engine", "ok": True},
             completed=True, correct=True)
    _attempt(databricks, f"lk:{databricks}:semiconductor-v1@1:i-identity-cutover", "lakehouse.i.identity-cutover",
             "lakehouse.i.identity-cutover", "pack=semiconductor-v1@1", prediction="tool-feed",
             observed={"failing_workload": "svc-tool-feed", "plans_that_work": 3, "source": "simulation"},
             completed=True, correct=True)
    by_challenge = {i["ref"]["challenge_id"]: i for i in _evidence(databricks)["items"]}
    claim = by_challenge["lakehouse.d.precision"]["basis"]
    assert "Prediction" not in claim
    assert "Defect claim checked against the pack's planted defects" in claim
    assert "engine result you cited" in claim
    # Station I is a simulation: its prediction is checked against the model.
    assert "Prediction checked against the model's simulation" in by_challenge["lakehouse.i.identity-cutover"]["basis"]
