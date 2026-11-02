# Databricks Lab contract

**Status:** built 2026-10-30 on branch `feat/databricks-lab`, stacked on `feat/databricks-scenarios` (PR #119). All six
experiments are ready, so the lab is AVAILABLE.

**The learner's brief:** "Start the lab": the six beginner experiments planned in `DATABRICKS-GAP-REPORT.md` section 5.
The design choices below are the builder's. They follow the Kafka Lab contract (`KAFKA-LAB-CONTRACT.md`) and are
recorded here so a reviewer can check them.

## 1. What it is

A third lab on the shared experiment runner, beside the ADF Behaviour Lab and the Kafka Lab. It is for a preparation
with the `databricks` content pack attached. It has six experiments on the Associate exam topics that the Lakehouse Lab's
stations don't cover. Each runs the same eight stages:

1. Understand
2. Predict
3. Manipulate
4. Observe
5. Reason
6. Apply
7. Explain
8. Retrieve

It is a **teaching simulation, not a Databricks workspace**, and every screen says so. The guide's Free Edition steps
are where the learner does the real thing.

The Lakehouse Lab (`/databricks-sandbox`) is unchanged. Its stations, their ids and their routes are untouched. The
Databricks Lab is reachable from the Learning Lab hub and from the guide chapters, scenarios and roadmap topics it
practises.

### Goals
- Every rule a model applies is either:
  - a fact from `docs/research/databricks-documentation-notes.md`, through the guide chapter that teaches it; or
  - a labelled teaching convention.
- Every rule appears in a coupling ledger on screen.
- Every answer is graded from the model's own run.
- The ADF and Kafka labs keep their ids, routes and titles.

### Non-goals and anti-goals
- **Non-goals:**
  - No Spark, no Delta engine and no workspace: Station C's real Delta engine stays the place where Delta runs for real.
  - No new tables or endpoints.
- **Anti-goals:**
  - A model rule that contradicts the guide or the notes.
  - Any change to another lab's attempt ids.

## 2. Scope: six experiments, seven tracks

| # | Slug | Title | The idea it lands | Chapters | Topics |
|---|---|---|---|---|---|
| 1 | `retention` | Versions, retention and VACUUM | Time travel needs both a version's log entry (30 days by default) and its data files (7 days once VACUUM runs) | 3 `delta-log`, 4 `history` | 16, 23, 24, 25 |
| 2 | `auto-loader` | Auto Loader, schema changes and the checkpoint | addNewColumns stops on a new column and resumes on restart; rescue keeps going; the checkpoint is what makes each file load once | 15 `auto-loader`, 16 `streaming` | 64, 65 |
| 3 | `datasets` | Streaming tables and materialized views | A streaming table processes each row once and doesn't recompute; a materialized view stays correct; a full refresh rebuilds | 17 `pipelines` | 69, 72 |
| 4 | `jobs` | Retries, repair and duplicates | A retried or repaired task restarts from the beginning; an append duplicates, a MERGE doesn't | 18 `jobs` | 74, 76 |
| 5 | `skew` | Shuffle, skew and AQE | One hot key makes one slow task; AQE splits skewed join partitions, not aggregations; salting spreads an aggregation | 19 `performance`, 12 `spark` | 54, 58, 59 |
| 6 | `governance` | Privileges and dropped tables (two modes) | `grants`: reading needs SELECT, USE SCHEMA and USE CATALOG, and schema grants cover future tables. `drop`: an external table's files stay; a managed table can be undropped within its recovery period | 10 `access`, 9 `tables-storage` | 42, 39 |

Scope is six. Changing it is a product decision.

## 3. The experiments

"§n" is a section of the Databricks notes.

### E1. Versions, retention and VACUUM (`retention`)
- **Model:** a table written once a day by a MERGE; VACUUM runs daily. The learner wants the version from N days ago.
- **Levers:** age (3, 10, 25, 40 days); `delta.deletedFileRetentionDuration` (7, 30 days); `delta.logRetentionDuration`
  (30, 60 days).
- **Outcomes:**
  - `readable`;
  - `files-gone`: listed in history, but its files are vacuumed and the read is blocked;
  - `history-gone`: the log entry has been cleaned up.
- **Predict:** age 10 at the defaults gives `files-gone` (§2.2, §2.3).
- **Apply:** "Auditors need the table as of 25 days ago." This is right when the result is `readable`, which needs file
  retention raised to 30 days.
- **Retrieve:** the data files are kept for 7 days by default (chapter 4).

### E2. Auto Loader, schema changes and the checkpoint (`auto-loader`)
- **Model:** six files are loaded on day 1. On day 2, two new files arrive, one with a new column.
- **Levers:** `cloudFiles.schemaEvolutionMode` (addNewColumns, rescue, failOnNewColumns); task retry (off, on); the
  checkpoint (kept, deleted before day 2).
- **Outcomes:**
  - `stopped`: day 2's files are not loaded;
  - `new-column`: loaded, with the column added;
  - `rescued`: loaded, with the value in `_rescued_data`;
  - `reloaded`: the deleted checkpoint made day 1's files load again.
- **Predict:** addNewColumns, no retry, checkpoint kept gives `stopped` (§7.3).
- **Apply:** "Load day 2 once, with the new field as a column." Right when the result is `new-column`.
- **Retrieve:** addNewColumns is the default without a given schema (chapter 15).
- **Labelled convention:** a fresh start includes files already in the folder. The notes say Auto Loader can
  optionally include existing files, but don't state the default.

### E3. Streaming tables and materialized views (`datasets`)
- **Model:** orders are joined to a product dimension; a product's category then changes, or the query is changed.
- **Levers:** dataset (streaming table, materialized view); the change (dimension row updated, query changed); update
  (refresh, full refresh).
- **Outcomes:**
  - `current`: every row reflects the change;
  - `stale`: rows already processed keep the old value.
- **Predict:** a streaming table with the dimension updated and a normal refresh gives `stale` (§10).
- **Apply:** "Every order shows the current category." Right when the result is `current`.
- **Retrieve:** a full refresh clears a streaming table and reprocesses all source data (chapter 17).

### E4. Retries, repair and duplicates (`jobs`)
- **Model:** a three-task job: ingest, then transform, then publish, plus a cleanup task. Transform fails once,
  transiently, after writing half its rows.
- **Levers:** transform's retries (0, 1); its write (append, MERGE on a key); after a failed run, repair (no, yes).
- **Outcomes:**
  - `duplicated`;
  - `exact`;
  - `incomplete`: the run failed, and publish is Upstream failed.
- **Measures:** whether a person had to step in (repair).
- **Predict:** no retries, append, then repair gives `duplicated` (§11, §23.4).
- **Apply:** "Complete once, with no duplicates and no manual step." Right when the result is `exact` without a repair.
- **Retrieve:** repair re-runs only the unsuccessful tasks and their dependents (chapter 18).
- **The retry default:** the notes record a conflict about it (§19), so the model never states one. Retries are an
  explicit lever.

### E5. Shuffle, skew and AQE (`skew`)
- **Model:** a stage of 200 shuffle partitions over 10 million rows, where one key holds 200,000 rows.
- **Levers:** operation (sort-merge join, groupBy aggregation); AQE (on, off); salting (off, on, as a 16-way two-stage
  aggregation).
- **Outcomes:** `skewed`, when the max task is 50% or more above the 75th percentile; otherwise `even`.
- **Predict:** groupBy with AQE on gives `skewed` (§9).
- **Apply:** "Bring the slowest task near the rest." Right when the result is `even`.
- **Retrieve:** the skew signal from the Spark UI's Summary Metrics (chapter 19).
- **Labelled conventions:**
  - task time is proportional to rows;
  - AQE splits a skewed join partition into median-sized pieces;
  - salting is modelled for the aggregation only.

### E6. Privileges and dropped tables (`governance`, modes `grants` and `drop`)
- **`grants`:**
  - **Model:** analysts query `sales.retail.orders`.
  - **Levers:** where SELECT is granted (table, schema); USE SCHEMA (no, yes); USE CATALOG (no, yes).
  - **Outcomes:** `denied`; `this-table` (reads this table only); `whole-schema` (reads every current and future table
    in the schema).
  - **Predict:** SELECT on the table only gives `denied` (§6.3).
  - **Apply:** "This table and nothing else." Right when the result is `this-table`.
  - **Retrieve:** "Reading a table needs USE CATALOG, USE SCHEMA and SELECT" (chapter 10).
- **`drop`:**
  - **Model:** a table is dropped, and someone needs it back.
  - **Levers:** table type (managed, external); days since the drop (3, 10), with the recovery period at its default of
    7 days.
  - **Outcomes:** `undroppable` (UNDROP TABLE brings it back); `files-deleted`; `files-remain` (metadata gone, files
    still in storage).
  - **Predict:** an external table dropped 3 days ago gives `files-remain` (§6.2).
  - **Apply:** "Bring back a table dropped 3 days ago with UNDROP." Right when the result is `undroppable`.
  - **Retrieve:** what DROP TABLE does to an external table (chapter 9).

## 4. Shared architecture

The lab takes the same path as the Kafka Lab (`KAFKA-LAB-CONTRACT.md` section 4).

### Ids and routes

| Field | Databricks Lab |
|---|---|
| pack | `databricks` |
| attempt uid prefix | `dbl:` |
| challenge prefix | `databricks.lab.` |
| fingerprint key | `databricks-lab=` |
| routes | `/lab/databricks`, `/lab/databricks/:slug` |

### Persistence and evidence
- Attempts are stored in `learning_attempts` only.
- `portfolio_sources.py` recognises the lab's attempts. Evidence and Workspace name them from the frontend registry,
  with `ref.lab = "databricks"`.

### Availability and links
- A preparation with the `databricks` pack gets `learningLab` from the lab's status. The seeded Databricks skill already
  has the Lakehouse Lab, so its flags don't change.
- Guide chapters, scenarios and roadmap topics link to the experiments that practise them.

## 5. Tests
- **Models:** each is pure and deterministic. Every lever combination's outcome is one the prediction can name, and every
  finding's ledger id exists.
- **Grading and sources:**
  - Reason and Apply are graded from the model.
  - Every Retrieve quote appears word for word in its chapter of the pack.
  - Every `fact` coupling names a chapter that exists.
  - Every cited § exists in the notes.
- **Registry:** chapters and topics resolve in the pack's alignment blocks.
- **Ids:** they parse, and never meet the ADF lab's or the Kafka Lab's.
- **Backend:** a Databricks Lab attempt is titled and levelled in Evidence, and the other labs' attempts are unchanged.
- **Routes:** in the accessibility, responsive and navigation specs.
