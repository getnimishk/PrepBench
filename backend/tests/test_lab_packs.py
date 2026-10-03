# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Every shipped Lakehouse Lab pack, and the second one in particular (lakehouse-lab-plan.md P1-3).

The point of the JD-PO-005 pack is the PRD's Goal 5: a second pack is *content*, not new code.
So the tests here are written against "every pack in the folder", never against a pack by name,
except where they check what that pack's own content promises (Arabic script, Hijri-format text,
AED rounding). If the second pack needed a change to the loader, the dataset generator or an
operation, these would be where it showed.

Without the engine. The same pack on the real engine is in test_lab_engine.py.
"""
import json
import re
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.lab import dataset_service, pack_service

client = TestClient(app)

JD = "jd-po-005-v1"
ARABIC = re.compile(r"[؀-ۿ]")
HIJRI = re.compile(r"^14\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|30)$")
PACK_IDS = [p.manifest.id for p in pack_service.list_packs()]


def _pack(pack_id):
    return pack_service.get_pack(pack_id)


def test_the_second_pack_is_found_by_the_loader_without_any_change_to_it():
    assert JD in PACK_IDS and "semiconductor-v1" in PACK_IDS
    assert len(PACK_IDS) >= 2


@pytest.mark.parametrize("pack_id", PACK_IDS)
class TestEveryShippedPack:
    def test_is_fictional_and_says_so(self, pack_id):
        p = _pack(pack_id)
        assert p.manifest.fictional is True
        assert "Fictional" in p.scenario_md.splitlines()[0]
        assert p.manifest.notebook_verified_on is None or re.match(r"^\d{4}-\d{2}-\d{2}$", p.manifest.notebook_verified_on)

    def test_manifest_stations_are_ones_the_lab_has(self, pack_id):
        assert set(_pack(pack_id).manifest.stations) <= {"a", "b", "c", "f", "i"}
        assert "c" in _pack(pack_id).manifest.stations      # every pack runs Station C

    def test_has_the_table_station_c_names_with_the_columns_its_challenges_rely_on(self, pack_id):
        spec = _pack(pack_id).dataset.tables["defects"]
        names = {c.name for c in spec.columns}
        assert spec.key == "defect_id" and "defect_id" in names
        assert spec.batches >= 3                              # batch 2 replays, batch 3 drifts
        kinds = {d.kind for d in _pack(pack_id).dataset.defects}
        assert {"schema_drift", "replay", "cdc", "precision"} <= kinds
        drift = next(d for d in _pack(pack_id).dataset.defects if d.kind == "schema_drift")
        assert drift.add_column.name == "inspector_id" and drift.batch == 3
        assert any(c.gen.kind == "int" for c in spec.columns)  # the change batch corrects an integer column

    def test_dataset_is_byte_identical_across_two_generations(self, pack_id):
        p = _pack(pack_id)
        dataset_service._CACHE.clear()
        first = dataset_service.generate(p)
        dataset_service._CACHE.clear()
        second = dataset_service.generate(p)
        for name in first.tables:
            a, b = first.tables[name], second.tables[name]
            assert json.dumps([a.clean, a.legacy, a.batches, a.cdc], default=str, ensure_ascii=False) == \
                json.dumps([b.clean, b.legacy, b.batches, b.cdc], default=str, ensure_ascii=False)
        assert first.manifest == second.manifest

    def test_every_planted_difference_is_really_in_the_data_and_nothing_else_is(self, pack_id):
        p = _pack(pack_id)
        data = dataset_service.generate(p).tables["defects"]
        legacy = {r["defect_id"]: r for r in data.legacy}
        for m in dataset_service.generate(p).manifest:
            if m["table"] != "defects" or m["kind"] not in ("precision", "timezone", "null_handling"):
                continue
            col = m["column"]
            differing = {r["defect_id"] for r in data.clean if r[col] != legacy[r["defect_id"]][col]}
            assert differing == set(m["keys"]), f"{pack_id}: {m['id']} lists rows that differ, and only those"
            assert len(m["keys"]) == m["count"]

    def test_batches_are_contiguous_ids_and_source_index_says_which_batch(self, pack_id):
        p = _pack(pack_id)
        index = dataset_service.source_index(p, "defects")
        spec = p.dataset.tables["defects"]
        assert len(index) == spec.rows
        assert [r["id"] for r in index] == sorted(r["id"] for r in index)
        assert {r["batch"] for r in index} == set(range(1, spec.batches + 1))
        assert [r["modified_at"] for r in index] == sorted(r["modified_at"] for r in index)

    def test_is_listed_served_and_exportable_through_the_unchanged_api(self, pack_id):
        listing = client.get("/api/v1/lab/lakehouse/packs").json()
        assert pack_id in [p["id"] for p in listing]
        detail = client.get(f"/api/v1/lab/lakehouse/packs/{pack_id}")
        assert detail.status_code == 200
        assert detail.json()["tables"] == [f"{layer}.defects" for layer in ("legacy", "bronze", "silver")] or \
            "bronze.defects" in detail.json()["tables"]
        for copy in ("clean", "legacy", "cdc"):
            res = client.get(f"/api/v1/lab/lakehouse/packs/{pack_id}/dataset/defects.csv?copy={copy}")
            assert res.status_code == 200 and "csv" in res.headers["content-type"]
        nb = client.get(f"/api/v1/lab/lakehouse/packs/{pack_id}/notebook")
        assert nb.status_code == 200 and "UNVERIFIED" in nb.text and "Databricks notebook source" in nb.text


class TestTheJdPo005Pack:
    def test_ships_content_only(self):
        from app.data import lab_packs  # noqa: F401  (a data folder, importable only as a namespace)
        folder = pack_service.PACKS_DIR / JD
        files = sorted(p.name for p in folder.iterdir())
        assert files == ["dataset.json", "interview-questions.json", "manifest.json", "scenario.md"]
        assert not list(folder.rglob("*.py")), "a pack is data: no code"

    def test_offers_only_the_station_its_content_supports(self):
        p = _pack(JD)
        assert p.manifest.stations == ["c"]
        assert p.factory == {} and p.pipeline == {}

    def test_regional_text_is_really_there_and_survives_every_copy(self):
        data = dataset_service.generate(_pack(JD)).tables["defects"]
        names = {r["inspector_name_ar"] for r in data.clean}
        assert len(names) == 12 and all(ARABIC.search(n) for n in names)
        assert {r["inspector_name_ar"] for r in data.legacy} == names
        assert all(HIJRI.match(r["reported_hijri_date"]) for r in data.clean)
        assert len({r["reported_hijri_date"] for r in data.clean}) > 20

    def test_aed_rounding_is_whole_fils_in_the_legacy_copy_and_four_decimals_in_the_clean_one(self):
        p = _pack(JD)
        data = dataset_service.generate(p).tables["defects"]
        legacy = {r["defect_id"]: r for r in data.legacy}
        m = next(x for x in dataset_service.generate(p).manifest if x["id"] == "aed-rounding")
        assert m["count"] == 180
        for key in m["keys"][:50]:
            clean_value = next(r for r in data.clean if r["defect_id"] == key)["repair_cost_aed"]
            legacy_value = legacy[key]["repair_cost_aed"]
            assert len(clean_value.split(".")[1]) == 4
            assert legacy_value != clean_value and legacy_value.endswith("00")   # two decimals, padded to four

    def test_csv_exports_decode_as_utf_8_with_the_arabic_names_intact(self):
        for copy in ("clean", "legacy"):
            res = client.get(f"/api/v1/lab/lakehouse/packs/{JD}/dataset/defects.csv?copy={copy}")
            text = res.content.decode("utf-8")
            assert "inspector_name_ar" in text.splitlines()[0]
            assert any(name in text for name in ("أحمد المنصوري", "فاطمة الكتبي"))

    def test_scenario_names_every_planted_difference_the_dataset_has(self):
        p = _pack(JD)
        text = p.scenario_md
        assert "Hijri" in text and "AED" in text and "UTC+4" in text
        counts = {m["id"]: m["count"] for m in dataset_service.generate(p).manifest}
        assert f"| {counts['aed-rounding']} |" in text        # 180
        assert f"| {counts['null-scrap']} |" in text          # 24
        assert f"| {counts['cdc']} |" in text                # 30
        assert f"| {counts['replay']} |" in text              # 600
        assert "Nothing in this pack is a result." in text

    def test_does_not_state_an_outcome_or_invent_the_learners_own_answers(self):
        questions = json.loads((pack_service.PACKS_DIR / JD / "interview-questions.json").read_text(encoding="utf-8"))
        # Questions only: an answer plan has to come from what the learner actually did.
        assert all(set(q) == {"question_text", "round_type", "category"} for q in questions)
        assert all(q["round_type"] == "technical" for q in questions)


class TestTheInterviewQuestionsImportThroughTheExistingImporter:
    def _file(self):
        return (pack_service.PACKS_DIR / JD / "interview-questions.json").read_bytes()

    def test_ten_diagnostic_questions_and_four_prompts(self):
        questions = json.loads(self._file().decode("utf-8"))
        assert len(questions) == 14
        diagnostic = [q for q in questions if q["category"].startswith("Diagnostic")]
        assert len(diagnostic) == 10
        assert len({q["question_text"] for q in questions}) == 14
        # The diagnostic covers both levels: the pipeline and the programme, and the regional data.
        areas = {q["category"].split(": ", 1)[1] for q in diagnostic}
        assert {"data ingestion", "storage and access", "Delta Lake", "reconciliation", "migration planning",
                "governance and identity", "regional data"} <= areas

    def test_the_file_imports_unchanged_as_technical_round_questions(self):
        # The real file is imported as it is, and the round trip is checked on what comes back. (The importer
        # doesn't check for questions you already have, so the pack says to import it once.)
        res = client.post("/api/v1/interview-questions/import", data={"default_round_type": "technical"},
                          files={"file": ("interview-questions.json", self._file(), "application/json")})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imported_count"] == 14 and body["skipped_count"] == 0 and body["errors"] == []
        listing = client.get("/api/v1/interview-questions?round_type=technical&limit=500").json()["items"]
        by_text = {q["question_text"]: q for q in listing}
        source = json.loads(self._file().decode("utf-8"))
        for q in source:
            stored = by_text[q["question_text"]]
            assert stored["round_type"] == "technical"
            assert stored["category"] == q["category"]
            assert not stored.get("prepared_answer") and not stored.get("key_talking_points")
