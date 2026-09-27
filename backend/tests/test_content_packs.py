# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_content_packs.py

The content-pack foundation (skills-and-content-packs-plan.md, Phase 1):

  * the shipped `adf` and `adls` packs load, validate, and cross-reference
    correctly (their own chapters, and each other's -- see
    EXPECTED_CHAPTER_REFERENCES below)
  * a malformed pack file is skipped, never fatal
  * attach / upgrade / detach through the API follow D3-D5: a Skill pins a
    pack version, upgrading is explicit, detaching keeps evidence
"""
import json
import re
import uuid

import pytest
from fastapi.testclient import TestClient

from app.content import packs as pack_store
from app.main import app

client = TestClient(app)

CHAPTER_REF_RE = re.compile(r"[Cc]hapter (\d+)")

# Every "chapter N" mention in the shipped guide text, and the chapter id that
# N is supposed to resolve to (its 1-indexed position in that pack's chapter
# list). A future edit that reorders chapters without updating a cross-
# reference should break this test, not silently point at the wrong chapter.
EXPECTED_CHAPTER_REFERENCES = {
    "adf": [
        ("what-it-is", 11, "transform"),
        ("what-it-is", 20, "fabric"),
        ("building-blocks", 11, "transform"),
        ("reconciliation", 7, "bad-rows"),
        ("reconciliation", 7, "bad-rows"),
        ("incremental", 10, "cdc"),
        ("cdc", 9, "incremental"),
        ("monitoring", 13, "recovery"),
        ("recovery", 3, "pipelines"),
        ("recovery", 5, "triggers"),
        ("recovery", 7, "bad-rows"),
        ("recovery", 8, "reconciliation"),
        ("recovery", 10, "cdc"),
        ("recovery", 12, "monitoring"),
        ("recovery", 18, "cicd"),
        ("recovery", 19, "migration"),
        ("security", 15, "sensitive-data"),
        ("sensitive-data", 8, "reconciliation"),
        ("performance-cost", 17, "fine-tuning"),
        ("fine-tuning", 16, "performance-cost"),
    ],
    "adls": [
        ("what-it-is", 2, "namespace"),
        ("what-it-is", 2, "namespace"),
        ("what-it-is", 3, "abfs"),
        ("namespace", 3, "abfs"),
        ("namespace", 6, "protection"),
        ("protection", 2, "namespace"),
    ],
}


def _pack(pack_id: str):
    pack = pack_store.latest(pack_id)
    assert pack is not None, f"{pack_id} pack failed to load"
    return pack


# ---- pack loading and structure -------------------------------------------


def test_adf_pack_shape():
    pack = _pack("adf")
    assert pack.chapter_count == 21
    assert pack.scenario_count == 18
    assert pack.written_scenario_count == 4
    assert len(pack.diagnostic_questions) == 10


def test_adls_pack_shape():
    pack = _pack("adls")
    assert pack.chapter_count == 11
    assert pack.scenario_count == 0
    assert len(pack.diagnostic_questions) == 2


@pytest.mark.parametrize("pack_id", ["adf", "adls"])
def test_chapter_ids_are_unique_within_a_pack(pack_id):
    pack = _pack(pack_id)
    ids = [c.id for c in pack.chapters]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("pack_id", ["adf", "adls"])
def test_scenario_ids_are_unique_within_a_pack(pack_id):
    pack = _pack(pack_id)
    ids = [s.id for level in pack.scenario_levels for s in level.scenarios]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("pack_id", ["adf", "adls"])
def test_scenario_chapter_references_resolve(pack_id):
    pack = _pack(pack_id)
    chapter_ids = {c.id for c in pack.chapters}
    for level in pack.scenario_levels:
        for scenario in level.scenarios:
            assert scenario.chapter in chapter_ids, (
                f"{pack_id}/{scenario.id} points at chapter {scenario.chapter!r}, "
                "which doesn't exist in this pack"
            )


@pytest.mark.parametrize("pack_id", ["adf", "adls"])
def test_practice_link_scenario_ids_resolve(pack_id):
    pack = _pack(pack_id)
    scenario_ids = {s.id for level in pack.scenario_levels for s in level.scenarios}
    for chapter in pack.chapters:
        for link in chapter.practice_links:
            assert link.scenario_id in scenario_ids, (
                f"{pack_id}/{chapter.id} links to scenario "
                f"{link.scenario_id!r}, which doesn't exist in this pack"
            )


@pytest.mark.parametrize("pack_id", ["adf", "adls"])
def test_diagnostic_question_chapter_references_resolve(pack_id):
    pack = _pack(pack_id)
    chapter_ids = {c.id for c in pack.chapters}
    for q in pack.diagnostic_questions:
        assert q.chapter in chapter_ids, (
            f"{pack_id} diagnostic question {q.id!r} points at chapter "
            f"{q.chapter!r}, which doesn't exist in this pack"
        )


@pytest.mark.parametrize("pack_id", ["adf", "adls"])
def test_no_bold_markdown_in_table_cells(pack_id):
    """Table cells are plain text (the plan's pack-format note)."""
    pack = _pack(pack_id)
    for chapter in pack.chapters:
        for block in chapter.blocks:
            if not block.table:
                continue
            for row in [block.table.head, *block.table.rows]:
                for cell in row:
                    assert "**" not in cell, (
                        f"{pack_id}/{chapter.id} has a bold marker in a table cell: {cell!r}"
                    )


@pytest.mark.parametrize("pack_id", ["adf", "adls"])
def test_chapter_n_cross_references_point_at_the_right_chapter(pack_id):
    """Every "chapter N" mention resolves to the chapter this content actually
    means -- not just to whatever chapter happens to sit at position N today."""
    pack = _pack(pack_id)
    expected = EXPECTED_CHAPTER_REFERENCES[pack_id]

    # Every mention in the shipped pack is accounted for by the expected list,
    # per source chapter -- so a new "chapter N" added later without a
    # matching entry here fails loudly instead of going unchecked.
    found_by_chapter = {}
    for chapter in pack.chapters:
        mentions = []
        for block in chapter.blocks:
            for text in (block.md, block.heading):
                if text:
                    mentions.extend(int(n) for n in CHAPTER_REF_RE.findall(text))
            if block.table:
                for row in [block.table.head, *block.table.rows]:
                    for cell in row:
                        mentions.extend(int(n) for n in CHAPTER_REF_RE.findall(cell))
        if mentions:
            found_by_chapter[chapter.id] = sorted(mentions)

    expected_by_chapter = {}
    for source_chapter, n, _target in expected:
        expected_by_chapter.setdefault(source_chapter, []).append(n)
    expected_by_chapter = {k: sorted(v) for k, v in expected_by_chapter.items()}

    assert found_by_chapter == expected_by_chapter, (
        f"{pack_id}: chapter cross-references changed. Update "
        "EXPECTED_CHAPTER_REFERENCES to match, after checking the new "
        "reference points at the chapter it means."
    )

    for source_chapter, n, expected_target_id in expected:
        actual = pack.chapters[n - 1].id
        assert actual == expected_target_id, (
            f"{pack_id}/{source_chapter} says 'chapter {n}', expected that to be "
            f"{expected_target_id!r} but chapter {n} is now {actual!r}"
        )


def test_malformed_pack_file_is_skipped_not_fatal(tmp_path):
    good_dir = tmp_path / "adf"
    good_dir.mkdir()
    (good_dir / "v1.json").write_text(
        json.dumps({
            "pack_id": "adf",
            "version": 1,
            "title": "Azure Data Factory",
            "summary": "s",
            "docs_url": "https://example.test",
            "source_notes": "docs/research/adf-documentation-notes.md",
            "chapters": [],
        }),
        encoding="utf-8",
    )
    bad_dir = tmp_path / "broken"
    bad_dir.mkdir()
    (bad_dir / "v1.json").write_text("{ not valid json", encoding="utf-8")

    packs = pack_store.load_packs(tmp_path)
    assert set(packs.keys()) == {"adf"}
    assert packs["adf"][1].title == "Azure Data Factory"


def test_load_packs_is_cached_per_directory(tmp_path):
    pack_store.clear_cache()
    first = pack_store.load_packs(tmp_path)
    (tmp_path / "adf").mkdir()
    (tmp_path / "adf" / "v1.json").write_text(
        json.dumps({
            "pack_id": "adf", "version": 1, "title": "t", "summary": "s",
            "docs_url": "https://example.test", "source_notes": "n", "chapters": [],
        }),
        encoding="utf-8",
    )
    second = pack_store.load_packs(tmp_path)
    assert first == {} and second == {}, "a directory's packs are cached at first read"
    pack_store.clear_cache()
    assert pack_store.load_packs(tmp_path) != {}


# ---- API: attach / upgrade / detach ---------------------------------------


def _make_skill(name: str | None = None) -> int:
    resp = client.post("/api/v1/subjects", json={
        "name": name or f"Test skill {uuid.uuid4().hex[:8]}",
        "kind": "skill",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _make_certification(name: str | None = None) -> int:
    resp = client.post("/api/v1/subjects", json={
        "name": name or f"Test cert {uuid.uuid4().hex[:8]}",
        "kind": "certification",
        "pass_mark": 80,
        "exam_question_count": 40,
        "exam_minutes": 60,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_list_content_packs():
    resp = client.get("/api/v1/content-packs")
    assert resp.status_code == 200
    by_id = {p["pack_id"]: p for p in resp.json()}
    assert by_id["adf"]["chapter_count"] == 21
    assert by_id["adls"]["chapter_count"] == 11


def test_get_content_pack_detail_and_unknown_pack_404():
    resp = client.get("/api/v1/content-packs/adf")
    assert resp.status_code == 200
    assert resp.json()["pack_id"] == "adf"
    assert len(resp.json()["chapters"]) == 21

    resp = client.get("/api/v1/content-packs/no-such-pack")
    assert resp.status_code == 404


def test_attach_pack_to_a_skill_and_see_it_on_the_subject():
    subject_id = _make_skill()
    resp = client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["pack_id"] == "adf"
    assert body["pack_version"] == 1
    assert body["latest_version"] == 1
    assert body["title"] == "Azure Data Factory"

    subject = client.get(f"/api/v1/subjects/{subject_id}").json()
    assert subject["content_packs"] == [body]


def test_attach_refused_for_a_certification_subject():
    subject_id = _make_certification()
    resp = client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    assert resp.status_code == 400


def test_attach_unknown_pack_404():
    subject_id = _make_skill()
    resp = client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "no-such-pack"})
    assert resp.status_code == 404


def test_attach_same_pack_twice_conflicts():
    subject_id = _make_skill()
    client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    resp = client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    assert resp.status_code == 409


def test_upgrade_refuses_a_downgrade_or_the_same_version():
    subject_id = _make_skill()
    client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})

    resp = client.put(f"/api/v1/subjects/{subject_id}/content-packs/adf", json={"version": 1})
    assert resp.status_code == 400

    resp = client.put(f"/api/v1/subjects/{subject_id}/content-packs/adf", json={"version": 0})
    assert resp.status_code == 422  # ge=1


def test_upgrade_unknown_version_404():
    subject_id = _make_skill()
    client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    resp = client.put(f"/api/v1/subjects/{subject_id}/content-packs/adf", json={"version": 99})
    assert resp.status_code == 404


def test_detach_removes_the_link():
    subject_id = _make_skill()
    client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    resp = client.delete(f"/api/v1/subjects/{subject_id}/content-packs/adf")
    assert resp.status_code == 204

    subject = client.get(f"/api/v1/subjects/{subject_id}").json()
    assert subject["content_packs"] == []


def test_detach_unknown_link_404():
    subject_id = _make_skill()
    resp = client.delete(f"/api/v1/subjects/{subject_id}/content-packs/adf")
    assert resp.status_code == 404


def test_delete_subject_removes_pack_link_via_cascade():
    subject_id = _make_skill()
    client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    subject_name = client.get(f"/api/v1/subjects/{subject_id}").json()["name"]

    resp = client.request(
        "DELETE", f"/api/v1/subjects/{subject_id}",
        json={"confirm_name": subject_name},
    )
    assert resp.status_code == 200, resp.text

    from tests.conftest import TestingSessionLocal
    from app.models.subject_content_pack import SubjectContentPack
    db = TestingSessionLocal()
    try:
        remaining = (
            db.query(SubjectContentPack)
            .filter(SubjectContentPack.subject_id == subject_id)
            .count()
        )
        assert remaining == 0
    finally:
        db.close()
