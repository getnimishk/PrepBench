# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_review_fixes.py

Regression coverage for the issues found in the project-wide code review:
exam duration accounting, local-vs-UTC day boundaries, the immutable
first-answered timestamp, upload guards, and migration failure logging.
"""

import uuid
import pytest
from datetime import datetime, timedelta, UTC
from fastapi.testclient import TestClient

from app.main import app
from app.core.timeutils import (
    local_day_start_as_naive_utc, local_today, to_local_date, utc_now_naive,
)
from app.models.exam_session import ExamSession
from app.models.exam_answer import ExamAnswer
from app.models.question import Question
from app.models.option import QuestionOption
from app.models.spaced_repetition import SpacedRepetition
from tests.conftest import TestingSessionLocal

client = TestClient(app)


@pytest.fixture
def cleanup():
    created = {"session_ids": [], "question_ids": []}
    yield created
    db = TestingSessionLocal()
    try:
        if created["session_ids"]:
            db.query(ExamAnswer).filter(ExamAnswer.session_id.in_(created["session_ids"])).delete(synchronize_session=False)
            db.query(ExamSession).filter(ExamSession.id.in_(created["session_ids"])).delete(synchronize_session=False)
        if created["question_ids"]:
            db.query(ExamAnswer).filter(ExamAnswer.question_id.in_(created["question_ids"])).delete(synchronize_session=False)
            db.query(SpacedRepetition).filter(SpacedRepetition.question_id.in_(created["question_ids"])).delete(synchronize_session=False)
            db.query(QuestionOption).filter(QuestionOption.question_id.in_(created["question_ids"])).delete(synchronize_session=False)
            db.query(Question).filter(Question.id.in_(created["question_ids"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _question(cleanup, cert: str) -> dict:
    res = client.post("/api/v1/questions", json={
        "text": f"Review fix probe {uuid.uuid4().hex}",
        "question_type": "single_choice",
        "certification": cert,
        "options": [
            {"option_text": "Right", "is_correct": True, "order_index": 0},
            {"option_text": "Wrong", "is_correct": False, "order_index": 1},
        ],
    })
    assert res.status_code == 201
    payload = res.json()
    cleanup["question_ids"].append(payload["id"])
    return payload


def _start_exam(cleanup, cert: str) -> int:
    res = client.post("/api/v1/exams", json={
        "exam_mode": "custom", "certification": cert,
        "total_questions": 1, "randomize_questions": False,
    })
    assert res.status_code == 201
    session_id = res.json()["id"]
    cleanup["session_ids"].append(session_id)
    return session_id


# ================================================== exam duration accounting

def test_duration_is_summed_per_question_time_not_wall_clock(cleanup):
    """
    Practice mode is untimed by design, so a session can legitimately sit open
    for days. Recording end_time - start_time as "time spent" turned every
    idle hour into study time in the History column and both exports.
    """
    cert = uuid.uuid4().hex
    question = _question(cleanup, cert)
    session_id = _start_exam(cleanup, cert)

    correct_id = next(o["id"] for o in question["options"] if o["is_correct"])
    client.post(f"/api/v1/exams/{session_id}/answer", json={
        "question_id": question["id"],
        "selected_option_ids": [correct_id],
        "time_spent_seconds": 42,
    })

    # Backdate the start so wall-clock elapsed is enormous compared to the 42
    # seconds actually spent answering.
    db = TestingSessionLocal()
    try:
        session = db.query(ExamSession).filter(ExamSession.id == session_id).first()
        session.start_time = utc_now_naive() - timedelta(days=3)
        db.commit()
    finally:
        db.close()

    finished = client.post(f"/api/v1/exams/{session_id}/finish").json()

    assert finished["time_spent_seconds"] == 42
    assert finished["time_spent_seconds"] < 3 * 24 * 3600


def test_finishing_twice_does_not_restamp_end_time_or_duration(cleanup):
    cert = uuid.uuid4().hex
    question = _question(cleanup, cert)
    session_id = _start_exam(cleanup, cert)
    correct_id = next(o["id"] for o in question["options"] if o["is_correct"])
    client.post(f"/api/v1/exams/{session_id}/answer", json={
        "question_id": question["id"], "selected_option_ids": [correct_id], "time_spent_seconds": 10,
    })

    first = client.post(f"/api/v1/exams/{session_id}/finish").json()
    second = client.post(f"/api/v1/exams/{session_id}/finish").json()

    assert second["end_time"] == first["end_time"]
    assert second["time_spent_seconds"] == first["time_spent_seconds"] == 10
    assert second["correct_count"] == first["correct_count"]


# ============================================================ time utilities

def test_local_day_start_precedes_now_and_converts_back_to_today():
    day_start = local_day_start_as_naive_utc()
    assert day_start <= utc_now_naive()
    assert to_local_date(day_start) == local_today()


def test_local_day_start_differs_from_utc_midnight_off_utc():
    """
    On a UTC machine the two coincide and this asserts nothing interesting;
    anywhere else they must differ, which is exactly the bug being guarded.
    """
    day_start = local_day_start_as_naive_utc()
    utc_midnight = datetime.now(UTC).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
    offset = datetime.now().astimezone().utcoffset() or timedelta(0)
    if offset == timedelta(0):
        assert day_start == utc_midnight
    else:
        assert day_start != utc_midnight


# ========================================= today's practice count correctness

def test_re_saving_an_answer_does_not_move_its_first_answered_timestamp(cleanup):
    """
    answered_at carries onupdate=, so paging back through a week-old exam
    re-stamps its rows to now. first_answered_at is set once, which is what
    makes it usable as the moment a question was genuinely first attempted.

    The daily-practice count that this column was added for has been removed
    along with the streak and the goal ring it fed. The column is still
    written on every answer, so the immutability it promises still has to
    hold -- but it is now asserted directly rather than through a projection
    that no longer exists.
    """
    cert = uuid.uuid4().hex
    question = _question(cleanup, cert)
    session_id = _start_exam(cleanup, cert)
    correct_id = next(o["id"] for o in question["options"] if o["is_correct"])

    client.post(f"/api/v1/exams/{session_id}/answer", json={
        "question_id": question["id"], "selected_option_ids": [correct_id], "time_spent_seconds": 5,
    })

    # Age the answer by a week, as if it had been answered then.
    week_ago = utc_now_naive() - timedelta(days=7)
    db = TestingSessionLocal()
    try:
        answer = db.query(ExamAnswer).filter(ExamAnswer.session_id == session_id).first()
        answer.first_answered_at = week_ago
        answer.answered_at = week_ago
        db.commit()
    finally:
        db.close()

    # Re-save it exactly as navigating back to it would -- with a *different*
    # time_spent_seconds, because that is what really happens (the client
    # measures a fresh duration on each visit). Re-sending byte-identical
    # values would leave SQLAlchemy with no net change, emit no UPDATE, and
    # never fire onupdate, so the bug would not reproduce.
    client.post(f"/api/v1/exams/{session_id}/answer", json={
        "question_id": question["id"], "selected_option_ids": [correct_id], "time_spent_seconds": 11,
    })

    db = TestingSessionLocal()
    try:
        answer = db.query(ExamAnswer).filter(ExamAnswer.session_id == session_id).first()
        # answered_at moved (it tracks last touch); first_answered_at did not.
        assert to_local_date(answer.first_answered_at) == to_local_date(week_ago)
        assert to_local_date(answer.first_answered_at) != local_today()
    finally:
        db.close()


# ============================================================ upload guards

def test_recording_upload_rejects_a_non_audio_content_type():
    res = client.post("/api/v1/recordings", files={"file": ("x.html", b"<script>alert(1)</script>", "text/html")})
    assert res.status_code == 400
    assert "audio" in res.json()["detail"].lower()


def test_recording_upload_rejects_an_oversized_file():
    from app.api.v1.recordings import MAX_RECORDING_BYTES
    oversized = b"\0" * (MAX_RECORDING_BYTES + 1)
    res = client.post("/api/v1/recordings", files={"file": ("big.webm", oversized, "audio/webm")})
    assert res.status_code == 413


def test_recording_upload_accepts_codec_qualified_audio_types():
    """MediaRecorder emits 'audio/webm;codecs=opus' -- the parameter must not
    cause a false rejection."""
    res = client.post("/api/v1/recordings", files={"file": ("a.webm", b"fake-audio", "audio/webm;codecs=opus")})
    assert res.status_code == 201
    body = res.json()
    assert body["mime_type"] == "audio/webm"
    client.delete(f"/api/v1/recordings/{body['id']}")


# ====================================================== migration visibility

def test_migration_failures_are_logged_not_swallowed(caplog):
    """
    A failed step must be visible. Silently swallowing turns a schema problem
    into a confusing 'no such column' far from its cause.
    """
    from app.core import database

    try:
        with caplog.at_level("ERROR"):
            database._log_migration_failure("some_step", RuntimeError("boom"))
        assert any("some_step" in r.message and "boom" in r.message for r in caplog.records)
    finally:
        database._migration_failures.clear()


def test_a_failed_migration_stops_startup():
    """
    Logging alone was not enough. The remaining steps still ran and the app
    still served requests against a half-upgraded database, so the schema
    problem reappeared later as a baffling error a long way from its cause.

    A product whose whole argument is that its numbers are trustworthy should
    not serve numbers it cannot compute.
    """
    from app.core import database

    try:
        database._log_migration_failure("some_step", RuntimeError("boom"))
        with pytest.raises(database.MigrationFailedError) as raised:
            database._raise_if_migrations_failed()
        assert "some_step" in str(raised.value)
        assert "partially upgraded" in str(raised.value)
    finally:
        database._migration_failures.clear()


def test_a_clean_migration_run_does_not_raise():
    """The guard must not turn a normal startup into a failure."""
    from app.core import database

    database._migration_failures.clear()
    database._raise_if_migrations_failed()
