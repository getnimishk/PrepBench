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
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

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
        except Exception:
            pass

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
        except Exception:
            pass

        try:
            # Check questions columns
            result = conn.execute(text("PRAGMA table_info(questions)")).fetchall()
            columns = [row[1] for row in result]
            if "is_reviewed" not in columns and len(columns) > 0:
                conn.execute(text("ALTER TABLE questions ADD COLUMN is_reviewed BOOLEAN DEFAULT 0"))
                conn.commit()
        except Exception:
            pass

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
        except Exception:
            pass

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
        except Exception:
            pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
