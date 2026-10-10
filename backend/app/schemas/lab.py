# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Wire and file shapes for the Lakehouse Lab (design §4.1, §4.4, §4.6).

Three groups:
- the scenario pack as it sits on disk (validated at load; a bad pack is skipped);
- the operation allow-list: one request model per `op`, as a discriminated
  union, so the client can only ever name an operation and a table -- never SQL,
  never a path;
- the journal, where `source` says whether a result came from the real engine or
  a simulation.
"""
from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

NAME = r"^[a-z][a-z0-9_]{0,62}$"
COLUMN_TYPE = r"^(int64|float64|string|timestamp|timestamp_ntz|decimal\(\d{1,2},\d{1,2}\))$"
LAYERS = ("legacy", "bronze", "silver")


# ---- the pack, on disk -------------------------------------------------------------


class ColumnGen(BaseModel):
    kind: Literal["sequence", "pattern", "choice", "int", "decimal", "time"]
    start: Optional[Union[int, str]] = None
    format: Optional[str] = None
    min: Optional[float] = None
    max: Optional[float] = None
    values: Optional[List[str]] = None
    scale: Optional[int] = None
    span_days: Optional[int] = None

    model_config = ConfigDict(extra="forbid")


class ColumnSpec(BaseModel):
    name: str = Field(pattern=NAME)
    type: str = Field(pattern=COLUMN_TYPE)
    # Required on a table's own columns; a column a later batch adds has none.
    gen: Optional[ColumnGen] = None

    model_config = ConfigDict(extra="forbid")


class TableSpec(BaseModel):
    key: str = Field(pattern=NAME)
    rows: int = Field(ge=1, le=100_000)
    batches: int = Field(ge=1, le=50)
    columns: List[ColumnSpec] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def _key_is_a_column(self):
        names = [c.name for c in self.columns]
        if self.key not in names:
            raise ValueError(f"key {self.key!r} is not one of the columns")
        if len(set(names)) != len(names):
            raise ValueError("column names repeat")
        missing = [c.name for c in self.columns if c.gen is None]
        if missing:
            raise ValueError(f"columns without a generator: {missing}")
        return self


class DefectSpec(BaseModel):
    """One planted difference or batch pattern. Only the fields its kind needs are set."""

    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,49}$")
    kind: Literal["precision", "timezone", "null_handling", "schema_drift", "cdc", "replay", "late_arrival", "small_files"]
    table: str = Field(pattern=NAME)
    about: str = ""
    column: Optional[str] = None
    affects: Optional[Dict[str, float]] = None
    legacy_scale: Optional[int] = None
    legacy_offset_hours: Optional[int] = None
    legacy_value: Optional[Union[int, str]] = None
    batch: Optional[int] = None
    from_batch: Optional[int] = None
    from_batches: Optional[List[int]] = None
    add_column: Optional[ColumnSpec] = None
    updates: Optional[int] = None
    deletes: Optional[int] = None
    inserts: Optional[int] = None
    files: Optional[int] = None

    model_config = ConfigDict(extra="forbid")


class DatasetSpec(BaseModel):
    tables: Dict[str, TableSpec]
    defects: List[DefectSpec]

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def _defects_name_real_tables(self):
        for d in self.defects:
            table = self.tables.get(d.table)
            if table is None:
                raise ValueError(f"defect {d.id!r} names unknown table {d.table!r}")
            if d.column and d.column not in {c.name for c in table.columns}:
                raise ValueError(f"defect {d.id!r} names unknown column {d.column!r}")
            for b in [d.batch, d.from_batch, *(d.from_batches or [])]:
                if b is not None and not 1 <= b <= table.batches:
                    raise ValueError(f"defect {d.id!r} names batch {b}, outside 1..{table.batches}")
        if len({d.id for d in self.defects}) != len(self.defects):
            raise ValueError("defect ids repeat")
        return self


class PackManifest(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{0,99}$")
    version: int = Field(ge=1)
    title: str
    summary: str = ""
    fictional: bool
    seed: int
    stations: List[Literal["a", "b", "c", "d", "f", "i"]]
    # Set by hand, after someone has run the exported notebook on Databricks Free
    # Edition. Until then the export says "Unverified".
    notebook_verified_on: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def _fictional_only(self):
        if not self.fictional:
            raise ValueError("a lab pack must be fictional")
        return self


class LabPack(BaseModel):
    manifest: PackManifest
    scenario_md: str
    dataset: DatasetSpec
    factory: Dict[str, Any] = {}
    # Stations A and B: the ADF lever settings and the ADLS teaching constants.
    pipeline: Dict[str, Any] = {}

    def tables(self) -> List[str]:
        """Every table name an operation may use: each dataset table in each layer."""
        return [f"{layer}.{t}" for t in self.dataset.tables for layer in LAYERS]


class LabPackSummary(BaseModel):
    id: str
    version: int
    title: str
    summary: str
    fictional: bool
    stations: List[str]
    notebook_verified_on: Optional[str] = None


class LabPackDetail(LabPackSummary):
    scenario_md: str
    dataset: DatasetSpec
    factory: Dict[str, Any]
    pipeline: Dict[str, Any]
    tables: List[str]
    # Ground truth for every planted difference (design §4.2).
    defect_manifest: List[Dict[str, Any]]


class SourceIndexRow(BaseModel):
    id: int
    modified_at: str
    deleted: bool
    # The batch (1-based) the row arrives in. Station A's simulation needs it to know
    # which rows a load window holds; null for a row no batch carries.
    batch: Optional[int] = None


# ---- the engine -----------------------------------------------------------------------


class EngineStatus(BaseModel):
    available: bool
    version: Optional[str] = None
    install_command: str
    # Why it's unavailable, when it is: missing, or failed to import.
    detail: Optional[str] = None


# ---- the operation allow-list (design §4.4) ------------------------------------------


class _Op(BaseModel):
    pack_id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{0,99}$")
    # Optional: with one, the attempt's prediction must already be committed.
    attempt_uid: Optional[str] = Field(default=None, min_length=8, max_length=64)
    # The preparation the attempt belongs to. Another preparation's attempt does
    # not count: omitted, only an attempt with no preparation does.
    subject_id: Optional[int] = None

    model_config = ConfigDict(extra="forbid")


class CreateTableOp(_Op):
    op: Literal["create_table"]
    table: str


class AppendBatchOp(_Op):
    op: Literal["append_batch"]
    table: str
    batch: int = Field(ge=1, le=50)
    # "append" writes the rows as they are, so a replayed batch duplicates;
    # "merge" upserts on the table's key, so a replay changes nothing.
    write: Literal["append", "merge"] = "append"
    # "enforce" refuses a batch whose schema differs; "merge" evolves the table.
    schema_mode: Literal["enforce", "merge"] = "enforce"
    # Land the batch as the pack's many small writes instead of one.
    small_files: bool = False
    # Station A's batch manifest: the ids of the source rows this load writes, in landing
    # order, a repeated id landing twice. The server writes exactly those rows (from the
    # pack's own data) and nothing else, so an upstream mistake becomes real rows in a
    # real table. `batch` still names the schema the rows are written under.
    manifest: Optional[List[int]] = Field(default=None, min_length=1, max_length=50_000)


class MergeCdcOp(_Op):
    op: Literal["merge_cdc"]
    table: str


class HistoryOp(_Op):
    op: Literal["history"]
    table: str


class ReadVersionOp(_Op):
    op: Literal["read_version"]
    table: str
    version: int = Field(ge=0)
    sample: int = Field(default=5, ge=0, le=20)


class RestoreOp(_Op):
    op: Literal["restore"]
    table: str
    version: int = Field(ge=0)


class CompactOp(_Op):
    op: Literal["compact"]
    table: str
    z_order: List[str] = Field(default_factory=list, max_length=4)


class VacuumOp(_Op):
    op: Literal["vacuum"]
    table: str
    retention_hours: int = Field(ge=0, le=10_000)
    dry_run: bool = True
    # The engine's own guard (168 hours). Turning it off is part of the lesson,
    # and the result says it was off.
    enforce_retention: bool = True


class CompareTablesOp(_Op):
    op: Literal["compare_tables"]
    left: str
    right: str
    tolerance: float = Field(default=0.0, ge=0)
    # Compare only the rows of batches 1..N (by key), so a table loaded up to batch N isn't
    # reported as missing the batches that haven't arrived yet.
    through_batch: Optional[int] = Field(default=None, ge=1, le=50)


LabOperation = Annotated[
    Union[CreateTableOp, AppendBatchOp, MergeCdcOp, HistoryOp, ReadVersionOp, RestoreOp,
          CompactOp, VacuumOp, CompareTablesOp],
    Field(discriminator="op"),
]


class LabOperationResult(BaseModel):
    """What the real engine did. `ok: false` is an expected, teachable failure
    (a schema rejection, a vacuumed version) carrying the engine's own words."""

    ok: bool
    op: str
    table: Optional[str] = None
    version: Optional[int] = None
    rows: Optional[int] = None
    files: Optional[int] = None
    error: Optional[str] = None
    data: Dict[str, Any] = {}
    journal_uid: str


class LabResetResult(BaseModel):
    pack_id: str
    # False when there was nothing to delete.
    removed: bool


# ---- the journal (design §4.6) -----------------------------------------------------


Station = Literal["a", "b", "c", "f", "i"]
Source = Literal["real_engine", "simulation"]


class JournalEntryIn(BaseModel):
    """A simulation station's entry. `source` may be omitted; `real_engine` is refused."""

    entry_uid: Optional[str] = Field(default=None, min_length=8, max_length=64)
    pack_id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{0,99}$")
    station: Station
    source: Optional[Source] = None
    op: str = Field(min_length=1, max_length=50)
    table_name: Optional[str] = Field(default=None, max_length=200)
    result: Dict[str, Any] = {}
    attempt_uid: Optional[str] = Field(default=None, max_length=64)

    model_config = ConfigDict(extra="forbid")


class JournalEntry(BaseModel):
    entry_uid: str
    pack_id: str
    station: str
    source: Source
    op: str
    table_name: Optional[str] = None
    result: Dict[str, Any] = {}
    attempt_uid: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
