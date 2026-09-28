# Lakehouse Lab Phase 1A Gate Report — Backend Foundation and Station C Engine API

**Date:** 2026-09-28 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-lab-phase-1a`

**Ruling:** everything the server owns for Station C works and is tested, with no UI yet: the
pack, the deterministic dataset with its ground truth, the optional engine behind a lazy adapter,
the nine allow-listed operations on real Delta tables, the append-only journal and the notebook
export. PRD P0-1, P0-2, P0-3, P0-4, P0-10 (server side) and P0-11. **Gate decision: PASS**, with
two items handed to the author (the CI job, and verifying the notebook on Free Edition).

---

## Audit: what the gate found before it passed

1. **`deltalake==1.6.5` has been yanked upstream** ("Issue: #4784"). The plan and the Phase 0
   spike pinned it. `requirements-lab.txt` pins **1.6.6**, the current release, and the engine
   tests re-assert every spike finding on it (all hold).
2. **A new form of spike finding 1.** On 1.6.6, `QueryBuilder`'s `COUNT(*)` (and `SUM(1)`) is
   answered from the transaction log's per-file statistics **without opening a file**. In the first
   HTTP transcript, reading the MERGE version whose files vacuum had removed returned "4,000 rows,
   ok". Found by reading the transcript, not by the tests (which read a sample too). Every count
   now reads a real column (`SUM(CASE WHEN col IS NULL THEN 1 ELSE 1 END)`), which fails when the
   files are gone; a test pins both halves (the lab's count fails, a bare `COUNT(*)` still
   "succeeds").
3. **Engine errors carried the learner's home folder** (`C:/Users/<name>/…`) into results and the
   exportable journal. The lab folder's path is now replaced by `<lab>`; tested.
4. Code review (`code-review` at high): 6 findings, all fixed — see below.

## Implemented

| Plan task | Where |
|---|---|
| `LAB_DIR` from `PREPBENCH_LAB_DIR` (default `data/lab`), `lab_path()` / `lab_pack_dir()` refusing anything outside it | `core/config.py` |
| conftest redirect above the first `app.*` import (a temp folder **with spaces in its name**) | `tests/conftest.py` |
| Optional dependency, `lab` marker | `requirements-lab.txt` (`deltalake==1.6.6`, `tzdata`), `pytest.ini` |
| Wiki: "Optional: Lakehouse Lab engine" | `docs/wiki/Development-Guide.md` (sync only after merge, rule 7) |
| Pack `semiconductor-v1` | `app/data/lab_packs/semiconductor-v1/`: `manifest.json` (`fictional: true`, seed, `notebook_verified_on: null`), `scenario.md`, `dataset.json` (2 tables, 8 planted defects), `factory.json` (stub carrying the open-question-9 decisions) |
| Pydantic models: pack, the operation union (discriminated on `op`), results, engine status, journal | `schemas/lab.py` |
| Pack loader: validates, **skips a bad pack with a logged reason**, never raises | `services/lab/pack_service.py` |
| Dataset: per-table/per-defect `random.Random`, no global RNG, no clock; clean, legacy, batches, change batch, manifest | `services/lab/dataset_service.py` |
| Typed columns through a SQL cast from a staging table | `services/lab/engine.py` (`_Staged`) |
| Engine adapter: the only module importing `deltalake`, lazily; `status()` never raises | `services/lab/engine.py` |
| The allow-list, per-table locks, 200 `ok:false` / 400 / 503 | `services/lab/operations.py` |
| An op with `attempt_uid` requires a committed prediction | `operations._check_attempt` (existing `learning_attempts`) |
| Journal table + idempotent migration; server-only real-engine writes; public POST refuses `real_engine` | `models/lab_journal_entry.py`, `core/database.py`, `services/lab/journal_service.py` |
| Notebook export, "UNVERIFIED" until `notebook_verified_on` is set | `services/lab/notebook_service.py` |
| API | `api/v1/lab_lakehouse.py`, in `router.py` |

**Operations** (the plan's list): `create_table`, `append_batch` (append or MERGE-upsert; enforce or
evolve the schema; optionally as the pack's many small writes — this is also the replay),
`merge_cdc`, `history`, `read_version`, `restore`, `compact` (optionally Z-ordered), `vacuum`,
`compare_tables` (row counts, per-column aggregates, **and a join on the business key with a
tolerance**, duplicates, rows only on one side).

**Dataset:** 5,000 defect records, 20,000 telemetry events. Legacy-vs-clean differences: precision
(300 rows, `yield_pct` at 2 dp), timezone (600 rows, +8 h), null handling (40 rows, `scrap_qty` 0
vs null). Batch patterns: a column added from batch 3, a change batch (25 updates, 10 deletes, 15
inserts), batch 2 replayed, 120 late telemetry events, telemetry batch 4 as 50 small writes.

**Decisions not in the plan:** a CSV download of each copy (`/packs/{id}/dataset/{table}.csv`), which
P0-11's "how to upload the dataset to a Volume" needs; `create_table` on an existing table replaces
it (and says so); `append_batch` and `merge_cdc` only on `bronze.*`; reset is **not** journaled (a
reset deletes files, it isn't an engine run, and the journal's "Real engine" label must stay true).

## Tests

| Suite | Result |
|---|---|
| Backend default suite, **without** `deltalake` (`backend/.venv`) | **877 passed**, 1 skipped (the engine file), 0 failed. Real `.db`/`-wal` hashes unchanged; no `backend/data/lab` folder created |
| Lab tests, **without** the engine (`test_lab_default.py`) | **34 passed**, 1 skipped (`test_lab_engine.py` skips itself) |
| Lab tests, **with** the engine (scratch venv: `requirements-dev.txt` + `deltalake==1.6.6`, `tzdata`) | **45 passed**, 1 skipped (the in-process "not loaded" check applies only without the engine) |
| `pytest -m lab` (engine suite alone, lab venv) | **12 passed** |
| OpenAPI | regenerated (env redirected, incl. `PREPBENCH_LAB_DIR`); 11 paths added, nothing removed or changed; contract test **2 passed** |
| Frontend (no files changed) | typecheck clean; lint 0 errors (the 28 existing warnings); **868/868** unit tests |
| Playwright full suite (no frontend change; the backend adds a startup migration) | **75/80** in 48.8 min; the 5 failures (accessibility dark, isolation, navigation, performance, roles) **all pass alone**: navigation 1/1 (3.9 min), accessibility 4/4, isolation + performance + roles 9/9. See "Failures during the phase" |

Default-suite tests (`test_lab_default.py`): only `engine.py` imports `deltalake`/`arro3`, and only
inside functions (static check); the running app hasn't loaded it; the lab folder is redirected;
`GET /engine` never errors and gives the install command; **every operation → 503** with nothing
journaled; misuse → 400/422/404 (unknown table, `..`, unknown op, extra fields like `sql`); an op
tied to an uncommitted or unknown attempt → 400; `lab_path` refuses traversal, absolute paths,
other drives, bad case, missing layer (10 cases); the pack loads and is fictional; the
open-question-9 decisions are in the pack; four kinds of broken pack are skipped with a log;
**byte-identical dataset** across runs (and different with another seed); **legacy and clean differ
in exactly the manifest's rows and columns**; the batch patterns match the manifest; source index
and CSV; the notebook is Databricks source and says UNVERIFIED; the journal has no PUT/PATCH; a
client can't post a real-engine entry; simulation entries are idempotent, listed, exported and
deletable; reset works without the engine and keeps the journal; the migration creates the table
like a fresh install (idempotent).

Engine tests (`test_lab_engine.py`, `@pytest.mark.lab`): the engine reports its version; typed
tables written under a path with spaces, **pyarrow never loaded**, `decimal(10,4)` and a UTC
timestamp; **schema enforcement's error text comes back verbatim** and is journaled, evolution
accepts the batch; **a replayed append makes 1,000 duplicates, MERGE on the key makes none**; the
change batch merges exactly 15/25/10; history, time travel, restore (a new version); **50 small
files compact to fewer**; vacuum is refused under 168 h, a dry run deletes nothing, then with the
check off **reading the vacuumed version fails — including a count alone**, while
`DeltaTable.count()` and a bare `COUNT(*)` still answer; **`compare_tables` finds exactly the
manifest's defects**, incl. the null-vs-zero rows that leave the sum identical; reset deletes the
folder on Windows after engine use; an op after a committed prediction runs and is linked; a
small-files batch that fails part-way reports the writes that landed.

## Transcript (a disposable server: scratch DB, lab folder with a space in its name, port 8212)

```
$ GET /engine
{"available":true,"version":"1.6.6","install_command":"uv pip install --system-certs -p backend/.venv/Scripts/python.exe -r backend/requirements-lab.txt","detail":null}
$ POST /ops {"op":"create_table","table":"bronze.defects"}
{"ok":true,"version":0,"rows":1000,"files":1,"elapsed_ms":537}
$ POST /ops {"op":"append_batch","table":"bronze.defects","batch":2}
{"ok":true,"version":1,"rows":2000,"files":2,"batch":2,"writes":1,"elapsed_ms":90}
$ POST /ops {"op":"append_batch","table":"bronze.defects","batch":2}
{"ok":true,"version":2,"rows":3000,"files":3,"batch":2,"writes":1,"elapsed_ms":102}
$ POST /ops {"op":"append_batch","table":"bronze.defects","batch":3}
{"ok":false,"version":2,"rows":null,"files":null,"error":"Cannot cast schema, number of fields does not match: 9 vs 8","batch":3,"elapsed_ms":51}
$ POST /ops {"op":"append_batch","table":"bronze.defects","batch":3,"schema_mode":"merge"}
{"ok":true,"version":3,"rows":4000,"files":4,"batch":3,"writes":1,"elapsed_ms":120}
$ POST /ops {"op":"merge_cdc","table":"bronze.defects"}
{"ok":true,"version":4,"rows":4000,"files":2,"batch":{"I":15,"U":25,"D":10},"elapsed_ms":120,"merge":{"num_target_rows_inserted":15,"num_target_rows_updated":33,"num_target_rows_deleted":15,"num_target_rows_copied":2952}}
$ POST /ops {"op":"history","table":"bronze.defects"}
{"ok":true,"version":4,"rows":null,"files":null,"elapsed_ms":24,"history":["4:MERGE","3:WRITE","2:WRITE"]}
$ POST /ops {"op":"read_version","table":"bronze.defects","version":0,"sample":0}
{"ok":true,"version":0,"rows":1000,"files":null,"elapsed_ms":27}
$ POST /ops {"op":"restore","table":"bronze.defects","version":1}
{"ok":true,"version":5,"rows":2000,"files":2,"restored_to":1,"elapsed_ms":71}
$ POST /ops {"op":"create_table","table":"bronze.telemetry"}
{"ok":true,"version":0,"rows":5000,"files":1,"elapsed_ms":76}
$ POST /ops {"op":"append_batch","table":"bronze.telemetry","batch":4,"small_files":true}
{"ok":true,"version":50,"rows":10000,"files":51,"batch":4,"writes":50,"elapsed_ms":6334}
$ POST /ops {"op":"compact","table":"bronze.telemetry"}
{"ok":true,"version":51,"rows":10000,"files":1,"files_before":51,"files_after":1,"elapsed_ms":546}
$ POST /ops {"op":"vacuum","table":"bronze.defects","retention_hours":0,"dry_run":false}
{"ok":false,"version":null,"rows":null,"files":null,"error":"Generic error: Invalid retention period, minimum retention for vacuum is configured to be greater than 168 hours, got 0 hours","elapsed_ms":13}
$ POST /ops {"op":"vacuum","table":"bronze.defects","retention_hours":0,"dry_run":true,"enforce_retention":false}
{"ok":true,"version":5,"rows":null,"files":2,"files_removed":0,"files_that_would_be_removed":3,"note":"Dry run: nothing was deleted. These files would be.","elapsed_ms":35}
$ POST /ops {"op":"vacuum","table":"bronze.defects","retention_hours":0,"dry_run":false,"enforce_retention":false}
{"ok":true,"version":7,"rows":null,"files":2,"files_removed":3,"note":"The retention check was turned off. Versions whose files were removed can no longer be read.","elapsed_ms":62}
$ POST /ops {"op":"read_version","table":"bronze.defects","version":4,"sample":0}
{"ok":false,"version":null,"rows":null,"files":null,"error":"External error: Parquet error: Parquet error: Failed to fetch metadata for file <lab>/semiconductor-v1/bronze/defects/part-00000-5fc8154a-93","elapsed_ms":31}
$ POST /ops {"op":"create_table","table":"legacy.defects"}
{"ok":true,"version":0,"rows":5000,"files":1,"elapsed_ms":81}
$ POST /ops {"op":"create_table","table":"silver.defects"}
{"ok":true,"version":0,"rows":5000,"files":1,"elapsed_ms":77}
$ POST /ops {"op":"compare_tables","left":"legacy.defects","right":"silver.defects"}
{"ok":true,"version":null,"rows":null,"files":null,"row_counts":{"left":5000,"right":5000},"row_counts_match":true,"duplicate_keys":{"left":0,"right":0},"values_match":false,"elapsed_ms":712,"mismatched_rows":{"yield_pct":300,"scrap_qty":40,"inspected_at":600}}
$ GET /journal/export.md (first 12 lines)
# Lakehouse Lab journal

Pack: semiconductor-v1

Every entry says where its result came from: **Real engine** means the Delta engine on this computer ran it; **Simulation** means a model in the browser worked it out.

- **2026-09-28 16:01 UTC** · Real engine · station C · `create_table` on `bronze.defects`
  - version: 0; rows: 1000; files: 1
- **2026-09-28 16:01 UTC** · Real engine · station C · `append_batch` on `bronze.defects`
  - version: 1; rows: 2000; files: 2
- **2026-09-28 16:01 UTC** · Real engine · station C · `append_batch` on `bronze.defects`
  - version: 2; rows: 3000; files: 3
```

Timings on this laptop: single operations 11–877 ms (the design's 1 s budget); the 50 small
writes 7.2 s and their compaction 0.7 s (budget 15 s).

## The CI lab job — for the author to push (hard rule 8)

The automation token can't push `.github/workflows/*`, so this job is **not** in the PR. Add it
to `.github/workflows/ci.yml` under `jobs:`:

```yaml
  backend-lab:
    name: Backend (Lakehouse Lab engine)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.14'
          cache: pip
          cache-dependency-path: |
            backend/requirements.lock
            backend/requirements-lab.txt

      # The locked tree plus the optional engine. requirements-lab.txt pulls
      # requirements.txt with -r; the lock keeps the rest identical to the
      # default job.
      - name: Install dependencies with the engine
        run: pip install -r requirements.lock deltalake==1.6.6 tzdata

      - name: Run the engine tests
        run: python -m pytest -q -m lab
```

The default `backend` job needs no change: it runs without `deltalake`, and the engine tests skip.

## Honesty review

- Every number the API returns is the engine's or the database's: counts are read from the data
  (see audit item 2), versions and file counts from the table, errors in the engine's own words.
- With no engine: 503 with the install command, and **nothing simulated in its place**; nothing is
  journaled.
- The journal's `source` is right on every entry: real-engine entries are written only by the
  operation handlers; the public POST forces `simulation` and refuses `real_engine`; a reset isn't
  journaled at all.
- Teaching constants: the only one so far is the 0.5× cost ratio in `factory.json`, labelled
  "Illustrative; check the current rate card" (Station F, Phase 2).
- The notebook says **UNVERIFIED** in its header and first cell. It has not been run on Databricks
  (PRD open question 8, the author's): Phase 1's PRD exit criterion "Notebook verified on Free
  Edition" is open.
- The pack is fictional and says so in `manifest.json`, `scenario.md` and the notebook.

## Code review (`code-review` at high, 6 findings, all fixed)

1. A small-files batch failing part-way reported the old version though writes had landed → the
   version is read back, and `writes_committed` is reported.
2. A dry-run vacuum said files were removed → "Dry run: nothing was deleted", `files_removed: 0`.
3. Reset ignored the per-table locks → it takes them all first.
4. Reset was journaled as a real-engine run, even without an engine → not journaled.
5. The dataset cache key re-serialised the spec on every call → keyed by pack id, version and seed.
6. A test imported `app.main` in a subprocess (hard rule 4) → a static import check instead.

Rejected: none.

## Failures during the phase

- **Full Playwright suite, 75/80.** Every failing screen is unrelated to this phase (no frontend
  code changed), and each spec passed when re-run alone. The run log shows the cause: the Vite dev
  server's proxy to the e2e backend failing with `socket hang up` and `ECONNRESET` on plain GET
  endpoints (`/api/v1/profile`, `/api/v1/notifications`, `/api/v1/design-reviews/1`). One page
  rendered blank for 15 s, another said "Could not load the interview rounds", and an import took
  5.6 s against a 5 s budget. A reset also appeared in the solo accessibility run (which passed) and
  in Phase 4's full run, before this code existed. Likely cause: uvicorn's 5 s keep-alive timeout
  closing sockets that Vite's proxy then reuses. Not fixed here (it isn't this phase's code, and
  raising timeouts would hide it); **offered to the author as a separate task**. No leftover
  processes of this session were running; another session's idle Vite server (port 5383) was.
- Engine tests: none failed. The COUNT(*) finding (audit item 2) came from the transcript.

## Not in this phase (by the plan)

No UI (Phase 1B). Stations A, B, F, I. The CI job (above, for the author). Verifying the notebook
on Databricks Free Edition (the author, open question 8).

## Session handoff

```
### Handoff — 2026-09-28
Phase: Lakehouse Lab 1A · Branch: feat/lakehouse-lab-phase-1a · PR: https://github.com/getnimishk/PrepBench/pull/42
Done: LAB_DIR + path safety; optional deltalake behind a lazy adapter; the semiconductor-v1 pack;
  the deterministic dataset with manifest; the nine operations on real Delta tables; the journal
  (server-only real entries); the notebook export (unverified); the API. Tests green with and
  without the engine; OpenAPI regenerated; transcript above.
Not done: the CI lab job (YAML above, for the author to push); notebook verification on Free
  Edition (the author).
Next step: after merge, Phase 1B (page shell, Station C UI, journal) per lakehouse-lab-plan.md §5.
Surprises / decisions made: deltalake 1.6.5 yanked -> 1.6.6; COUNT(*) answered from log statistics
  on 1.6.6 -> counts read a column; engine errors scrubbed of the local path; reset not journaled.
```
