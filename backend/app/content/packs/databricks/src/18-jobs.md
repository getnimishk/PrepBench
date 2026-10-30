---
id: jobs
title: Lakeflow Jobs: orchestrating the work
summary: Jobs as DAGs of tasks, Run if conditions, branching and loops, retries and timeouts, concurrency limits, triggers, and why a repair can duplicate data.
sources: §11, §19, §23
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 73 — Lakeflow Jobs: Tasks and Dependencies** (Full)
  - *Relevant sections:* Jobs, tasks and the DAG; Branches and loops: If/else and For each; Try it in Free Edition
  - *Learning evidence:* Build a four-task job in Free Edition with one branch and one parameter.
- **Topic 74 — Run If, Retries and Timeouts** (Full)
  - *Relevant sections:* Run if conditions; Retries and timeouts
  - *Learning evidence:* Configure a cleanup task that runs even when an upstream task fails, and a retry on a flaky task.
- **Topic 75 — Job Concurrency and Limits** (Full)
  - *Relevant sections:* Concurrency and limits
  - *Learning evidence:* Explain what happens when an hourly job's run takes 90 minutes, and how to change it.
- **Topic 76 — Triggers and Repair Runs** (Full)
  - *Relevant sections:* Triggers; Repair runs, and why they can duplicate data
  - *Learning evidence:* Explain why repairing a run can duplicate rows from an append-only task, and how to prevent it.

## Jobs, tasks and the DAG
A **Lakeflow job** coordinates one or more **tasks**, shown as a **DAG** (a graph of dependencies). A job has a trigger, **parameters** pushed down to its tasks, notifications and Git settings.

Task types include notebook, Python script, Python wheel, SQL, **pipeline** (run a declarative pipeline), ingestion pipeline, dashboard, Power BI, dbt, JAR, Spark Submit, **Run Job** (call another job), **If/else**, **For each** and SQL alert.

Upstream tasks run first, and independent tasks run **in parallel**. A typical medallion job: ingest (pipeline task) → transform (two notebook tasks in parallel) → publish (SQL task) → notify.

## Run if conditions
Each task has a **Run if** condition on its upstream tasks; the six conditions are in the table at the end of this section.

**All done** is how you make a cleanup or audit-logging task run even when the main work fails; **At least one failed** is how you run an alerting or rollback task only on failure.

| Condition | Runs when | If not met |
|---|---|---|
| All succeeded (default) | Every upstream task succeeded | Upstream failed |
| At least one succeeded | One or more upstream succeeded | Upstream failed |
| None failed | No upstream task failed (some may be skipped) | Upstream failed |
| All done | Every upstream task finished, whatever the result | Always runs |
| At least one failed | One or more upstream failed | Excluded (skipped) |
| All failed | Every upstream task failed | Excluded (skipped) |

## Branches and loops: If/else and For each
- An **If/else condition** task branches on a boolean expression, for example "run the transformations only if ingestion added rows".
- A **For each** task runs one nested task per element of an input array (a JSON array, task values or job parameters), with `{{input}}` available in the nested task and a **Concurrency** setting (default 1). A For each can't contain another For each.

## Retries and timeouts
- **Retries:** set a **retry policy** per task (count and interval). The Databricks pages disagree on the default number of retries (one says none, another says three), so set the policy explicitly rather than relying on a default. Serverless jobs optimise retries automatically unless you disallow it, and continuous jobs retry with exponential backoff.
- **Timeout:** a task's maximum run time. If it is exceeded, the status is **Timed Out**. A **duration warning** only raises an event for a notification. With both a timeout and retries, the timeout applies to **each** retry.

A hanging task can block a whole job and its cost, which is why the reliability guidance pairs retries with timeouts.

## Concurrency and limits
- By default a job runs **one run at a time**. A run triggered while one is active is **skipped** once the job's **maximum concurrent runs** is reached. So an hourly job whose run takes 90 minutes skips the next hour's run. Fix the duration, or raise maximum concurrent runs if overlapping runs are safe (they often aren't, if both write the same tables).
- Workspace limits: **2,000 concurrent task runs** per workspace (beyond that, `429 Too Many Requests`), 10,000 job creations per hour, 12,000 saved jobs, **1,000 tasks per job**.

## Triggers
- **Scheduled:** time-based.
- **Table update:** when source tables change.
- **File arrival:** new files in a Unity Catalog external location or volume, checked recursively about every minute, best effort, with no cost beyond the cloud's file listing; faster with file events enabled.
- **Model update**, **Continuous** (a new run starts whenever one ends; used for streaming jobs, chapter 24), and manual or API runs.

## Repair runs, and why they can duplicate data
When a multi-task run fails or is cancelled, **repair** re-runs only the **unsuccessful tasks and their dependents**, using the **current** job and task settings, so fix the code or configuration first, then repair. Repair needs two or more tasks; a single-task job is re-run with Run now.

The trap: "Lakeflow Jobs doesn't make tasks idempotent". A repaired task restarts **from the beginning**. If it appended half its output before failing, the repair appends it all again, and you have **duplicate rows**. Prevent it by writing tasks so a rerun is harmless: overwrite the partition or date range they own, use an insert-only or key-based `MERGE` (chapter 6), or stream with a checkpoint (chapter 16), never a blind append.

## Try it in Free Edition
Free Edition runs up to five concurrent job tasks, enough for this.

1. Create two small notebooks: `ingest` (sets a task value: `dbutils.jobs.taskValues.set("rows", 3)`) and `transform` (any small notebook).
2. Create a job: task `ingest`; an **If/else** task after it with the condition `{{tasks.ingest.values.rows}} > 0`; task `transform` on the true branch; and a fourth task `cleanup` (any notebook) depending on `transform` with **Run if: All done**. Add a job parameter `run_date` (it is passed to every task).
3. Run it, then edit `transform` to raise an error and run again.

**What you should see:** on the first run all four tasks succeed. On the second, `transform` fails and `cleanup` still runs, because of All done. Then fix `transform` and use **Repair run**: only `transform` (and anything depending on it) runs again.

## Design trade-off
One big job with many tasks is easy to see and repair; many small jobs chained with Run Job or table-update triggers are easier to own separately and fail independently. Either way, design every task to be safe to rerun, because retries and repairs will rerun them.

## Interview takeaway
"A Lakeflow job is a DAG of tasks with Run if conditions, so I use All done for cleanup and At least one failed for alerting, If/else to branch and For each to fan out. Every task gets an explicit retry policy and a timeout. By default a job runs one run at a time and skips runs beyond max concurrent runs, so long runs silently drop schedules. And repair re-runs failed tasks from the start without making them idempotent, so tasks must overwrite or merge, never blindly append."
