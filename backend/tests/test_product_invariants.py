# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The rules that make PrepBench's numbers worth reading.

Every test here protects a product promise rather than an implementation
detail. If one of these fails, a learner is being told something untrue --
which is a different class of problem from a refactor that moved a function.

The list is deliberately short. These are the invariants that, if broken,
make the product worse than not having it:

  1.  Exam scope never silently broadens.
  2.  A mock is the full paper, or it is not a mock.
  3.  A mock is identifiable wherever a session is shown.
  4.  Evidence that is not the learner's cannot reach a learner-facing number.
  5.  No score is fabricated where there is no evidence.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.exam_session import ExamSession
from app.models.subject import Subject, SubjectKind
from app.repositories.subject_repository import LEARNER, TEST

client = TestClient(app)


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _cert() -> str:
    """One unbroken token, so another test's certification cannot match it
    through a shared word -- create_exam splits on punctuation and ILIKEs
    every piece."""
    return "Inv" + uuid.uuid4().hex[:10]


def _subject(db, cert, question_count=3) -> Subject:
    tag = uuid.uuid4().hex[:8]
    subject = Subject(
        name="Invariant Subject " + tag,
        slug="inv-" + tag,
        kind=SubjectKind.CERTIFICATION,
        certification=cert,
        pass_mark=85.0,
        exam_question_count=question_count,
        exam_minutes=60,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def _make_questions(cert, n=3, topic="Invariant Topic", difficulty="medium"):
    for i in range(n):
        response = client.post("/api/v1/questions", json={
            "text": f"Invariant question {i} {uuid.uuid4().hex[:8]}",
            "question_type": "single_choice",
            "difficulty": difficulty,
            "domain": "Invariant Domain",
            "topic": topic,
            "certification": cert,
            "explanation": "Seeded by the product-invariant suite.",
            "options": [
                {"option_text": "Right", "is_correct": True, "order_index": 0},
                {"option_text": "Wrong", "is_correct": False, "order_index": 1},
            ],
        })
        assert response.status_code == 201, response.text


# ---- 1. Exam scope never silently broadens ----------------------------


def test_a_filter_that_matches_nothing_fails_instead_of_widening():
    """The defect this suite exists for.

    create_exam used to fall back to the entire question bank whenever the
    selection matched nothing. The learner asked for one topic and sat an
    exam drawn from everything, with no indication anywhere that it had
    happened -- so the score, the domain breakdown and the weak-topic list
    all described an exam nobody chose to sit.
    """
    cert = _cert()
    _make_questions(cert, n=3)

    response = client.post("/api/v1/exams", json={
        "certification": cert,
        "topics": ["A Topic That Does Not Exist"],
        "total_questions": 3,
    })

    assert response.status_code == 400, response.text
    # The message names the selection, so the learner can see which part was
    # too narrow without opening a network tab.
    assert "A Topic That Does Not Exist" in response.json()["detail"]


def test_weak_topic_focus_with_no_weak_topics_fails_instead_of_widening(db, monkeypatch):
    """A mode defined entirely by its restriction cannot drop the restriction.

    An empty weak-topic list used to leave the filter unset, which turned
    "practise my weakest topics" into a random exam over the whole bank.

    The weak-topic list is global across the question bank, so it is stubbed
    rather than arranged: the invariant is about what happens when the list
    is empty, and that must not depend on which other tests ran first.
    """
    from app.repositories.analytics_repository import AnalyticsRepository
    from app.services.exam_engine import ExamEngine
    from app.schemas.exam import ExamCreateRequest
    from app.core.exceptions import InvalidExamStateException

    monkeypatch.setattr(AnalyticsRepository, "get_weak_topic_names", lambda self, **kw: [])

    cert = _cert()
    _make_questions(cert, n=3)

    with pytest.raises(InvalidExamStateException) as raised:
        ExamEngine(db).create_exam(ExamCreateRequest(
            exam_mode="weak_topic", certification=cert, total_questions=3,
        ))

    assert "weak topic" in str(raised.value.detail).lower()


def test_review_focus_with_nothing_due_fails_instead_of_widening(db, monkeypatch):
    """The same rule for the other restriction-defined mode."""
    from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository
    from app.services.exam_engine import ExamEngine
    from app.schemas.exam import ExamCreateRequest
    from app.core.exceptions import InvalidExamStateException

    monkeypatch.setattr(SpacedRepetitionRepository, "due_question_ids", lambda self, *a, **kw: [])

    cert = _cert()
    _make_questions(cert, n=3)

    with pytest.raises(InvalidExamStateException) as raised:
        ExamEngine(db).create_exam(ExamCreateRequest(
            exam_mode="spaced_repetition", certification=cert, total_questions=3,
        ))

    assert "due for review" in str(raised.value.detail).lower()


def test_a_matching_filter_still_produces_an_exam():
    """The guard must not have made narrow selections unusable."""
    cert = _cert()
    _make_questions(cert, n=3, topic="A Real Topic")

    response = client.post("/api/v1/exams", json={
        "certification": cert,
        "topics": ["A Real Topic"],
        "total_questions": 3,
    })

    assert response.status_code == 201, response.text
    assert response.json()["total_questions"] == 3


# ---- 2. A mock is the full paper, or it is not a mock ------------------


def test_a_short_session_cannot_be_recorded_as_a_mock(db):
    """A drill wearing a measurement's label is worse than a drill.

    Without this, a five-question warm-up marked session_kind=mock would be
    averaged into readiness with the same weight as a full sitting.
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=10)
    _make_questions(cert, n=3)

    response = client.post("/api/v1/exams", json={
        "certification": cert,
        "subject_id": subject.id,
        "session_kind": "mock",
        "total_questions": 3,
    })

    assert response.status_code == 400, response.text
    assert "10 questions" in response.json()["detail"]


def test_a_mock_without_an_exam_profile_is_refused(db):
    """A skill subject has no pass mark, so there is nothing to be ready
    against and nothing a mock could measure."""
    tag = uuid.uuid4().hex[:8]
    skill = Subject(name="Skill " + tag, slug="skill-" + tag, kind=SubjectKind.SKILL)
    db.add(skill)
    db.commit()
    db.refresh(skill)

    cert = _cert()
    _make_questions(cert, n=3)

    response = client.post("/api/v1/exams", json={
        "certification": cert,
        "subject_id": skill.id,
        "session_kind": "mock",
        "total_questions": 3,
    })

    assert response.status_code == 400, response.text
    assert "exam profile" in response.json()["detail"]


def test_a_full_length_mock_is_accepted(db):
    cert = _cert()
    subject = _subject(db, cert, question_count=3)
    _make_questions(cert, n=3)

    response = client.post("/api/v1/exams", json={
        "subject_id": subject.id,
        "session_kind": "mock",
        "total_questions": 3,
    })

    assert response.status_code == 201, response.text


def test_a_mock_takes_its_scope_from_the_subject_alone(db):
    """The client sends a subject; the server resolves what that means.

    A client restating a certification string it had to look up is a client
    that can file a session under a subject whose questions it was not drawn
    from.
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=3)
    _make_questions(cert, n=3)
    _make_questions(_cert(), n=5)  # a different subject's questions

    created = client.post("/api/v1/exams", json={
        "subject_id": subject.id,
        "session_kind": "mock",
        "total_questions": 3,
    })
    assert created.status_code == 201, created.text

    detail = client.get("/api/v1/exams/{}".format(created.json()["id"]))
    certifications = {q["certification"] for q in detail.json()["questions"]}
    assert certifications == {cert}


# ---- 3. A mock is identifiable wherever a session is shown -------------


def test_the_api_says_whether_a_session_counted(db):
    """A score the learner cannot interpret is not much better than no score.

    ExamSessionResponse omitted session_kind entirely, so the UI could show
    you 92% without being able to say whether it moved anything.
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=3)
    _make_questions(cert, n=3)

    created = client.post("/api/v1/exams", json={
        "subject_id": subject.id,
        "session_kind": "mock",
        "total_questions": 3,
    })

    body = created.json()
    assert body["session_kind"] == "mock"
    assert body["subject_id"] == subject.id


def test_a_client_cannot_declare_its_own_provenance(db):
    """`source` is response-only. Everything the app records is the
    learner's, and no request can say otherwise."""
    cert = _cert()
    _make_questions(cert, n=3)

    created = client.post("/api/v1/exams", json={
        "certification": cert,
        "total_questions": 3,
        "source": "test",
    })
    assert created.status_code == 201, created.text

    session = db.query(ExamSession).filter(ExamSession.id == created.json()["id"]).one()
    assert session.source == LEARNER


# ---- 4. Non-learner evidence cannot reach a learner-facing number ------


def test_quarantined_evidence_does_not_reach_readiness(db):
    """The gap rule 6 was written about, from the other direction.

    Three sessions named "Repro", "Randomize Options Regression Test" and
    "Skipped Answer Regression Test" sat in the working database and were
    averaged into every headline number. Nothing could say "that was not me
    studying".
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=3)
    _make_questions(cert, n=3)

    created = client.post("/api/v1/exams", json={
        "subject_id": subject.id,
        "session_kind": "mock",
        "total_questions": 3,
    })
    session_id = created.json()["id"]

    detail = client.get(f"/api/v1/exams/{session_id}").json()
    for question in detail["questions"]:
        right = [o["id"] for o in question["options"] if o["is_correct"]] \
            or [question["options"][0]["id"]]
        client.post(f"/api/v1/exams/{session_id}/answer",
                    json={"question_id": question["id"], "selected_option_ids": right})
    client.post(f"/api/v1/exams/{session_id}/finish")

    before = client.get(f"/api/v1/subjects/{subject.id}").json()["readiness"]
    assert before["mock_count"] == 1, "the mock must count while it is the learner's"

    session = db.query(ExamSession).filter(ExamSession.id == session_id).one()
    session.source = TEST
    db.commit()

    after = client.get(f"/api/v1/subjects/{subject.id}").json()["readiness"]
    assert after["mock_count"] == 0
    assert after["state"] == "needs_evaluation"


def test_quarantined_evidence_does_not_reach_the_activity_timeline(db):
    """Review is where a learner looks to see what they have done. A
    regression test appearing there is the same lie in a different place."""
    cert = _cert()
    _make_questions(cert, n=2)

    created = client.post("/api/v1/exams", json={
        "title": "Quarantine me",
        "certification": cert,
        "total_questions": 2,
    })
    session_id = created.json()["id"]
    client.post(f"/api/v1/exams/{session_id}/finish")

    titles = {item["title"] for item in client.get("/api/v1/home/activity?limit=200").json()}
    assert "Quarantine me" in titles

    session = db.query(ExamSession).filter(ExamSession.id == session_id).one()
    session.source = TEST
    db.commit()

    titles = {item["title"] for item in client.get("/api/v1/home/activity?limit=200").json()}
    assert "Quarantine me" not in titles


# ---- 5. No fabricated score -------------------------------------------


def test_a_subject_with_no_mocks_reports_needs_evaluation_not_zero(db):
    """Zero mocks is an absent measurement, never a failing one."""
    subject = _subject(db, _cert(), question_count=3)

    readiness = client.get(f"/api/v1/subjects/{subject.id}").json()["readiness"]

    assert readiness["state"] == "needs_evaluation"
    assert readiness["mock_count"] == 0
    assert readiness["points_per_mock"] is None
    assert readiness["mocks_to_pass_estimate"] is None


# ---- 6. A count the learner can move ----------------------------------


def test_reviewing_a_wrong_answer_lowers_the_unreviewed_count(db):
    """The count on Home has to be able to go down.

    The endpoint, the column and the count all existed, and nothing in the
    browser ever called the endpoint -- so "90 unreviewed answers" could only
    ever rise. A number the learner cannot move is the guilt mechanic this
    product refuses everywhere else; it arrived by omission rather than by
    design, which is why nothing caught it.
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=3)
    _make_questions(cert, n=3)

    created = client.post("/api/v1/exams", json={
        "subject_id": subject.id, "session_kind": "mock", "total_questions": 3,
    })
    session_id = created.json()["id"]

    detail = client.get(f"/api/v1/exams/{session_id}").json()
    for question in detail["questions"]:
        wrong = [o["id"] for o in question["options"] if not o["is_correct"]]
        client.post(f"/api/v1/exams/{session_id}/answer",
                    json={"question_id": question["id"], "selected_option_ids": wrong[:1]})
    client.post(f"/api/v1/exams/{session_id}/finish")

    before = client.get("/api/v1/home").json()["unreviewed_total"]
    assert before >= 3

    unreviewed = client.get(f"/api/v1/exams/{session_id}/unreviewed").json()
    assert unreviewed["count"] == 3

    client.post(f"/api/v1/exams/{session_id}/answers/{unreviewed['question_ids'][0]}/reviewed")

    assert client.get("/api/v1/home").json()["unreviewed_total"] == before - 1


def test_the_client_can_see_which_answers_were_reviewed(db):
    """Without reviewed_at on the response the UI can only write the flag,
    never read it -- so it cannot show what has been covered, and would
    re-post on every visit."""
    cert = _cert()
    _make_questions(cert, n=2)

    created = client.post("/api/v1/exams", json={"certification": cert, "total_questions": 2})
    session_id = created.json()["id"]
    detail = client.get(f"/api/v1/exams/{session_id}").json()
    question = detail["questions"][0]
    wrong = [o["id"] for o in question["options"] if not o["is_correct"]]
    client.post(f"/api/v1/exams/{session_id}/answer",
                json={"question_id": question["id"], "selected_option_ids": wrong[:1]})

    body = client.get(f"/api/v1/exams/{session_id}").json()
    answer = next(a for a in body["answers"] if a["question_id"] == question["id"])
    assert answer["reviewed_at"] is None

    client.post(f"/api/v1/exams/{session_id}/answers/{question['id']}/reviewed")

    body = client.get(f"/api/v1/exams/{session_id}").json()
    answer = next(a for a in body["answers"] if a["question_id"] == question["id"])
    assert answer["reviewed_at"] is not None
