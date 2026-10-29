# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_content_packs.py

The content-pack foundation (skills-and-content-packs-plan.md, Phase 1):

  * the shipped `adf`, `adls`, `kafka` and `databricks` packs load, validate, and cross-reference
    correctly (their own chapters, and each other's -- see
    EXPECTED_CHAPTER_REFERENCES below)
  * a malformed pack file is skipped, never fatal
  * attach / upgrade / detach through the API follow D3-D5: a Skill pins a
    pack version, upgrading is explicit, detaching keeps evidence
"""
import json
import re
import uuid
from collections import Counter

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
        ("what-it-is", 19, "cicd"),
        ("what-it-is", 2, "how-adf-works"),
        ("what-it-is", 3, "building-blocks"),
        ("what-it-is", 16, "sensitive-data"),
        ("what-it-is", 7, "copy"),
        ("what-it-is", 17, "performance-cost"),
        ("what-it-is", 22, "fabric"),
        ("what-it-is", 1, "what-it-is"),
        ("what-it-is", 2, "how-adf-works"),
        ("what-it-is", 3, "building-blocks"),
        ("how-adf-works", 1, "what-it-is"),
        ("how-adf-works", 8, "bad-rows"),
        ("how-adf-works", 9, "reconciliation"),
        ("how-adf-works", 12, "transform"),
        ("how-adf-works", 4, "pipelines"),
        ("how-adf-works", 19, "cicd"),
        ("how-adf-works", 13, "monitoring"),
        ("how-adf-works", 14, "recovery"),
        ("building-blocks", 5, "integration-runtimes"),
        ("building-blocks", 6, "triggers"),
        ("building-blocks", 1, "what-it-is"),
        ("building-blocks", 5, "integration-runtimes"),
        ("building-blocks", 4, "pipelines"),
        ("building-blocks", 19, "cicd"),
        ("pipelines", 7, "copy"),
        ("pipelines", 2, "how-adf-works"),
        ("pipelines", 13, "monitoring"),
        ("pipelines", 3, "building-blocks"),
        ("pipelines", 18, "fine-tuning"),
        ("pipelines", 14, "recovery"),
        ("pipelines", 6, "triggers"),
        ("pipelines", 18, "fine-tuning"),
        ("integration-runtimes", 1, "what-it-is"),
        ("integration-runtimes", 15, "security"),
        ("copy", 1, "what-it-is"),
        ("copy", 5, "integration-runtimes"),
        ("copy", 3, "building-blocks"),
        ("copy", 8, "bad-rows"),
        ("copy", 8, "bad-rows"),
        ("copy", 8, "bad-rows"),
        ("copy", 17, "performance-cost"),
        ("copy", 8, "bad-rows"),
        ("copy", 14, "recovery"),
        ("copy", 17, "performance-cost"),
        ("bad-rows", 9, "reconciliation"),
        ("bad-rows", 16, "sensitive-data"),
        ("bad-rows", 9, "reconciliation"),
        ("reconciliation", 8, "bad-rows"),
        ("reconciliation", 8, "bad-rows"),
        ("reconciliation", 22, "fabric"),
        ("reconciliation", 20, "migration"),
        ("incremental", 11, "cdc"),
        ("incremental", 11, "cdc"),
        ("incremental", 14, "recovery"),
        ("incremental", 11, "cdc"),
        ("incremental", 4, "pipelines"),
        ("cdc", 10, "incremental"),
        ("cdc", 10, "incremental"),
        ("cdc", 9, "reconciliation"),
        ("transform", 2, "how-adf-works"),
        ("transform", 21, "service-selection"),
        ("transform", 4, "pipelines"),
        ("transform", 4, "pipelines"),
        ("transform", 5, "integration-runtimes"),
        ("transform", 22, "fabric"),
        ("transform", 11, "cdc"),
        ("transform", 9, "reconciliation"),
        ("transform", 9, "reconciliation"),
        ("transform", 18, "fine-tuning"),
        ("monitoring", 4, "pipelines"),
        ("monitoring", 14, "recovery"),
        ("monitoring", 4, "pipelines"),
        ("monitoring", 19, "cicd"),
        ("monitoring", 5, "integration-runtimes"),
        ("monitoring", 9, "reconciliation"),
        ("recovery", 13, "monitoring"),
        ("recovery", 6, "triggers"),
        ("recovery", 20, "migration"),
        ("recovery", 8, "bad-rows"),
        ("recovery", 11, "cdc"),
        ("recovery", 6, "triggers"),
        ("recovery", 7, "copy"),
        ("recovery", 8, "bad-rows"),
        ("recovery", 19, "cicd"),
        ("recovery", 13, "monitoring"),
        ("recovery", 9, "reconciliation"),
        ("recovery", 13, "monitoring"),
        ("recovery", 20, "migration"),
        ("security", 5, "integration-runtimes"),
        ("security", 5, "integration-runtimes"),
        ("security", 3, "building-blocks"),
        ("security", 5, "integration-runtimes"),
        ("security", 5, "integration-runtimes"),
        ("security", 5, "integration-runtimes"),
        ("security", 4, "pipelines"),
        ("security", 13, "monitoring"),
        ("security", 16, "sensitive-data"),
        ("security", 19, "cicd"),
        ("security", 19, "cicd"),
        ("sensitive-data", 15, "security"),
        ("sensitive-data", 15, "security"),
        ("sensitive-data", 5, "integration-runtimes"),
        ("sensitive-data", 5, "integration-runtimes"),
        ("sensitive-data", 15, "security"),
        ("sensitive-data", 4, "pipelines"),
        ("sensitive-data", 15, "security"),
        ("sensitive-data", 15, "security"),
        ("sensitive-data", 9, "reconciliation"),
        ("performance-cost", 7, "copy"),
        ("performance-cost", 18, "fine-tuning"),
        ("performance-cost", 10, "incremental"),
        ("performance-cost", 5, "integration-runtimes"),
        ("performance-cost", 12, "transform"),
        ("performance-cost", 5, "integration-runtimes"),
        ("fine-tuning", 17, "performance-cost"),
        ("fine-tuning", 5, "integration-runtimes"),
        ("fine-tuning", 7, "copy"),
        ("fine-tuning", 10, "incremental"),
        ("fine-tuning", 12, "transform"),
        ("fine-tuning", 12, "transform"),
        ("fine-tuning", 12, "transform"),
        ("fine-tuning", 5, "integration-runtimes"),
        ("fine-tuning", 6, "triggers"),
        ("fine-tuning", 4, "pipelines"),
        ("fine-tuning", 10, "incremental"),
        ("cicd", 3, "building-blocks"),
        ("cicd", 3, "building-blocks"),
        ("cicd", 6, "triggers"),
        ("cicd", 15, "security"),
        ("cicd", 13, "monitoring"),
        ("cicd", 14, "recovery"),
        ("migration", 17, "performance-cost"),
        ("migration", 10, "incremental"),
        ("migration", 7, "copy"),
        ("migration", 10, "incremental"),
        ("migration", 5, "integration-runtimes"),
        ("migration", 10, "incremental"),
        ("migration", 18, "fine-tuning"),
        ("migration", 9, "reconciliation"),
        ("migration", 19, "cicd"),
        ("migration", 14, "recovery"),
        ("migration", 9, "reconciliation"),
        ("service-selection", 22, "fabric"),
        ("service-selection", 5, "integration-runtimes"),
        ("service-selection", 22, "fabric"),
        ("service-selection", 5, "integration-runtimes"),
        ("service-selection", 6, "triggers"),
        ("service-selection", 22, "fabric"),
        ("fabric", 21, "service-selection"),
        ("fabric", 5, "integration-runtimes"),
        ("fabric", 6, "triggers"),
        ("fabric", 17, "performance-cost"),
        ("fabric", 21, "service-selection"),
        ("pitfalls", 14, "recovery"),
        ("pitfalls", 17, "performance-cost"),
        ("pitfalls", 19, "cicd"),
        ("pitfalls", 1, "what-it-is"),
        ("pitfalls", 17, "performance-cost"),
        ("pitfalls", 18, "fine-tuning"),
        ("pitfalls", 5, "integration-runtimes"),
        ("pitfalls", 8, "bad-rows"),
        ("pitfalls", 19, "cicd"),
        ("pitfalls", 9, "reconciliation"),
        ("pitfalls", 19, "cicd"),
        ("pitfalls", 13, "monitoring"),
        ("pitfalls", 10, "incremental"),
    ],
    "adls": [
        ("what-it-is", 2, "namespace"),
        ("what-it-is", 2, "namespace"),
        ("what-it-is", 3, "abfs"),
        ("namespace", 3, "abfs"),
        ("namespace", 6, "protection"),
        ("protection", 2, "namespace"),
    ],
    "kafka": [
        ("what-it-is", 7, "consumer"),
        ("what-it-is", 7, "consumer"),
        ("what-it-is", 10, "keys"),
        ("what-it-is", 12, "replication"),
        ("log", 1, "what-it-is"),
        ("log", 6, "producer"),
        ("log", 7, "consumer"),
        ("log", 10, "keys"),
        ("log", 10, "keys"),
        ("log", 12, "replication"),
        ("log", 13, "retention"),
        ("log", 13, "retention"),
        ("cluster", 12, "replication"),
        ("cluster", 12, "replication"),
        ("first-cluster", 9, "rebalancing"),
        ("first-cluster", 12, "replication"),
        ("first-cluster", 16, "schemas"),
        ("topic-design", 10, "keys"),
        ("topic-design", 12, "replication"),
        ("topic-design", 13, "retention"),
        ("topic-design", 16, "schemas"),
        ("topic-design", 16, "schemas"),
        ("topic-design", 19, "security"),
        ("producer", 8, "delivery"),
        ("producer", 12, "replication"),
        ("consumer", 8, "delivery"),
        ("consumer", 9, "rebalancing"),
        ("consumer", 9, "rebalancing"),
        ("consumer", 10, "keys"),
        ("delivery", 6, "producer"),
        ("delivery", 7, "consumer"),
        ("delivery", 18, "streams"),
        ("rebalancing", 7, "consumer"),
        ("rebalancing", 10, "keys"),
        ("rebalancing", 10, "keys"),
        ("rebalancing", 14, "failures"),
        ("rebalancing", 14, "failures"),
        ("keys", 6, "producer"),
        ("throughput", 6, "producer"),
        ("throughput", 6, "producer"),
        ("throughput", 9, "rebalancing"),
        ("throughput", 10, "keys"),
        ("throughput", 15, "monitoring"),
        ("replication", 15, "monitoring"),
        ("monitoring", 9, "rebalancing"),
        ("monitoring", 12, "replication"),
        ("schemas", 14, "failures"),
        ("schemas", 19, "security"),
        ("connect", 13, "retention"),
        ("connect", 14, "failures"),
        ("connect", 16, "schemas"),
        ("connect", 18, "streams"),
        ("streams", 8, "delivery"),
        ("streams", 9, "rebalancing"),
        ("streams", 9, "rebalancing"),
        ("streams", 13, "retention"),
        ("streams", 14, "failures"),
        ("security", 5, "topic-design"),
        ("multi-cluster", 12, "replication"),
        ("multi-cluster", 12, "replication"),
        ("system-design", 7, "consumer"),
        ("system-design", 8, "delivery"),
        ("system-design", 13, "retention"),
        ("system-design", 14, "failures"),
    ],
    "databricks": [
        ("lakehouse", 9, "tables-storage"),
        ("lakehouse", 3, "delta-log"),
        ("parquet", 7, "layout"),
        ("parquet", 15, "auto-loader"),
        ("parquet", 3, "delta-log"),
        ("parquet", 7, "layout"),
        ("parquet", 7, "layout"),
        ("delta-log", 2, "parquet"),
        ("delta-log", 4, "history"),
        ("delta-log", 7, "layout"),
        ("delta-log", 6, "merge-cdf"),
        ("delta-log", 4, "history"),
        ("delta-log", 7, "layout"),
        ("delta-log", 4, "history"),
        ("delta-log", 24, "production"),
        ("delta-log", 7, "layout"),
        ("delta-log", 16, "streaming"),
        ("history", 3, "delta-log"),
        ("history", 7, "layout"),
        ("history", 16, "streaming"),
        ("history", 24, "production"),
        ("schemas", 6, "merge-cdf"),
        ("schemas", 4, "history"),
        ("schemas", 3, "delta-log"),
        ("schemas", 16, "streaming"),
        ("schemas", 24, "production"),
        ("schemas", 13, "medallion"),
        ("merge-cdf", 5, "schemas"),
        ("merge-cdf", 17, "pipelines"),
        ("merge-cdf", 16, "streaming"),
        ("merge-cdf", 4, "history"),
        ("merge-cdf", 7, "layout"),
        ("layout", 2, "parquet"),
        ("layout", 3, "delta-log"),
        ("layout", 3, "delta-log"),
        ("layout", 4, "history"),
        ("unity-catalog", 10, "access"),
        ("unity-catalog", 1, "lakehouse"),
        ("unity-catalog", 10, "access"),
        ("unity-catalog", 9, "tables-storage"),
        ("unity-catalog", 1, "lakehouse"),
        ("unity-catalog", 24, "production"),
        ("tables-storage", 7, "layout"),
        ("tables-storage", 23, "networking"),
        ("tables-storage", 24, "production"),
        ("tables-storage", 2, "parquet"),
        ("access", 20, "monitoring"),
        ("compute", 1, "lakehouse"),
        ("compute", 16, "streaming"),
        ("compute", 24, "production"),
        ("compute", 24, "production"),
        ("compute", 20, "monitoring"),
        ("compute", 7, "layout"),
        ("spark", 19, "performance"),
        ("spark", 19, "performance"),
        ("spark", 16, "streaming"),
        ("spark", 6, "merge-cdf"),
        ("medallion", 16, "streaming"),
        ("medallion", 17, "pipelines"),
        ("ingestion", 16, "streaming"),
        ("ingestion", 17, "pipelines"),
        ("auto-loader", 16, "streaming"),
        ("auto-loader", 24, "production"),
        ("auto-loader", 24, "production"),
        ("auto-loader", 24, "production"),
        ("streaming", 17, "pipelines"),
        ("streaming", 24, "production"),
        ("streaming", 17, "pipelines"),
        ("streaming", 17, "pipelines"),
        ("streaming", 3, "delta-log"),
        ("streaming", 17, "pipelines"),
        ("streaming", 4, "history"),
        ("streaming", 15, "auto-loader"),
        ("pipelines", 6, "merge-cdf"),
        ("pipelines", 20, "monitoring"),
        ("jobs", 24, "production"),
        ("jobs", 6, "merge-cdf"),
        ("jobs", 16, "streaming"),
        ("performance", 12, "spark"),
        ("performance", 24, "production"),
        ("performance", 7, "layout"),
        ("monitoring", 11, "compute"),
        ("monitoring", 24, "production"),
        ("monitoring", 18, "jobs"),
        ("monitoring", 17, "pipelines"),
        ("monitoring", 24, "production"),
        ("cicd", 9, "tables-storage"),
        ("azure-integration", 9, "tables-storage"),
        ("azure-integration", 23, "networking"),
        ("production", 15, "auto-loader"),
        ("production", 18, "jobs"),
        ("production", 4, "history"),
        ("production", 5, "schemas"),
        ("production", 6, "merge-cdf"),
        ("production", 3, "delta-log"),
        ("production", 4, "history"),
        ("production", 3, "delta-log"),
        ("production", 23, "networking"),
        ("production", 6, "merge-cdf"),
        ("production", 19, "performance"),
        ("production", 9, "tables-storage"),
        ("production", 17, "pipelines"),
        ("production", 13, "medallion"),
        ("production", 18, "jobs"),
        ("production", 10, "access"),
        ("production", 20, "monitoring"),
    ],
}


def _pack(pack_id: str):
    pack = pack_store.latest(pack_id)
    assert pack is not None, f"{pack_id} pack failed to load"
    return pack


# ---- pack loading and structure -------------------------------------------


def test_adf_pack_shape():
    pack = _pack("adf")
    assert pack.chapter_count == 23
    assert pack.scenario_count == 18
    assert pack.written_scenario_count == 18
    assert len(pack.diagnostic_questions) == 10


def test_kafka_pack_shape():
    pack = _pack("kafka")
    assert pack.chapter_count == 21
    assert pack.scenario_count == 18
    assert pack.written_scenario_count == 18
    assert len(pack.diagnostic_questions) == 8


def test_databricks_pack_shape():
    pack = _pack("databricks")
    assert pack.chapter_count == 24
    assert pack.scenario_count == 0
    assert len(pack.diagnostic_questions) == 0


def test_adls_pack_shape():
    pack = _pack("adls")
    assert pack.chapter_count == 11
    assert pack.scenario_count == 0
    assert len(pack.diagnostic_questions) == 2


@pytest.mark.parametrize("pack_id", ["adf", "adls", "kafka", "databricks"])
def test_chapter_ids_are_unique_within_a_pack(pack_id):
    pack = _pack(pack_id)
    ids = [c.id for c in pack.chapters]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("pack_id", ["adf", "adls", "kafka", "databricks"])
def test_scenario_ids_are_unique_within_a_pack(pack_id):
    pack = _pack(pack_id)
    ids = [s.id for level in pack.scenario_levels for s in level.scenarios]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("pack_id", ["adf", "adls", "kafka", "databricks"])
def test_scenario_chapter_references_resolve(pack_id):
    pack = _pack(pack_id)
    chapter_ids = {c.id for c in pack.chapters}
    for level in pack.scenario_levels:
        for scenario in level.scenarios:
            assert scenario.chapter in chapter_ids, (
                f"{pack_id}/{scenario.id} points at chapter {scenario.chapter!r}, "
                "which doesn't exist in this pack"
            )


@pytest.mark.parametrize("pack_id", ["adf", "adls", "kafka", "databricks"])
def test_practice_link_scenario_ids_resolve(pack_id):
    pack = _pack(pack_id)
    scenario_ids = {s.id for level in pack.scenario_levels for s in level.scenarios}
    for chapter in pack.chapters:
        for link in chapter.practice_links:
            assert link.scenario_id in scenario_ids, (
                f"{pack_id}/{chapter.id} links to scenario "
                f"{link.scenario_id!r}, which doesn't exist in this pack"
            )


@pytest.mark.parametrize("pack_id", ["adf", "adls", "kafka", "databricks"])
def test_diagnostic_question_chapter_references_resolve(pack_id):
    pack = _pack(pack_id)
    chapter_ids = {c.id for c in pack.chapters}
    for q in pack.diagnostic_questions:
        assert q.chapter in chapter_ids, (
            f"{pack_id} diagnostic question {q.id!r} points at chapter "
            f"{q.chapter!r}, which doesn't exist in this pack"
        )


@pytest.mark.parametrize("pack_id", ["adf", "adls", "kafka", "databricks"])
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


@pytest.mark.parametrize("pack_id", ["adf", "adls", "kafka", "databricks"])
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
    assert by_id["adf"]["chapter_count"] == 23
    assert by_id["adls"]["chapter_count"] == 11
    assert by_id["kafka"]["chapter_count"] == 21
    assert by_id["databricks"]["chapter_count"] == 24


def test_get_content_pack_detail_and_unknown_pack_404():
    resp = client.get("/api/v1/content-packs/adf")
    assert resp.status_code == 200
    assert resp.json()["pack_id"] == "adf"
    assert len(resp.json()["chapters"]) == 23

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


# The rewritten guide (23 chapters, 2026-10-21), as published. Version 3 only moved each scenario
# check's correct option so the answers no longer sit in the middle; skills pinned at 2 keep this.
ADF_V2_FINGERPRINT = "d6740d889522e6ce8fcc55d339c1e5d68c9674aa4b7632b24a40991fc58e78bd"


def test_the_second_published_adf_guide_is_kept_unchanged():
    v2 = pack_store.get("adf", 2)
    assert v2 is not None and v2.version == 2
    assert _canonical_hash(v2) == ADF_V2_FINGERPRINT


def test_correct_answers_are_spread_over_the_option_positions():
    # v2 put 64 of 72 correct answers at index 1, so always picking the middle option passed. No
    # position may hold more than half the answers in the newest version.
    checks = [q for level in _pack("adf").scenario_levels for s in level.scenarios for q in (s.content or {}).get("check", [])]
    assert checks
    positions = Counter(q["answer"] for q in checks)
    assert max(positions.values()) <= len(checks) / 2, positions
    assert set(positions) == {0, 1, 2}


def test_every_published_version_is_its_own_file_and_the_newest_is_the_default():
    versions = pack_store.load_packs()["adf"]
    assert {1, 2, 3} <= set(versions)
    assert pack_store.latest("adf").version == max(versions)
    # Every earlier chapter keeps its id and relative order in the newest version (which may add
    # chapters), so a link, a scenario or a diagnostic keeps resolving.
    newest_ids = iter(c.id for c in versions[max(versions)].chapters)
    assert all(c.id in newest_ids for c in versions[1].chapters)

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
