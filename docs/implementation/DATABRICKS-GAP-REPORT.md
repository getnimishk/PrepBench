# Databricks in PrepBench: what we have, what's missing, what to build

**Date:** 2026-10-29. **Status:** proposal, waiting for the learner's decisions (section 7). Nothing here is built yet.
**Research behind it:** `docs/research/databricks-documentation-notes.md` (22 sections, every fact from an official
Databricks, Microsoft, Delta Lake or Apache Spark page read on 2026-10-29, plus both current exam guides read in full).

This is written for you, the learner. It says what PrepBench already gives you for Databricks, what it doesn't, and what
I propose to add, in the same way the Kafka track was built (study guide, scenarios, question bank, lab, interview
practice). You don't need to check any technical claim here; the research file cites a source for each one, and the
material built from it will be held to those sources by tests.

---

## 1. The certification question first

Databricks has two data engineering exams. Both were revised this year.

| | **Data Engineer Associate** | **Data Engineer Professional** |
|---|---|---|
| Guide date | Exam published 4 May 2026; guide updated 6 Aug 2026 | Exam and guide 9 Oct 2026 |
| Questions / time | 45 scored multiple-choice (+ up to 10 unscored) / 90 min | 60 scored multiple-choice (+ unscored) / 120 min |
| Fee, validity | USD 200; 2 years | USD 200; 2 years |
| Recommended experience | 6 months hands-on | 1 year hands-on |
| Sections (weight) | Platform 6% · Ingestion and loading 21% · Transformation and modelling 22% · Lakeflow Jobs 16% · CI/CD 10% · Troubleshooting, monitoring, optimisation 10% · Governance and security 15% | Python and SQL code 23% · Ingestion 12% · Data manipulation 12% · Monitoring and alerting 10% · Cost and performance 15% · Security and compliance 8% · Governance 5% · Debugging and deploying 10% · Data modelling 5% |
| Pass mark | **Not published** | **Not published** |

**My recommendation: the Data Engineer Associate.** Databricks describes it as covering "introductory data engineering
tasks", it asks for six months of experience, and its sections (Delta Lake, Unity Catalog, ingestion, jobs, governance,
cost of compute) are exactly what a PO, PM, delivery manager or cloud engineering manager on a Databricks/Azure
platform has to speak about with confidence. The Professional is a sensible second step later; it goes deep into
streaming state, UDFs, testing, system tables and performance tuning. Databricks also offers free "Databricks
Fundamentals" training with a badge, but it is not a certification exam.

Things worth knowing before you choose:

- Neither exam publishes a pass mark. PrepBench will show "No pass mark set" rather than invent one (third-party sites
  claim 70% for the Associate; nothing official says so).
- The Professional exam's web page and its guide disagree (59 vs 60 questions, ten vs nine sections). The guide is newer,
  so anything built for the Professional would follow the guide.
- The Associate guide asks about "GRANT, REVOKE, and DENY" in Unity Catalog. The current documentation has no `DENY`
  statement in Unity Catalog SQL (it exists in the old Hive metastore model, and as a Beta "ABAC DENY policy"). The
  material will teach what the documentation says and point out the difference, so the exam wording doesn't trip you.
- Databricks renamed a lot in 2025-26 (Delta Live Tables → Lakeflow Spark Declarative Pipelines; Databricks Asset
  Bundles → Declarative Automation Bundles; Delta Sharing → OpenSharing). The exam uses the new names; older courses and
  your ChatGPT-era notes may use the old ones. The guide gives both.

## 2. What PrepBench has for Databricks today

- **A "Databricks Data Platform" preparation** (slug `databricks`), a **skill** with no certification and no questions.
- **The ADLS Gen2 study guide** (pack `adls`, 11 chapters) is attached to it. Useful background (storage, ACLs, how Spark
  reaches the lake), but not Databricks itself.
- **A roadmap:** the preparation owns roadmap 3, the "Storage FileSystems to Cloud Mastery Roadmap" (13 phases, 63
  topics). It is about storage and cloud in general; there is **no Databricks roadmap**.
- **The Lakehouse Lab** (`/databricks-sandbox`), six stations over a fictional semiconductor migration:
  - **A** — ADF + Lakeflow Jobs as a step list (simulation): watermark ordering, what a pipeline run does.
  - **B** — ADLS landing zone (simulation): where batches land and who can touch them.
  - **C** — Delta Lake, "the load that went wrong", on a **real Delta engine**: create, schema enforcement failure, schema
    evolution, MERGE of a CDC batch, history, time travel, restore, compaction (with optional Z-order), vacuum, and a
    table comparison that catches value drift row counts miss.
  - **D** — Reconciliation Detective: find planted defects between legacy and migrated tables.
  - **F** — Migration Factory: planning and cutting over migration waves (programme management).
  - **I** — Identity and governance: Kerberos/Entra trust paths and turning Ranger policies into Unity Catalog grants or
    ABAC (simulation).
- **Interview practice from the lab:** each station can turn your own results into an interview question (P1-1), and
  AI feedback on acceptance criteria (P1-6).
- **Not present:** a Databricks study guide, Databricks scenarios, a certification preparation, a question bank, a
  Databricks roadmap, diagrams of Databricks mechanisms.

## 3. The gaps, item by item

| Item | PrepBench today | Missing | Proposal |
|---|---|---|---|
| **Roadmap** | Roadmap 3 "Storage FileSystems to Cloud Mastery" (generic storage/cloud) | Any Databricks roadmap; topics in the exam's order | A **Databricks roadmap workbook** (`.xlsx`, the same 4-tab format as your Kafka and ADF roadmaps) **drafted for review: `docs/research/Databricks_Data_Engineering_Mastery_Roadmap.xlsx`**, 108 topics in 13 phases (254 estimated hours), including Parquet (6 topics) and Delta Lake internals (9 topics: commit files, log actions, snapshots and tombstones, checkpoints, optimistic concurrency, isolation, protocol and table features, idempotent writes). It also has an optional Azure networking phase (8 topics), a production and troubleshooting phase (17 topics: running streams in production, stateful streaming, notifications and alerts, failed-job troubleshooting, error families, query profile, compute start-up failures, libraries and init scripts, runtime lifecycle, environment isolation, encryption keys, HA and disaster recovery, testing) and an **Error Catalogue** sheet of 35 real error conditions and platform errors with cause, fix and the topic that teaches each, and every topic of your two earlier Databricks roadmaps was compared with it (`docs/implementation/DATABRICKS-ROADMAP-COMPARISON.md`). Each topic names its guide chapter and the research-notes section it rests on; its import into PrepBench was checked against a scratch database (13 phases, 108 topics, progress sheet matched, all five sheets kept). **You import it** on the Roadmaps screen and assign it to the Databricks skill; nothing is loaded from code. Roadmap 3 stays where it is unless you unlink it. |
| **Study guide** | ADLS guide only | Databricks itself | Pack **`databricks`** v1: about **24 chapters** written as Markdown and built into the pack like the Kafka guide, covering every Associate objective (list in section 4). Every fact cites the research notes; a test fails on an uncited section, a table not last in its section, or a deprecated name used as current. **Hands-on steps for Databricks Free Edition** in each chapter where Free Edition can do it (notebooks, Unity Catalog objects and grants, Delta operations, Auto Loader with `availableNow`, `COPY INTO`, a declarative pipeline with expectations, a multi-task job, a SQL warehouse). What Free Edition can't do (classic clusters, pools, policies, spot instances, account-level identity, Azure storage credentials) is taught from the docs and marked "read, not run". |
| **Diagrams** | None for Databricks | Pictures of the key mechanisms | Redrawn, theme-aware, Large-text-safe figures (inline SVG or Mermaid, per `docs/wiki/Importing-Content.md`): a **Parquet file** (row groups, column chunks, pages, footer), the **Delta transaction log** (versions, add/remove, snapshot, what VACUUM deletes), the **medallion flow**, the **Unity Catalog hierarchy and privilege inheritance**, **managed vs external** tables on DROP, **Auto Loader + checkpoint** (offsets, commits, state, RocksDB file tracking), **streaming table vs materialized view**, a **Lakeflow Job DAG** with Run-if conditions and repair, **control plane vs compute plane on Azure**, **shuffle, skew and salting**. |
| **Scenarios with Say-it questions** | None for Databricks | Written cases in your roles' voice | Pack **`databricks`** v2 adds **18 written scenarios** in four levels, in the Kafka/ADF format (check questions, case study, debrief, takeaway, honesty note, and a **lens plus a Say-it question for each of PO, PM, delivery manager and engineering manager**). Examples: the vacuum that broke a regulator's time-travel query; the MERGE that failed on duplicate source keys; Auto Loader stopping on a new column; a full refresh that wiped a streaming table's history; a job repair that loaded a batch twice; the external table whose files survived DROP; the skewed join AQE did fix and the skewed `groupBy` it didn't; the all-purpose cluster bill for nightly jobs; the grant that worked for the table owner but not for analysts (missing `USE SCHEMA`). Your saved answers become interview questions, as with ADF and Kafka. |
| **Certification question bank** | None (0 questions) | A bank to the exam's weights | A bundled bank you import on the Question Bank screen, built from one source file per section (as CCDAK). **300 questions** sized by the Associate's weights: Platform 18 · Ingestion 63 · Transformation 66 · Jobs 48 · CI/CD 30 · Troubleshooting 30 · Governance 45. The CCDAK tests reused from day one: import validator clean, at least four options, a cited source on every question, section counts, right answers spread across positions, the right answer rarely the longest option (checked per section from the first draft), an out-of-scope list, and SQL used for code where possible (as the exam does). Built in parts with a **delta file** for each part after the first, so an earlier import isn't duplicated. Nothing about a pass mark. |
| **Lab** | Stations A, B, C, D, F, I (see section 2) | Exam topics no station touches | See section 5. In short: keep the stations; add **six beginner experiments** on the shared lab runner (the Kafka Lab pattern): the Delta log and retention; Auto Loader and checkpoints; streaming tables vs materialized views; a job DAG with Run-if, retries, timeout and repair; shuffle, skew and AQE; Unity Catalog privileges and managed/external tables. All teaching simulations, labelled so, graded only from your own runs. |
| **Interview material** | Station-generated questions; the shared interview library | Databricks questions in your roles | From the scenarios (72 Say-it questions: 18 × 4 roles), the lab experiments (one question per experiment from your own run, as Kafka Lab does), and a short **"explain it to a stakeholder"** prompt at the end of each guide chapter. No AI grading without a configured provider ("Not Graded" otherwise). |

## 4. What the study guide would cover (draft chapter list)

Ordered as you'd learn it, each chapter tagged with the Associate section(s) it serves.

1. What the lakehouse is, and where Databricks sits on Azure (control plane, compute plane, account, workspace, metastore) — §1
2. Parquet, the columnar file underneath: row groups, column chunks, pages, the footer and its statistics, encodings and compression, why columnar reads are cheap, Hive-style partitioning and small files — background (the exam names no Parquet objective, but Delta, data skipping and file layout rest on it)
3. Delta Lake: Parquet plus a transaction log — §1, §7
4. Versions, history, time travel, RESTORE, VACUUM and retention — §1, §6
5. Schemas: enforcement and evolution — §2, §3
6. MERGE, deduplication and change data feed — §3
7. Data layout: liquid clustering, Z-order, data skipping, deletion vectors, predictive optimization — §6
8. Unity Catalog: catalogs, schemas, tables, volumes, the metastore — §1, §7
9. Managed and external tables, external locations, Azure storage credentials (Access Connector) — §7
10. Privileges and inheritance; row filters, column masks, ABAC, dynamic views; lineage — §7
11. Compute and cost: serverless, classic, job vs all-purpose, SQL warehouses, policies, pools, DBUs — §1
12. Spark essentials for the exam: DataFrames, joins, unions, explode, dedup, aggregates — §3
13. Cleaning bronze into silver; the medallion architecture; gold objects (views, MVs, streaming tables) — §3
14. Ingestion choices: Lakeflow Connect, `COPY INTO`, Auto Loader, JDBC/REST — §2
15. Auto Loader in depth: file detection, schema inference, rescued data, evolution modes — §2
16. Structured Streaming: checkpoints, triggers, watermarks, output modes, `foreachBatch` — §2, §3
17. Lakeflow Spark Declarative Pipelines: streaming tables, materialized views, expectations, AUTO CDC, refreshes — §3, §4
18. Lakeflow Jobs: tasks, DAG, Run-if, If/else, For each, retries, timeouts, triggers, repair — §4, §6
19. Performance: AQE, broadcast, shuffle partitions, skew, spill, the Spark UI, the disk cache — §3, §6
20. Monitoring: job run history, pipeline event log, system tables, cost attribution — §6
21. CI/CD: Git folders, Declarative Automation Bundles, the Databricks CLI, secrets — §5
22. Databricks with ADF and ADLS: who orchestrates what, passing parameters, migration lessons (links to your ADF and ADLS guides) — background
23. Azure networking for Databricks: the three network connections, serverless vs hybrid workspaces, VNet injection and subnet sizing, NSG rules, secure cluster connectivity and NAT egress, the three kinds of Private Link, browser authentication, serverless connectivity and storage firewalls (Free Edition can't do these: "read, not run") — background, optional
24. Production and troubleshooting: running streams in production, stateful streaming, notifications and SQL alerts, troubleshooting a failed job, reading error conditions and the error families (writes and MERGE, concurrency, streaming, files and retention), query profile, compute start-up failures, libraries and init scripts, runtime lifecycle, environment isolation, encryption keys, HA and DR, testing — §4, §6

## 5. The lab: what the stations teach versus the exam

| Associate section | Covered by an existing station | Not covered | Proposed experiment |
|---|---|---|---|
| 1 Platform (6%) | C (Delta basics) | Compute choice and cost | Folded into experiment 6's cost note; mostly guide + scenarios |
| 2 Ingestion (21%) | A (pipeline run order, watermark), B (landing) | Auto Loader, checkpoints, schema evolution modes, `COPY INTO` idempotency | **E2 Auto Loader and checkpoints**: drop files, predict what a run ingests, add a column, see `addNewColumns` stop and restart, `rescue` keep going; replay a file and see it skipped; delete the checkpoint and see everything re-read |
| 3 Transformation (22%) | C (MERGE, enforcement, evolution), D (data quality by reconciliation) | Streaming table vs MV, expectations, union/join traps, skew | **E3 Streaming table vs materialized view**: change the query, update a dimension, full refresh; **E5 Shuffle, skew and AQE**: a hot key in a join vs a `groupBy`, broadcast threshold, salting |
| 4 Jobs (16%) | A (a step list) | Run-if conditions, retries, timeout, triggers, repair duplicates | **E4 Job DAG**: build a 4-task DAG, set Run-if, retries and a timeout, fail a task, repair, and watch an append-only task duplicate rows |
| 5 CI/CD (10%) | — | Bundles, targets, variables | Guide + scenarios only (a simulated deploy adds little) |
| 6 Troubleshooting (10%) | C (compaction, Z-order) | Liquid clustering, predictive optimization, spill/skew diagnosis | E5 above; **E1 Delta log and retention** includes liquid clustering vs Z-order as a layout choice |
| 7 Governance (15%) | I (Ranger → Unity Catalog grants/ABAC) | `USE CATALOG`/`USE SCHEMA`/`SELECT` chain, inheritance to future tables, managed vs external on DROP | **E6 Unity Catalog privileges**: grant at catalog/schema/table, predict who can read; drop a managed vs an external table and see what happens to the files |
| (all) | — | How the log makes time travel and VACUUM work | **E1 Delta log and retention**: commits as JSON versions, add/remove files, time travel, VACUUM with 7-day vs shorter retention, RESTORE seen by a downstream stream as new data |

Rules these follow (from the existing Lakehouse Lab and the Kafka Lab contract): pure models, a picture of the state, a
predict-before-you-see step, graded only from your own run, every fact coupling citing the research notes and its guide
chapter, and every screen saying it is a **teaching simulation, not a Databricks workspace**. Station C's real Delta
engine stays the place where Delta operations run for real; whether it can also show liquid clustering is a question to
check in the engine before promising it.

**Open choice for later (not needed now):** these six could live as new Lakehouse Lab experiments under
`/databricks-sandbox`, or as their own "Databricks Lab" at `/lab/databricks` on the shared runner like the Kafka Lab. I
lean to the shared runner (it is the newer, tested pattern) with links from the Lakehouse Lab hub.

## 6. The learning journey

```mermaid
flowchart LR
  R["Roadmap<br/>Databricks topics in exam order<br/>(you import it)"] --> G["Study guide<br/>24 chapters, diagrams,<br/>Free Edition steps"]
  G --> P["Practice<br/>scenario checks,<br/>question bank drills"]
  P --> L["Lab<br/>predict, run, explain<br/>(teaching simulation)"]
  L --> D["Demonstration<br/>explain it in your role;<br/>mock exam for the cert"]
  D -->|"next topic"| R
  P -. "a miss names the chapter" .-> G
  L -. "your result becomes an interview question" .-> D
```

Same rule as everywhere else in PrepBench: practice and lab runs change a topic's recommended next step and name each
miss, but only a demonstration completes a topic; readiness for the exam comes only from full mock exams.

## 7. Decisions I need from you

1. **Which certification?** My recommendation is the **Data Engineer Associate** now, the Professional later (or never).
2. **Does the certification become its own preparation?** I recommend **yes**, as CCDAK is separate from the Kafka skill:
   a "Databricks Data Engineer Associate" certification preparation (45 questions, 90 minutes, no pass mark set) that
   holds the question bank and mock exams, while the **Databricks skill** keeps the study guide, scenarios, lab and
   roadmap (packs attach only to skills, the settled D1). You would create or confirm it on the Preparations screen.
3. **Order of building** (one PR each). My proposal:
   1. Roadmap workbook (drafted; your review comes first, then you import it)
   2. Study guide v1 with diagrams and Free Edition steps (built 2026-10-29: pack `databricks` v1, 24 chapters)
   3. Question bank, part 1 (the heaviest sections: Ingestion, Transformation, Governance — 174 questions) (built 2026-10-29: bank `dbdea`)
   4. Scenarios (pack v2) with Say-it questions
   5. Question bank, part 2 (Platform, Jobs, CI/CD, Troubleshooting — 126, with a delta file)
   6. Lab experiments
4. **Roadmap 3** ("Storage FileSystems to Cloud Mastery") stays on the Databricks skill unless you choose to unlink it.
   That's your action on the Roadmaps screen; I won't change it from code.

Once you've answered, I'll start with the first piece in the order you pick.
