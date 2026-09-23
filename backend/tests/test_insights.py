# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Insights, per preparation, and one area in detail.

What these hold: every figure is computed from answers that were given, in the
preparation that was asked about and no other; an area with nothing answered
reports nothing measured rather than 0%; the questions are ranked by what needs
doing; and the readiness verdict carries the rule's own numbers, so a surface
can say what would change it without keeping a copy of them.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db, register_sqlite_pragmas
from app.core.exceptions import ResourceNotFoundException
from app.core.timeutils import utc_now_naive
from app.main import app
from app.models.exam_answer import ConfidenceLevel, ExamAnswer
from app.models.exam_session import ExamMode, ExamSession, ExamStatus
from app.models.question import Question
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject import Subject, SubjectKind
from app.services import readiness
from app.services.analytics_service import AnalyticsService
from app.services.spaced_review_service import SpacedReviewService


@pytest.fixture
def db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'insights.db'}", connect_args={"check_same_thread": False}
    )
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db):
    def override():
        yield db

    app.dependency_overrides[get_db] = override
    try:
        yield TestClient(app)
    finally:
        from tests.conftest import override_get_db

        app.dependency_overrides[get_db] = override_get_db


def _subject(db, name: str) -> Subject:
    subject = Subject(
        name=name, slug=f"{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}",
        kind=SubjectKind.CERTIFICATION, certification=f"{name} cert {uuid.uuid4().hex[:6]}",
        pass_mark=85.0, exam_question_count=10, exam_minutes=30,
    )
    db.add(subject)
    db.commit()
    return subject


def _question(db, subject: Subject, domain: str, topic: str = "Sprint Planning") -> Question:
    q = Question(
        text=f"Q {uuid.uuid4().hex[:8]}", question_type="single_choice", difficulty="medium",
        domain=domain, topic=topic, certification=subject.certification, subject_id=subject.id,
    )
    db.add(q)
    db.commit()
    return q


def _answered(db, subject: Subject, *pairs, kind: str = "drill", score: float | None = None,
              title: str = "Session", ended_days_ago: int = 0) -> ExamSession:
    """A completed session the learner sat, with one answer per (question, is_correct)."""
    ended = utc_now_naive() - timedelta(days=ended_days_ago)
    session = ExamSession(
        title=title, exam_mode=ExamMode.PRACTICE, status=ExamStatus.COMPLETED,
        session_kind=kind, source="learner", subject_id=subject.id,
        certification=subject.certification, total_questions=len(pairs),
        question_ids_order=[q.id for q, _ in pairs], score_percentage=score,
        start_time=ended - timedelta(minutes=20), end_time=ended,
    )
    db.add(session)
    db.flush()
    for q, is_correct in pairs:
        db.add(ExamAnswer(
            session_id=session.id, question_id=q.id, selected_option_ids=[1],
            is_correct=is_correct, time_spent_seconds=10, confidence_level=ConfidenceLevel.NOT_SET,
        ))
    db.commit()
    return session


def _due(db, q: Question, overdue_days: int = 1) -> None:
    db.add(SpacedRepetition(
        question_id=q.id, repetition=1, interval_days=1, ease_factor=2.5,
        next_review_date=utc_now_naive() - timedelta(days=overdue_days),
    ))
    db.commit()


# ---- per preparation ---------------------------------------------------------------------


def test_domain_performance_counts_only_the_named_preparation(db, client):
    psm = _subject(db, "PSM")
    aws = _subject(db, "AWS")
    events = _question(db, psm, "Scrum Events")
    compute = _question(db, aws, "Compute")
    _answered(db, psm, (events, True))
    _answered(db, aws, (compute, False))

    mine = client.get("/api/v1/analytics/domain-performance", params={"subject_id": psm.id})
    assert mine.status_code == 200, mine.text
    assert [d["domain"] for d in mine.json()] == ["Scrum Events"]

    # Without a preparation it is still everything, as before.
    everything = {d["domain"] for d in client.get("/api/v1/analytics/domain-performance").json()}
    assert everything == {"Scrum Events", "Compute"}


def test_score_trends_count_only_the_named_preparations_sessions(db, client):
    psm = _subject(db, "PSM")
    aws = _subject(db, "AWS")
    _answered(db, psm, (_question(db, psm, "Scrum Events"), True), kind="mock", score=80.0, title="PSM mock")
    _answered(db, aws, (_question(db, aws, "Compute"), True), kind="mock", score=60.0, title="AWS mock")

    trend = client.get("/api/v1/analytics/score-trends", params={"subject_id": psm.id}).json()
    assert [p["exam_title"] for p in trend] == ["PSM mock"]


def test_an_unknown_preparation_is_not_found_rather_than_everything(db, client):
    for path in ("/api/v1/analytics/domain-performance", "/api/v1/analytics/score-trends"):
        response = client.get(path, params={"subject_id": 999_999})
        assert response.status_code == 404, path


# ---- one area ----------------------------------------------------------------------------


def test_an_area_is_read_from_the_answers_given_in_it(db):
    psm = _subject(db, "PSM")
    missed_then_right = _question(db, psm, "Scrum Events", "Sprint Planning (capacity)")
    always_right = _question(db, psm, "Scrum Events", "Sprint Planning: goal")
    never_seen = _question(db, psm, "Scrum Events", "Daily Scrum")
    missed_and_due = _question(db, psm, "Scrum Events", "Daily Scrum")
    _answered(db, psm, (missed_then_right, False), (always_right, True), (missed_and_due, False))
    _answered(db, psm, (missed_then_right, True), (always_right, True))
    _due(db, missed_and_due)

    detail = AnalyticsService(db).get_domain_detail(psm, "Scrum Events")

    assert (detail.answers, detail.correct, detail.accuracy_percentage) == (5, 3, 60.0)
    assert detail.question_count == 4
    assert detail.attempted_questions == 3
    # Answered wrong at least once, whatever came after.
    assert detail.missed_questions == 2
    assert detail.due_now == 1
    # Both sessions were drills, which have no review step to be behind on.
    assert detail.unreviewed_misses == 0

    # Missed first, then unseen, then going fine.
    assert [(q.id, q.state) for q in detail.questions] == [
        (missed_then_right.id, "missed"),
        (missed_and_due.id, "missed"),
        (never_seen.id, "unseen"),
        (always_right.id, "correct"),
    ]
    assert next(q for q in detail.questions if q.id == missed_and_due.id).due is True
    assert next(q for q in detail.questions if q.id == missed_then_right.id).times_answered == 2

    # "Sprint Planning (capacity)" and "Sprint Planning: goal" are one topic with
    # four answers; Daily Scrum has one answer, under the minimum, so it is not listed.
    assert [(t.topic, t.answers, t.correct) for t in detail.topics] == [("Sprint Planning", 4, 3)]


def test_an_area_with_questions_and_no_answers_reports_nothing_measured(db):
    psm = _subject(db, "PSM")
    _question(db, psm, "Scrum Artifacts")

    detail = AnalyticsService(db).get_domain_detail(psm, "Scrum Artifacts")

    assert detail.answers == 0
    assert detail.accuracy_percentage is None
    assert detail.topics == []
    assert [q.state for q in detail.questions] == ["unseen"]


def test_an_area_counts_nothing_from_another_preparation_with_the_same_area_name(db):
    psm = _subject(db, "PSM")
    other = _subject(db, "Other")
    mine = _question(db, psm, "Fundamentals")
    theirs = _question(db, other, "Fundamentals")
    _answered(db, psm, (mine, True))
    _answered(db, other, (theirs, False))
    _due(db, theirs)

    detail = AnalyticsService(db).get_domain_detail(psm, "Fundamentals")

    assert (detail.answers, detail.missed_questions, detail.due_now) == (1, 0, 0)
    assert [q.id for q in detail.questions] == [mine.id]


def test_an_area_the_preparation_does_not_have_is_not_found(db, client):
    psm = _subject(db, "PSM")
    with pytest.raises(ResourceNotFoundException):
        AnalyticsService(db).get_domain_detail(psm, "No Such Area")

    response = client.get(
        "/api/v1/analytics/domain-detail", params={"subject_id": psm.id, "domain": "No Such Area"}
    )
    assert response.status_code == 404


def test_an_area_name_with_a_slash_is_read_through_the_api(db, client):
    psm = _subject(db, "PSM")
    q = _question(db, psm, "CI/CD & Release")
    _answered(db, psm, (q, False))

    response = client.get(
        "/api/v1/analytics/domain-detail", params={"subject_id": psm.id, "domain": "CI/CD & Release"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["domain"] == "CI/CD & Release"
    assert body["accuracy_percentage"] == 0.0
    assert body["questions"][0]["state"] == "missed"


def test_a_long_area_lists_a_bounded_number_of_questions_but_counts_them_all(db):
    psm = _subject(db, "PSM")
    questions = [_question(db, psm, "Big Area") for _ in range(AnalyticsService.DOMAIN_QUESTION_LIMIT + 5)]
    _answered(db, psm, *[(q, False) for q in questions[-3:]])

    detail = AnalyticsService(db).get_domain_detail(psm, "Big Area")

    assert detail.question_count == len(questions)
    assert len(detail.questions) == AnalyticsService.DOMAIN_QUESTION_LIMIT
    # The misses are the ones that make the cut.
    assert {q.id for q in detail.questions[:3]} == {q.id for q in questions[-3:]}


# ---- what is due, narrowed to the area -------------------------------------------------------


def test_the_review_deck_can_be_narrowed_to_one_area(db, client):
    psm = _subject(db, "PSM")
    events = _question(db, psm, "Scrum Events")
    roles = _question(db, psm, "Scrum Team")
    _due(db, events)
    _due(db, roles)

    deck = SpacedReviewService(db).deck(psm, limit=8, domain="Scrum Events")
    assert [c["question_id"] for c in deck["cards"]] == [events.id]
    assert deck["due_total"] == 1

    over_api = client.get(
        "/api/v1/spaced/deck", params={"subject_id": psm.id, "domain": "Scrum Team"}
    ).json()
    assert [c["question_id"] for c in over_api["cards"]] == [roles.id]
    # Unnarrowed, both are due.
    assert client.get("/api/v1/spaced/deck", params={"subject_id": psm.id}).json()["due_total"] == 2


# ---- the rule's numbers travel with the verdict ----------------------------------------------


def test_readiness_carries_the_numbers_it_was_computed_with(db, client):
    psm = _subject(db, "PSM")

    body = client.get(f"/api/v1/subjects/{psm.id}").json()

    assert body["readiness"]["rules"] == {
        "min_mocks_for_ready": readiness.MIN_MOCKS_FOR_READY,
        "consecutive_mocks_at_pass": readiness.CONSECUTIVE_MOCKS_AT_PASS,
        "domain_floor_pct": readiness.DOMAIN_FLOOR_PCT,
        "recency_days": readiness.RECENCY_DAYS,
        "plateau_min_mocks": readiness.PLATEAU_MIN_MOCKS,
        "plateau_max_spread": readiness.PLATEAU_MAX_SPREAD,
        "min_questions_per_domain": readiness.MIN_QUESTIONS_PER_DOMAIN,
    }


def test_an_area_counts_the_misses_from_mocks_still_waiting_for_review(db):
    psm = _subject(db, "PSM")
    first = _question(db, psm, "Scrum Events")
    second = _question(db, psm, "Scrum Events")
    elsewhere = _question(db, psm, "Scrum Team")
    mock = _answered(db, psm, (first, False), (second, False), (elsewhere, False), kind="mock", score=0.0)
    _answered(db, psm, (first, False))  # a drill miss is not queued for review

    reviewed = db.query(ExamAnswer).filter(
        ExamAnswer.session_id == mock.id, ExamAnswer.question_id == second.id
    ).one()
    reviewed.reviewed_at = utc_now_naive()
    db.commit()

    detail = AnalyticsService(db).get_domain_detail(psm, "Scrum Events")

    assert detail.unreviewed_misses == 1
