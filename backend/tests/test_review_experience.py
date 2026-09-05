# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
What review feels like after a bad month.

test_sm2_service.py already proves the arithmetic: quality scores, ease
factors, the 1/6/EF interval ladder. None of that answers the question this
file exists for, which is not "does SM-2 compute a next date" but "is the
resulting experience still usable when the learner has been away".

That distinction matters because the failure mode of a review system is
never a wrong date. It is a screen that says 412 and means it. PrepBench
removed streaks and daily goals precisely so that missing a week costs
nothing, and a review queue that grows without a ceiling would put the
punishment straight back -- through the count rather than through the copy.

So the scenarios here are absences and backlogs, and what they assert is
boundedness, honesty about what is behind the bound, and the absence of any
instruction to catch up.

Each test builds its own database. The queue and the due-count are both
global queries with no subject or owner filter, so measuring "how many are
due" against the shared session database would be measuring whichever tests
happened to run first.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.review import DAILY_REVIEW_CAP, review_queue
from app.core.database import Base, register_sqlite_pragmas
from app.models.exam_answer import ConfidenceLevel, ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.option import QuestionOption
from app.models.question import Question
from app.models.spaced_repetition import SpacedRepetition
from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository
from app.repositories.subject_repository import LEARNER, MOCK
from app.services.home_service import HomeService
from app.services.sm2_service import SM2Service

NOW = datetime(2026, 6, 1, 9, 0, 0)


@pytest.fixture
def db(tmp_path):
    """An empty database of this product's real schema, per test."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'review.db'}",
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


# ---- arrangement -------------------------------------------------------


def _question(db, domain="Scrum Events", text=None) -> Question:
    q = Question(
        text=text or f"Question {uuid.uuid4().hex[:8]}",
        question_type="single_choice",
        domain=domain,
        topic=domain,
        difficulty="medium",
        explanation="Because the Scrum Guide says so.",
    )
    db.add(q)
    db.flush()
    wrong = QuestionOption(
        question_id=q.id, option_text="Wrong", is_correct=False, order_index=1,
        explanation_why_incorrect="A plausible-sounding distractor.",
    )
    db.add_all([
        QuestionOption(question_id=q.id, option_text="Right", is_correct=True, order_index=0),
        wrong,
    ])
    db.flush()
    return q, wrong


def _mock_with_misses(db, n, taken_at, domain="Scrum Events") -> ExamSession:
    """A completed learner mock with `n` unreviewed wrong answers."""
    session = ExamSession(
        title=f"Mock {taken_at:%d %b}",
        status=ExamStatus.COMPLETED,
        session_kind=MOCK,
        source=LEARNER,
        start_time=taken_at,
        end_time=taken_at + timedelta(hours=1),
        total_questions=n,
        answered_questions=n,
    )
    db.add(session)
    db.flush()
    for _ in range(n):
        q, wrong = _question(db, domain=domain)
        db.add(ExamAnswer(
            session_id=session.id, question_id=q.id,
            selected_option_ids=[wrong.id],
            is_correct=False, reviewed_at=None,
        ))
    db.commit()
    return session


def _due(db, n, due_at=None, domain="Scrum Events") -> list[int]:
    """`n` questions the schedule has already brought round."""
    ids = []
    for _ in range(n):
        q, _wrong = _question(db, domain=domain)
        db.add(SpacedRepetition(
            question_id=q.id, repetition=1, interval_days=1, ease_factor=2.5,
            next_review_date=due_at or (NOW - timedelta(days=1)),
        ))
        ids.append(q.id)
    db.commit()
    return ids


# ---- 1. zero due items -------------------------------------------------


def test_nothing_due_is_reported_as_nothing_rather_than_as_zero_of_something(db):
    """Empty is a state, not a score of 0.

    Home reads this number to decide whether to offer a memory drill at all;
    a fabricated 0 with the offer still visible would send the learner into
    an exam that cannot be built.
    """
    assert SpacedRepetitionRepository(db).count_due(NOW) == 0
    assert HomeService(db).due_for_review_count() == 0
    assert SpacedRepetitionRepository(db).due_question_ids(NOW) == []

    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert queue.items == []
    assert queue.total_unreviewed == 0
    assert queue.remaining == 0


# ---- 2. one due item ---------------------------------------------------


def test_a_single_due_item_is_a_session_of_one(db):
    _mock_with_misses(db, 1, NOW - timedelta(days=1))

    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert len(queue.items) == 1
    assert queue.remaining == 0
    # The card needs all four of these to be worth reading: the question, the
    # options, which one the learner picked, and why it was wrong.
    item = queue.items[0]
    assert item.question_text
    assert len(item.options) == 2
    assert item.selected_option_ids
    assert item.explanation


# ---- 3. small backlog --------------------------------------------------


def test_a_small_backlog_is_delivered_whole(db):
    """Five is a sitting. Nothing should be held back or paged."""
    _mock_with_misses(db, 5, NOW - timedelta(days=2))

    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert len(queue.items) == 5
    assert queue.remaining == 0
    assert queue.total_unreviewed == 5


# ---- 4. large backlog --------------------------------------------------


def test_a_large_backlog_is_still_one_evening(db):
    """The scenario the cap exists for.

    Two hundred unread misses is what a month of mocks with no review looks
    like. The queue returns a session, says what is behind it, and the
    difference between those two numbers is never presented as owed.
    """
    _mock_with_misses(db, 200, NOW - timedelta(days=3))

    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert len(queue.items) == DAILY_REVIEW_CAP == 20
    assert queue.total_unreviewed == 200
    assert queue.remaining == 180


def test_the_cap_cannot_be_argued_upwards_by_the_caller(db):
    """`limit` is bounded at the route, not merely defaulted.

    A default is a suggestion. If a caller could ask for 500 the bound would
    exist only for as long as nobody tried, and the first thing anyone builds
    on top of a review API is a "show all".
    """
    import inspect

    param = inspect.signature(review_queue).parameters["limit"]
    bounds = {type(m).__name__: getattr(m, type(m).__name__.lower()) for m in param.default.metadata}
    assert bounds == {"Ge": 1, "Le": DAILY_REVIEW_CAP}


# ---- 5. repeated missed items ------------------------------------------


def test_an_item_missed_again_and_again_keeps_coming_back_tomorrow(db):
    """Failure must not push an item away.

    SM-2's reset-to-one-day is the behaviour that makes the queue useful
    rather than punishing: the thing you cannot do returns while you still
    remember trying, and it never accumulates a longer and longer wait.
    """
    q, _ = _question(db)
    db.commit()

    intervals = []
    for _ in range(4):
        item = SM2Service.update_item(db, q.id, False, ConfidenceLevel.MEDIUM)
        intervals.append(item.interval_days)

    assert intervals == [1, 1, 1, 1]
    assert item.repetition == 0
    # Ease erodes -- so once it is finally answered right it is promoted
    # cautiously rather than jumping straight back to a long interval.
    assert item.ease_factor == pytest.approx(1.3, abs=0.35)
    assert item.ease_factor >= 1.3


def test_a_hard_item_never_falls_below_the_ease_floor_no_matter_how_often_it_is_missed(db):
    """Twenty misses must not produce a negative or zero interval.

    Without the 1.3 floor the ease factor goes negative after enough
    failures, and `round(interval * ef)` then schedules the next review in
    the past -- an item that is permanently due, which is a queue that can
    never be finished.
    """
    q, _ = _question(db)
    db.commit()

    for _ in range(20):
        item = SM2Service.update_item(db, q.id, False, ConfidenceLevel.HIGH)

    assert item.ease_factor == pytest.approx(1.3)
    assert item.interval_days >= 1
    assert item.next_review_date > item.last_reviewed_at


# ---- 6. repeated successful items --------------------------------------


def test_items_that_stay_learnt_get_out_of_the_way(db):
    """The other half of bounded: the queue has to drain.

    If success did not lengthen the interval, every question ever answered
    would be due every day and the backlog would be the whole bank by
    definition.
    """
    q, _ = _question(db)
    db.commit()

    intervals = []
    for _ in range(5):
        item = SM2Service.update_item(db, q.id, True, ConfidenceLevel.HIGH)
        intervals.append(item.interval_days)

    assert intervals == sorted(intervals)
    assert intervals[0] == 1
    assert intervals[-1] > 30
    assert item.next_review_date == item.last_reviewed_at + timedelta(days=intervals[-1])


def test_a_reviewed_item_is_not_due_again_the_same_day(db):
    q, _ = _question(db)
    db.commit()
    SM2Service.update_item(db, q.id, True, ConfidenceLevel.HIGH)

    assert SpacedRepetitionRepository(db).count_due(datetime.now(UTC).replace(tzinfo=None)) == 0


# ---- 7 & 8. skipped days -----------------------------------------------


def test_a_skipped_day_does_not_multiply_the_item(db):
    """Overdue is a boolean, not an accrual.

    An item that was due yesterday is one item today. Some review products
    treat each missed day as a separate obligation, which is how a week away
    turns into a four-figure number.
    """
    _due(db, 1, due_at=NOW - timedelta(days=1))

    assert SpacedRepetitionRepository(db).count_due(NOW) == 1
    assert len(SpacedRepetitionRepository(db).due_question_ids(NOW)) == 1


def test_thirty_skipped_days_do_not_make_thirty_days_of_debt(db):
    """A month away, and the drill is still twenty questions.

    Every item scheduled across the missed month is due -- the schedule is
    not rewritten to hide that, because the learner really has not seen them.
    What must not happen is the *session* growing with the absence.
    """
    for day in range(1, 31):
        _due(db, 3, due_at=NOW - timedelta(days=day))

    due = SpacedRepetitionRepository(db).count_due(NOW)
    assert due == 90

    # The drill Review starts is a fixed twenty regardless (ReviewPage sends
    # total_questions: 20), and the queue on the same page is capped:
    _mock_with_misses(db, 90, NOW - timedelta(days=15))
    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert len(queue.items) == DAILY_REVIEW_CAP
    assert queue.remaining == 70


def test_the_queue_leads_with_the_newest_miss_not_the_oldest(db):
    """Freshest first, which is what makes the cap defensible.

    Oldest-first would hand a returning learner twenty questions from six
    weeks ago and leave last night's mock -- the one whose reasoning is still
    recoverable -- at the bottom of a queue they will never reach.
    """
    _mock_with_misses(db, 20, NOW - timedelta(days=40), domain="Old Domain")
    _mock_with_misses(db, 5, NOW - timedelta(days=1), domain="Fresh Domain")

    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert [i.domain for i in queue.items[:5]] == ["Fresh Domain"] * 5
    assert queue.remaining == 5


# ---- 9. mixed-domain due items -----------------------------------------


def test_a_mixed_backlog_is_not_silently_narrowed_to_one_domain(db):
    """The cap must not become an unannounced domain filter.

    Taking the first twenty of a date-ordered queue is fine. Taking the first
    twenty of a *domain*-ordered one would mean a learner weak in three areas
    only ever reviews the alphabetically first, while Insights keeps telling
    them the other two are their problem.
    """
    session_at = NOW - timedelta(days=1)
    for domain in ("Scrum Events", "Scrum Artifacts", "Empiricism"):
        _mock_with_misses(db, 10, session_at, domain=domain)

    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert len({i.domain for i in queue.items}) >= 2
    assert queue.total_unreviewed == 30


# ---- 10. interaction with weak-topic prioritisation ---------------------


def test_the_memory_schedule_and_the_weak_topic_list_stay_separate_instruments(db):
    """Two different questions, deliberately not merged.

    Weak-topic focus asks "where am I below the floor"; the memory drill asks
    "what is fading". An item can be due while its domain is strong, and a
    weak domain can have nothing due. Collapsing them would mean the drill
    silently stops covering anything the learner is currently good at, which
    is exactly the material spaced repetition exists to protect.
    """
    from app.repositories.analytics_repository import AnalyticsRepository

    # A domain the learner is strong in, with an item due.
    strong = _due(db, 3, domain="Strong Domain")

    # A domain the learner is weak in, with nothing due.
    weak_session = _mock_with_misses(db, 8, NOW - timedelta(days=1), domain="Weak Domain")
    assert weak_session.id

    due_ids = set(SpacedRepetitionRepository(db).due_question_ids(NOW))
    assert due_ids == set(strong)

    weak = AnalyticsRepository(db).get_weak_topic_names(below_percent=70.0)
    assert "Strong Domain" not in weak
    # The two selections do not intersect, and neither one is derived from
    # the other.
    assert not (set(weak) & {"Strong Domain"})


# ---- the promise the numbers exist to keep -----------------------------


def test_the_queue_reports_the_remainder_without_ever_asking_for_it_back(db):
    """`remaining` is a fact, and the API states it as one.

    The schema carries a count and nothing else -- no due date on the
    backlog, no target, no "clear by", nothing that could be rendered as an
    obligation by a caller that did not think about it.
    """
    _mock_with_misses(db, 50, NOW - timedelta(days=5))
    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)

    assert set(queue.model_dump().keys()) == {"items", "remaining", "total_unreviewed"}
    assert queue.remaining == 30


def test_reading_a_miss_removes_it_from_the_queue_permanently(db):
    """The count has to be able to go down, or it is a debt.

    This is the whole reason reviewed_at exists. Before it, the number of
    unread misses could only ever increase.
    """
    session = _mock_with_misses(db, 3, NOW - timedelta(days=1))
    first = db.query(ExamAnswer).filter(ExamAnswer.session_id == session.id).first()

    first.reviewed_at = NOW
    db.commit()

    queue = review_queue(limit=DAILY_REVIEW_CAP, db=db)
    assert queue.total_unreviewed == 2
    assert first.id not in {i.answer_id for i in queue.items}


# ---- one number, one rounding ------------------------------------------


def test_a_score_is_rounded_the_same_way_wherever_it_is_shown(db):
    """The Phase 58 cross-check found 93% and 92% for the same mock.

    Home rounds in the client with Math.round (half up). The activity list
    was the one place formatting a score on the server, and Python's `:.0f`
    rounds half to even -- so a 92.5% paper read 93% in the verdict at the
    top of the page and 92% in the history below it.
    """
    session = _mock_with_misses(db, 1, NOW - timedelta(days=1))
    session.score_percentage = 92.5
    db.commit()

    item = next(i for i in HomeService(db).activity() if i["href"].endswith(str(session.id)))
    assert item["detail"] == "93%"

    # The other halves, so the fix is a rule and not a special case.
    assert HomeService._pct(82.5) == "83%"
    assert HomeService._pct(87.5) == "88%"
    assert HomeService._pct(70.0) == "70%"
    assert HomeService._pct(0.0) == "0%"
