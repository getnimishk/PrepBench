---
id: pipelines
title: Lakeflow Spark Declarative Pipelines
summary: Declare streaming tables, materialized views and views, and the pipeline works out the order, the retries and the incremental refresh; expectations for data quality; AUTO CDC for change feeds.
sources: §10, §0, §8, §13
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 69 — Pipeline Datasets and Flows** (Full)
  - *Relevant sections:* What a declarative pipeline is; Datasets: streaming tables, materialized views, views; Flows
  - *Learning evidence:* For five transformations, say which dataset type each should be and why, and which flow writes it.
- **Topic 70 — Expectations** (Full)
  - *Relevant sections:* Expectations; Try it in Free Edition
  - *Learning evidence:* Add a drop and a fail expectation to a pipeline in Free Edition and read the data quality metrics.
- **Topic 71 — AUTO CDC and SCD Types** (Full)
  - *Relevant sections:* AUTO CDC: change feeds and SCD types
  - *Learning evidence:* Apply a CDC feed as SCD type 2 and show the history rows for one key.
- **Topic 72 — Refresh vs Full Refresh** (Full)
  - *Relevant sections:* Updates: refresh, full refresh, reset; Triggered or continuous
  - *Learning evidence:* Explain what a full refresh does to a streaming table whose source no longer holds old files.

## What a declarative pipeline is
**Lakeflow Spark Declarative Pipelines** (the product formerly called Delta Live Tables) is a declarative framework for batch and streaming pipelines in SQL and Python. It is built on open-source Apache Spark Declarative Pipelines and extends it (AUTO CDC, for example, is Databricks-only).

You **declare** the tables you want and the query that produces each one; the pipeline works out the rest:

- **Orchestration:** flows run in dependency order, with as much parallelism as possible.
- **Retries:** transient failures are retried at task, flow, then pipeline level.
- **Incremental processing:** materialized views reprocess only changed source data when possible.

In Python, `from pyspark import pipelines as dp` (older code uses `import dlt`, which still works).

## Datasets: streaming tables, materialized views, views
- **Streaming table:** each record is processed **exactly once**, assuming an **append-only** source. Use it for ingestion (Auto Loader, Kafka, Event Hubs) and low-latency transformations. It is a Unity Catalog managed table owned and updated by **one pipeline**. Rows already appended are **not reprocessed** when you change the query (only new rows see the change), unless you run a full refresh, and joins in a streaming table **don't recompute** when a dimension changes. It needs a naturally bounded stream or a watermark.
- **Materialized view:** results are recomputed as needed to match the source's current state, **incrementally when possible**, so it is "always correct at the time of their update", including late, updated and deleted source data. Use it for aggregations, joins, and sources that change. Latency is seconds to minutes; a changed function may need a manual full refresh.
- **View:** evaluated on demand, not stored, usable only inside the pipeline, for intermediate steps and checks.

Streaming tables and materialized views can also be created on their own in Databricks SQL; Databricks then manages a pipeline for each.

## Flows
A **flow** reads a source, transforms it and writes a target. Kinds: **append** flows (into streaming tables), **update** flows, **AUTO CDC** flows, and **materialized view** flows. **Sinks** stream out to Delta tables, Kafka, Event Hubs or custom Python destinations. A streaming table "can have one or more streaming flows (Append, AUTO CDC) written into it", and a materialized view one or more materialized view flows.

So, for five common transformations: raw file ingestion is a streaming table (append flow); cleaning bronze into silver row by row is a streaming table; applying a CDC feed is a streaming table written by an AUTO CDC flow; a daily revenue aggregate is a materialized view; a join with a slowly changing dimension that must stay correct is a materialized view.

## Expectations
An **expectation** is a named data quality rule, a SQL boolean expression, with an action for rows that fail it:

```
CREATE OR REFRESH STREAMING TABLE silver_orders (
  CONSTRAINT valid_amount EXPECT (amount > 0) ON VIOLATION DROP ROW,
  CONSTRAINT has_id EXPECT (order_id IS NOT NULL) ON VIOLATION FAIL UPDATE
) AS SELECT * FROM STREAM(bronze_orders);
```

Expectations can't call Python functions, external services or subqueries on other tables. Keeping failed rows for review (a quarantine table) is a pattern built on top. The three actions compare as follows.

| Action | SQL | Python | Invalid rows | Metrics |
|---|---|---|---|---|
| warn (default) | EXPECT (...) | @dp.expect | Written to the target | Counted |
| drop | ON VIOLATION DROP ROW | @dp.expect_or_drop | Dropped | Counted |
| fail | ON VIOLATION FAIL UPDATE | @dp.expect_or_fail | The update fails | Not recorded |

## AUTO CDC: change feeds and SCD types
**AUTO CDC** (which replaced `APPLY CHANGES`, with the same syntax; the old name still works) applies a change data capture feed to a streaming table:

```
CREATE OR REFRESH STREAMING TABLE customers_scd2;
CREATE FLOW customers_cdc AS AUTO CDC INTO customers_scd2
FROM STREAM(customers_changes)
KEYS (customer_id)
SEQUENCE BY change_ts
STORED AS SCD TYPE 2;
```

- **KEYS** identify the entity; **SEQUENCE BY** orders changes, so **out-of-order events** are applied correctly (a struct can break ties).
- **SCD type 1** overwrites: no history. **SCD type 2** keeps history: each change closes the previous row and opens a new one, for all columns or chosen ones.
- `AUTO CDC FROM SNAPSHOT` derives changes by comparing snapshots, for sources with no change feed.
- It needs serverless pipelines or the Pro or Advanced edition.

This is the managed answer to the `MERGE` duplicate-key and ordering problems of chapter 6.

## Updates: refresh, full refresh, reset
An **update** starts compute, validates the code (a **dry run** validates without writing), then refreshes datasets.

- **Refresh** (default): materialized views refresh, incrementally when cheaper; streaming tables process **new** records.
- **Full refresh:** materialized views recompute; streaming tables are **cleared**, their checkpoints reset, and **all source data reprocessed**. If the source no longer holds old files or events (expired retention, deleted landing files, a Kafka topic that kept seven days), a full refresh **loses that history**: the table is rebuilt only from what the source still has.
- **Reset streaming flow checkpoints:** checkpoints cleared, existing data **kept**, source reprocessed (so the target can get duplicates unless the flow is idempotent).

Every pipeline also writes an **event log** (audit, data quality, progress, lineage), queried with `SELECT * FROM event_log(<pipeline id>)` (chapter 20). All pipeline tables are Delta tables maintained by predictive optimization.

## Triggered or continuous
- **Triggered:** processes what is available when the update starts, then stops. For freshness of every 10 minutes, hourly or daily.
- **Continuous:** runs until stopped, with freshness from about 10 seconds to a few minutes.

Either mode can refresh either kind of dataset. Runs started from the editor reuse the cluster and don't retry, for fast debugging; runs from Jobs or the API, and every continuous run, retry and restart automatically and shut the cluster down when done.

## Try it in Free Edition
Free Edition allows one active pipeline of each type. Create a pipeline from **Jobs & Pipelines** in the sidebar, set its default catalog and schema to yours, and give it this SQL file:

```
CREATE OR REFRESH MATERIALIZED VIEW orders_src AS
  SELECT * FROM VALUES (1, 10.0), (2, -5.0), (3, 7.5) AS t(order_id, amount);

CREATE OR REFRESH MATERIALIZED VIEW orders_clean (
  CONSTRAINT positive_amount EXPECT (amount > 0) ON VIOLATION DROP ROW
) AS SELECT * FROM orders_src;
```

**What you should see:** after the update, `orders_clean` has two rows; the pipeline's data quality view shows one row dropped by `positive_amount`. Change the action to `ON VIOLATION FAIL UPDATE` and run again: the update fails, naming the expectation.

## Design trade-off
Declarative pipelines take orchestration, retries, checkpoints and data quality off your hands, and AUTO CDC removes the hardest `MERGE` logic. You give up some control: a streaming table belongs to one pipeline, full refreshes are all-or-nothing, and some advanced patterns are easier in hand-written Structured Streaming. For most medallion pipelines the managed path is the better default.

## Interview takeaway
"In a declarative pipeline I declare streaming tables for append-only ingestion and row-by-row transformations, materialized views for aggregations and joins that must stay correct, and views for intermediate steps; the pipeline orders and retries the flows. Expectations warn, drop or fail on bad rows with metrics. AUTO CDC applies change feeds with keys and a sequence column as SCD type 1 or 2, handling out-of-order events. And I treat full refresh carefully: it clears streaming tables and rebuilds from whatever the source still holds."
