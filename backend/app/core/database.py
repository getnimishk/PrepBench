# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False},
    echo=False
)

# Enable foreign key constraints and WAL mode in SQLite for reliability & speed.
# busy_timeout makes a connection wait (up to 10s) and retry on a locked database
# instead of raising OperationalError immediately on any write contention.
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.close()


def register_sqlite_pragmas(target_engine) -> None:
    """
    Attach the SQLite pragma listener above to `target_engine`.

    Exposed as a function rather than a bare `@event.listens_for(engine, ...)`
    decorator because the listener binds to one specific Engine instance. The
    test suite builds its own isolated engine (tests/conftest.py), which meant
    it silently ran with foreign_keys=OFF -- so `ondelete="CASCADE"` never
    fired there. Bulk deletes that bypass the ORM (Query.delete()) left
    orphaned child rows behind in tests while behaving correctly in the real
    app, and SQLite's rowid reuse could then re-attach those orphans to a
    newly inserted parent. Any engine that talks to this schema must call
    this.
    """
    event.listens_for(target_engine, "connect")(set_sqlite_pragma)


register_sqlite_pragmas(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class MigrationFailedError(RuntimeError):
    """Raised at startup when the database is left partially upgraded."""


# Collected rather than raised at the point of failure, so that one broken
# step does not hide the state of the others: the operator gets the whole
# list in a single message instead of fixing them one restart at a time.
_migration_failures: list = []


def _log_migration_failure(step: str, exc: Exception) -> None:
    """
    Record a failed migration step and keep going.

    Continuing is deliberate -- the remaining steps are independent, and
    running them turns "the schema is broken somewhere" into a complete list.
    What must NOT happen is the application then serving requests against a
    half-upgraded database, which is how a schema problem reappears later as
    a baffling "no such column" a long way from its cause.
    _raise_if_migrations_failed() closes that gap at the end of the run.
    """
    # Imported lazily: logging_config configures handlers at import time, and
    # this module is imported early enough that a module-level import would
    # risk an import cycle through app.core.config.
    from app.core.logging_config import logger
    logger.error(f"Lightweight migration step '{step}' failed: {exc}")
    _migration_failures.append((step, exc))


def _raise_if_migrations_failed() -> None:
    """Refuse to start on a partially upgraded database.

    A migration that fails halfway leaves some columns present and others
    missing. Starting anyway means the first learner action hits the gap, and
    a product whose whole argument is that its numbers are trustworthy should
    not serve numbers it cannot compute.
    """
    if not _migration_failures:
        return
    steps = _migration_failures[:]
    _migration_failures.clear()
    detail = "; ".join(f"{step}: {exc}" for step, exc in steps)
    raise MigrationFailedError(
        f"{len(steps)} database migration step(s) failed, so the schema is only "
        f"partially upgraded and PrepBench will not start on it. "
        f"Restore your last backup of exam_simulator.db and try again. Details -- {detail}"
    )


def apply_lightweight_migrations():
    """Auto-add missing columns/indexes to existing SQLite database tables safely."""
    _migration_failures.clear()
    with engine.connect() as conn:
        try:
            # Check app_settings columns
            result = conn.execute(text("PRAGMA table_info(app_settings)")).fetchall()
            columns = [row[1] for row in result]
            if "initial_seed_completed" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE app_settings ADD COLUMN initial_seed_completed BOOLEAN DEFAULT 0"))
                conn.commit()
            if "default_target_role" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE app_settings ADD COLUMN default_target_role VARCHAR(200)"))
                conn.commit()
        except Exception as exc:
            _log_migration_failure('app_settings columns', exc)

        try:
            # Backfill the unique (session_id, question_id) index on exam_answers for
            # databases created before this constraint was added to the model.
            indexes = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='exam_answers'")
            ).fetchall()
            has_constraint = any(row[0] == "uq_exam_answer_session_question" for row in indexes)
            table_exists = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='exam_answers'")
            ).fetchone()
            if table_exists and not has_constraint:
                conn.execute(text(
                    "DELETE FROM exam_answers WHERE id NOT IN "
                    "(SELECT MAX(id) FROM exam_answers GROUP BY session_id, question_id)"
                ))
                conn.execute(text(
                    "CREATE UNIQUE INDEX uq_exam_answer_session_question "
                    "ON exam_answers (session_id, question_id)"
                ))
                conn.commit()
        except Exception as exc:
            _log_migration_failure('exam_answers unique index', exc)

        try:
            # exam_answers: an immutable first-answered timestamp. answered_at
            # has onupdate= and gets bumped by ordinary navigation, so it can't
            # answer "what did I actually practice today?". Backfilled from
            # answered_at, which is the best estimate available for rows that
            # predate the column.
            result = conn.execute(text("PRAGMA table_info(exam_answers)")).fetchall()
            columns = [row[1] for row in result]
            if "first_answered_at" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE exam_answers ADD COLUMN first_answered_at DATETIME"))
                conn.execute(text(
                    "UPDATE exam_answers SET first_answered_at = answered_at "
                    "WHERE first_answered_at IS NULL"
                ))
                conn.commit()
        except Exception as exc:
            _log_migration_failure("exam_answers.first_answered_at", exc)

        try:
            # app_settings: drop the controls that never did anything.
            #
            # Skipped rather than failed on SQLite older than 3.35, which has
            # no DROP COLUMN. Refusing to boot over six unread columns would
            # be a worse outcome than carrying them.
            import sqlite3 as _sqlite3

            dead_settings = [
                "shuffle_options", "daily_practice_goal", "default_exam_mode",
                "default_questions_count", "default_passing_percentage",
                "shuffle_questions",
            ]
            supports_drop = tuple(
                int(part) for part in _sqlite3.sqlite_version.split(".")[:2]
            ) >= (3, 35)
            table_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'"
            )).fetchone()
            if table_exists and supports_drop:
                result = conn.execute(text("PRAGMA table_info(app_settings)")).fetchall()
                columns = [row[1] for row in result]
                for dead in dead_settings:
                    if dead in columns:
                        conn.execute(text(f"ALTER TABLE app_settings DROP COLUMN {dead}"))
                conn.commit()
        except Exception as exc:
            _log_migration_failure("app_settings dead columns", exc)

        try:
            # design_reviews.axis_label: the deciding axis as a short name, so
            # attempts can be grouped by it. Added after the table shipped, so
            # an install seeded by the first version has the reviews but not
            # the labels -- seed_design_reviews backfills them by title on the
            # next startup, which is why this only has to add the column.
            table_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='design_reviews'"
            )).fetchone()
            if table_exists:
                result = conn.execute(text("PRAGMA table_info(design_reviews)")).fetchall()
                columns = [row[1] for row in result]
                if "axis_label" not in columns:
                    conn.execute(text("ALTER TABLE design_reviews ADD COLUMN axis_label VARCHAR(60)"))
                    conn.commit()
        except Exception as exc:
            _log_migration_failure("design_reviews.axis_label", exc)

        try:
            # exam_sessions: which kind of session this was, and which subject
            # it belongs to. session_kind defaults to "drill" so that every
            # session recorded before the column existed counts as practice --
            # readiness must never be built on sessions nobody sat under exam
            # conditions.
            table_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='exam_sessions'"
            )).fetchone()
            if table_exists:
                result = conn.execute(text("PRAGMA table_info(exam_sessions)")).fetchall()
                columns = [row[1] for row in result]
                if "session_kind" not in columns:
                    conn.execute(text(
                        "ALTER TABLE exam_sessions ADD COLUMN session_kind VARCHAR(10) "
                        "NOT NULL DEFAULT 'drill'"
                    ))
                    conn.commit()
                if "subject_id" not in columns:
                    conn.execute(text("ALTER TABLE exam_sessions ADD COLUMN subject_id INTEGER"))
                    conn.commit()
        except Exception as exc:
            _log_migration_failure("exam_sessions.session_kind / subject_id", exc)

        try:
            # exam_answers.reviewed_at: when the learner actually looked at
            # this answer after a mock. Nullable and unbackfilled -- an answer
            # from before the column existed is genuinely unknown, and
            # pretending it was reviewed would hide exactly the work this
            # column exists to surface.
            result = conn.execute(text("PRAGMA table_info(exam_answers)")).fetchall()
            columns = [row[1] for row in result]
            if "reviewed_at" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE exam_answers ADD COLUMN reviewed_at DATETIME"))
                conn.commit()
        except Exception as exc:
            _log_migration_failure("exam_answers.reviewed_at", exc)

        try:
            # Check questions columns
            result = conn.execute(text("PRAGMA table_info(questions)")).fetchall()
            columns = [row[1] for row in result]
            if "is_reviewed" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE questions ADD COLUMN is_reviewed BOOLEAN DEFAULT 0"))
                conn.commit()
        except Exception as exc:
            _log_migration_failure("questions.is_reviewed", exc)

        try:
            # practice_recordings: link to an optional interview_question (added
            # when Practice Recordings became round-based Interview Practice --
            # NULL stays valid and means "freeform/General Practice", so this is
            # a pure additive column, no backfill needed).
            result = conn.execute(text("PRAGMA table_info(practice_recordings)")).fetchall()
            columns = [row[1] for row in result]
            if "interview_question_id" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE practice_recordings ADD COLUMN interview_question_id INTEGER"))
                conn.commit()
        except Exception as exc:
            _log_migration_failure('practice_recordings.interview_question_id', exc)

        try:
            # LLM provider configuration. Both tables are new rather than
            # altered, so create_all already covers a fresh database -- this
            # step exists for an existing one, where create_all does run but
            # only for tables it can see, and a user upgrading in place has
            # neither. CREATE TABLE IF NOT EXISTS keeps it idempotent.
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS llm_provider_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(80) NOT NULL UNIQUE,
                    profile_key VARCHAR(50) NOT NULL,
                    base_url VARCHAR(500),
                    api_key_ref VARCHAR(200),
                    default_text_model VARCHAR(200),
                    default_audio_model VARCHAR(200),
                    default_embedding_model VARCHAR(200),
                    is_enabled BOOLEAN NOT NULL DEFAULT 1,
                    last_verified_at DATETIME,
                    last_verify_error TEXT,
                    last_latency_ms INTEGER,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS llm_task_binding (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task VARCHAR(50) NOT NULL UNIQUE,
                    provider_config_id INTEGER
                        REFERENCES llm_provider_config(id) ON DELETE SET NULL,
                    model VARCHAR(200),
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
            """))
            conn.commit()
        except Exception as exc:
            _log_migration_failure('llm provider configuration tables', exc)

        try:
            # recording_analyses: content-quality grading columns, additive
            # alongside the existing delivery-only communication_scores/summary.
            result = conn.execute(text("PRAGMA table_info(recording_analyses)")).fetchall()
            columns = [row[1] for row in result]
            if "content_scores" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE recording_analyses ADD COLUMN content_scores TEXT"))
                conn.commit()
            if "content_summary" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE recording_analyses ADD COLUMN content_summary TEXT"))
                conn.commit()
        except Exception as exc:
            _log_migration_failure('recording_analyses content columns', exc)

        try:
            # questions.tags: NULL where the model means an empty list.
            #
            # Same 25 rows, same cause -- inserted without going through the
            # ORM, so the column default never applied. Backfilled rather
            # than tolerated everywhere downstream: "no tags" and "tags
            # unknown" are not different states for this column, and one NULL
            # is enough to fail a whole page of results.
            result = conn.execute(text("PRAGMA table_info(questions)")).fetchall()
            if any(row[1] == "tags" for row in result):
                conn.execute(text("UPDATE questions SET tags = '[]' WHERE tags IS NULL"))
                conn.commit()
        except Exception as exc:
            _log_migration_failure("questions.tags nulls", exc)

        try:
            # Enum columns hold the member NAME, and a row holding the member
            # VALUE instead cannot be read back at all.
            #
            # SQLAlchemy's Enum() stores `QuestionDifficulty.MEDIUM` as the
            # string "MEDIUM". A row carrying "medium" -- the same member's
            # value -- raises LookupError while the result row is being
            # built, before any application code runs. One such question
            # therefore 500s the entire Question Bank listing, and the page
            # reports "check backend connection" over a backend that is
            # fine.
            #
            # This machine's database holds 25 of them, all imported on the
            # same second, all PSM I. Nothing in the application writes a
            # value in that form, so they arrived from outside it -- but they
            # are the learner's own questions, and "medium" and "MEDIUM" are
            # the same difficulty. So they are repaired, not removed, and
            # only where the mapping is exact: a string that matches no
            # member either way is left alone and logged, because guessing
            # what a corrupt row meant is the one thing worse than failing on
            # it.
            from app.models.design_review import DesignReview  # noqa: F401
            from app.models.exam_answer import ConfidenceLevel
            from app.models.exam_session import ExamMode, ExamStatus
            from app.models.interview_question import InterviewRoundType
            from app.models.question import QuestionDifficulty, QuestionType
            from app.models.subject import SubjectKind

            enum_columns = [
                ("questions", "question_type", QuestionType),
                ("questions", "difficulty", QuestionDifficulty),
                ("design_reviews", "difficulty", QuestionDifficulty),
                ("system_design_prompts", "difficulty", QuestionDifficulty),
                ("exam_sessions", "exam_mode", ExamMode),
                ("exam_sessions", "status", ExamStatus),
                ("exam_answers", "confidence_level", ConfidenceLevel),
                ("interview_questions", "round_type", InterviewRoundType),
                ("subjects", "kind", SubjectKind),
            ]
            for table, column, enum_cls in enum_columns:
                exists = conn.execute(text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=:t"
                ), {"t": table}).fetchone()
                if not exists:
                    continue
                names = {m.name for m in enum_cls}
                lookup = {m.name.lower(): m.name for m in enum_cls}
                lookup.update({str(m.value).lower(): m.name for m in enum_cls})
                rows = conn.execute(text(
                    f"SELECT DISTINCT {column} FROM {table} WHERE {column} IS NOT NULL"
                )).fetchall()
                for (raw,) in rows:
                    if raw in names:
                        continue
                    target = lookup.get(str(raw).lower())
                    if target is None:
                        from app.core.logging_config import logger
                        logger.warning(
                            "%s.%s holds %r, which is not a %s. Left as it is -- "
                            "reading those rows will fail until it is corrected by hand.",
                            table, column, raw, enum_cls.__name__,
                        )
                        continue
                    conn.execute(
                        text(f"UPDATE {table} SET {column} = :target WHERE {column} = :raw"),
                        {"target": target, "raw": raw},
                    )
            conn.commit()
        except Exception as exc:
            _log_migration_failure("enum column values", exc)

        try:
            # exam_sessions.source: where the row came from. Defaults to
            # 'learner' so that ordinary history keeps counting -- a row whose
            # provenance is unknown belongs to the learner until something
            # proves otherwise.
            table_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='exam_sessions'"
            )).fetchone()
            if table_exists:
                result = conn.execute(text("PRAGMA table_info(exam_sessions)")).fetchall()
                columns = [row[1] for row in result]
                if "source" not in columns:
                    conn.execute(text(
                        "ALTER TABLE exam_sessions ADD COLUMN source VARCHAR(10) "
                        "NOT NULL DEFAULT 'learner'"
                    ))
                    # The one quarantine this migration performs, and the only
                    # rows it can perform it on honestly.
                    #
                    # "UnitTestCert-" is generated by tests/test_analytics.py
                    # and by nothing else in the product -- no import path, no
                    # seed, no UI can produce it. A session carrying that
                    # certification is provably a regression test that was run
                    # against a working database, so marking it is a
                    # statement of fact rather than a guess.
                    #
                    # Abandoned and low-scoring sessions are deliberately NOT
                    # touched. A paper someone walked away from is still
                    # something they did, and reclassifying it to make the
                    # averages look better would be fabricating provenance --
                    # the same failure as fabricating a score. Those sessions
                    # are drills, so they never reach readiness anyway.
                    conn.execute(text(
                        "UPDATE exam_sessions SET source = 'test' "
                        "WHERE certification LIKE 'UnitTestCert-%'"
                    ))
                    conn.commit()
        except Exception as exc:
            _log_migration_failure("exam_sessions.source", exc)

    _raise_if_migrations_failed()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
