# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Interview questions saved from built-in content (skills plan Phase 3, task 4).

A scenario's Say-it answer goes into the learner's interview question library
with `subject_id` (the Skill it came from) and `source_ref` (which scenario,
lens and pack version). Saving it again updates that row; it never adds a
second copy.

The migration tests build their own throwaway SQLite file, in the exact shape
an existing install's `interview_questions` table has on disk (read from a copy
of one), so nothing here touches the suite's shared database.
"""
import sqlite3
import uuid

import pytest
from sqlalchemy import create_engine, text

from app.core.database import Base, register_sqlite_pragmas


# ---- the migration ---------------------------------------------------------

# An existing install's table, as it is on disk before this phase: round_type a
# plain VARCHAR(14) holding enum names, no CHECK constraint, and the two
# answer-plan columns added by an earlier ALTER TABLE.
LEGACY_INTERVIEW_QUESTIONS = """
    CREATE TABLE interview_questions (
        id INTEGER NOT NULL,
        round_type VARCHAR(14) NOT NULL,
        question_text TEXT NOT NULL,
        category VARCHAR(150),
        is_ai_generated BOOLEAN DEFAULT '0' NOT NULL,
        source_topic VARCHAR(200),
        created_at DATETIME, prepared_answer TEXT, key_talking_points JSON,
        PRIMARY KEY (id)
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


@pytest.fixture
def legacy_db(tmp_path, monkeypatch):
    path = tmp_path / "legacy.db"
    raw = sqlite3.connect(path)
    raw.execute(LEGACY_SUBJECTS)
    raw.execute(LEGACY_INTERVIEW_QUESTIONS)
    raw.execute(
        "INSERT INTO interview_questions (round_type, question_text, category) "
        "VALUES ('BEHAVIORAL', 'Tell me about a time you failed.', 'Self-Awareness')"
    )
    raw.execute(
        "INSERT INTO interview_questions (round_type, question_text) "
        "VALUES ('HR_SCREENING', 'Why this role?')"
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


def _indexes(engine, table):
    with engine.connect() as conn:
        return {
            row[1]: bool(row[2])
            for row in conn.execute(text(f"PRAGMA index_list({table})")).fetchall()
        }


def test_the_migration_adds_subject_id_and_source_ref_and_keeps_every_row(legacy_db):
    assert "subject_id" not in _columns(legacy_db, "interview_questions")
    assert "source_ref" not in _columns(legacy_db, "interview_questions")

    _migrate()

    assert {"subject_id", "source_ref"} <= set(_columns(legacy_db, "interview_questions"))
    assert _indexes(legacy_db, "interview_questions").get("uq_interview_questions_source") is True
    with legacy_db.connect() as conn:
        rows = conn.execute(text(
            "SELECT round_type, question_text, subject_id, source_ref FROM interview_questions ORDER BY id"
        )).fetchall()
    assert [tuple(r) for r in rows] == [
        ("BEHAVIORAL", "Tell me about a time you failed.", None, None),
        ("HR_SCREENING", "Why this role?", None, None),
    ]


def test_running_the_migration_twice_changes_nothing(legacy_db):
    _migrate()
    first = (_columns(legacy_db, "interview_questions"), _indexes(legacy_db, "interview_questions"))
    _migrate()
    assert (_columns(legacy_db, "interview_questions"), _indexes(legacy_db, "interview_questions")) == first


def test_an_upgraded_table_matches_a_fresh_one(legacy_db, tmp_path):
    _migrate()

    fresh = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(fresh)
    Base.metadata.create_all(bind=fresh)
    try:
        assert set(_columns(legacy_db, "interview_questions")) == set(_columns(fresh, "interview_questions"))
        upgraded = _indexes(legacy_db, "interview_questions")
        created = _indexes(fresh, "interview_questions")
        for name in ("uq_interview_questions_source", "ix_interview_questions_subject_id"):
            assert name in created, f"{name} missing on a fresh database"
            assert upgraded.get(name) == created[name], f"{name} differs between upgraded and fresh"
    finally:
        fresh.dispose()


def test_a_technical_row_reads_back_on_an_upgraded_database(legacy_db):
    """TECHNICAL fits the existing VARCHAR(14) and nothing constrains it: no data migration."""
    _migrate()
    with legacy_db.connect() as conn:
        conn.execute(text(
            "INSERT INTO interview_questions (round_type, question_text) VALUES ('TECHNICAL', 'How does it break?')"
        ))
        conn.commit()

    from sqlalchemy.orm import sessionmaker
    from app.models.interview_question import InterviewQuestion, InterviewRoundType

    session = sessionmaker(bind=legacy_db)()
    try:
        technical = session.query(InterviewQuestion).filter(
            InterviewQuestion.round_type == InterviewRoundType.TECHNICAL
        ).all()
        assert [q.question_text for q in technical] == ["How does it break?"]
    finally:
        session.close()


# ---- saving by source --------------------------------------------------------


def _skill(client, name=None):
    name = name or f"ADF skill {uuid.uuid4().hex[:6]}"
    res = client.post("/api/v1/subjects", json={"name": name, "kind": "skill"})
    assert res.status_code in (200, 201), res.text
    body = res.json()
    return body.get("subject", body)


def _save(client, **overrides):
    payload = {
        "source_ref": f"adf@1/scenario/1/lens/po/{uuid.uuid4().hex[:6]}",
        "question_text": "How would you make sure a nightly incremental load doesn't lose or duplicate data?",
        "prepared_answer": "A watermark that only moves after a successful copy.",
        "key_talking_points": ["Name the pattern", "Name the two risks"],
        "category": "Azure Data Factory",
    }
    payload.update(overrides)
    return client.put("/api/v1/interview-questions/by-source", json=payload)


def test_saving_a_source_creates_a_technical_question_tied_to_the_skill(client):
    skill = _skill(client)
    res = _save(client, subject_id=skill["id"])
    assert res.status_code == 200, res.text
    body = res.json()

    assert body["created"] is True
    q = body["question"]
    assert q["round_type"] == "technical"
    assert q["subject_id"] == skill["id"]
    assert q["prepared_answer"].startswith("A watermark")
    assert q["key_talking_points"] == ["Name the pattern", "Name the two risks"]
    assert q["category"] == "Azure Data Factory"
    assert q["is_ai_generated"] is False


def test_saving_the_same_source_again_updates_that_row(client):
    skill = _skill(client)
    ref = f"adf@1/scenario/1/lens/dm/{uuid.uuid4().hex[:6]}"
    first = _save(client, source_ref=ref, subject_id=skill["id"]).json()["question"]

    # The learner renames the category in the library; a re-save must not undo that.
    # As the owning preparation: its own question is not reachable without it.
    renamed = client.put(f"/api/v1/interview-questions/{first['id']}", json={"category": "My ADF prep"},
                         params={"subject_id": skill["id"]})
    assert renamed.status_code == 200, renamed.text

    second = _save(
        client, source_ref=ref, subject_id=skill["id"],
        prepared_answer="Watermark on success, count check, merge on the key.",
        key_talking_points=["One point now"],
    )
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["created"] is False
    assert body["question"]["id"] == first["id"]
    assert body["question"]["prepared_answer"] == "Watermark on success, count check, merge on the key."
    assert body["question"]["key_talking_points"] == ["One point now"]
    assert body["question"]["category"] == "My ADF prep"

    matches = client.get("/api/v1/interview-questions", params={"source_ref": ref, "subject_id": skill["id"]}).json()
    assert matches["total"] == 1


def test_the_library_filters_by_source_and_by_preparation(client):
    skill = _skill(client)
    other = _skill(client)
    mine = _save(client, subject_id=skill["id"]).json()["question"]
    _save(client, subject_id=other["id"])

    by_subject = client.get("/api/v1/interview-questions", params={"subject_id": skill["id"]}).json()
    assert [q["id"] for q in by_subject["items"]] == [mine["id"]]

    by_ref = client.get("/api/v1/interview-questions",
                        params={"source_ref": mine["source_ref"], "subject_id": skill["id"]}).json()
    assert [q["id"] for q in by_ref["items"]] == [mine["id"]]

    # The round filter the library's tabs use still sees it, in its own preparation.
    technical = client.get("/api/v1/interview-questions",
                           params={"round_type": "technical", "limit": 500, "subject_id": skill["id"]}).json()
    assert mine["id"] in {q["id"] for q in technical["items"]}

    # With no preparation the library is the shared one -- never a preparation's own
    # questions (Phase 8): neither skill's saved question is listed there.
    shared = client.get("/api/v1/interview-questions", params={"limit": 500}).json()
    assert all(q["subject_id"] is None for q in shared["items"])
    assert mine["id"] not in {q["id"] for q in shared["items"]}
    assert client.get("/api/v1/interview-questions", params={"source_ref": mine["source_ref"]}).json()["total"] == 0


def test_an_unknown_preparation_is_refused(client):
    res = _save(client, subject_id=987654321)
    assert res.status_code == 404


def test_an_empty_source_ref_is_refused(client):
    assert _save(client, source_ref="").status_code == 422


def test_deleting_the_skill_keeps_the_question_and_drops_the_link(client):
    skill = _skill(client)
    saved = _save(client, subject_id=skill["id"]).json()["question"]

    res = client.request(
        "DELETE", f"/api/v1/subjects/{skill['id']}", json={"confirm_name": skill["name"]},
    )
    assert res.status_code == 200, res.text

    kept = client.get(f"/api/v1/interview-questions/{saved['id']}").json()
    assert kept["id"] == saved["id"]
    assert kept["subject_id"] is None
    assert kept["source_ref"] == saved["source_ref"]


def test_two_skills_with_the_same_pack_keep_their_own_question(client):
    """source_ref names the content, not the learner's preparation: each Skill gets its own row."""
    ref = f"adf@1/scenario/1/lens/po/{uuid.uuid4().hex[:6]}"
    first_skill, second_skill = _skill(client), _skill(client)
    first = _save(client, source_ref=ref, subject_id=first_skill["id"], prepared_answer="First skill's answer.").json()
    second = _save(client, source_ref=ref, subject_id=second_skill["id"], prepared_answer="Second skill's answer.").json()

    assert first["created"] is True and second["created"] is True
    assert first["question"]["id"] != second["question"]["id"]
    kept = client.get(f"/api/v1/interview-questions/{first['question']['id']}",
                      params={"subject_id": first_skill["id"]}).json()
    assert kept["prepared_answer"] == "First skill's answer."
    assert kept["subject_id"] == first_skill["id"]


def test_a_first_save_that_loses_a_race_updates_the_winner(client, monkeypatch):
    """Two first saves of one source at once: the loser updates, it doesn't 500."""
    from app.repositories.interview_question_repository import InterviewQuestionRepository

    skill = _skill(client)
    ref = f"adf@1/scenario/2/lens/em/{uuid.uuid4().hex[:6]}"
    winner = _save(client, source_ref=ref, subject_id=skill["id"]).json()["question"]

    real = InterviewQuestionRepository.get_by_source
    calls = {"n": 0}

    def looks_empty_once(self, source_ref, subject_id):
        calls["n"] += 1
        return None if calls["n"] == 1 else real(self, source_ref, subject_id)

    monkeypatch.setattr(InterviewQuestionRepository, "get_by_source", looks_empty_once)
    res = _save(client, source_ref=ref, subject_id=skill["id"], prepared_answer="The later answer.")

    assert res.status_code == 200, res.text
    assert res.json()["created"] is False
    assert res.json()["question"]["id"] == winner["id"]
    assert res.json()["question"]["prepared_answer"] == "The later answer."
