# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_phase2_migrations.py

The upgrade path for the Phase 2 schema changes, run against a database built
the way a real install's was: created by an older model definition, without the
new columns, then migrated in place.

This is the substitute for the down-migration the plan asks for and this
repository cannot provide (docs/implementation/00-risk-register.md, RISK-01).
There is no framework to run a migration backwards, so the guarantees that make
a forward-only step safe have to be tested instead:

  1. it is idempotent -- running it twice is the same as running it once
  2. it produces the same schema as a fresh create_all, so an upgraded install
     and a new one are not subtly different databases
  3. its backfill uses the rule it claims to use, and nothing wider
  4. what it cannot attribute, it leaves alone and reports

Each test builds its own throwaway SQLite file, so nothing here touches the
suite's shared test database.
"""
import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from app.core.database import Base, register_sqlite_pragmas


# The pre-Phase-2 shape of the two tables the migration alters, written out
# rather than derived from the models -- the point is to start from what an
# older install actually has on disk.
LEGACY_QUESTIONS = """
    CREATE TABLE questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        question_type VARCHAR(20) NOT NULL DEFAULT 'SINGLE_CHOICE',
        difficulty VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
        domain VARCHAR(150) NOT NULL DEFAULT 'General',
        topic VARCHAR(150) NOT NULL DEFAULT 'General',
        subtopic VARCHAR(150),
        certification VARCHAR(150) NOT NULL DEFAULT 'General Prep',
        source VARCHAR(200),
        tags TEXT,
        code_snippet TEXT,
        case_study_text TEXT,
        image_url VARCHAR(500),
        explanation TEXT,
        reference_url VARCHAR(500),
        is_reviewed BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME
    )
"""

LEGACY_ROADMAPS = """
    CREATE TABLE roadmaps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(250) NOT NULL,
        description TEXT,
        source_filename VARCHAR(300),
        start_date DATE,
        weekly_hours_budget FLOAT,
        is_archived BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME
    )
"""

LEGACY_SUBJECTS = """
    CREATE TABLE subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(150) NOT NULL UNIQUE,
        slug VARCHAR(80) NOT NULL UNIQUE,
        kind VARCHAR(20) NOT NULL DEFAULT 'CERTIFICATION',
        certification VARCHAR(150),
        pass_mark FLOAT,
        exam_question_count INTEGER,
        exam_minutes INTEGER,
        display_order INTEGER NOT NULL DEFAULT 100,
        created_at DATETIME
    )
"""

# The pre-Phase-9 recordings table: before interview sessions and plan notes.
LEGACY_PRACTICE_RECORDINGS = """
    CREATE TABLE practice_recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(300) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        duration_seconds INTEGER,
        file_size_bytes INTEGER NOT NULL,
        interview_question_id INTEGER,
        created_at DATETIME
    )
"""

# The pre-Phase-10 system design tables: one answer_text, no sections.
LEGACY_SYSTEM_DESIGN = (
    """
    CREATE TABLE system_design_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id INTEGER NOT NULL,
        answer_text TEXT NOT NULL,
        target_role VARCHAR(200),
        overall_score FLOAT,
        category_scores JSON,
        strengths JSON,
        improvements JSON,
        summary TEXT,
        grading_status VARCHAR(20) NOT NULL,
        grading_error TEXT,
        time_spent_seconds INTEGER,
        created_at DATETIME
    )
    """,
    """
    CREATE TABLE system_design_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id INTEGER NOT NULL UNIQUE,
        answer_text TEXT NOT NULL DEFAULT '',
        target_role VARCHAR(200),
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    )
    """,
)


@pytest.fixture
def legacy_db(tmp_path, monkeypatch):
    """A pre-Phase-2 database on disk, with the migration pointed at it.

    apply_lightweight_migrations() works against the module-level `engine`, so
    the engine is swapped for the duration of the test rather than the function
    being reshaped to take one.
    """
    path = tmp_path / "legacy.db"

    raw = sqlite3.connect(path)
    raw.execute(LEGACY_SUBJECTS)
    raw.execute(LEGACY_QUESTIONS)
    raw.execute(LEGACY_ROADMAPS)
    raw.execute(LEGACY_PRACTICE_RECORDINGS)
    for ddl in LEGACY_SYSTEM_DESIGN:
        raw.execute(ddl)
    raw.execute(
        "INSERT INTO system_design_attempts (prompt_id, answer_text, grading_status) "
        "VALUES (1, 'One long answer', 'unavailable')"
    )
    raw.execute(
        "INSERT INTO practice_recordings (title, file_path, mime_type, file_size_bytes) "
        "VALUES ('Before sessions', 'old.webm', 'audio/webm', 10)"
    )
    raw.commit()
    raw.close()

    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(engine)

    import app.core.database as database_module

    monkeypatch.setattr(database_module, "engine", engine)
    yield engine
    engine.dispose()


def _migrate():
    from app.core.database import apply_lightweight_migrations

    apply_lightweight_migrations()


def _columns(engine, table):
    with engine.connect() as conn:
        return [row[1] for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()]


# ---- 1. the columns arrive ------------------------------------------------


def test_the_migration_adds_subject_id_to_questions_and_roadmaps(legacy_db):
    assert "subject_id" not in _columns(legacy_db, "questions")
    assert "subject_id" not in _columns(legacy_db, "roadmaps")

    _migrate()

    assert "subject_id" in _columns(legacy_db, "questions")
    assert "subject_id" in _columns(legacy_db, "roadmaps")


def test_the_migration_creates_the_learning_attempts_table(legacy_db):
    _migrate()

    with legacy_db.connect() as conn:
        found = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name='learning_attempts'"
        )).fetchone()
    assert found is not None


# ---- 2. idempotency ------------------------------------------------------


def test_running_the_migration_twice_changes_nothing(legacy_db):
    """The property that makes a forward-only step safe to ship.

    Every startup runs this function, so a step that is not idempotent breaks
    the app on the second boot rather than the first -- which is the worst time
    to find out.
    """
    _migrate()
    tables = ("questions", "roadmaps", "learning_attempts", "subjects", "topic_demonstrations", "topic_guide_sections", "practice_recordings", "interview_sessions", "system_design_attempts", "system_design_drafts")
    first = {t: _columns(legacy_db, t) for t in tables}

    _migrate()
    second = {t: _columns(legacy_db, t) for t in tables}

    assert first == second


# ---- 3. upgraded and fresh databases must agree --------------------------


def test_the_migration_adds_the_subject_columns_prep_edit_collects(legacy_db):
    """description, target_exam_date and is_archived.

    No backfill: description and target_exam_date are genuinely unknown for the
    seeded subjects, and a made-up target date would drive a countdown the learner
    never set.
    """
    assert "description" not in _columns(legacy_db, "subjects")

    _migrate()

    columns = _columns(legacy_db, "subjects")
    for column in ("description", "target_exam_date", "is_archived"):
        assert column in columns, f"subjects is missing {column}"


def test_existing_subjects_are_not_archived_by_the_migration(legacy_db):
    """is_archived defaults to 0, so nothing disappears from the picker."""
    with legacy_db.connect() as conn:
        conn.execute(text(
            "INSERT INTO subjects (name, slug, kind, certification) VALUES "
            "('Scrum', 'scrum', 'CERTIFICATION', 'PSM I')"
        ))
        conn.commit()

    _migrate()

    with legacy_db.connect() as conn:
        archived, description, target = conn.execute(text(
            "SELECT is_archived, description, target_exam_date FROM subjects"
        )).fetchone()

    assert not archived
    assert description is None
    assert target is None


def test_the_migration_adds_review_daily_cap_with_the_queues_own_default(legacy_db):
    """Phase 4. DEFAULT 20 so an existing install keeps the value GET /review/queue
    was already built around, rather than silently changing its size."""
    with legacy_db.connect() as conn:
        conn.execute(text(
            "CREATE TABLE app_settings (id INTEGER PRIMARY KEY, theme VARCHAR(20), "
            "timer_sound_enabled BOOLEAN, initial_seed_completed BOOLEAN, "
            "default_target_role VARCHAR(200))"
        ))
        conn.execute(text("INSERT INTO app_settings (id, theme) VALUES (1, 'light')"))
        conn.commit()

    _migrate()
    _migrate()  # and idempotent

    with legacy_db.connect() as conn:
        cap = conn.execute(text("SELECT review_daily_cap FROM app_settings WHERE id = 1")).scalar()
    assert cap == 20


def test_an_upgraded_database_has_the_same_columns_as_a_fresh_one(legacy_db, tmp_path):
    """An install that upgraded and one created today must not differ.

    Two ways of arriving at a schema is two schemas unless something checks. A
    column present only on fresh installs is the kind of difference that shows
    up as a bug report nobody can reproduce.
    """
    _migrate()

    fresh_path = tmp_path / "fresh.db"
    fresh = create_engine(f"sqlite:///{fresh_path}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(fresh)
    Base.metadata.create_all(bind=fresh)

    try:
        for table in ("questions", "roadmaps", "learning_attempts", "subjects", "topic_demonstrations", "topic_guide_sections", "practice_recordings", "interview_sessions", "system_design_attempts", "system_design_drafts"):
            assert set(_columns(legacy_db, table)) == set(_columns(fresh, table)), (
                f"{table} differs between an upgraded and a fresh database"
            )
    finally:
        fresh.dispose()


# ---- 4. the backfill uses exact equality and nothing wider ---------------


def test_the_backfill_attributes_questions_by_exact_certification(legacy_db):
    psm = "PSM I - Professional Scrum Master"
    dbx = "Databricks Certified Data Engineer Professional"

    with legacy_db.connect() as conn:
        conn.execute(text(
            "INSERT INTO subjects (name, slug, kind, certification, pass_mark, "
            "exam_question_count, exam_minutes) VALUES "
            "('Scrum', 'scrum', 'CERTIFICATION', :psm, 85.0, 80, 60)"
        ), {"psm": psm})
        for cert in (psm, psm, dbx):
            conn.execute(
                text(
                    "INSERT INTO questions (text, certification, domain, topic) "
                    "VALUES (:t, :c, 'Scrum Events', 'T')"
                ),
                {"t": f"q under {cert}", "c": cert},
            )
        conn.commit()

    _migrate()

    with legacy_db.connect() as conn:
        rows = conn.execute(text(
            "SELECT certification, subject_id FROM questions ORDER BY id"
        )).fetchall()

    owned = {cert: sid for cert, sid in rows}
    assert owned[psm] is not None, "an exact certification match was not attributed"
    # The two names share the word "Professional". That is precisely what the
    # old token match treated as ownership, and it must not survive here.
    assert owned[dbx] is None, (
        "the backfill attributed a question from another certification that "
        "merely shares a word"
    )


def test_the_backfill_leaves_an_unmatched_question_unowned(legacy_db):
    """"General Prep" is the column default, so these exist everywhere.

    Left NULL on purpose. A migration that guessed an owner here would be
    fabricating exactly the relationship the column was added to make explicit.
    """
    with legacy_db.connect() as conn:
        conn.execute(text(
            "INSERT INTO subjects (name, slug, kind, certification) VALUES "
            "('Scrum', 'scrum', 'CERTIFICATION', 'PSM I - Professional Scrum Master')"
        ))
        conn.execute(text(
            "INSERT INTO questions (text, certification, domain, topic) "
            "VALUES ('orphan', 'General Prep', 'General', 'General')"
        ))
        conn.commit()

    _migrate()

    with legacy_db.connect() as conn:
        subject_id = conn.execute(text(
            "SELECT subject_id FROM questions WHERE certification = 'General Prep'"
        )).scalar()
    assert subject_id is None


def test_a_certification_claimed_by_two_preparations_is_left_unowned(legacy_db):
    """No coin tosses, and none that depend on insertion order.

    `subjects.certification` is not unique. A plain loop over every subject
    would let whichever row came first claim every question, so the owner would
    be decided by insertion order -- and the same question created through the
    API would be left unowned, because resolve_subject_id refuses to guess.
    Those two behaviours have to agree, or a question's owner depends on whether
    it arrived before or after this migration ran.
    """
    shared = "PSM I - Professional Scrum Master"

    with legacy_db.connect() as conn:
        conn.execute(text(
            "INSERT INTO subjects (name, slug, kind, certification) VALUES "
            "('Scrum A', 'scrum-a', 'CERTIFICATION', :c)"
        ), {"c": shared})
        conn.execute(text(
            "INSERT INTO subjects (name, slug, kind, certification) VALUES "
            "('Scrum B', 'scrum-b', 'CERTIFICATION', :c)"
        ), {"c": shared})
        conn.execute(text(
            "INSERT INTO questions (text, certification, domain, topic) "
            "VALUES ('contested', :c, 'Scrum Events', 'T')"
        ), {"c": shared})
        conn.commit()

    _migrate()

    with legacy_db.connect() as conn:
        subject_id = conn.execute(text(
            "SELECT subject_id FROM questions WHERE text = 'contested'"
        )).scalar()

    assert subject_id is None, (
        "the migration picked one of two preparations claiming the same "
        "certification, so ownership was decided by insertion order"
    )


def test_existing_roadmaps_are_left_unassigned(legacy_db):
    """No heuristic, by decision.

    Nothing in the old schema recorded which preparation a roadmap served, so
    there is no rule to apply -- only a guess at the title. Unassigned and
    labelled beats assigned and wrong.
    """
    with legacy_db.connect() as conn:
        conn.execute(text(
            "INSERT INTO subjects (name, slug, kind, certification) VALUES "
            "('Scrum', 'scrum', 'CERTIFICATION', 'PSM I - Professional Scrum Master')"
        ))
        conn.execute(text(
            "INSERT INTO roadmaps (title) VALUES ('PSM I Professional Scrum Master Plan')"
        ))
        conn.commit()

    _migrate()

    with legacy_db.connect() as conn:
        subject_id = conn.execute(text("SELECT subject_id FROM roadmaps")).scalar()
    assert subject_id is None, (
        "a roadmap was matched to a preparation by its title, which is a guess"
    )


def test_the_migration_adds_interview_sessions_without_touching_old_takes(legacy_db):
    """A take recorded before sessions existed stays a standalone take."""
    _migrate()

    assert {"session_id", "plan_note"} <= set(_columns(legacy_db, "practice_recordings"))
    assert "question_ids" in _columns(legacy_db, "interview_sessions")
    with legacy_db.connect() as conn:
        row = conn.execute(text("SELECT session_id, plan_note FROM practice_recordings")).one()
    assert tuple(row) == (None, None)


def test_the_migration_adds_sections_and_keeps_old_answers_whole(legacy_db):
    """An answer written before sections existed is still the whole answer."""
    _migrate()

    assert "sections" in _columns(legacy_db, "system_design_attempts")
    assert "sections" in _columns(legacy_db, "system_design_drafts")
    with legacy_db.connect() as conn:
        row = conn.execute(text("SELECT answer_text, sections FROM system_design_attempts")).one()
    assert tuple(row) == ("One long answer", None)


def test_the_migration_adds_the_experiment_columns_to_learning_attempts(legacy_db):
    _migrate()
    assert {"manipulation", "observed", "explanation_text"} <= set(_columns(legacy_db, "learning_attempts"))


def test_the_migration_adds_the_preference_columns_to_app_settings_and_keeps_the_row(legacy_db):
    with legacy_db.begin() as conn:
        conn.execute(text(
            "CREATE TABLE app_settings (id INTEGER PRIMARY KEY, theme VARCHAR(20), "
            "timer_sound_enabled BOOLEAN, initial_seed_completed BOOLEAN, "
            "default_target_role VARCHAR(200), review_daily_cap INTEGER NOT NULL DEFAULT 20)"
        ))
        conn.execute(text(
            "INSERT INTO app_settings (id, theme, timer_sound_enabled, review_daily_cap) VALUES (1, 'dark', 0, 35)"
        ))

    _migrate()
    _migrate()  # twice changes nothing

    assert {"text_size", "reduce_motion", "shortcuts_enabled", "notification_triggers"} <= set(
        _columns(legacy_db, "app_settings")
    )
    with legacy_db.connect() as conn:
        row = conn.execute(text(
            "SELECT theme, review_daily_cap, text_size, reduce_motion, shortcuts_enabled, notification_triggers "
            "FROM app_settings WHERE id = 1"
        )).one()
    assert tuple(row) == ("dark", 35, "standard", "system", 1, None)


def test_the_migration_adds_the_profile_columns_empty_and_keeps_the_row(legacy_db):
    """Nobody is named on an upgraded install until they write a name."""
    with legacy_db.begin() as conn:
        conn.execute(text(
            "CREATE TABLE app_settings (id INTEGER PRIMARY KEY, theme VARCHAR(20), "
            "timer_sound_enabled BOOLEAN, initial_seed_completed BOOLEAN, "
            "default_target_role VARCHAR(200), review_daily_cap INTEGER NOT NULL DEFAULT 20)"
        ))
        conn.execute(text("INSERT INTO app_settings (id, theme, review_daily_cap) VALUES (1, 'dark', 35)"))

    _migrate()
    _migrate()  # twice changes nothing

    assert {"display_name", "email"} <= set(_columns(legacy_db, "app_settings"))
    with legacy_db.connect() as conn:
        row = conn.execute(text(
            "SELECT theme, review_daily_cap, display_name, email FROM app_settings WHERE id = 1"
        )).one()
    assert tuple(row) == ("dark", 35, None, None)


def test_the_migration_indexes_the_foreign_keys_sqlite_left_bare(legacy_db):
    """Found by query plan at the size of a heavy install: without these, the
    options join and the "has this been answered" join were full table scans
    once per question -- five seconds to start a mock, three to open Review."""
    with legacy_db.begin() as conn:
        conn.execute(text(
            "CREATE TABLE question_options (id INTEGER PRIMARY KEY, question_id INTEGER NOT NULL, "
            "option_text TEXT NOT NULL, is_correct BOOLEAN NOT NULL DEFAULT 0, order_index INTEGER)"
        ))
        conn.execute(text(
            "INSERT INTO question_options (question_id, option_text, is_correct) VALUES (1, 'Kept', 1)"
        ))

    _migrate()
    _migrate()

    with legacy_db.connect() as conn:
        indexes = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type = 'index'"))}
        plan = " ".join(str(row) for row in conn.execute(text(
            "EXPLAIN QUERY PLAN SELECT id FROM question_options WHERE question_id = 1"
        )))
        kept = conn.execute(text("SELECT option_text FROM question_options")).scalar()

    assert "ix_question_options_question_id" in indexes
    assert "ix_question_options_question_id" in plan
    assert kept == "Kept"


def test_a_fresh_database_has_the_foreign_key_indexes_too(tmp_path):
    fresh = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    Base.metadata.create_all(bind=fresh)
    try:
        with fresh.connect() as conn:
            indexes = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type = 'index'"))}
        assert {"ix_exam_answers_question_id", "ix_question_options_question_id"} <= indexes
    finally:
        fresh.dispose()


def test_the_migration_adds_every_index_the_models_declare(legacy_db):
    """An upgraded database was missing indexes a fresh one had.

    ALTER TABLE adds a column, not its index, so an index added to a model after
    someone installed only ever existed on fresh installs -- six of them were
    missing from a real database, including the one every preparation-scoped
    query filters on.
    """
    _migrate()

    with legacy_db.connect() as conn:
        tables = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type = 'table'"))}
        indexes = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type = 'index'"))}
        missing = []
        for table in Base.metadata.sorted_tables:
            if table.name not in tables:
                continue
            columns = {row[1] for row in conn.execute(text(f"PRAGMA table_info('{table.name}')"))}
            for index in table.indexes:
                if index.unique or not index.name:
                    continue
                if not {c.name for c in index.columns}.issubset(columns):
                    continue
                if index.name not in indexes:
                    missing.append(f"{table.name}.{index.name}")

    assert missing == [], f"indexes the models declare but an upgrade does not create: {missing}"

