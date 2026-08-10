import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_start_and_finish_exam():
    # 0. Ensure at least one question exists in DB
    q_payload = {
        "text": f"Exam Engine Test Question-{uuid.uuid4().hex}",
        "question_type": "single_choice",
        "options": [
            {"option_text": "Option A", "is_correct": True, "order_index": 0},
            {"option_text": "Option B", "is_correct": False, "order_index": 1}
        ]
    }
    client.post("/api/v1/questions", json=q_payload)

    # 1. Start exam
    start_payload = {
        "title": "Unit Test Exam Session",
        "exam_mode": "practice",
        "question_count": 1
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
