# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The Lakehouse Lab on the real Delta engine (lakehouse-lab-plan.md Phase 1A).

Skipped unless `deltalake` is installed (requirements-lab.txt). Run with:

    pytest -m lab

in an environment that has it. Each finding of the Phase 0 spike (design §10) is
re-asserted here through the real API, against a lab folder whose path has
spaces in it (conftest redirects PREPBENCH_LAB_DIR to one).
"""
import sys
import time

import pytest

deltalake = pytest.importorskip("deltalake")

from app.core.config import LAB_DIR, lab_path  # noqa: E402
from app.services.lab import dataset_service, engine, operations, pack_service  # noqa: E402

pytestmark = pytest.mark.lab

PACK = "semiconductor-v1"


@pytest.fixture
def lab(client):
    """A clean lab folder for this pack, and a way to run operations."""
    assert client.post(f"/api/v1/lab/lakehouse/packs/{PACK}/reset").status_code == 200

    def op(**body):
        res = client.post("/api/v1/lab/lakehouse/ops", json={"pack_id": PACK, **body})
        assert res.status_code == 200, res.text
        return res.json()

    return op


def _dup(table: str) -> int:
    path = lab_path(PACK, table)
    return engine.query("SELECT COUNT(*) - COUNT(DISTINCT defect_id) AS d FROM t", {"t": (path, None)})[0]["d"]


def _manifest(defect_id: str) -> dict:
    return next(m for m in dataset_service.generate(pack_service.get_pack(PACK)).manifest if m["id"] == defect_id)


def test_the_engine_reports_its_version(client):
    body = client.get("/api/v1/lab/lakehouse/engine").json()
    assert body["available"] is True
    assert body["version"] == deltalake.__version__


def test_create_writes_real_typed_tables_under_a_path_with_spaces_without_pyarrow(lab):
    assert " " in str(LAB_DIR)
    res = lab(op="create_table", table="silver.defects")
    assert res["ok"] and res["version"] == 0 and res["rows"] == 5000
    assert "pyarrow" not in sys.modules
    fields = {f.name: str(f.type) for f in deltalake.DeltaTable(str(lab_path(PACK, "silver.defects"))).schema().fields}
    assert "decimal(10,4)" in fields["yield_pct"].lower() or "decimal(10, 4)" in fields["yield_pct"].lower()
    assert "timestamp" in fields["inspected_at"].lower()
    assert "ntz" not in fields["inspected_at"].lower()   # a UTC timestamp, not a local one

    bronze = lab(op="create_table", table="bronze.defects")
    assert bronze["rows"] == 1000 and bronze["data"]["loaded"] == "batch 1"


def test_schema_enforcement_refuses_a_drifted_batch_in_the_engines_own_words_and_evolution_accepts_it(client, lab):
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2)
    refused = lab(op="append_batch", table="bronze.defects", batch=3)
    assert refused["ok"] is False
    assert "Cannot cast schema, number of fields does not match" in refused["error"]
    assert refused["version"] == 1   # nothing was written

    evolved = lab(op="append_batch", table="bronze.defects", batch=3, schema_mode="merge")
    assert evolved["ok"] and evolved["version"] == 2 and evolved["rows"] == 3000
    assert "inspector_id" in evolved["data"]["columns"]

    journal = [e for e in client.get("/api/v1/lab/lakehouse/journal", params={"pack_id": PACK}).json()
               if e["op"] == "append_batch"][-2:]
    assert [e["source"] for e in journal] == ["real_engine", "real_engine"]
    assert journal[0]["result"]["ok"] is False and "Cannot cast schema" in journal[0]["result"]["error"]


def test_a_replayed_batch_duplicates_on_append_and_not_through_merge(lab):
    replayed = _manifest("replay")["count"]
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2)
    again = lab(op="append_batch", table="bronze.defects", batch=2)
    assert again["rows"] == 3000
    assert _dup("bronze.defects") == replayed

    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2, write="merge")
    merged = lab(op="append_batch", table="bronze.defects", batch=2, write="merge")
    assert merged["rows"] == 2000
    assert _dup("bronze.defects") == 0
    assert merged["data"]["merge"]["num_target_rows_inserted"] == 0


def test_merge_applies_the_change_batch(lab):
    cdc = _manifest("cdc")
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2)
    res = lab(op="merge_cdc", table="bronze.defects")
    merge = res["data"]["merge"]
    assert (merge["num_target_rows_inserted"], merge["num_target_rows_updated"], merge["num_target_rows_deleted"]) == (
        len(cdc["inserts"]), len(cdc["updates"]), len(cdc["deletes"]),
    )
    assert res["rows"] == 2000 + len(cdc["inserts"]) - len(cdc["deletes"])
    left = engine.query(f"SELECT COUNT(*) AS n FROM t WHERE defect_id IN ({', '.join(map(str, cdc['deletes']))})",
                        {"t": (lab_path(PACK, "bronze.defects"), None)})[0]["n"]
    assert left == 0


def test_history_time_travel_and_restore(lab):
    lab(op="create_table", table="bronze.defects")
    lab(op="append_batch", table="bronze.defects", batch=2)
    lab(op="merge_cdc", table="bronze.defects")
    history = lab(op="history", table="bronze.defects")["data"]["history"]
    assert [h["version"] for h in history][:3] == [2, 1, 0]
    assert history[0]["operation"] == "MERGE"

    v0 = lab(op="read_version", table="bronze.defects", version=0, sample=3)
    assert v0["ok"] and v0["rows"] == 1000 and len(v0["data"]["sample"]) == 3
    assert v0["data"]["sample"][0]["defect_id"] == "1"

    restored = lab(op="restore", table="bronze.defects", version=0)
    assert restored["ok"] and restored["version"] == 3 and restored["rows"] == 1000


def test_many_small_files_are_compacted(lab):
    lab(op="create_table", table="bronze.telemetry")
    started = time.perf_counter()
    landed = lab(op="append_batch", table="bronze.telemetry", batch=4, small_files=True)
    small_files = _manifest("small-files")["files"]
    assert landed["data"]["writes"] == small_files
    assert landed["files"] >= small_files + 1
    compacted = lab(op="compact", table="bronze.telemetry")
    assert compacted["data"]["files_before"] == landed["files"]
    assert compacted["data"]["files_after"] < compacted["data"]["files_before"]
    assert compacted["rows"] == landed["rows"]
    assert time.perf_counter() - started < 60   # the design's budget is 15 s; generous for CI
    z = lab(op="compact", table="bronze.telemetry", z_order=["tool_id"])
    assert z["ok"]


def test_vacuum_is_refused_under_the_retention_window_then_breaks_time_travel(lab):
    lab(op="create_table", table="bronze.defects")
    lab(op="merge_cdc", table="bronze.defects")          # rewrites version 0's file
    dry = lab(op="vacuum", table="bronze.defects", retention_hours=0, dry_run=True, enforce_retention=False)
    assert dry["ok"] and dry["data"]["files_removed"] == 0 and dry["data"]["files_that_would_be_removed"] >= 1
    assert "nothing was deleted" in dry["data"]["note"]
    assert lab(op="read_version", table="bronze.defects", version=0)["ok"] is True   # still readable

    refused = lab(op="vacuum", table="bronze.defects", retention_hours=0, dry_run=False)
    assert refused["ok"] is False and "minimum retention for vacuum" in refused["error"]

    done = lab(op="vacuum", table="bronze.defects", retention_hours=0, dry_run=False, enforce_retention=False)
    assert done["ok"] and done["data"]["files_removed"] >= 1 and "turned off" in done["data"]["note"]

    gone = lab(op="read_version", table="bronze.defects", version=0)
    assert gone["ok"] is False and gone["error"]
    # A count alone must fail too: on 1.6.6 COUNT(*) is answered from the log's
    # statistics without reading a file, so the lab counts by reading a column.
    count_only = lab(op="read_version", table="bronze.defects", version=0, sample=0)
    assert count_only["ok"] is False and "Parquet" in count_only["error"]
    # The learner's home folder never reaches the result or the exportable journal.
    assert str(LAB_DIR.resolve().as_posix()) not in count_only["error"] and "<lab>" in count_only["error"]
    stats_only = engine.query("SELECT COUNT(*) AS n FROM t", {"t": (lab_path(PACK, "bronze.defects"), 0)})
    assert stats_only[0]["n"] == 1000   # the trap the lab avoids
    # Why every count goes through SQL: the log still "knows" version 0's rows.
    assert deltalake.DeltaTable(str(lab_path(PACK, "bronze.defects")), version=0).count() == 1000


def test_compare_finds_exactly_the_planted_differences(lab, monkeypatch):
    monkeypatch.setattr(operations, "KEY_LIST_LIMIT", 100_000)
    lab(op="create_table", table="legacy.defects")
    lab(op="create_table", table="silver.defects")
    res = lab(op="compare_tables", left="legacy.defects", right="silver.defects")
    data = res["data"]
    assert data["row_counts"] == {"left": 5000, "right": 5000} and data["row_counts_match"]
    assert data["values_match"] is False

    planted = {m["column"]: m["keys"] for m in dataset_service.generate(pack_service.get_pack(PACK)).manifest
               if m["table"] == "defects" and m["kind"] in ("precision", "timezone", "null_handling")}
    found = {c: m["keys"] for c, m in data["mismatches"].items() if m["count"]}
    assert found == planted
    assert data["mismatches"]["inspected_at"]["largest_difference"] == str(8 * 3600)

    # Aggregates alone would pass a real difference: the null-vs-zero rows leave
    # the sum untouched. Only the null count and the key join see them.
    scrap = data["aggregates"]["scrap_qty"]
    assert scrap["left"]["sum"] == scrap["right"]["sum"]
    assert (scrap["left"]["nulls"], scrap["right"]["nulls"]) == (0, len(planted["scrap_qty"]))


def test_reset_deletes_the_lab_folder_after_engine_use_and_keeps_the_journal(client, lab):
    lab(op="create_table", table="bronze.defects")
    lab(op="history", table="bronze.defects")
    before = len(client.get("/api/v1/lab/lakehouse/journal", params={"pack_id": PACK}).json())
    res = client.post(f"/api/v1/lab/lakehouse/packs/{PACK}/reset").json()
    assert res["removed"] is True
    assert not (LAB_DIR / PACK).exists()
    # The journal is kept, and a reset isn't an engine run, so it adds nothing.
    assert len(client.get("/api/v1/lab/lakehouse/journal", params={"pack_id": PACK}).json()) == before


def test_an_operation_after_a_committed_prediction_is_run_and_linked(client, lab):
    import uuid

    uid = f"lab-{uuid.uuid4().hex[:12]}"
    client.post("/api/v1/learning/attempts", json={"attempt_uid": uid, "challenge_id": "lakehouse.c.create", "concept_id": "lakehouse/create"})
    client.patch(f"/api/v1/learning/attempts/{uid}", json={"prediction": "1000"})
    res = lab(op="create_table", table="bronze.defects", attempt_uid=uid)
    assert res["ok"]
    entry = next(e for e in client.get("/api/v1/lab/lakehouse/journal").json() if e["entry_uid"] == res["journal_uid"])
    assert entry["attempt_uid"] == uid and entry["source"] == "real_engine"


def test_a_small_files_batch_that_fails_part_way_reports_what_landed(lab, monkeypatch):
    lab(op="create_table", table="bronze.telemetry")
    real_write, calls = engine.write, {"n": 0}

    def fail_on_third(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 3:
            raise RuntimeError("disk full (simulated failure for the test)")
        return real_write(*args, **kwargs)

    monkeypatch.setattr(engine, "write", fail_on_third)
    res = lab(op="append_batch", table="bronze.telemetry", batch=4, small_files=True)
    assert res["ok"] is False
    assert res["data"]["writes_committed"] == 2
    assert res["version"] == 2   # two small writes landed before the failure
