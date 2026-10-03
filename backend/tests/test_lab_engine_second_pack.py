# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The JD-PO-005 pack on the real Delta engine (lakehouse-lab-plan.md P1-3).

The claim being proved is the PRD's Goal 5: a second pack is content, not code. So every operation
Station C offers is run here against a pack the code has never been changed for, and the numbers
asserted come from the pack's own manifest, never from the semiconductor pack's figures.

The risk in this pack that the first one didn't carry is text: Arabic script and Hijri-format
strings have to survive the pack file, the generator, the staging table, a real Delta write and a
read back through SQL, unchanged. They are compared character for character.

Skipped unless `deltalake` is installed. Run with `pytest -m lab` in an environment that has it.
"""
import pytest

deltalake = pytest.importorskip("deltalake")

from app.core.config import lab_path  # noqa: E402
from app.services.lab import dataset_service, engine, operations, pack_service  # noqa: E402

pytestmark = pytest.mark.lab

PACK = "jd-po-005-v1"


@pytest.fixture
def lab(client):
    assert client.post(f"/api/v1/lab/lakehouse/packs/{PACK}/reset").status_code == 200

    def op(**body):
        res = client.post("/api/v1/lab/lakehouse/ops", json={"pack_id": PACK, **body})
        assert res.status_code == 200, res.text
        return res.json()

    return op


def _data():
    return dataset_service.generate(pack_service.get_pack(PACK))


def _planted(kind=None, defect_id=None):
    return [m for m in _data().manifest if m["table"] == "defects"
            and (kind is None or m["kind"] == kind) and (defect_id is None or m["id"] == defect_id)]


def _batch_sizes():
    return [len(b) for b in _data().tables["defects"].batches]


def test_the_engine_writes_the_pack_as_real_typed_tables(lab):
    rows = _data().tables["defects"].spec.rows
    res = lab(op="create_table", table="silver.defects")
    assert res["ok"] and res["version"] == 0 and res["rows"] == rows == 3000
    fields = {f.name: str(f.type).lower() for f in deltalake.DeltaTable(str(lab_path(PACK, "silver.defects"))).schema().fields}
    assert "decimal(12,4)" in fields["repair_cost_aed"].replace(" ", "")
    assert "timestamp" in fields["inspected_at"] and "ntz" not in fields["inspected_at"]
    assert "string" in fields["inspector_name_ar"]


def test_arabic_names_and_hijri_text_survive_a_real_delta_write_and_read_unchanged(lab):
    lab(op="create_table", table="silver.defects")
    expected = {r["defect_id"]: (r["inspector_name_ar"], r["reported_hijri_date"]) for r in _data().tables["defects"].clean}
    read = engine.query(
        "SELECT defect_id, inspector_name_ar, reported_hijri_date FROM t ORDER BY defect_id",
        {"t": (lab_path(PACK, "silver.defects"), None)},
    )
    assert len(read) == len(expected) == 3000
    assert {r["defect_id"]: (r["inspector_name_ar"], r["reported_hijri_date"]) for r in read} == expected
    # Not just equal as Python strings: the bytes the engine stored are the pack's own, in NFC, as typed.
    assert all(isinstance(n, str) and n == n.strip() and any("؀" <= ch <= "ۿ" for ch in n) for n, _ in expected.values())


def test_a_text_filter_on_arabic_script_finds_exactly_the_rows_the_data_says(lab):
    lab(op="create_table", table="silver.defects")
    name = "أحمد المنصوري"
    want = sorted(r["defect_id"] for r in _data().tables["defects"].clean if r["inspector_name_ar"] == name)
    assert want, "the pack's data has this inspector"
    got = engine.query("SELECT defect_id FROM t WHERE inspector_name_ar = 'أحمد المنصوري' ORDER BY defect_id",
                       {"t": (lab_path(PACK, "silver.defects"), None)})
    assert [r["defect_id"] for r in got] == want


def test_schema_enforcement_refuses_the_drifted_batch_and_evolution_accepts_it(lab):
    size1, size2, size3 = _batch_sizes()[:3]
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2)
    refused = lab(op="append_batch", table="bronze.defects", batch=3)
    assert refused["ok"] is False and "Cannot cast schema, number of fields does not match" in refused["error"]
    assert refused["version"] == 1
    evolved = lab(op="append_batch", table="bronze.defects", batch=3, schema_mode="merge")
    assert evolved["ok"] and evolved["rows"] == size1 + size2 + size3
    assert "inspector_id" in evolved["data"]["columns"]


def test_a_replayed_batch_duplicates_on_append_and_not_through_merge(lab):
    replayed = _planted("replay")[0]["count"]
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2)
    again = lab(op="append_batch", table="bronze.defects", batch=2)
    size1, size2 = _batch_sizes()[:2]
    assert again["rows"] == size1 + size2 + replayed
    dup = engine.query("SELECT COUNT(*) - COUNT(DISTINCT defect_id) AS d FROM t", {"t": (lab_path(PACK, "bronze.defects"), None)})[0]["d"]
    assert dup == replayed

    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2, write="merge")
    merged = lab(op="append_batch", table="bronze.defects", batch=2, write="merge")
    assert merged["rows"] == size1 + size2


def test_the_change_batch_is_applied_as_the_pack_describes_it(lab):
    cdc = _planted("cdc")[0]
    size1, size2 = _batch_sizes()[:2]
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2)
    res = lab(op="merge_cdc", table="bronze.defects")
    merge = res["data"]["merge"]
    assert merge["num_target_rows_inserted"] == len(cdc["inserts"])
    assert merge["num_target_rows_updated"] == len(cdc["updates"])
    assert merge["num_target_rows_deleted"] == len(cdc["deletes"])
    assert res["rows"] == size1 + size2 + len(cdc["inserts"]) - len(cdc["deletes"])


def test_compare_finds_exactly_the_planted_differences_including_the_aed_rounding(lab, monkeypatch):
    monkeypatch.setattr(operations, "KEY_LIST_LIMIT", 100_000)
    lab(op="create_table", table="legacy.defects")
    lab(op="create_table", table="silver.defects")
    data = lab(op="compare_tables", left="legacy.defects", right="silver.defects")["data"]
    assert data["row_counts"] == {"left": 3000, "right": 3000} and data["row_counts_match"]
    assert data["values_match"] is False

    planted = {m["column"]: m["keys"] for m in _planted() if m["kind"] in ("precision", "timezone", "null_handling")}
    found = {c: m["keys"] for c, m in data["mismatches"].items() if m["count"]}
    assert found == planted
    assert set(planted) == {"repair_cost_aed", "inspected_at", "scrap_qty"}
    assert len(planted["repair_cost_aed"]) == 180
    # Gulf Standard Time read as UTC is four hours out.
    assert data["mismatches"]["inspected_at"]["largest_difference"] == str(4 * 3600)
    # The Arabic names and the Hijri text are the same on both sides, row by row.
    assert data["mismatches"]["inspector_name_ar"]["count"] == 0
    assert data["mismatches"]["reported_hijri_date"]["count"] == 0


def test_a_manifest_missing_ids_leaves_exactly_that_many_rows_missing_on_this_pack_too(lab):
    ids = [r["defect_id"] for r in _data().tables["defects"].batches[1]]
    kept = ids[:-100]
    lab(op="create_table", table="legacy.defects")
    lab(op="create_table", table="bronze.defects")
    loaded = lab(op="append_batch", table="bronze.defects", batch=2, manifest=kept)
    assert loaded["ok"]
    cmp_ = lab(op="compare_tables", left="legacy.defects", right="bronze.defects", through_batch=2)["data"]
    size1, size2 = _batch_sizes()[:2]
    assert cmp_["row_counts"] == {"left": size1 + size2, "right": size1 + size2 - 100}
    assert cmp_["only_in_left"] == 100 and cmp_["duplicate_keys"] == {"left": 0, "right": 0}
