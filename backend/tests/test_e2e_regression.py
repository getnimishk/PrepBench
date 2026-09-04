# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
End-to-end regression: the journeys a candidate actually takes, driven only
through the HTTP API.

The per-feature suites are thorough about rules. test_readiness.py proves the
readiness rule against pure data, test_subjects.py proves the repository can
only ever hand it full mocks, test_home.py proves an unreviewed answer stays
unreviewed until someone looks at it. What none of them do is drive the app
the way a person does: every one of them reaches past the API and builds its
rows with a database session.

That gap is not academic. A rule can be perfectly correct and still be
unreachable, because nothing in the app is able to produce the input it
reads. These tests exist to catch that class of defect -- the seam between a
feature and the endpoint that is supposed to feed it -- which is invisible to
a suite that constructs its own fixtures on the far side of the seam.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession
from app.models.subject import Subject, SubjectKind

client = TestClient(app)

REVIEWS = "/api/v1/design-reviews"

# Marks the correct option so a test can answer deliberately right or wrong
# without trusting the exam payload to tell it which is which -- if the runner
# ever did start leaking is_correct, a test that relied on it would keep
# passing and hide the leak.
CORRECT = "CORRECT"


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="module", autouse=True)
def seeded():
    """The lifespan handler does not run for a TestClient used outside a
    context manager, so the built-in design reviews have to be seeded here."""
    from tests.conftest import TestingSessionLocal
    from app.utils.seed_design_reviews import seed_design_reviews

    db = TestingSessionLocal()
    try:
        seed_design_reviews(db)
    finally:
        db.close()


def _cert() -> str:
    """A certification token with no separator in it.

    ExamEngine.create_exam splits the certification on punctuation and builds
    an ILIKE for every token, so a value like "E2E-abc123" would also match
    another test's "E2E-def456" through the shared "E2E" token and pull its
    questions into this exam. One unbroken token cannot collide.
    """
    return "E2EReg" + uuid.uuid4().hex[:10]


def _subject(db, cert=None, kind=SubjectKind.CERTIFICATION) -> Subject:
    tag = uuid.uuid4().hex[:8]
    is_cert = kind is SubjectKind.CERTIFICATION
    subject = Subject(
        name="E2E Subject " + tag,
        slug="e2e-" + tag,
        kind=kind,
        certification=cert,
        pass_mark=85.0 if is_cert else None,
        exam_question_count=80 if is_cert else None,
        exam_minutes=60 if is_cert else None,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def _make_questions(cert, n=4, domain="E2E Domain"):
    """Create questions through the API, so the exam under test is drawn from
    content that arrived the way a user's own content arrives."""
    ids = []
    for i in range(n):
        payload = {
            "text": "E2E regression question {} {}".format(i, uuid.uuid4().hex[:8]),
            "question_type": "single_choice",
            "difficulty": "medium",
            "domain": domain,
            "topic": "E2E Topic",
            "certification": cert,
            "explanation": "Created by the end-to-end regression suite.",
            "options": [
                {"option_text": CORRECT + " answer {}".format(i), "is_correct": True, "order_index": 0},
                {"option_text": "Wrong answer {} a".format(i), "is_correct": False, "order_index": 1},
                {"option_text": "Wrong answer {} b".format(i), "is_correct": False, "order_index": 2},
            ],
        }
        response = client.post("/api/v1/questions", json=payload)
        assert response.status_code == 201, response.text
        ids.append(response.json()["id"])
    return ids


def _run_exam(cert, count=4, answer_correctly=True, **overrides):
    """Start, answer and finish one exam entirely over HTTP."""
    body = {
        "title": "E2E regression run",
        "certification": cert,
        "total_questions": count,
        "randomize_questions": False,
        "randomize_options": False,
    }
    body.update(overrides)

    created = client.post("/api/v1/exams", json=body)
    assert created.status_code == 201, created.text
    session_id = created.json()["id"]

    detail = client.get("/api/v1/exams/{}".format(session_id))
    assert detail.status_code == 200, detail.text

    for question in detail.json()["questions"]:
        right = [o["id"] for o in question["options"] if o["option_text"].startswith(CORRECT)]
        wrong = [o["id"] for o in question["options"] if not o["option_text"].startswith(CORRECT)]
        assert right, "every question this suite seeds has one marked-correct option"
        chosen = right if answer_correctly else wrong[:1]
        answered = client.post(
            "/api/v1/exams/{}/answer".format(session_id),
            json={"question_id": question["id"], "selected_option_ids": chosen},
        )
        assert answered.status_code == 200, answered.text

    finished = client.post("/api/v1/exams/{}/finish".format(session_id))
    assert finished.status_code == 200, finished.text
    return finished.json()


def _readiness(subject_id):
    response = client.get("/api/v1/subjects/{}".format(subject_id))
    assert response.status_code == 200, response.text
    return response.json()["readiness"]


def _home():
    response = client.get("/api/v1/home")
    assert response.status_code == 200, response.text
    return response.json()


# ---- the exam journey, over HTTP only ---------------------------------


def test_a_full_exam_run_through_the_api_scores_correctly():
    """The baseline the rest of this file stands on: start, answer, finish."""
    cert = _cert()
    _make_questions(cert, n=4)

    result = _run_exam(cert, count=4, answer_correctly=True)

    assert result["status"] == "completed"
    assert result["answered_questions"] == 4
    assert result["correct_count"] == 4
    assert result["score_percentage"] == 100.0


def test_answering_wrongly_is_scored_as_wrong():
    cert = _cert()
    _make_questions(cert, n=4)

    result = _run_exam(cert, count=4, answer_correctly=False)

    assert result["correct_count"] == 0
    assert result["score_percentage"] == 0.0


def test_every_session_the_api_creates_is_a_drill(db):
    """Current behaviour, pinned deliberately.

    The model defaults session_kind to "drill" so that data recorded before
    the column existed cannot inflate a readiness signal. Nothing in the
    creation path ever overrides that default, which makes the default also
    the only value the running app can produce.
    """
    cert = _cert()
    _make_questions(cert, n=3)

    result = _run_exam(cert, count=3)

    session = db.query(ExamSession).filter(ExamSession.id == result["id"]).one()
    assert session.session_kind == "drill"
    assert session.subject_id is None


def test_the_api_can_record_a_mock(db):
    cert = _cert()
    _make_questions(cert, n=3)

    result = _run_exam(cert, count=3, session_kind="mock")

    session = db.query(ExamSession).filter(ExamSession.id == result["id"]).one()
    assert session.session_kind == "mock"


def test_the_api_can_bind_a_session_to_a_subject(db):
    cert = _cert()
    subject = _subject(db, cert=cert)
    _make_questions(cert, n=3)

    result = _run_exam(cert, count=3, subject_id=subject.id)

    session = db.query(ExamSession).filter(ExamSession.id == result["id"]).one()
    assert session.subject_id == subject.id


# ---- the loop, end to end, through the API alone -----------------------
#
# These were written while the seam was open, and asserted the broken
# behaviour on purpose so that closing it would break them loudly. It did.
# They now assert the behaviour the product promises.


def test_a_drill_through_the_api_still_does_not_move_readiness(db):
    """The rule that makes the readiness number worth anything: a drill is
    untimed, unpressured and often easier, so scoring well on one says
    nothing about whether you would pass."""
    cert = _cert()
    subject = _subject(db, cert=cert)
    _make_questions(cert, n=4)

    assert _readiness(subject.id)["state"] == "needs_evaluation"

    _run_exam(cert, count=4, answer_correctly=True)   # drill by default

    after = _readiness(subject.id)
    assert after["state"] == "needs_evaluation"
    assert after["mock_count"] == 0
    assert after["recent_scores"] == []


def test_a_mock_through_the_api_moves_readiness(db):
    """The seam that was missing. A mock taken through the app -- not built
    from a database session -- must reach the readiness rule."""
    cert = _cert()
    subject = _subject(db, cert=cert)
    _make_questions(cert, n=4)

    _run_exam(cert, count=4, answer_correctly=True, session_kind="mock", subject_id=subject.id)

    after = _readiness(subject.id)
    assert after["mock_count"] == 1
    assert after["state"] != "needs_evaluation"
    assert after["recent_scores"] == [100.0]


def test_a_wrong_answer_in_a_mock_reaches_the_home_review_queue(db):
    """exam_answers.reviewed_at records whether a wrong answer was actually
    looked at, and Home counts the ones that were not. A mock the app itself
    created has to land there."""
    before = _home()["unreviewed_total"]

    cert = _cert()
    subject = _subject(db, cert=cert)
    _make_questions(cert, n=4)
    _run_exam(cert, count=4, answer_correctly=False, session_kind="mock", subject_id=subject.id)

    assert _home()["unreviewed_total"] == before + 4


def test_readiness_and_the_review_queue_agree_with_stored_mocks(db):
    """The same surfaces, fed directly rather than through the API, so a
    failure here separates a broken rule from a broken endpoint."""
    from tests.test_home import _completed_mock

    cert = _cert()
    subject = _subject(db, cert=cert)

    home_before = _home()["unreviewed_total"]
    _completed_mock(db, score=88.0, wrong=2, cert=cert, kind="mock")

    readiness = _readiness(subject.id)
    assert readiness["state"] != "needs_evaluation"
    assert readiness["mock_count"] == 1
    assert readiness["recent_scores"] == [88.0]

    assert _home()["unreviewed_total"] == home_before + 2


def test_marking_an_answer_reviewed_clears_it_from_home(db):
    """The full review loop over HTTP, on data the app cannot yet create."""
    from tests.test_home import _completed_mock

    cert = _cert()
    _subject(db, cert=cert)

    before = _home()["unreviewed_total"]
    session = _completed_mock(db, score=40.0, wrong=3, cert=cert, kind="mock")
    assert _home()["unreviewed_total"] == before + 3

    unreviewed = client.get("/api/v1/exams/{}/unreviewed".format(session.id))
    assert unreviewed.status_code == 200, unreviewed.text

    answer = db.query(ExamAnswer).filter(ExamAnswer.session_id == session.id).first()
    marked = client.post(
        "/api/v1/exams/{}/answers/{}/reviewed".format(session.id, answer.question_id)
    )
    assert marked.status_code == 200, marked.text

    assert _home()["unreviewed_total"] == before + 2


# ---- the design review journey ----------------------------------------


def test_the_deciding_axis_is_withheld_until_the_learner_commits():
    """List and detail are both served to someone who has not answered, so
    neither may carry the axis the decision turns on. Committing is what
    unlocks it."""
    listing = client.get(REVIEWS + "?limit=500")
    assert listing.status_code == 200, listing.text
    items = listing.json()["items"]
    assert items, "the built-in design reviews should be seeded"

    for item in items:
        assert "deciding_axis" not in item
        assert "reveal" not in item
        assert "elicit_answer" not in item

    review_id = items[0]["id"]
    detail = client.get("{}/{}".format(REVIEWS, review_id))
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert "deciding_axis" not in body
    assert "reveal" not in body
    assert "elicit_answer" not in body
    assert len(body["options"]) == 2

    submitted = client.post(
        REVIEWS + "/attempts",
        json={
            "review_id": review_id,
            "choice": "A",
            "justification": "Option A keeps the write path simple and the cost predictable.",
        },
    )
    assert submitted.status_code == 201, submitted.text
    reveal = submitted.json()["reveal"]
    assert reveal is not None
    assert reveal["deciding_axis"]
    assert reveal["reveal"]


def test_committing_marks_the_review_attempted_and_moves_analytics():
    """One action has to show up on three surfaces: the attempt itself, the
    list the learner picks from, and the analytics panel."""
    before = client.get(REVIEWS + "/analytics").json()
    review_id = client.get(REVIEWS + "?limit=500").json()["items"][-1]["id"]

    submitted = client.post(
        REVIEWS + "/attempts",
        json={
            "review_id": review_id,
            "choice": "ask_first",
            "justification": "What is the acceptable staleness on the served table?",
        },
    )
    assert submitted.status_code == 201, submitted.text
    attempt_id = submitted.json()["id"]

    fetched = client.get("{}/attempts/{}".format(REVIEWS, attempt_id))
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["choice"] == "ask_first"

    latest = client.get("{}/{}/latest-attempt".format(REVIEWS, review_id))
    assert latest.status_code == 200, latest.text
    assert latest.json()["id"] == attempt_id

    listed = client.get(REVIEWS + "?limit=500").json()["items"]
    assert next(r for r in listed if r["id"] == review_id)["attempted"] is True

    after = client.get(REVIEWS + "/analytics").json()
    assert after["total_attempts"] == before["total_attempts"] + 1


# ---- across formats, and what is never fabricated ---------------------


def test_an_exam_and_a_design_review_share_one_activity_timeline():
    """Review merged two history pages and an exam-only analytics page into
    one timeline. Both formats have to actually land on it."""
    cert = _cert()
    _make_questions(cert, n=3)
    _run_exam(cert, count=3)

    review_id = client.get(REVIEWS + "?limit=500").json()["items"][0]["id"]
    client.post(
        REVIEWS + "/attempts",
        json={
            "review_id": review_id,
            "choice": "B",
            "justification": "Option B isolates the failure domain at an acceptable cost.",
        },
    )

    activity = client.get("/api/v1/home/activity?limit=200")
    assert activity.status_code == 200, activity.text
    kinds = {item["kind"] for item in activity.json()}
    assert len(kinds) >= 2, "expected more than one format on the timeline, saw {}".format(kinds)


def test_home_ranks_nothing_even_with_a_busy_database(db):
    """A ranked "do this next" list was put to the user and rejected as
    nagging. The empty-database case is covered in test_home.py; this is the
    populated one, where adding a suggestion would actually be tempting."""
    from tests.test_home import _completed_mock

    cert = _cert()
    _subject(db, cert=cert)
    _make_questions(cert, n=3)
    _run_exam(cert, count=3, answer_correctly=False)
    _completed_mock(db, score=52.0, wrong=4, cert=cert, kind="mock")

    body = _home()
    for banned in ("suggested", "next_actions", "recommendations", "next_best_action", "todo"):
        assert banned not in body

    assert set(body) == {"resumable", "unreviewed_total", "due_for_review", "per_subject"}


def test_a_fresh_subject_reports_no_score_rather_than_zero(db):
    """Zero mocks is "needs evaluation", never zero per cent. A fabricated 0%
    would read as a measurement, and it is the absence of one."""
    subject = _subject(db, cert=_cert())

    readiness = _readiness(subject.id)

    assert readiness["state"] == "needs_evaluation"
    assert readiness["mock_count"] == 0
    assert readiness["recent_scores"] == []
    assert readiness["points_per_mock"] is None
    assert readiness["mocks_to_pass_estimate"] is None
    assert readiness["latest_taken_at"] is None


def test_a_skill_subject_is_never_ready_and_never_offered_a_mock(db):
    """A skill subject carries no pass mark, so there is nothing to be ready
    against, and inventing a bar would be the dishonesty the feature exists to
    avoid."""
    subject = _subject(db, cert=None, kind=SubjectKind.SKILL)

    readiness = _readiness(subject.id)
    assert readiness["state"] == "needs_evaluation"
    assert readiness["pass_mark"] is None

    coverage = client.get("/api/v1/home/subjects/{}/coverage".format(subject.id))
    assert coverage.status_code == 200, coverage.text
    mock_rows = [row for row in coverage.json() if row["key"] == "mock"]
    assert all(row["available"] is False for row in mock_rows)
