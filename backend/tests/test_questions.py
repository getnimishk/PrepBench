from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_list_questions():
    response = client.get("/api/v1/questions")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0 # Seeded questions exist

def test_create_question():
    payload = {
        "text": "What is unit testing in software engineering?",
        "question_type": "single_choice",
        "difficulty": "easy",
        "domain": "Testing",
        "topic": "Unit Test",
        "certification": "General",
        "options": [
            {"option_text": "Testing individual units or components in isolation", "is_correct": True},
            {"option_text": "Testing the whole system with live users", "is_correct": False}
        ]
    }
    response = client.post("/api/v1/questions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["text"] == payload["text"]
