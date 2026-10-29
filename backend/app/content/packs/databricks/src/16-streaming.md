---
id: streaming
title: Structured Streaming - checkpoints, triggers, watermarks
summary: What a checkpoint stores and why each query needs its own, the triggers serverless allows, watermarks and output modes, foreachBatch, and how to replay or backfill without duplicates.
sources: §8, §2, §10, §21, §23
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 65 — Structured Streaming Checkpoints** (Full)
  - *Relevant sections:* Checkpoints: the stream's memory
  - *Learning evidence:* Explain what happens if two streams share a checkpoint, or if the checkpoint is deleted.
- **Topic 66 — Triggers, Watermarks and Output Modes** (Full)
  - *Relevant sections:* Triggers; Watermarks; Output modes
  - *Learning evidence:* Pick a trigger and output mode for an hourly incremental job and a running aggregate dashboard.
- **Topic 67 — foreachBatch and Exactly-Once** (Full)
  - *Relevant sections:* foreachBatch and exactly-once; Try it in Free Edition
  - *Learning evidence:* Write a foreachBatch MERGE and explain how it stays correct when a batch is retried.
- **Topic 68 — Recovery, Replay and Backfill** (Full)
  - *Relevant sections:* Replay, backfill and recovery
  - *Learning evidence:* Plan how to reprocess one bad week of data without duplicating rows downstream, naming each step's effect.

## Streams on Databricks
Structured Streaming uses the same DataFrame and SQL APIs as batch: you describe the query once and Spark runs it incrementally. Databricks runs it in **micro-batch mode** (the default, for ETL and analytics, with latency of seconds to minutes) or **real-time mode** (sub-second operational workloads, latency "as low as five milliseconds"). It also powers streaming tables in Lakeflow pipelines (chapter 17).

## Checkpoints: the stream's memory
A query's **checkpoint** (`.option("checkpointLocation", path)`, required before it runs) stores:

- **offsets**: what each micro-batch read from the source;
- **commits**: which micro-batches reached the sink, for exactly-once;
- **state**: running aggregations, joins and deduplication;
- the query's ID.

Rules that follow:

- **Each query needs its own checkpoint location. Never share one.** Two streams writing the same Delta table with one checkpoint fail with `DELTA_CONCURRENT_TRANSACTION` (chapter 24).
- **Deleting the checkpoint, or pointing to a new one, starts the query fresh**: it reprocesses its source from the beginning (or from its starting options).
- Some changes need a **new checkpoint**: changing the number or type of sources, Auto Loader paths or Kafka topics, the kinds of stateful operations, the state schema or the sink type. Adding or removing filters, or changing rate limits and trigger intervals, is generally safe.
- `display()` in a notebook uses a temporary checkpoint with no guarantees.

## Triggers
The trigger decides when micro-batches run; the four kinds are in the table below.

`Trigger.Once` is deprecated; use `availableNow`. **Serverless notebooks and jobs support only `availableNow` (and `Once`)**, so a scheduled job with `availableNow` is the standard serverless pattern; for continuous processing on serverless, use a continuous pipeline (chapter 17). Rate limits such as `maxFilesPerTrigger` and `maxBytesPerTrigger` cap each micro-batch's size.

| Trigger | What it does | Use it for |
|---|---|---|
| Unspecified (default) | A new micro-batch as soon as the previous one finishes | Continuous low-latency streams on classic compute |
| processingTime='10 seconds' | Micro-batches at a fixed interval | Continuous streams with less overhead |
| availableNow=True | Processes everything available now, in micro-batches, then stops | Scheduled incremental jobs: hourly, daily |
| realTime | Real-time mode | Sub-second operational workloads |

## Watermarks
A stateful query (aggregation, deduplication, stream-stream join) keeps state, and without a bound the state grows forever. A **watermark** bounds it:

```
events.withWatermark("event_time", "10 minutes").groupBy(window("event_time", "5 minutes")).count()
```

The engine tracks the latest event time seen and drops state older than the threshold. Records within the threshold are always processed; later ones might not be. A **shorter** watermark means lower latency and less state but less tolerance for late data; a **longer** one, the reverse. Set it long enough for the late data you must not lose.

## Output modes
Output modes only matter for stateful queries:

- **append** (default): emits only rows that won't change again; with a watermark, after the threshold passes.
- **update**: emits the rows that changed in this trigger.
- **complete**: rewrites the whole result every trigger; aggregations only, and poor at scale. Databricks suggests a materialized view instead (chapter 17).

Stream-stream joins support append only. So an hourly incremental load uses `availableNow` with append, and a running aggregate for a dashboard is usually better as a materialized view than as a `complete`-mode stream.

## foreachBatch and exactly-once
`writeStream.foreachBatch(fn)` calls `fn(batch_df, batch_id)` for every micro-batch, so you can run **batch** code on streaming data. It is required for **`MERGE` from a stream** and for sinks that don't support streaming.

```
def upsert(batch_df, batch_id):
    latest = batch_df.dropDuplicates(["order_id"])
    latest.createOrReplaceTempView("b")
    batch_df.sparkSession.sql("""
      MERGE INTO silver.orders t USING b s ON t.order_id = s.order_id
      WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *""")

stream.writeStream.foreachBatch(upsert).option("checkpointLocation", cp).trigger(availableNow=True).start()
```

`foreachBatch` gives **at-least-once** writes: after a failure, a micro-batch can run again. Make `fn` **idempotent** so a rerun changes nothing: a `MERGE` on a key (as above) is idempotent, a plain append is not. The function must also handle empty batches. (Writing straight to a Delta table with `toTable`, without `foreachBatch`, is exactly-once: the Delta sink records each batch in the log, chapter 3.)

## Replay, backfill and recovery
To reprocess data, know what each lever does:

- **Restarting from the checkpoint** re-runs the micro-batch that was planned before the failure, then continues. If it failed for lack of memory, scale up the compute first.
- **A new checkpoint** reprocesses the whole source: every row comes again, so the target must be overwritten or merged, not appended to.
- **A pipeline full refresh** clears a streaming table and reprocesses all source data; **resetting a flow's checkpoint** keeps the data and reprocesses the source (chapter 17).
- **`RESTORE` on a source table** re-adds old files, which a downstream stream reads as new data (chapter 4).
- **Auto Loader** can include existing files and run periodic **backfills** (`cloudFiles.backfillInterval`) to catch files it missed.

Reprocessing one bad week safely: fix the logic; delete or overwrite that week in the target (or prepare an idempotent `MERGE` on keys); replay only that week's source data in a separate batch or stream with its own checkpoint; check counts before and after. Never re-append data a target already holds.

## Try it in Free Edition
Using the bronze table from chapter 15 as a source, merge it into a silver table:

```
spark.sql("CREATE TABLE IF NOT EXISTS prep.lakehouse.al_silver (id BIGINT, name STRING)")
def upsert(df, batch_id):
    df.select("id", "name").dropDuplicates(["id"]).createOrReplaceTempView("b")
    df.sparkSession.sql("""MERGE INTO prep.lakehouse.al_silver t USING b s ON t.id = s.id
                           WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *""")
(spark.readStream.table("prep.lakehouse.al_rescue")
   .writeStream.foreachBatch(upsert)
   .option("checkpointLocation", "/Volumes/prep/lakehouse/files/al_meta/silver_cp")
   .trigger(availableNow=True).start().awaitTermination())
```

**What you should see:** `al_silver` has one row per id. Run it again: nothing changes (no new data). Now delete the checkpoint folder from the volume and run it again: the stream reprocesses everything, and because it's a `MERGE`, the table still has one row per id. With an append instead of a `MERGE`, you'd now have duplicates.

## Design trade-off
`availableNow` on a schedule gives most of streaming's benefits (incremental, exactly-once, checkpointed) at batch cost, and is the only option on serverless jobs. Continuous streams give lower latency at the cost of always-on compute. Pick by how fresh the data must be, not by habit.

## Interview takeaway
"A streaming query's checkpoint holds its offsets, commits and state, so every query needs its own, and deleting it means reprocessing from scratch. For scheduled incremental loads I use availableNow, which is also the only trigger serverless jobs support. Watermarks bound state for late data. foreachBatch lets me MERGE from a stream, but it's at-least-once, so the MERGE has to be idempotent on a key; then replays, restarts and backfills can't create duplicates."
