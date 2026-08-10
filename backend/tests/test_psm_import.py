import os
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_import_psm_hard_file():
    filepath = r"C:\Users\Nimish Kanungo\Downloads\PSM-I-Practice-Exam-Hard.md"
    if not os.path.exists(filepath):
        return

    with open(filepath, "rb") as f:
        files = {
            "file": ("PSM-I-Practice-Exam-Hard.md", f.read(), "text/markdown")
        }
    response = client.post("/api/v1/imports/file", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] >= 75 # Successfully imports 80 questions!
