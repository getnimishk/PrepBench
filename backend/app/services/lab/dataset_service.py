# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The Lakehouse Lab's fictional dataset (design §4.2, PRD P0-1).

Deterministic: every random choice comes from a `random.Random` seeded with the
pack's seed and the table (and defect) it's for. Never the global RNG, never the
clock -- so the same pack always produces byte-identical data (tested).

What it produces, per table:
- `clean`: the source rows, as the migrated job should see them;
- `legacy`: the same rows as the old Hive jobs produced them. The planted
  precision, timezone and null-handling defects are *the difference* between the
  two copies, so a comparison has ground truth without running Hive;
- `batches`: the clean rows split into the order they arrive in, with the
  batch-level patterns applied (a column added from batch N, late events, ...);
- `cdc`: a change batch (updates, deletes, inserts) with an `op` column;
- a `manifest` listing every planted defect and exactly the rows it affects.

Values are kept "raw", in the form the engine's staging table takes: integers,
strings, decimals as strings (never floats, which would round), and timestamps
as epoch microseconds. The engine casts them to their declared types in SQL
(design §4.3, spike finding 3).
"""
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.schemas.lab import ColumnSpec, DatasetSpec, LabPack, TableSpec

Row = Dict[str, Any]
_US_PER_DAY = 86_400_000_000
_US_PER_HOUR = 3_600_000_000


@dataclass
class TableData:
    spec: TableSpec
    clean: List[Row]
    legacy: List[Row]
    # batches[i] is batch i+1; batch_columns[i] its columns (drift adds one).
    batches: List[List[Row]]
    batch_columns: List[List[ColumnSpec]]
    cdc: List[Row] = field(default_factory=list)

    @property
    def key(self) -> str:
        return self.spec.key


@dataclass
class Dataset:
    tables: Dict[str, TableData]
    manifest: List[Dict[str, Any]]


# ---- values --------------------------------------------------------------------------


def _epoch_us(iso: str) -> int:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    return int(dt.timestamp()) * 1_000_000


def _decimal_str(units: int, scale: int) -> str:
    sign = "-" if units < 0 else ""
    units = abs(units)
    whole, frac = divmod(units, 10 ** scale)
    return f"{sign}{whole}.{frac:0{scale}d}" if scale else f"{sign}{whole}"


def _decimal_units(value: str, scale: int) -> int:
    whole, _, frac = value.partition(".")
    sign = -1 if whole.startswith("-") else 1
    return sign * (abs(int(whole)) * 10 ** scale + int((frac + "0" * scale)[:scale] or 0))


def _value(col: ColumnSpec, i: int, n: int, rng: random.Random) -> Any:
    g = col.gen
    if g.kind == "sequence":
        return int(g.start or 1) + i
    if g.kind == "pattern":
        return g.format.format(rng.randint(int(g.min), int(g.max)))
    if g.kind == "choice":
        return rng.choice(g.values)
    if g.kind == "int":
        return rng.randint(int(g.min), int(g.max))
    if g.kind == "decimal":
        scale = int(g.scale or 0)
        lo, hi = round(g.min * 10 ** scale), round(g.max * 10 ** scale)
        units = rng.randint(lo, hi)
        # Never already a whole hundredth: rounding to two places must change
        # every value, so the precision defect affects exactly the rows it lists.
        if scale >= 3 and units % 100 == 0:
            units = units + 1 if units + 1 <= hi else units - 1
        return _decimal_str(units, scale)
    if g.kind == "time":
        start = _epoch_us(str(g.start))
        span = int(g.span_days or 1) * _US_PER_DAY
        step = max(span // max(n, 1), 1)
        return start + step * i + rng.randrange(step)
    raise ValueError(f"unknown generator kind {g.kind!r}")


def _rows(spec: TableSpec, rng: random.Random, start: int, count: int, total: int) -> List[Row]:
    return [{c.name: _value(c, i, total, rng) for c in spec.columns} for i in range(start, start + count)]


def _pick(rng: random.Random, population: List[int], defect_affects: Optional[Dict[str, float]], size: int) -> List[int]:
    affects = defect_affects or {}
    k = int(affects["count"]) if "count" in affects else round(size * float(affects.get("fraction", 0)))
    return sorted(rng.sample(population, min(k, len(population))))


# ---- the dataset ---------------------------------------------------------------------


_CACHE: Dict[tuple, Dataset] = {}


def generate(pack: LabPack) -> Dataset:
    """The pack's dataset, generated once per pack id, version and seed.

    A pack's content only changes with its version (packs are files reviewed
    like code), so those three identify the data.
    """
    key = (pack.manifest.id, pack.manifest.version, pack.manifest.seed)
    if key not in _CACHE:
        _CACHE[key] = _generate(pack.manifest.seed, pack.dataset)
    return _CACHE[key]


def _generate(seed: int, spec: DatasetSpec) -> Dataset:
    tables: Dict[str, TableData] = {}
    manifest: List[Dict[str, Any]] = []

    for name, t in spec.tables.items():
        rng = random.Random(f"{seed}:{name}")
        clean = _rows(t, rng, 0, t.rows, t.rows)
        legacy = [dict(r) for r in clean]
        tables[name] = TableData(spec=t, clean=clean, legacy=legacy, batches=[], batch_columns=[])

    # Differences between the legacy and clean copies.
    for d in spec.defects:
        data = tables[d.table]
        rng = random.Random(f"{seed}:{d.table}:{d.id}")
        index = list(range(len(data.clean)))
        if d.kind == "precision":
            col = next(c for c in data.spec.columns if c.name == d.column)
            scale = int(col.gen.scale or 0)
            step = 10 ** (scale - int(d.legacy_scale or 0))
            chosen = _pick(rng, index, d.affects, len(index))
            for i in chosen:
                units = _decimal_units(data.clean[i][d.column], scale)
                data.legacy[i][d.column] = _decimal_str((units + step // 2) // step * step, scale)
        elif d.kind == "timezone":
            chosen = _pick(rng, index, d.affects, len(index))
            for i in chosen:
                data.legacy[i][d.column] = data.clean[i][d.column] + int(d.legacy_offset_hours or 0) * _US_PER_HOUR
        elif d.kind == "null_handling":
            chosen = _pick(rng, index, d.affects, len(index))
            for i in chosen:
                data.clean[i][d.column] = None
                data.legacy[i][d.column] = d.legacy_value
        else:
            continue
        manifest.append({
            "id": d.id, "kind": d.kind, "table": d.table, "column": d.column, "about": d.about,
            "keys": [data.clean[i][data.key] for i in chosen], "count": len(chosen),
        })

    # Batches, in arrival order, with the batch-level patterns.
    for name, data in tables.items():
        t = data.spec
        size = -(-len(data.clean) // t.batches)
        data.batches = [[dict(r) for r in data.clean[b * size:(b + 1) * size]] for b in range(t.batches)]
        data.batch_columns = [list(t.columns) for _ in range(t.batches)]

    for d in spec.defects:
        data = tables[d.table]
        rng = random.Random(f"{seed}:{d.table}:{d.id}")
        key = data.key
        if d.kind == "schema_drift":
            b = d.batch - 1
            for later in range(b, len(data.batches)):
                data.batch_columns[later] = [*data.spec.columns, d.add_column]
                for row in data.batches[later]:
                    row[d.add_column.name] = f"INSP-{rng.randint(1, 40):03d}"
            carrying = [r[key] for later in data.batches[b:] for r in later]
            manifest.append({"id": d.id, "kind": d.kind, "table": d.table, "about": d.about,
                             "batch": d.batch, "column": d.add_column.name,
                             "keys": carrying, "count": len(carrying)})
        elif d.kind == "late_arrival":
            src, dst = data.batches[d.from_batch - 1], data.batches[d.batch - 1]
            moved = _pick(rng, list(range(len(src))), d.affects, len(src))
            late = [src[i] for i in moved]
            data.batches[d.from_batch - 1] = [r for i, r in enumerate(src) if i not in set(moved)]
            dst.extend(late)
            manifest.append({"id": d.id, "kind": d.kind, "table": d.table, "about": d.about,
                             "batch": d.batch, "from_batch": d.from_batch,
                             "keys": sorted(r[key] for r in late), "count": len(late)})
        elif d.kind == "replay":
            keys = [r[key] for r in data.batches[d.batch - 1]]
            manifest.append({"id": d.id, "kind": d.kind, "table": d.table, "about": d.about,
                             "batch": d.batch, "keys": keys, "count": len(keys)})
        elif d.kind == "small_files":
            manifest.append({"id": d.id, "kind": d.kind, "table": d.table, "about": d.about,
                             "batch": d.batch, "files": d.files, "keys": [], "count": 0})
        elif d.kind == "cdc":
            pool = [r for b in (d.from_batches or [1]) for r in data.batches[b - 1]]
            chosen = rng.sample(range(len(pool)), (d.updates or 0) + (d.deletes or 0))
            updates = [dict(pool[i]) for i in chosen[: d.updates or 0]]
            deletes = [dict(pool[i]) for i in chosen[d.updates or 0:]]
            count_col = next((c.name for c in data.spec.columns if c.gen.kind == "int"), None)
            for r in updates:
                if count_col:
                    r[count_col] = r[count_col] + rng.randint(1, 5)
                r["op"] = "U"
            for r in deletes:
                r["op"] = "D"
            top = max(r[key] for r in data.clean)
            ins_rng = random.Random(f"{seed}:{d.table}:{d.id}:inserts")
            inserts = _rows(data.spec, ins_rng, len(data.clean), d.inserts or 0, len(data.clean))
            for j, r in enumerate(inserts):
                r[key] = top + 1 + j
                r["op"] = "I"
            data.cdc = sorted(updates + deletes + inserts, key=lambda r: r[key])
            manifest.append({"id": d.id, "kind": d.kind, "table": d.table, "about": d.about,
                             "updates": sorted(r[key] for r in updates),
                             "deletes": sorted(r[key] for r in deletes),
                             "inserts": sorted(r[key] for r in inserts),
                             "keys": sorted(r[key] for r in data.cdc), "count": len(data.cdc)})

    return Dataset(tables=tables, manifest=manifest)


def small_files_count(pack: LabPack, table: str, batch: int) -> Optional[int]:
    """How many writes a batch lands as, when the pack plants the small-files pattern on it."""
    for d in pack.dataset.defects:
        if d.kind == "small_files" and d.table == table and d.batch == batch:
            return d.files
    return None


def cdc_columns(data: TableData) -> List[ColumnSpec]:
    return [*data.spec.columns, ColumnSpec(name="op", type="string")]


def source_index(pack: LabPack, table: Optional[str] = None) -> List[Dict[str, Any]]:
    """Every source row's key, when it last changed, and whether the change batch
    deletes it -- what the browser simulations need, without the row data."""
    dataset = generate(pack)
    name = table or next(iter(pack.dataset.tables))
    data = dataset.tables[name]
    time_col = next((c.name for c in data.spec.columns if c.type.startswith("timestamp")), None)
    deleted = {r[data.key] for r in data.cdc if r.get("op") == "D"}
    batch_of = {r[data.key]: b + 1 for b, rows in enumerate(data.batches) for r in rows}
    return [
        {
            "id": r[data.key],
            "modified_at": iso(r[time_col]) if time_col and r[time_col] is not None else "",
            "deleted": r[data.key] in deleted,
            "batch": batch_of.get(r[data.key]),
        }
        for r in data.clean
    ]


def rows_by_key(data: "TableData") -> Dict[Any, tuple]:
    """Each source row as it arrives, with the batch it arrives in: key -> (batch, row)."""
    return {r[data.key]: (b + 1, r) for b, rows in enumerate(data.batches) for r in rows}


def max_key_through(data: "TableData", batch: int) -> int:
    """The largest key among the rows of batches 1..`batch`."""
    return max(r[data.key] for rows in data.batches[:batch] for r in rows)


def iso(epoch_us: int) -> str:
    return datetime.fromtimestamp(epoch_us / 1_000_000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def to_csv(columns: List[ColumnSpec], rows: List[Row]) -> str:
    """Rows as CSV, for uploading to a Databricks Volume (the notebook export)."""
    import csv
    import io

    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow([c.name for c in columns])
    for r in rows:
        line = []
        for c in columns:
            v = r.get(c.name)
            if v is None:
                line.append("")
            elif c.type.startswith("timestamp"):
                line.append(iso(v))
            else:
                line.append(v)
        writer.writerow(line)
    return out.getvalue()
