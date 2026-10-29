---
id: lakehouse
title: The lakehouse, and where Databricks sits on Azure
summary: One copy of data in open files, made reliable by Delta Lake and governed by Unity Catalog; a control plane Databricks runs and a compute plane that runs your work.
sources: §0, §6, §13, §17, §18
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 1 — What a Lakehouse Is** (Full)
  - *Relevant sections:* What a lakehouse is; Design trade-off
  - *Learning evidence:* Explain in two minutes why a lakehouse avoids keeping a data lake and a warehouse in sync, using one example table.
- **Topic 2 — Control Plane vs Compute Plane on Azure** (Full)
  - *Relevant sections:* Two planes: who runs what
  - *Learning evidence:* Draw both planes for a classic and a serverless workload and say where each one's data and VMs live.
- **Topic 3 — Account, Workspace and Metastore** (Full)
  - *Relevant sections:* Account, workspace, metastore
  - *Learning evidence:* Given a two-region company, say how many metastores it needs and which workspaces attach to each.
- **Topic 4 — Workspace Objects and Permissions** (Full)
  - *Relevant sections:* Workspace objects are not Unity Catalog objects
  - *Learning evidence:* Sort ten objects into Unity Catalog securables and workspace assets, and say who controls access to each.
- **Topic 5 — Product Names, Old and New** (Full)
  - *Relevant sections:* Names you will meet in older material
  - *Learning evidence:* Translate five old product names from an older course into today's names without looking.
- **Topic 6 — Databricks Free Edition Setup** (Full)
  - *Relevant sections:* Your practice workspace: Free Edition; Try it in Free Edition
  - *Learning evidence:* Create a catalog, schema and table in Free Edition and list three things it cannot do.

## What a lakehouse is
Most companies used to run two systems: a **data lake** (cheap files in cloud storage, good for raw and large data, weak on reliability) and a **data warehouse** (reliable tables and fast SQL, but a second copy of the data in a closed format). Complex ETL kept the two in sync, and they drifted.

Databricks describes a **data lakehouse** as combining "the benefits of data lakes and data warehouses": the data stays in **open formats in cloud object storage**, and the same copy serves BI, SQL, data engineering, streaming and machine learning. On Databricks three things make that work:

- **Apache Spark** does the processing, with compute kept separate from storage.
- **Delta Lake** turns folders of Parquet files into reliable tables with ACID transactions and schema enforcement (chapters 2-7).
- **Unity Catalog** governs every table, file and model in one place: who may read what, lineage, audit (chapters 8-10).

The result is **one source of truth**: an analyst's dashboard and a data scientist's model read the same `sales.orders` table, not two copies that disagree by Tuesday.

## Two planes: who runs what
Azure Databricks is split into two planes.

- **The control plane** holds the backend services and the web application. It lives in the **Azure Databricks account**, not in your Azure subscription. When you open a notebook or schedule a job, you are talking to the control plane.
- **The compute plane** is where data is processed. There are two kinds:
  - **Classic compute** runs in the **classic compute plane in your Azure subscription**, inside the workspace's virtual network. The VMs are yours, billed to you.
  - **Serverless compute** runs in a **serverless compute plane in the Azure Databricks account**, in your workspace's region, inside a network boundary per workspace. Databricks provisions and manages it.

A classic (in the Azure portal, "hybrid") workspace also has a **workspace storage account** in your subscription. Your business data normally lives in your own ADLS Gen2 accounts, reached through Unity Catalog (chapter 9).

| Workload | Where the VMs run | Who manages them |
|---|---|---|
| Classic cluster or job compute | Your Azure subscription, in the workspace VNet | You choose size and settings; Databricks starts them |
| Serverless notebooks, jobs, pipelines, SQL warehouses | The Azure Databricks account, in your region | Databricks |
| Web app, job scheduler, notebooks' backend | The control plane, in the Azure Databricks account | Databricks |

## Account, workspace, metastore
- **Account:** the top level. It manages identities (users, groups, service principals), workspaces, Unity Catalog metastores and billing.
- **Workspace:** a working environment for a set of users: notebooks, jobs, SQL, dashboards. A company usually has several (for example development and production).
- **Metastore:** the top container of Unity Catalog's metadata. A metastore is attached to **several workspaces in the same region**, which then share one view of the data and its permissions.

So a company running Databricks in two Azure regions needs **one metastore per region**, and each workspace attaches to the metastore of its own region.

## Workspace objects are not Unity Catalog objects
Not everything in a workspace is governed by Unity Catalog. The documentation separates them:

- **Unity Catalog securables:** the metastore, catalogs, schemas, tables, views, materialized views, volumes, functions, models, storage credentials, external locations, connections, and OpenSharing shares, providers and recipients.
- **Workspace-level assets:** notebooks, folders, workspace files, dashboards, jobs, pipelines, SQL queries and experiments. These are governed by **workspace access control lists**, not by Unity Catalog grants.

This matters in practice: giving a colleague access to a notebook does not give them access to the tables it reads, and the reverse.

## Names you will meet in older material
Databricks renamed many products in 2025 and 2026. Older courses, blog posts and your own notes may use the old names; this guide uses the current ones.

| Current name | Former name |
|---|---|
| Lakeflow Spark Declarative Pipelines | Delta Live Tables (DLT), then Lakeflow Declarative Pipelines |
| Declarative Automation Bundles | Databricks Asset Bundles (DABs) |
| OpenSharing | Delta Sharing |
| AUTO CDC APIs | APPLY CHANGES APIs |
| Git folders | Repos |
| Standard and dedicated access modes | Shared and single-user access modes |
| Disk cache | Delta cache, DBIO cache |

## Your practice workspace: Free Edition
**Databricks Free Edition** is a no-cost Databricks for learning, for personal, non-commercial use. It replaced Community Edition, which was retired in 2025. Signing up creates a workspace with **serverless compute and default storage**.

What it gives you: Python and SQL notebooks, Unity Catalog objects (catalogs, schemas, tables, volumes, grants) in its one metastore, Delta operations, Auto Loader with `availableNow`, `COPY INTO`, a declarative pipeline, a small multi-task job, and one 2X-Small SQL warehouse.

What it does not give you: classic clusters, compute policies, pools, spot instances, an account console or account-level APIs, SSO or SCIM, cloud storage credentials, R or Scala. It is quota-limited: going over the daily quota shuts compute down for the rest of the day, and keeps your data. Where a chapter teaches something Free Edition can't run, it says **read, not run**.

## Try it in Free Edition
1. Sign up for Free Edition from the Databricks Free Edition page, and open the **SQL editor** (or a new notebook with SQL as its language).
2. Create a catalog, a schema and a table:

```
CREATE CATALOG IF NOT EXISTS prep;
CREATE SCHEMA IF NOT EXISTS prep.lakehouse;
CREATE TABLE prep.lakehouse.orders (order_id BIGINT, amount DECIMAL(10,2), placed_at TIMESTAMP);
INSERT INTO prep.lakehouse.orders VALUES (1, 25.00, current_timestamp()), (2, 40.50, current_timestamp());
SELECT * FROM prep.lakehouse.orders;
```

**What you should see:** two rows. You never chose a file format: the table is a Delta table, because Delta is the default on Databricks (chapter 3).

3. If `CREATE CATALOG` is refused in your workspace, use the catalog you were given and create the schema inside it; the rest of the guide only needs one schema you can write to.

## Design trade-off
A lakehouse removes the second copy, but it moves the reliability work into the table format and the governance layer. If teams keep writing raw Parquet files beside Delta tables, or grant access through storage keys instead of Unity Catalog, you are back to a lake with no guarantees. The architecture only pays off when Delta and Unity Catalog are the **only** way in.

## Interview takeaway
"A lakehouse keeps one copy of the data in open files in our own cloud storage, and Delta Lake and Unity Catalog give it warehouse-grade reliability and governance, so BI, engineering and ML all read the same tables. On Azure, Databricks runs the control plane; our classic compute runs in our subscription and serverless runs in Databricks' account in our region. Unity Catalog's metastore is per region and shared by the workspaces there, while notebooks and jobs are workspace objects with their own permissions."
