# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_subject_isolation_hardening.py

Phase 4 Hardening: SUBJECT-ISOLATION / NO-SILENT-SUBSTITUTION.

Guarantees and enforces:
  Kafka + 0 Kafka questions = NO QUESTIONS (count = 0, items = [])
  NEVER:
  Kafka + 0 Kafka questions = PSM I questions

Regression Tests:
  Test 1: Kafka question retrieval returns count = 0, no items where subject_id != kafka.id.
  Test 2: Kafka cannot receive PSM I questions under any certification/domain token overlap.
  Test 3: Kafka mock creation (POST /api/v1/exams) fails with 400 and creates no session.
  Test 4: Kafka drill creation (POST /api/v1/exams) fails with 400, no PSM I questions assembled.
  Test 5: Review queue for Kafka returns 0 items; does not leak PSM I review items, and check questions are isolated.
  Test 6: Positive control: PSM I question retrieval and mock creation work normally.
  Test 7: Direct API protection: direct requests with subject_id=kafka.id or Kafka certification string return 0 questions / 400.
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.option import QuestionOption
from app.models.question import Question, QuestionType
from app.models.subject import Subject, SubjectKind
from app.services.review_service import ReviewService

client = TestClient(app)


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _get_or_create_kafka(db) -> Subject:
    kafka = db.query(Subject).filter(Subject.slug == "kafka-ccdak").first()
    if not kafka:
        kafka = Subject(
            name="Confluent Certified Developer for Apache Kafka",
            slug="kafka-ccdak",
            kind=SubjectKind.CERTIFICATION,
            certification="CCDAK - Confluent Certified Developer for Apache Kafka",
            pass_mark=70.0,
            exam_question_count=60,
            exam_minutes=90,
        )
        db.add(kafka)
        db.commit()
        db.refresh(kafka)
    return kafka


def _get_or_create_psm(db) -> Subject:
    psm = db.query(Subject).filter(Subject.slug == "psm-i").first()
    if not psm:
        psm = Subject(
            name="Scrum / PSM I",
            slug="psm-i",
            kind=SubjectKind.CERTIFICATION,
            certification="PSM I - Professional Scrum Master",
            pass_mark=85.0,
            exam_question_count=80,
            exam_minutes=60,
        )
        db.add(psm)
        db.commit()
        db.refresh(psm)
    return psm


def test_1_kafka_question_retrieval_returns_zero(db):
    """Test 1: Kafka question retrieval returns count = 0, no items where subject_id != kafka.id."""
    kafka = _get_or_create_kafka(db)
    response = client.get(f"/api/v1/questions?subject_id={kafka.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []
    # Assert zero leakage from any other subject
    for q in data["items"]:
        assert q["subject_id"] == kafka.id


def test_2_kafka_cannot_receive_psm_questions_under_token_overlap(db):
    """Test 2: Kafka cannot receive PSM I questions under any certification/domain token overlap.

    Even if a question carries overlapping tokens ('Developer', 'Professional', 'Scrum')
    or domain text, querying with subject_id=kafka.id strictly restricts to subject_id == kafka.id.
    """
    kafka = _get_or_create_kafka(db)
    psm = _get_or_create_psm(db)

    psm_q = Question(
        text="A question about Developer Scrum Master and Apache Kafka topics",
        certification=psm.certification,
        subject_id=psm.id,
        domain="Kafka Developer Concepts",
        topic="Scrum Architecture",
        question_type=QuestionType.SINGLE_CHOICE,
        difficulty="medium",
        options=[
            QuestionOption(option_text="Option A", is_correct=True, order_index=1),
            QuestionOption(option_text="Option B", is_correct=False, order_index=2),
        ],
    )
    db.add(psm_q)
    db.commit()

    try:
        # Request for Kafka must NOT return this question
        res = client.get(f"/api/v1/questions?subject_id={kafka.id}")
        assert res.status_code == 200
        items = res.json()["items"]
        assert all(item["id"] != psm_q.id for item in items)
        assert res.json()["total"] == 0
    finally:
        db.delete(psm_q)
        db.commit()


def test_3_kafka_mock_creation_refuses_with_400(db):
    """Test 3: Kafka mock creation (POST /api/v1/exams) fails with 400 and creates no session."""
    kafka = _get_or_create_kafka(db)
    before_count = db.query(ExamSession).filter(ExamSession.subject_id == kafka.id).count()

    # 1. Preview must refuse
    preview_res = client.post(
        "/api/v1/exams/preview",
        json={
            "subject_id": kafka.id,
            "session_kind": "mock",
            "exam_mode": "timed",
            "total_questions": 60,
        },
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["can_start"] is False
    assert "no questions yet" in preview_data["reason"].lower()
    assert preview_data["available"] == 0
    assert preview_data["will_draw"] == 0

    # 2. Mock start must fail with 400
    start_res = client.post(
        "/api/v1/exams",
        json={
            "title": "Kafka Mock Session",
            "subject_id": kafka.id,
            "session_kind": "mock",
            "exam_mode": "timed",
            "total_questions": 60,
            "passing_percentage": 70,
            "time_allowed_minutes": 90,
        },
    )
    assert start_res.status_code == 400
    assert "no questions yet" in start_res.json()["detail"].lower()

    # Ensure no session was created in DB
    after_count = db.query(ExamSession).filter(ExamSession.subject_id == kafka.id).count()
    assert after_count == before_count


def test_4_kafka_drill_creation_refuses_with_400(db):
    """Test 4: Kafka drill creation (POST /api/v1/exams) fails with 400, no PSM I questions assembled."""
    kafka = _get_or_create_kafka(db)
    before_count = db.query(ExamSession).filter(ExamSession.subject_id == kafka.id).count()

    res = client.post(
        "/api/v1/exams",
        json={
            "title": "Kafka Drill Session",
            "subject_id": kafka.id,
            "session_kind": "drill",
            "exam_mode": "practice",
            "total_questions": 10,
            "passing_percentage": 70,
        },
    )
    assert res.status_code == 400
    assert "no questions yet" in res.json()["detail"].lower()

    after_count = db.query(ExamSession).filter(ExamSession.subject_id == kafka.id).count()
    assert after_count == before_count


def test_5_review_queue_and_check_question_subject_isolation(db):
    """Test 5: Review queue for Kafka returns 0 items; does not leak PSM I review items, and check questions are isolated."""
    kafka = _get_or_create_kafka(db)

    # Review queue for Kafka returns 0 items
    res = client.get(f"/api/v1/review/queue?subject_id={kafka.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["items"] == []
    assert data["remaining"] == 0
    assert data["total_unreviewed"] == 0

    # Also verify ReviewService.pick_check_question strictly respects subject_id
    service = ReviewService(db)

    tag = uuid.uuid4().hex[:8]
    sub_a = Subject(
        name=f"Sub A {tag}",
        slug=f"sub-a-{tag}",
        kind=SubjectKind.CERTIFICATION,
        pass_mark=85.0,
    )
    sub_b = Subject(
        name=f"Sub B {tag}",
        slug=f"sub-b-{tag}",
        kind=SubjectKind.CERTIFICATION,
        pass_mark=85.0,
    )
    db.add_all([sub_a, sub_b])
    db.commit()

    try:
        # Create dummy question 1 in Subject A
        q_a = Question(
            text=f"Subject A Missed Question {tag}",
            subject_id=sub_a.id,
            domain="Shared Domain",
            topic="Shared Topic",
            question_type=QuestionType.SINGLE_CHOICE,
            options=[QuestionOption(option_text="Opt A", is_correct=True, order_index=1)],
        )
        # Create candidate in Subject B sharing the exact same domain & topic
        q_b = Question(
            text=f"Subject B Candidate Question {tag}",
            subject_id=sub_b.id,
            domain="Shared Domain",
            topic="Shared Topic",
            question_type=QuestionType.SINGLE_CHOICE,
            options=[QuestionOption(option_text="Opt B", is_correct=True, order_index=1)],
        )
        db.add_all([q_a, q_b])
        db.commit()

        session_a = ExamSession(
            title=f"Session A {tag}",
            subject_id=sub_a.id,
            total_questions=1,
            passing_percentage=85,
            status=ExamStatus.COMPLETED,
            source="learner",
        )
        db.add(session_a)
        db.commit()

        answer_a = ExamAnswer(
            session_id=session_a.id,
            question_id=q_a.id,
            is_correct=False,
        )
        db.add(answer_a)
        db.commit()

        check_q = service.pick_check_question(answer_a)
        # Because only q_b exists in that domain/topic, but belongs to Subject B != Subject A,
        # pick_check_question MUST NOT pick q_b! It must return None.
        assert check_q is None, "Check question must not leak across subject boundaries!"
    finally:
        db.rollback()
        db.query(ExamAnswer).filter(ExamAnswer.session_id == session_a.id).delete()
        db.query(ExamSession).filter(ExamSession.id == session_a.id).delete()
        db.query(QuestionOption).filter(QuestionOption.question_id.in_([q_a.id, q_b.id])).delete()
        db.query(Question).filter(Question.id.in_([q_a.id, q_b.id])).delete()
        db.delete(sub_a)
        db.delete(sub_b)
        db.commit()


def test_6_positive_control_psm_question_retrieval_and_mock(db):
    """Test 6: Positive control: PSM I question retrieval and mock creation work normally."""
    psm = _get_or_create_psm(db)

    # Seed 5 questions for PSM I
    created_questions = []
    for i in range(5):
        q = Question(
            text=f"PSM I Question {i} {uuid.uuid4().hex[:6]}",
            certification=psm.certification,
            subject_id=psm.id,
            domain="Scrum Framework",
            topic="Scrum Guide",
            question_type=QuestionType.SINGLE_CHOICE,
            difficulty="medium",
            options=[
                QuestionOption(option_text="Correct", is_correct=True, order_index=1),
                QuestionOption(option_text="Wrong", is_correct=False, order_index=2),
            ],
        )
        db.add(q)
        created_questions.append(q)
    db.commit()

    try:
        # Question retrieval for PSM I returns questions
        res = client.get(f"/api/v1/questions?subject_id={psm.id}&limit=5")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] >= 5
        assert len(data["items"]) >= 5
        for item in data["items"]:
            assert item["subject_id"] == psm.id

        # Drill for PSM I succeeds
        start_res = client.post(
            "/api/v1/exams",
            json={
                "title": "PSM I Drill",
                "subject_id": psm.id,
                "session_kind": "drill",
                "exam_mode": "practice",
                "total_questions": 3,
                "passing_percentage": 85,
            },
        )
        assert start_res.status_code == 201
        session_data = start_res.json()
        assert session_data["subject_id"] == psm.id
        assert session_data["total_questions"] == 3
    finally:
        for q in created_questions:
            db.delete(q)
        db.commit()


def test_7_direct_api_protection_by_certification_string(db):
    """Test 7: Direct API protection: direct requests with subject_id=kafka.id or Kafka certification string return 0 questions / 400."""
    kafka = _get_or_create_kafka(db)
    cert_string = kafka.certification

    # Direct exam creation using certification string alone (without subject_id)
    # must resolve Kafka, see that it has 0 questions, and reject with 400 rather than
    # matching other questions on tokens like 'Developer' or 'Certified'.
    res = client.post(
        "/api/v1/exams",
        json={
            "title": "Direct Cert Session",
            "certification": cert_string,
            "session_kind": "drill",
            "exam_mode": "practice",
            "total_questions": 10,
            "passing_percentage": 70,
        },
    )
    assert res.status_code == 400
    assert "no questions yet" in res.json()["detail"].lower()
