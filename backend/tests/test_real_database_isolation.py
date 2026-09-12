# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The one file the test suite must never write to.

backend/data/exam_simulator.db is the learner's own database. It holds question
banks they imported by hand, which no seed can regenerate, and every paper they
have sat. The suite reached it for a long time without anyone noticing, because
the leak was never in the data -- app.dependency_overrides[get_db] has always
pointed request-scoped work at the test database. It was in the schema and the
startup side effects, which do not pass through that dependency:

  * app/main.py calls create_all at IMPORT time and conftest imports app.main,
    so collecting the suite was enough to create and upgrade tables in the real
    file;
  * the lifespan handler runs the migrations and the seeders through its own
    SessionLocal(), and `with TestClient(app)` fires it, so every test using
    the client fixture seeded the real file;
  * test_question_validator.py and test_content_validator.py open the real
    SessionLocal() directly.

Every Phase 2 step was additive by design, so nothing was lost. A later step
that drops or rewrites a column would not be so kind, and it would run during
`pytest`, against data the learner cannot get back.

The fix is two independent things and this file tests both. The REDIRECT --
settings pointed at the test database before app.core.config is imported -- is
what makes the guarantee, because it holds for code that has not been written
yet. The SKIP -- settings.RUN_STARTUP_DB_INIT off under test -- is what keeps
the seeders out of the test database, so the suite still sees the state it was
written against.

The last four tests exercise the guard itself. A watchdog that cannot bark is
worse than none, because it reads like coverage.
"""
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

import app.core.database as app_database
from app.core.config import Settings, settings
from app.main import app
from app.models.design_review import DesignReview
from app.models.interview_question import InterviewQuestion
from app.models.subject import Subject
from app.models.system_design_prompt import SystemDesignPrompt
from tests.conftest import (
    REAL_DB_PATH,
    TEST_DB_PATH,
    TestingSessionLocal,
    _fingerprint,
    _read_schema,
    describe_real_database_drift,
)


# ---- the guarantee ------------------------------------------------------


def test_the_real_database_is_untouched_by_this_run():
    """Nothing has reached the real file, including before any test ran.

    conftest takes its fingerprint at import, which is earlier than its own
    `from app.main import app` -- so this covers the import-time create_all as
    well as everything the suite has done since. The same check runs again in
    conftest's session teardown, where it covers what comes after this test.

    On a clean checkout the file does not exist at all, and "still does not
    exist" is the strongest form this assertion can take.
    """
    assert describe_real_database_drift() == []


def test_the_application_engine_points_at_the_test_database():
    """The redirect, which is the half that covers code not yet written.

    Guarding main.py alone would leave every other route to the real file open
    -- a seeder called from somewhere new, a background task, a test that
    reaches for SessionLocal because it is the obvious name. Two already do.
    Binding the application's own engine to the test database closes all of
    them at once, and needs nobody to remember anything.
    """
    engine_path = Path(app_database.engine.url.database).resolve()
    assert engine_path == TEST_DB_PATH.resolve()
    assert engine_path != REAL_DB_PATH.resolve()

    session = app_database.SessionLocal()
    try:
        session_path = Path(session.get_bind().url.database).resolve()
    finally:
        session.close()
    assert session_path == TEST_DB_PATH.resolve()


def test_startup_database_initialisation_is_off_under_test():
    assert settings.RUN_STARTUP_DB_INIT is False


def test_startup_database_initialisation_is_on_everywhere_else():
    """The flag defaults to on, and a real boot must never see it off.

    Turning the leak off by defaulting to False would trade a test that
    corrupts real data for a fresh install that never gets a schema. The
    default is the product's behaviour; only the suite opts out.
    """
    assert Settings.model_fields["RUN_STARTUP_DB_INIT"].default is True


def test_the_client_lifespan_does_not_reach_the_real_database():
    """The second leak, tested at the surface that caused it.

    `with TestClient(app)` runs the lifespan handler. That is not a detail of
    the client fixture -- it is the whole mechanism, and it ran the migrations
    and five seeders against the real database on every test that asked for a
    client.
    """
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
    assert describe_real_database_drift() == []


def test_the_lifespan_does_not_seed_the_test_database_either():
    """The skip, which is what keeps the rest of the suite's expectations true.

    Seeded subjects, prompts, interview questions and design reviews would
    change what every list endpoint returns, so a run would start disagreeing
    with tests written against an empty bank. Redirecting without skipping
    would have swapped one silent breakage for another.
    """
    counted = (Subject, SystemDesignPrompt, InterviewQuestion, DesignReview)

    def counts():
        db = TestingSessionLocal()
        try:
            return {model.__name__: db.query(model).count() for model in counted}
        finally:
            db.close()

    before = counts()
    with TestClient(app):
        pass
    assert counts() == before


# ---- the guard itself ---------------------------------------------------


def _make_db(path: Path, *statements: str) -> None:
    con = sqlite3.connect(path)
    try:
        for statement in statements:
            con.execute(statement)
        con.commit()
    finally:
        con.close()


def test_the_guard_notices_a_database_appearing(tmp_path):
    """The case a clean checkout and CI actually hit.

    There is no exam_simulator.db on a fresh clone, so the leak shows up as a
    file that did not exist and now does -- created, seeded and left behind by
    a test run. That has to register as drift, not as "nothing to compare".
    """
    db = tmp_path / "appears.db"
    before = _fingerprint(db)
    assert before == {".db": None, "-wal": None, "-shm": None, "schema": None}

    _make_db(db, "CREATE TABLE questions (id INTEGER PRIMARY KEY)")
    assert _fingerprint(db) != before


def test_the_guard_notices_a_schema_change(tmp_path):
    """A migration step run against the wrong database is a new statement."""
    db = tmp_path / "migrated.db"
    _make_db(db, "CREATE TABLE exam_answers (id INTEGER PRIMARY KEY)")
    before = _fingerprint(db)

    _make_db(db, "ALTER TABLE exam_answers ADD COLUMN reviewed_at DATETIME")
    after = _fingerprint(db)

    assert after != before
    assert after["schema"] != before["schema"]
    assert "reviewed_at" in " ".join(after["schema"])


def test_the_guard_notices_a_write_that_leaves_the_schema_alone(tmp_path):
    """Seeding adds rows, not tables, and still counts as touching the file."""
    db = tmp_path / "seeded.db"
    _make_db(db, "CREATE TABLE subjects (id INTEGER PRIMARY KEY)")
    before = _fingerprint(db)

    _make_db(db, "INSERT INTO subjects (id) VALUES (1)")
    after = _fingerprint(db)

    assert after["schema"] == before["schema"]
    assert after != before


def test_reading_the_schema_does_not_modify_the_file(tmp_path):
    """The guard must not become the thing that touches what it guards.

    Opening the database the way the application does would set
    journal_mode=WAL on it, which is a write, and would leave a -wal and a -shm
    next to it. The read-only URI is what stops that, and this is the test that
    would catch someone replacing it with an ordinary connection.
    """
    db = tmp_path / "readonly.db"
    _make_db(db, "CREATE TABLE questions (id INTEGER PRIMARY KEY)")
    before = _fingerprint(db)

    assert _read_schema(db) == ["CREATE TABLE questions (id INTEGER PRIMARY KEY)"]

    assert _fingerprint(db) == before
    assert not (tmp_path / "readonly.db-wal").exists()
    assert not (tmp_path / "readonly.db-shm").exists()
