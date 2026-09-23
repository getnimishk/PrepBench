# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_daily_goals.py

The two standing daily goals Home leads with.

Every number here is derived from the rows that caused it, on each request, so
the tests are about the arithmetic and about the refusals: a goal is never a
quota, "nothing due" is a state rather than a failure, yesterday's work does not
count toward today, one preparation's reviews do not count toward another's, and
an AI that never analysed anything has produced no signal rather than a zero.

Each test gets its own empty database, so counts are exact.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, register_sqlite_pragmas
from app.core.timeutils import local_day_start_as_naive_utc, utc_now_naive
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.interview_question import InterviewQuestion, InterviewRoundType
from app.models.option import QuestionOption
from app.models.practice_recording import PracticeRecording
from app.models.question import Question
from app.models.recording_analysis import RecordingAnalysis
from app.models.subject import Subject, SubjectKind
from app.repositories.settings_repository import SettingsRepository
from app.repositories.subject_repository import LEARNER, MOCK
from app.services.home_service import HomeService


@pytest.fixture
def db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'goals.db'}",
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


def _subject(db, name="Scrum PSM") -> Subject:
    tag = uuid.uuid4().hex[:6]
    subject = Subject(
        name=f"{name} {tag}",
        slug=f"s-{tag}",
        kind=SubjectKind.CERTIFICATION,
        certification=f"{name} Cert {tag}",
        pass_mark=85.0,
        exam_question_count=10,
        exam_minutes=60,
    )
    db.add(subject)
    db.commit()
    return subject


def _misses(db, subject, n, reviewed_at=None) -> list[ExamAnswer]:
    """A completed mock for `subject` with `n` wrong answers."""
    now = utc_now_naive()
    session = ExamSession(
        title="Mock",
        status=ExamStatus.COMPLETED,
        session_kind=MOCK,
        source=LEARNER,
        subject_id=subject.id,
        certification=subject.certification,
        start_time=now - timedelta(days=2),
        end_time=now - timedelta(days=2) + timedelta(hours=1),
        total_questions=n,
        answered_questions=n,
    )
    db.add(session)
    db.flush()
    answers = []
    for _ in range(n):
        q = Question(
            text=f"Q {uuid.uuid4().hex[:8]}", question_type="single_choice",
            domain="Scrum Events", topic="Scrum Events", difficulty="medium",
            certification=subject.certification, subject_id=subject.id,
        )
        db.add(q)
        db.flush()
        wrong = QuestionOption(question_id=q.id, option_text="Wrong", is_correct=False, order_index=1)
        db.add_all([QuestionOption(question_id=q.id, option_text="Right", is_correct=True, order_index=0), wrong])
        db.flush()
        answer = ExamAnswer(
            session_id=session.id, question_id=q.id, selected_option_ids=[wrong.id],
            is_correct=False, reviewed_at=reviewed_at,
        )
        db.add(answer)
        answers.append(answer)
    db.commit()
    return answers


def _goal(db, subject):
    return HomeService(db).daily_goals(subject)["certification"]


# ---- 1. the certification goal -----------------------------------------


def test_nothing_due_is_a_state_not_a_missed_day(db):
    """The prototype's own words: "Nothing is due. That is the system working,
    not a missed day." A target of 0 must read as that, not as 0 of something."""
    subject = _subject(db)

    goal = _goal(db, subject)

    assert goal["target"] == 0
    assert goal["done"] == 0
    assert goal["state"] == "nothing_due"


def test_the_goal_is_what_is_due_when_it_is_under_the_cap(db):
    subject = _subject(db)
    _misses(db, subject, 6)

    goal = _goal(db, subject)

    assert goal["due_for_review"] == 6
    assert goal["target"] == 6
    assert goal["done"] == 0
    assert goal["remaining"] == 6
    assert goal["state"] == "not_started"
    assert goal["queued_beyond_today"] == 0


def test_the_cap_makes_a_day_smaller_and_says_what_is_left_behind_it(db):
    """Never a quota: the cap can only shrink the goal, and the rest is named."""
    subject = _subject(db)
    _misses(db, subject, 35)
    SettingsRepository(db).update({"review_daily_cap": 20})

    goal = _goal(db, subject)

    assert goal["target"] == 20
    assert goal["queued_beyond_today"] == 15
    assert goal["daily_cap"] == 20


def test_reviewing_today_moves_done_up_without_moving_the_target(db):
    """The goal must stay put as you work through it.

    Reviewing a miss removes it from the queue, so a goal computed from the queue
    alone would shrink as you worked and "6 of 6" would never be reached. Adding
    today's reviews back in is what keeps the target stable.
    """
    subject = _subject(db)
    answers = _misses(db, subject, 6)

    for answer in answers[:4]:
        answer.reviewed_at = utc_now_naive()
    db.commit()

    goal = _goal(db, subject)

    assert goal["target"] == 6
    assert goal["done"] == 4
    assert goal["remaining"] == 2
    assert goal["due_for_review"] == 2
    assert goal["state"] == "in_progress"


def test_the_goal_is_done_when_every_due_review_is_done(db):
    subject = _subject(db)
    answers = _misses(db, subject, 3)
    for answer in answers:
        answer.reviewed_at = utc_now_naive()
    db.commit()

    goal = _goal(db, subject)

    assert goal["target"] == 3
    assert goal["done"] == 3
    assert goal["state"] == "done"


def test_yesterdays_reviews_do_not_count_toward_today(db):
    """The boundary is local midnight, from timeutils.

    A review done one second before today began belongs to yesterday. Getting
    this wrong -- date(created_at) in SQL, UTC midnight -- would let yesterday's
    evening count as this morning's work for anyone not on UTC.
    """
    subject = _subject(db)
    yesterday = local_day_start_as_naive_utc() - timedelta(seconds=1)
    _misses(db, subject, 5, reviewed_at=yesterday)

    goal = _goal(db, subject)

    assert goal["done"] == 0
    assert goal["target"] == 0, "yesterday's reviews were counted as today's goal"


def test_another_preparations_reviews_do_not_count(db):
    """Isolation, applied to the goal."""
    mine = _subject(db, "Mine")
    theirs = _subject(db, "Theirs")
    _misses(db, mine, 4)
    for answer in _misses(db, theirs, 7):
        answer.reviewed_at = utc_now_naive()
    db.commit()

    goal = _goal(db, mine)

    assert goal["due_for_review"] == 4
    assert goal["done"] == 0
    assert goal["target"] == 4


def test_no_preparation_means_no_certification_goal(db):
    """None, so a client cannot mistake an absent goal for a finished one."""
    assert HomeService(db).daily_goals(None)["certification"] is None


# ---- 2. the interview goal ---------------------------------------------


def _interview_question(db, round_type=InterviewRoundType.BEHAVIORAL) -> InterviewQuestion:
    q = InterviewQuestion(round_type=round_type, question_text=f"Tell me about {uuid.uuid4().hex[:6]}")
    db.add(q)
    db.commit()
    return q


def _recording(db, question, created_at=None) -> PracticeRecording:
    rec = PracticeRecording(
        title="Take", file_path=f"{uuid.uuid4().hex}.webm", file_size_bytes=10,
        interview_question_id=question.id,
        created_at=created_at or utc_now_naive(),
    )
    db.add(rec)
    db.commit()
    return rec


def test_the_interview_goal_is_one_recorded_answer_a_day(db):
    goal = HomeService(db).daily_goals(None)["interview"]
    assert goal["target"] == 1
    assert goal["done"] == 0
    assert goal["state"] == "not_started"

    _recording(db, _interview_question(db))

    goal = HomeService(db).daily_goals(None)["interview"]
    assert goal["done"] == 1
    assert goal["state"] == "done"


def test_a_recording_from_yesterday_does_not_meet_todays_interview_goal(db):
    yesterday = local_day_start_as_naive_utc() - timedelta(minutes=1)
    _recording(db, _interview_question(db), created_at=yesterday)

    goal = HomeService(db).daily_goals(None)["interview"]

    assert goal["done"] == 0


def test_no_analysis_means_no_signal_not_a_zero(db):
    """An AI that never analysed anything has produced nothing.

    Reporting 0% would blame the learner for a missing API key, which is the
    same failure the design-review grader refuses to commit.
    """
    rec = _recording(db, _interview_question(db))
    db.add(RecordingAnalysis(recording_id=rec.id, analysis_status="unavailable"))
    db.commit()

    goal = HomeService(db).daily_goals(None)["interview"]

    assert goal["latest_content_signal"] is None
    assert goal["latest_delivery_signal"] is None


def test_signals_come_from_the_latest_analysed_answer(db):
    rec = _recording(db, _interview_question(db))
    db.add(RecordingAnalysis(
        recording_id=rec.id,
        analysis_status="analyzed",
        content_scores=[
            {"category": "Structure", "score": 8, "max_score": 10, "feedback": "."},
            {"category": "Evidence", "score": 6, "max_score": 10, "feedback": "."},
        ],
        communication_scores=[
            {"category": "Pace", "score": 9, "max_score": 10, "feedback": "."},
        ],
    ))
    db.commit()

    goal = HomeService(db).daily_goals(None)["interview"]

    assert goal["latest_content_signal"] == 70.0
    assert goal["latest_delivery_signal"] == 90.0


def test_a_never_practised_round_is_named_first(db):
    """A recency fact, not a recommendation -- and never-practised beats stale."""
    behavioural = _interview_question(db, InterviewRoundType.BEHAVIORAL)
    _recording(db, behavioural)

    goal = HomeService(db).daily_goals(None)["interview"]

    assert goal["longest_since_round"] is not None
    assert goal["longest_since_round"] != InterviewRoundType.BEHAVIORAL.value
    assert goal["longest_since_round_never_practised"] is True


# ---- 3. Home must not contradict itself --------------------------------


def test_a_failed_analysis_is_not_reported_as_an_analysed_answer_anywhere(db):
    """Two readers of one table, and they have to agree.

    "Other preparation" counted every RecordingAnalysis row, including the
    "error" rows written when analysis failed, so one failed analysis read as
    "1 analysed answer" -- directly beside the interview goal, which reads the
    same table correctly and said nothing had been analysed. Found by looking at
    the new goal on a real database.
    """
    rec = _recording(db, _interview_question(db))
    db.add(RecordingAnalysis(recording_id=rec.id, analysis_status="error"))
    db.commit()

    service = HomeService(db)
    interview_rows = [r for r in service.other_preparation() if r["key"] == "interview"]
    goal = service.daily_goals(None)["interview"]

    assert interview_rows == [], (
        "a failed analysis was counted as an analysed answer: "
        f"{interview_rows[0]['detail'] if interview_rows else ''}"
    )
    assert goal["latest_delivery_signal"] is None


def test_a_successful_analysis_is_counted_in_both_places(db):
    rec = _recording(db, _interview_question(db))
    db.add(RecordingAnalysis(
        recording_id=rec.id,
        analysis_status="analyzed",
        communication_scores=[{"category": "Pace", "score": 8, "max_score": 10, "feedback": "."}],
    ))
    db.commit()

    service = HomeService(db)
    interview_rows = [r for r in service.other_preparation() if r["key"] == "interview"]

    assert interview_rows and interview_rows[0]["detail"] == "1 analysed answer"
    assert service.daily_goals(None)["interview"]["latest_delivery_signal"] == 80.0


# ---- 4. the goal and the queue it points at must agree -----------------


def test_the_review_queue_for_a_preparation_matches_its_daily_goal(db):
    """Home's goal says how many are due; "Start review" opens the queue.

    The queue was not scoped to a preparation, so a learner switched to one with
    nothing due saw "Nothing due" on Home and then another preparation's mistakes
    in Review. Both now read the same ownership rule, so they cannot disagree.
    """
    from app.api.v1.review import review_queue

    mine = _subject(db, "Mine")
    theirs = _subject(db, "Theirs")
    _misses(db, mine, 3)
    _misses(db, theirs, 5)

    goal = _goal(db, mine)
    queue = review_queue(limit=None, subject_id=mine.id, db=db)

    assert goal["due_for_review"] == 3
    assert queue.total_unreviewed == 3, (
        f"the queue listed {queue.total_unreviewed} mistakes for a preparation whose goal says 3"
    )
    assert len(queue.items) == 3

    empty = _subject(db, "Nothing Due")
    assert _goal(db, empty)["state"] == "nothing_due"
    assert review_queue(limit=None, subject_id=empty.id, db=db).total_unreviewed == 0


def test_the_unscoped_queue_still_lists_everything(db):
    """Omitting subject_id is the compatible default: no existing caller changes."""
    from app.api.v1.review import review_queue

    _misses(db, _subject(db, "A"), 2)
    _misses(db, _subject(db, "B"), 4)

    assert review_queue(limit=None, subject_id=None, db=db).total_unreviewed == 6


def test_the_memory_drill_count_is_scoped_to_the_preparation(db):
    """Spaced-repetition due items, per preparation, in the Review page's response.

    Unscoped, Review offered a memory drill for a preparation with nothing due,
    and the engine -- which does scope by the question's preparation -- refused it.
    """
    from app.api.v1.review import review_queue
    from app.models.spaced_repetition import SpacedRepetition

    mine = _subject(db, "Mine")
    theirs = _subject(db, "Theirs")
    past = utc_now_naive() - timedelta(days=1)
    for subject, n in ((mine, 2), (theirs, 4)):
        for answer in _misses(db, subject, n):
            db.add(SpacedRepetition(question_id=answer.question_id, next_review_date=past))
    db.commit()

    assert review_queue(limit=None, subject_id=mine.id, db=db).spaced_due == 2
    assert review_queue(limit=None, subject_id=theirs.id, db=db).spaced_due == 4
    assert review_queue(limit=None, subject_id=None, db=db).spaced_due == 6
