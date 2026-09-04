# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Subjects and the mock/drill boundary, end to end.

The rule itself is tested in test_readiness.py against pure data. These
tests check the thing that feeds it: that the repository can only ever
hand it full mocks, whatever else is in the database.
"""
import pytest
from datetime import datetime, timedelta, UTC
from fastapi.testclient import TestClient

from app.main import app
from app.models.exam_session import ExamSession, ExamStatus, ExamMode
from app.models.subject import Subject, SubjectKind
from app.repositories.subject_repository import SubjectRepository, MOCK, DRILL
from app.services.readiness import ReadinessState

client = TestClient(app)


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
    """A throwaway certification subject with its own certification string, so
    sessions created here cannot be picked up by another test's subject."""
    import uuid
    cert = f"TestCert-{uuid.uuid4().hex[:8]}"
    s = Subject(
        name=f"Test Subject {cert}",
        slug=f"test-{cert.lower()}",
        kind=SubjectKind.CERTIFICATION,
        certification=cert,
        pass_mark=85.0,
        exam_question_count=80,
        exam_minutes=60,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _session(db, subject, kind, score, days_ago=0):
    now = datetime.now(UTC).replace(tzinfo=None)
    s = ExamSession(
        title=f"{kind} {score}",
        exam_mode=ExamMode.TIMED,
        status=ExamStatus.COMPLETED,
        certification=subject.certification,
        subject_id=subject.id,
        session_kind=kind,
        total_questions=80,
        answered_questions=80,
        score_percentage=score,
        passing_percentage=85.0,
        start_time=now - timedelta(days=days_ago),
        end_time=now - timedelta(days=days_ago),
    )
    db.add(s)
    db.commit()
    return s


# ---- the guarantee everything rests on --------------------------------


def test_drills_are_invisible_to_readiness(db, subject):
    """The single most important behaviour in this feature.

    Twenty perfect drills must leave readiness exactly where zero drills
    would: needs evaluation. If this ever passes drills through, every
    readiness statement in the product becomes a lie.
    """
    for i in range(20):
        _session(db, subject, DRILL, 100.0, days_ago=i)

    results = SubjectRepository(db).get_mock_results(subject)
    assert results == []


def test_a_drill_cannot_be_promoted_by_scoring_well(db, subject):
    """A drill at 100% and a mock at 60%: only the mock counts, so the
    subject is developing rather than ready."""
    _session(db, subject, DRILL, 100.0, days_ago=2)
    _session(db, subject, MOCK, 60.0, days_ago=1)

    results = SubjectRepository(db).get_mock_results(subject)
    assert len(results) == 1
    assert results[0].score_pct == 60.0


def test_session_kind_defaults_to_drill(db, subject):
    """Every session recorded before the column existed must count as
    practice. Historical data cannot inflate readiness."""
    now = datetime.now(UTC).replace(tzinfo=None)
    s = ExamSession(
        title="No kind given",
        certification=subject.certification,
        subject_id=subject.id,
        total_questions=10,
        status=ExamStatus.COMPLETED,
        score_percentage=95.0,
        start_time=now,
        end_time=now,
    )
    db.add(s)
    db.commit()
    db.refresh(s)

    assert s.session_kind == DRILL
    assert SubjectRepository(db).get_mock_results(subject) == []


def test_an_unfinished_mock_does_not_count(db, subject):
    """An abandoned mock is not a measurement under exam conditions."""
    now = datetime.now(UTC).replace(tzinfo=None)
    s = ExamSession(
        title="Walked away",
        certification=subject.certification,
        subject_id=subject.id,
        session_kind=MOCK,
        status=ExamStatus.IN_PROGRESS,
        total_questions=80,
        score_percentage=None,
        start_time=now,
    )
    db.add(s)
    db.commit()

    assert SubjectRepository(db).get_mock_results(subject) == []


# ---- resolution and ordering ------------------------------------------


def test_mocks_recorded_before_subjects_existed_still_resolve(db, subject):
    """Matched on the certification string when subject_id is null, so the
    subject model can be introduced without rewriting history."""
    now = datetime.now(UTC).replace(tzinfo=None)
    s = ExamSession(
        title="Predates subjects",
        certification=subject.certification,
        subject_id=None,
        session_kind=MOCK,
        status=ExamStatus.COMPLETED,
        total_questions=80,
        score_percentage=88.0,
        start_time=now,
        end_time=now,
    )
    db.add(s)
    db.commit()

    results = SubjectRepository(db).get_mock_results(subject)
    assert [r.score_pct for r in results] == [88.0]


def test_results_come_back_oldest_first(db, subject):
    """The rule reads the last three consecutively, so order is load-bearing."""
    _session(db, subject, MOCK, 70.0, days_ago=3)
    _session(db, subject, MOCK, 80.0, days_ago=2)
    _session(db, subject, MOCK, 90.0, days_ago=1)

    results = SubjectRepository(db).get_mock_results(subject)
    assert [r.score_pct for r in results] == [70.0, 80.0, 90.0]


# ---- the API ----------------------------------------------------------


def test_subjects_endpoint_returns_readiness_with_its_evidence():
    res = client.get("/api/v1/subjects")
    assert res.status_code == 200
    for item in res.json():
        readiness = item["readiness"]
        # Every verdict carries what it rests on. A state with no sample size
        # is a claim with no basis.
        assert "state" in readiness
        assert "mock_count" in readiness
        assert readiness["state"] in {s.value for s in ReadinessState}


def test_a_skill_subject_never_reports_ready():
    """No pass mark means nothing to be ready against."""
    for item in client.get("/api/v1/subjects").json():
        if item["kind"] == "skill":
            assert item["readiness"]["state"] != ReadinessState.READY.value
            assert item["pass_mark"] is None
            assert item["has_exam_profile"] is False


def test_unknown_subject_404s():
    assert client.get("/api/v1/subjects/999999999").status_code == 404


def test_seeded_subjects_exist_and_only_the_certification_has_an_exam_profile():
    from tests.conftest import TestingSessionLocal
    from app.utils.seed_subjects import seed_subjects, SEED_SUBJECTS

    session = TestingSessionLocal()
    try:
        seed_subjects(session)
        names = SubjectRepository(session).get_existing_names()
    finally:
        session.close()

    for seed in SEED_SUBJECTS:
        assert seed["name"] in names

    for seed in SEED_SUBJECTS:
        if seed["kind"] is SubjectKind.CERTIFICATION:
            assert seed["pass_mark"] is not None
            assert seed["exam_question_count"] is not None
        else:
            # A skill subject must not carry a pass mark, or it becomes
            # eligible for a readiness verdict it has no exam to justify.
            assert seed["pass_mark"] is None
