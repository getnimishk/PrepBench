# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
What the product means by "weak", and why it is now one thing.

There were two definitions. Readiness refuses to score a domain under ten
answered questions and reports "needs evaluation" rather than a percentage.
`get_weak_topic_names` had no floor at all and counted every completed learner
session, drills included -- and a drill deliberately draws from what you are
getting wrong. On the working database that qualified 77 of 267 topics, 61 of
them on a sample of two answers or fewer, and 19 of them *because* the learner
had drilled them.

Both halves of that mattered. The floor is about noise. The mocks-only rule is
about a loop that ran backwards: practising a weak topic pushed its pooled
accuracy down and kept it on the list, so the only way off the list was to stop
practising.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, register_sqlite_pragmas
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.option import QuestionOption
from app.models.question import Question
from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.subject_repository import DRILL, LEARNER, MOCK

NOW = datetime(2026, 6, 1, 9, 0, 0)


@pytest.fixture
def db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'weak.db'}",
        connect_args={"check_same_thread": False},
    )
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _question(db, topic):
    q = Question(
        text=f"Q {uuid.uuid4().hex[:8]}",
        question_type="single_choice",
        domain="Scrum Events",
        topic=topic,
        difficulty="medium",
    )
    db.add(q)
    db.flush()
    db.add(QuestionOption(question_id=q.id, option_text="Right", is_correct=True, order_index=0))
    db.flush()
    return q


def _sitting(db, kind, answers, source=LEARNER, at=NOW):
    """One completed session. `answers` is a list of (topic, is_correct)."""
    session = ExamSession(
        title=f"{kind} {at:%d %b}", status=ExamStatus.COMPLETED,
        session_kind=kind, source=source,
        start_time=at, end_time=at + timedelta(hours=1),
        total_questions=len(answers), answered_questions=len(answers),
    )
    db.add(session)
    db.flush()
    for topic, correct in answers:
        q = _question(db, topic)
        db.add(ExamAnswer(
            session_id=session.id, question_id=q.id,
            selected_option_ids=[1], is_correct=correct,
        ))
    db.commit()
    return session


def weak(db, **kw):
    return set(AnalyticsRepository(db).get_weak_topic_names(**kw))


# ---- the sample floor --------------------------------------------------


def test_one_wrong_answer_does_not_make_a_topic_weak(db):
    """0/1 is not evidence of anything, and 61 of the 77 looked like this."""
    _sitting(db, MOCK, [("Sprint Review", False)])
    assert weak(db) == set()


def test_two_answers_are_still_not_enough(db):
    _sitting(db, MOCK, [("Sprint Review", False), ("Sprint Review", False)])
    assert weak(db) == set()


def test_three_answers_are_enough_to_be_measured(db):
    """Three is the smallest floor at which "below 70%" is not decided by one
    question: 0/3, 1/3 and 2/3 qualify, and 3/3 does not."""
    _sitting(db, MOCK, [
        ("Sprint Review", False), ("Sprint Review", True), ("Sprint Review", False),
    ])
    assert weak(db) == {"Sprint Review"}


def test_a_topic_above_the_threshold_is_not_weak_however_large_the_sample(db):
    _sitting(db, MOCK, [("Sprint Review", True)] * 9 + [("Sprint Review", False)])
    assert weak(db) == set()


# ---- the loop that ran backwards ---------------------------------------


def test_a_drill_cannot_make_a_topic_weak(db):
    """This is the whole reason for the mocks-only rule.

    A drill draws from what the learner is already getting wrong, so counting
    it means practising a topic pushes its accuracy down and keeps it on the
    list. The only way off the list was to stop practising.
    """
    _sitting(db, DRILL, [
        ("Daily Scrum", False), ("Daily Scrum", False), ("Daily Scrum", False),
    ])
    assert weak(db) == set()


def test_a_drill_cannot_clear_a_topic_either(db):
    """The rule cuts both ways, and it has to.

    A weakness that could be cleared by drilling the same questions would be a
    weakness the learner can talk themselves out of.
    """
    _sitting(db, MOCK, [
        ("Daily Scrum", False), ("Daily Scrum", False), ("Daily Scrum", True),
    ], at=NOW - timedelta(days=7))
    assert weak(db) == {"Daily Scrum"}

    _sitting(db, DRILL, [("Daily Scrum", True)] * 20, at=NOW)
    assert weak(db) == {"Daily Scrum"}


def test_a_later_mock_is_what_clears_it(db):
    _sitting(db, MOCK, [
        ("Daily Scrum", False), ("Daily Scrum", False), ("Daily Scrum", True),
    ], at=NOW - timedelta(days=7))
    assert weak(db) == {"Daily Scrum"}

    _sitting(db, MOCK, [("Daily Scrum", True)] * 8, at=NOW)
    assert weak(db) == set()


# ---- the population -----------------------------------------------------


def test_a_test_session_is_not_evidence(db):
    _sitting(db, MOCK, [("Sprint Review", False)] * 5, source="test")
    assert weak(db) == set()


def test_an_unfinished_mock_is_not_evidence(db):
    session = ExamSession(
        title="Abandoned", status=ExamStatus.IN_PROGRESS, session_kind=MOCK,
        source=LEARNER, start_time=NOW, total_questions=3, answered_questions=3,
    )
    db.add(session)
    db.flush()
    for _ in range(3):
        q = _question(db, "Sprint Review")
        db.add(ExamAnswer(
            session_id=session.id, question_id=q.id,
            selected_option_ids=[1], is_correct=False,
        ))
    db.commit()
    assert weak(db) == set()


def test_a_skipped_question_does_not_count_against_the_topic(db):
    """is_correct is NULL for questions auto-saved on navigation and never
    answered. Counting them would inflate the denominator."""
    session = _sitting(db, MOCK, [
        ("Sprint Review", False), ("Sprint Review", True), ("Sprint Review", True),
    ])
    for _ in range(5):
        q = _question(db, "Sprint Review")
        db.add(ExamAnswer(
            session_id=session.id, question_id=q.id,
            selected_option_ids=[], is_correct=None,
        ))
    db.commit()
    # 2 of 3 answered = 67%, which is weak. The five skipped questions would
    # have made it 2 of 8 and equally weak -- but for the wrong reason, and on
    # a different topic they would have invented a weakness outright.
    assert weak(db) == {"Sprint Review"}
    assert weak(db, min_answers=4) == set()


# ---- the same definition, two shapes ------------------------------------


def test_the_names_are_exactly_the_topics(db):
    """One definition, structurally.

    get_weak_topic_names delegates to get_weak_topics. If it ever grows its
    own query again, Home could name a topic the weak-topic drill would then
    refuse to draw -- which is the two-definitions bug this file exists for,
    wearing a different hat.
    """
    _sitting(db, MOCK, [
        ("Daily Scrum", False), ("Daily Scrum", False), ("Daily Scrum", True),
        ("Sprint Review", False), ("Sprint Review", True), ("Sprint Review", False),
        ("Sprint Goal", True), ("Sprint Goal", True), ("Sprint Goal", True),
    ])
    repo = AnalyticsRepository(db)
    assert repo.get_weak_topic_names() == [t["topic"] for t in repo.get_weak_topics()]


def test_a_weak_topic_carries_the_evidence_that_made_it_weak(db):
    """The counts travel with the name, so the surface can show its working."""
    _sitting(db, MOCK, [
        ("Daily Scrum", False), ("Daily Scrum", False), ("Daily Scrum", True),
        ("Daily Scrum", False),
    ])
    topic = AnalyticsRepository(db).get_weak_topics()[0]
    assert topic == {
        "topic": "Daily Scrum", "answered": 4, "correct": 1, "accuracy_percentage": 25.0,
    }


def test_the_worst_topic_comes_first(db):
    """A list to start from, not an inventory to work through."""
    _sitting(db, MOCK, [
        ("Nearly there", True), ("Nearly there", True), ("Nearly there", False),
        ("Badly stuck", False), ("Badly stuck", False), ("Badly stuck", False),
        ("Halfway", True), ("Halfway", False), ("Halfway", False), ("Halfway", True),
    ])
    assert [t["topic"] for t in AnalyticsRepository(db).get_weak_topics()] == [
        "Badly stuck", "Halfway", "Nearly there",
    ]
