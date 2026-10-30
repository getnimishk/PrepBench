---
id: compute
title: Compute and cost
summary: Serverless, classic and SQL warehouse compute; job versus all-purpose; access modes, runtimes and Photon; policies, pools and autoscaling; and what a DBU is.
sources: §12, §18
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 47 — Serverless vs Classic Compute** (Full)
  - *Relevant sections:* Three kinds of compute
  - *Learning evidence:* Pick compute for an hourly job, an ad hoc notebook and a BI dashboard, and justify each.
- **Topic 48 — All-Purpose vs Job Compute** (Full)
  - *Relevant sections:* All-purpose versus job compute
  - *Learning evidence:* Explain why a nightly job on an all-purpose cluster costs more than the same job on job compute.
- **Topic 49 — SQL Warehouses** (Full)
  - *Relevant sections:* SQL warehouses
  - *Learning evidence:* Choose a warehouse type for a team of 30 dashboard users and explain the trade-off.
- **Topic 50 — Access Modes** (Full)
  - *Relevant sections:* Access modes
  - *Learning evidence:* Say which access mode a shared team cluster and a single ML engineer's cluster should use.
- **Topic 51 — Photon and Runtime Selection** (Full)
  - *Relevant sections:* Runtimes and Photon
  - *Learning evidence:* Choose a runtime for a production job and a development cluster, and say which workloads gain most from Photon.
- **Topic 52 — Compute Policies, Pools and Autoscaling** (Full)
  - *Relevant sections:* Policies, pools and autoscaling
  - *Learning evidence:* Design a policy that caps autoscaling and forces auto termination for a data team, and say when a pool is worth it.
- **Topic 53 — DBUs and Cost Levers** (Full)
  - *Relevant sections:* What you pay for; Cost levers
  - *Learning evidence:* Estimate which of three changes saves most on a workload you describe, and say what you'd measure.

## Three kinds of compute
- **Serverless compute** for notebooks, jobs and pipelines: Databricks allocates and manages it in its own account (chapter 1). It starts and scales fast with little idle time, and is **versionless**: always the latest runtime. It is available by default in workspaces with Unity Catalog. Serverless notebooks and jobs support only the `AvailableNow` (and `Once`) streaming triggers (chapter 16).
- **Classic compute**: clusters you create and configure (all-purpose or job compute), running in your subscription.
- **SQL warehouses**: compute for SQL, analytics and BI (below).

Databricks' recommendations by task: serverless jobs compute for notebook, Python script and wheel tasks; a serverless SQL warehouse for SQL tasks; a serverless pipeline for pipelines. JAR and Spark Submit tasks need classic job compute.

## All-purpose versus job compute
On Azure, "the Jobs Compute workload is defined as a job that both starts and terminates the cluster on which it runs"; all-purpose compute is "any workload that is not an automated workload", such as running notebook commands. **They are billed at different rates**, and Databricks does not recommend all-purpose compute for production jobs.

So a nightly job attached to a shared all-purpose cluster pays the interactive rate, and keeps the cluster busy and alive for people too. The same job on its own job compute starts a cluster, runs, and terminates it, at the job rate.

## SQL warehouses
SQL warehouses come in three types (table below). For 30 dashboard users who come and go during the day, serverless is Databricks' answer: it scales up and down quickly and doesn't idle.

| Type | What it has | Where compute runs | Use it when |
|---|---|---|---|
| Serverless | Photon, Predictive IO, Intelligent Workload Management; starts in about 2-6 seconds | Databricks' account | Most BI and ad hoc SQL, especially many concurrent users |
| Pro | Photon and Predictive IO | Your cloud account | Serverless isn't available, or you need custom networking |
| Classic | Photon | Your cloud account | Entry-level SQL |

## Access modes
Classic clusters have an **access mode**:

- **Standard** (formerly shared): many users share the cluster, isolated from each other by Lakeguard. Databricks' default recommendation. It doesn't support the ML runtime, GPUs, R, Spark Submit tasks or some SparkContext APIs.
- **Dedicated** (formerly single user): assigned to one user or group; use it for what standard doesn't support, such as an ML engineer's GPU cluster.

"Auto" picks standard unless an ML runtime, a GPU instance or an old runtime is chosen.

## Runtimes and Photon
- **Databricks Runtime:** pick the latest for all-purpose development, and an **LTS** (long-term support) version for production jobs, so the environment stays stable (support lifecycles are in chapter 24). Serverless needs no choice: it is always current.
- **Photon** is a native, vectorized engine, on by default, that speeds up SQL, DataFrame work, ETL and Delta writes with **no code changes**. It helps most on long queries over large data.

## Policies, pools and autoscaling
- **Autoscaling**: a cluster has a minimum and maximum number of workers and adds or removes workers with the load; or it has a fixed size. **Single node** suits small or non-distributed work. (Streaming jobs are the exception: Databricks says not to autoscale them, chapter 24.)
- **Compute policies** are admin-defined rules on what users can create: fixed or hidden settings, maximum workers, a maximum cost per cluster, required libraries, and tags that flow to usage logs for cost attribution. Everyone gets the **Personal Compute** policy (a single machine) by default.
- **Pools** keep idle instances ready, cutting start-up and autoscaling time. **No DBUs are charged for idle pool instances**, though Azure still bills the VMs. Databricks recommends serverless over pools where possible.
- **Spot instances** (workers only; the driver stays on-demand) cut cost where interruptions are acceptable, and **automatic termination** shuts idle clusters down after a set number of minutes.

Free Edition is serverless only: policies, pools, spot and cluster settings are **read, not run**.

## What you pay for
"Azure Databricks bills you for virtual machines (VMs) provisioned in clusters and Databricks Units (DBUs) based on the VM instance selected." A **DBU** is "a unit of processing capability, billed on a per-second usage". With classic compute you pay Azure for the VMs **and** Databricks for DBUs; with serverless, the compute runs in Databricks' account, so you pay only DBUs. Usage per workload is queryable in `system.billing.usage` (chapter 20).

## Cost levers
The levers the documentation gives:

- Run automated work on **job compute or serverless**, never all-purpose.
- **Auto termination** on every interactive cluster.
- **Policies** to cap cluster size and force sensible defaults.
- **Smaller instances** for simple ETL without wide transformations.
- **Spot instances** where latency is lax.
- **Serverless or pools** to cut idle time.
- **Predictive optimization** instead of hand-scheduled maintenance (chapter 7).

To know which change saves most, measure first: DBUs per job from the billing system table, cluster utilisation, and how long clusters sit idle.

## Design trade-off
Serverless trades control for simplicity: no cluster sizing, instant start, no idle cost, always the latest runtime, but fewer settings, no init scripts, only `AvailableNow` streaming triggers, and compute outside your network. Classic compute keeps everything in your subscription and under your configuration, at the cost of managing it. Many platforms use serverless by default and classic where a workload needs what serverless doesn't offer.

## Interview takeaway
"I'd default to serverless for jobs, pipelines and SQL: fast start, no idle cost, nothing to size. Where we need classic, scheduled work runs on job compute, which is billed at a lower rate than all-purpose, with an LTS runtime, Photon on, autoscaling within a policy, and auto termination. BI users get a serverless SQL warehouse. On Azure we pay VMs plus DBUs for classic, only DBUs for serverless, and system.billing.usage tells us which jobs drive the bill."
