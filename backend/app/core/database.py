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

def _log_migration_failure(step: str, exc: Exception) -> None:
    """
    A migration step is allowed to fail without stopping startup (a fresh
    database has nothing to alter, and create_all covers it), but it must not
    fail *silently*. Swallowing these turns a schema problem into a confusing
    "no such column" at first query, far from its cause.
    """
    # Imported lazily: logging_config configures handlers at import time, and
    # this module is imported early enough that a module-level import would
    # risk an import cycle through app.core.config.
    from app.core.logging_config import logger
    logger.error(f"Lightweight migration step '{step}' failed: {exc}")


def apply_lightweight_migrations():
    """Auto-add missing columns/indexes to existing SQLite database tables safely."""
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
