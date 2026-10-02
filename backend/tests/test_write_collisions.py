# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Two writes of the same thing arriving at once.

Every test layer here sends one request at a time, so none of them could see
this: two requests that both look for a row, both find none, and both insert.
A unique constraint stops the second, and an IntegrityError nobody caught was a
500 -- the exam answer save was the first found (test_exam_engine.py); these
are the rest of the look-then-insert writes behind a unique constraint.

Each test reproduces the race deterministically: the row already exists, and
the lookup is made to answer "no row" once, exactly as the second of two
concurrent requests would have seen it. So the insert really collides.
"""

import uuid
from datetime import datetime, UTC

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ConflictException
from app.main import app
from app.models.exam_answer import ConfidenceLevel
from app.models.llm_config import LLMTaskBinding
from app.models.recording_analysis import RecordingAnalysis
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject_content_pack import SubjectContentPack
from tests.conftest import TestingSessionLocal

client = TestClient(app)


def sees_no_row_once(monkeypatch, cls, method_name):
    """Make cls.method_name return None on its first call only. Returns the call count."""
    real = getattr(cls, method_name)
    calls = {"n": 0}

    def patched(self, *args, **kwargs):
        calls["n"] += 1
        return None if calls["n"] == 1 else real(self, *args, **kwargs)

    monkeypatch.setattr(cls, method_name, patched)
    return calls


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _question() -> int:
    res = client.post("/api/v1/questions", json={
        "text": f"Collision question {uuid.uuid4().hex}",
        "question_type": "single_choice",
        "certification": uuid.uuid4().hex,
        "options": [
            {"option_text": "Right", "is_correct": True, "order_index": 0},
            {"option_text": "Wrong", "is_correct": False, "order_index": 1},
        ],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_two_first_schedulings_of_a_question_move_one_schedule(db, monkeypatch):
    """Two papers finished at once that share a never-scheduled question.

    The insert used to flush inside the finish's transaction and raise there:
    the finish failed half way, after the paper was already marked complete,
    so a retry skipped it and the rest of its questions were never scheduled.
    """
    from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository
    from app.services.sm2_service import SM2Service

    question_id = _question()
    SM2Service.update_item(db, question_id, True, ConfidenceLevel.HIGH)  # the request that won

    calls = sees_no_row_once(monkeypatch, SpacedRepetitionRepository, "get_by_question")
    item = SM2Service.update_item(db, question_id, True, ConfidenceLevel.HIGH)

    assert calls["n"] == 1, "the lookup should have missed and the create collided"
    rows = db.query(SpacedRepetition).filter_by(question_id=question_id).all()
    assert len(rows) == 1
    # Both recalls moved the one schedule: two passes, two repetitions.
    assert rows[0].id == item.id
    assert rows[0].repetition == 2


def test_a_scheduling_collision_leaves_the_rest_of_the_transaction_alone(db, monkeypatch):
    """The finish writes other rows in the same transaction before scheduling.

    A collision must not throw those away -- the reason it is ON CONFLICT DO
    NOTHING rather than a rollback.
    """
    from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository
    from app.services.sm2_service import SM2Service

    first, second = _question(), _question()
    SM2Service.update_item(db, first, True, ConfidenceLevel.HIGH)

    # Pending, uncommitted work in the same session: the second question's schedule.
    pending = SpacedRepetitionRepository(db).create_for_question(second, datetime.now(UTC).replace(tzinfo=None))
    assert pending.question_id == second

    sees_no_row_once(monkeypatch, SpacedRepetitionRepository, "get_by_question")
    SM2Service.update_item(db, first, False, ConfidenceLevel.LOW)  # collides, commits

    assert db.query(SpacedRepetition).filter_by(question_id=second).count() == 1, \
        "the other question's pending schedule survived the collision"


def test_two_first_analyses_of_a_recording_end_as_one_row(db, monkeypatch):
    from app.repositories.recording_repository import PracticeRecordingRepository, RecordingAnalysisRepository

    recording = PracticeRecordingRepository(db).create(
        title="Collision recording", file_path="collision.webm", mime_type="audio/webm",
        duration_seconds=3, file_size_bytes=10,
    )
    repo = RecordingAnalysisRepository(db)
    repo.upsert(recording.id, analysis_status="unavailable")

    sees_no_row_once(monkeypatch, RecordingAnalysisRepository, "get_by_recording_id")
    saved = repo.upsert(recording.id, analysis_status="analyzed")

    rows = db.query(RecordingAnalysis).filter_by(recording_id=recording.id).all()
    assert len(rows) == 1
    assert rows[0].id == saved.id
    assert rows[0].analysis_status == "analyzed", "the later analysis wins"


def test_two_first_saves_of_a_task_routing_end_as_one_row(db, monkeypatch):
    from app.repositories.llm_repository import LLMConfigRepository

    repo = LLMConfigRepository(db)
    task = "content_validation"
    original = repo.get_binding(task)
    original_values = (original.provider_config_id, original.model) if original else None
    try:
        repo.upsert_binding(task, None, "first-model")

        sees_no_row_once(monkeypatch, LLMConfigRepository, "get_binding")
        saved = repo.upsert_binding(task, None, "second-model")

        rows = db.query(LLMTaskBinding).filter_by(task=task).all()
        assert len(rows) == 1
        assert rows[0].id == saved.id
        assert rows[0].model == "second-model", "the later save wins"
    finally:
        monkeypatch.undo()
        if original_values is None:
            db.query(LLMTaskBinding).filter_by(task=task).delete()
            db.commit()
        else:
            repo.upsert_binding(task, *original_values)


def test_a_settings_save_racing_the_first_read_updates_the_one_row(db, monkeypatch):
    from app.repositories.settings_repository import SettingsRepository

    repo = SettingsRepository(db)
    current = repo.get_or_create()
    db.expunge_all()  # two real requests are two sessions; this one must not already hold the row
    theme = current.theme

    sees_no_row_once(monkeypatch, SettingsRepository, "get")
    saved = repo.update({"theme": theme})  # the same value: nothing else in the suite moves

    assert saved.id == current.id
    assert saved.theme == theme


def test_a_double_attached_pack_is_already_attached_not_a_500(db, monkeypatch):
    from app.services import content_pack_service

    created = client.post("/api/v1/subjects", json={"name": f"Collision skill {uuid.uuid4().hex[:8]}", "kind": "skill"})
    assert created.status_code == 201, created.text
    subject_id = created.json()["id"]
    attached = client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    assert attached.status_code == 201, attached.text

    real = content_pack_service._attached
    calls = {"n": 0}

    def misses_once(*args, **kwargs):
        calls["n"] += 1
        return None if calls["n"] == 1 else real(*args, **kwargs)

    monkeypatch.setattr(content_pack_service, "_attached", misses_once)
    with pytest.raises(ConflictException, match="already has"):
        content_pack_service.attach(db, subject_id, "adf")
    assert db.query(SubjectContentPack).filter_by(subject_id=subject_id, pack_id="adf").count() == 1


def test_two_preparations_created_at_once_with_one_name_get_a_conflict_not_a_500(db, monkeypatch):
    from app.repositories.subject_repository import SubjectRepository
    from app.schemas.subject import SubjectCreate
    from app.services.subject_service import SubjectService

    name = f"Collision prep {uuid.uuid4().hex[:8]}"
    assert client.post("/api/v1/subjects", json={"name": name, "kind": "skill"}).status_code == 201

    sees_no_row_once(monkeypatch, SubjectRepository, "get_by_name")
    with pytest.raises(ConflictException, match="already exists"):
        SubjectService(db).create(SubjectCreate(name=name, kind="skill"))


def test_a_slug_taken_in_the_meantime_is_derived_again(db, monkeypatch):
    """Two different names can reduce to the same slug; the later create re-derives it."""
    from app.services.subject_service import SubjectService
    from app.schemas.subject import SubjectCreate

    taken = client.post("/api/v1/subjects", json={"name": f"Slug taken {uuid.uuid4().hex[:8]}", "kind": "skill"})
    assert taken.status_code == 201, taken.text
    taken_slug = taken.json()["slug"]

    real = SubjectService._unique_slug
    calls = {"n": 0}

    def stale_the_first_time(self, name):
        calls["n"] += 1
        return taken_slug if calls["n"] == 1 else real(self, name)

    monkeypatch.setattr(SubjectService, "_unique_slug", stale_the_first_time)
    subject, result = SubjectService(db).create(SubjectCreate(name=f"Another {uuid.uuid4().hex[:8]}", kind="skill"))

    assert calls["n"] == 2, "the first slug collided and was derived again"
    assert result.slug != taken_slug
