# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The one definition of what a learner's answers say about a question.

The Question Bank's status column, its outcome filter, its summary figures and
the practice previews all sort questions by it. These tests hold the definition
itself -- missed, correct, unattempted partition the bank; due sits on top;
skipped answers and unfinished sessions are not evidence -- and hold every
surface to it.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, register_sqlite_pragmas
from app.main import app
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.option import QuestionOption
from app.models.question import Question
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject import Subject, SubjectKind
from app.repositories.question_repository import QuestionRepository
from app.repositories.subject_repository import LEARNER, MOCK
from app.schemas.question import QuestionFilter
from app.services.exam_engine import ExamEngine
from app.services.question_evidence import bank_summary, evidence_for

NOW = datetime(2026, 6, 1, 9, 0, 0)
client = TestClient(app)


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'evidence.db'}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _subject(db, name="Evidence Prep") -> Subject:
    s = Subject(name=name, slug=f"evidence-{uuid.uuid4().hex[:6]}", kind=SubjectKind.CERTIFICATION)
    db.add(s)
    db.flush()
    return s


def _question(db, subject=None, reviewed=False) -> Question:
    q = Question(
        text=f"Question {uuid.uuid4().hex[:8]}", question_type="single_choice", domain="Area", topic="Area",
        difficulty="medium", subject_id=subject.id if subject else None, is_reviewed=reviewed,
    )
    db.add(q)
    db.flush()
    db.add_all([
        QuestionOption(question_id=q.id, option_text="Right", is_correct=True, order_index=0),
        QuestionOption(question_id=q.id, option_text="Wrong", is_correct=False, order_index=1),
    ])
    db.flush()
    return q


def _session(db, status=ExamStatus.COMPLETED, source=LEARNER) -> ExamSession:
    s = ExamSession(
        title="Mock", status=status, session_kind=MOCK, source=source,
        start_time=NOW - timedelta(days=1), end_time=NOW - timedelta(days=1, hours=-1),
        total_questions=1, answered_questions=1,
    )
    db.add(s)
    db.flush()
    return s


def _answer(db, session, question, correct):
    db.add(ExamAnswer(session_id=session.id, question_id=question.id, selected_option_ids=[], is_correct=correct))
    db.flush()


@pytest.fixture
def bank(db):
    """Five questions, one of each kind, in one preparation, plus one outside it."""
    subject = _subject(db)
    missed, correct, unattempted, skipped_only, due_correct = (_question(db, subject) for _ in range(5))
    reviewed = _question(db, subject, reviewed=True)
    other = _question(db)  # another preparation's, answered wrong
    done = _session(db)
    again = _session(db)                      # a question is answered once per session
    _answer(db, done, missed, True)
    _answer(db, again, missed, False)         # right once, wrong once: missed
    _answer(db, done, correct, True)
    _answer(db, again, correct, True)         # right every time
    _answer(db, done, skipped_only, None)     # skipped: not an attempt
    _answer(db, done, due_correct, True)
    _answer(db, done, other, False)
    unfinished = _session(db, status=ExamStatus.IN_PROGRESS)
    _answer(db, unfinished, unattempted, False)  # an unfinished session is not evidence
    db.add(SpacedRepetition(question_id=due_correct.id, repetition=1, interval_days=1, ease_factor=2.5,
                            next_review_date=NOW - timedelta(hours=1)))
    # Scheduled, but not due by any clock these tests run against.
    db.add(SpacedRepetition(question_id=correct.id, repetition=2, interval_days=6, ease_factor=2.5,
                            next_review_date=datetime(2100, 1, 1)))
    db.commit()
    return dict(subject=subject, missed=missed, correct=correct, unattempted=unattempted,
                skipped_only=skipped_only, due_correct=due_correct, reviewed=reviewed, other=other)


def test_evidence_records_answers_misses_and_what_is_due(db, bank):
    ev = evidence_for(db, [q.id for k, q in bank.items() if k != "subject"], now=NOW)
    assert ev[bank["missed"].id].missed and ev[bank["missed"].id].answered == 2
    assert not ev[bank["correct"].id].missed and ev[bank["correct"].id].correct == 2
    assert not ev[bank["correct"].id].due               # scheduled, but not yet
    assert ev[bank["due_correct"].id].due
    assert not ev[bank["unattempted"].id].attempted     # only an unfinished session
    assert not ev[bank["skipped_only"].id].attempted    # only a skip
    assert not ev[bank["reviewed"].id].attempted


def test_missed_correct_and_unattempted_partition_the_bank(db, bank):
    repo = QuestionRepository(db)
    scope = bank["subject"].id
    counts = {
        outcome: repo.count(QuestionFilter(subject_id=scope, outcome=outcome))
        for outcome in ("missed", "correct", "unattempted")
    }
    assert counts == {"missed": 1, "correct": 2, "unattempted": 3}
    assert sum(counts.values()) == repo.count(QuestionFilter(subject_id=scope))


def test_the_summary_counts_one_preparation_and_says_null_for_no_answers(db, bank):
    summary = bank_summary(db, bank["subject"].id, now=NOW)
    assert summary["questions"] == 6
    assert summary["attempted"] == 3
    assert summary["never_attempted"] == 3
    assert summary["answers"] == 5
    assert summary["correct_answers"] == 4
    assert summary["correct_percentage"] == 80.0
    assert summary["review_due"] == 1
    assert summary["missed_at_least_once"] == 1
    assert summary["flagged_reviewed"] == 1

    empty = _subject(db, "Nothing Answered")
    _question(db, empty)
    db.commit()
    nothing = bank_summary(db, empty.id, now=NOW)
    assert nothing["answers"] == 0
    assert nothing["correct_percentage"] is None


def test_the_practice_preview_sorts_by_the_same_definition(db, bank):
    ids = [bank[k].id for k in ("missed", "correct", "unattempted", "skipped_only", "due_correct", "reviewed")]
    composition = ExamEngine(db)._composition(ids)
    assert composition["previously_missed"] == 1
    assert composition["answered_correctly"] == 1
    assert composition["never_attempted"] == 3
    # due_correct was answered right, and is due: the preview ranks due first.
    assert composition["due_for_review"] == 1


# ---- the API ---------------------------------------------------------------


def test_the_summary_route_answers_for_the_whole_bank():
    res = client.get("/api/v1/questions/summary")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["never_attempted"] == body["questions"] - body["attempted"]
    assert set(body) >= {"questions", "answers", "correct_answers", "review_due", "missed_at_least_once", "flagged_reviewed"}


def test_the_summary_route_refuses_nothing_and_scopes_to_a_preparation():
    res = client.get("/api/v1/questions/summary", params={"subject_id": 999999})
    assert res.status_code == 200
    assert res.json()["questions"] == 0


def test_the_list_carries_evidence_only_when_asked_and_filters_by_outcome():
    plain = client.get("/api/v1/questions", params={"limit": 5}).json()
    assert all("evidence" not in item for item in plain["items"])

    with_evidence = client.get("/api/v1/questions", params={"limit": 5, "include_evidence": True}).json()
    for item in with_evidence["items"]:
        assert set(item["evidence"]) == {"answered", "correct", "missed", "due"}

    totals = {
        outcome: client.get("/api/v1/questions", params={"limit": 1, "outcome": outcome}).json()["total"]
        for outcome in ("missed", "correct", "unattempted")
    }
    everything = client.get("/api/v1/questions", params={"limit": 1}).json()["total"]
    assert sum(totals.values()) == everything

    missed = client.get("/api/v1/questions", params={"limit": 50, "outcome": "missed", "include_evidence": True}).json()
    assert all(item["evidence"]["missed"] for item in missed["items"])


def test_an_unknown_outcome_is_refused():
    assert client.get("/api/v1/questions", params={"outcome": "sometimes"}).status_code == 422


def test_the_list_filters_by_question_type():
    body = client.get("/api/v1/questions", params={"limit": 50, "question_type": "single_choice"}).json()
    assert all(item["question_type"] == "single_choice" for item in body["items"])
    assert client.get("/api/v1/questions", params={"question_type": "essay"}).status_code == 422
