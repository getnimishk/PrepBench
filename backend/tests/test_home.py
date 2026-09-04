# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Home, coverage, activity and review tracking.

The recurring theme is what these surfaces refuse to do: Home returns no
ranked recommendation, coverage returns empty formats rather than hiding
them, and an unreviewed answer stays unreviewed until someone actually
looks at it.
"""
import uuid
import pytest
from datetime import datetime, timedelta, UTC
from fastapi.testclient import TestClient

from app.main import app
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.subject import Subject, SubjectKind
from app.services.home_service import HomeService

client = TestClient(app)


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _now():
    return datetime.now(UTC).replace(tzinfo=None)


def _questions(db, n, domain="Test Domain", cert=None):
    """Real question rows -- the test database enforces foreign keys, and
    answers pointing at questions that do not exist is not a state the
    application can reach."""
    from app.models.question import Question, QuestionType, QuestionDifficulty

    made = []
    for i in range(n):
        q = Question(
            text=f"Test question {uuid.uuid4().hex[:8]}",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty=QuestionDifficulty.MEDIUM,
            domain=domain,
            certification=cert,
        )
        db.add(q)
        made.append(q)
    db.commit()
    for q in made:
        db.refresh(q)
    return made


def _completed_mock(db, score=70.0, wrong=3, cert=None, kind="mock"):
    """A finished session with `wrong` unreviewed incorrect answers."""
    session = ExamSession(
        title="Mock" if kind == "mock" else "Drill",
        certification=cert,
        session_kind=kind,
        status=ExamStatus.COMPLETED,
        total_questions=wrong + 2,
        answered_questions=wrong + 2,
        score_percentage=score,
        start_time=_now(),
        end_time=_now(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    for q in _questions(db, wrong, cert=cert):
        db.add(ExamAnswer(session_id=session.id, question_id=q.id, is_correct=False))
    db.commit()
    return session


# ---- Home returns state, never instructions ---------------------------


def test_home_carries_no_ranked_recommendation():
    """The design decision this endpoint exists to hold: the user rejected
    being told what to do next, so no ordered suggestion may be returned."""
    body = client.get("/api/v1/home").json()

    for banned in ("suggested", "next_actions", "recommendations", "do_next", "todo"):
        assert banned not in body, f"Home must not return {banned}"

    assert set(body) == {"resumable", "unreviewed_total", "due_for_review", "per_subject"}


def test_home_reports_counts_not_percentages():
    body = client.get("/api/v1/home").json()
    assert isinstance(body["unreviewed_total"], int)
    assert isinstance(body["due_for_review"], int)


def test_resume_is_absent_rather_than_faked_when_nothing_is_open(db):
    """No unfinished session means no resume card, not an empty one."""
    for s in db.query(ExamSession).filter(
        ExamSession.status.in_([ExamStatus.IN_PROGRESS, ExamStatus.PAUSED])
    ).all():
        s.status = ExamStatus.COMPLETED
    db.commit()

    assert HomeService(db).get_resumable() is None


def test_an_unfinished_session_is_resumable(db):
    session = ExamSession(
        title="Half-done mock",
        session_kind="mock",
        status=ExamStatus.IN_PROGRESS,
        total_questions=80,
        answered_questions=22,
        time_allowed_seconds=3600,
        time_spent_seconds=1320,
        start_time=_now(),
    )
    db.add(session)
    db.commit()

    resumable = HomeService(db).get_resumable()
    assert resumable is not None
    assert resumable["answered"] == 22
    assert resumable["total"] == 80
    assert resumable["seconds_remaining"] == 2280


# ---- unreviewed answers -----------------------------------------------


def test_wrong_answers_start_unreviewed_and_stay_that_way(db):
    """Nothing marks an answer reviewed except a person looking at it."""
    before = HomeService(db).unreviewed_count()
    _completed_mock(db, wrong=4)
    assert HomeService(db).unreviewed_count() == before + 4


def test_marking_an_answer_reviewed_clears_it(db):
    session = _completed_mock(db, wrong=2)
    before = HomeService(db).unreviewed_count()

    unreviewed = client.get(f"/api/v1/exams/{session.id}/unreviewed").json()
    assert unreviewed["count"] == 2

    qid = unreviewed["question_ids"][0]
    assert client.post(f"/api/v1/exams/{session.id}/answers/{qid}/reviewed").status_code == 200

    db.expire_all()
    assert HomeService(db).unreviewed_count() == before - 1
    assert client.get(f"/api/v1/exams/{session.id}/unreviewed").json()["count"] == 1


def test_reviewing_twice_does_not_move_the_timestamp(db):
    """Re-opening a reviewed answer is not a second review. Bumping it would
    make 'when did you last revise this' wrong."""
    session = _completed_mock(db, wrong=1)
    qid = client.get(f"/api/v1/exams/{session.id}/unreviewed").json()["question_ids"][0]

    first = client.post(f"/api/v1/exams/{session.id}/answers/{qid}/reviewed").json()["reviewed_at"]
    second = client.post(f"/api/v1/exams/{session.id}/answers/{qid}/reviewed").json()["reviewed_at"]
    assert first == second


def test_drill_answers_are_not_counted_as_unreviewed(db):
    """A drill gives feedback as you go, so there is no separate review step
    to be behind on."""
    before = HomeService(db).unreviewed_count()

    _completed_mock(db, score=40.0, wrong=5, kind="drill")

    assert HomeService(db).unreviewed_count() == before


def test_marking_an_answer_that_does_not_exist_404s():
    assert client.post("/api/v1/exams/999999/answers/999999/reviewed").status_code == 404


# ---- coverage ---------------------------------------------------------


def test_coverage_returns_empty_formats_rather_than_hiding_them(db):
    """The entire point of the subject page. A format with no content is a
    visible row with a call to action, not an omission."""
    subject = Subject(
        name=f"Coverage Test {uuid.uuid4().hex[:6]}",
        slug=f"cov-{uuid.uuid4().hex[:6]}",
        kind=SubjectKind.SKILL,
    )
    db.add(subject); db.commit(); db.refresh(subject)

    coverage = client.get(f"/api/v1/home/subjects/{subject.id}/coverage").json()
    keys = [c["key"] for c in coverage]

    assert "mock" in keys and "drill" in keys and "design_review" in keys
    unavailable = [c for c in coverage if not c["available"]]
    assert unavailable, "a subject with no content must still list its formats"
    for c in unavailable:
        assert c["detail"], "an unavailable format must say why"


def test_a_skill_subject_cannot_offer_a_mock(db):
    """No exam profile means no mock, and the row says so instead of
    offering something that cannot be assembled."""
    subject = Subject(
        name=f"No Exam {uuid.uuid4().hex[:6]}",
        slug=f"noexam-{uuid.uuid4().hex[:6]}",
        kind=SubjectKind.SKILL,
    )
    db.add(subject); db.commit(); db.refresh(subject)

    coverage = client.get(f"/api/v1/home/subjects/{subject.id}/coverage").json()
    mock = next(c for c in coverage if c["key"] == "mock")
    assert mock["available"] is False
    assert "exam profile" in mock["detail"].lower()


def test_coverage_for_unknown_subject_404s():
    assert client.get("/api/v1/home/subjects/999999999/coverage").status_code == 404


# ---- unified activity -------------------------------------------------


def test_activity_merges_every_format_into_one_timeline(db):
    _completed_mock(db, score=71.0)
    items = client.get("/api/v1/home/activity?limit=50").json()

    assert items
    kinds = {i["kind"] for i in items}
    assert kinds & {"mock", "drill", "design_review", "system_design", "recording"}

    # Newest first, and every entry is navigable.
    stamps = [i["at"] for i in items if i["at"]]
    assert stamps == sorted(stamps, reverse=True)
    for i in items:
        assert i["href"].startswith("/")


def test_activity_says_not_graded_rather_than_zero(db):
    """An ungraded attempt has no score. Rendering it as 0% would invent a
    failure the learner never had."""
    items = client.get("/api/v1/home/activity?limit=100").json()
    for i in items:
        assert i["detail"] != "0%" or "0%" in i["detail"] and i["kind"] in {"mock", "drill"}
