# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Station D, the Reconciliation Detective (lakehouse P1-2): every planted defect can be shown by
the engine's own result, using only the operations that already exist.

The browser grades a claim against the result the learner cites (services/lakehouse/stationD.ts).
These tests pin the other half: that each result it reads really has the fields and values the
grader looks at, so a defect that can't be shown fails here rather than in front of the learner.

Skipped unless `deltalake` is installed (requirements-lab.txt); run with `pytest -m lab`.
"""
import pytest

deltalake = pytest.importorskip("deltalake")

from app.services.lab import dataset_service, pack_service  # noqa: E402

pytestmark = pytest.mark.lab

PACK = "semiconductor-v1"


@pytest.fixture
def lab(client):
    assert client.post(f"/api/v1/lab/lakehouse/packs/{PACK}/reset").status_code == 200

    def op(**body):
        res = client.post("/api/v1/lab/lakehouse/ops", json={"pack_id": PACK, **body})
        assert res.status_code == 200, res.text
        return res.json()

    return op


def _truth() -> dict:
    return {m["id"]: m for m in dataset_service.generate(pack_service.get_pack(PACK)).manifest}


def _build(lab, table: str, through: int) -> None:
    lab(op="create_table", table=f"legacy.{table}")
    lab(op="create_table", table=f"bronze.{table}")
    # Creating a bronze table loads batch 1 already.
    for b in range(2, through + 1):
        lab(op="append_batch", table=f"bronze.{table}", batch=b, write="append", schema_mode="merge")


def test_the_pack_offers_station_d(client):
    stations = client.get(f"/api/v1/lab/lakehouse/packs/{PACK}").json()["stations"]
    assert "d" in stations


def test_the_pack_plants_eight_defects_and_the_manifest_names_each(client):
    detail = client.get(f"/api/v1/lab/lakehouse/packs/{PACK}").json()
    planted = {d["id"] for d in detail["dataset"]["defects"]}
    assert {m["id"] for m in detail["defect_manifest"]} == planted
    assert len(planted) == 8


@pytest.mark.parametrize("defect,column", [("precision", "yield_pct"), ("tz-shift", "inspected_at"), ("null-scrap", "scrap_qty")])
def test_a_value_defect_shows_in_the_compare_of_its_column_and_only_on_planted_keys(lab, defect, column):
    _build(lab, "defects", 5)
    result = lab(op="compare_tables", left="legacy.defects", right="bronze.defects", tolerance=0.0001)
    assert result["ok"]
    mismatch = result["data"]["mismatches"][column]
    assert mismatch["count"] > 0
    assert set(mismatch["keys"]) <= set(_truth()[defect]["keys"])


def test_row_counts_match_while_the_values_do_not(lab):
    _build(lab, "defects", 5)
    data = lab(op="compare_tables", left="legacy.defects", right="bronze.defects", tolerance=0.0001)["data"]
    assert data["row_counts_match"] is True
    assert data["values_match"] is False


def test_drift_shows_in_the_batch_columns_of_the_append_the_engine_refuses(lab):
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=1, write="append", schema_mode="enforce")
    refused = lab(op="append_batch", table="bronze.defects", batch=3, write="append", schema_mode="enforce")
    assert refused["ok"] is False
    assert "inspector_id" in refused["data"]["batch_columns"]
    truth = _truth()["drift"]
    assert refused["data"]["batch"] >= truth["batch"] and truth["column"] == "inspector_id"


def test_a_replayed_batch_shows_as_duplicate_keys_no_larger_than_the_batch(lab):
    lab(op="create_table", table="legacy.defects")
    lab(op="create_table", table="bronze.defects")
    for batch in (2, 2, 3, 4):
        lab(op="append_batch", table="bronze.defects", batch=batch, write="append", schema_mode="merge")
    data = lab(op="compare_tables", left="legacy.defects", right="bronze.defects", tolerance=0.0001)["data"]
    assert 0 < data["duplicate_keys"]["right"] <= _truth()["replay"]["count"]


def test_the_change_batch_reports_the_planted_counts(lab):
    _build(lab, "defects", 5)
    result = lab(op="merge_cdc", table="bronze.defects")
    truth = _truth()["cdc"]
    assert result["ok"]
    assert result["data"]["batch"] == {"I": len(truth["inserts"]), "U": len(truth["updates"]), "D": len(truth["deletes"])}


def test_late_arrivals_show_as_rows_only_in_the_legacy_copy_through_the_earlier_batch(lab):
    _build(lab, "telemetry", 2)
    truth = _truth()["late"]
    data = lab(op="compare_tables", left="legacy.telemetry", right="bronze.telemetry", tolerance=0.0001,
               through_batch=truth["from_batch"])["data"]
    assert 0 < data["only_in_left"] <= truth["count"]


def test_small_files_show_as_the_planted_number_of_writes_and_files(lab):
    _build(lab, "telemetry", 3)
    truth = _truth()["small-files"]
    landed = lab(op="append_batch", table="bronze.telemetry", batch=truth["batch"], write="append", small_files=True)
    assert landed["ok"] and landed["data"]["writes"] == truth["files"]
    compacted = lab(op="compact", table="bronze.telemetry")
    assert compacted["data"]["files_before"] >= truth["files"]
