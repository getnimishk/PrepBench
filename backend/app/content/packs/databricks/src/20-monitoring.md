---
id: monitoring
title: Monitoring: system tables, event logs and run history
summary: The system catalog for cost, usage, audit and lineage; job run history and the matrix view; the pipeline event log; and what each answers.
sources: §15, §10, §11, §12
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 86 — System Tables and Monitoring** (Full)
  - *Relevant sections:* System tables; Cost: who spent what
  - *Learning evidence:* Write a query on a billing system table that attributes last week's DBUs to jobs.
- **Topic 87 — Pipeline Event Logs and Job Run History** (Full)
  - *Relevant sections:* Job run history and the matrix view; The pipeline event log; Try it in Free Edition
  - *Learning evidence:* Find the failing task and its error for a failed job run, and the dropped-row count for a pipeline.

## System tables
**System tables** are a Databricks-hosted analytical store of your account's operational data, in the **`system` catalog** (they need Unity Catalog). You query them with SQL like any table; the main ones are listed below.

Databricks "highly discourages" exporting system table data outside the platform.

| Table | What it holds |
|---|---|
| system.billing.usage | All billable usage, in DBUs; records usually arrive within 12 hours |
| system.billing.list_prices | List prices per SKU, to turn DBUs into money |
| system.access.audit | Audit events (365 days of free retention) |
| system.access.table_lineage, column_lineage | Lineage between tables and columns |
| system.compute.* | Node types, warehouses, warehouse events, instance pools |
| system.lakeflow.jobs, job_tasks, job_run_timeline, job_task_run_timeline | Jobs and their runs |
| system.lakeflow.pipelines, pipeline_update_timeline | Pipelines and their updates |
| system.query.history | Query history |

## Cost: who spent what
Joining `system.billing.usage` with the pricing and compute tables attributes DBU spend to jobs and warehouses. A starting point for "DBUs per job last week":

```
SELECT usage_metadata.job_id, sku_name, sum(usage_quantity) AS dbus
FROM system.billing.usage
WHERE usage_date >= current_date() - INTERVAL 7 DAYS
  AND usage_metadata.job_id IS NOT NULL
GROUP BY ALL
ORDER BY dbus DESC;
```

Join to `system.lakeflow.jobs` for job names and to `system.billing.list_prices` for cost. Tags you put on compute and jobs flow into usage records, which is how teams do showback and chargeback (chapter 11).

## Job run history and the matrix view
In a job's **Runs** tab, the **matrix view** shows each run as a column and each task as a row, coloured by status: green success, red failure, pink skipped, yellow waiting for retry, grey pending, cancelled or timed out. Hover over a failed task for its metadata, click it for the **task run details**: output, error message and metadata. That is the first stop when a job fails (chapter 24 walks the whole path). Across the account, the `system.lakeflow` tables record job runs and tasks.

## The pipeline event log
Every declarative pipeline writes an **event log**: audit, **data quality** (rows passing and failing each expectation), progress and lineage, stored in a hidden Delta table. Query it with:

```
SELECT timestamp, event_type, details
FROM event_log('<pipeline-id>')
ORDER BY timestamp DESC;
```

By default only the pipeline's run-as user can query it. Databricks recommends the `pipeline_events` system table (Beta) for monitoring across pipelines. **Don't delete the event log.** The pipeline UI's data quality tab shows the same expectation metrics without SQL.

For stream health, the Spark UI's **Streaming** tab shows input rate and processing time; a micro-batch should finish within about 80% of its interval, or a backlog builds.

## Try it in Free Edition
1. Open the job from chapter 18, go to its **Runs** tab and click the failed run's red task: read its error in the task run details.
2. Open the pipeline from chapter 17 and its data quality view: note the dropped-row count for `positive_amount`. Then query `event_log('<pipeline-id>')` (the pipeline ID is on the pipeline's page) and look at the events whose `details` hold `flow_progress`, which carry each flow's status and row metrics.
3. If your workspace exposes the `system` catalog, run the DBU query above; if it doesn't, this step is read, not run.

## Design trade-off
System tables give one queryable view of cost, usage, audit and lineage across the account, but they arrive with a delay (billing usually within 12 hours) and cover what Databricks records, not your business metrics. Pair them with job notifications and SQL alerts (chapter 24) for things that need attention now.

## Interview takeaway
"For platform monitoring I query the system catalog: system.billing.usage joined with list prices and the lakeflow job tables tells me which jobs drive DBU spend, the access tables give audit and lineage, and query history covers SQL. For a failed job I go to the run's matrix view and task details; for pipelines, the event log and data quality tab show rows passing and failing each expectation. System tables are near-real-time at best, so alerts and notifications handle what needs action now."
