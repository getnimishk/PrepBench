# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_e2e_full_suite.py

Comprehensive End-to-End Test Suite covering:
1. Regression Testing (Questions CRUD, Clear All, Settings, File Cleanup)
2. Integration Testing (Upload -> Validate -> Import -> Exam Session -> Answer -> Finish -> Analytics)
3. Negative Testing (Invalid file uploads, Bad Question/Exam IDs, Out-of-bounds requests)
4. Edge Case & Error Testing (LaTeX math formulas, extreme text length, auto-repair markdown)
"""

import pytest
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.utils.cleanup import clean_unnecessary_files

client = TestClient(app)

# ==========================================
# 1. REGRESSION TEST SUITE
# ==========================================
def test_regression_create_get_delete_question():
    unique_text = f"Regression Test Question Unique-{uuid.uuid4().hex}"
    payload = {
        "text": unique_text,
        "question_type": "single_choice",
        "difficulty": "medium",
        "domain": "Domain 2: Developing People & Teams",
        "topic": "Product Backlog",
        "certification": "PSM I",
        "explanation": "The Product Owner is explicitly accountable for Product Backlog management.",
        "options": [
            {"option_text": "Product Owner", "is_correct": True, "order_index": 0},
            {"option_text": "Scrum Master", "is_correct": False, "order_index": 1},
            {"option_text": "Developers", "is_correct": False, "order_index": 2},
            {"option_text": "Project Manager", "is_correct": False, "order_index": 3}
        ]
    }
    response = client.post("/api/v1/questions", json=payload)
    assert response.status_code == 201
    q_data = response.json()
    assert q_data["id"] > 0

    get_res = client.get("/api/v1/questions")
    assert get_res.status_code == 200
    assert get_res.json()["total"] > 0

    del_res = client.delete(f"/api/v1/questions/{q_data['id']}")
    assert del_res.status_code == 204


def test_regression_clear_all_questions():
    # Create sample question
    unique_text = f"Sample Clear All Question-{uuid.uuid4().hex}"
    payload = {
        "text": unique_text,
        "question_type": "single_choice",
        "options": [{"option_text": "Option A", "is_correct": True, "order_index": 0}]
    }
    client.post("/api/v1/questions", json=payload)

    # Clear all questions
    clear_res = client.delete("/api/v1/questions/clear-all")
    assert clear_res.status_code == 200
    assert "deleted_count" in clear_res.json()

    # Verify question list is now empty
    list_res = client.get("/api/v1/questions")
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 0


def test_regression_settings_api():
    get_res = client.get("/api/v1/settings")
    assert get_res.status_code == 200
    current_settings = get_res.json()
    assert "theme" in current_settings

    update_payload = {"theme": "dark", "default_target_role": "Staff SRE"}
    put_res = client.put("/api/v1/settings", json=update_payload)
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["theme"] == "dark"
    assert updated_data["default_target_role"] == "Staff SRE"


def test_regression_file_cleanup_utility(tmp_path: Path):
    # Create dummy cache directory and log file inside temp folder
    cache_dir = tmp_path / "__pycache__"
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "test.pyc").write_bytes(b"cached bytecode")

    dummy_log = tmp_path / "app_debug.log"
    dummy_log.write_text("sample log output", encoding="utf-8")

    # Dry-run execution
    dry_summary = clean_unnecessary_files(tmp_path, dry_run=True)
    assert dry_summary["dry_run"] is True
    assert dry_summary["slated_files_count"] == 1
    assert dry_summary["slated_dirs_count"] == 1
    assert cache_dir.exists()
    assert dummy_log.exists()

    # Actual deletion execution
    run_summary = clean_unnecessary_files(tmp_path, dry_run=False)
    assert run_summary["dry_run"] is False
    assert run_summary["deleted_files_count"] == 1
    assert run_summary["deleted_dirs_count"] == 1
    assert not cache_dir.exists()
    assert not dummy_log.exists()

# ==========================================
# 2. INTEGRATION TEST SUITE (END-TO-END FLOW)
# ==========================================
def test_integration_full_exam_lifecycle():
    unique_text = f"Integration Pillar Test-{uuid.uuid4().hex}"
    sample_md = f"""### Question 001
[Topic: Empiricism]
[Type: single_choice]
[Domain: Domain 1: Understanding & Applying Scrum]
[Focus Area: Empiricism]
[Tier: Tier 1: Foundational Definition]

{unique_text}

- [x] Transparency, Inspection, and Adaptation
- [ ] Planning, Coding, and Testing
- [ ] Scope, Time, and Budget
- [ ] Vision, Strategy, and Execution

**Correct Answer:** A

**Explanation:**
Scrum is founded on empirical process control with three pillars: Transparency, Inspection, and Adaptation.
"""
    val_res = client.post(
        "/api/v1/imports/validate",
        files={"file": ("test_bank.md", sample_md.encode("utf-8"), "text/markdown")}
    )
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["valid_count"] == 1

    imp_res = client.post(
        "/api/v1/imports/file",
        files={"file": ("test_bank.md", sample_md.encode("utf-8"), "text/markdown")}
    )
    assert imp_res.status_code == 200
    assert imp_res.json()["success_count"] == 1

    exam_req = {
        "title": "PSM I Practice Test 1",
        "question_count": 1,
        "mode": "timed",
        "time_limit_minutes": 10
    }
    start_res = client.post("/api/v1/exams", json=exam_req)
    assert start_res.status_code == 201
    session_data = start_res.json()
    session_id = session_data["id"]

    exam_details = client.get(f"/api/v1/exams/{session_id}").json()
    q_item = exam_details["questions"][0]
    opt_id = q_item["options"][0]["id"]

    ans_req = {
        "question_id": q_item["id"],
        "selected_option_ids": [opt_id]
    }
    ans_res = client.post(f"/api/v1/exams/{session_id}/answer", json=ans_req)
    assert ans_res.status_code == 200

    finish_res = client.post(f"/api/v1/exams/{session_id}/finish")
    assert finish_res.status_code == 200
    result = finish_res.json()
    assert result["status"] == "completed"

    dash_res = client.get("/api/v1/analytics/dashboard")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_exams"] >= 0

# ==========================================
# 3. NEGATIVE TEST SUITE
# ==========================================
def test_negative_invalid_file_format():
    local_client = TestClient(app, raise_server_exceptions=False)
    res = local_client.post(
        "/api/v1/imports/file",
        files={"file": ("bad_script.exe", b"binary content", "application/octet-stream")}
    )
    assert res.status_code == 400


def test_negative_non_existent_exam_session():
    res = client.get("/api/v1/exams/99999")
    assert res.status_code == 404


def test_negative_non_existent_question():
    res = client.get("/api/v1/questions/999999")
    assert res.status_code == 404


def test_negative_finish_already_completed_exam():
    unique_text = f"Sample Question Negative Test-{uuid.uuid4().hex}"
    payload = {
        "text": unique_text,
        "question_type": "single_choice",
        "options": [{"option_text": "A", "is_correct": True, "order_index": 0}]
    }
    client.post("/api/v1/questions", json=payload)
    start_res = client.post("/api/v1/exams", json={"question_count": 1})
    session_id = start_res.json()["id"]

    first_finish = client.post(f"/api/v1/exams/{session_id}/finish")
    second_finish = client.post(f"/api/v1/exams/{session_id}/finish")
    assert second_finish.status_code == 200
    assert second_finish.json()["status"] == "completed"

    # Finishing twice must be a no-op, not a re-scoring. Asserting only the
    # status let a real bug through: end_time used to be re-stamped on every
    # call, so each extra finish inflated the recorded duration.
    first, second = first_finish.json(), second_finish.json()
    assert second["end_time"] == first["end_time"]
    assert second["time_spent_seconds"] == first["time_spent_seconds"]
    assert second["score_percentage"] == first["score_percentage"]

# ==========================================
# 4. EDGE CASE TEST SUITE
# ==========================================
def test_edge_case_latex_and_extreme_length_question():
    long_stem = f"Suppose $E=mc^2$ applies to Agile velocity ({uuid.uuid4().hex}). " + ("Extreme detail text " * 100)
    payload = {
        "text": long_stem,
        "question_type": "multiple_choice",
        "difficulty": "hard",
        "domain": "Domain 4: Developing & Delivering Professionally",
        "topic": "Physics & Math",
        "certification": "Special",
        "explanation": "Inline math formula $\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$ verified.",
        "options": [
            {"option_text": "$A = \\pi r^2$", "is_correct": True, "order_index": 0},
            {"option_text": "$B = 2\\pi r$", "is_correct": True, "order_index": 1},
            {"option_text": "Incorrect option with <script>alert(1)</script>", "is_correct": False, "order_index": 2}
        ]
    }
    create_res = client.post("/api/v1/questions", json=payload)
    assert create_res.status_code == 201
    q_data = create_res.json()
    assert len(q_data["text"]) > 1000


def test_edge_case_auto_repair_markdown_content():
    bad_md = """### Question 100
[Type: single_choice]

Select the two key events in Scrum:

- [x] A. Sprint Planning
- [x] B. Daily Scrum
- [ ] C. Status Review
"""
    repair_res = client.post(
        "/api/v1/imports/repair",
        files={"file": ("unrepaired.md", bad_md.encode("utf-8"), "text/markdown")}
    )
    assert repair_res.status_code == 200
    repaired_text = repair_res.text
    assert "[Type: multiple_choice]" in repaired_text
    assert "- [x] Sprint Planning" in repaired_text
    assert "- [x] A." not in repaired_text


def test_edge_case_cleanup_non_existent_directory():
    with pytest.raises(FileNotFoundError):
        clean_unnecessary_files("/non/existent/path/for/test/testing_cleanup")


def test_regression_reset_application_data():
    # 1. Create a question and exam session
    q_payload = {
        "text": f"Reset Test Question-{uuid.uuid4().hex}",
        "question_type": "single_choice",
        "options": [{"option_text": "Option A", "is_correct": True, "order_index": 0}]
    }
    client.post("/api/v1/questions", json=q_payload)
    client.post("/api/v1/exams", json={"question_count": 1})

    # 2. Call reset-app endpoint
    reset_res = client.post("/api/v1/settings/reset-app")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "success"

    # 3. Verify questions count is 0
    q_list = client.get("/api/v1/questions").json()
    assert q_list["total"] == 0

    # 4. Verify settings are restored to default (must match AppSettings model defaults)
    settings_data = client.get("/api/v1/settings").json()
    assert settings_data["theme"] == "light"
    assert settings_data["timer_sound_enabled"] is True
    assert settings_data["default_target_role"] is None
    # The "Exam Defaults" block -- exam mode, question count, passing score,
    # shuffle -- is gone from the surface. Nothing ever read it.
    assert "default_exam_mode" not in settings_data
    assert "default_passing_percentage" not in settings_data

