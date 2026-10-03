# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The Lakehouse Lab without its optional engine (lakehouse-lab-plan.md Phase 1A).

Everything here passes whether or not `deltalake` is installed: packs, the
dataset and its ground truth, path safety, the journal's rules, and the honest
"not installed" answer. The engine's own behaviour is in test_lab_engine.py.
"""
import ast
import importlib.util
import json
import sys
import uuid
from pathlib import Path

import pytest

from app.core.config import LAB_DIR, lab_path
from app.services.lab import dataset_service, engine, pack_service

PACK = "semiconductor-v1"
HAS_ENGINE = importlib.util.find_spec("deltalake") is not None


@pytest.fixture
def no_engine(monkeypatch):
    """The engine reported missing, whatever this environment has installed."""
    from app.schemas.lab import EngineStatus

    monkeypatch.setattr(engine, "status", lambda: EngineStatus(
        available=False, install_command=engine.INSTALL_COMMAND, detail="deltalake is not installed.",
    ))


# ---- optional, and isolated -------------------------------------------------------


def test_only_the_engine_module_imports_deltalake_and_only_inside_functions():
    """Importing the app never loads the optional engine: no module imports
    `deltalake` (or its `arro3` dependency) at import time, and engine.py -- the
    only one allowed to -- does it inside functions."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    offenders = []
    for py in app_dir.rglob("*.py"):
        tree = ast.parse(py.read_text(encoding="utf-8"))
        parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module]
            if not any(n.split(".")[0] in ("deltalake", "arro3", "pyarrow") for n in names):
                continue
            inside_function, up = False, parents.get(node)
            while up is not None:
                if isinstance(up, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    inside_function = True
                    break
                up = parents.get(up)
            if py.name != "engine.py" or not inside_function or any(n.startswith("pyarrow") for n in names):
                offenders.append(f"{py.relative_to(app_dir)}:{node.lineno}")
    assert offenders == []


@pytest.mark.skipif(HAS_ENGINE, reason="checked in-process only where the engine isn't installed")
def test_the_running_app_has_not_loaded_deltalake(client):
    client.get("/api/v1/lab/lakehouse/engine")
    assert "deltalake" not in sys.modules and "pyarrow" not in sys.modules


def test_the_lab_folder_is_redirected_for_tests():
    assert "prepbench test lab" in str(LAB_DIR)
    assert "backend" not in LAB_DIR.resolve().parts[-3:]


def test_engine_status_never_errors_and_says_how_to_install(client):
    res = client.get("/api/v1/lab/lakehouse/engine")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is HAS_ENGINE
    assert "requirements-lab.txt" in body["install_command"]
    if not HAS_ENGINE:
        assert body["version"] is None


def test_every_operation_is_503_without_the_engine_and_nothing_is_journaled(client, no_engine):
    before = len(client.get("/api/v1/lab/lakehouse/journal", params={"pack_id": PACK}).json())
    ops = [
        {"op": "create_table", "table": "bronze.defects"},
        {"op": "append_batch", "table": "bronze.defects", "batch": 2},
        {"op": "merge_cdc", "table": "bronze.defects"},
        {"op": "history", "table": "bronze.defects"},
        {"op": "read_version", "table": "bronze.defects", "version": 0},
        {"op": "restore", "table": "bronze.defects", "version": 0},
        {"op": "compact", "table": "bronze.telemetry"},
        {"op": "vacuum", "table": "bronze.defects", "retention_hours": 168},
        {"op": "compare_tables", "left": "legacy.defects", "right": "silver.defects"},
    ]
    for op in ops:
        res = client.post("/api/v1/lab/lakehouse/ops", json={"pack_id": PACK, **op})
        assert res.status_code == 503, (op, res.text)
        detail = res.json()["detail"]
        assert "requirements-lab.txt" in detail["install_command"]
        assert "nothing is simulated" in detail["message"]
    assert len(client.get("/api/v1/lab/lakehouse/journal", params={"pack_id": PACK}).json()) == before


def test_misuse_is_400_before_the_engine_is_asked(client, no_engine):
    post = lambda body: client.post("/api/v1/lab/lakehouse/ops", json={"pack_id": PACK, **body})  # noqa: E731
    assert post({"op": "history", "table": "gold.defects"}).status_code == 400
    assert post({"op": "history", "table": "../../exam_simulator"}).status_code == 400
    assert post({"op": "drop_table", "table": "bronze.defects"}).status_code == 422
    assert post({"op": "history", "table": "bronze.defects", "sql": "DROP"}).status_code == 422
    assert client.post("/api/v1/lab/lakehouse/ops", json={"pack_id": "no-such-pack", "op": "history", "table": "bronze.defects"}).status_code == 404


def test_an_operation_tied_to_an_uncommitted_prediction_is_refused(client, no_engine):
    uid = f"lab-{uuid.uuid4().hex[:12]}"
    client.post("/api/v1/learning/attempts", json={
        "attempt_uid": uid, "challenge_id": "lakehouse.c.replay", "concept_id": "lakehouse/replay",
    })
    res = client.post("/api/v1/lab/lakehouse/ops", json={
        "pack_id": PACK, "op": "append_batch", "table": "bronze.defects", "batch": 2, "attempt_uid": uid,
    })
    assert res.status_code == 400
    assert "prediction" in res.json()["detail"].lower()
    missing = client.post("/api/v1/lab/lakehouse/ops", json={
        "pack_id": PACK, "op": "history", "table": "bronze.defects", "attempt_uid": "no-such-attempt",
    })
    assert missing.status_code == 400


# ---- path safety (P0-3) -----------------------------------------------------------


@pytest.mark.parametrize("pack_id, table", [
    (PACK, "../escape"),
    (PACK, "bronze/../../x"),
    (PACK, "bronze..defects"),
    (PACK, "bronze.defects/../../x"),
    (PACK, "C:\\Windows.system32"),
    (PACK, "/etc.passwd"),
    ("../other", "bronze.defects"),
    ("C:\\", "bronze.defects"),
    (PACK, "Bronze.Defects"),
    (PACK, "bronze"),
])
def test_lab_path_refuses_anything_that_isnt_a_plain_layer_and_table(pack_id, table):
    with pytest.raises(ValueError):
        lab_path(pack_id, table)


def test_lab_path_stays_inside_the_lab_folder():
    path = lab_path(PACK, "bronze.defects")
    assert LAB_DIR.resolve() in path.parents
    assert path.parts[-3:] == (PACK, "bronze", "defects")


# ---- packs (P0-1) -----------------------------------------------------------------


def test_the_shipped_pack_loads_and_is_fictional(client):
    packs = {p["id"]: p for p in client.get("/api/v1/lab/lakehouse/packs").json()}
    assert PACK in packs                  # other packs may ship beside it (see test_lab_packs.py)
    assert packs[PACK]["fictional"] is True
    assert packs[PACK]["notebook_verified_on"] is None
    detail = client.get(f"/api/v1/lab/lakehouse/packs/{PACK}").json()
    assert "Fictional" in detail["scenario_md"]
    assert set(detail["tables"]) == {f"{l}.{t}" for l in ("legacy", "bronze", "silver") for t in ("defects", "telemetry")}
    assert {d["id"] for d in detail["defect_manifest"]} == {
        "precision", "tz-shift", "null-scrap", "drift", "cdc", "replay", "late", "small-files",
    }
    assert client.get("/api/v1/lab/lakehouse/packs/nope").status_code == 404


def test_the_open_question_9_decisions_are_in_the_pack():
    factory = pack_service.get_pack(PACK).factory
    assert factory["teaching_constants"]["job_cluster_vs_all_purpose_cost_ratio"]["value"] == 0.5
    assert "Illustrative" in factory["teaching_constants"]["job_cluster_vs_all_purpose_cost_ratio"]["label"]
    assert (factory["budget"]["low_usd_millions"], factory["budget"]["high_usd_millions"]) == (10.5, 13)
    assert [w["domain"] for w in factory["waves"]][2] == "Finance"
    assert factory["waves"][2]["waves"] == [7, 8, 9]


def test_the_factory_content_agrees_with_the_pack_it_ships_in():
    """Station F reads this content in the browser, so a slip here is a wrong screen, not an error.
    Checked here against the pack's own dataset and wave plan."""
    pack = pack_service.get_pack(PACK)
    factory = pack.factory
    assert factory["stub"] is False
    domains = factory["domains"]

    # One domain per slot of the wave plan, and the slots' waves are 1..12 once each.
    assert len(domains) == len(factory["waves"])
    assert sorted(w for slot in factory["waves"] for w in slot["waves"]) == list(range(1, 13))
    assert sorted(w for d in domains for w in d["waves"]) == list(range(1, 13))

    # The yield wave's Validate step compares two real lab tables.
    compared = [d["validate_compare"] for d in domains if "validate_compare" in d]
    assert len(compared) == 1
    for table in (compared[0]["left"], compared[0]["right"]):
        assert table in pack.tables()

    # Every job's signals are described, and every tier is reachable by the rules.
    described = set(factory["signals"])
    assert all(set(job["signals"]) <= described for job in factory["tiering_sample"])
    rules = factory["tier_rules"]
    assert {r["tier"] for r in rules} == {1, 2, 3}
    assert rules[-1]["any_of"] == []  # "everything else" comes last, so every job gets a tier
    assert all(set(r["any_of"]) <= described for r in rules)

    # Effort and job counts are defined for every tier, and every constant is labelled as a teaching constant.
    assert set(factory["teaching_constants"]["effort_per_job_by_tier"]["value"]) == {"1", "2", "3"}
    assert all(set(d["jobs_by_tier"]) == {"1", "2", "3"} for d in domains)
    for name, constant in factory["teaching_constants"].items():
        assert constant["label"], name

    # The event schedule is fixed content: scheduled months, a freeze window that runs forwards.
    assert factory["events"]["hidden_inventory"]["month"] >= 1
    assert factory["events"]["change_freeze"]["to_month"] > factory["events"]["change_freeze"]["from_month"]


def _copy_pack(tmp_path, mutate):
    src = pack_service.PACKS_DIR / PACK
    dst = tmp_path / "packs" / PACK
    dst.mkdir(parents=True)
    for f in src.iterdir():
        (dst / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
    mutate(dst)
    return tmp_path / "packs"


@pytest.mark.parametrize("mutate", [
    lambda d: (d / "dataset.json").write_text("{not json", encoding="utf-8"),
    lambda d: (d / "manifest.json").write_text(json.dumps({**json.loads((d / "manifest.json").read_text()), "fictional": False}), encoding="utf-8"),
    lambda d: (d / "dataset.json").write_text(json.dumps({"tables": {}, "defects": [{"id": "x", "kind": "replay", "table": "nope"}]}), encoding="utf-8"),
    lambda d: (d / "scenario.md").unlink(),
])
def test_a_broken_pack_is_skipped_with_a_log_not_fatal(tmp_path, mutate, caplog):
    base = _copy_pack(tmp_path, mutate)
    pack_service.clear_cache()
    try:
        assert pack_service.list_packs(base) == []
        assert any("Skipping lab pack" in r.message for r in caplog.records)
    finally:
        pack_service.clear_cache()


# ---- the dataset and its ground truth (P0-1) -------------------------------------


def _dump(d: dataset_service.Dataset) -> str:
    return json.dumps(
        {k: [v.clean, v.legacy, v.batches, v.cdc] for k, v in d.tables.items()}, sort_keys=True,
    ) + json.dumps(d.manifest, sort_keys=True)


def test_the_same_seed_gives_byte_identical_data():
    pack = pack_service.get_pack(PACK)
    first = dataset_service._generate(pack.manifest.seed, pack.dataset)
    second = dataset_service._generate(pack.manifest.seed, pack.dataset)
    assert _dump(first) == _dump(second)
    other = dataset_service._generate(pack.manifest.seed + 1, pack.dataset)
    assert _dump(first) != _dump(other)


def test_legacy_and_clean_differ_in_exactly_the_manifests_rows_and_columns():
    pack = pack_service.get_pack(PACK)
    d = dataset_service.generate(pack)
    for name, table in d.tables.items():
        expected = {}
        for m in d.manifest:
            if m["table"] == name and m["kind"] in ("precision", "timezone", "null_handling"):
                expected[m["column"]] = set(m["keys"])
        found = {}
        for clean, legacy in zip(table.clean, table.legacy):
            for col in clean:
                if clean[col] != legacy[col]:
                    found.setdefault(col, set()).add(clean[table.key])
        assert found == expected, name
        assert len(table.clean) == len(table.legacy)   # row counts match; values don't


def test_the_batch_patterns_are_what_the_manifest_says():
    pack = pack_service.get_pack(PACK)
    d = dataset_service.generate(pack)
    m = {x["id"]: x for x in d.manifest}
    defects = d.tables["defects"]
    assert sum(len(b) for b in defects.batches) == len(defects.clean)
    assert "inspector_id" not in {c.name for c in defects.batch_columns[1]}
    assert "inspector_id" in {c.name for c in defects.batch_columns[2]}
    assert m["replay"]["keys"] == [r["defect_id"] for r in defects.batches[1]]
    cdc_ops = {r["defect_id"]: r["op"] for r in defects.cdc}
    assert sorted(k for k, v in cdc_ops.items() if v == "U") == m["cdc"]["updates"]
    assert sorted(k for k, v in cdc_ops.items() if v == "D") == m["cdc"]["deletes"]
    assert min(m["cdc"]["inserts"]) > max(r["defect_id"] for r in defects.clean)
    telemetry = d.tables["telemetry"]
    late = set(m["late"]["keys"])
    assert late <= {r["event_id"] for r in telemetry.batches[2]}
    assert not late & {r["event_id"] for r in telemetry.batches[1]}
    window_end = max(r["event_time"] for r in telemetry.batches[1])
    assert all(r["event_time"] <= window_end for r in telemetry.batches[2] if r["event_id"] in late)


def test_the_source_index_and_csv_downloads(client):
    index = client.get(f"/api/v1/lab/lakehouse/packs/{PACK}/source-index").json()
    assert len(index) == 5000
    assert index[0]["modified_at"].endswith("Z")
    assert sum(r["deleted"] for r in index) == 10
    csv = client.get(f"/api/v1/lab/lakehouse/packs/{PACK}/dataset/defects.csv", params={"copy": "legacy"})
    assert csv.status_code == 200
    assert 'filename="defects_legacy.csv"' in csv.headers["content-disposition"]
    lines = csv.text.strip().split("\n")
    assert lines[0] == "defect_id,lot_id,tool_id,defect_type,defect_count,yield_pct,scrap_qty,inspected_at"
    assert len(lines) == 5001
    assert client.get(f"/api/v1/lab/lakehouse/packs/{PACK}/dataset/nope.csv").status_code == 404


def test_the_notebook_is_databricks_source_and_says_it_is_unverified(client):
    res = client.get(f"/api/v1/lab/lakehouse/packs/{PACK}/notebook", params={"station": "c"})
    assert res.status_code == 200
    text = res.text
    assert text.startswith("# Databricks notebook source\n")
    assert "# COMMAND ----------" in text
    assert "# MAGIC %sql" in text
    assert "UNVERIFIED" in text
    for step in ("MERGE INTO", "DESCRIBE HISTORY", "VERSION AS OF", "RESTORE TABLE", "OPTIMIZE", "VACUUM", "mergeSchema", "Volume"):
        assert step in text, step


# ---- the journal (P0-10) ----------------------------------------------------------


def test_the_journal_is_append_only(client):
    paths = client.get("/api/v1/openapi.json").json()["paths"]
    methods = {m.upper() for p, ops in paths.items() if p.startswith("/api/v1/lab/lakehouse/journal") for m in ops}
    assert "PUT" not in methods and "PATCH" not in methods
    assert {"GET", "POST", "DELETE"} <= methods


def test_a_client_cannot_post_a_real_engine_entry(client):
    res = client.post("/api/v1/lab/lakehouse/journal", json={
        "pack_id": PACK, "station": "c", "source": "real_engine", "op": "merge_cdc", "result": {"version": 9},
    })
    assert res.status_code == 400


def test_simulation_entries_are_kept_listed_exported_and_deletable(client):
    uid = f"sim-{uuid.uuid4().hex[:12]}"
    body = {"entry_uid": uid, "pack_id": PACK, "station": "a", "op": "watermark_order", "result": {"missed": 260}}
    first = client.post("/api/v1/lab/lakehouse/journal", json=body)
    again = client.post("/api/v1/lab/lakehouse/journal", json=body)
    assert first.status_code == 201 and again.status_code == 201
    assert first.json()["source"] == "simulation"
    listed = [e for e in client.get("/api/v1/lab/lakehouse/journal", params={"pack_id": PACK}).json() if e["entry_uid"] == uid]
    assert len(listed) == 1

    md = client.get("/api/v1/lab/lakehouse/journal/export.md", params={"pack_id": PACK}).text
    assert md.startswith("# Lakehouse Lab journal")
    assert "Simulation · station A · `watermark_order`" in md

    assert client.delete(f"/api/v1/lab/lakehouse/journal/{uid}").status_code == 204
    assert client.delete(f"/api/v1/lab/lakehouse/journal/{uid}").status_code == 404


def test_reset_works_without_the_engine_and_keeps_the_journal(client, no_engine):
    uid = f"sim-{uuid.uuid4().hex[:12]}"
    client.post("/api/v1/lab/lakehouse/journal", json={"entry_uid": uid, "pack_id": PACK, "station": "b", "op": "rename"})
    res = client.post(f"/api/v1/lab/lakehouse/packs/{PACK}/reset")
    assert res.status_code == 200, res.text
    assert not (LAB_DIR / PACK).exists()
    assert uid in {e["entry_uid"] for e in client.get("/api/v1/lab/lakehouse/journal").json()}


def test_the_journal_migration_creates_the_table_like_a_fresh_install(tmp_path, monkeypatch):
    import sqlite3

    from sqlalchemy import create_engine, text

    from app.core.database import Base, register_sqlite_pragmas
    import app.core.database as database_module

    path = tmp_path / "legacy.db"
    sqlite3.connect(path).close()
    legacy = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(legacy)
    monkeypatch.setattr(database_module, "engine", legacy)
    database_module.apply_lightweight_migrations()
    database_module.apply_lightweight_migrations()

    fresh = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    Base.metadata.create_all(bind=fresh)
    cols = lambda e: {r[1] for r in e.connect().execute(text("PRAGMA table_info(lab_journal_entries)")).fetchall()}  # noqa: E731
    try:
        assert cols(legacy) and cols(legacy) == cols(fresh)
    finally:
        legacy.dispose()
        fresh.dispose()


# ---- Station A's manifest and the source index (Phase 3), without the engine -----------


def test_the_source_index_says_which_batch_each_row_arrives_in():
    rows = dataset_service.source_index(pack_service.get_pack(PACK), "defects")
    assert len(rows) == 5000
    by_batch = {}
    for r in rows:
        by_batch.setdefault(r["batch"], []).append(r["id"])
    assert sorted(by_batch) == [1, 2, 3, 4, 5]
    assert all(len(ids) == 1000 for ids in by_batch.values())
    assert by_batch[2][0] == 1001 and by_batch[2][-1] == 2000     # contiguous ids per batch
    # The simulations depend on time never running backwards across the id order.
    stamps = [r["modified_at"] for r in rows]
    assert stamps == sorted(stamps)


def test_the_manifest_and_through_batch_fields_are_bounded():
    from pydantic import ValidationError
    from app.schemas.lab import AppendBatchOp, CompareTablesOp
    ok = AppendBatchOp(pack_id=PACK, op="append_batch", table="bronze.defects", batch=2, manifest=[1, 2, 2])
    assert ok.manifest == [1, 2, 2]
    with pytest.raises(ValidationError):
        AppendBatchOp(pack_id=PACK, op="append_batch", table="bronze.defects", batch=2, manifest=[])
    with pytest.raises(ValidationError):
        AppendBatchOp(pack_id=PACK, op="append_batch", table="bronze.defects", batch=2, manifest=list(range(50_001)))
    assert CompareTablesOp(pack_id=PACK, op="compare_tables", left="a.b", right="c.b", through_batch=2).through_batch == 2
    with pytest.raises(ValidationError):
        CompareTablesOp(pack_id=PACK, op="compare_tables", left="a.b", right="c.b", through_batch=0)


def test_a_manifest_materialises_exactly_the_rows_it_names_in_order():
    from app.schemas.lab import AppendBatchOp
    from app.services.lab import operations
    pack = pack_service.get_pack(PACK)
    data = dataset_service.generate(pack).tables["defects"]
    cols = data.batch_columns[1]
    op = AppendBatchOp(pack_id=PACK, op="append_batch", table="bronze.defects", batch=2, manifest=[1003, 1001, 1003])
    rows, info = operations._manifest_rows(data, op, cols)
    assert [r["defect_id"] for r in rows] == [1003, 1001, 1003]         # a repeat is written twice
    assert info == {"requested": 3, "distinct": 2, "written": 3}
    merge = op.model_copy(update={"write": "merge"})
    rows, info = operations._manifest_rows(data, merge, cols)
    assert [r["defect_id"] for r in rows] == [1003, 1001]               # a merge is given each id once
    assert info == {"requested": 3, "distinct": 2, "written": 2}


def test_a_manifest_naming_unknown_ids_or_a_different_schema_is_misuse():
    from fastapi import HTTPException
    from app.schemas.lab import AppendBatchOp
    from app.services.lab import operations
    pack = pack_service.get_pack(PACK)
    data = dataset_service.generate(pack).tables["defects"]
    cols = data.batch_columns[1]
    unknown = AppendBatchOp(pack_id=PACK, op="append_batch", table="bronze.defects", batch=2, manifest=[1001, 424242])
    with pytest.raises(HTTPException) as e:
        operations._manifest_rows(data, unknown, cols)
    assert e.value.status_code == 400 and "424242" in e.value.detail
    mixed = AppendBatchOp(pack_id=PACK, op="append_batch", table="bronze.defects", batch=2, manifest=[1001, 2500])
    with pytest.raises(HTTPException) as e:
        operations._manifest_rows(data, mixed, cols)
    assert e.value.status_code == 400 and "differ" in e.value.detail
