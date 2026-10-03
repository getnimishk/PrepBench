# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The operation allow-list (design §4.4, PRD P0-4).

The client names an operation and a table from the pack; it never sends SQL or a
path. Three kinds of outcome, kept apart:
- misuse (a table the pack doesn't have, an attempt whose prediction isn't
  committed, a column that doesn't exist) -> 400, before the engine is touched;
- no engine installed -> 503, with the install command;
- anything the engine itself says no to (a schema rejection, a vacuumed version,
  a vacuum refused by the retention check) -> 200 with `ok: false` and the
  engine's own error. That refusal *is* the lesson, so it's a result.

Every call that reaches the engine is journaled by the server, as a real-engine
entry -- including the ones that failed.
"""
import shutil
import threading
import time
from contextlib import ExitStack
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import LAB_DIR, lab_pack_dir, lab_path
from app.core.exceptions import InvalidExamStateException, ResourceNotFoundException
from app.core.logging_config import logger
from app.repositories.learning_attempt_repository import LearningAttemptRepository
from app.schemas.lab import (
    AppendBatchOp, CompactOp, CompareTablesOp, CreateTableOp, HistoryOp, LabOperationResult, LabPack,
    LabResetResult, MergeCdcOp, ReadVersionOp, RestoreOp, VacuumOp,
)
from app.services.lab import dataset_service, engine, journal_service, pack_service

# At most this many keys are listed per mismatched column; the count is exact.
KEY_LIST_LIMIT = 50

_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _lock(path: Path) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(str(path), threading.Lock())


class _Outcome(dict):
    """What a handler hands back: ok, version, rows, files, error, data."""


def _misuse(message: str) -> InvalidExamStateException:
    return InvalidExamStateException(message)


def _engine_missing() -> HTTPException:
    st = engine.status()
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "message": "The real Delta engine isn't installed, so nothing was run. "
                       "Install it to run real operations; nothing is simulated in its place.",
            "install_command": st.install_command,
            "reason": st.detail,
        },
    )


def _require_pack(pack_id: str) -> LabPack:
    pack = pack_service.get_pack(pack_id)
    if pack is None:
        raise ResourceNotFoundException("Lab pack", pack_id)
    return pack


def _require_table(pack: LabPack, table: str) -> Path:
    if table not in pack.tables():
        raise _misuse(f"{table!r} isn't a table in pack {pack.manifest.id!r}. It has: {', '.join(pack.tables())}.")
    return lab_path(pack.manifest.id, table)


def _check_attempt(db: Session, attempt_uid: Optional[str]) -> None:
    """Predict before manipulate: an op tied to an attempt needs its prediction committed."""
    if not attempt_uid:
        return
    attempt = LearningAttemptRepository(db).get_by_uid(attempt_uid)
    if attempt is None:
        raise _misuse(f"No learning attempt {attempt_uid!r}. Start the attempt and commit a prediction first.")
    if attempt.committed_at is None:
        raise _misuse("Commit your prediction before running the operation. What you expect goes on the "
                      "record before what happens.")


def _dataset_table(pack: LabPack, table: str) -> dataset_service.TableData:
    return dataset_service.generate(pack).tables[table.split(".", 1)[1]]


def _staging(pack: LabPack) -> Path:
    root = lab_pack_dir(pack.manifest.id) / "_staging"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _count(path: Path, at_version: Optional[int] = None) -> int:
    """Rows, counted by reading a column of every file.

    Not COUNT(*): on deltalake 1.6.6 the query engine answers COUNT(*) (and
    SUM(1)) from the log's per-file statistics without opening a file, so a
    version whose files vacuum removed would still "have" its rows -- the
    wrong lesson (the spike's finding 1, one level down). An expression over a
    real column has to read the data, and fails when the files are gone.
    """
    col = engine.quote(engine.columns_of(path, at_version)[0])
    rows = engine.query(f"SELECT COALESCE(SUM(CASE WHEN {col} IS NULL THEN 1 ELSE 1 END), 0) AS n FROM t",
                        {"t": (path, at_version)})
    return int(rows[0]["n"])


def _not_created(table: str) -> _Outcome:
    return _Outcome(ok=False, error=f"Table {table} doesn't exist yet. Create it first.")


# ---- handlers ----------------------------------------------------------------------


def _create_table(pack: LabPack, op: CreateTableOp, path: Path) -> _Outcome:
    data = _dataset_table(pack, op.table)
    layer = op.table.split(".", 1)[0]
    if layer == "legacy":
        rows, columns, what = data.legacy, data.spec.columns, "the full legacy copy"
    elif layer == "silver":
        rows, columns, what = data.clean, data.spec.columns, "the full clean copy"
    else:
        rows, columns, what = data.batches[0], data.batch_columns[0], "batch 1"
    replaced = engine.exists(path)
    if replaced:
        shutil.rmtree(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    v = engine.write(path, _staging(pack), columns, rows, mode="overwrite")
    return _Outcome(ok=True, version=v, rows=_count(path), files=engine.file_count(path),
                    data={"loaded": what, "replaced_existing": replaced, "columns": [c.name for c in columns]})


def _manifest_rows(data: dataset_service.TableData, op: AppendBatchOp, columns) -> tuple:
    """The rows a batch manifest names, exactly, in its order (design §3, step 5).

    A repeated id is written twice by an append: that is the upstream mistake becoming
    real rows. A merge on the key is idempotent, so it is given each id once.
    """
    lookup = dataset_service.rows_by_key(data)
    unknown = sorted({i for i in op.manifest if i not in lookup})
    if unknown:
        raise _misuse(f"The manifest names ids the source doesn't have: {unknown[:5]}{' ...' if len(unknown) > 5 else ''}.")
    names = [c.name for c in columns]
    ids = list(dict.fromkeys(op.manifest)) if op.write == "merge" else list(op.manifest)
    rows = []
    for i in ids:
        arrives_in, row = lookup[i]
        if [c.name for c in data.batch_columns[arrives_in - 1]] != names:
            raise _misuse(
                f"Row {i} arrives in batch {arrives_in}, whose columns differ from batch {op.batch}'s. "
                "Name the batch whose schema the manifest's rows share.")
        rows.append(row)
    return rows, {"requested": len(op.manifest), "distinct": len(set(op.manifest)), "written": len(rows)}


def _append_batch(pack: LabPack, op: AppendBatchOp, path: Path) -> _Outcome:
    if not op.table.startswith("bronze."):
        raise _misuse("Batches are appended to a bronze table, where raw data lands.")
    data = _dataset_table(pack, op.table)
    if op.batch > len(data.batches):
        raise _misuse(f"{op.table} has {len(data.batches)} batches.")
    if op.small_files and op.write == "merge":
        raise _misuse("Small files are a pattern of many appends; choose append, not merge.")
    splits = None
    if op.small_files:
        splits = dataset_service.small_files_count(pack, op.table.split(".", 1)[1], op.batch)
        if not splits:
            raise _misuse(f"The pack doesn't land batch {op.batch} of {op.table} as small files.")
    if not engine.exists(path):
        return _not_created(op.table)

    columns = data.batch_columns[op.batch - 1]
    manifest_info: Optional[Dict[str, int]] = None
    if op.manifest is not None:
        if op.small_files:
            raise _misuse("A manifest is the exact list of rows to write; small files is a pattern of the pack's own batch.")
        rows, manifest_info = _manifest_rows(data, op, columns)
    else:
        rows = data.batches[op.batch - 1]
    staging = _staging(pack)
    committed = 0
    try:
        if op.write == "merge":
            metrics = engine.merge(path, staging, data.key, columns, rows, cdc=False)
            committed = 1
        else:
            size = -(-len(rows) // splits) if splits else len(rows)
            chunks = [rows[i:i + size] for i in range(0, len(rows), size)] if splits else [rows]
            for chunk in chunks:
                engine.write(path, staging, columns, chunk, mode="append", schema_mode=op.schema_mode)
                committed += 1
            metrics = {}
        writes = committed
    except engine.EngineUnavailable:
        raise
    except Exception as exc:
        # Schema enforcement's refusal is the teaching result, in the engine's
        # words. The version is read back, not assumed: a many-small-writes
        # batch that fails part-way has already committed the writes before it.
        return _Outcome(ok=False, error=str(exc), version=engine.version(path),
                        data={"batch": op.batch, "write": op.write, "schema_mode": op.schema_mode,
                              "batch_columns": [c.name for c in columns], "writes_committed": committed,
                              **({"manifest": manifest_info} if manifest_info else {})})
    return _Outcome(ok=True, version=engine.version(path), rows=_count(path), files=engine.file_count(path),
                    data={"batch": op.batch, "batch_rows": len(rows), "write": op.write, "writes": writes,
                          "schema_mode": op.schema_mode, "merge": metrics,
                          "columns": engine.columns_of(path),
                          **({"manifest": manifest_info} if manifest_info else {})})


def _merge_cdc(pack: LabPack, op: MergeCdcOp, path: Path) -> _Outcome:
    if not op.table.startswith("bronze."):
        raise _misuse("The change batch is merged into the bronze table.")
    if not engine.exists(path):
        return _not_created(op.table)
    data = _dataset_table(pack, op.table)
    if not data.cdc:
        raise _misuse(f"The pack has no change batch for {op.table}.")
    metrics = engine.merge(path, _staging(pack), data.key, dataset_service.cdc_columns(data), data.cdc, cdc=True)
    return _Outcome(ok=True, version=engine.version(path), rows=_count(path), files=engine.file_count(path),
                    data={"merge": engine._jsonable(metrics),
                          "batch": {op_code: sum(1 for r in data.cdc if r["op"] == op_code) for op_code in ("I", "U", "D")}})


def _history(pack: LabPack, op: HistoryOp, path: Path) -> _Outcome:
    if not engine.exists(path):
        return _not_created(op.table)
    entries = engine.history(path)
    return _Outcome(ok=True, version=engine.version(path), data={"history": entries})


def _read_version(pack: LabPack, op: ReadVersionOp, path: Path) -> _Outcome:
    if not engine.exists(path):
        return _not_created(op.table)
    key = _dataset_table(pack, op.table).key
    try:
        rows = _count(path, op.version)
        cols = engine.columns_of(path, op.version)
        select = ", ".join(f"CAST({engine.quote(c)} AS VARCHAR) AS {engine.quote(c)}" for c in cols)
        sample = engine.query(
            f"SELECT {select} FROM t ORDER BY {engine.quote(key)} LIMIT {int(op.sample)}", {"t": (path, op.version)},
        ) if op.sample else []
    except Exception as exc:
        # A version whose files were vacuumed can't be read -- even though its
        # log still says how many rows it had. That is the lesson.
        return _Outcome(ok=False, error=str(exc), data={"version_requested": op.version})
    return _Outcome(ok=True, version=op.version, rows=rows, data={"sample": sample, "columns": cols})


def _restore(pack: LabPack, op: RestoreOp, path: Path) -> _Outcome:
    if not engine.exists(path):
        return _not_created(op.table)
    try:
        metrics = engine.restore(path, op.version)
    except Exception as exc:
        return _Outcome(ok=False, error=str(exc), data={"version_requested": op.version})
    return _Outcome(ok=True, version=engine.version(path), rows=_count(path), files=engine.file_count(path),
                    data={"restored_to": op.version, "restore": metrics})


def _compact(pack: LabPack, op: CompactOp, path: Path) -> _Outcome:
    if not engine.exists(path):
        return _not_created(op.table)
    unknown = [c for c in op.z_order if c not in engine.columns_of(path)]
    if unknown:
        raise _misuse(f"Can't Z-order by {unknown}: not columns of {op.table}.")
    before = engine.file_count(path)
    metrics = engine.compact(path, op.z_order)
    after = engine.file_count(path)
    return _Outcome(ok=True, version=engine.version(path), rows=_count(path), files=after,
                    data={"files_before": before, "files_after": after, "z_order": op.z_order, "optimize": metrics})


def _vacuum(pack: LabPack, op: VacuumOp, path: Path) -> _Outcome:
    if not engine.exists(path):
        return _not_created(op.table)
    settings = {"retention_hours": op.retention_hours, "dry_run": op.dry_run, "enforce_retention": op.enforce_retention}
    try:
        removed = engine.vacuum(path, op.retention_hours, op.dry_run, op.enforce_retention)
    except Exception as exc:
        return _Outcome(ok=False, error=str(exc), data=settings)
    if op.dry_run:
        # Nothing was deleted: the engine only listed what it would delete.
        return _Outcome(ok=True, version=engine.version(path), files=engine.file_count(path),
                        data={**settings, "files_removed": 0, "files_that_would_be_removed": len(removed),
                              "removed_sample": removed[:10],
                              "note": "Dry run: nothing was deleted. These files would be."})
    note = None if op.enforce_retention else (
        "The retention check was turned off. Versions whose files were removed can no longer be read."
    )
    return _Outcome(ok=True, version=engine.version(path), files=engine.file_count(path),
                    data={**settings, "files_removed": len(removed), "removed_sample": removed[:10], "note": note})


def _column_kind(pack: LabPack, dataset_table: str, column: str) -> str:
    spec = pack.dataset.tables[dataset_table]
    extra = {d.add_column.name: d.add_column.type for d in pack.dataset.defects if d.add_column}
    col_type = next((c.type for c in spec.columns if c.name == column), extra.get(column, "string"))
    if col_type in ("int64", "float64") or col_type.startswith("decimal("):
        return "numeric"
    if col_type.startswith("timestamp"):
        return "timestamp"
    return "text"


def _compare_tables(pack: LabPack, op: CompareTablesOp, left: Path, right: Path) -> _Outcome:
    l_name, r_name = op.left.split(".", 1)[1], op.right.split(".", 1)[1]
    if l_name != r_name:
        raise _misuse("Compare two copies of the same table, e.g. legacy.defects with silver.defects.")
    for t, p in ((op.left, left), (op.right, right)):
        if not engine.exists(p):
            return _not_created(t)
    key = engine.quote(pack.dataset.tables[l_name].key)
    tables = {"l": (left, None), "r": (right, None)}
    q = lambda sql: engine.query(sql, tables)  # noqa: E731
    # Compare through batch N: only the rows of batches 1..N by key, on both sides, so a
    # table loaded up to batch N isn't reported as missing the batches still to arrive.
    if op.through_batch is not None:
        data = _dataset_table(pack, op.left)
        if op.through_batch > len(data.batches):
            raise _misuse(f"{op.left} has {len(data.batches)} batches.")
        limit = dataset_service.max_key_through(data, op.through_batch)
        LS = f"(SELECT * FROM l WHERE {key} <= {limit}) AS l"
        RS = f"(SELECT * FROM r WHERE {key} <= {limit}) AS r"
    else:
        LS, RS = "l", "r"
    l_cols, r_cols = engine.columns_of(left), engine.columns_of(right)
    shared = [c for c in l_cols if c in r_cols and engine.quote(c) != key]

    # Counted from the data, not the log's statistics (see _count).
    if op.through_batch is None:
        counts = {"l_rows": _count(left), "r_rows": _count(right)}
    else:
        # Still counted by reading a real column, never from the log's statistics (see _count).
        def scoped_rows(src: str, path: Path) -> int:
            col = engine.quote(engine.columns_of(path)[0])
            return int(q(f"SELECT COALESCE(SUM(CASE WHEN {col} IS NULL THEN 1 ELSE 1 END), 0) AS n FROM {src}")[0]["n"])
        counts = {"l_rows": scoped_rows(LS, left), "r_rows": scoped_rows(RS, right)}
    counts["l_dup"] = counts["l_rows"] - q(f"SELECT COUNT(DISTINCT {key}) AS n FROM {LS}")[0]["n"]
    counts["r_dup"] = counts["r_rows"] - q(f"SELECT COUNT(DISTINCT {key}) AS n FROM {RS}")[0]["n"]
    only_left = q(f"SELECT COUNT(DISTINCT l.{key}) AS n FROM {LS} LEFT JOIN {RS} ON l.{key} = r.{key} WHERE r.{key} IS NULL")[0]["n"]
    only_right = q(f"SELECT COUNT(DISTINCT r.{key}) AS n FROM {RS} LEFT JOIN {LS} ON l.{key} = r.{key} WHERE l.{key} IS NULL")[0]["n"]

    aggregates: Dict[str, Any] = {}
    mismatches: Dict[str, Any] = {}
    for col in shared:
        c = engine.quote(col)
        kind = _column_kind(pack, l_name, col)
        agg = (f"CAST(SUM({c}) AS VARCHAR) AS sum, " if kind == "numeric" else "") + \
            f"CAST(MIN({c}) AS VARCHAR) AS min, CAST(MAX({c}) AS VARCHAR) AS max, COUNT(*) - COUNT({c}) AS nulls"
        aggregates[col] = {"left": q(f"SELECT {agg} FROM {LS}")[0], "right": q(f"SELECT {agg} FROM {RS}")[0]}

        if kind == "numeric":
            diff = f"ABS(CAST(l.{c} AS DOUBLE) - CAST(r.{c} AS DOUBLE))"
            where = (f"(l.{c} IS NULL AND r.{c} IS NOT NULL) OR (l.{c} IS NOT NULL AND r.{c} IS NULL) "
                     f"OR {diff} > {float(op.tolerance)!r}")
            largest = f"MAX({diff})"
        elif kind == "timestamp":
            diff = f"ABS(to_unixtime(l.{c}) - to_unixtime(r.{c}))"
            where = f"l.{c} IS DISTINCT FROM r.{c}"
            largest = f"MAX({diff})"
        else:
            where = f"l.{c} IS DISTINCT FROM r.{c}"
            largest = "NULL"
        base = f"FROM {LS} JOIN {RS} ON l.{key} = r.{key} WHERE {where}"
        summary = q(f"SELECT COUNT(DISTINCT l.{key}) AS n, CAST({largest} AS VARCHAR) AS largest {base}")[0]
        keys = [row["k"] for row in q(f"SELECT DISTINCT l.{key} AS k {base} ORDER BY k LIMIT {KEY_LIST_LIMIT}")]
        examples = q(f"SELECT l.{key} AS k, CAST(l.{c} AS VARCHAR) AS left_value, CAST(r.{c} AS VARCHAR) AS right_value "
                     f"{base} ORDER BY k LIMIT 3")
        mismatches[col] = {
            "count": int(summary["n"]), "keys": keys, "examples": examples,
            "largest_difference": summary["largest"],
            "difference_unit": "seconds" if kind == "timestamp" else None,
        }

    total_mismatched = sum(m["count"] for m in mismatches.values())
    return _Outcome(ok=True, rows=None, data={
        "row_counts": {"left": counts["l_rows"], "right": counts["r_rows"]},
        "row_counts_match": counts["l_rows"] == counts["r_rows"],
        "duplicate_keys": {"left": counts["l_dup"], "right": counts["r_dup"]},
        "only_in_left": only_left, "only_in_right": only_right,
        "aggregates": aggregates, "mismatches": mismatches,
        "columns_compared": shared, "tolerance": op.tolerance,
        "values_match": total_mismatched == 0 and only_left == 0 and only_right == 0,
        "through_batch": op.through_batch,
    })


_HANDLERS = {
    "create_table": _create_table, "append_batch": _append_batch, "merge_cdc": _merge_cdc,
    "history": _history, "read_version": _read_version, "restore": _restore,
    "compact": _compact, "vacuum": _vacuum,
}


def _journal_summary(outcome: _Outcome) -> Dict[str, Any]:
    """What the journal keeps: the headline facts, not every key listed."""
    summary = {k: outcome.get(k) for k in ("ok", "version", "rows", "files", "error") if outcome.get(k) is not None}
    data = outcome.get("data") or {}
    for k in ("batch", "write", "schema_mode", "writes", "writes_committed", "files_before", "files_after", "restored_to",
              "files_removed", "files_that_would_be_removed", "retention_hours", "dry_run", "enforce_retention", "row_counts",
              "row_counts_match", "duplicate_keys", "values_match", "version_requested", "through_batch"):
        if k in data:
            summary[k] = data[k]
    if "manifest" in data:
        summary["manifest"] = data["manifest"]
    if "mismatches" in data:
        summary["mismatched_rows_by_column"] = {c: m["count"] for c, m in data["mismatches"].items() if m["count"]}
    if "merge" in data and isinstance(data["merge"], dict):
        summary["merge"] = {k: v for k, v in data["merge"].items() if k.startswith("num_target_rows")}
    return summary


def _without_local_paths(message: str) -> str:
    """The engine's error, with the lab folder's path replaced by `<lab>`.

    The engine names files by their full path, which includes the learner's home
    folder and user name -- and the journal can be exported and shared.
    """
    root = LAB_DIR.resolve()
    for form in {str(root), root.as_posix(), str(root).replace("\\", "\\\\")}:
        message = message.replace(form, "<lab>")
    return message


def run(db: Session, op) -> LabOperationResult:
    pack = _require_pack(op.pack_id)
    if op.op == "compare_tables":
        paths = [_require_table(pack, op.left), _require_table(pack, op.right)]
        table_label = f"{op.left} vs {op.right}"
    else:
        paths = [_require_table(pack, op.table)]
        table_label = op.table
    _check_attempt(db, op.attempt_uid)
    if not engine.status().available:
        raise _engine_missing()

    started = time.perf_counter()
    with ExitStack() as stack:
        for p in sorted(set(paths), key=str):
            stack.enter_context(_lock(p))
        try:
            if op.op == "compare_tables":
                outcome = _compare_tables(pack, op, *paths)
            else:
                outcome = _HANDLERS[op.op](pack, op, paths[0])
        except (InvalidExamStateException, HTTPException):
            raise
        except engine.EngineUnavailable:
            raise _engine_missing()
        except Exception as exc:
            # Unexpected, but still the engine's answer: report it, journal it.
            logger.exception(f"Lab operation {op.op} on {table_label} failed")
            outcome = _Outcome(ok=False, error=str(exc))
    if outcome.get("error"):
        outcome["error"] = _without_local_paths(outcome["error"])
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    logger.info(f"Lab {op.op} on {table_label}: ok={outcome.get('ok')} in {elapsed_ms} ms")

    uid = journal_service.record_real(db, pack.manifest.id, op.op, table_label, _journal_summary(outcome), op.attempt_uid)
    return LabOperationResult(
        ok=bool(outcome.get("ok")), op=op.op, table=table_label,
        version=outcome.get("version"), rows=outcome.get("rows"), files=outcome.get("files"),
        error=outcome.get("error"), data={**(outcome.get("data") or {}), "elapsed_ms": elapsed_ms},
        journal_uid=uid,
    )


def reset(db: Session, pack_id: str) -> LabResetResult:
    """Delete this pack's lab tables. The journal is kept -- it's the evidence.

    Takes every table's lock first, so a reset can't delete a table under an
    operation that is still writing it. Not journaled: a reset deletes files, it
    isn't an engine run, and the journal only says "real engine" about those.
    """
    pack = _require_pack(pack_id)
    folder = lab_pack_dir(pack.manifest.id)
    removed = False
    with ExitStack() as stack:
        for p in sorted({lab_path(pack.manifest.id, t) for t in pack.tables()}, key=str):
            stack.enter_context(_lock(p))
        for attempt in range(5):
            if not folder.exists():
                break
            try:
                shutil.rmtree(folder)
                removed = True
                break
            except PermissionError:
                # Windows can hold a file handle a moment after the last read.
                time.sleep(0.2 * (attempt + 1))
        if folder.exists():
            raise HTTPException(status_code=409, detail="The lab folder is in use and couldn't be deleted. Try again.")
    return LabResetResult(pack_id=pack.manifest.id, removed=removed)
