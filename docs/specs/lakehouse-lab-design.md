# Lakehouse Lab — System Design

**Status:** Draft for review · **Date:** 2026-09-24 · **Implements:** [lakehouse-lab.md](lakehouse-lab.md) (PRD)

This document says *how* the PRD gets built inside PrepBench's existing architecture. Where the design answered or changed something in the PRD, it's listed in §9 and has been folded into the PRD.

---

## 1. Requirements recap

**Functional** (from the PRD, P0 unless marked):

| # | Capability | Real or simulated |
|---|---|---|
| F1 | Deterministic fictional dataset with planted defects and a manifest (the pack decides the schema and defects) | Real data, generated |
| F2 | Station C: a fixed list of allowed Delta operations on the real `deltalake` engine | **Real** |
| F3 | Stations A (ADF + Lakeflow), B (ADLS), F (Migration Factory), and I (Identity, P1) | Simulated |
| F4 | Upstream choices (A → batch manifest) change what C actually writes | Real, driven by the simulation |
| F5 | Predict → Manipulate → Observe → Explain on every station, with the prediction write-once | Existing `learning_attempts` |
| F6 | Structure checks on acceptance criteria (AI feedback is P1-6) | Deterministic |
| F7 | Lab journal: append-only, every entry labelled real or simulated, exportable to Markdown | Real |
| F8 | Databricks notebook export for Station C, marked unverified until checked on Free Edition | Generated |
| F9 | Scenario packs as content, separate from station code | — |

**Non-functional**

| Concern | Requirement |
|---|---|
| Optionality | Without `deltalake` installed: nothing extra downloaded, startup unchanged, default test suite green |
| Offline | No network calls from any Lab path. The engine is local. The notebook is exported, never pushed. |
| Data safety | Lab files never live beside `exam_simulator.db`. Tests redirect the lab folder before any `app.*` import (hard rule 1). |
| Honesty | Simulated output is never shown as a real run. Figures from simulations are labelled *teaching constants* (hard rule 2). |
| Determinism | Same seed and same levers → identical dataset, identical simulation output |
| Latency | Each engine operation under 1 s on about 5k rows, and the compaction demo under 15 s on a normal laptop |
| Platform | Windows first: paths with spaces (the user's home folder has one), file locks during reset, Python 3.14 |

**Constraints:** one learner and one local process (uvicorn with one worker). A small team (the author plus AI assistants). Existing stack: FastAPI + SQLAlchemy + SQLite, React 19 + MUI, pure-TypeScript simulation models (the Agile Metrics pattern).

## 2. High-level design

```
 ┌───────────────────────────── Browser (React) ─────────────────────────────────────┐
 │  pages/DatabricksSandboxPage.tsx   (/databricks-sandbox?station=a|b|c|f|i)         │
 │                                                                                    │
 │  components/lakehouse/*                      services/lakehouse/*  (pure TS)       │
 │   StationShell (predict→manipulate→          adfModel.ts      → BatchManifest      │
 │     observe→explain, shared)                 adlsModel.ts     → layout/access      │
 │   StationA/B/C/F/I panels                    factoryModel.ts  → program timeline   │
 │   EnginePanel (real results / "not           identityModel.ts → trust-path puzzle  │
 │     installed")                              couplings.ts     → ledger, typed      │
 │   JournalDrawer                              acChecks.ts      → structural checks  │
 │                                                                                    │
 │  services/learning/* (existing) ── challenge + concept registry for lab stations   │
 └──────────────┬─────────────────────────────────────────────┬──────────────────────┘
                │ /api/v1/learning/attempts  (existing)       │ /api/v1/lab/lakehouse/* (new)
 ┌──────────────▼─────────────────────────────────────────────▼──────────────────────┐
 │ FastAPI                                                                            │
 │  api/v1/learning.py (existing)        api/v1/lab_lakehouse.py (new, thin)          │
 │                                        │                                           │
 │                         services/lab/ ─┼─ pack_service.py     packs → content       │
 │                                        ├─ dataset_service.py  seed → rows+manifest  │
 │                                        ├─ engine.py           lazy deltalake adapter│
 │                                        ├─ operations.py       allow-list dispatch   │
 │                                        ├─ journal_service.py  append-only entries   │
 │                                        └─ notebook_service.py Databricks source     │
 │                                                                                    │
 │  models/lab_journal_entry.py (new table)   core/config.py: LAB_DIR + lab_path()    │
 └──────────────┬──────────────────────────────────────┬─────────────────────────────┘
                │ SQLite (existing DB: journal rows)    │ LAB_DIR (Delta tables on disk)
                ▼                                      ▼
        exam_simulator.db                    backend/data/lab/<pack>/<table>/_delta_log…
                                             (tests: temp folder, via PREPBENCH_LAB_DIR)
        backend/app/data/lab_packs/<pack_id>/manifest.json + content   (read-only)
```

**The split, and why:** the simulations run in the browser as pure TypeScript, and only the real engine, the dataset and the journal live on the server.
- It's the pattern the Agile Metrics sandbox already proved. The models are libraries, tested without rendering, and deterministic.
- Nothing in a simulation needs the server, so Stations A, B, F and I work fully even when the backend's optional engine is missing.
- The server does only what the browser can't: write real Delta tables to disk, and keep the journal in the database.

## 3. Data flow: one upstream mistake, end to end

```
1  GET  /lab/lakehouse/packs/semiconductor-v1          → pack (scenario, levers, defects list)
2  GET  /lab/lakehouse/packs/…/source-index            → [{id, modified_at, deleted}] ~5k rows
3  Station A (browser): adfModel(levers, sourceIndex)  → BatchManifest
        e.g. watermark-before-copy + failure at 60% ⇒ batch 2 is missing ids 3121–3380
4  POST /learning/attempts {challenge_id:'lakehouse.a.watermark-order', prediction}  (write-once)
5  POST /lab/lakehouse/ops {op:'append_batch', table:'bronze.defects',
                            batch: {index:2, ids:[…] | ref:'manifest'}, attempt_uid}
        server: dataset_service materialises exactly those rows (defects applied)
                → engine.write → real version 3, 2 850 rows
                → journal entry {source:'real_engine', op, version:3, rows:2850}
6  POST /lab/lakehouse/ops {op:'compare_tables', left:'legacy.defects', right:'bronze.defects'}
        → real row counts + per-column stats: 260 rows missing, values match
7  PATCH /learning/attempts/{uid} {manipulation, observed, explanation_text}
```

Nothing in steps 3–6 is invented: the browser decides *which* rows, and the server writes and measures *real* ones.

## 4. Deep dive

### 4.1 Scenario packs

```
backend/app/data/lab_packs/semiconductor-v1/
  manifest.json      id, title, "fictional": true, version, seed, stations enabled,
                     notebook_verified_on: null | "YYYY-MM-DD"
  scenario.md        the story (rendered with Explanation.tsx)
  dataset.json       tables, columns, row counts, defect specs (below)
  factory.json       job inventory sample, tier rules, domains, fixed event schedule
  identity.json      service accounts, realms, trust edges (P1)
  prompts.json       diagnostic + interview prompts (P1-3)
```

- The loader validates packs with Pydantic at startup and **skips an invalid pack with a logged reason**; it never crashes. This matches how the migrations are wrapped.
- Packs are served read-only through the API. Nothing about a pack is stored in the database, so a new version of a pack is just a file change.
- A future licensing model (PRD P2) hooks in at `pack_service.list()`. Station code never checks entitlement.

### 4.2 Dataset generation

`dataset_service.generate(pack, table) -> (rows, manifest)` uses `random.Random(pack.seed + table_name)`. It never uses the global RNG or wall-clock time, so the output is byte-identical every time (this is tested).

The defects are **declarative** in `dataset.json`, with rows picked by the seeded RNG:

```json
{ "id": "tz-shift", "kind": "timezone", "table": "defects", "column": "inspected_at",
  "legacy_tz": "Asia/Singapore", "affects": {"fraction": 0.12} }
{ "id": "null-agg", "kind": "null_handling", "table": "yield_daily", "column": "scrap_qty",
  "affects": {"count": 40} }
```

**Two copies of each table.** Every table exists as a `legacy.*` version, which is what the old Hive jobs produced, and a clean source version. The planted defects are the *difference* between the two. That's what lets row counts match while the values are wrong, and it's how Station D and the Factory's yield-wave validation get ground truth without running Hive.

**Size:** about 5k defect records and about 20k telemetry events. That's less than 5 MB on disk, so it's regenerated on demand rather than cached.

### 4.3 The engine adapter

```python
# services/lab/engine.py
def status() -> EngineStatus:            # never raises
    try:
        import deltalake                 # lazy, only here
    except ImportError:
        return EngineStatus(available=False, install_command=INSTALL_CMD)
    return EngineStatus(available=True, version=deltalake.__version__)
```

- **This is the only module that imports `deltalake`.** A test asserts that importing `app.main` doesn't load it (`"deltalake" not in sys.modules`).
- Writes take **`arro3.core.Table`** objects built from the generated rows. That avoids a pyarrow dependency, since pyarrow is optional in deltalake 1.x. *To confirm in the spike.*
- Reads and comparisons use deltalake's **`QueryBuilder`** (DataFusion SQL) over registered tables, with SQL written by the server from the allow-list and never taken from the client. *To confirm in the spike.*

### 4.4 The operation allow-list

`POST /api/v1/lab/lakehouse/ops` takes a **discriminated union** of request models (on `op`). Each maps to one handler:

| `op` | deltalake call (expected, to confirm in the spike) | Returns |
|---|---|---|
| `create_table` | `write_deltalake(path, batch, mode="overwrite")` | version, schema, rows |
| `append_batch` | `write_deltalake(path, batch, mode="append")`, with `schema_mode` absent (enforce) or `"merge"` (evolve) | version, rows, **or the real error** |
| `merge_cdc` | `DeltaTable.merge(src, predicate on business key).when_matched_update_all().when_matched_delete(…).when_not_matched_insert_all().execute()` | metrics (inserted, updated, deleted) |
| `history` | `DeltaTable.history()` | version list |
| `read_version` | `DeltaTable(path, version=N)` + count/sample via `QueryBuilder` | rows, sample |
| `restore` | `DeltaTable.restore(N)` | new version |
| `compact` | `DeltaTable.optimize.compact()` / `.z_order(cols)` | files before/after |
| `vacuum` | `DeltaTable.vacuum(retention_hours, dry_run, enforce_retention_duration=False)` | files removed, **plus which versions can no longer be time-travelled to** |
| `compare_tables` *(new, see §9)* | two `QueryBuilder` aggregates | row counts; per-column sum/min/max/null count; mismatches |

- **Expected failures are results, not server errors.** A schema-enforcement rejection is a successful teaching outcome, so it returns `200 {ok:false, error:"<engine message>"}`. Misuse (unknown table, an attempt with no committed prediction) returns `400`. A missing engine returns `503` with the install command.
- **Table names come from the pack's allow-list** (`legacy.*`, `bronze.*`, `silver.*`) and resolve through `lab_path()`. The client never sends a filesystem path.
- **Enforcing prediction first:** if an op carries `attempt_uid`, the server checks that the attempt's prediction is committed and refuses with `400` if not. Ops without an attempt are allowed ("explore mode") and are still journaled.
- **Concurrency:** FastAPI runs sync endpoints in a thread pool, so a double-click could send two writes at once. A per-table `threading.Lock` serialises operations on a table. There's one process and one learner, so no cross-process lock is needed.

### 4.5 Lab data folder and path safety

```python
# core/config.py — same shape as RECORDINGS_DIR / recording_file()
LAB_DIR = Path(os.environ.get("PREPBENCH_LAB_DIR") or (DATA_DIR / "lab"))

def lab_path(pack_id: str, table: str) -> Path:   # refuses anything outside LAB_DIR
```

- **Tests redirect the folder:** `conftest.py` gets `os.environ.setdefault("PREPBENCH_LAB_DIR", tempfile.mkdtemp(...))` next to the recordings and secrets redirects, before any app import.
- **Reset** deletes `LAB_DIR/<pack>/` with a short retry on `PermissionError`, because Windows can briefly hold file handles. It never touches journal rows.
- **Landing files:** in v1 the ADLS landing zone is simulated only. Batches go straight from the generator into `bronze.*`, and no intermediate files are written (this answers open question 3).

### 4.6 Journal: a new table (answers open question 2)

Engine operations aren't learning attempts, and forcing them into `learning_attempts` would distort every mastery figure calculated from that table. So they get their own table:

```
lab_journal_entries
  id            INTEGER PK
  entry_uid     VARCHAR(64) UNIQUE      -- client or server generated; idempotent POST
  pack_id       VARCHAR(100)
  station       VARCHAR(10)             -- a | b | c | f | i
  source        VARCHAR(20)             -- 'real_engine' | 'simulation'   (never null)
  op            VARCHAR(50)
  table_name    VARCHAR(200) NULL
  result        JSON                    -- version, rows, files, error text, metrics
  attempt_uid   VARCHAR(64) NULL        -- link to learning_attempts, if any
  created_at    DATETIME (UTC, naive — matches existing models)
```

- **Append-only:** there's `GET` (list), `GET …/export.md`, and `DELETE /{uid}`, but no `PUT` or `PATCH`.
- **Server-side writes:** entries with `source='real_engine'` are written *by the server* inside the op handler, never posted by the client. A client can't claim a real run it didn't do.
- **Client-side writes:** simulation stations `POST` their entries with `source` forced to `simulation`.
- **Migration:** added by `create_all` for fresh installs, plus an idempotent step in `apply_lightweight_migrations()`, wrapped like the others.

### 4.7 Simulation models (browser)

These follow the `services/metrics/` conventions exactly:
- pure functions
- no React
- no network
- no randomness, only fixed schedules

Each station declares its effects in a **coupling ledger** of `arithmetic | assumption | convention` entries. There's a completeness test (every assumption reaches the UI) and a composition-count test, so an edge can't slip in as arithmetic by default.

| Model | Input | Output |
|---|---|---|
| `adfModel` | levers, source index | `BatchManifest` (ids per batch, missed ids, duplicated ids), trigger timeline |
| `adlsModel` | levers, access request | layout tree, rename cost (hierarchical namespace on vs off), effective permission for a principal on a path |
| `factoryModel` | inventory, tier guesses, wave order, levers | per-wave timeline, velocity, cost (teaching constants), incidents from the fixed event schedule |
| `identityModel` (P1) | accounts, realms, trust edges, plan | which accounts fail to get a token at cutover |

**Linking F to C:** when a yield wave reaches Validate, `factoryModel` emits `{link:'station-c', compare:['legacy.yield_daily','silver.yield_daily']}`. The page routes to Station C with that preset, and the learner runs the real `compare_tables`.

### 4.8 Acceptance-criteria checks

`acChecks.ts` is a pure function that returns `{check, passed, hint}` for Given/When/Then shape, a numeric threshold, a failure or rollback clause, and an owner or sign-off. The UI calls these **structure checks**. There's no AI in v1 (see §9).

### 4.9 Notebook export

`GET /api/v1/lab/lakehouse/packs/{id}/notebook?station=c` returns a Databricks-source `.py` file: a `# Databricks notebook source` header, `# COMMAND ----------` cell separators, and `# MAGIC %sql` for SQL cells. It's rendered from a template per operation in the allow-list, in the same order as the station. The header comment and the UI both show **"Unverified"** until the pack's `notebook_verified_on` is set by hand after running it on Free Edition.

### 4.10 API summary

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/lab/lakehouse/engine` | `{available, version, install_command}`, never 5xx |
| GET | `/api/v1/lab/lakehouse/packs` | list (id, title, fictional, stations) |
| GET | `/api/v1/lab/lakehouse/packs/{id}` | full pack content |
| GET | `/api/v1/lab/lakehouse/packs/{id}/source-index` | ids, modified_at, deleted flag, for the simulations |
| POST | `/api/v1/lab/lakehouse/ops` | allow-listed op; 503 if no engine |
| POST | `/api/v1/lab/lakehouse/packs/{id}/reset` | deletes lab tables, keeps journal |
| GET | `/api/v1/lab/lakehouse/packs/{id}/notebook` | file download |
| GET, POST | `/api/v1/lab/lakehouse/journal` | list / add a simulation entry |
| GET | `/api/v1/lab/lakehouse/journal/export.md` | Markdown |
| DELETE | `/api/v1/lab/lakehouse/journal/{uid}` | the only mutation allowed |

`docs/api/openapi.json` is regenerated with the redirected export script, and the contract test is re-run.

## 5. Scale and reliability

| Dimension | Estimate | Consequence |
|---|---|---|
| Users | 1 per install | No auth, no multi-tenant design, no cross-process locking |
| Data | < 5 MB generated; Delta tables < 50 MB, including history | Regenerate rather than cache; `vacuum` and reset keep it bounded |
| Op latency | tens of ms for most operations on 5k rows (to confirm in the spike) | Synchronous endpoints, no job queue |
| Compaction demo | ~50 small appends (not 200) to stay under 15 s | The number of appends is a pack setting |
| Install | +53 MB wheel, opt-in | Documented command, never automatic |

**Failure modes:**

| Failure | What happens |
|---|---|
| Engine missing | 503 on ops, and the UI shows "not installed" |
| Engine raises unexpectedly | The error is logged, the op returns `ok:false` with the message, and a journal entry is still written. Nothing is left half-done: Delta commits are atomic |
| Corrupt lab table | Reset fixes it, and the journal survives |
| Bad pack file | Skipped at load with a logged reason |
| Stale browser model after a pack update | Pack `version` goes into the attempt's `scenario_fingerprint`, so an old attempt is never compared with a new scenario |

**Monitoring:** there's no telemetry, by design. The server logs lab operations at INFO to the existing local log, and the journal *is* the learner-facing record.

## 6. Testing strategy

| Layer | Tests |
|---|---|
| Backend without the engine (default suite) | Engine status reports unavailable. Ops return 503. `app.main` import doesn't load `deltalake`. Packs load and validate. The dataset is byte-identical across runs. `lab_path` refuses `..` traversal and absolute paths. Journal is append-only (no PUT/PATCH route). The server refuses a `source='real_engine'` entry from a client. |
| Backend with the engine | `pytest.importorskip("deltalake")`, then each operation in the allow-list against the temp lab folder. A replayed batch gives duplicates on append and none on MERGE. Drift is rejected under enforcement and accepted with merge. `compare_tables` finds each planted defect listed in the manifest. Compaction reduces the file count. Vacuum then time-travel fails as expected. Paths with spaces work. |
| Frontend models | Vitest per model: determinism, ledger completeness and composition counts, invariants (for example, the ids in a `BatchManifest` never exceed the source). `acChecks` cases. |
| E2E | `/databricks-sandbox` added to the accessibility, responsive and navigation `ROUTES`. A `databricks-sandbox.spec.ts` covering the station flow *without* the engine (CI default), so the honest fallback itself is tested. |
| CI | A second job installs `requirements-lab.txt` and runs `pytest -m lab`. This needs a `.github/workflows/ci.yml` change, which **the author must push** (hard rule 8). |

## 7. Trade-offs

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Where simulations run | Browser, pure TS | Server, Python | The proven pattern, works without the engine, no round trips, testable without rendering. The cost is that the dataset's *index* must be served to the browser. |
| Delta engine | `deltalake` (delta-rs) | PySpark + delta-spark | No Java, a 53 MB wheel, real protocol. The cost is that Spark-specific behaviour (for example Photon, `OPTIMIZE` SQL syntax) is covered only by the notebook export. |
| Legacy system | Generated "legacy" tables with planted differences | Emulate Hive | Hive locally is heavyweight and off-mission. The cost is that differences are *declared*, not emerging from a real engine, so the ledger must label them as such. |
| Landing zone | Simulated, no files | Real Parquet landing files | Avoids needing a Parquet writer without pyarrow. The cost is that "read from landing" isn't a real op; revisit with `arro3-io`. |
| Journal storage | New table | Extend `learning_attempts` | Keeps mastery figures uncontaminated. The cost is one more table and migration. |
| Where real-engine entries are written | Server | Client | A client can't claim a real run. No cost beyond the design. |
| Pack storage | Files in repo | DB rows | Content-as-code, easy to review, no migrations. The cost is that the learner can't author packs in the UI (not a v1 goal). |
| AI feedback on acceptance criteria | Deferred to P1 | P0 via an existing task | Adding an LLM task touches routing and settings UI. v1's value doesn't depend on it. |

## 8. What to revisit as it grows

- **Real landing files:** if Station B should read real files, add `arro3-io` for Parquet and make `land_batch` an op.
- **Azurite:** if ADLS access control needs to be *real*, emulate it with Azurite. Only the blob parts are faithful, so the ADLS Gen2 folder and ACL behaviour would still need checking.
- **Paid packs:** if packs become paid, add signed pack manifests (Ed25519, verified locally) at `pack_service.list()`, with no phoning home.
- **Pack authoring:** if learners want to write their own packs, add a JSON-schema-validated import flow, like the question importer.
- **Engine pinning:** if deltalake's API shifts across majors, pin in `requirements-lab.txt` and keep the adapter as the only point of contact.
- **Performance:** if compaction or history on larger packs gets slow, move ops to a background task with status polling. Not needed at v1 sizes.

## 9. PRD changes this design made

All six are folded into the PRD, in the sections listed.

| # | Change | PRD section |
|---|---|---|
| 1 | Add **`compare_tables`** to the allow-list. P0-8's link ("row counts pass, values fail") needs a real comparison op in v1, not only in Station D (P1-2). | P0-4, P0-8 |
| 2 | **Open question 2 answered:** a new `lab_journal_entries` table. Real-engine entries are written only by the server. | P0-10 |
| 3 | **Open question 3 answered:** no landing files in v1. Batches write straight to `bronze.*`. | P0-5 |
| 4 | **AI feedback on acceptance criteria moves from P0 to P1** (a new `LLMTask`). v1 ships structure checks only. | P0-9 |
| 5 | **Each dataset table has a legacy copy and a clean copy,** and the planted defects are the difference between them. This makes "legacy vs migrated" concrete. | P0-1 |
| 6 | The CI job that runs with the engine needs a workflow change **the author pushes** (hard rule 8). | P0-2 |

## 10. Spike checklist (Phase 0)

Run on Windows, in a *scratch* venv (not `backend/.venv`), Python 3.14, `uv pip install --system-certs deltalake==1.6.5`:

1. `write_deltalake` from an `arro3.core.Table` without pyarrow, to a path containing a space.
2. Append with a drifted schema: capture the enforcement error text. Then append with `schema_mode="merge"`.
3. MERGE with update, delete and insert clauses. Read the metrics.
4. `history`, `DeltaTable(path, version=N)`, `restore(N)`.
5. 50 small appends, then `optimize.compact()` and `z_order`. Count files before and after.
6. `vacuum` with retention 0 and enforcement off, then time-travel to a vacuumed version: capture the error.
7. `QueryBuilder` SQL aggregate over two registered tables, and how its results come back without pyarrow.
8. Time for each step. Delete the folder while nothing is open (Windows file locks).

Anything that fails changes §4.3–4.4 before Phase 1 starts.
