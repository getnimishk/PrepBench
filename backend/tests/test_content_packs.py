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

        ("what-it-is", 2, "building-blocks"),
        ("what-it-is", 4, "integration-runtimes"),
        ("what-it-is", 5, "triggers"),
        ("what-it-is", 7, "bad-rows"),
        ("what-it-is", 8, "reconciliation"),
        ("what-it-is", 11, "transform"),
        ("what-it-is", 13, "recovery"),
        ("what-it-is", 15, "sensitive-data"),
        ("what-it-is", 20, "fabric"),
        ("building-blocks", 1, "what-it-is"),
        ("building-blocks", 3, "pipelines"),
        ("building-blocks", 4, "integration-runtimes"),
        ("building-blocks", 4, "integration-runtimes"),
        ("building-blocks", 5, "triggers"),
        ("building-blocks", 18, "cicd"),
        ("pipelines", 1, "what-it-is"),
        ("pipelines", 1, "what-it-is"),
        ("pipelines", 2, "building-blocks"),
        ("pipelines", 5, "triggers"),
        ("pipelines", 12, "monitoring"),
        ("pipelines", 13, "recovery"),
        ("pipelines", 17, "fine-tuning"),
        ("pipelines", 21, "pitfalls"),
        ("integration-runtimes", 1, "what-it-is"),
        ("integration-runtimes", 14, "security"),
        ("copy", 1, "what-it-is"),
        ("copy", 4, "integration-runtimes"),
        ("copy", 7, "bad-rows"),
        ("copy", 7, "bad-rows"),
        ("copy", 7, "bad-rows"),
        ("copy", 7, "bad-rows"),
        ("copy", 16, "performance-cost"),
        ("copy", 16, "performance-cost"),
        ("bad-rows", 8, "reconciliation"),
        ("bad-rows", 8, "reconciliation"),
        ("bad-rows", 15, "sensitive-data"),
        ("reconciliation", 7, "bad-rows"),
        ("reconciliation", 7, "bad-rows"),
        ("reconciliation", 19, "migration"),
        ("reconciliation", 20, "fabric"),
        ("incremental", 3, "pipelines"),
        ("incremental", 10, "cdc"),
        ("incremental", 10, "cdc"),
        ("incremental", 10, "cdc"),
        ("incremental", 13, "recovery"),
        ("cdc", 8, "reconciliation"),
        ("cdc", 9, "incremental"),
        ("cdc", 9, "incremental"),
        ("transform", 1, "what-it-is"),
        ("transform", 3, "pipelines"),
        ("transform", 3, "pipelines"),
        ("transform", 4, "integration-runtimes"),
        ("transform", 8, "reconciliation"),
        ("transform", 8, "reconciliation"),
        ("transform", 10, "cdc"),
        ("transform", 17, "fine-tuning"),
        ("transform", 20, "fabric"),
        ("monitoring", 3, "pipelines"),
        ("monitoring", 3, "pipelines"),
        ("monitoring", 4, "integration-runtimes"),
        ("monitoring", 8, "reconciliation"),
        ("monitoring", 13, "recovery"),
        ("monitoring", 18, "cicd"),
        ("recovery", 5, "triggers"),
        ("recovery", 5, "triggers"),
        ("recovery", 6, "copy"),
        ("recovery", 7, "bad-rows"),
        ("recovery", 7, "bad-rows"),
        ("recovery", 8, "reconciliation"),
        ("recovery", 10, "cdc"),
        ("recovery", 12, "monitoring"),
        ("recovery", 12, "monitoring"),
        ("recovery", 12, "monitoring"),
        ("recovery", 18, "cicd"),
        ("recovery", 19, "migration"),
        ("recovery", 19, "migration"),
        ("security", 2, "building-blocks"),
        ("security", 3, "pipelines"),
        ("security", 4, "integration-runtimes"),
        ("security", 4, "integration-runtimes"),
        ("security", 4, "integration-runtimes"),
        ("security", 4, "integration-runtimes"),
        ("security", 12, "monitoring"),
        ("security", 15, "sensitive-data"),
        ("security", 18, "cicd"),
        ("security", 18, "cicd"),
        ("sensitive-data", 3, "pipelines"),
        ("sensitive-data", 4, "integration-runtimes"),
        ("sensitive-data", 4, "integration-runtimes"),
        ("sensitive-data", 8, "reconciliation"),
        ("sensitive-data", 14, "security"),
        ("sensitive-data", 14, "security"),
        ("sensitive-data", 14, "security"),
        ("sensitive-data", 14, "security"),
        ("sensitive-data", 14, "security"),
        ("performance-cost", 4, "integration-runtimes"),
        ("performance-cost", 4, "integration-runtimes"),
        ("performance-cost", 6, "copy"),
        ("performance-cost", 9, "incremental"),
        ("performance-cost", 11, "transform"),
        ("performance-cost", 17, "fine-tuning"),
        ("fine-tuning", 3, "pipelines"),
        ("fine-tuning", 4, "integration-runtimes"),
        ("fine-tuning", 4, "integration-runtimes"),
        ("fine-tuning", 5, "triggers"),
        ("fine-tuning", 6, "copy"),
        ("fine-tuning", 9, "incremental"),
        ("fine-tuning", 9, "incremental"),
        ("fine-tuning", 11, "transform"),
        ("fine-tuning", 11, "transform"),
        ("fine-tuning", 11, "transform"),
        ("fine-tuning", 16, "performance-cost"),
        ("cicd", 2, "building-blocks"),
        ("cicd", 5, "triggers"),
        ("cicd", 12, "monitoring"),
        ("cicd", 13, "recovery"),
        ("cicd", 14, "security"),
        ("migration", 4, "integration-runtimes"),
        ("migration", 6, "copy"),
        ("migration", 8, "reconciliation"),
        ("migration", 8, "reconciliation"),
        ("migration", 9, "incremental"),
        ("migration", 9, "incremental"),
        ("migration", 9, "incremental"),
        ("migration", 13, "recovery"),
        ("migration", 16, "performance-cost"),
        ("migration", 17, "fine-tuning"),
        ("migration", 18, "cicd"),
        ("fabric", 1, "what-it-is"),
        ("fabric", 4, "integration-runtimes"),
        ("fabric", 5, "triggers"),
        ("fabric", 16, "performance-cost"),
        ("pitfalls", 1, "what-it-is"),
        ("pitfalls", 4, "integration-runtimes"),
        ("pitfalls", 7, "bad-rows"),
        ("pitfalls", 8, "reconciliation"),
        ("pitfalls", 9, "incremental"),
        ("pitfalls", 12, "monitoring"),
        ("pitfalls", 13, "recovery"),
        ("pitfalls", 16, "performance-cost"),
        ("pitfalls", 16, "performance-cost"),
        ("pitfalls", 17, "fine-tuning"),
        ("pitfalls", 18, "cicd"),
        ("pitfalls", 18, "cicd"),
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
    assert pack.written_scenario_count == 18
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
    # A skill attaches at the latest published version; older versions stay readable.
    assert body["pack_version"] == pack_store.latest("adf").version
    assert body["latest_version"] == pack_store.latest("adf").version
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
    resp = client.put(
        f"/api/v1/subjects/{subject_id}/content-packs/adf", json={"version": pack_store.latest("adf").version}
    )
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

# ---- published versions are kept, never edited (plan D3/D4) -----------------

# The first published ADF guide, as it shipped before Chapters 1 to 3 were redesigned. A skill that
# attached at version 1 keeps reading this text until the learner upgrades, and past attempts point
# at it, so the file must not change. Fix a typo by publishing a new version instead.
ADF_V1_FINGERPRINT = "1defc4f2bb28e15232c722be4139d07cce4c3891c09cc60286bce2c2201cd26b"


def _canonical_hash(pack) -> str:
    import hashlib

    payload = json.dumps(pack.model_dump(mode="json"), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def test_the_first_published_adf_guide_is_kept_unchanged():
    v1 = pack_store.get("adf", 1)
    assert v1 is not None and v1.version == 1
    assert v1.chapters[0].title == "What ADF is, and what it isn't"
    assert _canonical_hash(v1) == ADF_V1_FINGERPRINT


def test_every_published_version_is_its_own_file_and_the_newest_is_the_default():
    versions = pack_store.load_packs()["adf"]
    assert {1, 2} <= set(versions)
    assert pack_store.latest("adf").version == max(versions)
    # Same ids and order in every version, so a link, a scenario or a diagnostic keeps resolving.
    assert [c.id for c in versions[1].chapters] == [c.id for c in versions[max(versions)].chapters]

    assert client.get("/api/v1/content-packs/adf?version=1").json()["chapters"][0]["title"] == "What ADF is, and what it isn't"
    assert client.get("/api/v1/content-packs/adf").json()["version"] == max(versions)


def test_a_skill_pinned_at_version_one_keeps_it_until_the_learner_upgrades():
    from app.models.subject_content_pack import SubjectContentPack
    from tests.conftest import TestingSessionLocal

    subject_id = _make_skill()
    client.post(f"/api/v1/subjects/{subject_id}/content-packs", json={"pack_id": "adf"})
    session = TestingSessionLocal()
    try:
        link = session.query(SubjectContentPack).filter(SubjectContentPack.subject_id == subject_id).one()
        link.pack_version = 1
        session.commit()
    finally:
        session.close()

    pinned = client.get(f"/api/v1/subjects/{subject_id}").json()["content_packs"][0]
    assert (pinned["pack_version"], pinned["latest_version"]) == (1, pack_store.latest("adf").version)

    upgraded = client.put(f"/api/v1/subjects/{subject_id}/content-packs/adf", json={"version": 2})
    assert upgraded.status_code == 200, upgraded.text
    assert upgraded.json()["pack_version"] == 2
