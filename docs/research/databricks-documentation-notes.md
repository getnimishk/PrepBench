# Databricks — documentation notes

**Sources:** the Databricks documentation (https://docs.databricks.com/aws/en/, read 2026-10-29), its Azure edition on
Microsoft Learn (https://learn.microsoft.com/azure/databricks/) where Azure differs, the Delta Lake documentation
(https://docs.delta.io/), the Apache Spark documentation (https://spark.apache.org/docs/latest/), and Databricks' two
data engineering exam guides (§1). Each section names the pages it comes from.
**Purpose:** ground PrepBench's Databricks material (study guide, scenarios, question bank, lab additions, interview
questions) in official sources, the way `kafka-documentation-notes.md` grounds the Kafka guide. A chapter, scenario or
question cites the sections here (`§4`). A fact the material needs that this file lacks goes into this file first, from
an official page.
**How it was read.** Each page was downloaded and converted to plain text, then read in full; nothing here comes from a
search-result or AI summary of a page. Quotes are marked with quotation marks; everything else is in my own words.
Each page shows a "Last updated" date; most were updated in September or October 2026.
**Azure.** The learner works on Azure. Databricks publishes the same documentation for AWS, Azure and GCP; the
concepts are the same. Where the Azure edition differs (storage, identity, networking, pricing units), a line marked
**Azure:** says so.
**Names change.** Databricks renamed many products in 2025-2026. These notes use the names the current pages use and
give the old name once (§0), because the exam guides use the new names and the learner will meet the old ones in older
material.

---

## 0. Names: current and former

| Current name (2026 docs) | Former name | Where the rename is stated |
|---|---|---|
| Lakeflow Spark Declarative Pipelines ("Lakeflow pipelines"; built on open-source Apache Spark Declarative Pipelines) | Delta Live Tables (DLT); then Lakeflow Declarative Pipelines | "What happened to Delta Live Tables (DLT)?" (`/ldp/where-is-dlt`); release notes, November 2025 |
| Declarative Automation Bundles | Databricks Asset Bundles (DABs) | release notes, March 2026; both exam guides |
| OpenSharing | Delta Sharing | release notes, June 2026 ("Delta Sharing is now OpenSharing") |
| AUTO CDC APIs | APPLY CHANGES APIs | `/ldp/cdc`; Professional exam guide |
| Databricks Git folders | Databricks Repos | `/repos/`; both exam guides |
| Standard / dedicated access mode | shared / single-user (assigned) access mode | Unity Catalog privileges and volumes pages |
| Disk cache | Delta cache, DBIO cache | `/optimizations/disk-cache` |

Sources: https://docs.databricks.com/aws/en/release-notes/product/ (read 2026-10-29) and the pages named. Python code
for pipelines moves from `import dlt` to `from pyspark import pipelines as dp`; `@dlt.view` becomes `@dp.temporary_view`
and `@dp.materialized_view` is new; old `dlt` names still work, classic pipeline SKUs still start with `DLT`.
**Not confirmed:** that Lakeflow Jobs was formerly called "Databricks Workflows". No page read on 2026-10-29 says so, so
PrepBench doesn't state it.

## 1. The certifications (official)

### 1.1 Which exams exist

Source: https://www.databricks.com/learn/certification (read 2026-10-29).

- **Associate:** Data Analyst, Data Engineer, ML Engineer, Generative AI Engineer, Context Engineer, Apache Spark Developer.
  **Professional:** Data Engineer, ML Engineer. **Accreditations / fundamentals (free, badge):** Databricks Fundamentals,
  Generative AI Fundamentals, AI Agent Fundamentals; platform architect accreditations for AWS, Azure and GCP; a
  Platform Administrator accreditation.
- The page calls the Associate exams "introductory" (Data Engineer Associate: "introductory data engineering tasks").
  It names no exam as being for business or leadership roles.
- The Hadoop Migration Architect exam is "no longer available" (since 1 August 2024).

### 1.2 Data Engineer Associate

Sources: https://www.databricks.com/learn/certification/data-engineer-associate ; exam guide
https://www.databricks.com/sites/default/files/2026-10/Databricks-Certified-Data-Engineer-Associate-Exam-Guide-August-2026.pdf
(read in full).

- **Dates:** exam published 4 May 2026; exam guide updated 6 August 2026. The guide asks candidates to check it again
  "two weeks before your exam date".
- **Format:** 45 scored multiple-choice questions, plus up to 10 unscored items that are not identified; 90 minutes
  (time for unscored items already included); USD 200 plus taxes; online proctored or test centre; English, Japanese,
  Brazilian Portuguese, Korean; no test aids; no prerequisite. Recommended: six months of hands-on experience. Valid
  2 years; recertify with the Data Engineer Associate Renewal Exam or the current full exam.
- **Code language:** "Data manipulation code in this exam is provided in SQL when possible. In all other cases, code
  will be in Python." (exam page).
- **Sections and weights:** 1 Databricks Intelligence Platform 6%; 2 Data Ingestion and Loading 21%; 3 Data
  Transformation and Modeling 22%; 4 Working with Lakeflow Jobs 16%; 5 Implementing CI/CD 10%; 6 Troubleshooting,
  Monitoring, and Optimization 10%; 7 Governance and Security 15%.
- **Objectives** (the guide's bullets, shortened):
  1. Platform: core components (architecture, Delta Lake, Unity Catalog); compute services, their characteristics,
     limitations and cost models, choosing one per workload.
  2. Ingestion: batch, streaming and incremental patterns; local files and Lakeflow Connect standard and managed
     connectors; `COPY INTO` from cloud object storage (ADLS/S3/GCS) into Unity Catalog tables; Auto Loader with schema
     enforcement and evolution (directory listing or file notification); configuring Lakeflow Connect; JDBC/ODBC or REST
     clients in notebooks, scheduled with Lakeflow Jobs; choosing between Auto Loader, Lakeflow Connect, partner
     connectors and other methods; semi-structured data (JSON, nested).
  3. Transformation: cleaning bronze into silver with PySpark/SQL (nulls, types); joins (inner, left, broadcast,
     multiple keys, cross), union and union all; adding, dropping, splitting, renaming columns, filters, exploding
     arrays; deduplication and aggregates (count, approximate count distinct, mean, summary); tuning parameters
     `spark.sql.shuffle.partitions`, `spark.default.parallelism`, `spark.executor/driver.memory`,
     `spark.sql.autoBroadcastJoinThreshold`, then re-measuring; gold objects (materialized views, views, streaming
     tables, tables) in Unity Catalog; data quality checks for silver and gold.
  4. Lakeflow Jobs: control flow (retries, branching, looping); notebook, SQL query, dashboard and pipeline tasks and
     their dependencies in the DAG; schedules and triggers (scheduled, file arrival, table update); time-based versus
     data-driven triggers.
  5. CI/CD: branches, commits, pushes and pull requests in Git folders; Declarative Automation Bundle variables and
     overrides across dev, test and prod targets; deploying bundles; the Databricks CLI to validate and deploy bundles.
  6. Troubleshooting: run history against baselines; job statuses and the task graph to spot upstream blockers; skew,
     shuffle and disk spill in the Spark UI's stage metrics; liquid clustering and predictive optimization; cluster
     start-up failures, library conflicts, out-of-memory errors.
  7. Governance: managed versus external tables in Unity Catalog, including converting between them; `GRANT`, `REVOKE`
     and `DENY` to users, groups and service principals at the right level; column masks and row filters by group;
     ABAC policies.
- **Sample questions** (10, with an answer key) cover: skew in a `groupBy` (salting; the key says AQE's skew handling
  applies to skewed **joins**, not aggregations); Delta + Unity Catalog for rollback and audit; audit-log delivery
  (JSON, typically within 15 minutes, a later delivery can overwrite a file); serverless SQL warehouse for many ad hoc SQL
  users; bundles for CI/CD; `BUNDLE_VAR_<name>` environment variables for secrets in bundle variables; a column mask
  using `is_account_group_member()`; `ALTER TABLE ... UNSET MANAGED` to roll back an external-to-managed conversion
  (within 14 days); the task **timeout** threshold behind a "Timed Out" status; a **file arrival** trigger for
  unpredictable drops.
- **Out of scope:** the guide has no out-of-scope list.
- **Not published:** the pass mark. (Third-party sites claim 70%; nothing official says so, and PrepBench never states one.)

### 1.3 Data Engineer Professional

Sources: https://www.databricks.com/learn/certification/data-engineer-professional ; exam guide
https://www.databricks.com/sites/default/files/2026-10/Databricks-Certified-Data-Engineer-Professional-Exam-Guide-9-Oct-2026.pdf
(read in full).

- **Dates:** exam published and guide updated 9 October 2026. The guide's sample questions "align with the New Exam
  outline"; exams on or before 9 October 2026 used the previous outline.
- **Format (guide):** 60 scored multiple-choice questions plus unscored ones; 120 minutes; USD 200 plus taxes; online or
  test centre; English only; recommended one year of hands-on experience; valid 2 years; recertify by taking the current
  exam.
- **Sections and weights (guide, 9 Oct 2026):** 1 Developing Code for Data Processing using Python and SQL 23%; 2 Data
  Ingestion & Acquisition 12%; 3 Data Manipulation 12%; 4 Monitoring and Alerting 10%; 5 Cost & Performance
  Optimization 15%; 6 Ensuring Data Security and Compliance 8%; 7 Data Governance 5%; 8 Debugging and Deploying 10%;
  9 Data Modeling 5%.
- **The exam page disagrees with the guide** (read the same day): it says 59 scored questions and lists ten sections
  with different weights (22 / 7 / 10 / 5 / 10 / 13 / 10 / 7 / 10 / 6, including a "Data Sharing and Federation"
  section). That matches the outline before 9 October 2026. The guide is newer and says it is authoritative; PrepBench
  follows the guide and says the page differs.
- **Topics beyond the Associate:** bundle project structure; library and dependency troubleshooting; pandas, Python
  and SQL UDFs and Unity Catalog functions; streaming tables versus materialized views; AUTO CDC with SCD type 1 and 2
  (`stored_as_scd_type`); Structured Streaming versus declarative pipelines; If/Else and For Each tasks; serverless
  environments and performance mode; `assertDataFrameEqual` / `assertSchemaEqual` tests; watermarks, output modes,
  `foreachBatch`, checkpoints; Kafka, Kinesis and Pub/Sub sources; Iceberg targets; Lakeflow Connect CDC from SQL
  Server, MySQL and PostgreSQL; OpenSharing and Clean Rooms; Lakehouse Federation; window functions; `VARIANT`
  (`parse_json`, `variant_get`); `ai_query`; expectations (quarantine, drop, fail); system tables (billing, compute,
  access, lakeflow); REST API, CLI and SDK; pipeline event logs; alerts; deletion vectors, `CLUSTER BY AUTO`, the disk
  cache, change data feed, the query profile; least privilege; ABAC with governed tags; anonymisation and
  pseudonymisation; PII masking; GDPR deletion with Delta and Unity Catalog; tags and comments; privilege inheritance;
  job repair and parameter overrides; metric views; dimensional modelling.
- **Out of scope:** no list. **Not published:** the pass mark.

### 1.4 Architect and administrator accreditations

Sources: https://www.databricks.com/learn/certification/databricks-on-azure ; `.../databricks-on-aws` ;
`.../platform-administrator-accreditation` (all read 2026-10-29).

- **There is no "Solutions Architect" credential.** The certification page (§1.1) lists no exam or accreditation with
  that name; the only architect credentials on it are the three **Platform Architect** badges (AWS, Azure, GCP) and the
  retired Hadoop Migration Architect exam. "Solutions architect" is a job role, not a Databricks credential.
- **Azure Platform Architect badge.** "This assessment will test your understanding of deployment, security and cloud
  integrations for Azure Databricks." It covers five areas: **platform administration fundamentals**, **network
  configuration**, **platform access and security**, **external storage configuration**, **cloud service
  integrations**. Type: accreditation. **20 questions**, multiple choice and multiple select, **no time limit**, online
  and **not proctored**, no test aids, English. **Passing score 80%** (published, unlike the certifications). **Free for
  Databricks customers and partners**; registration is through Databricks Academy. Prerequisite: related training in
  Databricks Academy (self-paced "Azure Databricks Data + AI Platform Architect Pathway"). Valid one year. **No weights or
  question counts per area are published.**
- **AWS Platform Architect badge** (same format: 20 questions, 80%, one year) covers platform administration
  fundamentals, Account API usage, external storage, cloud service integrations, customer-managed VPCs and
  customer-managed keys. Listed only to show the Azure badge's areas are cloud-specific.
- **Data + AI Platform Administrator accreditation:** 25 multiple-choice questions, unlimited time, not proctored, free
  for customers and partners, valid one year, no programming questions, no pass mark stated on the page. Its candidate
  description covers user and group administration (identity-provider import, admin roles, workspace APIs), compute
  (clusters with init scripts, policies, pools; classic and serverless SQL warehouses; model serving; jobs and
  pipelines), and governance (permissions on workspace assets, jobs, clusters and pools; table types, views, sharing;
  secrets; Delta Sharing; model governance).

## 2. Delta Lake on Databricks: tables, the log, versions

Sources: https://docs.databricks.com/aws/en/delta/ (updated 2026-09-11) ; https://docs.databricks.com/aws/en/delta/history
(updated 2026-10-28) ; https://docs.databricks.com/aws/en/delta/vacuum (2026-09-11) ;
https://docs.databricks.com/aws/en/delta/optimize (2026-09-11).

### 2.1 What Delta Lake is

- Delta Lake is "the optimized storage layer that provides the foundation for tables in a lakehouse on Databricks":
  open-source software that extends **Parquet data files** with a **file-based transaction log** for ACID transactions
  and scalable metadata handling. It works with Spark APIs and with Structured Streaming, so one copy of data serves
  batch and streaming.
- **Delta is the default.** Unless otherwise specified, every table on Databricks is a Delta Lake table.
- The transaction log follows an open protocol any system can read. Databricks recommends never touching data or log
  files directly in a table's directory.
- Schema is validated on write (**schema enforcement**); see §3 for evolution.
- Databricks recommends a **medallion architecture** for pipelines (§13).

**How the log works** (Delta protocol, https://raw.githubusercontent.com/delta-io/delta/master/PROTOCOL.md, read
2026-10-29):

- A table has "a single serial history of atomic versions", numbered with contiguous, increasing integers. The log is a
  `_delta_log` directory at the table's root holding one JSON file per version, named by the version zero-padded to 20
  digits (`00000000000000000000.json` is version 0), plus periodic Parquet checkpoint files and a `_last_checkpoint`
  pointer.
- **Writers work in two phases:** first they write new data files (or updated copies of existing ones), then they
  **commit** by adding the next log entry, which records which files are logically **added** and **removed** and any
  metadata change. A version's JSON file is "the unit of atomicity". Readers use the log to pick the files of one
  consistent **snapshot** (multi-version concurrency control): old files stay until `VACUUM` removes them after the
  retention period (default 7 days). That is why time travel works and why `VACUUM` ends it.
- A snapshot is defined by the protocol versions and table features, the metadata (schema, partition columns,
  configuration), the set of live files, the **tombstones** of recently removed files, and committed application
  transactions.

### 2.2 Versions, history and time travel

- Each operation that modifies a table creates a **new table version**. `DESCRIBE HISTORY t` returns the operations,
  user and timestamp of each write, newest first (`LIMIT 1` for the last). Catalog Explorer shows it on the History tab.
- **History retention:** table property `delta.logRetentionDuration`, default **30 days**.
- **Data-file retention:** `delta.deletedFileRetentionDuration`, default **7 days** — the threshold `VACUUM` uses.
  To time travel to a version you need **both** its log and its data files. Example from the page: for 30 days of
  time travel, set `deletedFileRetentionDuration` to 30 days (matching the log default). Longer retention costs storage.
- The page: do not use table history as a long-term backup; use only the past 7 days for time travel unless both
  retentions are raised.
- **Blocked reads:** in Databricks Runtime 18.0+ (Unity Catalog managed tables: 12.2+), time travel to a version older
  than `deletedFileRetentionDuration` is blocked; and `logRetentionDuration` must be ≥ `deletedFileRetentionDuration`.
- **Syntax:** `SELECT * FROM t VERSION AS OF 123`, `... TIMESTAMP AS OF '2018-10-18T22:15:12.013Z'`; or `t@v123`,
  `t@20190101000000000` (`yyyyMMddHHmmssSSS`). Python: `spark.read.option("versionAsOf", 123).table("t")`,
  `option("timestampAsOf", ...)`. Neither the version nor the timestamp can be a subquery.
- Uses the page lists: reproduce reports or model outputs (audit), temporal queries, fixing mistakes (e.g.
  `INSERT ... SELECT ... TIMESTAMP AS OF` for deleted rows, `MERGE ... USING t TIMESTAMP AS OF` for bad updates),
  snapshot isolation for a set of queries.
- **In-commit timestamps** (`delta.enableInCommitTimestamps`, DBR 15.4 LTS+) store commit times in the log, so
  timestamp time travel survives copying the log files; without them it uses file modification times.
- **`DESCRIBE DETAIL t`** (https://docs.databricks.com/aws/en/delta/table-details, updated 2026-09-11) returns one row of
  table metadata: format, location, partition columns, **`numFiles`**, **`sizeInBytes`**, properties,
  **`minReaderVersion` / `minWriterVersion`** and enabled table features (columns vary by runtime). It is how to see the
  file count before and after `OPTIMIZE`, and a table's protocol (§2.7).
- **Log checkpoints:** versions are JSON files in the log directory; Databricks aggregates them into **Parquet
  checkpoint files** so readers need not read every JSON file. Frequency is automatic.
- **RESTORE:** `RESTORE TABLE t TO VERSION AS OF n` / `TO TIMESTAMP AS OF ts`; needs `MODIFY`; a restored or cloned table
  can be restored again; impossible once the needed data files are vacuumed (partial restore only with
  `spark.sql.files.ignoreMissingFiles=true`). Restore is a **data-changing** operation (`dataChange=true`), so a
  streaming job reading the table sees it as new data and **can produce duplicates downstream**.

### 2.3 VACUUM

- `VACUUM t` removes data files **no longer referenced** by the table and **older than the retention threshold**
  (default 7 days). Reasons: storage cost, and compliance (removed files may hold deleted or modified records).
  `VACUUM t DRY RUN` lists what would go.
- After `VACUUM`, versions older than the retention period **can no longer be queried**. Log files are not governed by
  `VACUUM`: they are removed automatically after checkpoints (default 30 days).
- `VACUUM` removes all files in directories Databricks doesn't manage, **except directories starting with `_` or `.`** —
  so keep e.g. streaming checkpoints in a `_checkpoints` folder if they live inside a table directory. Change data feed
  files live in `_change_data` and are removed by `VACUUM`.
- **Safety check:** Databricks "strongly recommends" at least 7 days, because long-running jobs may write uncommitted
  files that a short retention would delete. A shorter retention needs
  `spark.databricks.delta.retentionDurationCheck.enabled = false`.
- **LITE mode** (Public Preview, DBR 16.4 LTS+): `VACUUM t LITE` uses the log instead of listing the directory; needs a
  successful `VACUUM` within the log retention (30 days), otherwise it errors and asks for `VACUUM FULL` (the default).
- **Soft deletes:** deletion vectors (§2.5) and dropping columns with column mapping only mark data as deleted.
  To remove such data physically: `REORG TABLE t APPLY (PURGE)`, then `VACUUM` after the retention has passed.
- Sizing: listing uses the workers; deleting is driver-only. Suggested: autoscaling 1-4 workers of 8 cores, a driver of
  8-32 cores.
- Predictive optimization runs `VACUUM` automatically on Unity Catalog managed tables (§2.6).

### 2.4 OPTIMIZE (compaction)

- `OPTIMIZE t` rewrites data files into a better layout ("bin-packing" compaction of small files). With liquid
  clustering it groups data by the clustering keys; with partitions it works within partitions. `OPTIMIZE t WHERE
  date >= '...'` limits it to part of a table.
- Bin-packing is **idempotent** (a second run on the same data does nothing) and balances files by size, not row count.
- `OPTIMIZE` makes **no data change**: readers use snapshot isolation and get the same results before and after;
  a stream reading the table is not affected.
- Tables without liquid clustering can add `ZORDER BY`. **Databricks recommends liquid clustering instead of
  partitioning or Z-order** (§2.5). `OPTIMIZE t FULL` (DBR 16.0+) forces reclustering of a liquid-clustered table.
- Frequency is a cost/performance trade-off; Databricks suggests starting daily and adjusting, or enabling predictive
  optimization. Compute-optimized instances with SSDs suit it. Auto compaction can compact small files automatically.
- In `DESCRIBE HISTORY`, auto compaction, liquid clustering and Z-ordering all appear as `OPTIMIZE`; the
  `operationParameters` (`auto`, `clusterBy`, `zOrderBy`) tell them apart.

### 2.5 Data layout: liquid clustering, Z-order, data skipping, deletion vectors

Sources: https://docs.databricks.com/aws/en/delta/clustering (updated 2026-09-25) ;
https://docs.databricks.com/aws/en/delta/data-skipping (2026-10-20) ;
https://docs.databricks.com/aws/en/delta/deletion-vectors (2026-09-11).

- **Liquid clustering** "replaces table partitioning and `ZORDER`": data is organised by **clustering keys**, and the keys
  can be **changed without rewriting existing data**. GA for Delta tables on DBR 15.4 LTS+. Databricks recommends it **for
  all new tables**, including streaming tables and materialized views. It suits high-cardinality filter columns,
  skewed data, fast-growing tables, concurrent writers, changing access patterns, and tables where a partition key would
  give too many or too few partitions.
- **Not compatible** with partitioning or `ZORDER`. Enable with `CREATE TABLE t (...) CLUSTER BY (col)`, `CREATE TABLE
  t2 CLUSTER BY (col) AS SELECT ...` (the clause goes after the table name), or `ALTER TABLE t CLUSTER BY (cols)` on an
  existing **unpartitioned** table. DataFrame API: `df.write.clusterBy("col").saveAsTable(...)` — only on create or
  overwrite, **never in append mode** (change keys with `ALTER TABLE` instead).
- **Keys:** up to **four**; choose the columns most used in filters; of two highly correlated columns, one key is
  enough; keys must have statistics (by default the first 32 columns). Supported types include date, timestamp, string,
  integer types, float, double, decimal and struct fields by dot path; not maps, arrays or whole structs. For tables under
  10 TB, more keys can slow single-column filters.
- **Clustering is incremental:** `OPTIMIZE t` clusters only data that needs it. Changing keys does not rewrite old data;
  `OPTIMIZE t FULL` (DBR 16.4 LTS+) reclusters everything (can take hours on large tables). `ALTER TABLE t CLUSTER BY
  NONE` stops future clustering without rewriting. Some writes cluster on write (`INSERT INTO`, CTAS/RTAS, `COPY INTO` from
  Parquet, `append`) when the write is above a size threshold. Without predictive optimization, schedule `OPTIMIZE`
  (every one or two hours for heavily updated tables); with it, Databricks recommends disabling scheduled `OPTIMIZE` jobs.
- **Automatic liquid clustering** (`CLUSTER BY AUTO`, DBR 15.4 LTS+, Unity Catalog **managed** tables only) needs
  predictive optimization; Databricks picks keys from the query history and changes them only when the predicted saving
  beats the clustering cost. It may pick none (table too small, already well laid out, rarely queried).
- **Converting a partitioned table** (DBR 18.1+): `ALTER TABLE t REPLACE PARTITIONED BY WITH CLUSTER BY (cols) | AUTO`,
  then `OPTIMIZE`. Migration advice from the page: partition columns become clustering keys; `ZORDER BY` columns become
  keys; for a generated low-cardinality column (a date from a timestamp), cluster on the original column instead.
- Liquid-clustered Delta tables use writer version 7 / reader version 3; older clients can't read them; the protocol can't
  be downgraded.
- **Data skipping:** statistics (min, max, null count, record count per file) are collected automatically on write, on
  the **first 32 columns** by default (`delta.dataSkippingNumIndexedCols`, or `delta.dataSkippingStatsColumns` on DBR 13.3
  LTS+). Predictive optimization can add statistics for frequently filtered columns beyond 32 on managed tables.
  `ANALYZE TABLE t COMPUTE DELTA STATISTICS` recomputes them (DBR 14.3 LTS+).
- **Z-order** (`OPTIMIZE t ZORDER BY (col)`) co-locates related values in the same files for data skipping; use it for
  high-cardinality filter columns; effectiveness drops with each extra column; useless on columns without statistics.
  Z-ordering is **not idempotent** (unlike bin-packing) and balances files by row count, not size.
- **Deletion vectors** speed up `DELETE`, `UPDATE` and `MERGE`: instead of rewriting a whole Parquet file to change one row,
  the row is marked in metadata and readers apply the mark at query time. Enable with
  `TBLPROPERTIES ('delta.enableDeletionVectors' = true)` (workspace settings can enable them for new tables; the default
  varies by region). Enabling upgrades the table protocol. The marked changes are physically applied by `OPTIMIZE`,
  `REORG TABLE ... APPLY (PURGE)` or auto compaction; to **physically delete** old data (e.g. for GDPR) run
  `REORG ... APPLY (PURGE)` and then `VACUUM`. Tables with deletion vectors support row-level concurrency (DBR 14.2+).

### 2.6 Predictive optimization

Source: https://docs.databricks.com/aws/en/optimizations/predictive-optimization (updated 2026-10-26).

- Automatically runs `OPTIMIZE`, `VACUUM` and `ANALYZE` (and refreshes full-text search indexes) on **Unity Catalog managed
  tables** only. It decides which tables benefit and queues the work; it also collects statistics on write.
- **On by default** for accounts created on or after 11 November 2024; existing accounts by a gradual rollout "expected to
  complete by August 2026".
- Its `OPTIMIZE` **never runs `ZORDER`** and ignores Z-ordered files.
- Its `VACUUM` honours `delta.deletedFileRetentionDuration` (default 7 days) but keeps **at least 7 days** even if the
  property is set lower. Raise the property **before** enabling it if longer time travel is needed.
- Runs on **serverless compute for jobs**, billed under a serverless jobs SKU. Needs the Premium plan or above.
- Set at account (account admin), catalog, schema or table level (owner or `MANAGE`); lower levels inherit and can override.

### 2.7 Delta internals: actions, checkpoints, concurrency, protocol

Sources: the Delta protocol (https://raw.githubusercontent.com/delta-io/delta/master/PROTOCOL.md, sections "Actions",
"Checkpoints", "Log Compaction Files", "Last Checkpoint File", "Version Checksum File", "Transaction Identifiers") ;
https://docs.databricks.com/aws/en/lakehouse/acid (updated 2026-10-19) ;
https://docs.databricks.com/aws/en/optimizations/isolation-level (2026-10-12) ;
https://docs.databricks.com/aws/en/delta/feature-compatibility (2026-10-28) (all read 2026-10-29).

- **Actions** in a commit change the table state. `metaData`: the first version must have one, at most one per version,
  and each one **completely overwrites** the table's metadata (schema, partitioning, configuration). `add` / `remove`:
  add or remove a **logical file** (a data file path plus an optional deletion vector). A `remove` carries a timestamp
  and stays in the state as a **tombstone** until it expires, so readers on an older snapshot can keep reading; physical
  deletion happens lazily (that is `VACUUM`'s job, §2.3). `add` actions also carry per-file **statistics** used for data
  skipping (§2.5). Other actions: `protocol`, `cdc` (change data files, §5), `txn` (below), `commitInfo` (provenance:
  what `DESCRIBE HISTORY` shows), domain metadata.
- **Checkpoints** hold "the complete replay of all actions" up to a version, with cancelled actions removed and
  unexpired tombstones kept, so a reader needn't replay every JSON commit. Kinds: **classic** `n.checkpoint.parquet`,
  multi-part, and **V2 / UUID-named** `n.checkpoint.<uuid>.json|parquet` that may reference **sidecar** Parquet files in
  `_delta_log/_sidecars`. Readers should use the newest complete checkpoint; for time travel, one no newer than the
  target version. Readers must not assume how often checkpoints exist, except that metadata cleanup keeps a checkpoint
  for the oldest kept version. **`_delta_log/_last_checkpoint`** points near the end of the log so readers avoid listing
  a directory that can hold "10,000+" files. **Log compaction files** `<x>.<y>.compacted.json` aggregate a range of
  commits. An optional **version checksum** file per commit lets clients detect non-compliant changes, because "the
  Delta transaction log must remain an append-only log".
- **Transaction identifiers** (`txn`: an `appId` + `version` pair committed atomically with the data) are how
  Structured Streaming's Delta sink makes writes **idempotent**: before committing a batch it checks whether that batch's
  version is already recorded, and skips it if so. This is the mechanism behind exactly-once writes into Delta (§8).
- **ACID on Databricks.** Atomicity comes from the log: data files written by a transaction are invisible until the
  commit records them; files from a **failed** transaction never join the table and `VACUUM` deletes them. Durability
  comes from cloud object storage. **Optimistic concurrency control**, with **no locks** ("deadlock is not a
  possibility"): a write (1) reads the latest version if it needs to (append-only writes don't), (2) writes data files,
  (3) **validates and commits**: if a concurrently committed change conflicts with what it read, it **fails with a
  concurrent modification exception** (e.g. `ConcurrentAppendException`) instead of corrupting data.
- **Isolation:** **snapshot isolation** for reads; **WriteSerializable** for writes by default; **Serializable** is the
  stronger option (`delta.isolationLevel`). Row-level concurrency (with deletion vectors, §2.5) reduces conflicts on the
  same files. **Metadata changes** (protocol, table properties, schema) can make all concurrent writes fail, and a
  **streaming read fails** on a commit that changes metadata and must be restarted.
- **Transaction scope.** By default each SQL statement is its own transaction on one table. The ACID page (2026-10-19)
  also describes **`BEGIN ATOMIC ... END`** grouping statements across tables into one transaction, for tables with
  **catalog commits** enabled. (The warehouse-migration page, updated 2026-09-11, still says there are no `BEGIN`/`END`
  constructs: §19 records the conflict; the newer page is followed, as a feature that needs catalog commits.)
  Databricks also writes `_started_<id>` / `_committed_<id>` marker files for transactional commits to object storage
  and cleans up stale ones.
- **Protocol and table features.** Every table has a protocol saying what a client must support: `minReaderVersion`
  (1-3) and `minWriterVersion` (2-7). At reader 3 / writer 7, the protocol lists individual **table features** instead
  of implying them by version. A **writer feature** blocks only clients that write; a **reader feature** blocks reading
  too. A client that doesn't support a table's features can't read or write it. Most new capabilities upgrade the
  protocol (deletion vectors, liquid clustering: §2.5); some features can be dropped (`ALTER TABLE ... DROP FEATURE`).

## 3. Schemas: enforcement and evolution

Sources: https://docs.databricks.com/aws/en/tables/schema-enforcement (updated 2026-09-11) ;
https://docs.databricks.com/aws/en/delta/update-schema (2026-09-11).

- **Enforcement** applies to Delta tables (not to CSV or JSON files in storage). On `INSERT`: every inserted column must
  exist in the target, and types must match — Databricks first tries a **safe cast** (an `INT` into a `BIGINT` column
  succeeds). An unknown column fails with `UNRESOLVED_COLUMN.WITH_SUGGESTION`.
- On `MERGE`: target columns of `UPDATE`/`INSERT` actions must exist; with `INSERT *` / `UPDATE SET *` the **source must
  have every target column**, and **extra source columns are ignored** (without schema evolution).
- **Evolution** supports adding columns (anywhere), reordering, renaming and type widening, explicitly with DDL or
  implicitly with DML. Schema changes conflict with every concurrent write, and **updating a schema terminates any stream
  reading the table** (restart it).
- **Explicit:** `ALTER TABLE t ADD COLUMNS (c type [COMMENT ...] [FIRST|AFTER x])` (new columns nullable),
  `ALTER COLUMN ... FIRST|AFTER|COMMENT`, `REPLACE COLUMNS`. **Rename** and **drop** without rewriting need **column
  mapping**; a dropped column's data stays in the files until `REORG TABLE` then `VACUUM`. Changing a type or name by
  rewriting: `.mode("overwrite").option("overwriteSchema", "true")`.
- **Automatic:** `INSERT WITH SCHEMA EVOLUTION INTO` (DBR 18.1+), `MERGE WITH SCHEMA EVOLUTION` (or
  `.withSchemaEvolution()`), or `.option("mergeSchema", "true")` on a batch or streaming write. The session setting
  `spark.databricks.delta.schema.autoMerge.enabled` is **legacy**; Databricks recommends per-write evolution, which takes
  precedence. New columns are added **at the end** (or at the end of their struct), with their case preserved.

## 4. MERGE (upserts)

Source: https://docs.databricks.com/aws/en/delta/merge (updated 2026-09-11).

- `MERGE INTO target USING source ON <condition> WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ...` performs
  inserts, updates and deletes in one transaction.
- **Only one source row may match a given target row**; several matches fail the merge (DBR 16.0+ also evaluates the
  `WHEN MATCHED` conditions when deciding what counts as a duplicate match). So deduplicate the source first.
- `WHEN MATCHED`: at most one update and one delete action; optional conditions; evaluated in order; every clause but
  the last needs a condition; a matched row that meets no clause is left unchanged. `UPDATE SET *` / `updateAll()` and
  `INSERT *` / `insertAll()` assume the source has the target's columns (analysis error otherwise, unless schema
  evolution is on).
- `WHEN NOT MATCHED`: insert only; unspecified target columns get `NULL`.
- `WHEN NOT MATCHED BY SOURCE` (DBR 12.2 LTS+): update or delete target rows the source lacks; it cannot read source
  columns; Databricks recommends a condition to avoid rewriting the whole target.
- **Insert-only merge for deduplication:** `MERGE INTO logs USING new ON logs.uniqueId = new.uniqueId WHEN NOT MATCHED
  THEN INSERT *` appends only records not already present — the way to avoid duplicates when a batch is replayed.

## 5. Change data feed

Source: https://docs.databricks.com/aws/en/delta/delta-change-data-feed (updated 2026-10-09).

- Change data feed (CDF) tracks **row-level changes between table versions**: each change record carries the row and the
  metadata columns `_change_type` (`insert`, `update_preimage`, `update_postimage`, `delete`), `_commit_version` and
  `_commit_timestamp`. Uses: incremental ETL that processes only changed rows, audit trails, replication downstream.
- **Two approaches (2026):** **automatic** CDF computes changes at read time from row tracking (DBR 19+; Unity Catalog
  Delta tables with row tracking, or Iceberg v3), needs no per-table setting, and costs nothing on write; **legacy** CDF is
  turned on per table with `TBLPROPERTIES (delta.enableChangeDataFeed = true)` and records changes on write. Databricks
  recommends migrating to automatic CDF; the two can't be combined.
- Read in batch with `SELECT * FROM table_changes('t', <start version>)` or `spark.read.option("readChangeFeed",
  "true")`; incrementally with `spark.readStream.option("readChangeFeed", "true").table("t")`. Databricks recommends
  Structured Streaming for incremental processing (it tracks versions for you). A new stream first returns the current
  snapshot as `insert` rows, then the changes.
- CDF only records changes **after it was enabled**; it is not a permanent record. With legacy CDF, an interval when it
  was off can't be queried. Change files (`_change_data`) follow the table's retention and are removed by `VACUUM`.
  Queries can't span a non-additive schema change (rename, drop, type change). Automatic CDF isn't supported on tables
  with row filters or column masks.
- For SCD type 1 / type 2 processing, the page points to the **AUTO CDC** APIs of declarative pipelines (§10).

## 6. Unity Catalog

Sources: https://docs.databricks.com/aws/en/data-governance/unity-catalog/ (updated 2026-09-11) ;
https://docs.databricks.com/aws/en/database-objects/ (2026-09-11) ; https://docs.databricks.com/aws/en/tables/managed
(2026-10-26) ; https://docs.databricks.com/aws/en/tables/external (2026-10-06) ;
https://docs.databricks.com/aws/en/tables/convert-external-managed (2026-10-28) ;
https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/ (2026-10-15) ;
https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/privileges (2026-10-12) ;
https://docs.databricks.com/aws/en/data-governance/table-acls/object-privileges (legacy, 2026-09-11) ;
https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/ (2026-10-09) and
`.../filters-and-masks/manually-apply` ; https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/ (2026-10-22)
and `.../abac/core-concepts` (2026-10-27) ; https://docs.databricks.com/aws/en/volumes/ (2026-10-12) ;
https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage (2026-10-26).

### 6.1 What it is and its object model

- Unity Catalog is "the unified governance layer for data and AI built into Databricks": it enforces access control on
  every query, tracks lineage, and logs activity for audit. Used through Catalog Explorer, SQL, the CLI and REST APIs.
- **Enabled automatically** for workspaces created after **8 November 2023**; older workspaces are upgraded. It also exists
  as open source.
- **Three-level namespace:** `catalog.schema.object`. Catalogs are registered in a **metastore** managed at the
  **account** level (only admins work with it directly). A schema (also called a database) holds tables, views, volumes,
  functions and models.
- **Securable objects** are things you can grant on: the metastore, catalogs, schemas, tables, views, materialized views,
  volumes, functions, models, and non-data objects — **storage credentials** (a long-term cloud credential) and **external
  locations** (a storage path plus its credential), **connections** (Lakehouse Federation), and OpenSharing **shares,
  providers and recipients**.
- **Workspace-level assets** — notebooks, dashboards, jobs, pipelines, workspace files, SQL queries, experiments — are
  **not** in Unity Catalog; workspace access control lists govern them.
- Default access depends on how the workspace was enabled: a `main` catalog with a `default` schema, or a workspace
  catalog named after the workspace. With the workspace catalog, all workspace users get `USE CATALOG` on it and
  `USE SCHEMA`, `CREATE TABLE`, `CREATE VOLUME` and others on its `default` schema.
- The legacy **Hive metastore** (per workspace) is still supported, but Databricks recommends Unity Catalog for everything.

### 6.2 Managed and external tables

- **Managed tables** are "the default and recommended table type": Unity Catalog manages reads, writes, storage and
  optimization; files live in the managed storage location of the schema or catalog. They cost less to store and query.
  Features only managed tables get: predictive optimization (§2.6), automatic liquid clustering, multi-statement
  transactions, metadata caching, and **automatic file deletion after `DROP TABLE`** once the recovery period ends
  (default 7 days; `UNDROP TABLE` recovers within it; the period can be 0 or 7-30 days, set per catalog or schema with
  `RETAIN DROPPED`).
- **External tables** keep their files at a path you specify, which must lie in a registered **external location**;
  Unity Catalog manages only the metadata, not lifecycle, layout or optimization. **Dropping an external table removes the
  metadata but leaves the files.** Formats: Delta, CSV, JSON, Avro, Parquet, ORC, text. Use them for existing data in a
  format managed tables can't hold, or for direct access from non-Databricks clients (Unity Catalog privileges are **not**
  enforced on direct file access). Creating one needs `CREATE EXTERNAL TABLE` on the external location plus `USE CATALOG`,
  `USE SCHEMA` and `CREATE TABLE`. If an external tool changes the metadata, run `MSCK REPAIR TABLE t SYNC METADATA`.
- **Converting external to managed:** `ALTER TABLE t SET MANAGED` (Delta only; DBR 17.3 LTS+ or serverless; you must own
  the table). It keeps the name, settings, permissions, views and history, minimises downtime, and redirects path-based
  code. **Roll back within 14 days** with `ALTER TABLE t UNSET MANAGED` (writes made after the conversion are kept);
  Databricks deletes the managed copy seven days after a rollback. Run `UNSET MANAGED` before dropping a converted table.
  Foreign tables (Lakehouse Federation) use `SET MANAGED MOVE | COPY`. CTAS also works but loses these benefits.

### 6.3 Privileges

- Users start with **no access**. Every object has an **owner**, who holds all privileges on it and can grant them.
  Privileges can be granted by the owner, the owner of the containing catalog or schema, a user with **`MANAGE`** on the
  object, or a metastore admin. SQL: `GRANT <privilege> ON <securable-type> <name> TO <principal>`, `REVOKE ... FROM ...`,
  `SHOW GRANTS`; or the Permissions tab in Catalog Explorer. Principals are users, groups and service principals (by
  application ID).
- **Ownership:** "Databricks generally recommends that you grant table ownership to groups" (upgrade-wizard steps on
  `.../data-governance/unity-catalog/migrate`, read 2026-10-29).
- **Inheritance:** a privilege granted on a catalog or schema applies to **current and future** objects inside it (e.g.
  `SELECT` on a schema covers every table and view in it, including ones created later).
- **Reading a table needs three privileges:** `SELECT` on the table, `USE SCHEMA` on its schema, `USE CATALOG` on its
  catalog. `USE CATALOG` / `USE SCHEMA` grant no data by themselves; they are boundaries owners control — a table owner's
  `SELECT` grant is useless without them.
- `MODIFY` on a table allows insert, update and delete (and needs `SELECT` plus the usage privileges). `INSERT`, `UPDATE`
  and `DELETE` exist as finer-grained privileges (Beta). `BROWSE` (granted on a catalog) lets users see that objects exist
  and request access without reading data; Databricks recommends granting it to `All account users`. `ALL PRIVILEGES`
  implies every applicable privilege. `REFRESH` applies to materialized views.
- **There is no `DENY` statement in Unity Catalog's SQL.** `GRANT`, `REVOKE` and `DENY` statements belong to the
  **legacy Hive metastore** table access control. In Unity Catalog, the only denial is an **ABAC DENY policy** (Beta),
  currently limited to the `MANAGE ACCESS CONTROL` privilege; a DENY policy always beats a grant. **The Associate exam
  guide lists "GRANT, REVOKE, and DENY" (§1.2)**; PrepBench teaches the documented behaviour and says so.

### 6.4 Row filters, column masks, ABAC, dynamic views

- A **row filter** is a SQL UDF evaluated per row at query time; rows where it returns `FALSE` are hidden.
  `ALTER TABLE sales SET ROW FILTER us_filter ON (region)`; `DROP ROW FILTER` removes it.
- A **column mask** is a SQL UDF that returns the real value or a masked one (same or castable type); one mask per
  column. `ALTER TABLE users ALTER COLUMN ssn SET MASK ssn_mask` where the function is e.g.
  `CASE WHEN is_account_group_member('HumanResourceDept') THEN ssn ELSE '***-**-****' END`; `DROP MASK` removes it.
  Functions that check the user (`session_user`, `is_account_group_member`) run as the invoker; other filter logic runs
  with the definer's rights.
- These table-level controls are set by the table owner (or `MANAGE`) one table at a time. **ABAC policies** are
  Databricks' recommended approach for consistency across many tables: **governed tags** (key-value pairs defined at the
  account level, inherited from catalog and schema except for columns) plus a policy attached to a catalog, schema or
  table (metastore level is Beta), e.g. `CREATE POLICY mask_pii_for_hr ON CATALOG catalog_a COLUMN MASK mask_pii TO
  \`account users\` EXCEPT \`HR admins\` FOR TABLES WHEN has_tag('HR') MATCH COLUMNS has_tag('PII') AS pii_col ON COLUMN
  pii_col`. New tables that carry the tag are covered automatically, and table owners can't override the policy. Four
  policy types: row filter, column mask, GRANT, DENY (Beta).
- **Dynamic views** wrap base tables in a view that filters or masks (usually with `is_account_group_member()`); use them
  to expose a curated or joined slice to people without access to the base tables.
- Performance advice from the page: simple SQL UDFs, few arguments, few distinct masks, deterministic expressions that
  can't throw (e.g. `try_divide`), and ANSI mode on (with it off, a type mismatch silently becomes `NULL` and a filter can
  return every row).

### 6.5 Volumes and lineage

- **Volumes** govern **non-tabular** files (any format) in cloud storage: managed volumes (in the schema's managed
  storage) or external volumes (an existing path). Path: `/Volumes/<catalog>/<schema>/<volume>/<path>/<file>`. Uses:
  landing zones for raw files, staging for Auto Loader or `COPY INTO`, libraries, logs, checkpoints. Files in volumes
  **can't be registered as tables**; volumes are for path-based access.
- **Lineage** is captured automatically, down to **column level**, for queries through Spark DataFrames or Databricks SQL,
  across all workspaces on the metastore; shown in Catalog Explorer and queryable in `system.access.table_lineage` and
  `system.access.column_lineage`. Uses: impact analysis before a change, root cause of a bad report, tracking regulated
  data. Viewing needs at least `BROWSE` on the catalog.

## 7. Ingestion: Lakeflow Connect, COPY INTO, Auto Loader

Sources: https://docs.databricks.com/aws/en/ingestion/overview (updated 2026-10-07) ;
https://docs.databricks.com/aws/en/ingestion/ (2026-10-15) ; https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/
(2026-10-09) ; https://docs.databricks.com/aws/en/ingestion/copy-into/ (2026-10-06) ;
https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/ (2026-10-15) and its `schema`
(2026-09-11) and `file-detection-modes` (2026-09-11) pages.

### 7.1 Choosing an ingestion layer

- **Lakeflow Connect** is Databricks' name for its ingestion connectors: database connectors (MySQL, PostgreSQL, Oracle,
  SQL Server, using change data capture), SaaS connectors (Salesforce, HubSpot, Jira, Workday...), file connectors (cloud
  storage, Google Drive, SharePoint), streaming connectors (Kafka, RabbitMQ), query-based connectors (query the source
  without CDC), direct write (Zerobus Ingest API), plus community and custom connectors.
- Three layers, from most customisable to most managed: **Structured Streaming** (Spark APIs, exactly-once fault
  tolerance) → **Lakeflow pipelines** (declarative; manage orchestration, monitoring, data quality, errors) → **managed
  connectors** (built on pipelines; add source authentication, CDC, edge cases, API maintenance, retries, automatic schema
  evolution). Databricks recommends **starting with the most managed layer** and dropping down only if it doesn't fit.
- Managed connectors have a **connection** (a Unity Catalog securable holding the source credentials), an **ingestion
  pipeline** (writes **streaming tables**, serverless by default) and **destination tables**; database connectors add an
  **ingestion gateway** (a continuous job task) and staging storage. After the first full load they ingest only changes
  (CDC or change tracking where the source supports it; a cursor column for Salesforce).
- **Terminology gap:** the Associate guide says "Lakeflow Connect standard connectors" and "managed connectors". The
  documentation read on 2026-10-29 uses "managed connectors" and "SQL and Spark APIs" (Auto Loader, `COPY INTO`, Kafka and
  other sources); it does not define "standard connectors". PrepBench uses the documentation's terms and notes the exam's.
- For SQL users loading files incrementally, Databricks recommends `CREATE STREAMING TABLE` (with Auto Loader) "as the
  recommended alternative to `COPY INTO`".

### 7.2 COPY INTO

- `COPY INTO <table> FROM '<path>' FILEFORMAT = <fmt> [FORMAT_OPTIONS (...)] [COPY_OPTIONS (...)]` loads files from a
  location (S3, ADLS/ABFS, GCS, Unity Catalog volumes) into a Delta table. Formats: CSV, JSON, XML, Avro, ORC, Parquet,
  text, binary.
- It is **retriable and idempotent**: files already loaded are **skipped** on later runs (exactly-once file processing
  by default).
- It can infer, merge and evolve the target schema: an empty placeholder table (`CREATE TABLE IF NOT EXISTS t;`) plus
  `FORMAT_OPTIONS ('mergeSchema' = 'true')` and `COPY_OPTIONS ('mergeSchema' = 'true')` (DBR 11.3 LTS+).
- Databricks recommends streaming tables for a "more scalable and robust" file ingestion experience.

### 7.3 Auto Loader

- Auto Loader incrementally processes **new files as they arrive** in cloud storage through a Structured Streaming
  source called **`cloudFiles`**, optionally including files already present. Sources: S3, ADLS (`abfss://`), GCS, Unity
  Catalog volumes, Azure Blob (`wasbs://`; the legacy WASB driver is deprecated). Formats: JSON, CSV, XML, Parquet, Avro,
  ORC, text, binary file. It scales to billions of files and millions of files per hour.
- **Progress tracking:** discovered files' metadata is kept in **RocksDB in the checkpoint location**, which gives
  **exactly-once** processing and lets a failed stream resume where it stopped.
- **Recommended in Lakeflow pipelines**, where schema and checkpoint locations are managed for you; also recommended
  whenever Structured Streaming reads files from cloud storage. Over the plain file source it adds scale, cost (native
  listing APIs or notifications), and schema inference and evolution.
- **File detection modes:** **directory listing** (the default; needs only read access to the data) and **file
  notification** (cloud notification and queue services; with Unity Catalog **file events** on the external location no
  extra permissions are needed). Databricks **recommends file notification with file events** for most workloads. Modes
  can be switched across restarts with exactly-once kept. **Auto Loader never guarantees file order** in either mode.
- **Schema inference:** set `cloudFiles.schemaLocation` (can equal the checkpoint path); the schema is stored in a
  `_schemas` directory there. The first inference samples the first **50 GB or 1,000 files**. For JSON, CSV and XML every
  column is inferred as **string** unless `cloudFiles.inferColumnTypes` is `true`; Parquet and Avro use their own types.
  CSV is assumed to have headers. Schema hints (`cloudFiles.schemaHints`) override types.
- **Rescued data column** `_rescued_data` is added automatically when inferring: values that don't fit the schema (wrong
  type, unexpected column, different case) land there instead of being lost.
- **Schema evolution modes** (`cloudFiles.schemaEvolutionMode`):
  `addNewColumns` (default without a given schema) — the stream **fails** with `UnknownFieldException` after recording the
  new columns, and **resumes with the new schema on restart** (Databricks recommends running it as a Lakeflow Job that
  restarts automatically); `addNewColumnsWithTypeWidening` (Public Preview, DBR 16.4+) also widens types such as int to
  long; `rescue` — never evolves or fails, new columns go to the rescued column; `failOnNewColumns` — fails until the
  schema or file is fixed; `none` (default when a schema is given) — new columns ignored, not rescued unless
  `rescuedDataColumn` is set.
- Each source location loaded into a target needs **its own checkpoint**.
- Out-of-order files: with `AUTO CDC`, set `pipelines.cdc.tombstoneGCThresholdInSeconds` (default two days) longer than
  the worst delay; without pipelines, prefer soft deletes and compare timestamps before applying updates.

## 8. Structured Streaming

Sources: https://docs.databricks.com/aws/en/structured-streaming/concepts (updated 2026-10-27) ; `.../checkpoints`
(2026-09-11) ; `.../triggers` (2026-10-19) ; `.../watermarks` (2026-09-11) ; `.../output-mode` (2026-09-11) ;
`.../foreach` (2026-09-11).

- Structured Streaming uses the same Spark APIs as batch. Databricks runs it in **micro-batch mode** (the default, for
  ETL and analytics, latency of seconds to minutes) or **real-time mode** (sub-second operational workloads, latency "as
  low as five milliseconds"). It also powers streaming in Lakeflow pipelines.
- **Checkpoints** (`.option("checkpointLocation", path)`, required before the query runs) store **offsets** (what each
  micro-batch read), **commits** (which batches reached the sink, for exactly-once), **state** (for aggregations, joins,
  deduplication) and the query ID. **Each query needs its own checkpoint location; never share one.** Deleting the
  checkpoint or pointing to a new one makes the next run **start fresh**. Notebook `display()` and the memory sink make a
  temporary checkpoint with no guarantees.
- **Changes between restarts:** changing the number or type of sources, the subscribed topics or Auto Loader paths, the
  stateful operation types, the state schema or the sink type generally needs a **new checkpoint**; adding or removing
  filters, changing rate limits and trigger intervals is generally safe.
- **Triggers:** unspecified (default; a new micro-batch as soon as the last finishes, about 3-5 s latency);
  `.trigger(processingTime='10 seconds')` (fixed-interval micro-batches, less overhead); `.trigger(availableNow=True)`
  (**incremental batch**: process everything available now, then stop — for scheduled jobs; `Trigger.Once` is deprecated
  since DBR 11.3 LTS); real-time mode `.trigger(realTime='5 minutes')`; `continuous` is **not supported** on Databricks.
  **Serverless notebooks and jobs support only `AvailableNow` (and `Once`).** Rate limits such as `maxFilesPerTrigger`,
  `maxBytesPerTrigger` size micro-batches.
- **Watermarks** (`df.withWatermark("event_time", "10 minutes")`) bound state: the engine tracks the latest event time
  and drops state older than the threshold. Records within the threshold are always processed; later ones might not be.
  Shorter watermark = lower latency and less state but less tolerance of late data; longer = the reverse.
- **Output modes** (only matter for stateful queries with aggregations): **append** (default; emits only rows that won't
  change — with a watermark, after the threshold passes), **update** (emits rows changed in this trigger), **complete**
  (rewrites the whole result each trigger; aggregations only; poor at scale — Databricks suggests materialized views
  instead). Stream joins support append only. With a watermark, append and update drop old state; complete never does.
- **`foreachBatch`** (`writeStream.foreachBatch(fn)`, where `fn(batch_df, batch_id)`) runs batch code on each
  micro-batch: required for **Delta `MERGE` from a stream**, and for sinks without streaming support. It gives
  **at-least-once** writes; use `batch_id` to make them idempotent. Must handle empty DataFrames.
- **Restoring a Delta source** (§2.2) or changing its schema (§3) affects streams that read it.

## 9. Spark SQL and PySpark essentials (the exam's transformation objectives)

Sources: Apache Spark 4.2.0 documentation, read 2026-10-29: https://spark.apache.org/docs/latest/sql-performance-tuning.html ;
https://spark.apache.org/docs/latest/configuration.html ; https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-setops.html ;
PySpark API pages for `DataFrame.join`, `union`, `unionAll`, `unionByName`, `dropDuplicates`, `summary`,
`functions.approx_count_distinct`, `functions.explode`. Databricks pages: https://docs.databricks.com/aws/en/optimizations/aqe
(2026-10-12) ; `.../optimizations/spark-ui-guide/long-spark-stage-page` (skew and spill, 2026-10-12) ;
`.../optimizations/disk-cache` (2026-10-22) ; `.../compute/troubleshooting/debugging-spark-ui` (2026-09-11).
**Version note:** Databricks Runtime ships its own Spark build and can set its own defaults; the defaults below are
Apache Spark's, and PrepBench says so wherever it quotes one.

- **Execution terms** (https://spark.apache.org/docs/latest/cluster-overview.html and `.../rdd-programming-guide.html`,
  Spark 4.2.0, read 2026-10-29): an application is a **driver program** plus **executors** (processes on worker nodes
  that run tasks and keep data in memory or on disk). A **job** is "a parallel computation consisting of multiple tasks
  that gets spawned in response to a Spark action (e.g. `save`, `collect`)"; each job is divided into **stages** that
  depend on each other; a **task** is "a unit of work that will be sent to one executor". "All transformations in Spark
  are lazy": they run only when an **action** needs a result. The **shuffle** is "Spark's mechanism for re-distributing
  data so that it's grouped differently across partitions", and "an expensive operation since it involves disk I/O,
  data serialization, and network I/O".
- **Joins:** `df.join(other, on, how)`; `how` defaults to **`inner`** and may be `inner`, `cross`, `outer`/`full`,
  `left`, `right`, `semi`/`left_semi`, `anti`/`left_anti`. `on` can be a list of columns for **multiple keys**.
- **Unions:** `union()` and `unionAll()` both keep duplicates ("no automatic deduplication") and match columns **by
  position**; add `.distinct()` to deduplicate. `unionByName()` matches **by name**, and with `allowMissingColumns=True`
  fills missing columns with null. In SQL, `UNION` (= `UNION DISTINCT`) removes duplicates; `UNION ALL` keeps them.
  (So DataFrame `union()` behaves like SQL `UNION ALL` — a classic trap.)
- **Column and null operations** (PySpark API pages for `DataFrame.withColumn`, `withColumnRenamed`, `drop`, `dropna`,
  `fillna`, `functions.split`, `functions.coalesce`, read 2026-10-29): `withColumn(name, col)` adds a column **or replaces
  an existing column of the same name**, and the expression must be over the same DataFrame; `withColumnRenamed(existing,
  new)` and `drop(*cols)` are **no-ops** when the column doesn't exist; `split(str, pattern, limit=-1)` splits a string
  around a **Java regular expression** into an array; `dropna(how='any', thresh=None, subset=None)` drops rows with nulls
  (`how='all'` only when every value is null; `thresh` keeps rows with at least that many non-null values and overrides
  `how`); `fillna(value, subset=None)` replaces nulls (a dict maps column to value, and then `subset` is ignored);
  `coalesce(*cols)` returns the first non-null column value.
- **Columns and rows:** `explode(col)` returns one row per array element (or map entry). `dropDuplicates(subset)` /
  `drop_duplicates` removes duplicate rows, optionally on chosen columns; on a stream it keeps state across triggers,
  bounded by `withWatermark()`.
- **Aggregates:** `approx_count_distinct(col, rsd=0.05)` estimates a distinct count (maximum relative standard deviation
  0.05 by default; below 0.01, `count_distinct` is more efficient). `summary()` computes count, mean, stddev, min,
  approximate 25/50/75% percentiles and max by default.
- **Tuning parameters named in the exam guide** (Apache Spark defaults): `spark.sql.shuffle.partitions` = **200**
  ("number of partitions to use when shuffling data for joins or aggregations"); `spark.sql.autoBroadcastJoinThreshold` =
  **10 MB** (largest table broadcast to every worker for a join; `-1` disables broadcasting); `spark.default.parallelism`
  (default partition count for RDD operations such as `reduceByKey`, `join`, `parallelize`; depends on the cluster);
  `spark.executor.memory` and `spark.driver.memory` = **1g** each in open-source Spark. Databricks' skew-and-spill page
  suggests `spark.sql.shuffle.partitions=auto` so Spark chooses the count. Join strategy hints: `BROADCAST`, `MERGE`,
  `SHUFFLE_HASH`, `SHUFFLE_REPLICATE_NL` (priority in that order).
- **Adaptive query execution (AQE)** is **on by default** (`spark.sql.adaptive.enabled` = true). At each shuffle or
  broadcast exchange it uses real statistics to: switch sort-merge joins to broadcast hash joins; **coalesce** small
  post-shuffle partitions; **split skewed partitions in sort-merge and shuffle-hash joins**; propagate empty relations. It
  doesn't apply to streaming queries. Broadcast joins are never skew-optimized.
- **Reading the Spark UI for a slow stage** (Databricks guide): **spill** (execution memory exhausted, data written to
  disk; most common in shuffles) — try `shuffle.partitions=auto`, process fewer rows or columns, more executor memory,
  fewer larger workers for complex joins, smaller streaming batches. **Skew** — in Summary Metrics, the **Max task
  duration is 50% or more above the 75th percentile**; fixes: let AQE split it (joins only, above its thresholds),
  adjust `spark.sql.adaptive.skewJoin.*` thresholds, **salt** the hot key and aggregate in two stages, liquid clustering
  for a skewed stored table, the `REBALANCE` hint for skewed output. (The exam guide's sample question 1 rests on this:
  AQE doesn't fix a skewed `groupBy`; salting does.)
- **Disk cache** (formerly "Delta cache" or "DBIO cache"; a Databricks feature, not part of Delta Lake): workers keep
  local copies of Parquet files read from cloud storage, so repeated reads are faster; automatic on supported worker
  types; `CACHE SELECT` is ignored on SQL warehouses and DBR 14.2+. Databricks recommends it over the Spark cache for
  repeated reads of Parquet/Delta data.

## 10. Lakeflow Spark Declarative Pipelines

Sources: https://docs.databricks.com/aws/en/ldp/ (updated 2026-10-22) ; `.../ldp/concepts` (2026-10-13) ;
`.../ldp/streaming-tables` (2026-10-09) ; `.../ldp/materialized-views` (2026-10-15) ; `.../ldp/expectations`
(2026-10-26) ; `.../ldp/cdc` (2026-10-09) ; `.../ldp/updates` (2026-09-11) ; `.../ldp/pipeline-mode` (2026-09-14) ;
`.../ldp/monitor-event-logs` (2026-10-22).

- **What:** a declarative framework for batch and streaming pipelines in SQL and Python. Lakeflow pipelines are built
  on the open-source **Apache Spark Declarative Pipelines (SDP)** and extend it (e.g. **AUTO CDC is not in SDP**). This
  is the product formerly called Delta Live Tables (§0). Python API: `from pyspark import pipelines as dp`.
- **Benefits over hand-written Spark + Jobs:** automatic orchestration (flows run in dependency order with maximum
  parallelism; transient failures are retried at task, flow, then pipeline level); declarative code; incremental
  processing (materialized views reprocess only changed source data when possible).
- **Dataset types:**
  - **Streaming table** — each record processed **exactly once**, assuming an **append-only** source; for ingestion
    (Auto Loader, Kafka, Event Hubs, Pub/Sub, Kinesis) and low-latency transformations. It is a Unity Catalog managed table
    that is also a streaming target; owned and updated by **one pipeline**. Rows already appended are **not reprocessed**
    when the query changes (only new rows see the change) unless you run a **full refresh**. Joins in a streaming table do
    **not recompute** when a dimension changes. Needs a naturally bounded stream or a watermark.
  - **Materialized view** — results recomputed as needed to match the source's current state, **incrementally when
    possible**; "always correct at the time of their update", including late or out-of-order data; for aggregations,
    joins, and sources that update or delete; readable outside the pipeline. Latency is seconds to minutes. A changed UDF
    may need a manual full refresh.
  - **View** — evaluated on demand, not persisted, usable only inside the pipeline (intermediate steps, checks).
- **Flows** read a source, transform, write a target: append, update, **AUTO CDC**, and materialized view flows.
  **Sinks** stream to Delta tables, Kafka, Event Hubs, custom Python sources. A streaming table "can have one or more
  streaming flows (Append, AUTO CDC) written into it"; a materialized view one or more materialized view flows; a sink
  one or more Append or Update flows (`.../ldp/concepts`). **Standalone** streaming tables and materialized views can be
  created in Databricks SQL; Databricks then manages a pipeline (type `MV/ST`) for them.
- **Expectations** (data quality): a named SQL boolean constraint on a dataset, e.g. `CONSTRAINT valid_age EXPECT (age
  BETWEEN 0 AND 120)` / `@dp.expect("valid_age", "age BETWEEN 0 AND 120")`. Actions: **warn** (default; invalid rows are
  written, counted), **drop** (`ON VIOLATION DROP ROW`, `expect_or_drop`; dropped rows counted), **fail** (`ON VIOLATION
  FAIL UPDATE`, `expect_or_fail`; the update fails, no metrics recorded). Quarantining invalid rows is an advanced
  pattern built on top. Constraints can't use Python functions, external calls or subqueries on other tables.
- **AUTO CDC** (replaces `APPLY CHANGES`, same syntax; the old name still works): applies a CDC feed to a streaming table
  with keys and a **sequencing** column (`SEQUENCE BY`, a `STRUCT` for tie-breaks), handling **out-of-order events**, as
  **SCD type 1** (overwrite, no history) or **SCD type 2** (keep history, for all or chosen columns). `AUTO CDC FROM
  SNAPSHOT` derives changes by comparing snapshots when the source has no CDC feed. SQL `AUTO CDC ... INTO`, Python
  `create_auto_cdc_flow()`. Requires serverless pipelines or the Pro or Advanced edition.
- **Updates:** an update starts compute, validates the code (a dry run validates without writing), then refreshes
  datasets. **Refresh** (default): materialized views refresh (incrementally when cheaper), streaming tables process new
  records. **Full refresh:** materialized views recompute; streaming tables are **cleared**, their checkpoints reset, and
  all source data reprocessed. **Reset streaming flow checkpoints:** checkpoints cleared, data kept, source reprocessed.
- **Triggered vs continuous mode:** triggered processes what is available when the update starts, then stops (for
  freshness every 10 minutes, hourly, daily); continuous runs until stopped (freshness from about 10 seconds to a few
  minutes). Either mode can refresh either dataset type. Standalone tables always run triggered.
- **Run behaviour:** runs started from the editor or monitoring UI (non-continuous) reuse the cluster (two hours by
  default) and disable retries, for fast debugging; runs from Jobs or the API, and every continuous run, retry and restart
  automatically and shut the cluster down when done. (This is how the 2026 docs describe what older material called
  development and production mode.)
- **Event log:** every pipeline writes an event log (audit, data quality, progress, lineage) to a hidden Delta table;
  query it with `SELECT * FROM event_log(<pipelineId>)` (by default only the run-as user can). Databricks recommends the
  `pipeline_events` system table (Beta) across pipelines. Don't delete the event log.
- All pipeline tables are Delta tables, maintained by predictive optimization.

## 11. Lakeflow Jobs

Sources: https://docs.databricks.com/aws/en/jobs/ (updated 2026-10-09) ; `.../jobs/configure-task` (2026-10-21) ;
`.../jobs/triggers` (2026-10-23) ; `.../jobs/file-arrival-triggers` (2026-10-07) ; `.../jobs/conditional-tasks`
(2026-09-11) ; `.../jobs/for-each` (2026-09-22) ; `.../jobs/repair-job-failures` (2026-10-09) ; `.../jobs/monitor`.

- **Jobs, tasks, triggers.** A job coordinates one or more **tasks** shown as a **DAG**; it has a trigger, parameters
  pushed to tasks, notifications (email, webhooks, Slack) and Git settings. Task types include notebook, Python script,
  Python wheel, SQL, **pipeline**, ingestion pipeline, dashboard, Power BI, dbt, JAR, Spark Submit, **Run Job** (another
  job), **If/else**, **For each**, SQL alert.
- **Limits:** 2,000 concurrent task runs per workspace (`429 Too Many Requests` beyond); 10,000 job creations per hour;
  12,000 saved jobs; **1,000 tasks per job**.
- **Dependencies:** upstream tasks run first, in parallel where possible. **Run if** conditions: **All succeeded**
  (default), At least one succeeded, None failed, **All done** (run regardless — cleanup), At least one failed, All failed.
  Unmet success-type conditions mark the task `Upstream failed`; unmet failure-type conditions mark it `Excluded`
  (skipped).
- **If/else condition task** branches on a boolean expression (e.g. run transformations only if ingestion added rows).
  **For each** runs one nested task per element of an input array (JSON array, task values or job parameters; `{{input}}`
  in the nested task), with a **Concurrency** setting (default 1); a For each can't nest another For each. A task sets a
  **task value** with `dbutils.jobs.taskValues.set(key = ..., value = ...)`, and later tasks reference it as
  `{{tasks.<task_name>.values.<task_value_name>}}` (`.../jobs/for-each`).
- **Retries and timeouts:** for most configurations the default is **no retry**; add a retry policy per task (count and
  interval). Serverless jobs auto-optimize retries by default (can be disallowed). Continuous jobs use exponential
  backoff. A task's **Timeout** sets its maximum run time: exceed it and the status is **"Timed Out"**; the **Warning**
  duration only raises an event (for a notification). With both timeout and retries, the timeout applies to each retry.
- **Triggers:** **Scheduled** (time-based), **Table update** (when source tables change), **File arrival** (new files in
  a Unity Catalog external location or volume, checked recursively about every minute, best effort; no cost beyond the
  cloud's file listing; faster with file events enabled), **Model update**, **Continuous** (a new run starts whenever one
  ends), or manual / API. By default **one run of a job at a time**; runs beyond **maximum concurrent runs** are
  **skipped**.
- **Repair:** for a failed or cancelled multi-task run, **repair** re-runs only the unsuccessful tasks and their
  dependants, with the **current** job and task settings (fix first, then repair). A repaired task restarts from the
  beginning and **is not made idempotent** — a task that wrote half its output can duplicate it on repair, so use
  overwrite or merge rather than append. Repair needs two or more tasks; a single-task job is re-run with Run now.
  Shared job clusters get a new cluster for the repair.
- **Monitoring:** the Runs tab's **matrix view** shows each run and task; run bars are coloured by status (green
  success, red failure, pink skipped, yellow waiting for retry, grey pending / cancelled / timed out); system tables record
  job runs and tasks across the account (§15).

## 12. Compute and cost

Sources: https://docs.databricks.com/aws/en/compute/ (updated 2026-09-11) ; `.../compute/serverless/` (2026-10-22) ;
`.../compute/configure` ; `.../compute/access-mode-limitations` (2026-09-11) ; `.../compute/sql-warehouse/warehouse-types`
(2026-09-11) ; `.../jobs/compute` (2026-09-15) ; `.../compute/pool-index` ; `.../admin/clusters/policies` (2026-09-28) ;
`.../compute/photon` (2026-09-11) ; `.../compute/cluster-config-best-practices` ; Azure pricing page
https://azure.microsoft.com/en-us/pricing/details/databricks/ (read 2026-10-29).

- **Three families:** **serverless** compute (for notebooks, jobs and pipelines; Databricks allocates and manages it),
  **classic** compute (you create and configure it: all-purpose or job compute, standard or dedicated access mode,
  pools), and **SQL warehouses** (for SQL, analytics and BI; serverless, pro or classic).
- **Serverless:** available by default in workspaces with Unity Catalog (legacy non-UC workspaces don't get it); fast
  start and scaling, minimal idle time; **versionless** — always the latest runtime. Serverless notebooks and jobs support
  only `AvailableNow` / `Once` streaming triggers (§8). Recommended compute for notebook, Python script and wheel tasks is
  serverless jobs; for SQL tasks a serverless SQL warehouse; for pipelines a serverless pipeline; JAR and Spark Submit
  need classic jobs compute.
- **Classic compute:** one **driver** and zero or more **workers**. Choose the **Databricks Runtime** (latest for
  all-purpose; an **LTS** version for production jobs), instance types, **autoscaling** (min and max workers) or a fixed
  size, **single node** for small or non-distributed work, **spot instances** (workers only; the driver stays
  on-demand), and **automatic termination** after a set number of idle minutes. **Photon** (a native C++ vectorized
  engine; enabled by default from DBR 9.1 LTS) speeds up SQL, DataFrames, ETL and Delta writes, most for long queries on
  large data, with no code changes.
- **All-purpose versus job compute (cost model):** on Azure, "the Jobs Compute workload is defined as a job that both
  starts and terminates the cluster on which it runs"; all-purpose compute is "any workload that is not an automated
  workload, for example, running a command within Databricks notebooks"; the two are billed at different rates. Databricks
  does not recommend all-purpose compute for production jobs.
- **Access modes:** **standard** (formerly shared; many users share it, isolated from each other by Lakeguard; Databricks' default
  recommendation) and **dedicated** (one user or group). Standard doesn't support the ML runtime, GPUs, R, Spark Submit
  tasks or some SparkContext APIs; use dedicated for those. "Auto" picks standard unless an ML runtime, a GPU instance or
  a runtime below 14.3 is chosen.
- **Pools** keep idle instances ready to cut start-up and autoscaling time; **no DBUs are charged for idle pool
  instances** (the cloud provider still bills the VMs). Databricks recommends serverless over pools where possible.
- **Compute policies** (admin-defined) limit what users can create: fixed or hidden settings, cluster counts, maximum
  cost per cluster, required libraries. Everyone gets the **Personal Compute** policy (single-machine) by default. Tags on
  compute flow to usage logs for cost attribution.
- **SQL warehouse types:** **serverless** (Photon, Predictive IO, Intelligent Workload Management; starts in about 2-6
  seconds, scales up and down fast; compute in Databricks' account) → **pro** (Photon + Predictive IO; compute in your
  cloud account; use when serverless isn't available or you need custom networking) → **classic** (Photon only; entry
  level). Serverless is Databricks' choice for many concurrent BI and ad hoc SQL users (the exam's sample question 4,
  §1.2).
- **Billing unit (Azure):** "Azure Databricks bills you for virtual machines (VMs) provisioned in clusters and
  Databricks Units (DBUs) based on the VM instance selected"; "A DBU is a unit of processing capability, billed on a
  per-second usage." For serverless, the compute is in Databricks' account, so only DBUs are billed. Usage is queryable in
  `system.billing.usage` (§15).
- **Cost levers the pages give:** auto termination; spot instances where latency is lax; smaller instances for simple
  ETL without wide transformations; job compute (not all-purpose) for automated work; serverless or pools to cut idle
  time; policies to cap cluster size; predictive optimization instead of hand-scheduled maintenance (§2.6).

## 13. The lakehouse and the medallion architecture

Sources: https://docs.databricks.com/aws/en/lakehouse/ (updated 2026-09-11) ;
https://docs.databricks.com/aws/en/lakehouse/medallion (2026-09-11).

- A **data lakehouse** "combines the benefits of data lakes and data warehouses": open, direct access to data in standard
  formats in cloud object storage, plus low-latency, reliable BI and ML on the same data — one platform and one source of
  truth instead of a lake and a warehouse kept in sync. On Databricks it rests on **Apache Spark** (compute decoupled from
  storage), **Delta Lake** (ACID, schema enforcement) and **Unity Catalog** (governance).
- **Medallion architecture** (also "multi-hop"): a data design pattern of layers that improve quality step by step,
  **bronze → silver → gold**. Databricks calls it "a recommended best practice but not a requirement".
- **Bronze** (raw): keeps the source's raw state, appended incrementally, the base for reprocessing and audit; minimal
  validation — Databricks suggests storing most fields as string, `VARIANT` or binary so schema surprises don't drop
  data, plus provenance metadata (e.g. `_metadata.file_name`). Not for analysts.
- **Silver** (validated): cleaning, deduplication, normalisation, null handling, type casting, joins, schema
  enforcement and evolution, late and out-of-order data, quality checks; keeps at least one validated, non-aggregated
  version of each record. Build silver from bronze (**not straight from ingestion**), mostly with **streaming reads**
  of append-only bronze; batch reads for small dimension tables.
- **Gold** (enriched): dimensional models and aggregates aligned to business needs (e.g. a `weekly_bookings` materialized
  view), optimised for dashboards; some organisations keep several gold layers per domain (HR, finance, IT). Ingestion
  frequency is the main cost/latency lever (continuous incremental = higher cost, lower latency).

## 14. Identity, secrets and access

Sources: https://learn.microsoft.com/en-us/azure/databricks/admin/users-groups/service-principals (read 2026-10-29) ;
https://docs.databricks.com/aws/en/security/secrets/ (2026-09-11) ; https://learn.microsoft.com/en-us/azure/databricks/security/secrets/ ;
§6 for data privileges. Station I's identity facts stay in `lakehouse-p1-5-identity-governance-research.md`.

- **Principals:** users, groups and **service principals**. A service principal is an identity for automation with
  API-only access, granted access like a user; letting jobs **run as a service principal** keeps them working when a
  person leaves. On Azure there are Azure Databricks-managed service principals (Databricks OAuth or personal access
  tokens; Databricks recommends these for Databricks automation) and Microsoft Entra ID-managed ones (Databricks OAuth
  or Entra ID tokens).
- **Secrets:** a **secret scope** is a named collection of secrets, stored encrypted by Databricks; permissions are set
  per scope; Databricks recommends scopes per role or application, not per person. Notebook output and SQL using the
  `secret` function are redacted (`[REDACTED]`) where possible, but anyone allowed to read a secret can still expose it,
  so grant carefully. **Azure:** an **Azure Key Vault-backed** scope is a **read-only** interface to a Key Vault (manage
  the secrets in Azure); it needs the Vault access policy permission model (not Azure RBAC) and the Contributor or Owner
  role on the vault to create.
- For cloud storage, Databricks recommends Unity Catalog storage credentials and external locations (§17) over keys in
  secrets.
- For bundles in CI/CD, secrets are passed as variables through `BUNDLE_VAR_<name>` environment variables, never written
  into `databricks.yml` (§16; the exam's sample question 6).

## 15. Monitoring and observability

Sources: https://docs.databricks.com/aws/en/admin/system-tables/ (updated 2026-10-28) ;
`.../admin/system-tables/billing` (2026-10-18) ; `.../jobs/monitor` ; `.../ldp/monitor-event-logs` (2026-10-22) ;
`.../compute/troubleshooting/debugging-spark-ui` (2026-09-11) ; §9 for the Spark UI stage guide.

- **System tables** are a Databricks-hosted analytical store of the account's operational data in the **`system`
  catalog** (needs Unity Catalog). Examples: `system.billing.usage` (all billable usage, in DBUs, records usually within
  12 hours) and `system.billing.list_prices`; `system.access.audit` (audit events, 365 days free retention),
  `system.access.table_lineage` / `column_lineage`; `system.compute.*` (node types, warehouses, warehouse events,
  instance pools); `system.lakeflow.jobs`, `job_tasks`, `job_run_timeline`, `job_task_run_timeline`, `pipelines`,
  `pipeline_update_timeline`; `system.query.history`; `system.alert.*`. Databricks "highly discourages" exporting system
  table data outside the platform. Joining `system.billing.usage` with the pricing and compute tables attributes DBU
  spend to jobs and warehouses (the Professional guide's sample question 5). Columns used in the billing page's examples:
  `usage_date`, `sku_name`, `usage_quantity`, `usage_metadata.job_id`, `usage_start_time`, `usage_end_time`. The event
  log's examples filter `event_type` (`create_update`, `update_progress`) and read `details:flow_progress.status` and
  `details:flow_progress.metrics.num_output_rows` (`.../ldp/monitor-event-logs`).
- **Jobs UI:** run history and the matrix view (§11), task run details, duration thresholds and notifications.
- **Pipelines:** the pipeline UI's data quality tab and the **event log** (§10).
- **Spark UI:** jobs, stages, tasks, executors, the Streaming tab (input rate, processing time: a batch should finish
  within about 80% of the batch interval or a backlog builds), driver and executor logs, thread dumps.
- **Audit logs** (from the Associate sample question 3, consistent with the audit system table): delivered as JSON;
  PrepBench quotes no delivery latency beyond what that answer key states.

## 16. CI/CD: Git folders, Declarative Automation Bundles, the CLI

Sources: https://docs.databricks.com/aws/en/repos/ (updated 2026-09-11) ; https://docs.databricks.com/aws/en/dev-tools/bundles/
(2026-09-11) ; `.../dev-tools/bundles/variables` (2026-09-11).

- **Databricks Git folders** (formerly Repos) are a visual Git client and API in the workspace: clone a repository,
  create and switch branches, commit and push, resolve conflicts; for CI/CD, automate them with a service principal.
- **Declarative Automation Bundles** (formerly Databricks Asset Bundles) are infrastructure-as-code for Databricks
  projects: YAML (`databricks.yml` plus resource files) describing jobs, pipelines, dashboards and other resources,
  deployed **with their source files** as one bundle to a **target** environment (dev, test, prod). A feature of the
  **Databricks CLI** (v0.218.0+): `databricks bundle init` (from a template), `bundle validate`, `bundle deploy -t
  <target>`, `bundle run`. Databricks recommends OAuth user-to-machine authentication for the CLI.
- **Variables:** declared under `variables` (optionally with a `default`), overridden per target in `targets`, or given
  at run time with `--var="name=value"`, an environment variable **`BUNDLE_VAR_<name>`**, or
  `.databricks/bundle/<target>/variable-overrides.json`. Substitutions such as `${bundle.target}` and
  `${workspace.current_user.userName}` give environment-specific names (e.g. a schema `pipeline_bundle_${bundle.target}`).

## 17. Azure Databricks specifics

Sources: https://learn.microsoft.com/en-us/azure/databricks/introduction/ ; `.../getting-started/overview` (high-level
architecture) ; `.../connect/unity-catalog/cloud-storage/azure-managed-identities` ; `.../connect/storage/azure-storage`
(marked "retired" — legacy patterns) ; https://learn.microsoft.com/en-us/azure/data-factory/transform-data-databricks-notebook ;
`.../transform-data-databricks-job` (all read 2026-10-29). The learner's ADLS Gen2 notes are in
`adls-gen2-documentation-notes.md`; ADF's are in `adf-documentation-notes.md`.

- **Account, workspaces, metastore.** The Azure Databricks **account** manages identity (users, groups, service
  principals), workspaces, Unity Catalog metastores, billing. A metastore can be attached to **several workspaces in the
  same region**, which then share one view of the data and its access controls.
- **Control plane and compute plane.** The **control plane** (backend services, the web application) lives in the Azure
  Databricks account, not in your subscription. **Classic compute** runs in the **classic compute plane in your Azure
  subscription**, inside the workspace's virtual network. **Serverless compute** runs in a **serverless compute plane in
  the Azure Databricks account**, in the workspace's region, inside a per-workspace network boundary. Classic
  ("Hybrid" in the Azure portal) workspaces have a workspace storage account in your subscription.
- **Reaching ADLS Gen2 with Unity Catalog (recommended):** create an **Access Connector for Azure Databricks** (a
  first-party Azure resource holding a system-assigned and/or user-assigned **managed identity**), grant that identity a
  storage role on the ADLS account (e.g. **Storage Blob Data Contributor**; or Storage Blob Delegator on the account plus
  Contributor on one container), then use the connector in a Unity Catalog **storage credential** and **external
  locations**. Managed identities need no secret rotation and can reach a firewall-protected storage account from a
  VNet-injected workspace. Paths use `abfss://<container>@<account>.dfs.core.windows.net/<path>`.
- **Legacy pattern (retired page):** a Microsoft Entra ID **service principal** (app registration + client secret) with
  Storage Blob Data Contributor, set in Spark properties, or SAS tokens or account keys (Databricks recommends against
  account keys); credentials kept in **secret scopes**. Databricks now recommends Unity Catalog instead.
- **ADF + Databricks:** the ADF **Notebook activity** runs a notebook through an Azure Databricks **linked service**,
  passing `baseParameters`; the notebook returns a value with `dbutils.notebook.exit("value")`, read in ADF as
  `@{activity('<name>').output.runOutput}`. The ADF **Job activity** runs a Databricks **job** (including serverless jobs;
  choose the Serverless option in the linked service) and passes `jobParameters`. Library types for activities: jar, egg,
  whl, maven, pypi, cran. (Which tool orchestrates what is a design choice the pages leave to the team; PrepBench
  presents it as one, not as a rule.)

## 18. Databricks Free Edition (where the learner practises)

Sources: https://docs.databricks.com/aws/en/getting-started/free-edition (updated 2026-09-11) ;
https://docs.databricks.com/aws/en/getting-started/free-edition-limitations (2026-10-18).

- A **no-cost** Databricks for learning and experimenting, for personal, **non-commercial** use. It **replaced Community
  Edition**, retired in 2025. Signing up creates a workspace with **serverless compute and default storage**.
- **Serverless only**, quota-limited: no custom compute configurations; outbound internet limited to trusted domains.
  Going over the daily quota shuts compute down for the rest of the day (in extreme cases the rest of the month); data is
  kept.
- **Limits:** **one SQL warehouse, 2X-Small**; **5 concurrent job tasks** per account; **one active pipeline per pipeline
  type**; one workspace and one metastore; no account console or account-level APIs; no SSO or SCIM; sign-in by email
  one-time password, Google or Microsoft.
- **Not supported:** R and Scala, custom workspace storage locations, clean rooms, "all legacy Databricks features" and
  others. No SLA or support; inactive accounts may be deleted. LinkedIn verification can raise some limits.
- **What this means for hands-on steps:** notebooks (Python and SQL), Unity Catalog objects (catalogs, schemas, tables,
  volumes, grants within the one metastore), Delta operations, Auto Loader with `availableNow`, `COPY INTO`, a
  declarative pipeline, a small multi-task job and a SQL warehouse are all possible. Classic clusters, compute policies,
  pools, spot instances, instance types, account-level identity, cloud storage credentials (Access Connector) and
  file-notification setup are **not**: the guide teaches those from the docs and marks them "read, not run". Feature
  availability changes, so each hands-on step says what to do if a feature isn't offered.

## 19. What Databricks does not publish, and what these notes could not confirm

- **Pass marks** for both exams: not published (§1). **Question counts per section:** not published; the bank sizes
  sections by the published weights.
- **Professional exam:** the exam page and the guide disagree (59 vs 60 questions; ten vs nine sections, §1.3). The
  guide is newer; the bank follows it.
- **"DENY" in the Associate outline:** Unity Catalog SQL has no `DENY` statement; denial exists only as an ABAC DENY
  policy (Beta) on `MANAGE ACCESS CONTROL`; `DENY` statements belong to legacy Hive metastore table ACLs (§6.3).
  Questions never present `DENY` as a Unity Catalog SQL command.
- **"Lakeflow Connect standard connectors":** an exam term the current docs don't define (§7.1).
- **Databricks Runtime defaults** for Spark settings: the pages read don't list them; §9 gives Apache Spark's defaults and
  labels them so.
- **"Databricks Workflows" as the former name of Lakeflow Jobs:** not stated on any page read (§0).
- **Audit log delivery details** come only from the Associate guide's answer key (§15).
- **Fast-changing items.** Many features carry Beta or Public Preview labels and runtime requirements (automatic CDF needs
  DBR 19+, `INSERT WITH SCHEMA EVOLUTION` DBR 18.1+). The material avoids exam questions that hinge on a preview feature
  or a version number unless the exam outline names it, and gives the version when it matters.
- **Default task retries:** §11 (from the Jobs pages) says most configurations default to no retry; the notifications
  page (2026-10-09) says "By default, tasks are retried three times before failing fully". The material says a retry
  policy should be set explicitly and doesn't state a default.
- **Out-of-memory errors** have no named error condition in the reference; the material only states what §23.1 says.
- **Multi-statement transactions:** the warehouse-migration page (2026-09-11, §21.1) says there are no `BEGIN`/`END`
  constructs; the ACID page (2026-10-19, §2.7) describes `BEGIN ATOMIC ... END` across tables with catalog commits. The
  material follows the newer page and never says multi-table transactions are impossible.
- **Architect accreditation (§1.4):** no weights or question counts per area are published, and the training it
  expects is in Databricks Academy, which these notes did not read (it needs a sign-in). Registration is "free for
  Databricks customers and partners"; the page doesn't say whether anyone else can take it. "Solutions Architect" is not
  a Databricks credential.
- **Migration tooling (§21):** Lakebridge (linked from the Genie Migrate page) was not read; nothing here describes it.
  The UCX page shows its own version as 0.20.0 in an example; UCX changes often, so the material teaches its workflow
  order, not command details. Genie Migrate's availability per Azure region was not checked.

## 20. Azure Databricks networking and workspace deployment (the Platform Architect areas)

Sources: https://learn.microsoft.com/en-us/azure/databricks/security/network/ (updated 2026-10-06) ;
`.../security/network/classic/vnet-inject` (2026-10-09) ; `.../security/network/classic/secure-cluster-connectivity`
(2026-10-08) ; `.../security/network/classic/private-link` (2026-10-21) ;
`.../security/network/serverless-network-security/` (2026-10-06) ; `.../admin/workspace/` (2026-09-11) ; `.../admin/`
(2026-09-11) (all read 2026-10-29). These pages are Azure-only; everything in this section is **Azure:**.

### 20.1 Three connections, each secured on its own

- Databricks networking has three connection points: **users and applications → Databricks** (inbound: front-end
  Private Link, context-based ingress control, IP access lists for workspaces and for the account console); **control
  plane ↔ classic compute plane** (VNet injection, secure cluster connectivity, back-end Private Link, user-defined
  routes, peering, VPN/ExpressRoute to on-premises); **serverless compute plane → your resources** (network connectivity
  configurations, private endpoints, serverless egress control with network policies, storage firewalls).
- Traffic between the classic compute plane and the control plane crosses the **Microsoft network backbone, not the
  public internet**, even with secure cluster connectivity disabled. Control plane ↔ serverless compute plane is also
  always on the cloud backbone.
- Azure Databricks **charges for networking** when serverless workloads connect to customer resources, and when
  performance-intensive services send data cross-region back to clients.

### 20.2 Workspace types and who can create one

- **Serverless workspace:** pre-configured with serverless compute and **default storage**; you can still connect your
  own cloud storage. Microsoft recommends it for most uses (dashboards, Apps, exploratory notebooks and SQL warehouses,
  serverless pipelines, AI features; Lakehouse Federation to SaaS, but not Lakeflow Connect).
- **Hybrid (classic) workspace:** provisions storage and compute in **your** Azure subscription; serverless is still
  available. Recommended for porting RDD code, Scala or R as the main language, streaming that needs **time-based
  trigger intervals**, and reaching on-premises or private databases directly through Lakeflow Connect.
- Creating a workspace needs an Azure subscription that **isn't a Free Trial**, and the **Contributor or Owner** role at
  subscription level (or a custom role with the listed `Microsoft.Databricks/*` and resource-provider permissions).
  Deployment: Azure portal or Terraform as the standard methods; also Azure CLI, PowerShell, ARM template, Bicep.
- Account-level administration covers billing, serverless quotas, workspaces, identity (users, groups and service
  principals via **SCIM** provisioning), compute policies, system tables, audit logs and cost management.

### 20.3 VNet injection (classic compute in your own VNet)

- Deploys the **classic compute plane** into **your** VNet, for: private connectivity to Azure services (service or
  private endpoints), on-premises access through user-defined routes, traffic inspection with network virtual
  appliances, custom DNS, extra NSG egress rules.
- **Requirements:** the VNet is in the **same region and subscription** as the workspace; VNet CIDR **/16 to /24**; **two
  dedicated subnets**: a **container** subnet (also called private) and a **host** subnet (also called public), each at
  least **/26** recommended (/28 possible, not recommended), ideally the same size. Subnets **can't be shared across
  workspaces** and can't hold other Azure resources. **Subnet ranges can't be changed after deployment.** The workspace
  creator needs **Network Contributor** on the VNet (or the subnet join/write permissions).
- **Sizing:** each cluster node takes **two IPs** (one in each subnet); Azure reserves **five IPs per subnet**. A
  smaller VNet runs out of addresses sooner.
- Databricks **delegates** both subnets to `Microsoft.Databricks/workspaces` and **manages the NSG rules** (don't modify
  or delete them; one NSG per workspace recommended). Outbound to the `AzureDatabricks` service tag on **443** (infra,
  data sources, libraries), **3306** (metastore), **8443** (compute → control-plane API), **8444** (Unity Catalog logging
  and lineage), 8445-8451 reserved; outbound to Storage 443, EventHub 9093. Two inbound rules (ports 22 and 5557 from
  `AzureDatabricks`) exist **only if secure cluster connectivity is disabled**.
- The **managed resource group** can't be modified. Running out of space: update the network configuration (Public
  Preview) or ask the account team to widen the subnet CIDR.

### 20.4 Secure cluster connectivity (no public IP, "NPIP")

- With it on, the customer VNet has **no open ports** and classic compute nodes have **no public IP addresses**. Each
  cluster opens an **outbound** connection on **443** to the control plane's **SCC relay**; administration requests come
  back through that tunnel. Serverless compute doesn't use SCC but has no public IPs either.
- **Default on** for new workspaces (portal default Yes; ARM `enableNoPublicIp` defaults to `true` from API version
  2024-05-01). The page says a future release will make it **mandatory** for classic workspaces. Adding it to an
  existing workspace requires VNet injection and stopping all classic compute first; the update can take over 15 minutes.
- **Egress:** with the default managed VNet, Databricks creates a **NAT gateway** in the managed resource group (extra
  cost). With VNet injection, Databricks recommends an **Azure NAT gateway on both subnets** for a **stable egress
  public IP** (for external allow lists). **Don't use an egress load balancer** with SCC (port exhaustion risk).
  After **31 March 2026**, new Azure VNets have **no default outbound internet access**, so new workspaces need an
  explicit method such as a NAT gateway; existing workspaces are not affected.
- Firewalls: allow-list the SCC relay **domain names**, not IP addresses (the IPs change).

### 20.5 Private Link: three kinds, and serverless connectivity

- **Inbound (front-end)** secures users → web app, REST API, Apps, Databricks Connect. Prerequisites: Premium plan,
  VNet injection, SCC. Endpoints: `databricks_ui_api`, `browser_authentication` (and optionally `general_access`).
- **Outbound (serverless)** secures serverless compute → your Azure resources. Prerequisite: Premium plan. Uses private
  endpoint rules in an **NCC**.
- **Classic (back-end)** secures classic compute → control plane (REST API and the SCC relay). Prerequisites: Premium
  plan, VNet injection, SCC. Endpoint: `databricks_ui_api`.
- They can be used **independently or together**; "complete private isolation" uses all of them with **public network
  access disabled** and required NSG rules set to `NoAzureDatabricksRules` (front-end only keeps `AllRules`).
- **`browser_authentication`** makes browser SSO work over a private connection: **one per region and private DNS zone**,
  serving every workspace there. Best practice in production is a dedicated **"private web auth workspace"** per region
  to host it, because **deleting the host workspace breaks web login for every workspace that depends on it**.
- **`general_access`** can serve the account console and workspaces **in different regions** from one endpoint;
  `databricks_ui_api`, `browser_authentication` and `service_direct` are **region-specific**.
- Two VNets: a **transit VNet** (hub for user connectivity: inbound private endpoints, browser-auth workspace) and the
  **workspace VNet** (workspace subnets plus a classic private endpoint subnet). Suggested sizes: transit private
  endpoint subnet /26-/25, browser-auth workspace /28 or /27, classic private endpoint subnet /27.
- **NCC (network connectivity configuration):** an **account-level, regional** construct, created by account admins,
  that manages private endpoints for serverless compute; attachable to **up to 50 workspaces** in the same region; **up
  to 20 NCCs per region per account**; **100 private endpoints per region**. Adding a private endpoint creates a request
  the resource owner must **accept**.
- Without a private endpoint, serverless reaches Azure storage through **service endpoints** and other resources
  through **NAT IPs**. Storage accounts that allow-listed serverless **subnet IDs can no longer connect**: put the storage
  account in a **network security perimeter** and allow the `AzureDatabricksServerless` service tag (it can be scoped to
  a region), otherwise serverless gets **403 Forbidden**. A storage firewall also affects classic compute, which must be
  allowed separately.

## 21. Migrating to Databricks

Sources: https://docs.databricks.com/aws/en/migration/ ; `.../migration/warehouse-to-lakehouse` ; `.../migration/etl` ;
`.../migration/spark` ; `.../migration/parquet-to-delta-lake` ; `.../sql/language-manual/delta-convert-to-delta` (all
updated 2026-09-11) ; `.../migration/agentic-code-converter` (2026-10-27) ;
`.../data-governance/unity-catalog/migrate` (2026-10-06) ; `.../data-governance/unity-catalog/ucx` (2026-10-06) ;
`.../data-governance/unity-catalog/hive-metastore` (2026-09-11) ; `.../query-federation/hms-federation-concepts`
(2026-09-11) ; https://learn.microsoft.com/en-us/azure/databricks/migration/ (2026-09-11, same content) (all read
2026-10-29). Station F of the Lakehouse Lab (Migration Factory) teaches the programme side; these notes are the platform
facts.

### 21.1 What the docs say a migration is

- Databricks frames it as unifying, not removing, warehousing: "Migrating your data warehousing workloads to Databricks is
  not about eliminating data warehousing, but rather unifying your data ecosystem." Most warehouse queries and dashboards
  run "with minimal code refactoring" once the initial data migration and governance configuration are done.
- **Differences a warehouse team will hit:** all transactions are **table-level** (no database-level transactions or
  locks); **no `BEGIN`/`END`**: each statement is its own transaction (but the newer ACID page describes `BEGIN ATOMIC
... END` for tables with catalog commits: §2.7, §19); three-level names `catalog.schema.table`
  ("database" and "schema" are synonyms); **primary and foreign keys are informational only**; data types and numeric
  precision may differ from the source and must be chosen deliberately.
- **Hive workloads** mostly run with minimal refactoring. Concerns: Hive SerDes (change DDL from `STORED AS` to
  `USING`); Hive UDFs installed as libraries or rewritten as native Spark; directory and partition layout (Databricks
  partitions differently). Converting to Delta at the same time makes some Hive DDL/DML unsupported, among them `ROW
  FORMAT`, `SERDE`, `STORED AS`, `ALTER TABLE ADD|DROP PARTITION`, `ALTER TABLE RECOVER PARTITIONS`, `CREATE TABLE
  LIKE`, `INSERT OVERWRITE DIRECTORY`, `LOAD DATA`.
- **SQL ETL** usually needs little refactoring; much of the work is configuring access to sources. **dbt** runs natively;
  a light refactor to Lakeflow pipelines "might lower your total cost". Pipelines in languages other than SQL, Spark or
  Hive "might need to be heavily refactored". File-arrival cloud functions map to Auto Loader + Structured Streaming +
  Jobs.
- **Existing Spark code:** write Delta instead of Parquet (and drop pseudo-transaction workarounds such as `MSCK repair`
  and manual `ALTER TABLE ADD PARTITION`); use libraries the Databricks Runtime ships; replace explicit `SparkSession`
  creation with `getOrCreate()`; remove `sys.exit()`, `sc.stop()` and `awaitTermination()`; don't hand-tune executor and
  JVM settings ("Providing custom configurations ... can result in reduced performance"); then run in a test
  environment and **compare performance and results** with the legacy system.

### 21.2 Moving the data: Parquet to Delta

| Method | Incremental | Duplicates data | Keeps the layout | Backfill | Effort |
|---|---|---|---|---|---|
| Deep `CLONE` Parquet | Yes | Yes | Yes | Yes | Easy |
| Shallow `CLONE` Parquet | Yes | No | Yes | Yes | Easy |
| `CONVERT TO DELTA` | No | No | Yes | No | Easy |
| Auto Loader | Yes | Yes | No | Optional | Some configuration |
| Batch Spark job | Custom | Yes | No | Custom | Custom |

- Keeping the old partitioning is possible but "over-partitioned tables are one of the main culprits that cause slow
  workloads on Delta Lake".
- **`CONVERT TO DELTA`** builds a transaction log over the existing files in place and infers the schema from Parquet
  footers (it also converts Parquet-based Iceberg tables, by path only). Caveats: files written during conversion may be
  missed; afterwards **all writes must go through Delta**, because **a file the log doesn't track is invisible and
  `VACUUM` can delete it**; converting a directory shared by several external tables breaks the others until they are
  converted too. `NO STATISTICS` speeds conversion; liquid clustering is then recommended to regenerate statistics.
- Keep Parquet only where an upstream writer can't write Delta or a downstream reader can't read it.

### 21.3 Moving the metadata: Hive metastore to Unity Catalog

- The workspace Hive metastore is **legacy**; it appears as the catalog `hive_metastore` beside Unity Catalog catalogs
  (Unity Catalog is "additive"), and joins across them work **only in the workspace that owns the Hive data**. Its tables
  lack Unity Catalog auditing, lineage and access control. Databricks recommends migrating and then **disabling direct
  Hive metastore access** (clusters keep connecting to it until you do).
- **Access model differences:** Unity Catalog is account-level and grants to **account groups** (Hive: workspace-local
  groups); `USE CATALOG` + `USE SCHEMA` are always needed; a view owner needs only `SELECT` on what it reads; no `ANY
  FILE`, `ANONYMOUS FUNCTION`, `DENY` or `READ_METADATA`.
- **Default catalog:** `hive_metastore` if the workspace was enabled for Unity Catalog manually, the workspace catalog if
  automatically; keeping `hive_metastore` as default during the move avoids breaking unqualified code.

| Tool | From | Creates in Unity Catalog | Use it when |
|---|---|---|---|
| **UCX** (Databricks Labs) | managed or external Hive tables | managed or external | a whole-workspace upgrade: assessment, groups, permissions, storage, tables; **the only bulk path to managed tables** |
| **Upgrade wizard** (Catalog Explorer) | managed or external | **external only** | a visual, schema-at-a-time upgrade (runs `SYNC`), optionally scheduled |
| **`SYNC`** | managed or external, **not** managed tables in workspace storage (DBFS root) | **external only** | the same in SQL; can be scheduled to keep a hybrid state current |
| **`CREATE TABLE CLONE`** (deep) | managed Delta tables | **managed** | full Unity Catalog benefits; `CTAS` if the table doesn't qualify |

- **Impact:** Hive partition commands don't work on Unity Catalog tables, and **a cloned table starts with no history**:
  no time travel to pre-migration versions. `SYNC` writes bookkeeping properties onto the source table.
- **UCX** is a Databricks Labs project: "not formally supported by Databricks with service-level agreements". It needs
  the Databricks CLI, account admin + workspace admin (not a service principal), a Unity Catalog metastore attached in
  every region involved (which also turns on identity federation), and a Pro or Serverless SQL warehouse. Order:
  **assessment** (stored as Delta tables in an inventory schema, with a dashboard; rerunnable) → **group migration**
  (workspace-local groups to account groups, permissions replicated) → **table migration** (external Hive tables via
  `SYNC`, managed tables in workspace storage via `DEEP CLONE`; preparation commands create a table-mapping CSV to review
  and an "uber" principal with read-only access to all storage, to be removed afterwards). Its code migration workflow is
  "not yet available".
- **Hive metastore federation** is the gradual alternative: Unity Catalog crawls the Hive metastore into a **foreign
  catalog**. For the workspace's **internal** Hive metastore it is **read and write** (DDL is written through to Hive,
  so `DROP SCHEMA ... CASCADE` drops the Hive tables too, with no `UNDROP`); for external Hive metastores and Glue it is
  **read-only**. Workloads move one at a time by switching their default catalog to the foreign catalog, then direct
  Hive access is disabled. Foreign tables lack managed-table features such as predictive optimization, and can be
  "marginally" slower. **Fallback mode** on an external location lets unmigrated workloads fall back to their old
  cluster credentials during the move; it is for migration only, and the audit log (`system.access.audit`,
  `request_params.fallback_enabled`) shows whether anything still uses it before you turn it off.
- **Azure:** the pages above are written with AWS examples ("IAM role"); on Azure the storage credential uses the Access
  Connector's managed identity (§17).

### 21.4 Converting SQL code: Genie Migrate

- **Genie Migrate** (formerly the "agentic code converter") converts SQL from **T-SQL, Snowflake, Redshift, Oracle,
  BigQuery and Teradata** to Databricks SQL, or (Beta) to notebooks using the DataFrame API, inside a **migration
  project** that tracks each file's status (converted, needs review, failed). Subagents check **syntax** and **semantic
  intent** (same joins and `WHERE` clauses) and retry. Limits: **300 files per batch**; **Teradata BTEQ not supported**.
  Project analysis of complexity and lineage is Beta. **Custom skills** (`Workspace/.assistant/skills/<name>/SKILL.md`)
  capture conversion rules learned from the first batches.
- The page's own testing advice: start with two to five files, run the output, include dialect-specific constructs
  (T-SQL window functions, Snowflake `QUALIFY`, Redshift `LISTAGG`), and **run original and converted queries on
  equivalent data and compare the results** ("semantically correct, not only syntactically valid").

## 22. Apache Parquet: the file format under Delta Lake

Sources: https://parquet.apache.org/docs/overview/ ; `.../docs/concepts/` ; `.../docs/file-format/` ;
`.../file-format/configurations/` ; `.../file-format/metadata/` ; `.../file-format/types/` ;
`.../file-format/nestedencoding/` ; `.../file-format/data-pages/` ; `.../data-pages/columnchunks/` ;
`.../data-pages/encodings/` ; `.../data-pages/compression/` ; `.../file-format/pageindex/` ;
`.../file-format/bloomfilter/` (the Apache Parquet site, pages last modified between March 2024 and October 2026) ;
https://spark.apache.org/docs/latest/sql-data-sources-parquet.html (Spark 4.2.0) ;
https://docs.databricks.com/aws/en/query/formats/parquet (2026-08-26) ; `.../tables/partitions` (2026-09-11) (all read
2026-10-29).

### 22.1 What it is and how a file is laid out

- "Apache Parquet is an open source, column-oriented data file format designed for efficient data storage and
  retrieval", with compression and encoding schemes for "complex data in bulk". The format is a specification
  (`parquet-format` plus the `parquet.thrift` metadata definitions); libraries are separate (parquet-java, formerly
  `parquet-mr`; Arrow's C++, Go and Rust; DuckDB; and others). **Not every implementation supports every feature**, so
  mixing writers and readers needs testing.
- **Hierarchy:** a **file** holds one or more **row groups** (a horizontal slice of rows); a row group holds **exactly one
  column chunk per column**, stored contiguously; a column chunk is divided into **pages**, the indivisible unit of
  encoding and compression. Units of parallelism: file/row group for splitting work, column chunk for I/O, page for
  encoding and compression.
- **Layout:** the file starts and ends with the 4-byte magic number `PAR1`. Column chunks come first; the **file
  metadata (footer)** comes **after the data**, followed by its 4-byte length. The footer records where every column
  chunk starts. Writing it last allows **single-pass writing**; readers **read the footer first**, then only the column
  chunks they need. Metadata is separate from data, so one metadata file can reference several Parquet files.
- Two kinds of metadata: **file metadata** (`FileMetaData`: offsets and sizes for navigation) and **page headers**
  (stored inline with each page, used for decoding). Both are Thrift structures in the compact protocol.

### 22.2 Why columnar storage makes queries cheap

- Because each column is stored separately, an engine reads **only the columns a query needs** (column pruning).
  Databricks' own wording: Parquet "allows query engines to read only the columns needed and skip irrelevant row groups".
- **Statistics** (minimum and maximum values) are kept for column chunks, and readers use them and dictionaries for
  **predicate pushdown**: skipping data whose range can't match a filter. The optional **page index** (`ColumnIndex` +
  `OffsetIndex`, stored near the footer) holds per-page bounds so a reader can jump straight to matching pages instead of
  reading every page header; on a column the data is sorted by, a single-row lookup reads one page per column. Bounds may
  be truncated values (e.g. `"B"`/`"C"` instead of a long string).
- **Bloom filters** (optional, split-block) answer "definitely no" or "probably yes" for a value, giving pushdown on
  **high-cardinality** columns where min/max ranges are wide and dictionaries too big. No false negatives.
- This is the file-level form of the **data skipping** Delta Lake does with the statistics it keeps in its log (§2.5).

### 22.3 Types, encodings and compression

- **Physical types** are deliberately few: BOOLEAN, INT32, INT64, INT96 (**deprecated**, legacy timestamps only),
  FLOAT, DOUBLE, BYTE_ARRAY, FIXED_LEN_BYTE_ARRAY. **Logical types** (strings, decimals, dates, timestamps and more)
  are annotations on top of them.
- **Nested data** (structs, lists, maps) uses the **Dremel** encoding with **definition levels** (how many optional
  fields on the path are present: this is how nulls are recorded) and **repetition levels** (where a repeated field
  repeats). A required, non-nested column stores only its values.
- **Encodings:** PLAIN (always available); **dictionary** (`RLE_DICTIONARY`: a dictionary page first, then indexes into
  it; if the dictionary grows too big in size or distinct values, the writer **falls back to plain**); RLE/bit-packing
  hybrid (booleans, dictionary indexes, levels); delta encodings for integers and byte arrays; BYTE_STREAM_SPLIT and ALP
  for floating-point data. `PLAIN_DICTIONARY` and `BIT_PACKED` are deprecated.
- **Compression** applies per page: UNCOMPRESSED, SNAPPY, GZIP, LZO, BROTLI, ZSTD, LZ4_RAW; the old `LZ4` codec is
  deprecated in favour of `LZ4_RAW`. **Spark's default** codec for Parquet writes is **snappy**
  (`spark.sql.parquet.compression.codec`; also none, uncompressed, gzip, lzo, brotli, lz4, lz4_raw, zstd).

### 22.4 Sizes the specification recommends

- **Row groups: large, 512 MB to 1 GB**, for large sequential reads (at the cost of more write buffering); the guidance
  was written for HDFS (1 GB row group, 1 GB block, one block per file). **Data pages: 8 KB** recommended; smaller pages
  allow finer-grained reads, larger ones less header overhead. These are the specification's recommendations; engines
  choose their own defaults, and these notes don't give Databricks' write defaults (not on the pages read).

### 22.5 Parquet in Spark and Databricks

- **Spark:** reading Parquet preserves the schema, but **every column becomes nullable** "for compatibility reasons".
  **Schema merging** across files with different schemas is **off by default** (since Spark 1.5) because it is
  "relatively expensive"; turn it on with the `mergeSchema` option or `spark.sql.parquet.mergeSchema`. **Partition
  discovery** reads Hive-style directories (`gender=male/country=US`) as columns, inferring their types by default.
  The **vectorized reader** is on by default.
- **Databricks:** Parquet is "the underlying storage format for Delta Lake", so the most common format of data stored
  in Databricks. It reads and writes Parquet directly (`read_files(..., format => 'parquet')`, `USING PARQUET`);
  streaming Parquet files needs Auto Loader. Specifying a schema avoids inference cost.
- **What plain Parquet lacks, and Delta adds** (§2.1): Parquet is a file format; a directory of Parquet files has no
  transaction log, so no ACID commits, schema enforcement, time travel or `MERGE`. Databricks: for those "alongside
  Parquet's columnar performance, Delta Lake is the recommended format".
- **Partitioning:** Spark writes Parquet with **Hive-style partitioning**, which "is not part of the Delta Lake
  protocol"; workloads shouldn't rely on that directory layout for Delta tables. Databricks recommends **liquid
  clustering** for all managed tables; most tables **under 100 TB don't need partitioning**; **don't partition below
  1 TB**; each partition should hold **at least 1 GB**; partitioning suits low-cardinality columns (dates, locations),
  not timestamps or IDs. Unpartitioned Delta tables get **ingestion time clustering** automatically. "Transactions
  are not defined by partition boundaries": Delta's log gives atomicity, so a batch needn't be isolated in its own
  partition as with Hive-style tables.
- **Small files:** many small files are the cost of over-partitioning ("fixed partition boundaries and small-file
  issues common with static partitioning"); `OPTIMIZE` compacts them (§2.4) and liquid clustering avoids the cause.
  Converting a Parquet lake to Delta keeps its old partitioning (§21.2).

## 23. Production operations and troubleshooting

Sources (all read 2026-10-29): https://docs.databricks.com/aws/en/structured-streaming/production (updated 2026-10-26) ;
`.../structured-streaming/stateful-streaming` (2026-10-09) ; `.../structured-streaming/rocksdb-state-store` (2026-09-11) ;
`.../jobs/repair-job-failures` (2026-10-09) ; `.../jobs/notifications` (2026-10-09) ; `.../sql/user/alerts/`
(2026-10-15) ; `.../sql/user/queries/query-profile` (2026-09-11) ; `.../error-messages/` (2026-09-11) ;
https://learn.microsoft.com/en-us/azure/databricks/compute/troubleshooting/ ; `.../init-scripts/` (2026-09-28) ;
`.../libraries/` (2026-09-11) ; `.../release-notes/runtime/databricks-runtime-ver` (support lifecycles, 2026-09-11) ;
`.../lakehouse-architecture/operational-excellence/best-practices` ; `.../lakehouse-architecture/reliability/best-practices` ;
https://learn.microsoft.com/en-us/azure/databricks/security/keys/ ; `.../admin/disaster-recovery` (2026-09-11) ;
`.../notebooks/testing` (2025-01-21).

### 23.1 Running streams in production

- Run production streams as **scheduled Lakeflow Jobs or Lakeflow pipelines**, never on all-purpose compute; use jobs
  compute. Remove `display` and `count` calls. Schedule the job in **Continuous** mode (the Jobs schedule, not the
  trigger). **Don't enable autoscaling** for Structured Streaming jobs (it has limits when shrinking for streams).
- **Design for failure:** always configure streams to **restart automatically** (schema evolution needs it, §7.3). The
  continuous job trigger prevents concurrent runs, starts a new run after a failure, and retries with **exponential
  backoff**. On restart, the micro-batch planned before the failure runs again; if it failed **out of memory** or was
  cancelled for being too big, **scale up the compute** to get past it.
- **Don't use `awaitTermination()`** in jobs: the Jobs service already keeps the run alive while a query is active, and
  the call blocks tracking (streaming backlog notifications need it). Use it only interactively or locally.
- **Several streams in one job:** with multiple continuous tasks, a failed task retries on its own only if **Task retry
  mode** is **On failure**; otherwise the job waits for all tasks to fail, so **a failed stream can stay down while the
  job looks healthy**. Set On failure plus task failure notifications, or give each critical stream its own job.
- **Latency:** real-time mode for sub-second needs; for micro-batch, update output mode where supported, a
  `processingTime` trigger of `0`, a watermark long enough not to drop needed late data, idempotent sinks, and
  asynchronous progress tracking for continuous streams.

### 23.2 Stateful streaming in production

- Stateful operations: streaming aggregations, `distinct`, `dropDuplicates`, stream-stream joins, custom stateful apps.
  Misconfigured state "can lead to unexpected latency and production problems".
- **RocksDB** is the default state store from DBR 17.3; Databricks recommends it with **changelog checkpointing** for
  all stateful queries. The state store type **can't change between restarts** without a new checkpoint.
- **Shuffle partitions are fixed when the checkpoint is created**: changing `spark.sql.shuffle.partitions` later has no
  effect on that query (DBR 18 LTS+ can repartition stateful queries on demand). Recommended: 1-2 times the cluster's
  cores; compute-optimized workers.

### 23.3 Notifications and alerts

- **Job notifications** on start, success, failure, **duration over a threshold**, **streaming backlog over a
  threshold**, and continuous-job maintenance; to email or admin-configured destinations (Slack, Microsoft Teams,
  PagerDuty, webhooks), up to three per event. **Job-level notifications aren't sent for retried tasks**: use task
  notifications for every failure. "Succeeded with failures" counts as success. Streaming backlog alerts use a 10-minute
  average and repeat every 30 minutes.
- **Databricks SQL alerts** run a query on a schedule and notify when a condition on its result is met (states `OK`,
  `TRIGGERED`, `ERROR`); uses include data quality, cost from system tables, warehouse health and audit events; an alert
  can run as a **job task** so later tasks branch on it.

### 23.4 Troubleshooting a failed job

- Find it in the job's **Runs** tab and **matrix view**, open the task's **run details** (output, error, metadata).
  Typical causes: data quality, misconfiguration, insufficient compute. Fixes: edit the task, change cluster size or
  instance type, ask for higher cloud quotas, or raise **maximum concurrent runs** if runs were skipped.
- **Repair** re-runs only unsuccessful tasks and their dependents, with the **current** settings. "Lakeflow Jobs doesn't
  make tasks idempotent": a task that wrote part of its output before failing can **duplicate data** when repaired.
  Repair needs two or more tasks (a single-task job is re-run with Run now). A repair creates a new job cluster.
- **Continuous jobs** that keep failing enter **exponential backoff**; the job page shows consecutive failures and the
  next retry; **Restart run** resets it.
- Recover a bad load with **time travel / `RESTORE`** (reliability best practices), keeping in mind §2.2's downstream
  effect.

### 23.5 Reading an error

- Every error has an **error condition** (e.g. `TABLE_OR_VIEW_NOT_FOUND`, some with subconditions), a five-character
  **SQLSTATE** (`42P01`), a parameterized message and its parameters. **Message text may change between releases**:
  handle errors by condition or SQLSTATE, never by message text. Python: `PySparkException.getErrorClass()`,
  `getSqlState()`, `getMessageParameters()`; SQL (DBR 16.3+): `DECLARE EXIT HANDLER` and `GET DIAGNOSTICS`.
- The catalogue of conditions relevant to this track is §24.

### 23.6 Query profile and query history

- **Query history** lists queries with status (Queued, Running, Finished, Failed, Cancelled), compute, duration
  breakdown (scheduling, optimization and file pruning, execution), aggregated task time and I/O. The **query profile**
  is the operator graph with time, rows and memory per operator, a Top operators panel, and performance insights; it
  shows "exploding joins or full table scans". Not available for results served from the query cache. Needs ownership
  or `CAN MONITOR` on the warehouse.

### 23.7 Compute that won't start (Azure)

- A first cluster that never responds, with the event log saying "The compute plane network is misconfigured ... Node
  daemon ping timeout", means **routing or firewall** stops nodes reaching the control plane: test from a VM in the
  workspace subnet (`nc -zv` to the web app, the SCC relay, artifact storage, the metastore on 3306, log storage), then
  check for SSL inspection by the firewall. **`METASTORE_DOWN`** events: check for a web application firewall or proxy
  in the path. (Networking rules: §20.)

### 23.8 Libraries and init scripts

- Libraries (Python, JAR, R) can be compute-scoped; on DBR 13.3 LTS+ with Unity Catalog, install from **Unity Catalog
  volumes** on standard-access compute (JARs and Maven coordinates may need the allowlist). Libraries in **DBFS** are
  writable by any workspace user and are discouraged. Check the runtime's preinstalled libraries in its release notes.
- **Init scripts** run on each node before Spark starts; **serverless doesn't support them**. Databricks recommends
  platform features (compute policies for configuration and libraries) instead, cluster-scoped over global scripts,
  never installing libraries through init scripts, pinning OS package versions, and storing scripts in volumes (DBR
  13.3 LTS+ with Unity Catalog). Many init scripts slow runtime upgrades.

### 23.9 Runtime lifecycle

- A Databricks Runtime version gets about **six months** of feature releases, then **LTS** with stability and security
  fixes for **three years** from GA; end of support is **three years after GA**, end of life a best-effort six months
  later. Platform features move through Legacy → Deprecated → End of Support → End of Life.

### 23.10 Environment isolation and catalog strategy

- The workspace is the primary processing environment and catalogs the primary data domain. Separate workspaces for
  business units or for development, staging and production give isolation (separate admins, stricter production
  settings, resource limits), at a cost: no notebook collaboration across workspaces, workspace count limits, setup that
  must be automated, and expensive per-workspace network security. Storage locations can be set at metastore, catalog or
  schema level to keep data physically separate.

### 23.11 Encryption (Azure)

- **Customer-managed keys** (Premium) from Azure Key Vault or Managed HSM, for three things: **managed disks** (temporary
  data on compute), **managed services** (notebooks and results, secrets, SQL queries and history, Git credentials in
  the control plane), and the **DBFS root** storage account. Also on Premium: double (infrastructure) encryption for the
  DBFS root, and encrypting traffic **between worker nodes**, which is **not encrypted by default**.

### 23.12 High availability and disaster recovery

- **HA** is zone redundancy inside a region (the control plane recovers from a zone failure in about 15 minutes);
  **DR** is a secondary workspace in another region with replicated data and configuration. Databricks recommends its
  **managed disaster recovery** (AWS and Azure) for cross-region DR. Active-passive is the common pattern.
- **RPO** (data loss tolerated) and **RTO** (time to restore) are business decisions. "A DR solution does not mitigate
  data corruption": corrupted data replicates; use time travel or backups for that. Replicate managed table data with
  **Deep Clone**, not by relying on geo-redundant storage of the workspace root storage.

### 23.13 Testing

- Unit test functions with pytest (Python), and SQL UDFs for SQL; Databricks recommends keeping Python functions and
  their tests **outside notebooks** (files in a Git folder), with functions that return one predictable result. Files
  that aren't notebooks create a session with `SparkSession.builder.appName(...).getOrCreate()`; a notebook in the same
  folder runs `%pip install pytest`, then `sys.dont_write_bytecode = True` and `pytest.main([".", "-v", "-p",
  "no:cacheprovider"])`, asserting the return code is 0.

## 24. Error catalogue

Sources: https://docs.databricks.com/aws/en/error-messages/error-classes ("Error conditions in Databricks", updated
2026-10-01; read 2026-10-29), the pages in §23, and the sections cited per row. The message column paraphrases the
official message; the condition name and SQLSTATE are exact. "Fix" comes from the message itself or the cited section;
nothing here is guessed.

### 24.1 Names, types and permissions

| Condition (SQLSTATE) | What it says | What to do |
|---|---|---|
| `TABLE_OR_VIEW_NOT_FOUND` (42P01) | the table or view can't be found | check spelling, `current_schema()`, qualify `catalog.schema.table`; `USE CATALOG`/`USE SCHEMA` (§6.3) |
| `SCHEMA_NOT_FOUND` (42704) | the schema can't be found | as above, with the catalog |
| `UNRESOLVED_COLUMN` (42703) | a column, variable or parameter can't be resolved | check the name and the DataFrame's columns |
| `INSUFFICIENT_PERMISSIONS` (42501) | insufficient privileges | grant `USE CATALOG` + `USE SCHEMA` + the object privilege (§6.3) |
| `INSUFFICIENT_PERMISSIONS_EXT_LOC` (42501) | insufficient privileges on an external location | grant the needed privilege on the external location (§6.2) |
| `CAST_INVALID_INPUT` (22018) | a malformed value can't be cast | fix the value or type; `try_cast` returns `NULL` instead |
| `DIVIDE_BY_ZERO` (22012) | division by zero | `try_divide` returns `NULL` instead |

### 24.2 Writes, schemas and MERGE

| Condition (SQLSTATE) | What it says | What to do |
|---|---|---|
| `DELTA_INSERT_COLUMN_ARITY_MISMATCH` (42802) | target has N columns, inserted data has M | align the columns, or evolve the schema deliberately (§3) |
| `DELTA_FAILED_TO_MERGE_FIELDS` (22005) | two fields' definitions can't be merged | a type conflict during schema merge: cast the source or change the table (§3) |
| `DELTA_MERGE_INCOMPATIBLE_DATATYPE` (42K09) | incompatible data types can't be merged | as above |
| `DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE` (21506) | several source rows match one target row | deduplicate the source before `MERGE` (§4) |
| `DELTA_CANNOT_MODIFY_APPEND_ONLY` (42809) | the table only allows appends | it's set append-only on purpose; change the property only if updates are really allowed |

### 24.3 Concurrent writes

| Condition (SQLSTATE) | What it says | What to do |
|---|---|---|
| `DELTA_CONCURRENT_APPEND` (2D521) | a concurrent operation added data this transaction conflicts with | optimistic concurrency at work (§2.7): retry; reduce overlap (row-level concurrency with deletion vectors, liquid clustering for concurrent writers: §2.5) |
| `DELTA_CONCURRENT_DELETE_READ` (2D521) | a concurrent operation deleted data this transaction read | retry the operation |
| `DELTA_CONCURRENT_WRITE` (2D521) | ConcurrentWriteException: new data written since this transaction read | "try the operation again" |
| `DELTA_CONCURRENT_TRANSACTION` (2D521) | **several streams use the same checkpoint** to write this table | one checkpoint per query (§8); stop the duplicate |
| `DELTA_METADATA_CHANGED` (2D521) | metadata changed by a concurrent update | retry; schedule schema and property changes away from writes |
| `DELTA_PROTOCOL_CHANGED` (2D521) | protocol changed by a concurrent update | retry; protocol upgrades (§2.7) conflict with concurrent writes |

### 24.4 Streaming

| Condition (SQLSTATE) | What it says | What to do |
|---|---|---|
| `UNKNOWN_FIELD_EXCEPTION` (KD003) | new fields found while parsing; may be fixed by an automatic retry | Auto Loader `addNewColumns`: let the job restart (§7.3, §23.1) |
| `CLOUD_FILE_SOURCE_FILE_NOT_FOUND` (42K03) | a notified file no longer exists | don't delete files before they are processed |
| `DELTA_SCHEMA_CHANGED` (KD007) | the source table's schema changed under the stream | restart; if it repeats, the change is incompatible: new checkpoint |
| `DELTA_STREAMING_INCOMPATIBLE_SCHEMA_CHANGE` (42KD4) | rename, drop or type change on a streamed table | read-incompatible change: see the doc it links, or a schema tracking location |
| `DELTA_SOURCE_TABLE_IGNORE_CHANGES` (0A000) | an update/delete in a table read as a stream | `skipChangeCommits` to skip them, or a fresh checkpoint / full refresh to reflect them |
| Out-of-memory on restart (§23.1) | the replanned micro-batch is too large | scale up the compute to get past it |

### 24.5 Files, history and retention

| Condition (SQLSTATE) | What it says | What to do |
|---|---|---|
| `DELTA_FILE_NOT_FOUND_DETAILED` (42K03) | a file in the log is missing: deleted by hand, or `VACUUM` with too short a retention | never delete table files directly; restart with a new checkpoint (§2.3) |
| `DELTA_VACUUM_RETENTION_PERIOD_TOO_SHORT` (22003) | retention below the safety threshold | keep at least 7 days (§2.3) |
| `DELTA_CANNOT_VACUUM_LITE` (55000) | LITE can't find all files from the log | run `VACUUM FULL` (§2.3) |
| `DELTA_TIMESTAMP_EARLIER_THAN_COMMIT_RETENTION` (42816) | timestamp older than the earliest version kept | history is gone past retention (§2.2) |
| `DELTA_CANNOT_RESTORE_TABLE_VERSION` (22003) | version not in the available range | choose a version in range (§2.2) |
| `DELTA_UNSUPPORTED_FEATURES_FOR_READ` (56038) | the table needs reader features this runtime lacks | use a newer runtime/client (§2.7) |
| `FAILED_READ_FILE` (KD001) | error reading a file | see the condition's details; often a corrupt or unexpected file |

### 24.6 Platform and access (not error conditions)

- "The compute plane network is misconfigured ... Node daemon ping timeout" and `METASTORE_DOWN` events: §23.7.
- `403 Forbidden` from serverless to a firewalled storage account: §20.5.
- `429 Too Many Requests` above 2,000 concurrent task runs: §11.
- Runs **skipped** at maximum concurrent runs: §11, §23.4.
