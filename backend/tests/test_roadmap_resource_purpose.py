# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_roadmap_resource_purpose.py

An extra workbook sheet is either reference material (also listed in the Study
Library) or a plan sheet (hours, status, dates; Roadmaps only). The importer
decides from the header row, the learner can change it, and the library reads
one preparation's reference sheets from a single endpoint. Nothing here depends
on particular sheet names.
"""

import io
import sqlite3
import uuid

import openpyxl
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core import database as app_database
from app.core.database import apply_lightweight_migrations
from app.main import app
from app.models.roadmap import Roadmap, RoadmapResource
from tests.conftest import TestingSessionLocal

client = TestClient(app)

SYLLABUS = ["Phase", "#", "Topic", "Learning Objective", "Success Criteria", "Est. Hours"]


@pytest.fixture
def cleanup():
    roadmaps, subjects = [], []
    yield roadmaps, subjects
    db = TestingSessionLocal()
    try:
        if roadmaps:
            db.query(Roadmap).filter(Roadmap.id.in_(roadmaps)).delete(synchronize_session=False)
            db.commit()
    finally:
        db.close()
    for name in subjects:
        client.request("DELETE", f"/api/v1/subjects/{name[0]}", json={"confirm_name": name[1]})


def _subject(cleanup):
    name = f"Purpose {uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/subjects", json={"name": name, "kind": "skill"})
    assert res.status_code == 201, res.text
    body = res.json()
    sid = body.get("id", body.get("subject_id"))
    cleanup[1].append((sid, name))
    return sid


def _workbook(sheets: dict) -> bytes:
    workbook = openpyxl.Workbook()
    workbook.remove(workbook.active)
    for name, rows in sheets.items():
        ws = workbook.create_sheet(title=name)
        for row in rows:
            ws.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _import(content: bytes, cleanup, subject_id=None):
    res = client.post("/api/v1/roadmaps/import/validate",
                      files={"file": ("book.xlsx", content, "application/octet-stream")})
    assert res.status_code == 200, res.text
    preview = res.json()
    confirm = client.post("/api/v1/roadmaps/import/confirm", json={
        "title": preview["title"], "topics": preview["topics"],
        "resources": preview["resources"], "sheets": preview["sheets"],
    })
    assert confirm.status_code == 201, confirm.text
    rid = confirm.json()["roadmap_id"]
    cleanup[0].append(rid)
    if subject_id is not None:
        assert client.put(f"/api/v1/roadmaps/{rid}", json={"subject_id": subject_id}).status_code == 200
    return preview, client.get(f"/api/v1/roadmaps/{rid}").json()


def _purposes(detail):
    return {r["title"]: r["purpose"] for r in detail["resources"]}


def _book(**extra):
    sheets = {"Syl": [SYLLABUS, ["P1", 1, "Basics", "Learn it.", "Explain it.", 3]]}
    sheets.update(extra)
    return _workbook(sheets)


# ---------------------------------------------------------------- import rule

def test_a_sheet_with_no_planning_columns_is_a_reference_sheet(cleanup):
    preview, detail = _import(_book(Notes=[["Concept", "Meaning"], ["a", "b"]]), cleanup)
    assert _purposes(detail) == {"Notes": "reference"}
    assert preview["resources"][0]["purpose"] == "reference"


def test_a_sheet_with_an_hours_column_is_a_plan_sheet(cleanup):
    _, detail = _import(_book(Work=[["Item", "Est. Hours"], ["a", "3"]]), cleanup)
    assert _purposes(detail) == {"Work": "plan"}


def test_a_sheet_with_a_status_column_is_a_plan_sheet(cleanup):
    _, detail = _import(_book(Work=[["Task", "Owner", "STATUS"], ["a", "me", "todo"]]), cleanup)
    assert _purposes(detail) == {"Work": "plan"}


def test_underscored_and_camel_case_headers_count_as_planning_columns(cleanup):
    _, detail = _import(_book(
        Snake=[["item", "estimated_hours"], ["a", "3"]],
        Camel=[["item", "dueDate"], ["a", "soon"]],
    ), cleanup)
    assert _purposes(detail) == {"Snake": "plan", "Camel": "plan"}


def test_other_planning_headers_and_whole_word_matching(cleanup):
    _, detail = _import(_book(
        Pri=[["Item", "Priority"], ["a", "high"]],
        Dates=[["Item", "Due date"], ["a", "soon"]],
        # "Procedure" contains "due" and "Update" contains "date", but neither is a word.
        Docs=[["Procedure", "Update notes"], ["a", "b"]],
    ), cleanup)
    assert _purposes(detail) == {"Pri": "plan", "Dates": "plan", "Docs": "reference"}


# ------------------------------------------------------------------- PATCH

def test_patch_changes_the_purpose_both_ways(cleanup):
    _, detail = _import(_book(Notes=[["Concept", "Meaning"], ["a", "b"]]), cleanup)
    rid, res_id = detail["id"], detail["resources"][0]["id"]

    res = client.patch(f"/api/v1/roadmaps/{rid}/resources/{res_id}", json={"purpose": "plan"})
    assert res.status_code == 200, res.text
    assert res.json()["purpose"] == "plan"
    assert _purposes(client.get(f"/api/v1/roadmaps/{rid}").json()) == {"Notes": "plan"}

    res = client.patch(f"/api/v1/roadmaps/{rid}/resources/{res_id}", json={"purpose": "reference"})
    assert res.json()["purpose"] == "reference"


def test_patch_rejects_an_unknown_purpose(cleanup):
    _, detail = _import(_book(Notes=[["Concept", "Meaning"], ["a", "b"]]), cleanup)
    res = client.patch(
        f"/api/v1/roadmaps/{detail['id']}/resources/{detail['resources'][0]['id']}",
        json={"purpose": "archive"},
    )
    assert res.status_code == 422
    assert client.patch(
        f"/api/v1/roadmaps/{detail['id']}/resources/{detail['resources'][0]['id']}", json={},
    ).status_code == 422


def test_patch_of_another_roadmaps_resource_is_404_and_changes_nothing(cleanup):
    _, first = _import(_book(Notes=[["Concept", "Meaning"], ["a", "b"]]), cleanup)
    _, second = _import(_book(Other=[["Concept", "Meaning"], ["a", "b"]]), cleanup)

    res = client.patch(
        f"/api/v1/roadmaps/{first['id']}/resources/{second['resources'][0]['id']}",
        json={"purpose": "plan"},
    )
    assert res.status_code == 404
    assert _purposes(client.get(f"/api/v1/roadmaps/{second['id']}").json()) == {"Other": "reference"}
    assert client.patch(
        f"/api/v1/roadmaps/{first['id']}/resources/999999", json={"purpose": "plan"},
    ).status_code == 404


# ----------------------------------------------------------- reference sheets

def test_reference_sheets_lists_only_that_preparations_unarchived_reference_sheets(cleanup):
    mine, other = _subject(cleanup), _subject(cleanup)

    _, a = _import(_book(
        Notes=[["Concept", "Meaning"], ["a", "b"]],
        Work=[["Item", "Est. Hours"], ["a", "3"]],
    ), cleanup, subject_id=mine)
    _import(_book(Theirs=[["Concept", "Meaning"], ["a", "b"]]), cleanup, subject_id=other)
    _import(_book(Loose=[["Concept", "Meaning"], ["a", "b"]]), cleanup)  # no preparation
    _, archived = _import(_book(Old=[["Concept", "Meaning"], ["a", "b"]]), cleanup, subject_id=mine)
    assert client.put(f"/api/v1/roadmaps/{archived['id']}", json={"is_archived": True}).status_code == 200

    res = client.get("/api/v1/roadmaps/reference-sheets", params={"subject_id": mine})
    assert res.status_code == 200, res.text
    notes = next(r for r in a["resources"] if r["title"] == "Notes")
    assert res.json() == [{
        "resource_id": notes["id"], "name": "Notes",
        "roadmap_id": a["id"], "roadmap_title": a["title"],
    }]

    # Flipping the plan sheet to reference makes it appear; flipping Notes to plan removes it.
    work = next(r for r in a["resources"] if r["title"] == "Work")
    client.patch(f"/api/v1/roadmaps/{a['id']}/resources/{work['id']}", json={"purpose": "reference"})
    client.patch(f"/api/v1/roadmaps/{a['id']}/resources/{notes['id']}", json={"purpose": "plan"})
    res = client.get("/api/v1/roadmaps/reference-sheets", params={"subject_id": mine})
    assert [r["name"] for r in res.json()] == ["Work"]


def test_reference_sheets_needs_a_preparation(cleanup):
    assert client.get("/api/v1/roadmaps/reference-sheets").status_code == 422
    assert client.get("/api/v1/roadmaps/reference-sheets", params={"subject_id": 987654}).json() == []


# ---------------------------------------------------------------- migration

@pytest.mark.skipif(sqlite3.sqlite_version_info < (3, 35), reason="needs DROP COLUMN (SQLite 3.35+)")
def test_purpose_migration_is_idempotent_and_makes_old_rows_reference(cleanup):
    _, detail = _import(_book(Notes=[["Concept", "Meaning"], ["a", "b"]]), cleanup)
    res_id = detail["resources"][0]["id"]
    client.patch(f"/api/v1/roadmaps/{detail['id']}/resources/{res_id}", json={"purpose": "plan"})

    try:
        # Put the table back as it was before the column existed.
        with app_database.engine.connect() as conn:
            conn.execute(text("ALTER TABLE roadmap_resources DROP COLUMN purpose"))
            conn.commit()
    finally:
        apply_lightweight_migrations()
    apply_lightweight_migrations()

    db = TestingSessionLocal()
    try:
        assert db.get(RoadmapResource, res_id).purpose == "reference"
    finally:
        db.close()
