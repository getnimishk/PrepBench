# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Interview sessions: a round, a few questions, least-practised first.

What these hold: the questions previewed are the questions asked; a take filed
under a session must answer one of its questions; a retake is kept beside the
first; the report reads the latest take of each question and averages analysed
takes only, saying why when there are none; and the library and the comparison
list count takes the same way.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db, register_sqlite_pragmas
from app.core.exceptions import InvalidExamStateException
from app.core.timeutils import utc_now_naive
from app.main import app
from app.models.interview_question import InterviewQuestion, InterviewRoundType
from app.models.practice_recording import PracticeRecording
from app.models.recording_analysis import RecordingAnalysis
from app.services.interview_rounds import ROUND_RULES
from app.services.interview_session_service import InterviewSessionService


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'iv.db'}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db, tmp_path, monkeypatch):
    """The API against this test's database, with uploads kept in tmp_path.

    Recordings are written to disk; pointing the directory at tmp_path keeps them
    out of backend/data, where the learner's own recordings live.
    """
    import app.api.v1.recordings as recordings_module

    monkeypatch.setattr(recordings_module, "RECORDINGS_DIR", tmp_path)

    def override():
        yield db

    app.dependency_overrides[get_db] = override
    try:
        yield TestClient(app)
    finally:
        from tests.conftest import override_get_db

        app.dependency_overrides[get_db] = override_get_db


def _question(db, round_type=InterviewRoundType.BEHAVIORAL, category="Leadership") -> InterviewQuestion:
    q = InterviewQuestion(round_type=round_type, question_text=f"Tell me about {uuid.uuid4().hex[:6]}", category=category)
    db.add(q)
    db.commit()
    return q


def _take(db, question, session_id=None, days_ago=0, duration=100, analysis=None) -> PracticeRecording:
    r = PracticeRecording(
        title="Take", file_path=f"{uuid.uuid4().hex}.webm", mime_type="audio/webm",
        duration_seconds=duration, file_size_bytes=10, interview_question_id=question.id,
        session_id=session_id, created_at=utc_now_naive() - timedelta(days=days_ago),
    )
    db.add(r)
    db.flush()
    if analysis is not None:
        db.add(RecordingAnalysis(recording_id=r.id, **analysis))
    db.commit()
    return r


def _analysed(content, delivery):
    return dict(
        analysis_status="analyzed", provider="fake", transcript="...",
        content_scores=[{"category": c, "score": s, "max_score": 10, "feedback": "."} for c, s in content],
        communication_scores=[{"category": c, "score": s, "max_score": 10, "feedback": "."} for c, s in delivery],
    )


# ---- choosing the questions ---------------------------------------------------------


def test_the_least_practised_questions_come_first_and_the_plan_is_what_is_asked(db):
    often = _question(db)
    once_long_ago = _question(db)
    once_recently = _question(db)
    never = _question(db)
    _take(db, often, days_ago=3)
    _take(db, often, days_ago=2)
    _take(db, once_long_ago, days_ago=30)
    _take(db, once_recently, days_ago=1)
    service = InterviewSessionService(db)

    planned = [q["id"] for q in service.plan(InterviewRoundType.BEHAVIORAL, None, 3)]
    created = service.create(InterviewRoundType.BEHAVIORAL, None, 3, thinking=True)

    assert planned == [never.id, once_long_ago.id, once_recently.id]
    assert [q["id"] for q in created["questions"]] == planned
    assert created["thinking_seconds"] == ROUND_RULES["behavioral"]["thinking_seconds"]


def test_general_session_anchors_with_introduction_question_first(db):
    intro = _question(db, category="Introduction")
    q1 = _question(db, category="Leadership")
    q2 = _question(db, category="Conflict")
    # Even if intro was practised before, an open/general session starts with an introduction
    _take(db, intro, days_ago=5)

    service = InterviewSessionService(db)
    planned = [q["id"] for q in service.plan(InterviewRoundType.BEHAVIORAL, None, 2)]
    assert planned[0] == intro.id
    assert planned[1] in [q1.id, q2.id]


def test_no_thinking_time_when_it_is_turned_off(db):
    _question(db)
    session = InterviewSessionService(db).create(InterviewRoundType.BEHAVIORAL, None, 1, thinking=False)
    assert session["thinking_seconds"] == 0


def test_a_category_narrows_the_session_and_an_empty_one_is_refused_by_name(db):
    lead = _question(db, category="Leadership")
    _question(db, category="Conflict")
    service = InterviewSessionService(db)

    session = service.create(InterviewRoundType.BEHAVIORAL, "Leadership", 5, thinking=True)
    assert [q["id"] for q in session["questions"]] == [lead.id]

    with pytest.raises(InvalidExamStateException, match="no System Design questions yet"):
        service.create(InterviewRoundType.SYSTEM_DESIGN, None, 3, thinking=True)


# ---- takes -------------------------------------------------------------------------------


def test_a_take_must_answer_one_of_the_sessions_questions(db, client):
    asked = _question(db)
    elsewhere = _question(db)
    session = InterviewSessionService(db).create(InterviewRoundType.BEHAVIORAL, "Leadership", 1, thinking=True)
    assert session["questions"][0]["id"] in (asked.id, elsewhere.id)
    in_session = session["questions"][0]["id"]
    not_in_session = elsewhere.id if in_session == asked.id else asked.id

    def upload(question_id, session_id=session["id"], note=None):
        data = {"title": "Take", "duration_seconds": "95", "interview_question_id": str(question_id), "session_id": str(session_id)}
        if note is not None:
            data["plan_note"] = note
        return client.post("/api/v1/recordings", data=data, files={"file": ("a.webm", b"audio-bytes", "audio/webm")})

    ok = upload(in_session, note="  S → T → A → R  ")
    assert ok.status_code == 201, ok.text
    assert ok.json()["session_id"] == session["id"]
    assert ok.json()["plan_note"] == "S → T → A → R"

    assert upload(not_in_session).status_code == 400
    assert upload(in_session, session_id=424242).status_code == 404


def test_a_retake_is_kept_beside_the_first_take(db):
    q = _question(db)
    service = InterviewSessionService(db)
    session = service.create(InterviewRoundType.BEHAVIORAL, None, 1, thinking=True)
    first = _take(db, q, session_id=session["id"], days_ago=0)
    second = _take(db, q, session_id=session["id"], days_ago=0)

    takes = service.get(session["id"])["questions"][0]["takes"]

    assert [t["recording_id"] for t in takes] == [first.id, second.id]
    assert all(t["analysis_status"] is None and t["content_percent"] is None for t in takes)


# ---- the report ----------------------------------------------------------------------------


def test_the_report_reads_the_latest_take_and_names_the_weakest_category(db):
    a = _question(db)
    b = _question(db)
    service = InterviewSessionService(db)
    session = service.create(InterviewRoundType.BEHAVIORAL, None, 2, thinking=True)
    _take(db, a, session_id=session["id"], duration=60, analysis=_analysed(
        [("STAR Structure", 2), ("Outcome/Impact", 2)], [("Clarity", 2)]))
    _take(db, a, session_id=session["id"], duration=120, analysis=_analysed(   # the retake is what counts
        [("STAR Structure", 8), ("Outcome/Impact", 4)], [("Clarity", 6)]))
    _take(db, b, session_id=session["id"], duration=100, analysis=_analysed(
        [("STAR Structure", 6), ("Outcome/Impact", 6)], [("Clarity", 8)]))

    report = service.report(session["id"])

    assert (report["answered"], report["analysed"], report["total_questions"]) == (2, 2, 2)
    assert report["spoken_seconds"] == 220
    assert report["content_percent"] == 60.0          # (60 + 60) / 2
    assert report["delivery_percent"] == 70.0         # (60 + 80) / 2
    assert report["weakest_category"] == "Outcome/Impact"
    assert report["weakest_category_percent"] == 50.0
    assert report["not_graded_reason"] is None


def test_an_ungraded_session_says_why_and_reports_no_scores(db):
    q = _question(db)
    service = InterviewSessionService(db)
    session = service.create(InterviewRoundType.BEHAVIORAL, None, 1, thinking=True)
    _take(db, q, session_id=session["id"], analysis=dict(analysis_status="unavailable", analysis_error="No provider"))

    report = service.report(session["id"])

    assert report["answered"] == 1 and report["analysed"] == 0
    assert report["content_percent"] is None and report["delivery_percent"] is None
    assert report["weakest_category"] is None
    assert "not graded" in report["not_graded_reason"]


def test_finishing_is_idempotent(db):
    _question(db)
    service = InterviewSessionService(db)
    session = service.create(InterviewRoundType.BEHAVIORAL, None, 1, thinking=True)

    first = service.finish(session["id"])["ended_at"]
    again = service.finish(session["id"])["ended_at"]

    assert first is not None and first == again


# ---- the library and the comparison -------------------------------------------------------------


def test_the_library_counts_takes_and_the_takes_of_one_question_can_be_listed(db, client):
    q = _question(db)
    other = _question(db)
    _take(db, q, analysis=_analysed([("STAR Structure", 7)], [("Clarity", 9)]))
    _take(db, q, analysis=dict(analysis_status="unavailable"))
    _take(db, other)

    items = client.get("/api/v1/interview-questions", params={"round_type": "behavioral"}).json()["items"]
    counts = {item["id"]: item["practice_count"] for item in items}
    assert counts[q.id] == 2 and counts[other.id] == 1

    takes = client.get("/api/v1/recordings", params={"interview_question_id": q.id}).json()["items"]
    assert len(takes) == 2 and all(t["interview_question_id"] == q.id for t in takes)
    # Newest first; the ungraded take has a status and no invented score.
    assert [(t["analysis_status"], t["content_percent"], t["delivery_percent"]) for t in takes] == [
        ("unavailable", None, None), ("analyzed", 70.0, 90.0),
    ]


def test_each_round_says_how_long_a_good_answer_runs(client):
    rounds = {r["value"]: r for r in client.get("/api/v1/interview-questions/round-types").json()}

    behavioral = rounds["behavioral"]
    assert (behavioral["target_min_seconds"], behavioral["target_max_seconds"]) == ROUND_RULES["behavioral"]["target_seconds"]
    assert "STAR Structure" in behavioral["content_categories"]
    assert rounds["system_design"]["thinking_seconds"] == 60


def test_the_session_api_plans_creates_reports_and_finishes(db, client):
    _question(db)

    planned = client.get("/api/v1/interview-sessions/plan", params={"round_type": "behavioral", "question_count": 1}).json()
    created = client.post("/api/v1/interview-sessions", json={"round_type": "behavioral", "question_count": 1})
    assert created.status_code == 201, created.text
    session = created.json()
    assert [q["id"] for q in session["questions"]] == [q["id"] for q in planned]

    assert client.get(f"/api/v1/interview-sessions/{session['id']}/report").json()["answered"] == 0
    assert client.post(f"/api/v1/interview-sessions/{session['id']}/finish").json()["ended_at"] is not None
    assert client.get("/api/v1/interview-sessions/424242").status_code == 404
    assert client.post("/api/v1/interview-sessions", json={"round_type": "hr_screening"}).status_code == 400
