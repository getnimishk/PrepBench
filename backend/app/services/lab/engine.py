# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The Delta engine adapter (design §4.3): the ONLY module that imports `deltalake`,
and only lazily, inside a function. Importing the app never loads it (tested),
so an install without the optional engine starts exactly as before.

Everything here is real: files written, versions committed, counts read from the
data. Two spike findings shape it (design §10):
- counts and reads go through `QueryBuilder` (SQL over the files), never
  `DeltaTable.count()`, which answers from the log even after vacuum has removed
  the files;
- typed columns are cast in SQL from a staging table, because arro3 can't build
  DECIMAL or TIMESTAMP arrays from Python values.

All SQL is written here from column names the pack validated; nothing a client
sends becomes SQL.
"""
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.lab import ColumnSpec, EngineStatus

INSTALL_COMMAND = "uv pip install --system-certs -p backend/.venv/Scripts/python.exe -r backend/requirements-lab.txt"


class EngineUnavailable(Exception):
    """`deltalake` isn't installed, or failed to import."""


def status() -> EngineStatus:
    """Whether the real engine is here. Never raises."""
    try:
        import deltalake  # noqa: PLC0415 -- lazy on purpose
    except ImportError:
        return EngineStatus(available=False, install_command=INSTALL_COMMAND, detail="deltalake is not installed.")
    except Exception as exc:  # a broken install: say so rather than crash
        return EngineStatus(available=False, install_command=INSTALL_COMMAND, detail=f"deltalake failed to load: {exc}")
    return EngineStatus(available=True, version=getattr(deltalake, "__version__", None), install_command=INSTALL_COMMAND)


def _dl():
    try:
        import deltalake  # noqa: PLC0415
        import arro3.core as ac  # noqa: PLC0415
    except Exception as exc:
        raise EngineUnavailable(str(exc)) from exc
    return deltalake, ac


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def exists(path: Path) -> bool:
    return (path / "_delta_log").is_dir()


def version(path: Path) -> int:
    dl, _ = _dl()
    return dl.DeltaTable(str(path)).version()


def file_count(path: Path) -> int:
    dl, _ = _dl()
    return len(dl.DeltaTable(str(path)).file_uris())


def columns_of(path: Path, at_version: Optional[int] = None) -> List[str]:
    """Column names, at a version when given: drift means versions can differ."""
    dl, _ = _dl()
    dt = dl.DeltaTable(str(path), version=at_version) if at_version is not None else dl.DeltaTable(str(path))
    return [f.name for f in dt.schema().fields]


# ---- typed writes via a staging table (spike finding 3) ---------------------------


def _staging_type(col: ColumnSpec, ac):
    if col.type == "int64" or col.type.startswith("timestamp"):
        return ac.DataType.int64()
    if col.type == "float64":
        return ac.DataType.float64()
    return ac.DataType.string()  # string, and decimals kept as exact strings


def _cast(col: ColumnSpec) -> str:
    c = quote(col.name)
    if col.type == "int64":
        return f"CAST({c} AS BIGINT) AS {c}"
    if col.type == "float64":
        return f"CAST({c} AS DOUBLE) AS {c}"
    if col.type.startswith("decimal("):
        p, s = col.type[len("decimal("):-1].split(",")
        return f"CAST({c} AS DECIMAL({int(p)},{int(s)})) AS {c}"
    if col.type == "timestamp":
        return f"arrow_cast(to_timestamp_micros({c}), 'Timestamp(Microsecond, Some(\"UTC\"))') AS {c}"
    if col.type == "timestamp_ntz":
        return f"to_timestamp_micros({c}) AS {c}"
    return f"{c}"


class _Staged:
    """Raw rows written to a throwaway Delta table, then read back typed through SQL."""

    def __init__(self, staging_root: Path, columns: List[ColumnSpec], rows: List[Dict[str, Any]]):
        dl, ac = _dl()
        self.path = staging_root / f"_staging-{uuid.uuid4().hex}"
        table = ac.Table.from_pydict({
            c.name: ac.Array([r.get(c.name) for r in rows], _staging_type(c, ac)) for c in columns
        })
        dl.write_deltalake(str(self.path), table, mode="overwrite")
        sql = f"SELECT {', '.join(_cast(c) for c in columns)} FROM staged"
        self.reader = dl.QueryBuilder().register("staged", dl.DeltaTable(str(self.path))).execute(sql)

    def __enter__(self):
        return self.reader

    def __exit__(self, *exc):
        shutil.rmtree(self.path, ignore_errors=True)


def write(path: Path, staging_root: Path, columns: List[ColumnSpec], rows: List[Dict[str, Any]],
          mode: str, schema_mode: Optional[str] = None) -> int:
    """Write rows (overwrite or append). Raises the engine's own error on a
    schema mismatch -- the caller reports it as a result, not a crash."""
    dl, _ = _dl()
    with _Staged(staging_root, columns, rows) as reader:
        kwargs = {"mode": mode}
        if schema_mode == "merge":
            kwargs["schema_mode"] = "merge"
        dl.write_deltalake(str(path), reader, **kwargs)
    return version(path)


def merge(path: Path, staging_root: Path, key: str, columns: List[ColumnSpec], rows: List[Dict[str, Any]],
          cdc: bool) -> Dict[str, Any]:
    """MERGE on the business key. `cdc`: rows carry `op` (I/U/D); otherwise an
    upsert, so replaying a batch changes nothing."""
    dl, _ = _dl()
    data_cols = [c.name for c in columns if c.name != "op"]
    with _Staged(staging_root, columns, rows) as reader:
        # Column names are bare: the pack only allows [a-z][a-z0-9_]*.
        m = dl.DeltaTable(str(path)).merge(
            reader, predicate=f"t.{key} = s.{key}", source_alias="s", target_alias="t",
        )
        if cdc:
            values = {c: f"s.{c}" for c in data_cols}
            m = (m.when_matched_delete(predicate="s.op = 'D'")
                 .when_matched_update(updates={k: v for k, v in values.items() if k != key}, predicate="s.op = 'U'")
                 .when_not_matched_insert(updates=values, predicate="s.op = 'I'"))
        else:
            m = m.when_matched_update_all().when_not_matched_insert_all()
        metrics = m.execute()
    return dict(metrics)


# ---- reads through SQL (spike finding 1) ------------------------------------------


def query(sql: str, tables: Dict[str, Tuple[Path, Optional[int]]]) -> List[Dict[str, Any]]:
    """Run server-written SQL over registered tables; rows as dicts.

    Reads the actual files, so a version whose files were vacuumed fails here
    (as it should) even though its log still says how many rows it had.
    """
    dl, _ = _dl()
    qb = dl.QueryBuilder()
    for name, (path, at_version) in tables.items():
        dt = dl.DeltaTable(str(path), version=at_version) if at_version is not None else dl.DeltaTable(str(path))
        qb = qb.register(name, dt)
    result = qb.execute(sql).read_all()
    cols = {n: result.column(n).to_pylist() for n in result.column_names}
    return [dict(zip(cols, values)) for values in zip(*cols.values())] if cols else []


# ---- table maintenance ------------------------------------------------------------


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def history(path: Path) -> List[Dict[str, Any]]:
    dl, _ = _dl()
    return [_jsonable(h) for h in dl.DeltaTable(str(path)).history()]


def restore(path: Path, to_version: int) -> Dict[str, Any]:
    dl, _ = _dl()
    return _jsonable(dict(dl.DeltaTable(str(path)).restore(to_version)))


def compact(path: Path, z_order: List[str]) -> Dict[str, Any]:
    dl, _ = _dl()
    dt = dl.DeltaTable(str(path))
    metrics = dt.optimize.z_order(z_order) if z_order else dt.optimize.compact()
    return _jsonable(dict(metrics))


def vacuum(path: Path, retention_hours: int, dry_run: bool, enforce: bool) -> List[str]:
    dl, _ = _dl()
    return list(dl.DeltaTable(str(path)).vacuum(
        retention_hours=retention_hours, dry_run=dry_run, enforce_retention_duration=enforce,
    ))
