# Azure Data Factory — documentation walkthrough notes

**Source:** https://learn.microsoft.com/en-us/azure/data-factory/ (read 2026-09-25) · **Purpose:** ground the Lakehouse
Lab's concepts and scenarios in the official docs · **Status:** complete for concepts, tutorials, scenarios, templates, security, cost, monitoring, CI/CD, Fabric and the four white papers; see the coverage log at the bottom for what was skipped and why.

**Accuracy audit, 2026-10-04:** an outside review (`PrepBench_ADF_Accuracy_Audit_Report.pdf`) was checked claim by claim against the
Learn pages, and ten statements here and in the ADF pack were corrected or qualified. The corrections are marked "(Corrected
2026-10-04)" where they sit, and §30 lists every page checked, with its URL, what was verified, and what is still unsettled.
Where two Microsoft pages disagree, §30.3 says so.

**Second accuracy pass, 2026-10-04:** the material §30.5 listed as not re-verified (fault tolerance, consistency verification,
type conversion, migration examples, reconciliation functions, data-flow performance, Purview, white-paper-derived claims,
Fabric migration paths) was checked against 29 more Learn pages. §31 records the result, including **one correction to the
first pass** (the "5 to 7 minutes" debug figure, which Microsoft's tutorials do still state) and the finding that scenarios
5 to 18 exist only as title-and-outcome stubs anywhere in the repository.

Written in my own words, with the docs' examples kept where they help. Where the docs give a number (a default, a
limit), it's quoted as the docs state it.

---

## 0. The map of the documentation

The table of contents has ~400 pages in these areas: Overview · Migrate to Fabric · Quickstarts · Tutorials · Samples ·
Concepts · How-to guides (Author, Connectors, Move data, Transform data, Control flow, Data flow transformations,
Parameterize, Monitor, Integration runtimes, SSIS, Triggers, Governance, Scenarios) · Templates · Pricing ·
Troubleshooting · SAP Knowledge Center · Security · Reference · Resources (incl. Whitepapers, FAQ).

**A fact that matters for interviews in 2026:** nearly every page now opens with a tip that *Data Factory in Microsoft
Fabric* is "the next generation of Azure Data Factory", recommended for anyone new, with an upgrade path for existing
ADF. An interviewer may ask about ADF vs Fabric Data Factory.

---

## 1. What ADF is (Introduction)

- A **managed cloud service for data integration**: it moves data between systems and orchestrates transformations,
  for hybrid ETL / ELT. It is an **orchestrator**: it mostly tells other things what to do and when.
- **The docs' own example:** a gaming company has petabytes of game logs in the cloud and reference data (customers,
  games, campaigns) **on-premises**. It wants to combine them, process them on Spark in the cloud, publish the result
  to a data warehouse for reports, run it **daily**, and also run it **when new files land**. ADF is the thing that
  wires that together and runs it.
- **Four stages** the docs describe: **Connect and collect** (Copy activity brings data to a central store, e.g. the
  lake) → **Transform and enrich** (mapping data flows on managed Spark, or hand-written code on Databricks/HDInsight)
  → **CI/CD and publish** (Azure DevOps / GitHub; load results where BI tools read them) → **Monitor** (success and
  failure of scheduled runs).
- **Top-level building blocks:** pipelines, activities, datasets, linked services, data flows, integration runtimes;
  plus triggers, pipeline runs, parameters, control flow, variables.

## 2. The building blocks and how they fit

| Block | Plain meaning | Analogy |
|---|---|---|
| **Pipeline** | A named group of steps that together do one job; you deploy and schedule the pipeline, not the steps | A recipe |
| **Activity** | One step: copy data, run a transformation, or control the flow (loop, branch, wait) | One instruction in the recipe |
| **Linked service** | How to connect to something: "much like connection strings" (the docs' words) | The address and key of a supplier |
| **Dataset** | Which data, inside that connection: a table, a folder, a file, and its format | The specific shelf and box at that supplier |
| **Integration runtime (IR)** | The compute that actually does the moving, or sends work to other compute; the "bridge" between activities and linked services | The truck and driver |
| **Trigger** | When a pipeline run starts | The alarm clock, or a doorbell |
| **Pipeline run** | One execution of a pipeline, with its own run ID | One time the recipe was cooked |
| **Parameters** | Read-only values passed in when a run starts | The order ticket ("which table, which date") |
| **Variables** | Temporary values inside a run | A scratch pad |
| **Control flow** | Chaining, branching, looping (For Each), passing values | The recipe's "if… then…, repeat for each…" |
| **Mapping data flow** | Visual transformation logic that ADF runs on Spark it manages for you | A kitchen appliance you program by drawing |

**The docs' worked example of how they connect:** to copy from Blob storage to SQL Database you make **two linked
services** (Storage, SQL DB), **two datasets** (the blob folder + format; the SQL table), and **one Copy activity** in
**a pipeline** that reads the first dataset and writes the second. The IR does the work.

## 3. Pipelines and activities

- **Three activity groups:**
  - **Data movement:** the Copy activity. Any supported source to any supported sink; ~100 connectors (Azure stores,
    databases incl. Oracle, SQL Server, Teradata, Netezza, Hive, HDFS; files; SaaS apps like Salesforce, SAP, Dynamics).
  - **Data transformation:** Data Flow (ADF-managed Spark), Databricks Notebook / Jar / Python, HDInsight Hive / Pig /
    Spark / MapReduce, Stored Procedure, Azure Function, Custom (Azure Batch), Synapse Notebook.
  - **Control flow:** Execute Pipeline, For Each, If Condition, Switch, Until, Wait, Lookup, Get Metadata, Set /
    Append Variable, Filter, Validation, Web, Webhook, Fail.
- **Dependencies between activities:** Succeeded, Failed, Completed (either), Skipped (an earlier step failed so this
  never ran). This is how you build "on failure, send an alert" or "clean up whatever happens".
- **Activity policy:** `timeout` (default **12 hours**, minimum 10 minutes), `retry` (default **0**),
  `retryIntervalInSeconds` (default **30**), `secureOutput` (don't log outputs, e.g. secrets).
  → **PO point:** the default is *no retry*; a transient network blip fails the run unless someone set retries.
- **Limits:** default soft limit of **120 activities per pipeline**. Pipeline `concurrency`: no maximum by default;
  above the limit, runs queue.
- Activities without dependencies **run in parallel**.

## 4. Triggers and runs

- **Run:** one execution, one **run ID**. Started manually (on demand, from UI, SDK, PowerShell, REST) or by a trigger.
- **Trigger types:**
  - **Schedule:** wall-clock ("every day at 05:15", "Mon/Wed/Fri 17:00", "last day of the month").
    *Fire and forget*: marked successful as soon as a run **starts**. No backfill, no retry, many-to-many with pipelines.
  - **Tumbling window:** fixed, non-overlapping, back-to-back time windows (e.g. every hour: 01:00–02:00,
    02:00–03:00…). **Keeps state**, can **backfill** past windows, supports **retry** and **concurrency (1–50)**, waits
    for the run to finish and reflects its result, exposes **WindowStart / WindowEnd** to the pipeline. One trigger →
    one pipeline. The docs call it "100% reliability… without gaps".
  - **Event-based:** **storage event** (a file arrives or is deleted in Blob / ADLS) or **custom event** (Event Grid).
    Gotcha from the docs: stopping and restarting an event trigger can resume its old pattern and fire unwanted runs;
    delete and recreate it instead.
- **Time zones:** for daily-or-longer schedules in a zone with daylight saving, run times shift automatically; hourly
  and minute schedules don't. Use UTC to avoid the shift.
- **PO point:** "why did yesterday's hourly load leave a gap?" is often a schedule trigger that doesn't backfill,
  where a tumbling window would have.

## 5. Linked services and datasets

- A **linked service** is connection information. Two uses: a **data store** (SQL Server, Oracle, a file share, Blob)
  or a **compute** resource (HDInsight, Databricks, Batch). Its `connectVia` names the **IR** that reaches it; if none,
  the default Azure IR.
- A **dataset** is a named view of data inside a linked service: a table, file, folder or document, with its format
  (e.g. DelimitedText with delimiter and quote char) and, optionally, its schema. You can import the schema from the
  source. If data has no fixed schema, data flows can use **schema drift**.
- Creating a linked service needs **permission on the target system**; without it, you can't browse its resources.

## 6. Integration runtime (IR)

- **What it does:** runs **data flows**, performs **data movement**, **dispatches** transformation work to other
  compute (Databricks etc.), and runs **SSIS packages**.
- **Three types** (the docs' own count: "Azure, Self-hosted, Azure-SSIS"):
  - **Azure IR:** fully managed, serverless, pay per use. Cloud-to-cloud copies, data flows, dispatch over **public
    endpoints**. **A managed virtual network is a setting of the Azure IR, not a fourth type** (Corrected 2026-10-04):
    when you create an Azure IR inside a Data Factory managed virtual network, it connects to supported stores through
    managed private endpoints. An existing global (standard) Azure IR can't be switched to a managed-virtual-network
    one, or back. A managed-virtual-network IR always uses the factory's region and can't auto-resolve (§30.2).
  - **Self-hosted IR (SHIR):** software **you install** on a Windows machine inside your network (on-prem or a private
    VNet), behind the firewall. It only makes **outbound** HTTP connections. The usual answer when a source isn't
    reachable from the public cloud (the typical on-prem database, **on-prem Hadoop**), and the only option for
    connectors needing your own driver (e.g. SAP HANA, MySQL). Needs Java (JRE) on the host. Scale out / high
    availability with several machines ("active-active"). → **In the Hadoop-to-Azure story, the SHIR is how data leaves
    the data centre.** It needs a network path from its host machine to the source; it does not create one (§16).
  - **Azure-SSIS IR:** a managed cluster to run existing SSIS packages ("lift and shift"). Reaches on-prem data by
    joining a virtual network that is connected to the on-prem network.
- **Location:** the factory's region stores its metadata; the IR's region is where the work happens.
  The default Azure IR **auto-resolves** (for copies, tries the sink's region). **Data residency:** to guarantee data
  never leaves a geography, create an Azure IR in that region and point linked services at it.
- **Which IR wins:** if either side of a copy uses a self-hosted IR, the copy runs on the self-hosted IR. Between two
  private-network stores, both must use the same SHIR.
- **CI/CD:** IRs must have the same name and type in every environment (dev/test/prod); a shared factory can hold
  shared IRs.

## 7. Parameters and variables

- **Parameters:** defined on the pipeline, **can't change during a run**. Types: String, Int, Float, Bool, Array,
  Object, SecureString. Read with `@pipeline().parameters.<name>`. Given by the trigger, by a caller pipeline, or by
  hand before a run. **Why they matter:** one pipeline can serve many tables or files ("copy table X for date Y")
  instead of one copy of the pipeline each.
- **Variables:** can change during a run (Set Variable / Append Variable). Types: String, Bool, Array. Read with
  `@variables('<name>')`. **Gotcha:** variables are pipeline-scoped and **not thread-safe**: changing one inside a
  parallel For Each loop gives unpredictable results.

## 8. Choosing an integration runtime (decision guide)

| | Azure IR | Azure IR + managed VNet | Self-hosted IR |
|---|---|---|---|
| Who runs the machines | Microsoft | Microsoft | **You** |
| Autoscale | Yes | Yes (not with TTL) | No: bigger machine or more nodes |
| Data flows | Yes | Yes | **No** |
| On-prem / private-network access | No: public endpoints only (allowlist its published IPs if a store has a firewall) | Yes, but on-prem must be connected via ExpressRoute or a site-to-site VPN, plus a Private Link service and a load balancer; no custom drivers | **Yes**, if its host machine can reach the source. Needs no extra settings, ExpressRoute or VPN (Corrected 2026-10-04: see the reading below) |
| Private endpoints | No | Yes (managed by ADF) | Yes |
| Custom drivers | No | No | **Yes** |

- **How to read the "no VPN" cell** (Corrected 2026-10-04). The docs say the SHIR "is more flexible and doesn't require
  extra settings, Express Route, or VPN", and "Express Route isn't mandatory. Without Express Route, the data won't reach
  the sink through private networks such as a virtual network or a private link, but through the public network."
  So: no VPN is needed *for ADF to reach the SHIR* (it calls out), but the SHIR host still needs a network path to the
  source, and the SHIR-to-Azure leg is public HTTPS unless ExpressRoute/VPN plus Private Link are added. The create-SHIR
  page adds: treat a source as "on-premises behind a firewall, even when you use Azure ExpressRoute", and use a SHIR
  even for a database on an Azure IaaS VM. Hosting the SHIR in Azure changes the design: its VM then needs the
  connectivity (VNet, peering, ExpressRoute/VPN) to the source.
- **Public-address route:** a standard Azure IR can reach a private system that is published on a public address if its
  published IP ranges are allowlisted on that system's firewall; the docs call this "not a desirable solution in highly
  secure production environments". The IP ranges aren't used by data flows or by an Azure IR with a managed virtual
  network (data-access-strategies).
- **Six questions the docs ask:** where are the IR and the data; is the store publicly reachable; how sensitive is
  the data in transit; who will maintain machines; how much concurrency; which features are needed.
- **SHIR in practice:** one per environment (dev, QA, prod) for isolation; can be **shared** across factories in the
  same environment; credentials best kept in **Azure Key Vault**; you patch and update it (auto-update available); a
  diagnostic tool and Log Analytics monitoring exist for it. "Whitelisting Azure IR public IPs on your firewall" works
  but is "not a desirable solution in highly secure production environments".
- **Data Integration Unit (DIU):** the unit of copy power on an Azure IR; more DIUs, faster copy (limits per region).

## 9. Tumbling windows and event triggers in depth

- **Tumbling window:** frequency Minute / Hour / Month; **minimum window 5 minutes**; `startTime` may be in the past;
  `delay` waits after the window closes (e.g. for late data); `maxConcurrency` 1–50 is required; `retryPolicy`
  (default **0** retries, minimum 30 s apart); **dependencies** on other tumbling windows, including on its own
  previous window (**self-dependency**: "don't process 03:00 until 02:00 succeeded").
- **Backfill:** with a past start time it creates one run per missed window, runs them **oldest first**, in parallel up
  to `maxConcurrency`, **before** any current window. The docs advise doing a separate **initial historical load** when
  the gap is long.
- **Can't change** frequency or interval once published. Windows can be cancelled and **rerun** (a rerun uses the
  latest published definition).
- **Storage event trigger:** fires on **Blob created** / **Blob deleted** in ADLS Gen2 or GPv2 storage, through
  **Azure Event Grid** (push, not pull). Filters: path **begins with** / **ends with** only (no other wildcards).
  `ignoreEmptyBlobs` defaults to true. The pipeline receives `@triggerBody().folderPath` and `fileName`. Limit: **500
  storage event triggers per storage account**. Needs the right RBAC on the storage account and the Event Grid
  provider registered. **Gotchas from the docs:** too-broad filters can match huge numbers of files and cost; don't use
  a file-arrival trigger on the output of a data flow, which renames and shuffles files mid-write and can fire before the
  data is complete.

## 10. Monitoring, reruns and failure handling

- **Monitor view:** pipeline runs (status Failed / Succeeded / In Progress / Canceled / Queued, trigger, duration,
  parameters, error, run ID), then drill into **activity runs** (input/output JSON, the IR used, error code and
  message). Times show in the browser's time zone. **No auto-refresh.** Up to five activity properties can be
  "promoted" as user properties to show as columns (e.g. source table name). A **Gantt** view shows runs over time.
- **Rerun options:** rerun the whole pipeline; **rerun from a chosen activity**; **rerun from the failed activity**;
  rerun with **new parameters** (counts as a new run). The rerun history is kept per run.
- **Consumption report** per run (feed it to the pricing calculator for an estimate).
- **Alerts** on metrics (failed pipeline/activity/trigger runs, IR CPU/memory/queue…), sent by email, SMS, push or
  voice through an action group.
- **Four paths out of every activity:** Upon Success, Upon Failure, Upon Completion, Upon Skip.
- **How a pipeline's final status is decided:** look at the **leaf** activities (a skipped leaf → look at its
  parent); the pipeline **succeeds only if all evaluated leaves succeed**.
- **Consequence the PO must know:**

  | Pattern | Main step fails → pipeline shows |
  |---|---|
  | Try-Catch (only an Upon Failure step) | **Succeeded** |
  | Do-If-Else (Upon Success + Upon Failure) | Failed |
  | Do-If-Skip-Else (plus a dummy Upon Skip) | **Succeeded** |

  So a dashboard of green runs doesn't prove the data arrived. "Success" can mean "the error handler succeeded".
- **Patterns:** error handling on the Upon Failure path for mission-critical steps; "best effort" steps (e.g. logging)
  on Upon Completion so they don't block; **Try-Catch-Proceed** (e.g. delete a half-copied file, carry on);
  **generic error handling** at the end of a sequence (connect Upon Failure *and* Upon Skip to it).

## 11. The Copy activity

- **What happens:** read from the source → serialize / deserialize, compress / decompress, map columns → write to the
  sink. Runs on an IR; with a self-hosted IR on either side, **both** source and sink must be reachable from the SHIR
  machine, and only **one** SHIR per copy.
- **Formats:** Avro, Binary, Delimited text (CSV), Excel, Iceberg (ADLS Gen2 only), JSON, ORC, **Parquet**, XML.
  Files can be copied as-is (fast, no parsing) or converted (e.g. SQL Server table → Parquet in ADLS; zipped files
  decompressed on the fly).
- **Knobs:** `dataIntegrationUnits` (power on Azure IR), `parallelCopies`, **staged copy** (via Blob), column mapping
  (`translator`), preserve metadata / ACLs, fault tolerance, data consistency verification, **session log**.
- **Extra columns on the way in:** e.g. `$$FILEPATH` (which source file a row came from), pipeline name / run ID, a
  static value. → **Lineage for free:** stamping every row with its source file and run ID makes later investigations
  far easier. Good acceptance criterion.
- **Auto-create sink table** for SQL sinks (convenient to start; review the schema after).
- **Resume from last failed run:** **only** for binary (as-is) file copies between file stores with the folder
  hierarchy preserved (e.g. S3 → ADLS Gen2, HDFS → ADLS). Works through activity retry or "rerun from failed
  activity"; resume is **per file**; don't change settings between reruns. **Every other copy restarts from the
  beginning.**

## 12. Fault tolerance, consistency checks and type mapping

- **Default: the copy fails on the first bad row.** You can instead **skip incompatible rows** and log them:
  - type mismatch (e.g. "abc" into an INT column),
  - column-count mismatch,
  - **primary-key violation when writing to SQL Server, Azure SQL Database or Cosmos DB** (duplicates when the source
    has no key but the sink does: only the first is kept). (Scope added 2026-10-04.)
  Output reports `rowsCopied` and **`rowsSkipped`**; the **session log** (CSV in Blob/ADLS Gen2) lists each skipped row
  and why. For files: skip files deleted mid-copy (**on by default**), forbidden by permissions, inconsistent, or with
  invalid names (the last only for binary copies to ADLS Gen2, or from S3).
  - **Skipping and logging are separate settings** (`enableSkipIncompatibleRow` vs `logSettings.enableCopyActivityLog`,
    the latter off by default, log level default Warning; "Info" logs every copied file too). (Added 2026-10-04.)
  - **Doesn't apply** (page notes): Synapse PolyBase loads (use PolyBase's own reject policy, though incompatible rows
    can still be redirected), Amazon Redshift UNLOAD, a stored procedure in a SQL sink, and Upsert into a SQL sink.
    (Added 2026-10-04; this matters for the course's "upsert to be idempotent" advice.)
  - The log's `OperationItem` column holds the skipped row's values (the example shows `"data1", "data2", "data3"`), so
    the §27 point about sensitive values stands, but only when the session log is on. The older "redirect incompatible
    rows" model writes the original row plus an ErrorCode and ErrorMessage column.
  → **PO decision:** "fail the load" or "load what's good and quarantine the rest"? If you skip, **someone must own
  reading the skipped-rows log**, or rows quietly go missing while every run is green.
- **Data consistency verification** (`validateDataConsistency`, off by default, slows the copy):
  - binary files: file size, last-modified date and a **checksum** (Corrected 2026-10-04: for Blob and ADLS Gen2 it is a
    *block-level* checksum, plus a *file-level* ContentMD5 comparison only "if ContentMD5 on files exist" on the source;
    the page also says the service writes ContentMD5 to Blob/ADLS Gen2 destinations. Size is checked between any storage
    stores);
  - tables: only the **row count** after the job (rows read = rows copied + rows skipped; the copy fails if not).
  The page describes a row-count check; it doesn't say "never compares values", the course infers that from what is
  listed. Result shows as Verified / NotVerified (not enabled) / Unsupported (this copy pair can't be verified).
  Not supported for staged copy or some connectors (FTP, SFTP, HTTP, Snowflake, Office 365, Databricks Delta Lake); for
  binary files only with `PreserveHierarchy`. ms.date 2025-10-29.
  → **Key point:** "consistency verified" for a table means **the counts add up**, not that the values are right.
  Value-level reconciliation is a separate job the team has to build.
- **Schema mapping:** by default by **column name, case-sensitive**; headerless CSVs need explicit mapping by
  position. Explicit mapping can rename, select and flatten JSON arrays into rows.
- **Type conversion:** source type → interim type → sink type. The "new type conversion experience" (`typeConversion`)
  is **on by default for copy activities created in the authoring UI since late June 2020**, but **defaults to false**
  programmatically, for backward compatibility. Its `typeConversionSettings` include **`allowDataTruncation` (default
  true)**, date/time formats and culture. (Scope corrected 2026-09-26 after an external review.) Re-checked
  2026-10-04 (page ms.date 2026-08-06): it still says "For new copy activities created through Data Factory authoring UI
  since late June 2020, this data type conversion is enabled by default", "you won't see type conversion options" on
  activities created before the feature, and `typeConversion` "default value is false due to backward compatibility";
  `allowDataTruncation` default true. The date is kept in the course only to explain old-vs-new behaviour.
  → **Silent precision loss is on by default**: decimal → integer or DateTimeOffset → DateTime truncates unless
  someone turns it off. Time zones and number formats depend on format/culture settings.

## 13. Incremental (delta) loading

- **Why:** after an **initial full load**, copy only what's new or changed.
- **Five approaches in the docs:**

  | Approach | How | Sees deletes? | Notes |
  |---|---|---|---|
  | **Watermark** | A column that only goes up (last-modified time or increasing ID); copy rows between the old and new watermark | **No** | Needs a trustworthy last-modified column in the source |
  | **Change Tracking** (SQL Server / Azure SQL) | The database records which rows were inserted, updated or deleted | Yes | Lightweight; enabled on the source database |
  | **Change Data Capture (CDC)** (e.g. SQL MI) | The database logs every change | Yes | See CDC section |
  | **LastModifiedDate (files)** | Scan all files, copy those changed since last time | n/a | Scanning many files is slow even if few are copied |
  | **Time-partitioned names** (`/yyyy/mm/dd/`) | Copy only the folder for the period | n/a | "The most performant approach" for new files |

- **The watermark pattern, as the tutorial builds it:**
  1. A **watermark table** stores, per source table, the last value loaded (starts at an old date).
  2. **Lookup 1:** read the old watermark. **Lookup 2:** read `MAX(LastModifytime)` from the source = new watermark.
  3. **Copy:** `WHERE LastModifytime > old AND LastModifytime <= new`, written to a new file named with the **run ID**.
  4. **Stored procedure** `usp_write_watermark` sets the watermark to the new value, connected on the Copy's
     **Success** path, so it only moves if the copy succeeded. (Re-checked 2026-10-04: tutorial step 30 says "Connect
     the green (Success) output of the Copy activity to the Stored Procedure activity". The **template** page lists the
     same four activities but does not say which exit the last one uses, so "the template connects it to success" is
     not supported by the text; the course now cites the tutorial only.)
  - **The three-pattern chooser** ("timestamp column: tumbling window; ever-increasing column: high-watermark; small
    table: full copy") comes from the 2020 SAP white paper (§18.2), not from a current Learn page. The current
    incremental-copy overview lists watermark, Change Tracking, LastModifiedDate and time-partitioned names, and the
    delta-copy template page says that with a timestamp column and no control table the Copy Data tool builds a
    pipeline "that uses a trigger-scheduled time as a variable to read new rows". Classification: still-current
    concept, labelled as a white-paper heuristic in the course.
  Run 1 copies all 5 rows; after inserting 2 rows, run 2 copies exactly those 2.
- **What can go wrong, and what the design protects against:**
  - Copy fails → watermark not moved → the next run re-copies the same window: nothing lost, **but** a partially
    written file from the failed run may remain beside the new one → possible **duplicates downstream** unless the
    load is idempotent (overwrite by window, or MERGE on the key).
  - **If someone wires the watermark update before the copy, or on Completion instead of Success**, a failed copy
    still moves the watermark → **those rows are never copied**. Silent loss.
  - **Deletes** in the source are invisible to a watermark.
  - A last-modified column the application doesn't always update → changed rows missed.
  - A **Fabric "Copy job"** is now promoted as the simpler way to move data without building a pipeline.

## 14. Migration guidance (data lake and data warehouse)

**Overview ("why ADF for migration")**
- Suited to big-data migration from **Amazon S3 or on-prem HDFS**, and data-warehouse migration from **Oracle
  Exadata, Netezza, Teradata, Amazon Redshift**. Petabytes for data lakes, tens of terabytes for warehouses.
- Serverless scale, pay-as-you-go, no limit on volume or file count; does both the **one-time historical load** and
  **scheduled incremental loads**, so old and new stores can be **kept in sync during the whole migration window** while
  the ETL is rebuilt on the new side.
- **Online (ADF over the network) vs offline (ship devices, e.g. Data Box):** decided by **data size**, **network
  bandwidth** and the **migration window**. The docs' rule of thumb: if the online transfer won't fit the window
  (their example uses two weeks), go offline.

**On-prem Hadoop (HDFS) → Blob / ADLS Gen2**, the page closest to the Lakehouse Lab story
- **Two modes:**
  - **DistCp mode (recommended):** ADF builds a DistCp command, submits it **to your existing Hadoop cluster**, and
    monitors it. Best throughput (uses the cluster's power). The SHIR here only sends commands and monitors, so its
    size doesn't matter.
  - **Native IR mode:** ADF's own integration runtime copies the data. Use when DistCp can't work (it doesn't support
    **ExpressRoute private peering** with a storage VNet endpoint) or when you **don't want to load the Hadoop cluster**
    and slow the ETL jobs still running on it.
- **Network:** HTTPS over the internet by default (encrypted in transit), or a **private link over ExpressRoute** so
  data never crosses the public internet. For the private route, install the SHIR on **Azure VMs in your VNet**:
  start with **Standard_D32s_v3 (32 vCPU, 128 GB)**, scale out to **up to 4 nodes**, **start with 2 nodes** to avoid a
  single point of failure.
- **Authentication to HDFS:** Windows (**Kerberos**) or Anonymous. To Azure storage: **managed identity** strongly
  recommended; otherwise keep credentials in **Key Vault**.
- **Initial snapshot:** above **10 TB**, **partition by HDFS folder** and give each copy one partition; run several
  copies concurrently; a failed partition is **rerun alone** without affecting the others. (Re-checked 2026-10-04: the
  page gives this advice for **native IR mode**; in DistCp mode one copy submits the DistCp command and "the capacity
  of the machine doesn't affect the throughput". Page ms.date 2024-05-15.)
- **Delta migration:** best via **time-partitioned folder names** (`/yyyy/mm/dd/`); otherwise **LastModifiedDate**
  (scans every file, which can be slow; scan in parallel using the same partitions). DistCp's `-update` for delta in
  DistCp mode.
- **Resilience:** built-in retries; binary copies **checkpoint** and resume from the failure point on retry (retry
  count must be set).
- **Worked example:** **1 PB** in **1,000 partitions**; each copy on a 4-node SHIR at **500 MBps**; For Each
  concurrency **4** → **2 GBps**; **146 hours** in total. The page labels it "a hypothetical pricing example"; VM
  cost excluded. (The course now says it "would take" 146 hours; it used to say "took".) The same page recommends
  Standard_D32s_v3 (32 vCPU, 128 GB) SHIR VMs and starting with **2** nodes for HA; the Netezza page says **4**.
  The S3 page's example says "2 PB is divided into 1 KB partitions", an evident typo on Microsoft's page.

**On-prem Netezza → Azure Synapse** (warehouse pattern)
- SHIR on a Windows machine that can reach Netezza (start **32 vCPU / 128 GB**, up to 4 nodes; the docs suggest **4
  nodes** for HA here).
- **Tables under 100 GB** (or movable in under 2 hours): one copy per table, several tables in parallel, with
  `parallelCopies` by data slice or dynamic range. **Tables of 100 GB or more:** split with custom queries into
  partitions, each loadable **within two hours**; a failed partition reruns alone.
- **Delta:** a watermark column per table, tracked in an **external control table** (one row per source table: its
  watermark column and last value).
- **Do a performance proof of concept** on a representative sample to size partitions; increase parallelism until
  the network or the stores' limits; on throttling errors, reduce concurrency or raise limits.
- **Worked example:** **50 TB**, **500 partitions**, 20 MBps per copy, concurrency 3 → **60 MBps**, **243 hours**.

**Amazon S3 → Azure Storage** (large file migration)
- Customers have moved **petabytes / hundreds of millions of files** at **2 GBps+** sustained. Up to **256 DIUs** per
  copy on the Azure IR. Partition above **100 TB** by S3 prefix. Same delta options. Tune: start with one partition and
  default DIUs, raise DIUs to the limit, then raise concurrency.
- **Worked example:** **2 PB**, 1 GBps per copy at 256 DIU, concurrency 2 → 2 GBps, **292 hours**.

**Lessons that generalise (for the Lab):**
1. **Partition big migrations** so one failure reruns one slice, not everything.
2. **Keep a control table** of what's been moved (per table or partition: watermark, status).
3. **Prove throughput with a POC** before promising dates.
4. The migration window is **snapshot + deltas until cutover**, with both systems in sync.
5. The self-hosted IR is **production infrastructure**: size it, make it highly available, monitor it.

## 15. Change data capture (CDC)

- **Four ways to get only changed data:**
  1. **CDC factory resource** (**public preview**): a guided, top-level resource, no pipeline needed; the only ADF way
     to run **continuously** (pipelines are batch only). You set a latency; billed as **4 vCores** of data flow while
     processing. Sources include Azure SQL, SQL Server, SQL MI, Cosmos DB, Snowflake and files; targets include **Delta**,
     Parquet, Azure SQL, Synapse. **Doesn't support the self-hosted IR** (so no on-prem sources this way).
  2. **Native CDC in mapping data flows:** reads **inserts, updates and deletes** using the database's own CDC; no
     timestamp column needed; applies them to the target. Connectors: SAP CDC, Azure SQL, SQL Server, SQL MI, Cosmos DB,
     Snowflake. **Recommended first**: least load on the source.
  3. **Auto incremental extraction** in data flows: you name an incremental column (databases) or it uses file
     last-modified time; ADF builds the delta query and manages the checkpoint.
  4. **Customer-managed:** the watermark / control-table pattern (§13), works for any source.
- **Checkpoints** (Corrected 2026-10-04: three Microsoft statements, not one rule). ADF remembers where the last run
  stopped. What it is keyed to is described three ways:
  1. *Change data capture concepts page* (ms.date 2025-02-13): "By default, the checkpoint is coupled with your pipeline
     and activity name. If you change your pipeline name or activity name, the checkpoint will be reset, which leads you
     to start from beginning or get changes from now in the next run." Use your own checkpoint key to keep it.
  2. *Data Flow activity page, step 3* (the newer behaviour): "Data flow activities use a guid value as checkpoint key
     instead of 'pipeline name + activity name' so that it can always keep tracking customer's change data capture state
     even there's any renaming actions. All existing data flow activity uses the old pattern key for backward
     compatibility." The key can be overwritten.
  3. *Data Flow activity page, "Checkpoint key" section*: "The default checkpoint key is a hash of the data flow name and
     the pipeline name", which you may override, for example for a dynamic source pattern.
  These don't agree (activity name vs data flow name; GUID vs hash). **What is safe to teach:** the checkpoint can be
  lost when whatever it is keyed to changes; newer activities may be rename-safe, older ones keep the old pattern; and
  an explicit checkpoint key is documented on both pages. Course position: set your own key and rehearse a rename in a
  non-production factory. Also documented: refreshing the browser during a debug run resets it, and the first trigger of
  a published pipeline restarts from the beginning or from "now"; reruns from monitoring resume from the previous
  checkpoint.
  → **Scenario seed:** "someone renamed a pipeline during a tidy-up and the next load re-read everything" (true for
  an activity on the old key pattern; unverified for one created with a GUID key).
- **CDC resource status (re-checked 2026-10-04):** the page still says "currently in public preview"; known limitations
  include no self-hosted IR support, each source/target usable once in mappings, no complex types.

## 16. Self-hosted integration runtime in practice

- **How it works, in four steps (the docs' own flow):**
  1. You create the SHIR in the factory and point an on-prem linked service at it.
  2. The SHIR node **encrypts credentials locally** (Windows DPAPI) and syncs them across nodes; or they live in **Key
     Vault** instead.
  3. The factory talks to the SHIR over a **control channel through Azure Relay**; the SHIR **polls a queue** for jobs.
  4. The SHIR **copies the data directly** between the on-prem store and cloud storage over HTTPS.
- **Only outbound port 443** is needed at the corporate firewall (Service Bus / Relay for authoring, the factory
  endpoint, `download.microsoft.com` for updates, the Key Vault URL). Nothing inbound from the internet.
- **Machine:** Windows (Server 2016–2025 or client), 64-bit, .NET Framework 4.7.2+, **JRE 11** for Parquet / ORC.
  **One SHIR instance per machine.** Install it **near, but not on, the data source** (so it doesn't compete for the
  source's resources). Use a SHIR even over ExpressRoute or for databases on Azure VMs.
- **Network path (Corrected 2026-10-04):** the SHIR makes outbound calls only, which is why ADF needs no VPN to reach
  it, but its host machine must itself reach the source (the database's own port, through internal firewalls) and
  reach Azure outbound on 443, through a proxy if there is one. See §8 for how the docs word "no VPN".
- **Scale and availability:** **up to four nodes** per SHIR ("no longer the single point of failure"; the ADF limits
  page also lists 4 as default and maximum, but the Fabric comparison page says "Up to 8 nodes (4 default)", see
  §30.3, so the course says "check the current limit"); needs "Remote
  access to intranet" (port 8060 between nodes) enabled first; scale up by raising **concurrent jobs per node** when
  CPU/RAM are free but jobs queue or time out. One SHIR can serve **many sources**, and be **shared** with other
  factories in the same Entra tenant.
- **Operational gotchas:** FIPS-mode Windows servers can fail tasks unless credentials are in Key Vault; a proxy with
  NTLM auth ties the service to a domain account, so **password changes break it** until reconfigured; node credential
  versions must stay in sync.
  → **PO point:** the SHIR is a **real server someone owns**: patching, monitoring, capacity, failover. In a
  migration plan it's a workstream, not a checkbox.

## 17. Transforming data: data flows, schema drift, Delta, landing in the lake

- **Mapping data flows:** transformations drawn visually, run on **ADF-managed Spark** (no cluster to manage). A
  canvas of source → transformations → sink; each step has Settings, **Optimize** (partitioning), **Inspect**
  (metadata) and **Data preview** (in debug mode). Run from a pipeline with the **Data Flow activity** on an **Azure IR**
  (not a self-hosted IR). **Debug-cluster warm-up** (Corrected 2026-10-04): an earlier read of the overview recorded
  "5–7 minutes". The current overview and debug-mode pages give no such figure; the debug page says only that a cold
  cluster "performs a cold boot", with a default 60-minute time to live on the auto-resolve IR, billed per hour
  including the TTL. **Correction to this correction (2026-10-04, second pass):** Microsoft's *tutorials* (Delta lake
  ETL with data flows; Best practices for writing to the lake) do still say "Data Flow clusters take 5-7 minutes to warm
  up" in their debug step, while the performance guide says a job cluster start-up "generally takes 3-5 minutes" and the
  IR performance page says "a few minutes". So the figure is documented, just not on the overview or debug page, and
  the pages give different numbers. The course says "several minutes" and cites both. Data types include decimal with precision,
  timestamp, date, arrays, maps.
- **Schema drift** (source columns added, removed or changed between runs):
  - Turn on **Allow schema drift** at the source and sink; drifted columns arrive as **strings** unless **Infer drifted
    column types** is on; handle them with `byName()` / `byPosition()`, column patterns and rule-based mapping.
  - **The trade-off, in the docs' words:** accepting drift means losing "early-binding" of columns and types. The flow
    becomes late-binding, and drifted columns don't show in schema views.
  → **PO decision:** absorb new columns silently (resilient, but surprises downstream) or fail and alert (safe, but
  breaks the load). Same trade-off as Delta Lake's schema enforcement vs evolution.
- **Delta Lake from ADF data flows (tutorial):** sink type **Inline → Delta** on ADLS Gen2. An **Alter Row**
  transformation marks rows for **insert / update / delete / upsert**, and the Delta sink applies them using **key
  columns** (the tutorial uses a composite key to avoid collisions). Example: update 1988 ratings, delete 1950 movies,
  insert new rows. → ADF can write Delta directly; Databricks isn't the only way.
- **Landing data in the lake (best practices tutorial):**
  - **Key partitioning** into folders like `releaseyear=1990/month=8` ("very optimal" for Spark and for processing
    slices; small write cost). Read back with wildcards (`**/**/*.parquet`).
  - **Name folder as column data**: flatter and faster to write, less useful for slicing.
  - **Name file as column data** needs a **single partition**, which is a bottleneck: only for small files.
  - Default output file names are **Spark job IDs**, not meaningful names.

## 18. White papers (Resources → Whitepapers)

The docs list four:

| White paper | What it covers |
|---|---|
| **Azure Data Factory: Data Integration in the Cloud** | Building a modern data warehouse, advanced analytics for SaaS apps, lifting SSIS packages to Azure |
| **SAP data integration using Azure Data Factory** | Target scenarios, the SAP connector options compared, each SAP connector |
| **Azure Data Factory: Passing Parameters** | Passing values between pipelines and activities, and between activities |
| **Azure Data Factory: DevOps** | CI/CD best practices for ADF |

All four were read as the original PDFs. The web tool's automatic summaries of these PDFs were unreliable: they hedged
("appears", "likely") and one added a claim the paper doesn't make (that the DevOps paper says to stop triggers before
deploying; it doesn't). Only what the PDFs actually say is recorded here. All four are 2018–2020, so product names are
dated (SQL DW is now Synapse dedicated SQL pool; HDInsight has mostly given way to Databricks).

### 18.1 Data Integration in the Cloud (2018): the best beginner story

- **Who ADF is for:** big-data teams, and teams with existing SSIS (SQL Server Integration Services) packages.
- **The modern data warehouse walk-through**, which is the clearest "follow the data" story in the whole set:
  1. **Extract** from on-premises Oracle and from Salesforce, through a self-hosted IR (because the on-prem source sits
     behind a firewall).
  2. **Land it in the data lake** in raw form. It's cheap, and you decide later what goes into the warehouse.
  3. **Prepare** it with Spark: remove duplicates, reshape.
  4. **Analyse** it: a machine-learning step adds a column (a churn prediction, in the example).
  5. **Load** the warehouse, then build a semantic model, then Power BI or Tableau.
- **SaaS scenario:** results go to Cosmos DB for an application to read. The customers named are Adobe Marketing Cloud
  and Lumdex.
- **A pipeline example:**
  - Copy from S3 to Blob, running on a self-hosted IR in AWS.
  - **On failure**, a Web activity sends an email.
  - **On success**, run Spark, then copy to the warehouse.
  - Key line: pipelines are the boss; activities do the real work.
- **Monitoring** pushes to Azure Monitor.
- **Pricing model:**
  - You pay per activity run and per hour of data movement. Movement on a self-hosted IR is cheaper, because you supply
    the machine.
  - Other resources are billed on top.
- **SSIS lift-and-shift:** run existing packages on the Azure-SSIS IR against SQL Managed Instance (up to 30 TB). Its
  VMs are billed hourly and can be started and stopped.

**Lab use:** this is the "one row's journey" for Concept 1 (source → lake → prepare → serve → report). The
success/failure branch with an email is the first control-flow example.

### 18.2 SAP data integration using ADF (June 2020, 49 slides)

- **Two SAP scenarios:** ongoing batch ETL from SAP into the lake, and **historical migration** from SAP to Azure.
- **Choosing a connector is a PO-level decision table:**

| Extracting from | Option | SAP-side setup | Speed | Fits |
|---|---|---|---|---|
| SAP BW | SAP Table | none | fast, parallel by partition | large volume |
| SAP BW | BW Open Hub | create an Open Hub Destination | fast, parallel | large, well-planned workloads |
| SAP BW | BW via MDX | none | slower | exploratory, small |
| ECC / S/4HANA | SAP Table | none | fast, parallel | large volume |
| ECC / S/4HANA | SAP ECC (OData via SAP Gateway) | Gateway + OData service | slower | small; tip: under 1 million rows per run |
| HANA | SAP HANA (ODBC driver, custom query) | none | TB-scale with partitions | large |

- Every SAP connector runs on a **self-hosted IR**, with outbound port 443 only. The one exception: ECC can use the
  Azure IR if it's publicly reachable.
- BW/4HANA wasn't supported at the time.
- **The three incremental-load patterns**, which are the same for every source. This is the cleanest statement of them
  anywhere in the docs:
  1. **There's a timestamp column** (e.g. last modified): use a tumbling-window trigger plus a query filtered on the
     window's start and end.
  2. **There's an ever-increasing column** (e.g. an ID): use an external control table or file holding a
     **high-watermark**:
     - look up the old value, look up the new one, copy between them, then update the watermark;
     - this is the "Delta copy from Database" template.
  3. **The table is small** (dimension data): full copy and overwrite.
- **Open Hub specifics:**
  - The watermark is the max request ID, which the Copy activity returns in its output.
  - **"Exclude last request"** defaults to true, so you don't copy a batch SAP is still writing. It only matters if the
    SAP extract and the copy can run at the same time.
- **Scaling:**
  - The Azure IR scales by DIUs per run.
  - The self-hosted IR scales by a bigger machine or more nodes.
  - Pipelines scale out with multiple copies, concurrency and partitions.
- **Network topologies:**
  - Self-hosted IR on-prem over the public internet.
  - Self-hosted IR on an Azure VM with ExpressRoute private peering and VNet service endpoints.
  - SAP running on Azure itself.
- **Customer stories cited:** Reckitt Benckiser, Newell Brands.

**Lab use:**
- "Which incremental pattern fits this table?" is a strong beginner concept check, with three clear answers.
- "Exclude last request" is a scenario about reading a source while it's still being written.
- The connector table is a model of how a PO frames a technical choice: setup cost versus speed versus volume.

### 18.3 Passing Parameters (2019)

- Parameter names are **case-sensitive**.
- **Naming conventions** suggested:
  - `pl_businessfunction_nnnn` (pipelines)
  - `ds_technologyname_nnnn` (datasets)
  - `ac_techfunction_nnnn` (activities)
  - `ls_connectiontype_nnnn` (linked services)
- **Pipeline to dataset:**
  - A pipeline parameter (`relativeurl`, default `/speakers`) is mapped to a dataset parameter, e.g.
    `@dataset().relativeurl` receives `@pipeline().parameters.relativeurl`.
  - The dataset can't see the pipeline's parameters directly; you must pass them through explicitly.
  - The example copies from a REST API into ADLS Gen2 as JSON, authenticating with managed identity.
- **Activity to activity:**
  - Get Metadata reads a file's name, type and last-modified time.
  - On the Success path, a Stored Procedure activity writes those into a control table (`TB_FILE_METADATA`), using
    `@activity('GetFileEditInfo').output.lastModified`.

**Lab use:** this is the concept "one pipeline, many tables". A parameterised pipeline plus a control table is how a
migration factory runs hundreds of tables without hundreds of pipelines.

### 18.4 DevOps (2019)

- **Four environments:** DEV, QA/INT, UAT and Prod. UAT and Prod sit in separate resource groups.
- **The flow:**
  1. Work in a feature branch.
  2. Raise a PR into the collaboration branch (master).
  3. Publish from the Dev factory. This writes ARM templates to the `adf_publish` branch.
  4. An Azure DevOps release pipeline deploys QA → UAT → Prod, using one parameter file per environment.
- **Secrets:** Azure Key Vault, never inline.
- **Release control:**
  - A continuous-deployment trigger fires on `adf_publish`.
  - Each stage has **pre-deployment approvals**, with a timeout (e.g. 30 days).
  - The person who requested the release shouldn't be the one who approves it.
- **Not in the paper:** stopping triggers during a deployment. The current CI/CD docs page should be checked for that
  (see the coverage log).

**Lab use:** a scenario where a pipeline works in Dev and breaks in UAT because a connection string was hard-coded,
not parameterised per environment. Also a PO decision: who approves promotion to Prod, and on what evidence.

## 19. CI/CD today (continuous-integration-delivery, 2026)

The current page updates the 2019 paper, and it **does** cover triggers. (Rewritten 2026-10-04 to separate what the
product does from what Microsoft or the course recommends. **[F]** = Microsoft states it as product behaviour or an
unsupported feature; **[R]** = Microsoft recommends it; **[C]** = course practice, not stated by Microsoft.)

- **[R]** **Only the Dev factory is connected to Git.** The lifecycle note says "The test and production factories
  shouldn't have a git repository associated with them and should only be updated via an Azure DevOps pipeline or via a
  Resource Management template"; the best-practices list repeats it ("Configure only your development data factory with
  Git integration"). Not a technical requirement.
- **[C]** "Test and Prod are never edited by hand" is the course's governance wording of the line above. ADF doesn't
  stop a person editing a non-Git factory.
- **[F]** **Two ways to produce the ARM templates, both supported** (continuous-integration-delivery-improvements):
  the **Publish button** writes templates to the `adf_publish` branch; **automated publish** uses the npm package
  `@microsoft/azure-data-factory-utilities` (`validate` and `export` commands) in a build pipeline, triggered on each
  commit to main, and a release pipeline consumes the build artifact instead of `adf_publish`. "The ARM template
  generated isn't published to the live version of the factory. Deployment should be done by using a CI/CD pipeline."
  Node.js 20.x is the documented version. The generated artifacts already contain the pre/post-deployment trigger
  scripts. The page says the ability "to stop/start only the updated triggers is now generally available and is merged
  into" the export command; its sample YAML still carries a comment about a `build-preview` variant for the same thing,
  so the page is not fully consistent with itself (§30.3).
- **[F]/[R]** **Triggers.** The best-practices list says tasks "like stopping and restarting triggers and performing
  cleanup" are needed before the ARM deployment step and recommends PowerShell scripts, with
  `PrePostDeploymentScript.Ver2.ps1` to touch only the modified triggers. The automate-CI page states the reason:
  "Deployment can fail if you try to update active triggers. To update active triggers, you need to manually stop them
  and then restart them after the deployment." So the stop/restart is driven by a product behaviour, and the script is
  the recommended way. Use PowerShell Core in the ADO task.
- **[F]** **Integration runtimes must have the same name and type in every environment** ("Data Factory expects you to
  have the same name, type, and subtype"). A self-hosted IR can be shared across factories through a separate "shared
  IR" factory (a linked IR). Azure-SSIS IRs can't be shared.
- **[R]** **Key Vault:** use one vault per environment, so the team needn't have access to Prod secrets; keep the
  **same secret names** in every vault, so only the vault name changes between environments.
- **[R]** **Names:** no spaces in resource names; use `_` or `-` ("due to ARM template constraints").
- **[R]** **Feature flags:** combine a global parameter with an If Condition activity to merge code that mustn't run in
  QA/Prod yet.
- **[F]** **Global parameters:** Microsoft recommends the newer "Include global parameters in ARM template" setting
  (Manage hub, ARM template), which is available only in Git mode; the older mechanism plus a PowerShell script still
  works. Names can't contain `-`.
- **[F]** **Deployment mode:** the ARM deployment task uses **Incremental**; Complete mode deletes resources in the
  resource group that aren't in the template.
- **[F]** **Unsupported, "by design":** cherry-picking commits or selective publishing ("Publishing includes all
  changes made in the data factory", because entities depend on each other); for the rare case, a hotfix process.
  Also unsupported: publishing from private branches, Bitbucket, signed commits, partial ARM templates in the publish
  branch (since 1 Nov 2021), exporting alerts and metrics as parameters.
- **[R]** Azure RBAC on individual entities: "The Azure Data Factory team doesn't recommend assigning Azure RBAC controls
  to individual entities (for example, pipelines and datasets)"; use a second factory if you need many roles. (The
  course used to say access "can't" be granted per pipeline; that was stronger than the page.)
- **Customer-managed key in CI/CD:** CMK settings aren't in the ARM template by default; tick "Include in ARM template"
  (Git mode) and note it adds a factory-level setting that overrides other factory-level settings (such as git
  configuration) in the target environment.
- **IaC:** a quickstart "Create an Azure Data Factory using Bicep" exists (Bicep deploys the factory and its objects).
  Microsoft's CI/CD pages themselves are ARM-template based.

**Lab use:** "A fix for one pipeline must go out today, but Dev contains half-finished work on three others. What do
you do?" (the hotfix branch; publishing includes every change in the factory, with no selective publish).

## 20. Orchestration building blocks with hard limits

| Thing | Fact from the docs | Why a PO cares |
|---|---|---|
| **Lookup** | Returns at most **5,000 rows** (it silently keeps only the first 5,000) and **4 MB** (over that, it fails); times out after 24 h. `firstRowOnly` defaults to true. | A control table with 6,000 entries **quietly drops 1,000 tables**. The workaround is a two-level pipeline. |
| **ForEach** | Runs in parallel by default. `batchCount` defaults to 20, max 50. At most 100,000 items. **Can't be nested** (the page: "a ForEach loop inside another ForEach loop (or an Until loop)"; workaround: a parent pipeline calling a child). A Set Variable inside a parallel ForEach is unsafe, because variables belong to the whole pipeline. | "Why did the loop give wrong values?" Parallel iterations overwrote a shared variable. |
| **Execute Pipeline** | Used for parent/child pipelines; the documented workaround for most limits | The migration-factory pattern |
| **Databricks Notebook activity** | Passes values in through `baseParameters`. The notebook returns a value with `dbutils.notebook.exit(...)`, read as `@activity('x').output.runOutput` (max 2 MB). | This is how ADF (the orchestrator) hands off to Databricks (the compute) and gets a result back, e.g. a row count to reconcile. |

**Factory limits** (from the Azure subscription limits page):
- 5,000 entities per factory.
- 10,000 concurrent pipeline runs.
- **120 activities per pipeline**, counting activities inside containers. The April 2024 What's-new entry said the
  limit was lifted to 80; the limits page is newer.
- 50 parameters per pipeline.
- 100 queued runs per pipeline.
- Tumbling window of at least 5 min.
- Activity timeout between 10 min and 7 days.
- 256 DIUs per copy.
- 4 nodes per self-hosted IR.
- Data flow TTL of at most 4 h.

## 21. Templates: the two patterns behind a migration factory

- **Delta copy with a control table** (four activities):
  1. Lookup the **old** watermark from the control table.
  2. Lookup the **new** watermark from the source (the current max).
  3. Copy the rows with `watermark > old AND <= new`.
  4. A stored procedure writes the **new** value back.
  - The source must have a timestamp or ever-increasing key.
  - The new value is captured *before* the copy, and saved only *after* it succeeds.
- **Bulk copy with a control table:**
  - The control table holds one row per **partition**: `PartitionID`, `SourceTableName`, `FilterQuery`. For example,
    one row per year of a large table, or ID ranges.
  - Lookup the control table, then ForEach over its rows, running one Copy per partition.
  - Built for Oracle, Netezza, Teradata or SQL Server into Synapse.
  - For a few small tables, the docs say the Copy Data tool is simpler.

**Lab use:** this is the heart of "how did you plan the migration of 400 tables?":
- The control table is the **plan**: every table or partition, with its load pattern.
- The pipeline is generic.
- The status of each row is your progress report.

A PO owns the control table's contents and priorities, not the pipeline code.

## 22. Performance and sizing

- **The rule:** throughput is capped by the slowest of three things: source, network, sink.
- **The docs' duration table** (after tuning):

| Data | 100 Mbps | 1 Gbps | 10 Gbps |
|---|---|---|---|
| 1 TB | 23.3 hrs | 2.3 hrs | 0.2 hrs |
| 10 TB | 9.7 days | 0.9 days | 0.1 days |
| 100 TB | 97.1 days | 9.7 days | 1 day |
| 1 PB | 32.4 months | 3.2 months | 0.3 months |

- **Tuning order:**
  1. Test on a sample big enough to take ≥10 minutes.
  2. Get the most out of one copy (DIUs on the Azure IR; a dedicated machine for the self-hosted IR, separate from
     the database server).
  3. Only then run many copies in parallel.
  4. Only then scale to the full dataset.
- **The monitoring view splits a copy into stages:**
  - Queue: waiting for IR capacity. A long queue means the self-hosted IR needs to scale up or out.
  - Pre-copy script.
  - Transfer, which breaks down into:
    - time to first byte (a slow source query);
    - listing the source (wildcard filters list *everything* first);
    - reading;
    - writing.
  - **The longest stage is the bottleneck.**
- **Loading SQL Database:** drop the indexes before the load and recreate them after. Stored-procedure sinks are
  slower than bulk insert.
- **Large Excel, XML or single-object JSON files are read whole into memory.** Out-of-memory failures here are by
  design; split the files.

**Lab use:** "The business wants cutover in 3 weeks; there are 80 TB and a 1 Gbps link." From the table that's about
8 days of pure transfer at best, so the plan needs partitioning, parallel copies and a delta catch-up before cutover.
This is a real PO planning conversation.

## 23. Security, cost, monitoring, lineage

- **Credentials:**
  - Stored encrypted by ADF, or in **Key Vault**, which is recommended.
  - For on-prem sources, they can be encrypted and stored **only on the self-hosted IR machine** (Windows DPAPI).
  - What ADF keeps: the older data-movement-security-considerations page says "does not store any temporary data,
    cache data or logs except for linked service credentials". The newer secure-your-azure-data-factory page (updated
    2026) says it doesn't store the source or sink data, "only pipeline definitions, run metadata, and cached data",
    encrypted at rest (§27). **Follow the newer page.** (Corrected 2026-09-26 after an external review.)
- **Network:**
  - The self-hosted IR needs **outbound 443 only**.
  - 1433 only for Azure SQL/Synapse, and avoidable with staged copy.
  - Inbound 8060 only on the machine itself, for the credential tool.
  - ExpressRoute or IPsec VPN is optional extra protection.
- **Cost meters** (Corrected 2026-10-04: the earlier "four meters" list was a re-grouping, not Microsoft's wording).
  The plan-manage-costs page lists **three meters**:
  1. **Orchestration activity runs**;
  2. **DIU-hours** (copies on the Azure IR; used DIUs x duration);
  3. **vCore-hours** (data flow execution *and debugging*, by compute type, vCores and duration);
  and then "other costs that might accrue": **pipeline activity execution**, **external pipeline activity execution**,
  **creating/editing/retrieving/monitoring factory artifacts** (the "operations" charges), and **SSIS IR duration**.
  The Azure pricing page's headings (checked through a page summary, so meter *names* only, no prices recorded) also
  show data movement, pipeline and external activities, data flow, Workflow Orchestration Manager (Airflow), and
  read/write and monitoring operations. Other Azure services around ADF (Log Analytics, storage for staging, data
  transfer) are billed separately. With a managed-virtual-network IR and time to live on, "reserved compute resources
  determine the billing".
  - Estimate with a proof of concept. The docs' own example (prices hypothetical): moving 100 GB took 1.2667
    DIU-hours, so 1 TB a day for a month is about 380 DIU-hours.
  - **Per-pipeline billing** is opt-in, per factory, and isn't carried by CI/CD. It's useful for charging costs back
    to each domain. Known limits: factory operations charges, SSIS nodes, and data flows on an Azure IR with TTL are
    filed under a fall-back line item, not under a pipeline.
  - Course position: teach "what costs money, which design decision causes it, how to control it", not a meter count.
- **Monitoring:**
  - ADF keeps run history for only **45 days**. Send it to Log Analytics to keep it longer, alert on it, or see
    several factories at once.
  - The recommended first alert: failed pipeline runs > 0.
- **Lineage:**
  - Connect ADF to **Microsoft Purview**; the factory's managed identity needs the *Data Curator* role (on the Purview
    **root collection**; ADF tries to assign it automatically if you have Collection admins there).
  - Pipeline runs then push lineage automatically, for Copy, Data Flow and SSIS. (Qualified 2026-10-04 from the
    Purview page "Connect Azure Data Factory to Microsoft Purview", ms.date 2026-02-24: lineage is **runtime lineage**
    for those three activities only; "Microsoft Purview drops lineage if the source or destination uses an unsupported
    data storage system"; query and stored-procedure sources aren't supported ("lineage is limited to table and view
    sources"); Data Flow lineage shows source and sink only, not transformations, and isn't supported with flowlets;
    column-level lineage isn't supported for resource sets; Copy lineage doesn't cover compression settings, source
    partition options, or max rows per file; the Purview connection page lists up to 10 factories connected at once.
    **Classification** comes from Purview scanning the stores. ADF's own *Secure your Azure Data Factory deployment*
    page (updated 2026-09-02) uses the shorthand "Connect Data Factory to Microsoft Purview to discover and classify
    data your pipelines move... and track data lineage", which is why the course's old wording was Microsoft-sourced
    but broader than the Purview page.)
- **How many factories?** Decide by security boundary, e.g. one for HR and one for Finance. There's no cost
  difference, because billing is by use.

**Lab use:**
- "An auditor asks for the run history of a load from 4 months ago." It's gone unless diagnostic logs were routed
  somewhere.
- "Finance wants cost per business domain." Turn on per-pipeline billing, or use a factory per domain.

## 24. Where ADF is heading: Fabric Data Factory

Microsoft now calls **Fabric Data Factory "the next generation of ADF"**. Every ADF page carries a banner saying new
users should start with Fabric.

| ADF | Fabric |
|---|---|
| Linked service + dataset | **Connection** (dataset properties go inline in each activity) |
| Mapping data flow (Spark) | **Dataflow Gen2** (Power Query based). Corrected 2026-10-04: the Fabric upgrade-planning page (updated 2026-09-29) also says "Dataflow Gen2 supports Mapping Data Flow (MDF) transforms with Spark-based execution. MDF transforms are currently in preview", with a built-in migration experience for eligible data flows; so "a different engine" is no longer the whole story |
| Self-hosted IR | **On-premises data gateway** |
| Azure IR | not needed |
| Publish step | Save / Run, no publish |
| CDC resource | **Copy job** |
| Global parameters | Variable library |
| Managed identity | Workspace identity |
| ARM + DevOps CI/CD | Built-in deployment pipelines, can promote a single item |
| Pay per use | Capacity (F SKU) |

- Azure-SSIS and managed VNet aren't in Fabric yet ("to be determined"; re-checked 2026-10-04 on the comparison page,
  last updated 2026-09-29). The same page describes a **virtual network data gateway** for Fabric, deployed into the
  customer's own virtual network, as a different (customer-managed) model: "ADF Managed VNET: Microsoft owns and manages
  the network environment... Fabric VNET data gateway: You deploy the gateway inside your own Azure virtual network."
- About 90% of activities are already available.
- **Three migration paths** (re-checked 2026-10-04 on the upgrade-planning page, updated 2026-09-29):
  1. Mount the existing ADF inside Fabric as an "Azure Data Factory item": a live view for discovery, ownership and
     side-by-side testing; "execution of pipelines, activities, and integration runtimes still occurs within your Azure
     resources". **The "generally available since May 2025" date recorded earlier is not on this page or the comparison
     page, so it is not stated in the course any more.**
  2. The built-in upgrade experience, which assesses each pipeline in ADF and labels it: Ready, Needs review, Coming
     soon, or Not compatible; then upgrades the supported ones incrementally. **"Pipelines went GA in March 2026" is
     likewise not on the pages checked and was dropped from the course.**
  3. Rebuild by hand, for low-parity pipelines. The page's scenario 1 also says to replace SHIRs with on-premises data
     gateways and VNet IRs with virtual network data gateways; Validation activity isn't supported (rebuild with Get
     Metadata, loops and If); CDC becomes Copy jobs; global parameters become variable libraries.
- **The manual path's steps:**
  1. inventory
  2. clean up
  3. find the gaps
  4. plan
  5. prioritise by business impact and complexity
  6. test

**Interview relevance:** a Databricks + Azure role will still meet ADF. But a strong PO answer to "would you build new
pipelines in ADF today?" mentions Fabric and the trade-off: an existing ADF estate and self-hosted IRs, versus
Fabric's capacity pricing and features that are still missing.

## 25. Connectors (skimmed)

- About 100 connectors, grouped as: Azure, Database, NoSQL, File, Generic protocol, Fabric, and Services & apps.
- Each connector supports some of: copy source/sink, data flow, Lookup, Get Metadata, Delete.
- **Preview connectors aren't recommended for production.**
- **Capabilities are per connector (and per version), not per category** (Corrected 2026-10-04: this bullet used to say
  "Oracle... are source only; Oracle can also be a sink", which contradicted itself, and the course repeated the
  first half). The connector overview and Copy activity tables, checked 2026-10-04: **Oracle** Copy source **and**
  sink (also Lookup and Script; Azure IR and self-hosted IR; not listed for mapping data flow); **Netezza**,
  **Teradata**, **SAP Table**, **SAP BW** (Open Hub, MDX) and **SAP ECC** source only; **SAP HANA** source, with a sink
  only through the generic ODBC connector and the SAP HANA ODBC driver; **SAP Cloud for Customer** source and sink.
  Many database connectors are source only, but not all. Don't teach a static list; teach "look the connector up".
- If a connector is missing: use generic ODBC, REST, OData or HTTP, or land the files somewhere ADF can read.
- **Formats:** the **Copy activity** list is Avro, Binary, delimited text, Excel, Iceberg (**Azure Data Lake Storage
  Gen2 only**), JSON, ORC, Parquet, XML. The wider connector-overview list also names **Common Data Model** and
  **Delta**: those are data-flow formats, and Copy reaches Delta tables through the Azure Databricks Delta Lake
  connector (Corrected 2026-10-04: the course listed Delta as a Copy format).
- Several connectors now have a "version 2.0" (SQL Server, Oracle, Snowflake…). The docs have a **Connector Upgrade
  Advisor**, meaning old connector versions are being retired. That's a real migration-backlog item. The Oracle page
  says: "The Oracle connector version 1.0 is at removal stage" (see "connector release stages and timelines").

## 26. Reconciliation beyond counts (added 2026-09-26)

**The question:** after a migration, how do you prove the data is complete and correct, not just that the row counts
match?

**What the Copy activity gives you** (§12):
- Row counts: `rowsRead`, `rowsCopied`, `rowsSkipped`.
- Optional "data consistency verification". For tables this is a **row count only**; files also get size, date and an
  MD5 checksum.
- **It never compares values.** Anything more has to be built.

**What mapping data flows provide to build it** (data-flow-aggregate-functions, data-flow-expressions-usage,
data-flow-assert):

| Level | What you compare | ADF building block (documented) |
|---|---|---|
| 1. Counts | rows per table, per partition or per day | `count`, `countAll` (counts nulls too), `countIf` |
| 2. Column profile | totals and ranges per column | `sum`, `sumDistinct`, `min`, `max`, `avg`/`mean`, `stddev`, `variance`, `countDistinct`, `approxDistinctCount`, `countIf(isNull(...))` for null counts. Corrected 2026-10-04: **most** have an `…If` form (`sumIf`, `avgIf`, `maxIf`, `minIf`, `stddevIf`, `varianceIf`, `countIf`, `sumDistinctIf`), but **`countDistinct` and `approxDistinctCount` do not** (no `countDistinctIf`/`approxDistinctCountIf` on the aggregate list) |
| 3. Distribution | quartiles, deciles, median | **No `median` or `percentile` aggregate exists.** `nTile` is a window function "useful for the calculation of tertiles, quartiles, deciles"; `rank`, `denseRank`, `cumeDist`, `rowNumber`, `lag` and `lead` also exist. A median can only be **derived** (e.g. the boundary of `nTile(2)`), not called directly. |
| 4. Row by row | does every key exist on both sides, and are the values identical? | **Row fingerprints:** `md5`, `sha1`, `sha2` (224/256/384/512) and `crc32`, each documented as "a fingerprint for a row"; hash the same columns on both sides and compare. The **Assert** transformation's `expectExists` checks that rows exist in both streams, and `expectUnique` tags duplicates. |
| 5. Business rules | values in an allowed range, e.g. balance ≥ 0, valid currency codes | Assert `expectTrue`; failures can **fail the data flow** or be written to an error file |

- **Why levels 2 and 3 aren't enough** (reasoning, not a quote): matching totals can hide offsetting errors, and one
  row too high can cancel one too low. The Phase 0 spike measured exactly this: 500 rows and identical sums, yet 300
  rows differed. That's what the Lakehouse Lab's Station C compare view shows. Only row-level comparison on a key
  proves each record.
- **Financial data specifically:**
  - With type conversion on, `allowDataTruncation` defaults to **true** (§12), so decimal precision can be lost silently. A money column
    rounded on the way in can still leave `sum` looking right at low precision.
  - Set truncation off, and compare sums at full precision.
- **Re-verified 2026-10-04** (aggregate list, expressions usage, Assert pages): every function the course names exists:
  `count`, `countAll` ("including NULL values"), `countIf`, `countDistinct`, `approxDistinctCount`, `sum`, `sumDistinct`,
  `min`, `max`, `avg`, `mean`, `stddev`, `variance`; `nTile` ("useful for the calculation of tertiles, quartiles,
  deciles, and other common summary statistics"); `md5` (32-char hex), `sha1` (40-char hex), `sha2` (bit length 224/256/
  384/512), `crc32`, each "a fingerprint for a row"; `isError()`, `hasError('id')`; Assert types Expect true, Expect
  unique, Expect exists (needs a second stream), plus "Fail data flow", and sink "Errors" tab / ignore error rows.
  **No `median`, `percentile` or `approxQuantile` appears anywhere** on the function reference (0 hits), so "no median
  function" is true as of this check; a median is derived, e.g. from `nTile(2)` boundaries. The `crc32` entry's text
  copies the sha2 wording ("when given a bit length") while its signature has no bit-length argument; a documentation
  slip. A CRC32 is a short checksum, so the course suggests sha2/md5 where a collision would matter (engineering
  judgement, not a Microsoft statement). Hash comparison across systems needs identical types and formatting and a
  decision on NULLs (engineering judgement).
- **Data flow source coverage** (data-flow-source page, updated 2026-04-28): data flows read a *subset* of connectors
  ("works with staging datasets that are all in Azure"). **Oracle, Teradata and Netezza are not in the list**, and the page
  says to "use the Copy Activity to load that data into one of the supported staging areas". So reconciling an Oracle
  source inside a data flow requires landing it first.
- **Where it runs:**
  - Data flows run on an **Azure IR only**; the self-hosted IR can't run them.
  - To reconcile against an on-premises source, either copy the aggregates or hashes out first, or compute them in
    the source database with a query.
  - The Lookup activity (max 5,000 rows, 4 MB) can read one row of source totals to compare with.
- **Assert results:** failing rows can be sent to an error file on the sink's Errors tab, or excluded from the output.
  `isError()` and `hasError()` let later steps route them.
- **Not in ADF docs:** a built-in "reconcile source vs target" feature. Reconciliation is something the team designs
  from these parts. Databricks and Delta have their own tools, to be read in the Databricks walkthrough, not assumed
  here.

## 27. Sensitive data (PII) and regulated industries (added 2026-09-26)

The context: a bank or card issuer (BFSI) migrating customer and card data.

**What ADF does and doesn't keep:**
- "Azure Data Factory doesn't store the source or sink data it moves: only pipeline definitions, run metadata, and
  cached data" (secure-your-azure-data-factory).
- Credentials are encrypted, or held in Key Vault (§23).

**Controls the documentation provides:**

| Concern | Documented control |
|---|---|
| Data in transit | HTTPS/TLS (1.2) to cloud stores; ExpressRoute or VPN for a private route; **Private Link** to the factory (a private endpoint in your own VNet for the factory service, §30.2); an Azure IR in a **managed virtual network**, using managed private endpoints to the stores |
| Data staying in a country or region | Create an Azure IR **in that region** and point linked services at it (§6); the factory's region holds only metadata |
| Credentials | **Managed identity** instead of stored credentials; secrets in **Key Vault**; on-premises credentials can be encrypted and kept only on the self-hosted IR machine |
| The factory's own encryption | Microsoft-managed key by default; **customer-managed key** (BYOK) in Key Vault. (Corrected 2026-10-04.) **Two ways to enable it:** *during factory creation* in the Azure portal (Advanced tab, using a **user-assigned managed identity**; portal only), or *after creation* in the Data Factory UI (Manage hub, Customer managed key), where it "can only be configured on an empty data Factory" (no linked services, pipelines or data flows) and "does not work with managed virtual network enabled factories". **Once enabled it can't be removed** ("By design, once the... feature is enabled, you can't remove the extra security step"), but you can change the key or key version. Key Vault needs Soft Delete and Do Not Purge (purge protection), the same Entra tenant and the same region (subscriptions may differ); only RSA / RSA-HSM keys; Data Factory uses both the factory system key and the CMK, and "missing either would result in Deny of Access to data and factory". Microsoft recommends enabling it right after creation. For CI/CD, tick "Include in ARM template". |
| Sensitive values in monitoring | Activity policy **`secureInput` / `secureOutput`**: inputs and outputs aren't logged to monitoring. **SecureString** parameters are masked in the Monitoring UI. |
| Finding where PII is | **Microsoft Purview** scans stores to discover and classify sensitive data; connecting ADF pushes **runtime lineage** for Copy, Data Flow and Execute SSIS (a subset of stores) and lets ADF users search the catalog. Qualified 2026-10-04, see §23 |
| Masking | **No built-in masking in the Copy activity.** Options: a mapping data flow with derived columns (e.g. hash functions); the **PII detection and masking** template, which **calls an external Azure AI (Foundry Tools) service** from the data flow; third-party tools (the Azure Architecture Center documents **Delphix**) |
| Enforcement | **Azure Policy** built-ins to require customer-managed keys, Key Vault for linked-service secrets, and no public network access; **resource locks** on production factories |
| Audit | Diagnostic logs to Log Analytics (`ADFPipelineRun`, `ADFActivityRun`, `ADFTriggerRun`), which also beats the 45-day history limit (§23) |

**Traps for regulated data, from the docs:**
1. **Skipped rows are written, with their values, into the session log.** The fault-tolerance page's example log
   shows the skipped row's actual data (`"data1", "data2", "data3"`).
   - With fault tolerance on, **card numbers or customer details can land in a CSV in a storage account**.
   - That storage needs the same protection, access control and retention as the source.
2. **The PII masking template sends the data to an AI service.** It masks by calling an external endpoint, so the
   data leaves the pipeline for that service. For a bank, that's a decision for security and compliance, not a
   default.
3. **Customer-managed keys must be decided at the start.** Enable them at creation (or, later, only on an empty
   factory); once on, they can't be switched off (Corrected 2026-10-04: the empty-factory rule applies to the
   after-creation route only).
4. **Activity outputs appear in monitoring** unless `secureOutput` is set. A Lookup that reads customer rows, or a
   notebook that returns values, would otherwise show them in run history.
5. **Data flow debug shows real rows** in Data Preview to whoever runs it. With production PII, that's a question of
   who may debug against which environment. The preview is documented; the access decision is ours.

**Compliance:** the security-considerations page lists **CSA STAR, ISO 20000-1, 22301, 27001, 27017, 27018, 9001,
SOC 1/2/3, HIPAA BAA and HITRUST** for Data Factory. **That list doesn't mention PCI DSS.** For card data, check
Microsoft's Azure compliance offerings rather than assume.

## 28. Fine-tuning copies and data flows (added 2026-09-26)

**Copy activity knobs** (copy-activity-performance-features):
- **Data Integration Units (DIUs):** CPU, memory and network for a copy on the **Azure IR only** (not the self-hosted
  IR). Allowed range **4 to 256**. Left on **Auto**, the service picks per source-sink pair and data pattern:
  - Between file stores: a single file gets **4**; many files **4–256** by number and size; the default is **4–32**.
    Example from the page: a folder of 4 large files, hierarchy preserved → max effective **16**; merged into one file → **4**.
  - From a partition-option-enabled database (Azure SQL, SQL MI, Synapse, PostgreSQL, Oracle, Netezza, SQL Server,
    Teradata): **4–256 when writing to a folder, 4 when writing one file**; **up to 4 DIUs per source partition**.
  - REST or HTTP source: default **1**. Into Synapse with PolyBase/COPY: default **2**.
  - Billing: **used DIUs × copy duration × price per DIU-hour**. The actual DIUs used can be lower than the setting.
- **Parallel copy** (`parallelCopies`, "Degree of parallelism" in the UI): the maximum threads reading and writing in
  parallel, **counted across all DIUs or self-hosted IR nodes**. Auto by default, and the page's tip is that the default
  "usually gives you the best throughput".
  - Between file stores it works **per file**, so never more than the number of files; **mergeFile can't use it**.
  - From a partition-option-enabled database the default is **4**, never more than the number of partitions. With a
    **self-hosted IR writing to Blob/ADLS Gen2, the max effective is 4 or 5 per node**.
  - For other non-file sources it **doesn't take effect**, even if set.
  - Raising it increases the load on the source, the sink and the self-hosted IR; "too many parallel copies could even
    hurt the performance". Lower it if a store is overwhelmed.
- **Self-hosted IR scaling:** CPU and memory free but concurrent jobs at the limit → **scale up** (more concurrent jobs
  per node). CPU high or memory low → **scale out** (add a node). One copy can use several nodes for many files or a
  partitioned database source.
- **Staged copy** (through your own Blob or ADLS Gen2; `enableStaging` default false): for Synapse via PolyBase,
  Snowflake, Redshift or HDFS; to avoid opening port 1433 (the self-hosted IR sends to staging over 443); and to
  **compress** data before a slow on-premises link. ADF cleans up staging, so it needs **delete permission** there.
  **Billed as two copies.** Compression with managed identity or service principal authentication on the staging store
  isn't supported. Two stores on **different self-hosted IRs** can't be copied between, staged or not: chain two copies.

**Finding the bottleneck** (copy-activity-performance-troubleshooting):
- The monitoring view may show **"Performance tuning tips"**: the service's own diagnosis for that run (e.g. use
  PolyBase/COPY into Synapse, a higher Azure SQL tier when DTU is high, move the Azure IR region, scale the self-hosted
  IR, remove staging that isn't helping).
- Otherwise look for the **longest stage**:
  - **Queue** (self-hosted IR): no capacity; scale up or out.
  - **Pre-copy script:** tune the script on the sink database.
  - **Time to first byte:** the source query is slow or the source is busy; tune the query, ask the source's team.
  - **Listing source:** wildcard and last-modified filters list **every file** first, then filter. Use date-partitioned
    paths, server-side **prefix** filters, or split the set into several copies (Lookup/GetMetadata + ForEach + Copy).
  - **Reading / writing:** check throttling; use the connector's bulk method (Redshift UNLOAD, PolyBase/COPY, database
    partition options, DistCp for HDFS); raise DIUs if the pattern allows more than 4; otherwise split and run copies
    concurrently. Put the Azure IR in or near the store's region.
- **Loading Azure SQL Database:** tier too low or DTU near 100%; drop indexes before and recreate after; a larger
  `writeBatchSize`; bulk insert rather than a stored procedure.
- **A managed virtual network IR queues longer** than the Azure IR by design: there's a warm-up for each copy.
- **Large Excel (≥100 MB), XML or single-object JSON files** are read whole into memory; out-of-memory failures are by
  design. Options: a larger self-hosted IR machine, a memory-optimised data flow cluster, or split the files.

**Data flow knobs** (concepts-data-flow-performance, concepts-integration-runtime-performance):
- Four possible bottlenecks: **cluster start-up** (a just-in-time cluster per job, **generally 3–5 minutes**), reading,
  transformation, writing. The largest stage is the likely bottleneck.
- **Cluster size:** default **small = 4 driver + 4 worker cores**; medium 16 total, large 32, up to 272. Priced in
  vCore-hours, so bigger costs more per minute but can finish sooner. "Start small and scale up"; there's a ceiling:
  more cores than data partitions doesn't help.
- **Time to live (TTL):** keeps the cluster warm after a job so the **next sequential** data flow skips start-up. Not
  recommended when data flows run **in parallel** (one job per cluster). **Not available on the default auto-resolve
  IR.**
- **Partitioning (Optimize tab):** "Use current partitioning" is the default and **recommended in most scenarios**;
  repartition only after skewing joins/aggregates or with SQL source partitioning. **Single partition** is "strongly
  discouraged". Manually setting partitioning "can offset the benefits of the Spark optimizer".
- **Shuffle partitions** (a custom runtime property, **50 to 2000**; default **200**, good for about **300 GB**; aim for
  about **1.5 GB per partition**): for out-of-memory errors on big joins/aggregates, only in known scenarios.
- **Logging level:** **Verbose is the default** and expensive; use **Basic** or **None** unless troubleshooting.

**Lab use:** "The nightly load now takes six hours." Open the slowest run, read the tuning tip, find the longest stage,
change one thing, rerun. Not "add DIUs and hope".

## 29. Recovering from failures (added 2026-09-26)

**What ADF does for you, and what it doesn't** (reliability-data-factory):
- "Reliability is a shared responsibility." Microsoft runs the core service and the Azure IR; **the self-hosted IR's
  resilience is yours**.
- **Transient faults:** set **retry policies** on activities and tumbling window triggers (default 0, §3).
- **Idempotence** is the documented expectation: ADF "might rerun pipeline activities" after a transient fault or a zone
  outage, and "this rerun can create duplicate records". Use unique identifiers, **upsert** (`MERGE`), and copy
  consistency features.
- **Zone outage:** the core service and Azure IR are zone-redundant at no extra cost, with no configuration; a
  self-hosted IR is only as resilient as the nodes you spread across zones. Activities in progress "might fail and be
  restarted". **Tumbling window trigger state might be lost**: restart or rerun triggers that were running.
  Microsoft doesn't notify you; use Azure Resource Health and Service Health alerts.
- **Region outage:** a factory lives in **one region**. Microsoft-managed failover to the paired region exists but is
  "best-effort", "likely to occur after a significant delay", may lose **some metadata**, and isn't done for nonpaired
  regions, **Brazil South or Southeast Asia**. After it, networking and IRs may need reconfiguring. A self-hosted IR
  never fails over with it (Azure Site Recovery can move a self-hosted IR VM).
- **The documented way to control it:** **Git + CI/CD**, so a new factory can be created in another region and
  redeployed from the repository. **Backup = source control**: there is no other backup of the factory's metadata.
- **SLA** covers API calls and activity runs starting, not your data arriving.

**Recovering a failed load** (copy-activity-overview, §10, §9):
- **Rerun options:** whole pipeline, from a chosen activity, **from the failed activity**, or with new parameters (§10).
- **Copy resume:** for **binary file copies between file stores with the folder hierarchy preserved** (e.g. S3 or HDFS to
  ADLS Gen2), an activity retry or "rerun from failed activity" **resumes from the failure point**. It resumes **per
  file** (a half-copied file is copied again). **Don't change the copy's settings between runs** (a changed DIU setting
  doesn't take effect on resume). Blob, ADLS Gen2, S3 and GCS sources can resume from any number of files; other file
  sources from tens of thousands, then recopy. Needs self-hosted IR **5.43.8935.2 or later**. **Every other copy
  restarts from the beginning.**
- **Windows:** tumbling windows can be rerun one at a time and backfill missed ones (§9). A schedule trigger doesn't.
- **Partitions:** large migrations partitioned so one failed slice reruns alone (§14).
- **Bad rows:** fault tolerance skips and logs them (§12); they still have to be reloaded after fixing, which is a task,
  not something ADF does.
- **Checkpoints:** CDC resumes from its checkpoint, unless a rename reset it (§15).

**Lab use:** the recovery plan for any incident is the same shape: stop the damage, rerun only what failed (a window,
a partition, a file set), make sure a rerun can't duplicate, reconcile, then tell people.

---

## 30. Accuracy audit of 2026-10-04

**What this is.** An outside review (`PrepBench_ADF_Accuracy_Audit_Report.pdf`, ten findings) was treated as a list of
hypotheses. Each was checked against the Learn page that owns the fact, on 2026-10-04, and the course
(`backend/app/content/packs/adf/v1.json`) was changed only where the page supported it. Only Microsoft Learn,
the Azure pricing page and Microsoft Q&A titles were used; no blogs. A page's own "updated" stamp is given where it
matters. Everything below is a fact about what the page said that day; pages change.

### 30.1 What the review claimed, and what the pages say

| ID | Review's claim | Verdict | Why |
|---|---|---|---|
| ADF-001 | Oracle is described as source only | **Confirmed** | Oracle: Copy source and sink (and Lookup, Script), Azure IR and self-hosted IR. The review cites connector 2.0; the page's capability table isn't version-specific (1.0 is documented with a sink too), so "connector 2.0" is not the condition. These notes (§25) already said "Oracle can also be a sink", so the pack contradicted its own source. |
| ADF-002 | CDC checkpoint rename rule is outdated | **Partly correct** | Microsoft's CDC concepts page still teaches the rename rule; the Data Flow activity page describes a GUID key for new activities and a different default elsewhere on the page. "Too absolute" is right; "outdated" is too strong because one Microsoft page still says it. See §15. |
| ADF-003 | "Azure IR can't reach on-premises" is too absolute | **Confirmed** | The IR choice page lists Azure IR with managed VNet as "Y" for on-prem access, with ExpressRoute/VPN and Private Link service set-up; a public address plus IP allowlisting is a third route. See §6, §8. |
| ADF-004 | "SHIR needs no VPN" needs topology context | **Confirmed** | Microsoft does say the SHIR needs no extra settings, ExpressRoute or VPN, but the host still needs a path to the source, and the Azure leg is public HTTPS unless ExpressRoute/VPN plus Private Link are added. See §8, §16. |
| ADF-005 | Managed VNet taxonomy confuses learners | **Partly correct** | The course's three-type model matches Microsoft's. The risk was the opposite of the review's description: managed virtual network appeared only in passing ("a managed virtual network IR"), so learners had no model for it, and four network terms were never separated. Fixed by adding the model and a four-term table. |
| ADF-006 | CMK only on an empty factory | **Confirmed** | Two routes: at creation (portal, user-assigned managed identity), or after creation on an empty factory (UI). "Can't be removed" stays true. See §27. |
| ADF-007 | CI/CD statements mix fact and policy | **Partly correct** | Git-only-on-Dev and no manual edits are Microsoft recommendations ("shouldn't"), not enforced. But "stop triggers" rests on a product behaviour (deployment can fail on active triggers), so it is not mere policy. See §19. |
| ADF-008 | "Publishing is all-or-nothing" is too absolute | **Not correct as stated** | Microsoft still lists "selective publishing" as unsupported "by design". Automated publish changes how templates are produced (validate and export in a build pipeline), not the granularity. What the course lacked was the automated route, now added. See §19. |
| ADF-009 | Four-meter cost model is incomplete | **Confirmed** | Microsoft lists three meters plus other charges (pipeline activity, external activity, operations, SSIS). See §23. |
| ADF-010 | Modern Trusted Service is missing | **Confirmed** | Page dated 2026-07-16, updated 2026-09-22: Legacy retires 1 August 2027; Modern recommended for new deployments. Added to the security chapter. |
| (unnumbered) | Bicep coverage is weak | **Confirmed, small** | The pack never mentioned Bicep. A one-line pointer to the documented Bicep quickstart was added; deeper IaC is left to the team. |
| (unnumbered) | Some limits and benchmarks are brittle | **Confirmed, and found specific cases** | See 30.4. |

### 30.2 Pages checked (all fetched 2026-10-04)

| Microsoft page | URL | What was verified | Qualification |
|---|---|---|---|
| Copy data to and from Oracle | https://learn.microsoft.com/en-us/azure/data-factory/connector-oracle | Copy source/sink, Lookup, Script; Azure and self-hosted IR; 1.0 "at removal stage"; managed-VNet IR can reach on-prem without a SHIR | ms.date 2026-04-09, updated 2026-08-05. Not listed for mapping data flow |
| Connector overview | https://learn.microsoft.com/en-us/azure/data-factory/connector-overview | Source/sink and data-flow columns per connector (Oracle ✓/✓; Netezza, Teradata, SAP Table ✓/−); formats list | Table changes whenever a connector changes |
| Copy activity | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-overview | Source/sink table; Copy formats (no Delta; Iceberg ADLS Gen2 only); resume rules; one SHIR per copy | |
| Pipelines and activities | https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities | Timeout 12 h (min 10 min), retry 0, interval 30 s, 120-activity soft limit, dependency conditions | |
| Data Flow activity | https://learn.microsoft.com/en-us/azure/data-factory/control-flow-execute-data-flow-activity | Checkpoint key: GUID for new activities, old pattern for existing; "hash of data flow name and pipeline name" | Internally inconsistent (30.3) |
| Change data capture | https://learn.microsoft.com/en-us/azure/data-factory/concepts-change-data-capture | Default checkpoint tied to pipeline and activity name; rename resets; own key; debug and rerun behaviour; native CDC and auto-incremental connectors | ms.date 2025-02-13 |
| Change data capture resource | https://learn.microsoft.com/en-us/azure/data-factory/concepts-change-data-capture-resource | Still "public preview"; no SHIR; 4-core billing | |
| Integration runtime | https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime | Three types; managed VNet enables Private Link for Azure IR; managed-VNet IR uses factory region; IR precedence; SHIR "outbound HTTP only" | |
| Choose the right IR configuration | https://learn.microsoft.com/en-us/azure/data-factory/choose-the-right-integration-runtime-configuration | Comparison table (on-prem: Azure N, managed VNet Y with ExpressRoute/VPN, SHIR Y); Private Link service and load balancer; "ExpressRoute isn't mandatory"; allowlisting "not a desirable solution" | updated 2026-07-20 |
| Create a self-hosted IR | https://learn.microsoft.com/en-us/azure/data-factory/create-self-hosted-integration-runtime | Treat source as on-prem even with ExpressRoute; use SHIR for Azure IaaS VMs; up to four nodes; ports; command and data flow | ms.date 2026-06-17 |
| Managed virtual network and managed private endpoints | https://learn.microsoft.com/en-us/azure/data-factory/managed-virtual-network-private-endpoint | Definitions; same region only; can't convert an existing IR; approval workflow; custom DNS unsupported; all outbound ports open to public endpoints; TTL and billing | ms.date 2026-07-29 |
| Azure Private Link for Azure Data Factory | https://learn.microsoft.com/en-us/azure/data-factory/data-factory-private-link | Private endpoint in your VNet for portal and SHIR control traffic; public-access switch applies to SHIR only | |
| Data access strategies | https://learn.microsoft.com/en-us/azure/data-factory/data-access-strategies | Static IP ranges; trusted service wording; IP ranges not used by data flows or managed-VNet IR | Predates the Modern/Legacy split (30.3) |
| Modern mode for trusted service | https://learn.microsoft.com/en-us/azure/data-factory/modern-trusted-service | Legacy vs Modern; Legacy retires 1 Aug 2027; five affected scenarios; three replacement access patterns | ms.date 2026-07-16, updated 2026-09-22. Doesn't explain Modern's internals |
| Customer-managed key | https://learn.microsoft.com/en-us/azure/data-factory/enable-customer-managed-key | Two enable routes; empty-factory rule scope; not for managed-VNet factories (UI route); can't remove; Key Vault prerequisites; CI/CD option | ms.date 2025-04-10 |
| Continuous integration and delivery | https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery | Lifecycle note ("shouldn't" have Git); best practices list; unsupported features | ms.date 2026-07-29 |
| Automated publishing for CI/CD | https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery-improvements | `adf_publish` and the npm-package flow, "both are supported"; validate and export; Node 20.x | |
| Automate continuous integration | https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery-automate-azure-pipelines | "Deployment can fail if you try to update active triggers"; Incremental vs Complete | |
| Global parameters | https://learn.microsoft.com/en-us/azure/data-factory/author-global-parameters | ARM-template inclusion, Git-mode only; no `-` in names | |
| Create a data factory using Bicep | https://learn.microsoft.com/en-us/azure/data-factory/quickstart-create-data-factory-bicep | A Bicep quickstart exists | A quickstart, not CI/CD guidance |
| Plan to manage costs | https://learn.microsoft.com/en-us/azure/data-factory/plan-manage-costs | Three meters plus other costs; per-pipeline billing and its exceptions; the 380 DIU-hour example | Prices in the example are hypothetical |
| Data pipeline pricing | https://azure.microsoft.com/en-us/pricing/details/data-factory/data-pipeline/ | Meter categories only (read through a page summary); no prices recorded | Not a Learn page; names only |
| Azure subscription and service limits | https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits | 120 activities; 4 SHIR nodes; ForEach 100,000 items and parallelism 20/50; tumbling window 5 min; 256 DIUs; data-flow TTL 4 h; debug limits | Adjustable limits go through support |
| Lookup activity | https://learn.microsoft.com/en-us/azure/data-factory/control-flow-lookup-activity | 5,000 rows (first 5,000 returned), 4 MB (fails above), 24 h timeout | |
| ForEach activity | https://learn.microsoft.com/en-us/azure/data-factory/control-flow-for-each-activity | Batch count default 20, max 50; no nesting inside ForEach or Until; no Set Variable in a parallel ForEach | |
| Pipeline execution and triggers | https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipeline-execution-triggers | Trigger types incl. custom event; schedule vs tumbling table; DST rule; event-trigger restart behaviour | |
| Tumbling window triggers | https://learn.microsoft.com/en-us/azure/data-factory/how-to-create-tumbling-window-trigger | Max concurrency 1 to 50; retry default 0; backfill order; frequency and interval fixed after publish; one pipeline | |
| Copy performance features | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance-features | DIU 4 to 256, defaults per scenario; parallel copy; staged copy billing and delete permission | updated 2026-08-13 |
| Mapping data flow debug mode | https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-debug-mode | Debug TTL default 60 min, billed including TTL; "cold boot" with no minutes figure | |
| Mapping data flows (overview) | https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-overview | No "5–7 minutes" warm-up figure on the current page; data flows run via the Data Flow activity on an Azure IR | ms.date 2026-04-27 |
| Databricks Notebook activity | https://learn.microsoft.com/en-us/azure/data-factory/transform-data-databricks-notebook | `baseParameters`; `dbutils.notebook.exit`; `runOutput` limit 2 MB | |
| Monitor Azure Data Factory | https://learn.microsoft.com/en-us/azure/data-factory/monitor-data-factory | Run data kept 45 days; Log Analytics routing; "failed pipeline runs > 0" alert | |
| Reliability in Azure Data Factory | https://learn.microsoft.com/en-us/azure/reliability/reliability-data-factory | Idempotence; zone redundancy; tumbling-window state; paired-region failover caveats; backup = source control + CI/CD | updated 2026-10-01 |
| Differences between Data Factory in Fabric and Azure | https://learn.microsoft.com/en-us/fabric/data-factory/compare-fabric-data-factory-and-azure-data-factory | Concept map; SSIS and managed VNet "to be determined"; ~90% of activities; VNet data gateway; SHIR vs gateway table | updated 2026-09-29 |

A Microsoft Q&A thread titled "Clarification Needed: Azure Data Factory Trusted Service Retirement Date (Aug 2026 vs
Aug 2027)" appeared in a search. Only its title was seen. The Learn page above states 1 August 2027 and is what the
course follows; recheck before quoting a date.

### 30.3 Where Microsoft's pages disagree or are unclear

1. **CDC checkpoint key** (§15): pipeline+activity name (CDC concepts page) vs GUID for new activities (Data Flow
   activity page, step 3) vs hash of data flow and pipeline names (same page, "Checkpoint key" section).
2. **Self-hosted IR node limit:** "up to four nodes" (create-SHIR page; limits page lists 4 as default and maximum) vs
   "Up to 8 nodes (4 default)" (Fabric comparison page). Likewise "100 linked IRs" per SHIR (limits) vs "shared with up
   to 120 Data Factories" (Fabric page). The course says "check the current limit".
3. **Trusted service and the SHIR:** the older data-access-strategies page says a self-hosted IR is not in the
   trusted-services list; the Modern page lists a SHIR using a managed identity with the firewall exception as an
   affected legacy scenario. The course follows the Modern page.
4. **"SHIR needs no VPN" vs "need a self-hosted IR":** the Copy overview says on-prem or access-controlled networks
   "need" a SHIR; the IR-choice page and the Oracle page say a managed-VNet IR is an alternative. The course teaches
   the IR-choice page's fuller version.
5. **Automated publish and trigger handling:** "now generally available and merged into the preceding command" vs a
   sample-YAML comment still describing a `build-preview` variant.
6. **Outbound control from a managed virtual network:** documented as protecting against data exfiltration, and also
   as "all ports are opened for outbound communications" to public endpoints.

### 30.4 Other corrections found while auditing (not in the review)

- Copy activity formats listed **Delta**; it isn't a Copy format (data flows use it; Copy reaches Delta through the
  Databricks Delta Lake connector). Iceberg is **ADLS Gen2 only**.
- "Debug clusters take 5–7 minutes": **first-pass finding withdrawn in part.** The figure is not on the data flow
  overview or debug-mode pages, but Microsoft's Delta-lake and write-to-lake tutorials still state it (§31.4). The
  course wording ("several minutes", with both figures cited) stays; the claim that the figure was "no longer on the
  pages" was wrong.
- "Access can't be granted per pipeline" was stronger than Microsoft's "doesn't recommend".
- ForEach "can't be nested" also applies to nesting inside an **Until**.
- The trigger table omitted the **custom event** trigger.
- "From any of about 100 connectors to any other" was wrong in context: many connectors support only some roles.
- "A pipeline holds at most 120 activities" is a default (soft) limit.
- The SHIR "up to four nodes" figure is now flagged as volatile (item 2 above).
- The Fabric chapter now notes the VNet data gateway beside "managed VNet: to be determined".

### 30.5 Not re-verified in this audit

**Superseded by the second pass (§31), which re-fetched most of the list below.** What is still unchecked is listed in
§31.6. The first-pass list, kept for the record: taken from the 2026-09-25/26 reads and not re-fetched on 2026-10-04: the data-consistency, fault-tolerance and
type-conversion pages (§12); the migration scenario pages and their worked examples (§14); the tumbling-window
dependency page; data-flow aggregate, hash and Assert functions (§26); the copy and data-flow performance tuning pages
(§22, §28, apart from the DIU and parallel-copy features page above); the Purview and secure-your-factory pages
(§23, §27); Fabric migration paths (mount, upgrade tool) and their GA dates; the four white papers. A claim marked
"checked October 2026" in the course was re-checked in this audit; the rest carry the earlier date.

---

## 31. Second accuracy pass, 2026-10-04

**Scope.** Only what the first pass (§30.5) left unverified: scenarios 5 to 18; fault tolerance; consistency
verification; type conversion; the migration worked examples; the data-flow reconciliation functions; performance beyond
DIUs and parallel copies; Purview; claims that rest on the 2018 to 2020 white papers; Fabric migration paths. The
first-pass corrections were not reopened except where something still contradicted them.

### 31.1 Scenarios 5 to 18: what exists, and what could not be audited

Searched: `backend/app/content/packs/adf/v1.json`; the whole `prototypes/lakehouse-and-roles` tree
(`src/services/adf/units.ts`, `src/services/adf/movingData.ts`, `src/services/guides/adf.ts`, the lab components and the
Gemini review files); the three archives (`prepbench-work-backup-2026-09-27.zip`, `prototypes.zip`,
`prototypes/final-review-bundle.zip`, each unpacked and searched by content, not by file name); `docs/research/lessons`;
`docs/implementation` (the skills-and-content-packs and Lakehouse Lab plans and gate reports); `backend/app` seeds and
`frontend/src`. Searched for every scenario title and for `UNIT_5` to `UNIT_18`.

Result: the only fully written scenario content anywhere is scenarios **1 to 4** (`UNIT_1` in `units.ts`; `UNIT_2` to
`UNIT_4` in `movingData.ts`; identical to the pack). `units.ts` says so in its header ("Scenarios 1 to 4 (the 'Moving data'
level) are written; the others are planned"), and the content-packs plan says "18 scenarios, 1–4 written". The older
copies in the archives hold the same four. Therefore, for each of scenarios 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 and 18:
**this scenario could not be audited because its full learner-facing content is not present in the accessible repository.**
Nothing was invented or reconstructed.

What *is* learner-facing for them is one title, one outcome sentence, a `sources` line and a chapter link. Those were
checked against the verified facts:

| # | Outcome line | Check | Result |
|---|---|---|---|
| 5 Green runs that failed | An error handler turns a failed load green | Try-Catch and Do-If-Skip-Else show Succeeded when the main step fails; Do-If-Else shows Failed (error-handling tutorial, re-fetched) | Valid |
| 6 The skipped rows nobody read | Fault tolerance skips bad rows into a log no one owns; truncation cuts values silently | Skipping and logging are separate settings; `allowDataTruncation` defaults to true when type conversion is on | Valid; note the log exists only if enabled |
| 7 The rename that re-read everything | Rename restarts change data capture | Documented for the old key pattern; unsettled for GUID keys (§15) | Valid, qualified in the first pass |
| 8 The new column | Let it flow through, or stop the load | Allow schema drift passes new columns; **Validate schema** is what fails the flow | Valid; the guide chapter had implied "no drift = fail" and is now corrected |
| 9 (id 17) The balances that matched | Counts and totals match, rows differ | Offsetting errors hide in sums; row fingerprints needed; the functions named exist | Valid |
| 10 (id 9) The audit question | Run history gone after four months | 45 days of run data, route logs to Log Analytics | Valid |
| 11 (id 10) The bill that doubled | Debug sessions and oversized copies | Debug billed incl. TTL; DIU billed as used x duration | Valid; "doubled" is fictional |
| 12 (id 11) The password in the pipeline | Hard-coded connection string | Key Vault and managed identity are Microsoft's recommendation | Valid |
| 13 (id 18) Card numbers in the error log | Skipped rows written to a log | The log holds the row values, only if the session log is on | Valid; wording now says "with the session log on" |
| 14 (id 12) The urgent fix | Dev holds half-finished work | Publishing includes everything; hotfix route | Valid |
| 15 (id 13) The 1,000 tables that vanished | 6,000-entry control table vs Lookup | Lookup returns the first 5,000 rows, no error | Valid |
| 16 (id 14) Cutover in three weeks | 80 TB, 1 Gbps | The duration table gives about 0.9 days per 10 TB at 1 Gbps (about 8 days for 80 TB, if fully tuned); two-week online rule of thumb | Valid arithmetic |
| 17 (id 15) The count Databricks sent back | Notebook result checked before moving on | `runOutput`, 2 MB limit | Valid |
| 18 (id 16) ADF or Fabric? | Should new pipelines be built in ADF | Comparison and upgrade pages | Valid |

The four written scenarios were re-read only for statements that touch the uncovered material. One was wrong: scenario 4's
engineering-manager debrief applied the schedule-trigger daylight-saving rule to a tumbling window (fixed, §31.2 F-19).

### 31.2 Findings

| ID | Claim in the course | Verdict | What the page says, and the change |
|---|---|---|---|
| F-01 | Fault tolerance "skips bad rows" (no limits stated) | **Incomplete** | The page says it doesn't apply to Synapse PolyBase loads, Redshift UNLOAD, stored-procedure SQL sinks or Upsert into a SQL sink. Added. |
| F-02 | Skips "a duplicate key" | **Partly correct** | A primary-key violation is a skip case only when writing to SQL Server, Azure SQL Database or Cosmos DB. Qualified. |
| F-03 | Rows are logged "with the reason, to a session log" | **Partly correct** | Skipping (`enableSkipIncompatibleRow`) and logging (`enableCopyActivityLog`, off by default) are separate. Without the log, only counts. Added; recovery table, security leak list and a pitfall now say so. |
| F-04 | The log shows the row's real data | **Correct** | The example log's `OperationItem` is the row. Kept; "when the session log is on" added. |
| F-05 | Default is to fail on the first bad row | **Correct (a gloss)** | The page says the copy aborts on failure by default. Kept. |
| F-06 | Consistency check uses "a checksum" | **Correct, notes overstated** | Block-level checksum for Blob/ADLS Gen2, file-level MD5 only when the source carries ContentMD5. The notes' "MD5 per file" was corrected; the course's wording stands, with detail added. |
| F-07 | "Verified" for a table means counts add up | **Correct** | Preserved. The page describes a row-count check; "never compares values" is an inference and is worded as one. |
| F-08 | (silent on unsupported cases) | **Omission** | `Unsupported` and `NotVerified` results, the connector exclusions (FTP, SFTP, HTTP, Snowflake, Office 365, Delta Lake), no staged copy, `PreserveHierarchy` for binary. Added, with a pitfall. |
| F-09 | Type conversion on by default "since late June 2020" | **Correct, and kept** | The page still says it (ms.date 2026-08-06). Kept only to explain old-vs-new behaviour; added that activities from before the feature don't show the options. |
| F-10 | "An If version of each" aggregate | **Incorrect** | `countDistinct` and `approxDistinctCount` have none. Fixed. Also "empty values" for `countAll` is "null values". |
| F-11 | "No median or percentile function exists" | **Correct (as of this check)** | Zero hits on the function reference; worded "checked October 2026". |
| F-12 | md5, sha1, sha2, crc32, nTile, Assert types, isError, hasError | **Correct, all exist** | Added: crc32 is a short checksum; hashes only compare if both sides are normalised the same way. |
| F-13 | Data-flow reconciliation against any source | **Incomplete** | Oracle, Teradata and Netezza aren't data-flow sources; land the data first. Added. |
| F-14 | Schema drift off means "the load fails" | **Incorrect** | Without it, columns outside the projection aren't picked up; **Validate schema** is what fails the flow. Rewritten. |
| F-15 | "Microsoft's tutorial and its template connect it to success" | **Partly unsupported** | Tutorial step 30 says so; the template page doesn't name the exit. Course, lesson doc and notes now cite the tutorial. |
| F-16 | The three incremental patterns | **Reclassified** | They come from the 2020 SAP white paper. Current docs list others too. Labelled "recommended practice, from a white paper". |
| F-17 | HDFS: partition above 10 TB | **Context-dependent** | That advice is for native IR mode. Scoped. |
| F-18 | Worked example "took about 146 hours" | **Misleading** | The page says hypothetical ("assume"). Now "would take", with a course note. |
| F-19 | Scenario 4: "Use UTC: hourly schedules don't shift... daily ones do" for a tumbling window | **Misapplied** | The DST rule is documented for schedule triggers. Rewritten. |
| F-20 | "Connect ADF to Purview to discover and classify" | **Overbroad** | ADF pushes runtime lineage for three activity types and a subset of stores; classification comes from Purview scans. Qualified, with a new block. Note: Microsoft's ADF security page uses the same shorthand. |
| F-21 | "Dataflow Gen2: a different engine" | **Outdated in part** | Microsoft documents Spark-based MDF transforms in Gen2 (preview). Qualified. |
| F-22 | "Mount generally available since May 2025"; "pipelines GA March 2026" | **Unverifiable** | Not on the pages checked. Removed from the course. |
| F-23 | "ADF is built for moving..." (migration) | **Overstated** | The page says "well-suited". Reworded. |
| F-24 | Performance: duration table, tuning order, stage advice, cluster sizes, shuffle partitions, TTL, logging level | **Correct** | Table values match. Added: it is an estimate that assumes tuning and many concurrent copies; start from defaults; more shuffle partitions don't fix skew; Microsoft's drop-the-indexes advice should be weighed; "document per line" JSON in data flows uses little memory; key-partitioned folders have a small write cost. |
| F-25 | Debug "5 to 7 minutes" | **First-pass finding withdrawn in part** | See 31.4. |

Confirmed correct and left alone: Lookup and ForEach limits; the error-handling table; copy resume rules; the SHIR resilience
and the cluster-size table; the DIU and parallel-copy guidance (first pass); the migration SHIR sizing (D32s_v3, two nodes for
HA on the HDFS and S3 pages, four on the Netezza page); the 100 GB / two-hour table split for Netezza; data flow sink naming
("name file as column data" needs a single partition); Delta write via Alter Row and key columns; the Purview Data Curator role.

### 31.3 White-paper-derived claims (classification)

| White paper | Claim in the course | Classification |
|---|---|---|
| Data Integration in the Cloud (2018) | The Oracle plus Salesforce, lake, Spark, warehouse, Power BI journey; email on failure | **Still-current concept; historical example.** Product names have moved (SQL DW is now a Synapse dedicated SQL pool, per the Purview page). Labelled as a 2018 illustration. |
| SAP data integration (2020) | Three incremental-load patterns | **Still-current concept**, partly echoed by the Copy Data tool note on the delta-template page. Labelled as a white-paper heuristic, not a product rule. |
| Passing parameters (2019) | (Naming conventions and dataset parameter passing: not in the pack) | No change. |
| DevOps (2019) | Approvals, one parameter file per environment, requester doesn't approve | **Historical practice, still sensible**; the first pass already labelled the approval point as recommended practice. |

### 31.4 Correction to the first pass

The first pass said the "5 to 7 minutes" data-flow warm-up figure was not on any current page. That was too strong. It is
not on the overview or debug-mode pages, but Microsoft's *Delta lake ETL with data flows* and *Best practices for writing
to files to data lake* tutorials still say "Data Flow clusters take 5-7 minutes to warm up". The performance guide says a
job cluster "generally takes 3-5 minutes" and the IR performance page says "a few minutes". The course now says "several
minutes" and gives both figures with their sources. §17 and §30.4 above were corrected the same way.

### 31.5 Pages checked in the second pass (all fetched 2026-10-04)

| Microsoft page | URL | What was verified | Qualification |
|---|---|---|---|
| Fault tolerance of copy activity | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-fault-tolerance | Scenarios, sink exclusions, defaults, log schema and example | ms.date 2024-09-26 |
| Data consistency verification | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-data-consistency | What is checked, unsupported cases, result values | ms.date 2025-10-29 |
| Schema and data type mapping | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-schema-and-type-mapping | `typeConversion`, `allowDataTruncation`, June 2020 wording, default mapping | ms.date 2026-08-06 |
| Session log in a Copy activity | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-log | Log is opt-in; levels; what is logged | |
| Migrate from on-premises Hadoop | https://learn.microsoft.com/en-us/azure/data-factory/data-migration-guidance-hdfs-azure-storage | DistCp vs native; 10 TB; sizing; example | Hypothetical example |
| Migrate from Netezza | https://learn.microsoft.com/en-us/azure/data-factory/data-migration-guidance-netezza-azure-sqldw | 100 GB / two-hour rule; example | Hypothetical example |
| Migrate from Amazon S3 | https://learn.microsoft.com/en-us/azure/data-factory/data-migration-guidance-s3-azure-storage | 100 TB partitioning; example | Contains a typo ("1 KB partitions") |
| Migrate data lake and warehouse (overview) | https://learn.microsoft.com/en-us/azure/data-factory/data-migration-guidance-overview | "well-suited"; petabytes and tens of terabytes; two-week example | |
| Copy performance and scalability guide | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance | Duration table, tuning steps | ms.date 2025-07-25 |
| Troubleshoot copy performance | https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance-troubleshooting | Stages, tuning tips, SQL, Excel/XML/JSON memory | |
| Mapping data flow performance guide | https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-performance | 3-5 minute start-up; partitioning; logging | |
| Integration runtime performance | https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime-performance | Cluster sizes; shuffle partitions; TTL | updated 2025-03-31 |
| Aggregate functions | https://learn.microsoft.com/en-us/azure/data-factory/data-flow-aggregate-functions | The full aggregate list | |
| Assert transformation | https://learn.microsoft.com/en-us/azure/data-factory/data-flow-assert | Assert types, fail option, error rows | |
| All data flow functions | https://learn.microsoft.com/en-us/azure/data-factory/data-flow-expressions-usage | md5, sha1, sha2, crc32, nTile, isError, hasError; no median | |
| Source transformation | https://learn.microsoft.com/en-us/azure/data-factory/data-flow-source | Validate schema; supported source list | updated 2026-04-28 |
| Schema drift | https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-schema-drift | Late binding; drifted columns are strings unless inferred | |
| Writing to the lake with data flows | https://learn.microsoft.com/en-us/azure/data-factory/tutorial-data-flow-write-to-lake | Partitioning styles; single partition; "5-7 minutes" | |
| Delta lake ETL with data flows | https://learn.microsoft.com/en-us/azure/data-factory/tutorial-data-flow-delta-lake | Inline Delta, Alter Row, key columns; "5-7 minutes" | |
| Pipeline failure and error handling | https://learn.microsoft.com/en-us/azure/data-factory/tutorial-pipeline-failure-error-handling | Leaf rule; the three patterns; Upon Completion restriction | |
| Incremental copy overview | https://learn.microsoft.com/en-us/azure/data-factory/tutorial-incremental-copy-overview | Watermark, Change Tracking, LastModifiedDate, partitioned names | |
| Incremental copy tutorial (portal) | https://learn.microsoft.com/en-us/azure/data-factory/tutorial-incremental-copy-portal | Step 30: Success output to the Stored Procedure | |
| Delta copy template | https://learn.microsoft.com/en-us/azure/data-factory/solution-template-delta-copy-with-control-table | Four activities; Copy Data tool alternative; exit not stated | |
| Bulk copy template | https://learn.microsoft.com/en-us/azure/data-factory/solution-template-bulk-copy-with-control-table | Control table columns; Lookup, ForEach, Copy | |
| Introduction to Azure Data Factory | https://learn.microsoft.com/en-us/azure/data-factory/introduction | Gaming example; four stages | ms.date 2026-06-17 |
| Connect a Data Factory to Microsoft Purview | https://learn.microsoft.com/en-us/azure/data-factory/connect-data-factory-to-azure-purview | Roles; lineage push; catalog search | |
| Connect Azure Data Factory to Microsoft Purview (Purview side) | https://learn.microsoft.com/en-us/purview/data-map-lineage-azure-data-factory | Supported activities and stores; limitations | ms.date 2026-02-24 |
| Secure your Azure Data Factory deployment | https://learn.microsoft.com/en-us/azure/data-factory/secure-your-azure-data-factory | What ADF stores; Purview shorthand; Git on dev only | updated 2026-09-02 |
| Upgrade planning, ADF to Fabric Data Factory | https://learn.microsoft.com/en-us/fabric/data-factory/upgrade-planning-azure-data-factory | Upgrade paths; status labels; MDF transforms in Gen2 (preview) | Fetched via the older `migrate-planning-...` URL, which redirects |

### 31.6 Still not checked

Individual connector pages; the full text of the four white papers (only their claims, through current pages); the
tumbling-window dependency page; Databricks Job activity; Execute Pipeline, Web, Webhook and Script activity pages; the
Purview "classic" lineage guides; the prototype's older `guides/adf.ts`, which is not shipped; the text of scenarios 5 to 18
(does not exist, §31.1). Fabric "mount" and "pipelines" GA dates remain unverified and are not in the course.

---

## Coverage log

| Area | Pages read | Notes |
|---|---|---|
| Landing page | index | 25 links listed; the ones below read in full |
| Overview | introduction | §1 |
| Concepts | pipelines-activities, pipeline-execution-triggers, linked-services, datasets, integration-runtime, parameters-variables, choose-the-right-integration-runtime-configuration | §2–§8 |
| Triggers | how-to-create-tumbling-window-trigger, how-to-create-event-trigger | §9 |
| Monitor | monitor-visually, tutorial-pipeline-failure-error-handling | §10 |
| Move data | copy-activity-overview, copy-activity-fault-tolerance, copy-activity-data-consistency, copy-activity-schema-and-type-mapping | §11–§12 |
| Tutorials | tutorial-incremental-copy-overview, tutorial-incremental-copy-portal | §13 |
| Scenarios | data-migration-guidance-overview, -hdfs-azure-storage, -netezza-azure-sqldw, -s3-azure-storage | §14 |
| CDC | concepts-change-data-capture, concepts-change-data-capture-resource | §15 |
| Self-hosted IR | create-self-hosted-integration-runtime | §16 |
| Transform | concepts-data-flow-overview, concepts-data-flow-schema-drift, tutorial-data-flow-delta-lake, tutorial-data-flow-write-to-lake | §17 |
| White papers | all four, read as the original PDFs | §18 |
| CI/CD | continuous-integration-delivery | §19 |
| Control flow | control-flow-lookup-activity, control-flow-for-each-activity, transform-data-databricks-notebook, subscription limits (ADF section) | §20 |
| Templates | solution-template-delta-copy-with-control-table, solution-template-bulk-copy-with-control-table | §21 |
| Performance | copy-activity-performance, copy-activity-performance-troubleshooting | §22 |
| Security / cost / monitor / lineage | data-movement-security-considerations, plan-manage-costs, monitor-data-factory, connect-data-factory-to-azure-purview, frequently-asked-questions | §23 |
| Fabric | compare-fabric-data-factory-and-azure-data-factory, migrate-planning-azure-data-factory | §24 |
| Connectors, what's new, hybrid tutorial | connector-overview, whats-new, tutorial-hybrid-copy-portal | §25, §24; the tutorial matches §16 |
| Reconciliation (added 2026-09-26) | data-flow-aggregate-functions, data-flow-expressions-usage (hash, window, columns functions), data-flow-assert, copy-activity-log | §26 |
| Sensitive data (added 2026-09-26) | secure-your-azure-data-factory, enable-customer-managed-key, solution-template-pii-detection-and-masking, copy-activity-fault-tolerance (session log contents), SecureInputOutputPolicy reference | §27 |
| Fine-tuning (added 2026-09-26) | copy-activity-performance-features, copy-activity-performance-troubleshooting (re-read in full), concepts-data-flow-performance, concepts-integration-runtime-performance | §28 |
| Recovery (added 2026-09-26) | reliability-data-factory (Azure reliability docs), copy-activity-overview (resume section, re-read) | §29 |
| Accuracy audit (added 2026-10-04) | The 34 pages listed in §30.2 | §30; corrections marked "(Corrected 2026-10-04)" in §6, §8, §15, §16, §17, §19, §20, §23, §24, §25, §27 |
| Second accuracy pass (added 2026-10-04) | The 29 pages listed in §31.5 | §31; further corrections in §12, §13, §14, §17, §23, §24, §26, §27 and in the Unit 1 lesson |

**Not read, on purpose:**
- **Individual connector pages** (about 100). They're reference pages for configuring one source each; only SAP was
  covered, through its white paper.
- **The expression-language function reference.** It's a lookup list, not concepts.
- **SDK, PowerShell and REST quickstarts.**
- **Most of the SSIS lift-and-shift section.** It only matters for teams moving SSIS packages.
- **Airflow in ADF, Power Query wrangling (deprecated), and the U-SQL / HDInsight activities.** These are legacy or
  niche.
- **Individual troubleshooting guides**, apart from copy performance.

**Checked but not deep-dived:** the quickstart (Copy Data tool), pricing (the prices live on the Azure pricing page,
not in the docs; the meters are in §23), and REST connector specifics.

Two WebFetch summaries in this walkthrough were wrong, so every figure above was checked against the page text or the
PDF itself.
