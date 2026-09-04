# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_start_and_finish_exam():
    # 0. One question, under a certification nothing else uses.
    #
    # The certification is what makes this test deterministic. It previously
    # created a question and then started an exam across the WHOLE question
    # bank -- "question_count" is not a field on the request, so the exam
    # silently drew the default 25 questions at random from every question any
    # other test had ever created. It then asserted that questions[0] had
    # options, which was true only by luck. CI drew a different sample and the
    # test failed with an IndexError on an empty options list.
    #
    # Scoping the exam to this question's own certification means the sample is
    # exactly the row created here, so the assertions below describe this test's
    # data rather than whatever happened to be in the bank.
    certification = f"ExamEngineCert-{uuid.uuid4().hex[:12]}"
    q_payload = {
        "text": f"Exam Engine Test Question-{uuid.uuid4().hex}",
        "question_type": "single_choice",
        "certification": certification,
        "options": [
            {"option_text": "Option A", "is_correct": True, "order_index": 0},
            {"option_text": "Option B", "is_correct": False, "order_index": 1}
        ]
    }
    created = client.post("/api/v1/questions", json=q_payload)
    assert created.status_code == 201, created.text

    # 1. Start exam
    start_payload = {
        "title": "Unit Test Exam Session",
        "exam_mode": "practice",
        "certification": certification,
        "total_questions": 1,
    }
    res = client.post("/api/v1/exams", json=start_payload)
    assert res.status_code == 201
    session_data = res.json()
    session_id = session_data["id"]
    assert session_data["status"] == "in_progress"
    assert session_data["total_questions"] > 0

    # 2. Get details
    details_res = client.get(f"/api/v1/exams/{session_id}")
    assert details_res.status_code == 200
    questions = details_res.json()["questions"]
    assert len(questions) > 0

    q1 = questions[0]
    opt1_id = q1["options"][0]["id"]

    # 3. Save answer
    answer_payload = {
        "question_id": q1["id"],
        "selected_option_ids": [opt1_id],
        "time_spent_seconds": 15,
        "confidence_level": "high"
    }
    ans_res = client.post(f"/api/v1/exams/{session_id}/answer", json=answer_payload)
    assert ans_res.status_code == 200

    # 4. Finish exam
    finish_res = client.post(f"/api/v1/exams/{session_id}/finish")
    assert finish_res.status_code == 200
    finished_data = finish_res.json()
    assert finished_data["status"] == "completed"
    assert finished_data["score_percentage"] is not None


def _create_question_with_options(n_options=4, certification=None):
    """Creates an isolated question under a unique certification value so it can
    be deterministically selected into a single-question exam via the
    certification filter, regardless of what else has accumulated in the
    shared test database from other tests.

    The certification value must be a single opaque token with no delimiters
    (no hyphens/spaces/colons): create_exam's certification filter tokenizes
    on those characters (e.g. "UnitTestCert-abc123" -> tokens "UnitTestCert",
    "abc123") and does an ilike match per token, so a shared prefix across
    tests would match every other test's questions too, not just this one.
    """
    cert = certification or uuid.uuid4().hex
    payload = {
        "text": f"Option-count regression question-{uuid.uuid4().hex}",
        "question_type": "multiple_choice" if n_options > 2 else "single_choice",
        "certification": cert,
        "options": [
            {"option_text": f"Option {i}", "is_correct": i == 0, "order_index": i}
            for i in range(n_options)
        ],
    }
    res = client.post("/api/v1/questions", json=payload)
    assert res.status_code == 201, res.text
    return res.json(), cert


def test_randomize_options_does_not_delete_options():
    """
    Regression test: random.shuffle(q.options) used to run directly on the
    SQLAlchemy relationship collection inside create_exam(). Question.options
    has cascade="all, delete-orphan", and shuffle's in-place __setitem__ swaps
    are instrumented calls SQLAlchemy can interpret as items being removed
    from the collection -- silently deleting those options from the database
    on the next commit. This was the actual root cause of options
    intermittently vanishing from questions across the app's lifetime
    (confirmed by direct reproduction: a 4-option question dropped to 3 after
    exactly this shuffle+commit sequence). Fixed by not mutating the ORM
    collection at all -- this test guards against it coming back.
    """
    question, cert = _create_question_with_options(n_options=4)
    question_id = question["id"]
    assert len(question["options"]) == 4

    start_payload = {
        "title": "Randomize Options Regression Test",
        "exam_mode": "practice",
        "certification": cert,
        "total_questions": 1,
        "randomize_questions": True,
        "randomize_options": True,
    }
    res = client.post("/api/v1/exams", json=start_payload)
    assert res.status_code == 201, res.text
    session_id = res.json()["id"]

    # Touch the exam-detail read path too, since that's what a real exam
    # session hits -- the bug only ever showed up on a fresh read after the
    # exam-creation commit, not in the in-memory response from creation.
    details_res = client.get(f"/api/v1/exams/{session_id}")
    assert details_res.status_code == 200

    q_res = client.get(f"/api/v1/questions/{question_id}")
    assert q_res.status_code == 200
    assert len(q_res.json()["options"]) == 4, (
        "Options were lost after creating an exam with randomize_options=True "
        "-- regression of the random.shuffle()/delete-orphan cascade bug."
    )


def test_skipped_answer_is_not_recorded_as_incorrect():
    """
    Regression test: save_answer used to set is_correct=False whenever
    selected_option_ids was empty. The frontend auto-saves on every
    navigation/flag/bookmark action regardless of whether the question was
    actually answered, so simply navigating past a question (never selecting
    anything) silently recorded it as a wrong answer -- corrupting every
    accuracy/weak-topic calculation, which all treat `is_correct != None` as
    "this question was attempted". is_correct must be None (not False) when
    nothing was selected.
    """
    question, cert = _create_question_with_options(n_options=2)

    start_payload = {
        "title": "Skipped Answer Regression Test",
        "exam_mode": "practice",
        "certification": cert,
        "total_questions": 1,
        "randomize_questions": False,
        "randomize_options": False,
    }
    res = client.post("/api/v1/exams", json=start_payload)
    assert res.status_code == 201, res.text
    session_id = res.json()["id"]

    # Simulate navigating past the question without selecting an option --
    # exactly what ExamRunnerPage's goToIndex() does on every "Previous"/
    # palette click, even for unanswered questions.
    answer_payload = {
        "question_id": question["id"],
        "selected_option_ids": [],
        "time_spent_seconds": 3,
        "confidence_level": "not_set",
    }
    ans_res = client.post(f"/api/v1/exams/{session_id}/answer", json=answer_payload)
    assert ans_res.status_code == 200

    session_data = ans_res.json()
    saved_answer = next(a for a in session_data["answers"] if a["question_id"] == question["id"])
    assert saved_answer["is_correct"] is None, (
        "A skipped (never-answered) question was recorded with is_correct=False "
        "instead of None -- it will be miscounted as a wrong answer in analytics."
    )
