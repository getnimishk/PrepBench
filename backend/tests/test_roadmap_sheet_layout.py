# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_roadmap_sheet_layout.py

An imported workbook's sheets become the roadmap page's tabs, in workbook
order. Nothing here depends on particular sheet names.
"""

import io

import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.core.database import apply_lightweight_migrations
from app.main import app
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapResource, RoadmapTopic
from tests.conftest import TestingSessionLocal

client = TestClient(app)

SYLLABUS_HEADER = ["Phase", "#", "Topic", "Learning Objective", "Success Criteria", "Est. Hours"]
TRACKER_HEADER = ["#", "Topic", "Phase", "Status", "Progress %", "Start Date", "Completion Date", "Evidence"]


@pytest.fixture
def roadmap_ids():
    created = []
    yield created
    db = TestingSessionLocal()
    try:
        if created:
            db.query(Roadmap).filter(Roadmap.id.in_(created)).delete(synchronize_session=False)
            db.commit()
    finally:
        db.close()


def _workbook(sheets: dict) -> bytes:
    workbook = openpyxl.Workbook()
    workbook.remove(workbook.active)
    for name, rows in sheets.items():
        worksheet = workbook.create_sheet(title=name)
        for row in rows:
            worksheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _syllabus():
    return [
        SYLLABUS_HEADER,
        ["1. Foundations", 1, "Basics", "Understand it.", "Explain it.", 3],
        ["2. Delivery", 2, "Commits", "Manual vs auto.", "Commit correctly.", 4],
    ]


def _tracker():
    return [
        TRACKER_HEADER,
        [1, "Basics", "1. Foundations", "Completed", 100, None, None, "Did it"],
    ]


def _resource(first: str):
    return [[first, "Description"], ["a", "first"], ["b", "second"]]


def _import(content: bytes, roadmap_ids):
    res = client.post("/api/v1/roadmaps/import/validate",
                      files={"file": ("book.xlsx", content, "application/octet-stream")})
    assert res.status_code == 200, res.text
    preview = res.json()
    confirm = client.post("/api/v1/roadmaps/import/confirm", json={
        "title": preview["title"],
        "source_filename": preview["source_filename"],
        "topics": preview["topics"],
        "resources": preview["resources"],
        "sheets": preview["sheets"],
    })
    assert confirm.status_code == 201, confirm.text
    roadmap_id = confirm.json()["roadmap_id"]
    roadmap_ids.append(roadmap_id)
    return preview, client.get(f"/api/v1/roadmaps/{roadmap_id}").json()


def _make_roadmap(roadmap_ids, *, layout=None, topics=True, resources=()):
    db = TestingSessionLocal()
    try:
        roadmap = Roadmap(title="Legacy", sheet_layout=layout)
        db.add(roadmap)
        db.flush()
        if topics:
            phase = RoadmapPhase(roadmap_id=roadmap.id, name="P", order_index=0)
            db.add(phase)
            db.flush()
            db.add(RoadmapTopic(roadmap_id=roadmap.id, phase_id=phase.id, title="T", order_index=0))
        made = []
        for index, title in enumerate(resources):
            res = RoadmapResource(roadmap_id=roadmap.id, title=title, order_index=index,
                                  columns=["A"], rows=[["x"]])
            db.add(res)
            made.append(res)
        db.commit()
        roadmap_ids.append(roadmap.id)
        return roadmap.id, [r.id for r in made]
    finally:
        db.close()


def _detail(roadmap_id):
    return client.get(f"/api/v1/roadmaps/{roadmap_id}").json()


# ---------------------------------------------------------------- import

def test_preview_keeps_workbook_order_and_drops_ignored_sheets(roadmap_ids):
    content = _workbook({
        "First": _syllabus(),
        "Second": _tracker(),
        "Cmds": _resource("Command"),
        "Terms": _resource("Term"),
        "Blank": [[None]],
    })
    preview, detail = _import(content, roadmap_ids)

    assert preview["sheets"] == [
        {"name": "First", "kind": "syllabus"},
        {"name": "Second", "kind": "tracker"},
        {"name": "Cmds", "kind": "resource"},
        {"name": "Terms", "kind": "resource"},
    ]
    assert "Blank" in preview["ignored_sheets"]

    by_title = {r["title"]: r["id"] for r in detail["resources"]}
    assert detail["sheets"] == [
        {"name": "First", "kind": "syllabus", "resource_id": None},
        {"name": "Second", "kind": "tracker", "resource_id": None},
        {"name": "Cmds", "kind": "resource", "resource_id": by_title["Cmds"]},
        {"name": "Terms", "kind": "resource", "resource_id": by_title["Terms"]},
    ]


def test_a_syllabus_sheet_that_falls_back_to_a_resource_is_stored_as_resource(roadmap_ids):
    # Syllabus-shaped header, but no Topic column, so no topics can be read.
    fallback = [
        ["Phase", "Objective", "Success", "Hours"],
        ["P1", "Learn", "Do", 2],
    ]
    preview, detail = _import(_workbook({"Real": _syllabus(), "Odd": fallback}), roadmap_ids)

    assert preview["sheets"][1] == {"name": "Odd", "kind": "resource"}
    assert [s["kind"] for s in detail["sheets"]] == ["syllabus", "resource"]


def test_tracker_only_workbook_stores_its_sheet_as_the_syllabus(roadmap_ids):
    preview, detail = _import(_workbook({"Progress": _tracker()}), roadmap_ids)

    assert preview["sheets"] == [{"name": "Progress", "kind": "syllabus"}]
    assert detail["sheets"] == [{"name": "Progress", "kind": "syllabus", "resource_id": None}]


def test_non_excel_previews_have_no_sheets(roadmap_ids):
    res = client.post("/api/v1/roadmaps/import/validate",
                      files={"file": ("r.json", b'{"topics":[{"title":"A","phase":"P"}]}', "application/json")})
    assert res.json()["sheets"] == []


# ---------------------------------------------------------------- detail

def test_legacy_roadmap_derives_a_syllabus_then_each_resource(roadmap_ids):
    rid, res_ids = _make_roadmap(roadmap_ids, resources=["Alpha", "Beta"])
    assert _detail(rid)["sheets"] == [
        {"name": "Syllabus", "kind": "syllabus", "resource_id": None},
        {"name": "Alpha", "kind": "resource", "resource_id": res_ids[0]},
        {"name": "Beta", "kind": "resource", "resource_id": res_ids[1]},
    ]


def test_empty_legacy_roadmap_has_no_sheets(roadmap_ids):
    rid, _ = _make_roadmap(roadmap_ids, topics=False)
    assert _detail(rid)["sheets"] == []


def test_stored_entry_whose_resource_is_gone_is_filtered_out(roadmap_ids):
    layout = [
        {"name": "Syl", "kind": "syllabus"},
        {"name": "Gone", "kind": "resource", "resource_id": 999999},
    ]
    rid, _ = _make_roadmap(roadmap_ids, layout=layout)
    assert _detail(rid)["sheets"] == [{"name": "Syl", "kind": "syllabus", "resource_id": None}]


# ------------------------------------------------------------- migration

def test_sheet_layout_migration_is_idempotent():
    apply_lightweight_migrations()
    apply_lightweight_migrations()
