# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The profile: a name and email to show, the machine's timezone, and counts read
from the practice data -- nothing kept on the side, nothing invented.
"""
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func

from app.main import app
from app.models.exam_session import ExamSession, ExamStatus
from app.models.practice_recording import PracticeRecording
from app.models.question import Question
from app.models.settings import AppSettings
from app.models.subject import Subject
from tests.conftest import TestingSessionLocal

client = TestClient(app)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def created(db):
    """Rows a test adds, removed afterwards so no other test counts them."""
    rows = []
    yield rows
    for row in rows:
        db.delete(db.merge(row))
    db.commit()


@pytest.fixture
def clean_profile():
    """Leaves the settings row's name and email as the test found them."""
    before = client.get("/api/v1/profile").json()
    yield
    client.put("/api/v1/profile", json={"display_name": before["display_name"] or "", "email": before["email"] or ""})


def _local_noon_as_utc(day: date) -> datetime:
    """A stored (naive UTC) timestamp that falls on `day` in this machine's timezone."""
    return datetime(day.year, day.month, day.day, 12).astimezone().astimezone(UTC).replace(tzinfo=None)


def test_nobody_is_named_until_the_learner_writes_a_name(db, clean_profile):
    client.put("/api/v1/profile", json={"display_name": "", "email": ""})

    profile = client.get("/api/v1/profile").json()

    assert profile["display_name"] is None and profile["email"] is None


def test_name_and_email_are_saved_trimmed_and_blank_clears_them(db, clean_profile):
    saved = client.put("/api/v1/profile", json={"display_name": "  Ada Lovelace ", "email": " ada@example.com "})
    assert saved.status_code == 200
    assert saved.json()["display_name"] == "Ada Lovelace"
    assert saved.json()["email"] == "ada@example.com"

    # Omitting a field leaves it alone.
    renamed = client.put("/api/v1/profile", json={"display_name": "Ada"}).json()
    assert renamed["display_name"] == "Ada" and renamed["email"] == "ada@example.com"

    cleared = client.put("/api/v1/profile", json={"email": "   "}).json()
    assert cleared["email"] is None and cleared["display_name"] == "Ada"

    stored = db.get(AppSettings, 1)
    assert (stored.display_name, stored.email) == ("Ada", None)


@pytest.mark.parametrize("body", [
    {"email": "not an email"},
    {"email": "missing-at.example.com"},
    {"display_name": "x" * 101},
])
def test_what_cannot_be_a_name_or_an_email_is_rejected(clean_profile, body):
    assert client.put("/api/v1/profile", json=body).status_code == 422


def test_the_timezone_is_this_machines_clock():
    reported = client.get("/api/v1/profile").json()["timezone"]
    offset = datetime.now().astimezone().utcoffset()

    assert reported["utc_offset_minutes"] == int(offset.total_seconds() // 60)
    assert reported["name"]


def test_the_counts_are_read_from_the_practice_data(db):
    stats = client.get("/api/v1/profile").json()["stats"]

    assert stats["preparations"] == db.query(func.count(Subject.id)).filter(Subject.is_archived.is_(False)).scalar()
    assert stats["questions"] == db.query(func.count(Question.id)).scalar()
    assert stats["mocks_taken"] == db.query(func.count(ExamSession.id)).filter(
        ExamSession.session_kind == "mock", ExamSession.source == "learner",
        ExamSession.status == ExamStatus.COMPLETED,
    ).scalar()
    assert stats["interview_answers"] == (db.query(func.count(PracticeRecording.id)).scalar() or 0)
    assert "study_hours" in stats


def test_a_finished_learner_mock_is_a_mock_taken_and_an_unfinished_or_sample_one_is_not(db, created):
    before = client.get("/api/v1/profile").json()["stats"]["mocks_taken"]
    created.extend([
        ExamSession(title="Finished", session_kind="mock", source="learner", status=ExamStatus.COMPLETED,
                    total_questions=1),
        ExamSession(title="Abandoned", session_kind="mock", source="learner", status=ExamStatus.IN_PROGRESS,
                    total_questions=1),
        ExamSession(title="Sample", session_kind="mock", source="test", status=ExamStatus.COMPLETED,
                    total_questions=1),
        ExamSession(title="Drill", session_kind="drill", source="learner", status=ExamStatus.COMPLETED,
                    total_questions=1),
    ])
    db.add_all(created)
    db.commit()

    assert client.get("/api/v1/profile").json()["stats"]["mocks_taken"] == before + 1


def test_days_active_counts_distinct_local_days_of_recorded_activity(db, created):
    before = client.get("/api/v1/profile").json()["stats"]
    first, second = date(1990, 3, 1), date(1990, 3, 4)
    created.extend([
        ExamSession(title="Day one", session_kind="drill", source="learner", status=ExamStatus.COMPLETED,
                    total_questions=1, start_time=_local_noon_as_utc(first)),
        # The same day again, from another kind of activity: still one day.
        PracticeRecording(title="Day one take", file_path="day-one.webm",
                          created_at=_local_noon_as_utc(first) + timedelta(hours=2)),
        PracticeRecording(title="Day two take", file_path="day-two.webm", created_at=_local_noon_as_utc(second)),
        # A paper the learner did not sit is not a day they were active.
        ExamSession(title="Sample", session_kind="mock", source="test", status=ExamStatus.COMPLETED,
                    total_questions=1, start_time=_local_noon_as_utc(date(1990, 2, 1))),
    ])
    db.add_all(created)
    db.commit()

    after = client.get("/api/v1/profile").json()["stats"]

    assert after["days_active"] == before["days_active"] + 2
    assert after["active_since"] == "1990-03-01"


def test_a_session_just_after_local_midnight_counts_on_the_local_day(db, created):
    """Stored timestamps are UTC; the day is the one the clock here showed."""
    day = date(1989, 6, 10)
    just_after_midnight = datetime(day.year, day.month, day.day, 0, 30).astimezone().astimezone(UTC).replace(tzinfo=None)
    created.append(PracticeRecording(title="Late take", file_path="late.webm", created_at=just_after_midnight))
    db.add_all(created)
    db.commit()

    assert client.get("/api/v1/profile").json()["stats"]["active_since"] == "1989-06-10"


def test_storage_measures_the_database_file_in_use():
    storage = client.get("/api/v1/profile").json()["storage"]
    database = client.get("/api/v1/system/storage").json()["database"]

    assert database["path"].endswith("test_exam_simulator.db")
    assert storage["database_bytes"] >= database["size_bytes"] > 0
    assert storage["recordings_bytes"] >= 0
