---
id: production
title: Running Databricks in production
summary: Streams that restart themselves, notifications that reach someone, a path from alert to cause, the error families you will meet, and the platform decisions behind a reliable lakehouse.
sources: §23, §24, §2, §8, §11, §20
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 91 — Running Streams in Production** (Full)
  - *Relevant sections:* Streams in production
  - *Learning evidence:* Review a streaming job's settings and list every change needed before it goes to production.
- **Topic 92 — Stateful Streaming in Production** (Full)
  - *Relevant sections:* Stateful streams
  - *Learning evidence:* Explain why raising spark.sql.shuffle.partitions didn't change a running stateful query, and what would.
- **Topic 93 — Notifications and Alerts** (Full)
  - *Relevant sections:* Notifications and alerts
  - *Learning evidence:* Set up notifications so a failing task in a multi-task streaming job is noticed within minutes.
- **Topic 94 — Troubleshooting a Failed Job** (Full)
  - *Relevant sections:* From alert to cause: a failed job
  - *Learning evidence:* Walk through a failed run step by step and decide whether repairing it is safe.
- **Topic 95 — Reading Errors: Conditions and SQLSTATE** (Full)
  - *Relevant sections:* Reading an error; Try it in Free Edition
  - *Learning evidence:* Catch TABLE_OR_VIEW_NOT_FOUND in Python by its condition and print its SQLSTATE in Free Edition.
- **Topic 96 — Write, Schema and MERGE Errors** (Full)
  - *Relevant sections:* Error family: writes, schemas and MERGE
  - *Learning evidence:* Reproduce DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE in Free Edition and fix it.
- **Topic 97 — Concurrent Write Conflicts** (Full)
  - *Relevant sections:* Error family: concurrent writes
  - *Learning evidence:* Name the likely cause and fix for each of five concurrent-write errors.
- **Topic 98 — Streaming Errors** (Full)
  - *Relevant sections:* Error family: streaming
  - *Learning evidence:* For each streaming error, say whether a restart, a new checkpoint, an option or more compute is the fix.
- **Topic 99 — File, History and Retention Errors** (Full)
  - *Relevant sections:* Error family: files, history and retention
  - *Learning evidence:* Explain how a too-short VACUUM retention turned into DELTA_FILE_NOT_FOUND_DETAILED for a stream.
- **Topic 100 — Query Profile and Query History** (Full)
  - *Relevant sections:* Query history and the query profile
  - *Learning evidence:* In Free Edition, open a slow query's profile and name its most expensive operator.
- **Topic 101 — Compute That Won't Start** (Full)
  - *Relevant sections:* Compute that won't start
  - *Learning evidence:* List the endpoints you would test from a VM in the workspace subnet, and why.
- **Topic 102 — Libraries and Init Scripts** (Full)
  - *Relevant sections:* Libraries and init scripts
  - *Learning evidence:* Move a library install out of an init script into a compute policy and explain the gain.
- **Topic 103 — Runtime Lifecycle and Upgrades** (Full)
  - *Relevant sections:* Runtime lifecycle
  - *Learning evidence:* Plan when a team on an LTS runtime must upgrade and what to test first.
- **Topic 104 — Environment Isolation and Catalog Strategy** (Full)
  - *Relevant sections:* Environments and catalogs
  - *Learning evidence:* Propose a dev/test/prod layout of workspaces and catalogs and name one trade-off.
- **Topic 105 — Encryption and Customer-Managed Keys** (Full)
  - *Relevant sections:* Encryption and customer-managed keys
  - *Learning evidence:* Say which key protects notebook source, cluster temp disks and the workspace storage account.
- **Topic 106 — High Availability and Disaster Recovery** (Full)
  - *Relevant sections:* High availability and disaster recovery
  - *Learning evidence:* Explain to a sponsor why a DR region didn't help when a bad job corrupted a table, and what would have.
- **Topic 107 — Testing Databricks Code** (Full)
  - *Relevant sections:* Testing
  - *Learning evidence:* Write one pytest test for a transformation function and run it from a Git folder.
- **Topic 108 — Capstone: End-to-End Medallion Pipeline** (Full)
  - *Relevant sections:* Capstone: an end-to-end medallion pipeline
  - *Learning evidence:* Run the pipeline in Free Edition, grant a reader group on gold, and explain every design choice to a reviewer.

## Streams in production
Databricks' production advice for Structured Streaming:

- Run streams as **scheduled Lakeflow Jobs or Lakeflow pipelines**, on **job compute**, never on all-purpose compute. Remove `display()` and `count()` calls from the notebook.
- Schedule the job in **Continuous** mode (the Jobs schedule, not the streaming trigger). It prevents concurrent runs, starts a new run after a failure, and retries with **exponential backoff**.
- **Don't enable autoscaling** for Structured Streaming jobs; it has limits when shrinking for streams.
- **Restart automatically on failure**, always: some features need it, such as Auto Loader's schema evolution (chapter 15).
- **Don't call `awaitTermination()`** in jobs: the Jobs service already keeps the run alive while a query is active, and the call blocks it from tracking the query (streaming backlog notifications need that).
- Several streams in one job: with multiple continuous tasks, a failed task retries on its own only if **Task retry mode** is **On failure**; otherwise the job waits until every task has failed, so **a failed stream can stay down while the job looks healthy**. Set On failure and task failure notifications, or give each critical stream its own job.
- On serverless, notebooks and jobs support only `availableNow`; for continuous streaming on serverless, use a continuous pipeline.

## Stateful streams
Stateful operations (streaming aggregations, `distinct`, `dropDuplicates`, stream-stream joins) keep state, and misconfigured state "can lead to unexpected latency and production problems".

- **RocksDB** is the default state store from Databricks Runtime 17.3; Databricks recommends it with **changelog checkpointing** for every stateful query. The state store type can't change between restarts without a new checkpoint.
- **The number of shuffle partitions is fixed when the checkpoint is created.** Raising `spark.sql.shuffle.partitions` later has no effect on that query. To change it you start with a new checkpoint (losing state), or on Databricks Runtime 18 LTS and above use on-demand state repartitioning. Databricks recommends 1-2 times the cluster's cores, and compute-optimised workers.

## Notifications and alerts
- **Job notifications** fire on start, success, failure, **duration over a threshold**, **streaming backlog over a threshold**, and continuous-job maintenance; to email or to destinations an admin configures (Slack, Microsoft Teams, PagerDuty, webhooks), up to three per event.
- **Job-level notifications aren't sent when a failed task is retried**, so for "tell me about every failure" use **task-level** notifications. A run that ends "Succeeded with failures" counts as success. Streaming backlog alerts use a 10-minute average and repeat every 30 minutes while it stays high.
- **Databricks SQL alerts** run a query on a schedule and notify when a condition on the result is met (states `OK`, `TRIGGERED`, `ERROR`): data quality, cost from system tables, warehouse health, audit events. An alert can also run as a **job task**, so later tasks branch on it.

So for a multi-task streaming job: task retry mode On failure, a **task-level failure notification** on each streaming task to the on-call channel, and a streaming backlog threshold.

## From alert to cause: a failed job
1. Open the job's **Runs** tab and **matrix view**; click the red task for its **task run details**: output, error message, metadata.
2. Classify the cause: data quality, misconfiguration, insufficient compute, an upstream source being down, or runs **skipped** at maximum concurrent runs.
3. Fix it: edit the task, resize the compute or change the instance type, ask for higher cloud quotas, or raise maximum concurrent runs.
4. Decide whether a **repair** is safe. Repair re-runs failed tasks and their dependents **from the beginning**, with the **current** settings. "Lakeflow Jobs doesn't make tasks idempotent": if the failed task appended part of its output, repairing duplicates it. Safe if the task overwrites, merges on keys or streams with a checkpoint; otherwise clean up its partial output first (chapter 18).
5. For a **continuous** job stuck in exponential backoff, the job page shows consecutive failures and the next retry; **Restart run** resets it.
6. If the job wrote bad data, roll the table back with `RESTORE` (chapter 4), remembering that streams reading it will see the restored files as new data.

## Reading an error
Every Databricks error has:

- an **error condition**, a stable name such as `TABLE_OR_VIEW_NOT_FOUND` (some with a subcondition after a dot);
- a five-character **SQLSTATE**, such as `42P01`;
- a message, with parameters filled in.

**Message text can change between releases**, so code should handle errors by condition or SQLSTATE, never by matching the message. In Python, `PySparkException` gives `getErrorClass()`, `getSqlState()` and `getMessageParameters()`; in SQL (Databricks Runtime 16.3 and above), `DECLARE EXIT HANDLER` and `GET DIAGNOSTICS`. The roadmap's Error Catalogue lists the conditions this guide covers, with cause and fix.

## Error family: writes, schemas and MERGE
| Condition | What it means | What to do |
|---|---|---|
| DELTA_INSERT_COLUMN_ARITY_MISMATCH | The data has a different number of columns from the table | Align the columns, or evolve the schema on purpose (chapter 5) |
| DELTA_FAILED_TO_MERGE_FIELDS | Two field definitions can't be merged during schema evolution | Cast the source, or change the table explicitly |
| DELTA_MERGE_INCOMPATIBLE_DATATYPE | Incompatible data types in a merge of schemas | Cast the source, or change the table explicitly |
| DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE | Several source rows match one target row | Deduplicate the source to one row per key (chapter 6) |
| DELTA_CANNOT_MODIFY_APPEND_ONLY | The table only allows appends | It was set append-only on purpose; change it only if updates are really allowed |
| CAST_INVALID_INPUT | A malformed value can't be cast | Fix the data, or use try_cast to get NULL |

## Error family: concurrent writes
These come from optimistic concurrency (chapter 3): no locks, so a conflicting commit fails rather than corrupting the table.

| Condition | What it means | What to do |
|---|---|---|
| DELTA_CONCURRENT_APPEND | A concurrent operation added data this transaction conflicts with | Retry; reduce overlap (row-level concurrency, clustering) |
| DELTA_CONCURRENT_DELETE_READ | Data this transaction read was deleted concurrently | Retry |
| DELTA_CONCURRENT_WRITE | New data was written since this transaction read the table | Try the operation again |
| DELTA_CONCURRENT_TRANSACTION | Several streams use the same checkpoint to write this table | One checkpoint per query; stop the duplicate run |
| DELTA_METADATA_CHANGED | A concurrent update changed the table's metadata | Retry; schedule schema and property changes away from writes |
| DELTA_PROTOCOL_CHANGED | A concurrent update changed the table's protocol | Retry; enable features at a quiet time |

## Error family: streaming
| Error | What it means | What to do |
|---|---|---|
| UNKNOWN_FIELD_EXCEPTION | Auto Loader found new fields (addNewColumns) | Let the job restart; it resumes with the new schema |
| CLOUD_FILE_SOURCE_FILE_NOT_FOUND | A notified file no longer exists | Don't delete landing files before they are processed |
| DELTA_SCHEMA_CHANGED | The source table's schema changed under the stream | Restart; if it repeats, the change is incompatible: new checkpoint |
| DELTA_STREAMING_INCOMPATIBLE_SCHEMA_CHANGE | Rename, drop or type change on a streamed table | Follow the documented options, such as a schema tracking location |
| DELTA_SOURCE_TABLE_IGNORE_CHANGES | An update or delete in a table read as a stream | skipChangeCommits to skip them, or a fresh checkpoint or full refresh to reflect them |
| Out of memory after a restart | The micro-batch planned before the failure runs again and is too big | Scale up the compute to get past it |

## Error family: files, history and retention
A typical chain: someone runs `VACUUM` with a retention shorter than 7 days (after disabling the safety check) while a stream is behind. The files the stream still needs are deleted, and its next batch fails with `DELTA_FILE_NOT_FOUND_DETAILED`: a file referenced in the log is missing. The fix is a new checkpoint (reprocessing), and the lesson is the 7-day minimum (chapter 4).

| Condition | What it means | What to do |
|---|---|---|
| DELTA_FILE_NOT_FOUND_DETAILED | A file in the log is missing: deleted by hand, or VACUUM with too short a retention | Never delete table files directly; restart with a new checkpoint |
| DELTA_VACUUM_RETENTION_PERIOD_TOO_SHORT | Retention below the safety threshold | Keep at least 7 days |
| DELTA_CANNOT_VACUUM_LITE | VACUUM LITE can't find all files from the log | Run VACUUM FULL |
| DELTA_TIMESTAMP_EARLIER_THAN_COMMIT_RETENTION | Time travel past the oldest kept version | Use a later timestamp; raise retention in advance |
| DELTA_CANNOT_RESTORE_TABLE_VERSION | The version is outside the available range | Choose a version in range |
| DELTA_UNSUPPORTED_FEATURES_FOR_READ | The table needs features this runtime or client lacks | Use a newer runtime or client (chapter 3) |

## Query history and the query profile
**Query history** lists queries with status (Queued, Running, Finished, Failed, Cancelled), compute, a duration breakdown (scheduling, optimization and file pruning, execution), aggregated task time and I/O. The **query profile** is the query's operator graph with time, rows and memory per operator, a **Top operators** panel and **performance insights**; it is how you spot "exploding joins or full table scans". There is no profile for results served from the query cache (change the query slightly to bypass it). You need to own the query or have `CAN MONITOR` on the warehouse.

## Compute that won't start
On Azure, a first cluster that never responds, with the event log saying "The compute plane network is misconfigured ... Node daemon ping timeout", means **routing or a firewall** stops the nodes reaching the control plane. Test from a VM in the workspace subnet with `nc -zv` to: the web application, the **SCC relay**, the artifact storage accounts, the **metastore on port 3306**, and the log storage; then check whether the firewall does SSL inspection (a request that works only with certificate checks disabled points at it). **`METASTORE_DOWN`** events point to a web application firewall or proxy in the path. The rules being tested are in chapter 23.

## Libraries and init scripts
- **Libraries** (Python, JAR, R) can be installed on a compute resource for all its notebooks and jobs. On Databricks Runtime 13.3 LTS and above with Unity Catalog, install them from **Unity Catalog volumes** on standard-access compute (JARs and Maven coordinates may need adding to an allowlist). Libraries in **DBFS** can be changed by any workspace user and are discouraged. Check what a runtime already includes in its release notes before adding anything.
- **Init scripts** run on each node before Spark starts, and **serverless doesn't support them**. Databricks recommends built-in features instead: **compute policies** to set configuration and to add libraries. If you must use init scripts: cluster-scoped rather than global, never to install libraries, pinned OS package versions, stored in volumes. Many init scripts slow down runtime upgrades.

So moving a library install from an init script into a compute policy gives every cluster under that policy the same, governed library, visible in one place, and removes a script that would have to be re-tested at every runtime upgrade.

## Runtime lifecycle
A Databricks Runtime version gets about **six months** of new features, then becomes **LTS** with stability and security fixes for **three years from its release**; end of support is three years after release, and removal a best-effort six months later. Platform features move through Legacy, Deprecated, End of Support and End of Life. Plan upgrades before end of support, and test first what you changed: init scripts, pinned libraries, configuration settings, and jobs with tight time limits.

## Environments and catalogs
The **workspace** is the primary processing environment and **catalogs** the primary data domain. Separate workspaces for development, staging and production (or for business units) give isolation: separate admins, stricter production settings, protection from resource limits. The costs: no notebook collaboration across workspaces, limits on workspace count, setup that must be automated (Terraform, ARM or REST), and expensive per-workspace network security. Storage locations can be set per metastore, catalog or schema to keep data physically apart. A common layout: one workspace per environment, catalogs per environment and domain (`sales_dev`, `sales_prod`), and production writable only by a service principal.

## Encryption and customer-managed keys
On Azure, **customer-managed keys** (Premium plan) from Azure Key Vault or Managed HSM protect three things:

- **managed disks**: temporary data on compute;
- **managed services**: notebook source and results, secrets, SQL queries and history, Git credentials, all stored in the control plane;
- the **DBFS root**: the workspace storage account.

Also on Premium: double (infrastructure) encryption for the DBFS root, and encrypting traffic **between worker nodes**, which is **not encrypted by default**.

## High availability and disaster recovery
- **High availability** is zone redundancy inside a region; the control plane recovers from a zone failure in about 15 minutes. **Disaster recovery** is a secondary workspace in another region with replicated data and configuration. Databricks recommends its **managed disaster recovery** for cross-region DR; active-passive is the common pattern.
- **RPO** (how much data loss is tolerable) and **RTO** (how fast service must return) are business decisions that size the solution.
- "A DR solution does not mitigate data corruption": corrupted data replicates to the secondary region too. That is why a DR region didn't help when a bad job corrupted a table; **time travel or backups** would have.
- Replicate managed table data with **Deep Clone**; don't rely on geo-redundant storage of the workspace's root storage.

## Testing
Unit test functions with **pytest** (Python) and with SQL user-defined functions for SQL. Databricks recommends keeping Python functions and their tests **outside notebooks**, as files in a Git folder, with functions that return one predictable result.

```
# transforms.py
def add_total(df):
    return df.withColumn("total", df.price * df.qty)

# test_transforms.py
from pyspark.sql import SparkSession
from transforms import add_total

spark = SparkSession.builder.appName("unit-tests").getOrCreate()

def test_add_total():
    df = spark.createDataFrame([(2.0, 3)], "price DOUBLE, qty INT")
    assert add_total(df).collect()[0].total == 6.0
```

Files that aren't notebooks create their Spark session with `SparkSession.builder.getOrCreate()`. To run the tests, open a notebook in the same Git folder, run `%pip install pytest` in the first cell, and in the second the documented call:

```
import pytest, sys
sys.dont_write_bytecode = True
retcode = pytest.main([".", "-v", "-p", "no:cacheprovider"])
assert retcode == 0, "The pytest invocation failed. See the log for details."
```

## Try it in Free Edition
1. Catch an error by its condition:

```
from pyspark.errors import PySparkException
try:
    spark.sql("SELECT * FROM prep.lakehouse.does_not_exist").show()
except PySparkException as ex:
    print(ex.getErrorClass(), ex.getSqlState())
```

**What you should see:** `TABLE_OR_VIEW_NOT_FOUND 42P01`.

2. Reproduce the duplicate-key `MERGE` from chapter 6 and fix it by deduplicating the source.
3. Run a slow query on the SQL warehouse (the skew example from chapter 19), open it from **Query History**, and find its most expensive operator in the profile.

## Capstone: an end-to-end medallion pipeline
Build, in Free Edition, one governed pipeline that uses most of this guide:

1. **Land** files in a volume (chapter 9).
2. **Bronze:** a streaming table with Auto Loader, keeping rescued data and the source file name (chapters 15 and 17).
3. **Silver:** a streaming table with expectations (drop invalid rows, fail on missing keys) and, for a change feed, AUTO CDC (chapter 17).
4. **Gold:** a materialized view aggregating silver (chapter 13).
5. **Orchestrate** it with a job: the pipeline task, then a SQL task, with a cleanup task on All done and a failure notification (chapter 18).
6. **Govern** it: grant a reader group `USE CATALOG`, `USE SCHEMA` and `SELECT` on gold only, and mask one sensitive column (chapter 10).
7. **Observe** it: the event log's expectation metrics, `DESCRIBE HISTORY` of each table, and the job's run history (chapter 20).
8. **Explain** it: for every choice (streaming table or materialized view, the expectations' actions, the trigger, the grants), say why, as you would to a reviewer.

## Design trade-off
Production readiness is mostly about failure: streams that restart themselves, tasks that are safe to rerun, notifications at the task level, retention long enough to recover, and a tested way back. Each of these costs something (always-on jobs, longer retention, more alerts, a second region), so match them to how much the business loses when the data is late or wrong.

## Interview takeaway
"In production, streams run as continuous jobs on job compute, without autoscaling or awaitTermination, and with task retry On failure and task-level notifications, because otherwise one stream can be down while the job looks healthy. Stateful streams use RocksDB with changelog checkpointing, and their shuffle partitions are fixed by the checkpoint. When something fails I go from the matrix view to the task's error, handle it by error condition, not message, and only repair tasks that are idempotent. And DR protects against losing a region, not against bad data: for that we need time travel retention and backups."
