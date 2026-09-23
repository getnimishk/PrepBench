# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Spaced repetition as cards: recalled, revealed, graded, and the schedule moved.

What these hold: the deck is one preparation's due questions, most overdue first;
the interval each grade previews is the interval grading then sets; a grade is
persisted; and a card cannot be graded twice for one recall.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db, register_sqlite_pragmas
from app.core.exceptions import ConflictException, ResourceNotFoundException
from app.core.timeutils import utc_now_naive
from app.main import app
from app.models.option import QuestionOption
from app.models.question import Question
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject import Subject, SubjectKind
from app.services.sm2_service import SM2Service
from app.services.spaced_review_service import GRADE_QUALITY, SpacedReviewService


@pytest.fixture
def db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'spaced.db'}", connect_args={"check_same_thread": False}
    )
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _subject(db, name) -> Subject:
    subject = Subject(
        name=name, slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}", kind=SubjectKind.CERTIFICATION,
        certification=f"{name} cert", pass_mark=70.0, exam_question_count=3, exam_minutes=30,
    )
    db.add(subject)
    db.commit()
    return subject


def _due(db, subject, overdue_days=1, repetition=2, interval=6, ease=2.5, text=None) -> Question:
    q = Question(
        text=text or f"Q {uuid.uuid4().hex[:8]}", question_type="single_choice", difficulty="medium",
        domain="Scrum Events", topic="Sprint Review", subject_id=subject.id,
        explanation="Because the Scrum Guide says so.",
    )
    db.add(q)
    db.flush()
    db.add(QuestionOption(question_id=q.id, option_text="Wrong", is_correct=False, order_index=0))
    db.add(QuestionOption(question_id=q.id, option_text="Right", is_correct=True, order_index=1))
    db.add(SpacedRepetition(
        question_id=q.id, repetition=repetition, interval_days=interval, ease_factor=ease,
        next_review_date=utc_now_naive() - timedelta(days=overdue_days),
    ))
    db.commit()
    return q


def test_the_deck_is_one_preparations_due_cards_most_overdue_first(db):
    mine = _subject(db, "Mine")
    theirs = _subject(db, "Theirs")
    recent = _due(db, mine, overdue_days=1)
    oldest = _due(db, mine, overdue_days=9)
    _due(db, theirs, overdue_days=30)
    not_yet = _due(db, mine, overdue_days=-3)  # due in three days

    deck = SpacedReviewService(db).deck(mine, limit=8)

    assert [c["question_id"] for c in deck["cards"]] == [oldest.id, recent.id]
    assert deck["due_total"] == 2
    assert not_yet.id not in {c["question_id"] for c in deck["cards"]}


def test_a_card_carries_its_answer_and_what_each_grade_would_schedule(db):
    subject = _subject(db, "Cards")
    q = _due(db, subject, repetition=2, interval=6, ease=2.5)

    card = SpacedReviewService(db).deck(subject, limit=8)["cards"][0]

    assert card["answer"] == ["Right"]
    assert card["explanation"] == "Because the Scrum Guide says so."
    for grade, quality in GRADE_QUALITY.items():
        assert card["intervals"][grade] == SM2Service.next_schedule(2, 6, 2.5, quality)[1]
    assert card["intervals"]["again"] == 1
    assert card["intervals"]["easy"] > card["intervals"]["hard"]
    assert q.id == card["question_id"]


def test_the_limit_is_a_slice_and_the_total_is_everything_due(db):
    subject = _subject(db, "Many")
    for days in range(1, 12):
        _due(db, subject, overdue_days=days)

    deck = SpacedReviewService(db).deck(subject, limit=8)

    assert len(deck["cards"]) == 8
    assert deck["due_total"] == 11


def test_grading_persists_the_interval_the_card_previewed(db):
    subject = _subject(db, "Grade")
    q = _due(db, subject, repetition=2, interval=6, ease=2.5)
    service = SpacedReviewService(db)
    previewed = service.deck(subject, limit=8)["cards"][0]["intervals"]["good"]

    result = service.grade(q.id, "good")

    db.expire_all()
    item = db.query(SpacedRepetition).filter_by(question_id=q.id).one()
    assert result["interval_days"] == previewed == item.interval_days
    assert item.repetition == 3
    assert item.last_reviewed_at is not None
    assert item.next_review_date > utc_now_naive()
    assert service.deck(subject, limit=8)["cards"] == [], "a graded card is no longer due"


def test_again_is_a_failed_recall_and_starts_the_item_over(db):
    subject = _subject(db, "Again")
    q = _due(db, subject, repetition=4, interval=30, ease=2.6)

    SpacedReviewService(db).grade(q.id, "again")

    item = db.query(SpacedRepetition).filter_by(question_id=q.id).one()
    assert (item.repetition, item.interval_days) == (0, 1)
    assert item.ease_factor < 2.6


def test_a_card_cannot_be_graded_twice_for_one_recall(db):
    subject = _subject(db, "Twice")
    q = _due(db, subject)
    service = SpacedReviewService(db)
    service.grade(q.id, "easy")
    after_first = db.query(SpacedRepetition).filter_by(question_id=q.id).one().interval_days

    with pytest.raises(ConflictException):
        service.grade(q.id, "easy")

    db.expire_all()
    assert db.query(SpacedRepetition).filter_by(question_id=q.id).one().interval_days == after_first


def test_grading_something_never_scheduled_is_not_found(db):
    with pytest.raises(ResourceNotFoundException):
        SpacedReviewService(db).grade(999_999, "good")


def test_the_api_refuses_a_grade_it_does_not_know(db):
    def override():
        yield db

    app.dependency_overrides[get_db] = override
    try:
        client = TestClient(app)
        subject = _subject(db, "Api")
        q = _due(db, subject)

        refused = client.post("/api/v1/spaced/grades", json={"question_id": q.id, "grade": "perfect"})
        assert refused.status_code == 422

        deck = client.get("/api/v1/spaced/deck", params={"subject_id": subject.id}).json()
        assert deck["due_total"] == 1

        graded = client.post("/api/v1/spaced/grades", json={"question_id": q.id, "grade": "hard"})
        assert graded.status_code == 200, graded.text
        assert client.post("/api/v1/spaced/grades", json={"question_id": q.id, "grade": "hard"}).status_code == 409
        assert client.get("/api/v1/spaced/deck", params={"subject_id": 424242}).status_code == 404
    finally:
        from tests.conftest import override_get_db

        app.dependency_overrides[get_db] = override_get_db
