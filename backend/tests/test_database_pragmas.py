"""
test_database_pragmas.py

Guards the SQLite connection pragmas that the app's correctness depends on,
against the *test* engine specifically.

app/core/database.py registers its pragma listener against one Engine
instance. tests/conftest.py builds a second, isolated engine for the test
database -- which for a long time never received that listener, so the whole
suite ran with SQLite's default foreign_keys=OFF. The practical effect: every
`ondelete="CASCADE"` in the models silently did nothing under test. A bulk
delete of a parent row left its children orphaned in tests while behaving
correctly in the real app, and SQLite reuses rowids once a table empties, so
those orphans could later re-attach themselves to a freshly inserted parent.
"""

import uuid
from sqlalchemy import text
from fastapi.testclient import TestClient

from app.main import app
from app.models.question import Question
from app.models.option import QuestionOption
from tests.conftest import TestingSessionLocal

client = TestClient(app)


def test_test_engine_enforces_foreign_keys():
    db = TestingSessionLocal()
    try:
        assert db.execute(text("PRAGMA foreign_keys")).scalar() == 1
    finally:
        db.close()


def test_test_engine_uses_wal_journal_mode():
    db = TestingSessionLocal()
    try:
        assert db.execute(text("PRAGMA journal_mode")).scalar().lower() == "wal"
    finally:
        db.close()


def test_bulk_deleting_a_question_cascades_to_its_options():
    """
    Deliberately uses a bulk Query.delete() rather than session.delete().

    session.delete() would prove nothing here: the ORM-level
    cascade="all, delete-orphan" on Question.options removes children in
    Python regardless of any database pragma. Only a bulk delete bypasses the
    ORM and leaves enforcement entirely to SQLite's ON DELETE CASCADE, which
    is exactly the path that was silently broken.
    """
    res = client.post(
        "/api/v1/questions",
        json={
            "text": f"Cascade pragma probe {uuid.uuid4().hex}",
            "question_type": "single_choice",
            "options": [
                {"option_text": "A", "is_correct": True, "order_index": 0},
                {"option_text": "B", "is_correct": False, "order_index": 1},
            ],
        },
    )
    assert res.status_code == 201
    question_id = res.json()["id"]

    db = TestingSessionLocal()
    try:
        assert db.query(QuestionOption).filter(QuestionOption.question_id == question_id).count() == 2

        db.query(Question).filter(Question.id == question_id).delete(synchronize_session=False)
        db.commit()

        assert db.query(QuestionOption).filter(QuestionOption.question_id == question_id).count() == 0
    finally:
        db.close()
