---
id: layout
title: Data layout: compaction, skipping, clustering
summary: OPTIMIZE, file statistics, Z-order, liquid clustering, deletion vectors and predictive optimization, and Databricks' advice that most tables need no partitions.
sources: §2, §22
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 31 — OPTIMIZE and Compaction** (Full)
  - *Relevant sections:* OPTIMIZE: compacting small files; Try it in Free Edition
  - *Learning evidence:* Write 50 small appends, run OPTIMIZE, and show the file count before and after in DESCRIBE DETAIL.
- **Topic 32 — Data Skipping and File Statistics** (Full)
  - *Relevant sections:* Data skipping: statistics per file
  - *Learning evidence:* Explain why a filter on column 40 of a wide table skips nothing, and two ways to fix it.
- **Topic 33 — Z-Order** (Full)
  - *Relevant sections:* Z-order: the older way to co-locate data
  - *Learning evidence:* Say when Z-order still makes sense today and why Databricks recommends liquid clustering instead.
- **Topic 34 — Liquid Clustering** (Full)
  - *Relevant sections:* Liquid clustering
  - *Learning evidence:* Create a liquid-clustered table, change its keys, and explain why old data isn't rewritten.
- **Topic 35 — Deletion Vectors** (Full)
  - *Relevant sections:* Deletion vectors
  - *Learning evidence:* Explain the steps to physically remove a customer's rows for a GDPR request on a table with deletion vectors.
- **Topic 36 — Predictive Optimization** (Full)
  - *Relevant sections:* Predictive optimization
  - *Learning evidence:* Explain what to change before enabling it on a table that needs 30 days of time travel.
- **Topic 37 — Partitioning on Databricks** (Full)
  - *Relevant sections:* Partitioning: usually don't
  - *Learning evidence:* Review a proposed partitioning scheme and say whether to keep, change or replace it with clustering.

## OPTIMIZE: compacting small files
Frequent small writes (streams, hourly loads) leave many small files, and many small files make reads slow (chapter 2). `OPTIMIZE t` rewrites them into fewer, larger files ("bin-packing" compaction).

- `OPTIMIZE t WHERE event_date >= '2026-10-01'` limits it to part of the table.
- Bin-packing is **idempotent**: running it twice on the same data does nothing the second time. It balances files by **size**, not row count.
- It makes **no data change**: readers on snapshot isolation get the same results before and after, and streams reading the table are not affected.
- With liquid clustering it also clusters data by the keys; with partitions it works inside each partition.
- How often: a cost/performance trade-off. Databricks suggests starting daily and adjusting, or letting predictive optimization decide. **Auto compaction** can compact small files automatically after writes.

In `DESCRIBE HISTORY`, auto compaction, liquid clustering and Z-ordering all appear as `OPTIMIZE`; the `operationParameters` (`auto`, `clusterBy`, `zOrderBy`) tell them apart.

## Data skipping: statistics per file
For every data file, Delta records **min, max, null count and record count** per column in the log (chapter 3), collected automatically on write. A query with `WHERE amount > 1000` skips every file whose maximum `amount` is lower.

- By default statistics cover only the **first 32 columns** of the table. A filter on column 40 skips nothing.
- Fix it by moving important filter columns into the first 32, or by naming the columns with `delta.dataSkippingStatsColumns` (or changing the count with `delta.dataSkippingNumIndexedCols`). Predictive optimization can also add statistics for frequently filtered columns on managed tables. `ANALYZE TABLE t COMPUTE DELTA STATISTICS` recomputes them.
- Skipping works best when similar values sit in the same files, which is what clustering is for.

## Z-order: the older way to co-locate data
`OPTIMIZE t ZORDER BY (customer_id)` rewrites files so rows with nearby values sit together, which improves data skipping on high-cardinality filter columns.

- Its effect drops with every extra column, and it is useless on a column without statistics.
- Unlike bin-packing, it is **not idempotent** (it rewrites again), and it balances files by row count.
- It can't be combined with liquid clustering, and predictive optimization never runs it.

**Databricks recommends liquid clustering instead of partitioning or Z-order for all new tables.** Z-order still appears on existing tables you'll inherit, which is the main reason to understand it.

## Liquid clustering
Liquid clustering "replaces table partitioning and `ZORDER`". Data is organised by **clustering keys**, and you can **change the keys without rewriting existing data**.

```
CREATE TABLE sales.events (event_id BIGINT, customer_id BIGINT, event_time TIMESTAMP)
  CLUSTER BY (customer_id, event_time);
ALTER TABLE sales.events CLUSTER BY (event_time);
OPTIMIZE sales.events;
```

- **Keys:** up to **four**; choose the columns most used in filters; of two highly correlated columns, one is enough; keys need statistics (by default, within the first 32 columns). Supported types include dates, timestamps, strings, numbers and struct fields by path; not maps, arrays or whole structs.
- **Incremental:** `OPTIMIZE` clusters only data that needs it. After changing keys, old data keeps its old layout until `OPTIMIZE t FULL` reclusters everything (which can take hours on a large table). `CLUSTER BY NONE` stops clustering without rewriting.
- **DataFrame API:** `df.write.clusterBy("col").saveAsTable(...)` only on create or overwrite, never on append; change keys with `ALTER TABLE`.
- **Automatic:** `CLUSTER BY AUTO` on Unity Catalog managed tables, with predictive optimization, lets Databricks choose keys from the query history (it may choose none if the table is small or already well laid out).
- **Fits:** high-cardinality filter columns, skewed data, fast-growing tables, concurrent writers, changing query patterns.
- **Cost:** it is not compatible with partitioning or Z-order, and it raises the table protocol (writer 7, reader 3), so older clients can't read the table (chapter 3).

An existing partitioned table can be converted with `ALTER TABLE t REPLACE PARTITIONED BY WITH CLUSTER BY (...)` (Databricks Runtime 18.1 and above) followed by `OPTIMIZE`; partition and Z-order columns usually become the clustering keys.

## Deletion vectors
Without deletion vectors, deleting or updating one row rewrites its whole Parquet file. With **deletion vectors**, the row is **marked** as deleted in a small side structure, and readers apply the mark at query time. `DELETE`, `UPDATE` and `MERGE` get much faster, and row-level concurrency reduces write conflicts.

- Enable with `TBLPROPERTIES ('delta.enableDeletionVectors' = true)`; workspace settings can enable them for new tables. Enabling upgrades the protocol.
- The marked rows are physically removed later by `OPTIMIZE`, auto compaction, or `REORG TABLE t APPLY (PURGE)`.
- **For a GDPR deletion**, the data must really leave storage: run the `DELETE`, then `REORG TABLE t APPLY (PURGE)` to rewrite the affected files, then `VACUUM` after the retention period to remove the old files (chapter 4).

## Predictive optimization
**Predictive optimization** runs `OPTIMIZE`, `VACUUM` and `ANALYZE` automatically on **Unity Catalog managed tables**, choosing which tables benefit, and collects statistics on write.

- On by default for accounts created from 11 November 2024; existing accounts by a rollout Databricks expected to complete by August 2026. It can be set at account, catalog, schema or table level, and lower levels inherit.
- Its `OPTIMIZE` **never runs Z-order**.
- Its `VACUUM` honours `delta.deletedFileRetentionDuration` but keeps **at least 7 days**. If a table needs 30 days of time travel, raise the property **before** enabling predictive optimization.
- It runs on serverless jobs compute, billed under a serverless SKU, and needs the Premium plan or above. With it on, Databricks recommends switching off your own scheduled `OPTIMIZE` jobs.

## Partitioning: usually don't
Unpartitioned Delta tables get **ingestion time clustering** automatically, which gives date-partition-like performance without tuning. Partitioning only suits low-cardinality columns such as dates or regions, never timestamps or IDs, and Delta transactions don't depend on partition boundaries the way Hive tables did. Databricks' guidance by table size:

| Table size | Databricks' advice |
|---|---|
| Under 1 TB | Don't partition |
| 1 TB to 100 TB | Use liquid clustering instead |
| 100 TB and more | Partitioning might help; try liquid clustering first and measure |
| Any partitioned table | Each partition should hold at least 1 GB |

## Try it in Free Edition
In a Python notebook:

```
t = "prep.lakehouse.small_files"
spark.sql(f"CREATE OR REPLACE TABLE {t} (id BIGINT, v DOUBLE)")
for i in range(50):
    spark.range(i * 10, i * 10 + 10).selectExpr("id", "rand() AS v").write.mode("append").saveAsTable(t)
display(spark.sql(f"DESCRIBE DETAIL {t}").select("numFiles", "sizeInBytes"))
spark.sql(f"OPTIMIZE {t}")
display(spark.sql(f"DESCRIBE DETAIL {t}").select("numFiles", "sizeInBytes"))
```

**What you should see:** a high `numFiles` after 50 appends (unless auto compaction already merged some), and far fewer after `OPTIMIZE`. Run `OPTIMIZE` again: nothing changes, because bin-packing is idempotent. Then `DESCRIBE HISTORY` shows the `OPTIMIZE` as a version with no data change.

## Design trade-off
Every layout technique trades write cost for read speed. Compaction and clustering rewrite files, which costs compute; skipping only pays off if queries actually filter on the clustered columns. Choose keys from real query patterns (or let `CLUSTER BY AUTO` do it), and check the protocol impact before enabling features on tables that external engines read.

## Interview takeaway
"Delta keeps min/max statistics per file for the first 32 columns, so filters skip files, and clustering makes that skipping effective by putting similar values together. Today that means liquid clustering, up to four keys that can change without rewriting old data, rather than partitions or Z-order. OPTIMIZE compacts small files and is idempotent; deletion vectors make deletes cheap, but a GDPR delete still needs REORG PURGE and VACUUM. Predictive optimization automates OPTIMIZE and VACUUM on managed tables, but keeps a 7-day minimum, so set retention first. And most tables under a terabyte shouldn't be partitioned at all."
