---
id: ingestion
title: Choosing how data gets in
summary: Managed connectors, declarative pipelines and Structured Streaming as three layers of ingestion; when COPY INTO still fits; and why the most managed option is the place to start.
sources: §7, §19
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 61 — Choosing an Ingestion Method** (Full)
  - *Relevant sections:* Three layers, most managed first; Lakeflow Connect managed connectors; Which tool for which source
  - *Learning evidence:* Choose an ingestion method for a SQL Server source, daily CSV drops and a Kafka topic, and justify each.
- **Topic 62 — COPY INTO** (Full)
  - *Relevant sections:* COPY INTO: idempotent file loads; Try it in Free Edition
  - *Learning evidence:* Run COPY INTO twice over the same files in Free Edition and show the second run loads nothing.

## Three layers, most managed first
Databricks describes ingestion as three layers, from most customisable to most managed:

1. **Structured Streaming**: Spark APIs, exactly-once fault tolerance, full control (chapter 16).
2. **Lakeflow pipelines** (Spark Declarative Pipelines): declarative, and they manage orchestration, monitoring, data quality and errors for you (chapter 17).
3. **Managed connectors** (Lakeflow Connect): built on pipelines, they add source authentication, change data capture, edge cases, API maintenance, retries and automatic schema evolution.

Databricks recommends **starting with the most managed layer** that fits, and dropping down only if it doesn't.

## Lakeflow Connect managed connectors
**Lakeflow Connect** is Databricks' family of ingestion connectors:

- **Database** connectors (MySQL, PostgreSQL, Oracle, SQL Server) using change data capture;
- **SaaS** connectors (Salesforce, HubSpot, Jira, Workday and others);
- **File** connectors (cloud storage, Google Drive, SharePoint);
- **Streaming** connectors (Kafka, RabbitMQ);
- query-based connectors that query a source without CDC, and a direct-write API.

A managed connector has a **connection** (a Unity Catalog securable holding the source's credentials), an **ingestion pipeline** that writes **streaming tables** (serverless by default) and the **destination tables**. Database connectors add an **ingestion gateway** (a continuous job task) and staging storage. After the first full load, they ingest only changes.

A note on words: the Associate exam guide says "Lakeflow Connect standard connectors" and "managed connectors". The documentation read for this guide uses "managed connectors" and "SQL and Spark APIs" (Auto Loader, `COPY INTO`, Kafka and other sources), and doesn't define "standard connectors".

## COPY INTO: idempotent file loads
`COPY INTO` loads files from a location (ADLS via `abfss://`, a Unity Catalog volume, and other cloud storage) into a Delta table:

```
COPY INTO sales.bronze.orders
FROM '/Volumes/sales/landing/files/orders/'
FILEFORMAT = CSV
FORMAT_OPTIONS ('header' = 'true', 'mergeSchema' = 'true')
COPY_OPTIONS ('mergeSchema' = 'true');
```

- Formats: CSV, JSON, XML, Avro, ORC, Parquet, text, binary.
- It is **retriable and idempotent**: files already loaded are **skipped** on later runs, so re-running a load doesn't duplicate data.
- It can infer and evolve the target schema: create an empty table (`CREATE TABLE IF NOT EXISTS t;`) and set `mergeSchema` in both option lists.
- For SQL users loading files incrementally, Databricks recommends **streaming tables with Auto Loader** as the "more scalable and robust" alternative to `COPY INTO` (chapters 15 and 17).

## Which tool for which source
| Source | Start with | Why |
|---|---|---|
| An operational database (SQL Server, Oracle, PostgreSQL, MySQL) | Lakeflow Connect database connector | CDC, schema evolution and retries are handled for you |
| A SaaS application (Salesforce, Workday) | Lakeflow Connect SaaS connector | API changes and authentication are maintained by Databricks |
| Files landing in ADLS or a volume, continuously or daily | Auto Loader, in a streaming table or a job | Incremental, exactly-once, scales to millions of files |
| A small, occasional batch of files loaded with SQL | COPY INTO | Simple and idempotent |
| A Kafka or Event Hubs topic | Structured Streaming or a pipeline reading the topic, or a streaming connector | Continuous events need a streaming read |

## Try it in Free Edition
1. Upload two small CSV files with the same columns (`order_id,amount`) into a folder of your volume, for example `/Volumes/prep/lakehouse/files/orders/`.
2. Load them twice:

```
CREATE TABLE IF NOT EXISTS prep.lakehouse.orders_copy;
COPY INTO prep.lakehouse.orders_copy
  FROM '/Volumes/prep/lakehouse/files/orders/'
  FILEFORMAT = CSV
  FORMAT_OPTIONS ('header' = 'true', 'mergeSchema' = 'true')
  COPY_OPTIONS ('mergeSchema' = 'true');
```

**What you should see:** the first run reports the rows it loaded from both files; running the same statement again loads **0 rows**, because both files were already loaded. Add a third file and run it once more: only the new file's rows load.

## Design trade-off
The more managed the tool, the less code you own and the less you can customise. A managed connector removes months of CDC and API maintenance, but you accept its behaviour and pricing; hand-written Structured Streaming does exactly what you want, and you own every failure. Start managed and justify each step down.

## Interview takeaway
"I start with the most managed option: Lakeflow Connect for databases and SaaS, Auto Loader into streaming tables for files, and only hand-written Structured Streaming where neither fits. COPY INTO is still useful for simple SQL loads because it's idempotent: files already loaded are skipped, so a rerun doesn't duplicate data. But for continuous file ingestion Databricks recommends streaming tables with Auto Loader."
