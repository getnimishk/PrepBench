# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import uuid
from datetime import datetime, UTC
from fastapi.testclient import TestClient

from app.main import app
from app.models.exam_session import ExamSession, ExamStatus, ExamMode
from app.models.exam_answer import ExamAnswer, ConfidenceLevel
from app.services.analytics_service import AnalyticsService
from app.repositories.analytics_repository import AnalyticsRepository
from tests.conftest import TestingSessionLocal

client = TestClient(app)


def _create_question(topic, n_options=2):
    payload = {
        "text": f"Analytics regression question-{uuid.uuid4().hex}",
        "question_type": "single_choice",
        "topic": topic,
        "domain": "Unit Test Domain",
        "certification": f"UnitTestCert-{uuid.uuid4().hex[:8]}",
        "options": [
            {"option_text": f"Option {i}", "is_correct": i == 0, "order_index": i}
            for i in range(n_options)
        ],
    }
    res = client.post("/api/v1/questions", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


def _completed_session_with_answer(db, question_id, is_correct):
    """Directly constructs a COMPLETED session + a single ExamAnswer row, bypassing
    the full create/save/finish HTTP flow so tests can assert on exact is_correct
    values (including None, to simulate a skipped question) without depending on
    live grading logic."""
    session = ExamSession(
        title="Analytics Regression Session",
        exam_mode=ExamMode.PRACTICE,
        status=ExamStatus.COMPLETED,
        total_questions=1,
        question_ids_order=[question_id],
        start_time=datetime.now(UTC).replace(tzinfo=None),
        end_time=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(session)
    db.flush()

    answer = ExamAnswer(
        session_id=session.id,
        question_id=question_id,
        selected_option_ids=[] if is_correct is None else [1],
        is_correct=is_correct,
        time_spent_seconds=5,
        confidence_level=ConfidenceLevel.NOT_SET,
    )
    db.add(answer)
    db.commit()
    return session.id


def test_skipped_answers_excluded_from_dashboard_accuracy():
    """
    Regression test: get_overall_stats / get_topic_group_performance both filter
    on `ExamAnswer.is_correct != None` to mean "this question was attempted".
    A skipped question wrongly recorded as is_correct=False (the bug fixed in
    exam_engine.save_answer) would silently count as a wrong answer here. This
    test asserts the dashboard's overall accuracy reflects only genuinely
    attempted (non-null) answers.
    """
    q_correct = _create_question(topic="Skip Regression Topic A")
    q_skipped = _create_question(topic="Skip Regression Topic A")

    db = TestingSessionLocal()
    try:
        _completed_session_with_answer(db, q_correct["id"], is_correct=True)
        _completed_session_with_answer(db, q_skipped["id"], is_correct=None)

        service = AnalyticsService(db)
        overview = service.get_dashboard_overview()
    finally:
        db.close()

    # A skipped question must not appear as an attempted question at all.
    assert overview.overall_accuracy_percentage == 100.0, (
        "A skipped question (is_correct=None) affected overall accuracy -- "
        "it should be excluded entirely, not counted as wrong."
    )


def test_topic_group_performance_groups_by_leading_phrase():
    """
    Regression test for the "Weak Areas" widget grouping fix: raw `topic` text
    is near-unique per question in real question banks (e.g. "Anti-pattern
    recognition (Sprint 0 traps)" vs "Anti-pattern recognition (Story Points
    mandatory)"), so grouping directly by `topic` produces mostly single-attempt
    noise. get_topic_group_performance groups by the leading phrase before the
    first '(' or ':' instead, so both variants below must roll up into one
    "Anti-pattern recognition" group.
    """
    q1 = _create_question(topic="Anti-pattern recognition (Sprint 0 traps)")
    q2 = _create_question(topic="Anti-pattern recognition (Story Points mandatory)")

    db = TestingSessionLocal()
    try:
        _completed_session_with_answer(db, q1["id"], is_correct=True)
        _completed_session_with_answer(db, q2["id"], is_correct=False)

        repo = AnalyticsRepository(db)
        groups = repo.get_topic_group_performance()
    finally:
        db.close()

    matching = [g for g in groups if g["topic"] == "Anti-pattern recognition"]
    assert len(matching) == 1, (
        f"Expected the two topic variants to roll up into a single "
        f"'Anti-pattern recognition' group, got groups: {[g['topic'] for g in groups]}"
    )
    assert matching[0]["total_attempted"] == 2
    assert matching[0]["correct_count"] == 1


def test_weak_topics_excludes_low_sample_size():
    """
    Regression test for MIN_ATTEMPTS_FOR_CALLOUT: a topic attempted only once
    and missed reads as a permanent, misleading "0% weak topic". The dashboard
    must not surface a weak/strong callout for a topic-group below the minimum
    sample size, even though the raw grouped accuracy is a real 0%/100%.
    """
    low_sample_topic = f"Low Sample Topic {uuid.uuid4().hex[:8]}"
    high_sample_topic = f"High Sample Topic {uuid.uuid4().hex[:8]}"

    db = TestingSessionLocal()
    try:
        # Only 1 attempt -- below AnalyticsService.MIN_ATTEMPTS_FOR_CALLOUT.
        q_low = _create_question(topic=low_sample_topic)
        _completed_session_with_answer(db, q_low["id"], is_correct=False)

        # 3 attempts, 2 wrong (66.7%) -- meets the threshold and is genuinely weak.
        for is_correct in (False, False, True):
            q_high = _create_question(topic=high_sample_topic)
            _completed_session_with_answer(db, q_high["id"], is_correct=is_correct)

        service = AnalyticsService(db)
        overview = service.get_dashboard_overview()
    finally:
        db.close()

    weak_topic_names = [t.topic for t in overview.weak_topics]
    assert low_sample_topic not in weak_topic_names, (
        "A topic with only 1 attempt appeared in weak_topics -- single-attempt "
        "noise should be filtered out by MIN_ATTEMPTS_FOR_CALLOUT."
    )
    assert high_sample_topic in weak_topic_names, (
        "A topic with 3 attempts at 66.7% should meet the minimum sample size "
        "and appear as a weak topic."
    )
