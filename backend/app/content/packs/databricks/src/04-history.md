---
id: history
title: History, time travel, RESTORE and VACUUM
summary: Every write is a version you can query or restore, for as long as both its log entry and its data files are kept; VACUUM is where that ends.
sources: §2, §19
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 22 — Table History** (Full)
  - *Relevant sections:* Table history
  - *Learning evidence:* Use DESCRIBE HISTORY to find which version a bad UPDATE created and who ran it.
- **Topic 23 — Time Travel** (Full)
  - *Relevant sections:* Time travel; Try it in Free Edition
  - *Learning evidence:* Recover rows deleted by mistake using INSERT ... SELECT ... VERSION AS OF in Free Edition.
- **Topic 24 — Log Retention vs Deleted-File Retention** (Full)
  - *Relevant sections:* Two retention settings
  - *Learning evidence:* Set retention for a table that must support 30 days of time travel and justify both properties.
- **Topic 25 — VACUUM** (Full)
  - *Relevant sections:* VACUUM
  - *Learning evidence:* Predict which versions stay queryable after VACUUM with 7-day retention, then check with DRY RUN.
- **Topic 26 — RESTORE** (Full)
  - *Relevant sections:* RESTORE, and what it does downstream
  - *Learning evidence:* Restore a table in Free Edition and explain why a stream reading it might produce duplicates.

## Table history
Every operation that changes a table creates a **new version** (chapter 3). `DESCRIBE HISTORY t` returns them newest first, with the operation (`WRITE`, `UPDATE`, `MERGE`, `OPTIMIZE` ...), the user, the timestamp and the operation's parameters. `DESCRIBE HISTORY t LIMIT 1` shows only the last one. Catalog Explorer shows the same list on the table's History tab.

History is how you answer "what happened to this table, when, and who did it?" before you decide how to fix it.

## Time travel
You can query any version still available:

```
SELECT * FROM sales.orders VERSION AS OF 123;
SELECT * FROM sales.orders TIMESTAMP AS OF '2026-10-18T22:15:12.013Z';
SELECT * FROM sales.orders@v123;
```

In Python: `spark.read.option("versionAsOf", 123).table("sales.orders")`, or `timestampAsOf`. The version or timestamp must be a literal, not a subquery.

The documentation lists the uses: reproducing a report or model output exactly (audit), comparing a table over time, giving a set of queries one consistent snapshot, and **fixing mistakes**:

- Rows deleted by mistake: `INSERT INTO t SELECT * FROM t VERSION AS OF 122 WHERE ...`.
- A bad update: `MERGE INTO t USING t TIMESTAMP AS OF '...' AS old ON ... WHEN MATCHED THEN UPDATE SET *`.

Timestamp time travel normally uses file modification times; with **in-commit timestamps** (`delta.enableInCommitTimestamps`) the commit times are stored in the log itself, so they survive copying the log.

## Two retention settings
Time travel to a version needs **both** its log entry **and** its data files. Two table properties control how long each is kept:

With the defaults you can reliably time travel about **7 days**, not 30: after a `VACUUM`, older versions have lost their files. For 30 days of time travel, set `deletedFileRetentionDuration` to 30 days as well (longer retention costs storage). The log retention must be at least as long as the deleted-file retention, and recent runtimes **block** time travel to a version older than `deletedFileRetentionDuration`.

The documentation is explicit: **table history is not a long-term backup.**

| Property | Default | Keeps | Removed by |
|---|---|---|---|
| delta.logRetentionDuration | 30 days | the history (log entries) | automatic cleanup after checkpoints |
| delta.deletedFileRetentionDuration | 7 days | data files no longer in the table | VACUUM |

## VACUUM
`VACUUM t` deletes data files that are **no longer referenced** by the table **and** older than the retention threshold (default 7 days). It exists for storage cost and for compliance: removed files may still hold deleted or changed records.

- `VACUUM t DRY RUN` lists what would be deleted without deleting it.
- After `VACUUM`, versions older than the retention period **can no longer be queried**.
- `VACUUM` doesn't touch the log; log files are cleaned up automatically after checkpoints.
- It deletes everything in the table directory that Delta doesn't manage, **except** paths starting with `_` or `.`, so keep any checkpoint folder you put inside a table directory under a name like `_checkpoints`. Change data files in `_change_data` are vacuumed too.
- **Safety check:** Databricks "strongly recommends" at least 7 days, because long-running jobs may still be writing files that a shorter retention would delete. Going shorter means disabling `spark.databricks.delta.retentionDurationCheck.enabled`, and the error `DELTA_VACUUM_RETENTION_PERIOD_TOO_SHORT` is that check firing.
- **`VACUUM t LITE`** (Public Preview) uses the log instead of listing the directory; it needs a successful full `VACUUM` within the log retention, otherwise it errors and asks for `VACUUM FULL`.
- Predictive optimization runs `VACUUM` for you on Unity Catalog managed tables (chapter 7).

## RESTORE, and what it does downstream
`RESTORE TABLE t TO VERSION AS OF 122` (or `TO TIMESTAMP AS OF ...`) makes an old version the current one, as a **new** version. It needs `MODIFY` on the table. It fails if the data files of that version have been vacuumed.

The trap is downstream. A restore is a **data-changing** operation: it re-adds the old files. A stream reading the table sees those files as **new data** and can **produce duplicates** in its target. Before restoring a table that feeds a stream, decide what the stream should do: stop it and reset it, or deduplicate downstream (chapter 16).

## Try it in Free Edition

```
CREATE TABLE prep.lakehouse.tt_demo AS SELECT id, id * 10 AS amount FROM range(5);
DELETE FROM prep.lakehouse.tt_demo WHERE id < 3;
DESCRIBE HISTORY prep.lakehouse.tt_demo;
SELECT count(*) FROM prep.lakehouse.tt_demo VERSION AS OF 0;
INSERT INTO prep.lakehouse.tt_demo SELECT * FROM prep.lakehouse.tt_demo VERSION AS OF 0 WHERE id < 3;
SELECT * FROM prep.lakehouse.tt_demo ORDER BY id;
VACUUM prep.lakehouse.tt_demo DRY RUN;
```

**What you should see:** history with version 0 (the `CREATE TABLE AS SELECT`) and version 1 (the `DELETE`); version 0 still has 5 rows; after the `INSERT` the table has ids 0-4 again, as version 2. The `DRY RUN` lists no files, or files that can't be deleted yet, because nothing is older than 7 days.

Then try `RESTORE TABLE prep.lakehouse.tt_demo TO VERSION AS OF 1` and look at `DESCRIBE HISTORY` again: the restore is a new version, not a rewind.

## Design trade-off
Longer retention means a longer safety net for mistakes and audits, but more storage and slower `VACUUM`. Shorter retention saves money and removes deleted personal data sooner. Decide per table: a regulatory reporting table may justify 30 days or more, a scratch table the default. And for real backups, use a copy (for example Deep Clone, chapter 24), not history.

## Interview takeaway
"Every write is a version, so DESCRIBE HISTORY tells me what changed and who did it, and time travel or RESTORE can undo it. But time travel needs both the log entry, kept 30 days by default, and the data files, kept 7 days by default and removed by VACUUM, so in practice it's a 7-day safety net unless we raise deletedFileRetentionDuration. History isn't a backup. And a RESTORE re-adds old files as new data, so any stream reading that table may duplicate rows downstream."
