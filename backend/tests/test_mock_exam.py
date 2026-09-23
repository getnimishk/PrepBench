# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The certification mock, as exam conditions.

What these hold: the paper takes each domain's share of the bank and says so
before it starts; the question source really narrows what is drawn; the time
limit is the server's; a reload can resume where the learner was; an unfinished
paper can be discarded and a submitted one cannot; and the history judges each
paper against the preparation's own pass mark.
"""
from __future__ import annotations

import uuid
from collections import Counter
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db, register_sqlite_pragmas
from app.core.exceptions import ConflictException, InvalidExamStateException, ResourceNotFoundException
from app.core.timeutils import utc_now_naive
from app.main import app
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.option import QuestionOption
from app.models.question import Question
from app.models.subject import Subject, SubjectKind
from app.schemas.exam import ExamCreateRequest, SaveAnswerRequest
from app.services.exam_engine import ANSWER_GRACE_SECONDS, ExamEngine, _apportion


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'mock.db'}", connect_args={"check_same_thread": False})
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


def _subject(db, name="PSM", count=5, pass_mark=85.0) -> Subject:
    subject = Subject(
        name=name, slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}", kind=SubjectKind.CERTIFICATION,
        certification=f"{name} cert", pass_mark=pass_mark, exam_question_count=count, exam_minutes=30,
    )
    db.add(subject)
    db.commit()
    return subject


def _questions(db, subject, domain, n) -> list[Question]:
    out = []
    for _ in range(n):
        q = Question(
            text=f"Q {uuid.uuid4().hex[:8]}", question_type="single_choice", difficulty="medium",
            domain=domain, topic="T", subject_id=subject.id,
        )
        db.add(q)
        db.flush()
        db.add(QuestionOption(question_id=q.id, option_text="Right", is_correct=True, order_index=0))
        db.add(QuestionOption(question_id=q.id, option_text="Wrong", is_correct=False, order_index=1))
        out.append(q)
    db.commit()
    return out


def _mock(subject, **over) -> ExamCreateRequest:
    body = dict(
        title="Mock", exam_mode="timed", total_questions=subject.exam_question_count,
        time_allowed_minutes=30, passing_percentage=85, randomize_questions=True,
        session_kind="mock", subject_id=subject.id,
    )
    body.update(over)
    return ExamCreateRequest(**body)


def _answered(db, subject, questions, days_ago=0):
    at = utc_now_naive() - timedelta(days=days_ago)
    session = ExamSession(
        title="Earlier", session_kind="drill", source="learner", status=ExamStatus.COMPLETED,
        subject_id=subject.id, total_questions=len(questions), answered_questions=len(questions),
        start_time=at, end_time=at,
    )
    db.add(session)
    db.flush()
    for q in questions:
        db.add(ExamAnswer(session_id=session.id, question_id=q.id, selected_option_ids=[1], is_correct=True))
    db.commit()


# ---- the paper's shape -----------------------------------------------------------


def test_shares_always_add_up_and_never_exceed_a_group():
    for counts, n in (({"a": 6, "b": 3, "c": 1}, 5), ({"a": 1, "b": 1, "c": 1}, 2), ({"a": 7}, 9), ({"a": 2, "b": 5}, 7)):
        plan = _apportion(counts, n)
        assert sum(plan.values()) == min(n, sum(counts.values()))
        assert all(plan[g] <= counts[g] for g in counts)


def test_a_mock_takes_each_domain_in_proportion_and_the_preview_says_so_first(db):
    subject = _subject(db, count=5)
    _questions(db, subject, "Events", 6)
    _questions(db, subject, "Roles", 3)
    _questions(db, subject, "Artifacts", 1)
    engine = ExamEngine(db)

    plan = {row["domain"]: row["will_draw"] for row in engine.preview_exam(_mock(subject))["domain_plan"]}
    session = engine.create_exam(_mock(subject))
    drawn = Counter(q.domain for q in engine.get_exam_details(session.id).questions)

    assert plan == {"Events": 3, "Roles": 2, "Artifacts": 0}
    assert dict(drawn) == {d: n for d, n in plan.items() if n}


def test_a_drill_has_no_domain_plan_because_it_draws_at_random(db):
    subject = _subject(db)
    _questions(db, subject, "Events", 4)

    preview = ExamEngine(db).preview_exam(_mock(subject, session_kind="drill", exam_mode="practice"))

    assert preview["domain_plan"] == []


# ---- question source --------------------------------------------------------------


def test_unseen_only_leaves_out_everything_answered_before(db):
    subject = _subject(db, count=2)
    old = _questions(db, subject, "Events", 2)
    fresh = _questions(db, subject, "Events", 2)
    _answered(db, subject, old, days_ago=40)
    engine = ExamEngine(db)

    session = engine.create_exam(_mock(subject, question_source="unseen"))

    drawn = {q.id for q in engine.get_exam_details(session.id).questions}
    assert drawn == {q.id for q in fresh}
    assert engine.preview_exam(_mock(subject, question_source="unseen"))["available"] == 2


def test_not_recent_leaves_out_only_the_last_week(db):
    subject = _subject(db, count=1)
    last_month = _questions(db, subject, "Events", 1)
    this_week = _questions(db, subject, "Events", 1)
    _answered(db, subject, last_month, days_ago=30)
    _answered(db, subject, this_week, days_ago=2)
    engine = ExamEngine(db)

    session = engine.create_exam(_mock(subject, question_source="not_recent"))

    assert [q.id for q in engine.get_exam_details(session.id).questions] == [last_month[0].id]


def test_nothing_unseen_left_is_its_own_refusal(db):
    subject = _subject(db, name="Seen", count=1)
    everything = _questions(db, subject, "Events", 2)
    _answered(db, subject, everything, days_ago=1)

    with pytest.raises(InvalidExamStateException, match="every question in Seen before"):
        ExamEngine(db).create_exam(_mock(subject, question_source="unseen"))


# ---- the clock, the position, the discard -----------------------------------------


def _started(db, subject, minutes_ago=0):
    engine = ExamEngine(db)
    session = engine.create_exam(_mock(subject))
    row = db.get(ExamSession, session.id)
    row.start_time = utc_now_naive() - timedelta(minutes=minutes_ago)
    db.commit()
    return engine, row


def test_an_answer_after_the_time_limit_is_refused(db):
    subject = _subject(db, count=2)
    _questions(db, subject, "Events", 2)
    engine, session = _started(db, subject, minutes_ago=31)
    question_id = session.question_ids_order[0]

    with pytest.raises(InvalidExamStateException, match="Time is up"):
        engine.save_answer(session.id, SaveAnswerRequest(question_id=question_id, selected_option_ids=[1]))

    # Submitting still works: the result of the time that was used is the point.
    assert engine.finish_exam(session.id).status == ExamStatus.COMPLETED


def test_the_grace_covers_a_save_sent_as_the_clock_ran_out(db):
    subject = _subject(db, count=2)
    questions = _questions(db, subject, "Events", 2)
    engine, session = _started(db, subject)
    row = db.get(ExamSession, session.id)
    row.start_time = utc_now_naive() - timedelta(seconds=30 * 60 + ANSWER_GRACE_SECONDS - 5)
    db.commit()

    engine.save_answer(session.id, SaveAnswerRequest(
        question_id=session.question_ids_order[0],
        selected_option_ids=[questions[0].options[0].id],
    ))


def test_an_untimed_session_has_no_deadline(db):
    subject = _subject(db, count=2)
    _questions(db, subject, "Events", 2)
    engine = ExamEngine(db)
    session = engine.create_exam(_mock(subject, session_kind="drill", exam_mode="practice"))
    row = db.get(ExamSession, session.id)
    row.start_time = utc_now_naive() - timedelta(days=2)
    db.commit()

    engine.save_answer(session.id, SaveAnswerRequest(question_id=row.question_ids_order[0], selected_option_ids=[]))


def test_the_position_is_kept_so_a_reload_can_resume_there(db):
    subject = _subject(db, count=3)
    _questions(db, subject, "Events", 3)
    engine, session = _started(db, subject)

    engine.save_answer(session.id, SaveAnswerRequest(
        question_id=session.question_ids_order[0], selected_option_ids=[], is_flagged=True,
        current_question_index=2,
    ))

    detail = engine.get_exam_details(session.id)
    assert detail.current_question_index == 2
    assert any(a.is_flagged for a in detail.answers)


def test_an_unfinished_mock_can_be_discarded_and_a_submitted_one_cannot(db):
    subject = _subject(db, count=2)
    _questions(db, subject, "Events", 2)
    engine, open_one = _started(db, subject)
    engine.discard_exam(open_one.id)
    with pytest.raises(ResourceNotFoundException):
        engine.get_exam_details(open_one.id)

    _, done = _started(db, subject)
    engine.finish_exam(done.id)
    with pytest.raises(ConflictException):
        engine.discard_exam(done.id)


# ---- history -----------------------------------------------------------------------


def test_history_is_this_preparations_mocks_judged_against_its_own_pass_mark(db, client):
    psm = _subject(db, name="PSM", pass_mark=85.0)
    other = _subject(db, name="Other")
    now = utc_now_naive()

    def sat(subject, score, days_ago, kind="mock", threshold=95.0):
        db.add(ExamSession(
            title=f"{subject.name} {score}", session_kind=kind, source="learner", status=ExamStatus.COMPLETED,
            subject_id=subject.id, total_questions=80, answered_questions=80, correct_count=int(score * 0.8),
            score_percentage=score, passing_percentage=threshold, time_spent_seconds=2400,
            start_time=now - timedelta(days=days_ago), end_time=now - timedelta(days=days_ago),
        ))

    sat(psm, 87.5, days_ago=10)          # stored threshold 95 -- still a pass at PSM's 85
    sat(psm, 80.0, days_ago=2)
    sat(psm, 99.0, days_ago=1, kind="drill")
    sat(other, 90.0, days_ago=1)
    db.commit()

    rows = client.get(f"/api/v1/subjects/{psm.id}/mocks").json()

    assert [(r["score_percentage"], r["passed"]) for r in rows] == [(80.0, False), (87.5, True)]
    assert client.get("/api/v1/subjects/424242/mocks").status_code == 404


def test_the_api_discards_and_refuses_as_the_engine_does(db, client):
    subject = _subject(db, count=2)
    _questions(db, subject, "Events", 2)
    engine, session = _started(db, subject)

    assert client.delete(f"/api/v1/exams/{session.id}").status_code == 204
    assert client.get(f"/api/v1/exams/{session.id}").status_code == 404

    _, done = _started(db, subject)
    engine.finish_exam(done.id)
    assert client.delete(f"/api/v1/exams/{done.id}").status_code == 409
