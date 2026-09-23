# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Settings, storage, backups, the About report and derived notifications.

What these hold: settings change only what is sent and refuse values no screen
can show; the storage report describes the database actually in use; a backup
is a real SQLite file with the data in it; the About report says which tasks
would send data off the machine; and each notification appears from real
evidence, clears when its condition does, and can be switched off.
"""
from __future__ import annotations

import sqlite3
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db, register_sqlite_pragmas
from app.core.timeutils import utc_now_naive
from app.main import app
from app.models.exam_answer import ConfidenceLevel, ExamAnswer
from app.models.exam_session import ExamMode, ExamSession, ExamStatus
from app.models.llm_config import LLMProviderConfig
from app.models.question import Question
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject import Subject, SubjectKind
from app.services.notification_service import NotificationService
from app.services.sm2_service import SM2Service
from app.services.system_service import SystemService


@pytest.fixture
def db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'system.db'}", connect_args={"check_same_thread": False}
    )
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db):
    def override():
        yield db

    app.dependency_overrides[get_db] = override
    try:
        yield TestClient(app)
    finally:
        from tests.conftest import override_get_db

        app.dependency_overrides[get_db] = override_get_db


def _subject(db, name: str, pass_mark: float | None = 85.0, **over) -> Subject:
    subject = Subject(
        name=name, slug=f"{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}",
        kind=SubjectKind.CERTIFICATION if pass_mark is not None else SubjectKind.SKILL,
        certification=f"{name} cert {uuid.uuid4().hex[:6]}" if pass_mark is not None else None,
        pass_mark=pass_mark,
        exam_question_count=10 if pass_mark is not None else None,
        exam_minutes=30 if pass_mark is not None else None,
        **over,
    )
    db.add(subject)
    db.commit()
    return subject


def _question(db, subject: Subject, **over) -> Question:
    fields = dict(
        text=f"Q {uuid.uuid4().hex[:8]}", question_type="single_choice", difficulty="medium",
        domain="Scrum Events", topic="Sprint Review", certification=subject.certification or "General Prep",
        subject_id=subject.id,
    )
    q = Question(**{**fields, **over})
    db.add(q)
    db.commit()
    return q


def _mock(db, subject: Subject, score: float, wrong: int = 0, days_ago: int = 0) -> ExamSession:
    ended = utc_now_naive() - timedelta(days=days_ago)
    questions = [_question(db, subject) for _ in range(max(wrong, 1))]
    session = ExamSession(
        title="Mock", exam_mode=ExamMode.TIMED, status=ExamStatus.COMPLETED, session_kind="mock",
        source="learner", subject_id=subject.id, certification=subject.certification,
        total_questions=len(questions), question_ids_order=[q.id for q in questions],
        score_percentage=score, start_time=ended - timedelta(hours=1), end_time=ended,
    )
    db.add(session)
    db.flush()
    for i, q in enumerate(questions):
        db.add(ExamAnswer(
            session_id=session.id, question_id=q.id, selected_option_ids=[1],
            is_correct=not (i < wrong), time_spent_seconds=10, confidence_level=ConfidenceLevel.NOT_SET,
        ))
    db.commit()
    return session


def _triggers(client, **values):
    response = client.put("/api/v1/settings", json={"notification_triggers": values})
    assert response.status_code == 200, response.text
    return response.json()


# ---- settings -------------------------------------------------------------------------------


def test_settings_change_only_what_is_sent(client):
    client.put("/api/v1/settings", json={"review_daily_cap": 35, "default_target_role": "Staff engineer"})

    changed = client.put("/api/v1/settings", json={"theme": "system"}).json()

    assert changed["theme"] == "system"
    assert changed["review_daily_cap"] == 35
    assert changed["default_target_role"] == "Staff engineer"


def test_settings_refuse_values_no_screen_can_show(client):
    for body in ({"theme": "blue"}, {"text_size": "huge"}, {"reduce_motion": "sometimes"},
                 {"notification_triggers": {"streaks": True}}, {"review_daily_cap": 0}):
        assert client.put("/api/v1/settings", json=body).status_code == 422, body


def test_display_preferences_and_shortcuts_are_kept(client):
    saved = client.put("/api/v1/settings", json={
        "text_size": "large", "reduce_motion": "always", "shortcuts_enabled": False,
    }).json()
    assert (saved["text_size"], saved["reduce_motion"], saved["shortcuts_enabled"]) == ("large", "always", False)
    assert client.get("/api/v1/settings").json()["text_size"] == "large"


def test_triggers_start_from_their_defaults_and_merge(client):
    fresh = client.get("/api/v1/settings").json()["notification_triggers"]
    assert fresh == {
        "review_due": True, "mock_below_pass": True, "evidence_stale": True,
        "roadmap_slipping": True, "import_unreviewed": False,
    }

    after = _triggers(client, review_due=False)["notification_triggers"]
    assert after["review_due"] is False
    assert after["mock_below_pass"] is True  # untouched

    after = _triggers(client, import_unreviewed=True)["notification_triggers"]
    assert after["review_due"] is False  # still off
    assert after["import_unreviewed"] is True


def test_an_old_theme_value_reads_as_the_default(db, client):
    from app.repositories.settings_repository import SettingsRepository

    row = SettingsRepository(db).get_or_create()
    row.theme = "sepia"
    db.commit()

    assert client.get("/api/v1/settings").json()["theme"] == "light"


# ---- storage and backup -----------------------------------------------------------------------


def test_storage_describes_the_database_actually_in_use(db, client, tmp_path):
    psm = _subject(db, "PSM")
    _mock(db, psm, score=70.0, wrong=2)
    db.add(Question(text="Unowned", question_type="single_choice", difficulty="medium",
                    domain="General", topic="General", certification="General Prep"))
    db.commit()

    report = client.get("/api/v1/system/storage").json()

    assert report["database"]["engine"] == "sqlite"
    assert report["database"]["path"] == str((tmp_path / "system.db").resolve())
    assert report["database"]["size_bytes"] > 0
    assert report["database"]["backup_supported"] is True
    assert report["counts"]["questions"] == 3
    assert report["counts"]["exam_sessions"] == 1
    assert report["unassigned_questions"] == 1
    mine = next(p for p in report["preparations"] if p["subject_id"] == psm.id)
    assert (mine["questions"], mine["sessions"], mine["answers"]) == (2, 1, 2)


def test_a_backup_is_a_sqlite_file_with_the_data_in_it(db, client, tmp_path):
    psm = _subject(db, "PSM")
    _question(db, psm, text="Kept in the backup")

    response = client.get("/api/v1/system/backup")

    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith('attachment; filename="prepbench-backup-')
    restored = tmp_path / "restored.db"
    restored.write_bytes(response.content)
    with sqlite3.connect(restored) as copy:
        texts = [row[0] for row in copy.execute("SELECT text FROM questions")]
        tables = {row[0] for row in copy.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert texts == ["Kept in the backup"]
    # The provider table is there; the keys are not, because they were never in it.
    assert "llm_provider_config" in tables


# ---- about ---------------------------------------------------------------------------------------


def test_about_says_which_tasks_would_leave_the_machine(db, monkeypatch):
    from tests.llm_fakes import clear_env_provider

    # Only the providers below: none from this machine's environment.
    clear_env_provider(monkeypatch)
    local = LLMProviderConfig(name="Laptop Ollama", profile_key="ollama", base_url="http://127.0.0.1:11434",
                              default_text_model="llama3.1:8b", is_enabled=True)
    db.add(local)
    db.commit()

    about = SystemService(db).about()
    assert about.telemetry is False
    assert about.data_leaving == []
    assert next(p for p in about.providers if p.name == "Laptop Ollama").is_local is True

    cloud = LLMProviderConfig(name="Gemini", profile_key="gemini", api_key_ref="file:abc",
                              default_text_model="gemini-2.5-flash", is_enabled=True)
    db.add(cloud)
    db.delete(local)
    db.commit()

    about = SystemService(db).about()
    assert about.key_storage == ["file"]
    assert {d.provider for d in about.data_leaving} == {"Gemini"}
    assert any(d.task == "System Design grading" for d in about.data_leaving)


def test_the_review_schedule_is_read_from_the_engine(client):
    rules = client.get("/api/v1/system/review-schedule").json()
    assert rules["algorithm"] == "SM-2"
    assert rules["starting_ease"] == SM2Service.STARTING_EASE
    assert rules["first_interval_days"] == SM2Service.FIRST_INTERVAL_DAYS
    assert rules["second_interval_days"] == SM2Service.SECOND_INTERVAL_DAYS
    assert rules["grades"] == {"again": 2, "hard": 3, "good": 4, "easy": 5}


# ---- notifications -------------------------------------------------------------------------------


def test_nothing_to_do_means_no_notifications(db):
    _subject(db, "Quiet")
    assert NotificationService(db).list().items == []


def test_unreviewed_misses_and_due_reviews_raise_one_each_and_clear_when_done(db):
    psm = _subject(db, "PSM")
    mock = _mock(db, psm, score=90.0, wrong=2)
    due_q = _question(db, psm)
    db.add(SpacedRepetition(question_id=due_q.id, repetition=1, interval_days=1, ease_factor=2.5,
                            next_review_date=utc_now_naive() - timedelta(days=1)))
    db.commit()

    items = NotificationService(db).list().items
    misses = next(n for n in items if n.id == f"review_misses:{psm.id}")
    assert misses.count == 2 and misses.action_path == "/review"
    assert next(n for n in items if n.id == f"review_due:{psm.id}").count == 1

    for answer in db.query(ExamAnswer).filter(ExamAnswer.session_id == mock.id):
        answer.reviewed_at = utc_now_naive()
    db.commit()

    assert f"review_misses:{psm.id}" not in [n.id for n in NotificationService(db).list().items]


def test_a_latest_mock_below_the_pass_mark_is_a_warning_that_links_to_it(db):
    psm = _subject(db, "PSM", pass_mark=85.0)
    _mock(db, psm, score=90.0, days_ago=3)
    latest = _mock(db, psm, score=72.0, days_ago=1)

    below = next(n for n in NotificationService(db).list().items if n.trigger == "mock_below_pass")

    assert below.severity == "warning"
    assert "72% against a 85% pass mark" in below.detail
    assert below.action_path == f"/exam-review/{latest.id}"

    _mock(db, psm, score=88.0)
    assert not any(n.trigger == "mock_below_pass" for n in NotificationService(db).list().items)


def test_stale_evidence_says_how_old_it_is(db):
    psm = _subject(db, "PSM")
    _mock(db, psm, score=90.0, days_ago=20)

    stale = next(n for n in NotificationService(db).list().items if n.trigger == "evidence_stale")
    assert "20 days ago" in stale.detail
    assert stale.action_path == f"/exam-setup?kind=mock&subject={psm.id}"


def test_recent_imports_left_unreviewed_are_mentioned_only_when_turned_on(db, client):
    psm = _subject(db, "PSM")
    now = utc_now_naive()
    _question(db, psm, created_at=now - timedelta(days=3))           # recent, unreviewed: counts
    _question(db, psm, created_at=now - timedelta(hours=2))          # too new to nag about
    _question(db, psm, created_at=now - timedelta(days=90))          # the bank, not an import
    _question(db, psm, created_at=now - timedelta(days=3), is_reviewed=True)

    assert not any(n.trigger == "import_unreviewed" for n in NotificationService(db).list().items)

    _triggers(client, import_unreviewed=True)
    pending = next(n for n in NotificationService(db).list().items if n.trigger == "import_unreviewed")
    assert pending.count == 1


def test_a_roadmap_projected_past_the_exam_date_is_a_warning(db):
    exam = date.today() + timedelta(days=10)
    psm = _subject(db, "PSM", target_exam_date=exam)
    roadmap = Roadmap(title="PSM plan", subject_id=psm.id, start_date=date.today(), weekly_hours_budget=7.0)
    db.add(roadmap)
    db.flush()
    phase = RoadmapPhase(roadmap_id=roadmap.id, name="All of it", order_index=0)
    db.add(phase)
    db.flush()
    db.add(RoadmapTopic(roadmap_id=roadmap.id, phase_id=phase.id, order_index=0, title="Everything",
                        estimated_hours=40.0))
    db.commit()

    slipping = next(n for n in NotificationService(db).list().items if n.trigger == "roadmap_slipping")
    # To the plan editor, where the budget that decides the finish is changed.
    assert (slipping.action_label, slipping.action_path) == ("Edit plan", f"/roadmaps/{roadmap.id}/edit")
    assert "after your PSM" in slipping.detail

    psm.target_exam_date = date.today() + timedelta(days=120)
    db.commit()
    assert not any(n.trigger == "roadmap_slipping" for n in NotificationService(db).list().items)


def test_a_trigger_switched_off_raises_nothing(db, client):
    psm = _subject(db, "PSM")
    _mock(db, psm, score=60.0, wrong=1)
    assert any(n.trigger == "review_due" for n in NotificationService(db).list().items)

    _triggers(client, review_due=False, mock_below_pass=False)
    triggers = {n.trigger for n in NotificationService(db).list().items}
    assert "review_due" not in triggers and "mock_below_pass" not in triggers

    response = client.get("/api/v1/notifications")
    assert response.status_code == 200
    assert all(item["trigger"] not in ("review_due", "mock_below_pass") for item in response.json()["items"])


def test_archived_preparations_do_not_notify(db):
    psm = _subject(db, "PSM", is_archived=True)
    _mock(db, psm, score=60.0, wrong=3)
    assert NotificationService(db).list().items == []


def test_two_requests_creating_the_settings_row_at_once_both_get_it(db, monkeypatch):
    """The second writer loses the insert race and must read the winner's row, not fail."""
    from app.repositories.settings_repository import SettingsRepository

    SettingsRepository(db).get_or_create()  # the other request's row
    repo = SettingsRepository(db)
    calls = {"n": 0}
    real_get = repo.get

    def stale_then_real():
        calls["n"] += 1
        return None if calls["n"] == 1 else real_get()

    monkeypatch.setattr(repo, "get", stale_then_real)

    row = repo.get_or_create()

    assert row.id == 1
    assert calls["n"] == 2


def test_the_health_check_answers_without_touching_the_database(client, monkeypatch):
    def refuse(*a, **k):
        raise AssertionError("the health check must not open a database session")

    from app.core.database import get_db
    app.dependency_overrides[get_db] = refuse
    try:
        body = client.get("/api/v1/system/health").json()
    finally:
        from tests.conftest import override_get_db

        app.dependency_overrides[get_db] = override_get_db
    assert body["status"] == "ok"

