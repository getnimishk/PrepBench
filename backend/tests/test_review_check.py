# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Whether reviewing a miss now produces evidence.

Before the check existed, the entire effect of reviewing a wrong answer was a
timestamp. SM2Service was called from exactly one place -- on *answering* --
so an evening spent reading twenty explanations left the product's model of
the learner unchanged apart from twenty timestamps. Home counted what had been
read; nothing anywhere asked whether it had landed.

These tests are about the difference between reading and learning, and about
the three rules that keep a check honest: it is a different question, it can
demote but never promote, and it is not exam evidence.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, register_sqlite_pragmas
from app.models.exam_answer import ConfidenceLevel, ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.option import QuestionOption
from app.models.question import Question
from app.models.review_check import ReviewCheck
from app.models.spaced_repetition import SpacedRepetition
from app.repositories.subject_repository import LEARNER, MOCK
from app.services.review_service import ReviewService

NOW = datetime(2026, 6, 1, 9, 0, 0)


@pytest.fixture
def db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'check.db'}",
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


def _question(db, topic="Sprint Retrospective", domain="Scrum Events", text=None):
    q = Question(
        text=text or f"Question {uuid.uuid4().hex[:8]}",
        question_type="single_choice",
        domain=domain,
        topic=topic,
        difficulty="medium",
        explanation="Because the Scrum Guide says so.",
    )
    db.add(q)
    db.flush()
    right = QuestionOption(question_id=q.id, option_text="Right", is_correct=True, order_index=0)
    wrong = QuestionOption(question_id=q.id, option_text="Wrong", is_correct=False, order_index=1)
    db.add_all([right, wrong])
    db.flush()
    return q, right, wrong


def _miss(db, q, wrong) -> ExamAnswer:
    session = ExamSession(
        title="Mock", status=ExamStatus.COMPLETED, session_kind=MOCK, source=LEARNER,
        start_time=NOW - timedelta(days=1), end_time=NOW - timedelta(hours=23),
        total_questions=1, answered_questions=1,
    )
    db.add(session)
    db.flush()
    answer = ExamAnswer(
        session_id=session.id, question_id=q.id,
        selected_option_ids=[wrong.id], is_correct=False, reviewed_at=None,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


# ---- choosing the check ------------------------------------------------


def test_the_check_is_never_the_question_that_was_just_explained(db):
    """Re-asking the question just explained tests short-term memory.

    Which is not the thing anyone wants to know, and is the one result the
    learner is guaranteed to get right.
    """
    missed, _right, wrong = _question(db)
    other, _r, _w = _question(db)
    answer = _miss(db, missed, wrong)

    picked = ReviewService(db).pick_check_question(answer)
    assert picked is not None
    assert picked.id == other.id


def test_the_check_prefers_a_question_the_learner_has_never_seen(db):
    seen, seen_right, _ = _question(db)
    unseen, _r, _w = _question(db)
    missed, _right, wrong = _question(db)
    answer = _miss(db, missed, wrong)

    # `seen` was answered in some earlier sitting.
    other_session = ExamSession(
        title="Earlier", status=ExamStatus.COMPLETED, session_kind=MOCK, source=LEARNER,
        start_time=NOW - timedelta(days=9), total_questions=1, answered_questions=1,
    )
    db.add(other_session)
    db.flush()
    db.add(ExamAnswer(
        session_id=other_session.id, question_id=seen.id,
        selected_option_ids=[seen_right.id], is_correct=True,
    ))
    db.commit()

    for _ in range(6):
        assert ReviewService(db).pick_check_question(answer).id == unseen.id


def test_the_check_falls_back_to_the_domain_when_the_topic_has_nothing_else(db):
    missed, _right, wrong = _question(db, topic="Only Child")
    neighbour, _r, _w = _question(db, topic="A Different Topic", domain="Scrum Events")
    answer = _miss(db, missed, wrong)

    assert ReviewService(db).pick_check_question(answer).id == neighbour.id


def test_a_concept_with_one_question_in_the_bank_offers_no_check_rather_than_a_wrong_one(db):
    """None is a real answer here, not a failure.

    Asking about something else and calling it verification would be the kind
    of claim this product refuses everywhere else.
    """
    missed, _right, wrong = _question(db, topic="Only Child", domain="Only Domain")
    answer = _miss(db, missed, wrong)

    assert ReviewService(db).pick_check_question(answer) is None


def test_a_check_question_is_not_offered_twice_for_the_same_miss(db):
    missed, _right, wrong = _question(db)
    first, first_right, _fw = _question(db)
    second, _sr, _sw = _question(db)
    answer = _miss(db, missed, wrong)

    service = ReviewService(db)
    service.record_check(answer, first, [first_right.id])

    assert service.pick_check_question(answer).id == second.id


# ---- the check has to stay put -----------------------------------------
#
# The pick used to be `ORDER BY random()`, evaluated on every queue fetch. Five
# consecutive fetches of the same miss returned four different check questions,
# which means a learner who does not like the question they were given can
# reload until they get one they do. Nothing was lost or corrupted -- no result
# is recorded until submit -- but the whole discipline of this product is that
# evidence must not be shoppable. It is the same objection the weak-topic rule
# answers: a drill must not be able to clear a weakness.


def test_the_same_miss_gets_the_same_check_every_time(db):
    """Refreshing the page must not deal a new hand.

    Eight candidates and twelve draws: if the pick were still random, the odds
    of this passing by luck are about one in seven billion.
    """
    missed, _right, wrong = _question(db, topic="Sprint Retrospective")
    for _ in range(8):
        _question(db, topic="Sprint Retrospective")
    db.commit()
    answer = _miss(db, missed, wrong)

    service = ReviewService(db)
    picks = {service.pick_check_question(answer).id for _ in range(12)}

    assert len(picks) == 1, f"the check moved between fetches: {sorted(picks)}"


def test_the_stable_check_is_not_the_same_one_for_every_miss(db):
    """Stable per miss, not constant across misses.

    The cheap way to make the pick stable is to order by question id, which
    hands every learner the same question for every miss in a topic. That is
    stability bought by throwing the choice away.
    """
    for _ in range(8):
        _question(db, topic="Sprint Retrospective")
    answers = []
    for _ in range(6):
        q, _r, w = _question(db, topic="Sprint Retrospective")
        answers.append(_miss(db, q, w))
    db.commit()

    service = ReviewService(db)
    picks = [service.pick_check_question(a).id for a in answers]

    assert len(set(picks)) > 1, f"every miss was checked with the same question: {picks}"


def test_a_recorded_check_is_what_moves_the_pick_on(db):
    """The one thing that may change the check is answering it.

    Stability is about the fetch, not about the question being fixed for ever:
    once a check has been recorded against this miss it is excluded, because
    asking it again would test the last two minutes rather than the concept.
    """
    missed, _right, wrong = _question(db, topic="Sprint Retrospective")
    for _ in range(8):
        _question(db, topic="Sprint Retrospective")
    db.commit()
    answer = _miss(db, missed, wrong)

    service = ReviewService(db)
    first = service.pick_check_question(answer)
    assert service.pick_check_question(answer).id == first.id

    right = next(o for o in first.options if o.is_correct)
    service.record_check(answer, first, [right.id])

    second = service.pick_check_question(answer)
    assert second.id != first.id
    # And the new one is stable in its turn.
    assert service.pick_check_question(answer).id == second.id


# ---- what a check proves -----------------------------------------------


def test_passing_a_check_is_recorded_as_evidence(db):
    missed, _right, wrong = _question(db)
    check_q, check_right, _cw = _question(db)
    answer = _miss(db, missed, wrong)

    result = ReviewService(db).record_check(
        answer, check_q, [check_right.id], ConfidenceLevel.HIGH
    )

    assert result.passed is True
    stored = db.query(ReviewCheck).filter(ReviewCheck.answer_id == answer.id).one()
    assert stored.question_id == check_q.id
    assert stored.confidence_level == ConfidenceLevel.HIGH


def test_failing_a_check_is_recorded_too(db):
    missed, _right, wrong = _question(db)
    check_q, _cr, check_wrong = _question(db)
    answer = _miss(db, missed, wrong)

    result = ReviewService(db).record_check(answer, check_q, [check_wrong.id])
    assert result.passed is False


def test_a_check_moves_the_schedule_of_the_question_it_actually_asked(db):
    """The check question was genuinely answered, so it is genuinely scheduled."""
    missed, _right, wrong = _question(db)
    check_q, check_right, _cw = _question(db)
    answer = _miss(db, missed, wrong)

    ReviewService(db).record_check(answer, check_q, [check_right.id], ConfidenceLevel.HIGH)

    item = db.query(SpacedRepetition).filter(
        SpacedRepetition.question_id == check_q.id
    ).one()
    assert item.repetition == 1


def test_passing_a_check_does_not_claim_the_original_question_is_learnt(db):
    """A check can demote and cannot promote.

    Advancing the missed question's schedule because a *different* question
    went well would be the product claiming evidence it does not have.
    """
    missed, _right, wrong = _question(db)
    check_q, check_right, _cw = _question(db)
    answer = _miss(db, missed, wrong)

    db.add(SpacedRepetition(
        question_id=missed.id, repetition=2, interval_days=6, ease_factor=2.5,
        next_review_date=NOW + timedelta(days=6),
    ))
    db.commit()

    ReviewService(db).record_check(answer, check_q, [check_right.id], ConfidenceLevel.HIGH)

    item = db.query(SpacedRepetition).filter(
        SpacedRepetition.question_id == missed.id
    ).one()
    assert (item.repetition, item.interval_days) == (2, 6)


def test_failing_a_check_brings_the_original_concept_back_to_the_front(db):
    """A concept that does not transfer is not learnt, and the schedule should know."""
    missed, _right, wrong = _question(db)
    check_q, _cr, check_wrong = _question(db)
    answer = _miss(db, missed, wrong)

    db.add(SpacedRepetition(
        question_id=missed.id, repetition=4, interval_days=23, ease_factor=2.1,
        next_review_date=NOW + timedelta(days=23),
    ))
    db.commit()

    ReviewService(db).record_check(answer, check_q, [check_wrong.id])

    item = db.query(SpacedRepetition).filter(
        SpacedRepetition.question_id == missed.id
    ).one()
    assert item.repetition == 0
    assert item.interval_days == 1
    # And the due date, which is the column that actually decides anything.
    #
    # This assertion is the one the first version of the test was missing.
    # `count_due`, `get_due_items` and Home's "due for review" all read
    # `next_review_date` and nothing else, so resetting repetition and interval
    # alone was a reset that did not take: the fixture below sets this question
    # 23 days out, and 23 days out is where it stayed while the learner was
    # told the concept would "come round again soon".
    #
    # Pinned to "tomorrow" rather than to "before some deadline": the fixture's
    # NOW is a fixed date in the past, so a loose upper bound is satisfied by
    # the unreset value too, and the first version of this assertion passed
    # against the bug it was written to catch.
    expected_due = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1)
    assert abs((item.next_review_date - expected_due).total_seconds()) < 120
    # The ease factor is the running estimate of how hard this question is for
    # this learner, built over every previous encounter. One failed check about
    # a neighbouring question is not grounds to throw that away.
    assert item.ease_factor == pytest.approx(2.1)
    # And `last_reviewed_at` records the last time this question was actually
    # put to the learner. The check was a different question, so it stands.
    assert item.last_reviewed_at is None


def test_a_failed_check_schedules_a_concept_that_had_never_been_scheduled(db):
    missed, _right, wrong = _question(db)
    check_q, _cr, check_wrong = _question(db)
    answer = _miss(db, missed, wrong)

    assert db.query(SpacedRepetition).filter(
        SpacedRepetition.question_id == missed.id
    ).one_or_none() is None

    ReviewService(db).record_check(answer, check_q, [check_wrong.id])

    assert db.query(SpacedRepetition).filter(
        SpacedRepetition.question_id == missed.id
    ).one() is not None


def test_a_check_never_becomes_exam_evidence(db):
    """Domain accuracy, the weak-topic list and readiness all read exam_answers.

    A check is practice on a question chosen *because* the learner just got its
    neighbour wrong. Feeding that back into exam evidence would drag every one
    of those numbers down and make reviewing look like decline -- the same
    backwards loop the drill/weak-topic path already has.
    """
    missed, _right, wrong = _question(db)
    check_q, _cr, check_wrong = _question(db)
    answer = _miss(db, missed, wrong)

    before = db.query(ExamAnswer).count()
    ReviewService(db).record_check(answer, check_q, [check_wrong.id])

    assert db.query(ExamAnswer).count() == before
    assert db.query(ExamAnswer).filter(ExamAnswer.question_id == check_q.id).count() == 0


def test_answering_nothing_is_not_a_pass(db):
    missed, _right, wrong = _question(db)
    check_q, _cr, _cw = _question(db)
    answer = _miss(db, missed, wrong)

    assert ReviewService(db).record_check(answer, check_q, []).passed is False


def test_the_check_prefers_the_same_area_over_anything_in_the_domain(db):
    """Same domain is transfer in name only.

    Topics in this bank are written "Area: facets" -- "Sprint Retrospective:
    participants", "Product Backlog & Refinement (max 10% capacity rule)" -- so
    the text before the facet marker is a real mid-level grouping. Without that
    step, a miss on the only question carrying its exact topic was checked
    against any of the 287 questions in its domain.
    """
    missed, _right, wrong = _question(db, topic="Sprint Retrospective: participants")
    sibling, _sr, _sw = _question(db, topic="Sprint Retrospective: timebox")
    _far, _fr, _fw = _question(db, topic="Sprint Planning: topics", domain="Scrum Events")
    answer = _miss(db, missed, wrong)

    for _ in range(6):
        assert ReviewService(db).pick_check_question(answer).id == sibling.id


def test_a_topic_with_no_facet_marker_still_falls_through_to_the_domain():
    from app.services.review_service import _topic_area

    assert _topic_area("Sprint Retrospective: participants") == "Sprint Retrospective"
    assert _topic_area("Product Backlog & Refinement (max 10% capacity rule)") \
        == "Product Backlog & Refinement"
    assert _topic_area("Empiricism") == "Empiricism"
