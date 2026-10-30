---
id: azure-integration
title: Databricks with ADF and ADLS
summary: How Azure Data Factory runs Databricks notebooks and jobs and reads their results, how Databricks reaches ADLS, and the design choice of who orchestrates what.
sources: §17, §11, §6
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 77 — Databricks with ADF and ADLS** (Full)
  - *Relevant sections:* ADF calling Databricks; Databricks reaching ADLS; Who orchestrates what
  - *Learning evidence:* Design how an ADF pipeline triggers a Databricks job and reads back its result.

## ADF calling Databricks
Azure Data Factory has two activities for Databricks (your ADF study guide covers ADF itself):

- **Notebook activity:** runs a notebook through an Azure Databricks **linked service**, passing `baseParameters`. The notebook returns a value with `dbutils.notebook.exit("value")`, which ADF reads as `@{activity('<activity name>').output.runOutput}`.
- **Job activity:** runs a Databricks **job** (including serverless jobs; choose the Serverless option in the linked service) and passes `jobParameters`.

Activities can also install libraries: jar, egg, whl, maven, pypi, cran.

So a design where ADF triggers Databricks and reads a result back: ADF's **Notebook activity** runs the notebook with `baseParameters` such as the load date; the notebook ends with `dbutils.notebook.exit(json.dumps({"rows": n}))`; ADF reads that as `runOutput` and the next activity branches on it. If the work is a multi-task Databricks **job**, ADF's Job activity starts it with `jobParameters`; the pages read for this guide don't describe a job returning a value to ADF, so have the job write its result to a table or file that ADF reads, rather than assuming one.

## Databricks reaching ADLS
The recommended path is Unity Catalog with an **Access Connector** managed identity, a storage credential and external locations (chapter 9). Paths are `abfss://<container>@<account>.dfs.core.windows.net/<path>`. Managed identities need no secret rotation and work with firewall-protected storage accounts from a VNet-injected workspace (chapter 23).

The older patterns, a service principal's client secret, SAS tokens or account keys set in Spark properties, are on a page Microsoft marks as retired; Databricks recommends Unity Catalog instead, and recommends against account keys. Your ADLS study guide covers the storage side: hierarchical namespace, ACLs and RBAC.

## Who orchestrates what
The documentation describes both directions and leaves the choice to the team, so treat it as a design decision:

| Option | Strengths | Watch out for |
|---|---|---|
| ADF orchestrates, Databricks transforms | One orchestrator across many Azure services and on-premises sources; ADF's connectors and integration runtimes | Two places to look when something fails; parameters and results passed across the boundary |
| Lakeflow Jobs orchestrate everything in Databricks | One place for runs, repairs and lineage; Run if, For each, table-update and file-arrival triggers | Sources Databricks can't reach directly need another route in |
| Mixed: ADF lands data, a Databricks job takes over | ADF does what it is best at (copying from many sources), Databricks does transformation and quality | A clear hand-over contract (file arrival or table update) and ownership per side |

## Design trade-off
Splitting orchestration across ADF and Databricks gives each tool its strengths but doubles the monitoring and the failure modes at the boundary. If you split, make the hand-over explicit (a landing location with a file-arrival trigger, or a table update) and decide which side owns retries, so a failure isn't retried twice or not at all.

## Interview takeaway
"ADF can run a Databricks notebook with baseParameters and read the value the notebook passes to dbutils.notebook.exit as runOutput, or run a whole Databricks job, including serverless, with jobParameters. Databricks reaches ADLS through Unity Catalog with an Access Connector's managed identity, not keys. Who orchestrates is a design choice: ADF when it already runs many sources, Lakeflow Jobs when the work lives in Databricks, and if we mix them, one explicit hand-over and one owner for retries."
