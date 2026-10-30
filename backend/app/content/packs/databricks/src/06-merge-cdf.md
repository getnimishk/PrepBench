---
id: merge-cdf
title: MERGE, deduplication and change data feed
summary: Upserts in one transaction, the one-source-row-per-target-row rule, insert-only merges that make replays safe, and reading a table's row-level changes.
sources: §4, §5, §10, §24
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 29 — MERGE Upserts** (Full)
  - *Relevant sections:* MERGE in one statement; One source row per target row; Insert-only merge: making replays safe; Try it in Free Edition
  - *Learning evidence:* Write a MERGE that applies a CDC batch, then make it fail with a duplicate key and fix the source.
- **Topic 30 — Change Data Feed** (Full)
  - *Relevant sections:* Change data feed
  - *Learning evidence:* Enable CDF on a table, run an UPDATE and read the change rows with their _change_type.

## MERGE in one statement
`MERGE INTO` applies inserts, updates and deletes from a source to a target **in one transaction**:

```
MERGE INTO silver.customers AS t
USING updates AS s
ON t.customer_id = s.customer_id
WHEN MATCHED AND s.op = 'DELETE' THEN DELETE
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
WHEN NOT MATCHED BY SOURCE AND t.active = true THEN UPDATE SET active = false;
```

- **`WHEN MATCHED`**: at most one update and one delete action, each with an optional condition, evaluated in order; every clause except the last needs a condition. A matched row that meets no clause is left unchanged.
- **`WHEN NOT MATCHED`**: insert only. Target columns you don't set get `NULL`.
- **`WHEN NOT MATCHED BY SOURCE`**: update or delete target rows the source doesn't have. It can't read source columns, and Databricks recommends giving it a condition, or it may rewrite the whole target.
- **`UPDATE SET *` and `INSERT *`** assume the source has the target's columns; otherwise the statement fails analysis unless schema evolution is on (`MERGE WITH SCHEMA EVOLUTION`, chapter 5).

## One source row per target row
**Only one source row may match a given target row.** If two source rows match the same target row, the result would be ambiguous, so the merge fails with `DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE`. This is the most common `MERGE` failure in CDC loads, where a batch holds several changes for one key.

The fix is in the source, not the merge: keep **one row per key**, normally the latest by a sequence or timestamp column, before merging. For CDC feeds where order and late events matter, declarative pipelines' **AUTO CDC** does this for you with `SEQUENCE BY` (chapter 17).

## Insert-only merge: making replays safe
If a batch might be loaded twice (a retry, a repaired job, a replayed file), an append would duplicate it. An **insert-only merge** appends only rows not already there:

```
MERGE INTO logs USING new_logs
ON logs.unique_id = new_logs.unique_id
WHEN NOT MATCHED THEN INSERT *;
```

Run it twice and the second run inserts nothing. This is the documented way to avoid duplicates when a batch is replayed, and it pairs with `foreachBatch` in streaming (chapter 16).

## Change data feed
**Change data feed (CDF)** records **row-level changes between versions** of a table. Each change row carries the data plus:

Uses: incremental ETL that processes only changed rows, audit trails, and feeding changes downstream.

- **Reading:** in batch, `SELECT * FROM table_changes('t', 5)` or `spark.read.option("readChangeFeed", "true")`; incrementally, `spark.readStream.option("readChangeFeed", "true").table("t")`. Databricks recommends the streaming read, which tracks versions for you; a new stream first returns the current table as `insert` rows, then the changes.
- **Two ways to have it (2026):** **automatic CDF** computes changes at read time from row tracking (Databricks Runtime 19 and above, on Unity Catalog Delta tables with row tracking), with no per-table setting and no write cost. **Legacy CDF** is switched on per table with `TBLPROPERTIES (delta.enableChangeDataFeed = true)` and records changes on write. Databricks recommends moving to automatic CDF; the two can't be combined.
- **Limits:** CDF only covers changes **after it was enabled**, so it is not a permanent record. Legacy change files live in `_change_data` and are removed by `VACUUM` with the table's retention (chapter 4). A query can't span a rename, drop or type change. Automatic CDF isn't supported on tables with row filters or column masks.

| Column | Values |
|---|---|
| _change_type | insert, update_preimage, update_postimage, delete |
| _commit_version | the table version of the change |
| _commit_timestamp | when that version was committed |

## Try it in Free Edition

```
CREATE TABLE prep.lakehouse.customers (id INT, name STRING)
  TBLPROPERTIES (delta.enableChangeDataFeed = true);
INSERT INTO prep.lakehouse.customers VALUES (1, 'Ana'), (2, 'Ben');
CREATE OR REPLACE TEMP VIEW updates AS
  SELECT * FROM VALUES (2, 'Benjamin'), (3, 'Chloe') AS v(id, name);
MERGE INTO prep.lakehouse.customers t USING updates s ON t.id = s.id
  WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *;
SELECT id, name, _change_type, _commit_version
  FROM table_changes('prep.lakehouse.customers', 1) ORDER BY _commit_version, id;
```

**What you should see:** two `insert` rows (Ana and Ben) at version 1, then at version 2, the merge, an `update_preimage` and an `update_postimage` for id 2 and an `insert` for id 3.

Now make the merge fail: replace the view with two rows for id 2, `(2, 'B1'), (2, 'B2')`, and run the `MERGE` again. **What you should see:** `DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE`. Fix it by keeping one row per id before merging.

## Design trade-off
`MERGE` is powerful but rewrites every file that holds a matched row, so a merge that matches rows scattered across the table rewrites much of it. Clustering the target on the merge key (chapter 7) and keeping the source small and deduplicated keep merges cheap.

## Interview takeaway
"MERGE does upserts and deletes in one atomic commit, but only one source row may match each target row, so CDC batches must be deduplicated to the latest change per key first, or handled by AUTO CDC. For replay safety I use an insert-only merge on a unique key, which turns a duplicate load into a no-op. Change data feed gives row-level inserts, update pre- and post-images and deletes between versions, but only from when it was enabled, so it's a pipeline feed, not an audit archive."
