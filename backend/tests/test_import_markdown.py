from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_import_markdown():
    md_content = """# Test Markdown Pack

## Question 1
What is the default port for FastAPI dev server?
- Type: single_choice
- Difficulty: easy
- Domain: Backend
- Topic: FastAPI
- Certification: Python Dev

### Options
- [ ] 3000
- [x] 8000
- [ ] 5000

### Explanation
Uvicorn runs FastAPI on port 8000 by default.
"""
    files = {
        "file": ("test_questions.md", md_content.encode("utf-8"), "text/markdown")
    }
    response = client.post("/api/v1/imports/file", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] == 1
    assert data["failed_count"] == 0

def test_import_inline_markdown_format():
    inline_md = """# PSM I Practice Questions - Part 1

## Question 1
**Topic:** Empiricism
**Type:** Single Select

A team discovers during Sprint 3 that clinical validation metrics dropped below safety standards. What should they do?

A. Agree with the Product Owner to protect team morale and funding.
B. Insist that real validation metrics be presented, as transparency is essential.
C. Cancel the Sprint immediately.
D. Advise the Developers to rewrite the Definition of Done.

**Correct Answer:** B

**Explanation:** Scrum is founded on empiricism (transparency, inspection, and adaptation).

**Why the others are wrong:**
- **A:** Hiding real metrics violates transparency.
"""
    files = {
        "file": ("psm1_questions_sample.md", inline_md.encode("utf-8"), "text/markdown")
    }
    response = client.post("/api/v1/imports/validate", files=files)
    assert response.status_code == 200
    report = response.json()
    assert report["total_processed"] == 1
    assert report["valid_count"] == 1
    assert report["items"][0]["question"]["topic"] == "Empiricism"
    assert report["items"][0]["question"]["options"][1]["is_correct"] is True

def test_import_json_with_unstripped_ids_and_camelcase():
    raw_json = """[
        {
            "id": 447,
            "text": "When can the Product Backlog be updated?",
            "question_type": "single_choice",
            "difficulty": "easy",
            "domain": "Managing Products with Agility",
            "topic": "PB Ordering",
            "certification": "PSM I",
            "explanation": "At any time by the Product Owner.",
            "options": [
                {
                    "id": 1691,
                    "option_text": "Only during Product Backlog refinement.",
                    "is_correct": false,
                    "isCorrect": false,
                    "order_index": 0
                },
                {
                    "id": 1693,
                    "option_text": "At any time by the Product Owner.",
                    "is_correct": true,
                    "isCorrect": true,
                    "order_index": 2
                }
            ]
        }
    ]"""
    files = {
        "file": ("test_bank.json", raw_json.encode("utf-8"), "application/json")
    }
    response = client.post("/api/v1/imports/validate", files=files)
    assert response.status_code == 200
    report = response.json()
    assert report["total_processed"] == 1
    assert report["valid_count"] == 1
    item = report["items"][0]["question"]
    assert item["text"] == "When can the Product Backlog be updated?"
    assert len(item["options"]) == 2
    assert item["options"][1]["is_correct"] is True
