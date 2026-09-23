# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
How a validated batch is written: a chunk at a time, verified, and redone row by
row if the chunk fails.

Written row by row with a savepoint and a verification query each, a 2,000-question
import took 45 seconds and 12,000 statements. It now takes two statements per
chunk -- but the guarantees that were paid for row by row have to survive: every
option that was promised is in the database, and one bad row is named and skipped
rather than taking its neighbours down with it.
"""
import uuid

import pytest

from app.models.option import QuestionOption
from app.models.question import Question
from app.schemas.question import QuestionCreate
from app.services.import_service import ImportService


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _question(text: str, options: int = 2) -> QuestionCreate:
    return QuestionCreate(
        text=text, question_type="single_choice", difficulty="medium", domain="Batch", topic="Writes",
        certification=f"Batch Cert {uuid.uuid4().hex[:6]}", explanation="Because.",
        options=[{"option_text": f"Option {i}", "is_correct": i == 0} for i in range(options)],
    )


def _cleanup(db, texts):
    ids = [q.id for q in db.query(Question).filter(Question.text.in_(texts)).all()]
    if ids:
        db.query(Question).filter(Question.id.in_(ids)).delete(synchronize_session=False)
        db.commit()


def test_a_batch_lands_with_every_option_it_promised(db):
    tag = uuid.uuid4().hex[:8]
    batch = [_question(f"Batch write {tag} #{i}", options=2 + (i % 3)) for i in range(5)]
    texts = [q.text for q in batch]
    try:
        result = ImportService(db).import_validated_batch(batch)
        assert (result.success_count, result.failed_count) == (5, 0)

        saved = db.query(Question).filter(Question.text.in_(texts)).all()
        assert len(saved) == 5
        for question, wanted in zip(sorted(saved, key=lambda q: q.text), sorted(batch, key=lambda q: q.text)):
            options = db.query(QuestionOption).order_by(QuestionOption.id).filter(
                QuestionOption.question_id == question.id
            ).all()
            # Order comes from the order they were written, since an imported option
            # carries no order_index of its own (the schema defaults it to 0).
            assert [o.option_text for o in options] == [o.option_text for o in wanted.options]
            assert sum(1 for o in options if o.is_correct) == 1
    finally:
        _cleanup(db, texts)


def test_a_chunk_that_fails_is_redone_one_question_at_a_time(db, monkeypatch):
    """The bad row is named and skipped; the rest of its chunk still lands."""
    tag = uuid.uuid4().hex[:8]
    batch = [_question(f"Batch retry {tag} #{i}") for i in range(4)]
    batch[2] = _question(f"Batch retry {tag} #poison")
    texts = [q.text for q in batch]

    written = ImportService._write_chunk

    def refuses_the_poison(self, chunk, owner_of):
        if any("poison" in q.text for q in chunk):
            raise RuntimeError("the database refused this write")
        return written(self, chunk, owner_of)

    monkeypatch.setattr(ImportService, "_write_chunk", refuses_the_poison)
    try:
        result = ImportService(db).import_validated_batch(batch)

        assert (result.success_count, result.failed_count) == (3, 1)
        assert result.errors == ["Question 3: the database refused this write"]
        landed = {q.text for q in db.query(Question).filter(Question.text.in_(texts)).all()}
        assert landed == {t for t in texts if "poison" not in t}
    finally:
        monkeypatch.undo()
        _cleanup(db, texts)


def test_options_that_do_not_land_fail_the_write_rather_than_passing_quietly(db, monkeypatch):
    """The count is read back from the database, because options have gone missing
    on this app twice while the objects in memory said they were there."""
    tag = uuid.uuid4().hex[:8]
    batch = [_question(f"Batch verify {tag} #{i}") for i in range(2)]
    texts = [q.text for q in batch]

    from app.repositories.question_repository import QuestionRepository

    monkeypatch.setattr(QuestionRepository, "count_options_for_questions", lambda self, ids: 0)
    try:
        result = ImportService(db).import_validated_batch(batch)

        assert result.success_count == 0
        assert result.failed_count == 2
        assert all("Option count mismatch" in message for message in result.errors)
        assert db.query(Question).filter(Question.text.in_(texts)).count() == 0
    finally:
        monkeypatch.undo()
        _cleanup(db, texts)
