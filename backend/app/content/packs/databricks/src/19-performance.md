---
id: performance
title: Performance - shuffles, skew, spill and the Spark UI
summary: Adaptive query execution, broadcast joins and shuffle partitions; diagnosing skew and spill from task metrics; salting; and the disk cache.
sources: §9, §12, §2
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 58 — AQE, Broadcast and Shuffle Partitions** (Full)
  - *Relevant sections:* Adaptive query execution; Broadcast joins and shuffle partitions
  - *Learning evidence:* Explain what AQE changes at runtime for a join between a large and a small table.
- **Topic 59 — Skew, Salting and Spill** (Full)
  - *Relevant sections:* Skew: one task doing most of the work; Spill: running out of execution memory
  - *Learning evidence:* Diagnose a skewed groupBy from task metrics and explain why AQE doesn't fix it but salting does.
- **Topic 60 — Disk Cache and the Spark UI** (Full)
  - *Relevant sections:* Reading a slow stage in the Spark UI; The disk cache
  - *Learning evidence:* Name the Spark UI metric that shows spill and the one that shows skew.

## Adaptive query execution
**Adaptive query execution (AQE)** is **on by default** (`spark.sql.adaptive.enabled = true`). At each shuffle or broadcast exchange it re-plans using the **real** sizes of the data so far:

- it switches a sort-merge join to a **broadcast hash join** when one side turns out to be small;
- it **coalesces** small post-shuffle partitions into fewer, larger ones;
- it **splits skewed partitions** in sort-merge and shuffle-hash **joins**;
- it propagates empty results.

It doesn't apply to streaming queries. So for a join of a large fact table with what turns out to be a small dimension, AQE can broadcast the small side at run time even if the plan expected a shuffle join.

## Broadcast joins and shuffle partitions
- A **broadcast join** sends the small table to every executor, so the large table doesn't move. Spark broadcasts automatically below `spark.sql.autoBroadcastJoinThreshold` (Apache Spark's default **10 MB**; `-1` disables it). You can hint it: `/*+ BROADCAST(dim) */`. The join strategy hints, in priority order, are `BROADCAST`, `MERGE`, `SHUFFLE_HASH`, `SHUFFLE_REPLICATE_NL`.
- **`spark.sql.shuffle.partitions`** is the number of partitions after a shuffle for joins and aggregations (Apache Spark's default **200**). Too few and each task is huge and spills; too many and you get tiny tasks and tiny files. Databricks suggests `auto`, so Spark chooses.
- Other parameters named in the exam guide: `spark.default.parallelism` (default partitions for RDD operations) and `spark.executor.memory` / `spark.driver.memory` (1g each in open-source Spark).

Databricks Runtime ships its own Spark build and can set its own defaults; the values above are Apache Spark's.

## Reading a slow stage in the Spark UI
The Spark UI shows a query's jobs, stages and tasks (chapter 12), executors, logs, and for streams a Streaming tab. For a slow stage, check the stage details and the task **Summary Metrics** (the symptoms are in the table below).

On a SQL warehouse, the **query profile** shows the same kind of information per operator (chapter 24).

| Symptom | Where you see it | What it means |
|---|---|---|
| Skew | Max task duration is 50% or more above the 75th percentile | A few partitions hold far more data than the rest |
| Spill | Spill statistics appear in the stage details at the top of the stage page | Execution memory ran out and data was written to disk |

## Skew: one task doing most of the work
**Skew** means a few keys hold most of the rows, so the tasks handling them run far longer than the rest and the stage waits for them. Fixes:

- **Let AQE split it**, but only in **joins**, and only above its thresholds (`spark.sql.adaptive.skewJoin.*`). Broadcast joins are never skew-optimised.
- **Salt** the hot key: add a random number to it (`customer_id || '_' || floor(rand()*8)`), aggregate by the salted key, then aggregate again by the real key. The work for one hot key is spread over eight tasks.
- **Liquid clustering** for a skewed stored table (chapter 7), and the `REBALANCE` hint for skewed output.

So for a skewed **`groupBy`**, AQE does nothing (it handles skewed joins, not aggregations), and salting is the fix. This is the reasoning behind the Associate exam guide's own sample question on skew.

## Spill: running out of execution memory
**Spill** happens when a task's execution memory runs out, mostly in shuffles, and data is written to disk and read back, which is slow. Remedies from Databricks' guide: `shuffle.partitions = auto`, process fewer rows or columns, more executor memory, fewer but larger workers for complex joins, and smaller micro-batches for streams.

## The disk cache
The **disk cache** (formerly "Delta cache" or "DBIO cache"; a Databricks feature, not part of Delta Lake) keeps local copies of Parquet files that workers read from cloud storage, so repeated reads are faster. It is automatic on supported worker types. Databricks recommends it over the Spark cache for repeated reads of Parquet and Delta data. `CACHE SELECT` is ignored on SQL warehouses and recent runtimes. "Disk cache vs Delta cache" is a comparison of a feature with its old name.

## Try it in Free Edition
Free Edition is serverless, where the classic Spark UI is limited; use the query profile instead.

```
CREATE OR REPLACE TABLE prep.lakehouse.skewed AS
  SELECT CASE WHEN id % 10 < 8 THEN 0 ELSE id END AS k, id AS v FROM range(2000000);
SELECT k, sum(v) FROM prep.lakehouse.skewed GROUP BY k ORDER BY 2 DESC LIMIT 5;
SELECT split(salted, '_')[0] AS k, sum(s) FROM (
  SELECT concat(k, '_', cast(floor(rand() * 8) AS INT)) AS salted, sum(v) AS s
  FROM prep.lakehouse.skewed GROUP BY 1) GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
```

**What you should see:** both queries return the same top keys, with key 0 holding 80% of the rows. Open each query's profile from query history and compare the aggregation steps; at this size the difference is small, and the point is the technique, not a benchmark.

## Design trade-off
Every tuning knob trades one cost for another: more shuffle partitions mean less spill but more overhead; broadcasting saves a shuffle but costs memory on every executor; salting fixes skew at the price of a second aggregation. Measure the stage first (skew or spill?), then change one thing.

## Interview takeaway
"For a slow stage I look at task metrics first: max duration far above the 75th percentile is skew, spill statistics on the stage page mean memory pressure. AQE, on by default, fixes a lot at run time: it broadcasts small join sides, coalesces partitions and splits skewed join partitions, but not skewed aggregations, so a skewed groupBy needs salting. For spill I let shuffle partitions be auto or give tasks more memory. And the disk cache is the old Delta cache under a new name."
