# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
What counts as a full paper sat before the app could record one.

The reconciliation is the riskiest change in this repair, because it moves
rows into the population that decides readiness. These tests are the argument
that it only moves the ones it can prove.
"""
import uuid
from datetime import datetime, timedelta

import pytest

from app.models.exam_session import ExamSession, ExamMode, ExamStatus
from app.models.subject import Subject, SubjectKind
from app.repositories.subject_repository import DRILL, MOCK, TEST
from app.utils.reconcile_evidence import reconcile_session_kinds


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def subject(db):
    tag = uuid.uuid4().hex[:8]
    s = Subject(
        name="Reconcile Subject " + tag,
        slug="rec-" + tag,
        kind=SubjectKind.CERTIFICATION,
        certification="ReconcileCert-" + tag,
        pass_mark=85.0,
        exam_question_count=80,
        exam_minutes=60,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _session(db, subject, **overrides):
    """A session shaped exactly like the six real PSM I papers, before
    any override narrows it."""
    defaults = dict(
        title="Timed Exam",
        exam_mode=ExamMode.TIMED,
        status=ExamStatus.COMPLETED,
        certification=subject.certification,
        session_kind=DRILL,
        total_questions=80,
        answered_questions=80,
        correct_count=70,
        score_percentage=87.5,
        passing_percentage=95.0,
        time_allowed_seconds=3600,
        time_spent_seconds=2400,
        question_ids_order=[],
        start_time=datetime(2026, 8, 31, 6, 53),
        end_time=datetime(2026, 8, 31, 7, 34),
    )
    defaults.update(overrides)
    row = ExamSession(**defaults)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_a_full_timed_paper_is_recognised_as_a_mock(db, subject):
    """The six real PSM I papers. Eighty questions, all answered, one hour,
    the subject's own certification -- a mock in everything but the field
    the browser could not send."""
    row = _session(db, subject)

    promoted = reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == MOCK
    assert row.subject_id == subject.id
    assert (row.id, subject.name) in promoted


def test_an_abandoned_paper_stays_a_drill(db, subject):
    """Sessions 2 and 3 in the working database: started as full papers,
    walked away from. Real learner activity, not a measurement."""
    row = _session(db, subject, answered_questions=52, score_percentage=36.2)

    reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == DRILL


def test_a_short_session_stays_a_drill(db, subject):
    row = _session(db, subject, total_questions=5, answered_questions=5)

    reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == DRILL


def test_an_untimed_session_stays_a_drill(db, subject):
    """Timing is a condition of the exam, not a preference. An untimed run
    at full length tests recall, not recall under pressure."""
    row = _session(db, subject, exam_mode=ExamMode.PRACTICE, time_allowed_seconds=None)

    reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == DRILL


def test_a_paper_on_a_different_timer_stays_a_drill(db, subject):
    """Full length but ninety minutes where the exam allows sixty. More time
    than the real thing is a different measurement."""
    row = _session(db, subject, time_allowed_seconds=5400)

    reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == DRILL


def test_an_unfinished_session_stays_a_drill(db, subject):
    row = _session(db, subject, status=ExamStatus.IN_PROGRESS, answered_questions=2)

    reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == DRILL


def test_a_quarantined_session_is_never_promoted(db, subject):
    """A regression test that happens to be full length is still not
    evidence. Provenance is checked before shape."""
    row = _session(db, subject, source=TEST)

    reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == DRILL


def test_another_subjects_paper_is_not_claimed(db, subject):
    row = _session(db, subject, certification="Some Other Certification")

    reconcile_session_kinds(db)

    db.refresh(row)
    assert row.session_kind == DRILL
    assert row.subject_id is None


def test_running_it_twice_changes_nothing_the_second_time(db, subject):
    """It runs at every startup, so a second pass must be a no-op rather
    than churn."""
    _session(db, subject)

    first = reconcile_session_kinds(db)
    second = reconcile_session_kinds(db)

    assert len(first) == 1
    assert second == []


def test_a_subject_with_no_exam_profile_promotes_nothing(db):
    """A skill subject has no paper to be a full-length version of."""
    tag = uuid.uuid4().hex[:8]
    skill = Subject(name="Skill " + tag, slug="skill-rec-" + tag, kind=SubjectKind.SKILL)
    db.add(skill)
    db.commit()

    assert reconcile_session_kinds(db) == []


def test_recognised_papers_reach_the_readiness_rule(db, subject):
    """The whole point. Three papers at or above an 85% pass mark, sat before
    the app could say "mock", must produce a readiness state rather than
    "needs evaluation"."""
    from app.repositories.subject_repository import SubjectRepository
    from app.services import readiness as readiness_rules

    base = datetime.now() - timedelta(days=6)
    for i, score in enumerate([88.0, 90.0, 92.5]):
        _session(
            db, subject,
            score_percentage=score,
            start_time=base + timedelta(days=i),
            end_time=base + timedelta(days=i, hours=1),
        )

    reconcile_session_kinds(db)

    result = readiness_rules.compute(
        SubjectRepository(db).get_mock_results(subject),
        pass_mark=subject.pass_mark,
        has_exam_profile=subject.has_exam_profile,
    )
    assert result.mock_count == 3
    assert result.state is not readiness_rules.ReadinessState.NEEDS_EVALUATION
    assert result.recent_scores == [88.0, 90.0, 92.5]


def test_the_stored_threshold_does_not_decide_whether_a_paper_passed(db, subject):
    """A settings default from August cannot fail a paper that cleared the bar.

    Five of the six real papers carry passing_percentage 95.0 -- the app's
    default at the time, never the PSM I pass mark. An 87.5% paper was
    therefore stamped is_passed="failed" when it was sat, while Home counts
    it as clearing 85%.

    Readiness re-judges the raw score against the subject's own pass mark,
    which is the only bar that means anything. This pins that: three papers
    at 87.5% against a stored threshold of 95 must still reach READY.
    """
    from app.repositories.subject_repository import SubjectRepository
    from app.services import readiness as readiness_rules

    base = datetime.now() - timedelta(days=5)
    for i in range(3):
        _session(
            db, subject,
            score_percentage=87.5,
            passing_percentage=95.0,   # the app's default, not the exam's
            is_passed="failed",        # what was computed against it at the time
            start_time=base + timedelta(days=i),
            end_time=base + timedelta(days=i, hours=1),
        )

    reconcile_session_kinds(db)

    result = readiness_rules.compute(
        SubjectRepository(db).get_mock_results(subject),
        pass_mark=subject.pass_mark,        # 85.0
        has_exam_profile=subject.has_exam_profile,
    )
    assert result.mock_count == 3
    assert all(s >= 85.0 for s in result.recent_scores)
    assert not [b for b in result.blockers if b.kind == readiness_rules.BLOCKER_BELOW_PASS]


def test_reconciliation_never_touches_a_session_the_learner_labelled(db, subject):
    """It fills a blank; it does not overwrite a choice.

    session_kind arrived as ALTER TABLE ... DEFAULT 'drill', so "drill" on a
    historical row is a schema default rather than something anybody said.
    A row that says "drill" *and* is a five-question practice run said it for
    a reason, and stays put -- as does anything already marked a mock.
    """
    already = _session(db, subject, session_kind=MOCK)
    deliberate = _session(
        db, subject,
        exam_mode=ExamMode.PRACTICE, total_questions=5, answered_questions=5,
        time_allowed_seconds=None,
    )

    promoted = reconcile_session_kinds(db)

    assert already.id not in [sid for sid, _ in promoted]
    db.refresh(deliberate)
    assert deliberate.session_kind == DRILL
