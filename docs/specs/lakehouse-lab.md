# Lakehouse Lab — PRD

**Status:** Draft for review · **Date:** 2026-09-24 · **Owner:** Nimish Kanungo · **System design:** [lakehouse-lab-design.md](lakehouse-lab-design.md)
**Where it lives:** Learning Lab (`/lab`) → `/databricks-sandbox`. This is the "Databricks architecture" domain that `docs/wiki/Chart-Sandbox.md` already lists as next. It takes over the existing placeholder card in `LearningLabPage.tsx` (`path: '/databricks-sandbox'`, `live: false`), and it follows the top-level route convention set by `/chart-sandbox`. The nav key is `'databricks-sandbox'`, as `navigation.ts` already anticipates. It's wired in using the `add-learning-lab-sandbox` skill.

---

## 1. Problem statement

People moving into **Technical Product Owner roles on data platform and migration work** get probed on two levels:
- **The pipeline:** Azure Data Factory, ADLS, Delta Lake. Why incremental over full load? What happens to the table when a load fails halfway? How do you roll back?
- **The program:** how you'd estimate, sequence and de-risk a migration of thousands of jobs.

Many candidates, the author included, are strong on PO craft but thin on platform depth. Today they learn it from vendor docs and videos. That gives them vocabulary, but not the cause-and-effect understanding that survives a follow-up "why?". It also leaves them with nothing they can honestly say they've *done*.

The program level matters most. Migrations like Hadoop → Databricks rarely fail on code conversion, which is largely mechanical. They fail on three patterns:
1. **Estimating by job count instead of job complexity.**
2. **Treating identity and governance redesign as a subtask** rather than its own workstream.
3. **Nobody owning the map of downstream consumers.**

A candidate who can reason about these from experience, even simulated experience, answers the questions that decide PO interviews.

What it costs to leave this unsolved: the candidate fails the technical round of roles like JD-PO-005 (Databricks + Azure + Data Migration PO), or overclaims hands-on experience and gets caught.

## 2. Goals

1. **Understanding:** a learner who finishes the Lab can answer 8 of 10 questions from a fixed diagnostic set with confidence. The set covers both levels: ADF, ADLS and Delta, *and* wave planning, identity and consumers. The same set is taken before and after, and each answer is recorded in the interview studio and self-rated.
2. **Honest hands-on claim:** every learner who installs the optional engine leaves with a Lab journal of **real** Delta Lake operations they ran (write, schema enforcement, MERGE, time travel, restore, compaction), each labelled as run on the real engine.
3. **Bridge to the real platform:** every Delta exercise exports as a Databricks notebook that has been verified to run on Databricks Free Edition, so "I've done this on Databricks" is one paste away and is true.
4. **No harm to non-lab users:** a learner who never opens the Lab downloads nothing extra, and nothing about their start-up, tests or performance changes.
5. **Reusable engine, content on top:** the scenario ships as a *pack* on the station engine, not as code. That proves a second pack (JD-PO-005 framing, certification drills) needs content, not new code.

## 3. Non-goals

| Not doing | Why |
|---|---|
| Recreating the Azure portal or ADF Studio's drag-and-drop canvas | Weeks of work to teach button locations. Interviewers ask about consequences, not clicks. |
| Connecting to real Azure or Databricks | Breaks the local-first/no-network promise. The notebook export covers the real-platform step instead. |
| Running Spark or Hive locally | Needs Java and hundreds of MB. `deltalake` (delta-rs) implements the Delta protocol without it. Legacy Hive behaviour is represented by the dataset (see P0-1), not executed. |
| An in-app "install engine" button | A new class of network call. A documented command keeps the offline guarantee simple. Revisit only if this is shown to hurt adoption. |
| Stations for Synapse or Power BI serving | Good candidates later, but v1 proves the pipeline and program levels first. Governance (Unity Catalog) is now P1 as part of the Identity station. |
| Licensing, payment, or feature gating | The pricing model isn't decided (see Open questions). v1 only keeps pack boundaries clean so any model fits later. |
| A free-form SQL/Python console on the engine | This is a code-execution surface. v1 exposes only a fixed allow-list of operations. |
| Real company names, real budgets, or figures presented as real | Packs are fictional and say so. A constructed budget quoted as fact in front of a panel is a credibility risk, and a real company's name in a shipped pack is a trademark risk (hard rule 2). |

## 4. The design in one picture

The Lab has **two levels** that share one fictional scenario.

```
 PROGRAM LEVEL (simulation): where PO judgment lives
 ┌──────────────────────── Station F: Migration Factory ─────────────────────────┐
 │ tier the inventory → plan waves → run: Convert → Validate → Parallel run →     │
 │ Cutover → Hypercare → decommission. Hidden cron jobs surface mid-program,      │
 │ pilot velocity is lower, cutting over without a consumer map blanks a report   │
 └───────────────────────────────────────┬───────────────────────────────────────┘
        a wave's validation step drops into the pipeline level ▼
 PIPELINE LEVEL: where platform depth lives
            one fictional dataset (deterministic, planted defects, manifest)
  ┌──── Station A ─────────┬──── Station B ────────┬──── Station C ─────────────────┐
  │ ADF + Lakeflow Jobs    │ ADLS                  │ Delta Lake                     │
  │ (simulation)           │ (simulation)          │ (REAL engine, optional)        │
  │ which rows move, which │ where they land, who  │ what makes them reliable,      │
  │ orchestrator owns the  │ can touch them, file  │ small files → compaction       │
  │ trigger, late files    │ layout                │                                │
  └────────────┬───────────┴───────────┬───────────┴───────────────┬────────────────┘
               │ batch manifest        │ landing paths             │ real table versions
               └───────────────────────┴───────────────────────────┘

   every station:  Predict → Manipulate → Observe → Explain
                   ├─ acceptance criteria (structural checks)
                   ├─ 60-second recorded answer (interview studio)   [P1]
                   └─ Databricks notebook export (Station C)
                                     │
                               Lab journal (real vs simulated, labelled)
```

**Why one flow and not separate sandboxes:** the interview questions are "walk me through how data gets from source to dashboard" and "how would you plan a 3,000-job migration." Upstream choices must have visible downstream consequences. For example, a watermark updated *before* the copy in Station A produces missing rows that you then catch in Station C. Cutting over a wave in Station F without mapping its consumers breaks a report the pipeline team never knew about.

## 5. Scenario pack v1: "Semiconductor Hadoop → Databricks migration (fictional)"

This is based on a training scenario the author supplied, with all names and figures fictional and labelled as such.

- **Estate:** an on-prem Cloudera (HDFS + Hive Metastore + Ranger + Kerberos, multiple realms) platform nearing end of support. About 3,000 Spark jobs, orchestrated roughly 70% by Oozie, 20% by cron/shell wrappers **not in any inventory**, and 10% by partial Airflow.
- **Five things migrate at once:** storage (HDFS → ADLS Gen2 medallion), metadata and governance (Hive Metastore + Ranger → Unity Catalog, via Hive Metastore federation as a bridge), compute (YARN Spark → Databricks Runtime, job clusters by default), orchestration (Oozie → Lakeflow Jobs, with ADF only for external triggers), and identity (Kerberos keytabs → Entra ID service principals and managed identities).
- **Domains and criticality:** BI feeds → supply chain → finance → yield/defect analytics → equipment telemetry. The domains least safe to disrupt go last.
- **Why it's hard:** a fab never stops, so there's no quiet cutover window. Yield numbers carry audit weight, so near-enough parity isn't acceptable. Cross-realm Kerberos trust is undocumented.
- **Dataset for the pipeline level:** yield/defect records and equipment telemetry events, with planted legacy-vs-migrated defects (see P0-1).

The JD-PO-005 pack (P1-3) reuses this engine with its own framing and regional defect batch (Arabic-script names, Hijri dates, AED rounding).

**Before this pack is treated as reference material, fix the source document's internal inconsistencies** (see Open questions 9).

## 6. User stories

**Candidate preparing for a data-platform PO interview (primary)**
- As a PO candidate, I want to tier a job inventory and plan migration waves, then see how the plan holds up when reality diverges, so that I can explain why estimates built on job count fail.
- As a PO candidate weak on Azure, I want to change one ingestion choice and see what it does to the target table, so that I can explain the trade-off rather than recite it.
- As a PO candidate, I want to run real Delta operations and keep a record of them, so that I can honestly say I've used MERGE, schema enforcement, time travel and compaction.
- As a PO candidate, I want to write acceptance criteria for each decision and get them checked, so that I practise the PO half of the job on data work.
- As a PO candidate, I want to export the same exercise as a Databricks notebook, so that I can repeat it on the real platform and claim that too.
- As a PO candidate, I want to rehearse a 60-second spoken answer built from *my own* lab results, so that the knowledge comes out fluently in the room.

**Certification learner (secondary)**
- As a certification learner, I want the pipeline stations without any interview or program framing, so that I can learn the concepts for the exam.
- As a certification learner who doesn't want extra installs, I want the Lab to work in concept mode without the Delta engine, so that I'm not forced to install something I don't need.

**Edge cases**
- As a learner without the engine installed, I want to be told plainly that the real run is unavailable and how to add it, and never to be shown simulated output as if it were real.
- As a learner who has made a mess of the lab tables, I want to reset the lab data without losing my journal, so that I can start over without losing evidence.
- As a learner who skips ahead, I want any station to start from a sensible default upstream state, so that I can go straight to the part I need.

## 7. Requirements

### P0: must ship

**P0-1 · Shared fictional dataset**
A deterministic, seeded generator in the repo produces one small dataset for the pack's fictional organisation, labelled *fictional* in the UI. For v1 that's about 5k yield/defect records plus equipment telemetry events. The **pack defines the schema and the planted defects**, so the generator stays generic. The v1 pack's defects, each with a manifest entry (ground truth):
- **Precision:** DECIMAL results that differ between the "legacy" (Hive) extract and the migrated output.
- **Timezone:** the legacy cluster's local zone vs Databricks' UTC default.
- **Nulls:** null-handling differences that change an aggregate but not the row count.
- **Schema drift:** a column change in a later batch.
- **CDC:** updates and deletes.
- **Replay:** a replayed batch that produces duplicates.
- **Late or out-of-order telemetry:** events that arrive late or in the wrong order.
- **Small files:** a many-small-files landing pattern.

**Legacy and clean copies.** Each table exists twice: a `legacy.*` copy (what the old Hive jobs produced) and a clean source copy. The planted precision, timezone and null defects are the *difference* between the two. That's how "row counts match, values are wrong" gets ground truth without running Hive. Defects are declared in the pack's `dataset.json` and applied by the seeded generator (design §4.2).

Acceptance:
- [ ] Same seed → byte-identical output (tested).
- [ ] Comparing a `legacy.*` table with its clean copy finds exactly the defects the manifest lists: no more, no fewer.
- [ ] The manifest lists every planted defect with the rows it affects.
- [ ] Nothing in it resembles the learner's own data. It never reads from or writes to `exam_simulator.db`.

**P0-2 · Optional Delta engine, with honest fallback**
- [ ] `deltalake` (plus `tzdata`, which Windows needs for UTC timestamps) is in a separate `backend/requirements-lab.txt`, not in `requirements.txt`.
- [ ] Imported lazily inside the lab service only. `app.main` starts with it absent (tested).
- [ ] `GET /api/v1/lab/lakehouse/engine` → `{available, version, install_command}`.
- [ ] Given the engine is absent, when the learner opens Station C, then the concept steps work and the run panel says *"Real engine not installed"* with the command. No simulated result appears in its place.
- [ ] Engine tests use `pytest.importorskip("deltalake")`. The default suite passes without it.
- [ ] A second CI job installs `requirements-lab.txt` and runs the engine tests. This changes `.github/workflows/ci.yml`, which **the author pushes** (hard rule 8: the automation token can't push workflow files).

**P0-3 · Lab data isolation (hard rule 1 extension)**
- [ ] Lab tables live under a directory set by `PREPBENCH_LAB_DIR` (default `backend/data/lab/`), never next to the real database.
- [ ] `conftest.py` redirects `PREPBENCH_LAB_DIR` before any `app.*` import, the same way as recordings and secrets.
- [ ] Every engine operation resolves paths inside the lab dir. A path outside it is refused (tested with `..` traversal).
- [ ] "Reset lab data" deletes lab tables only. The journal survives.

**P0-4 · Station C: Delta Lake, "the load that went wrong"** (real engine)
Operations are a fixed allow-list, not free-form code:
- create table from batch 1
- append a drifted batch under **schema enforcement** (a real failure, with the real error shown)
- the same append with **schema evolution**
- **MERGE** a CDC batch (updates and deletes)
- table **history**
- **time travel** read of version N
- **restore** to version N
- **compaction** (`optimize.compact`), optionally with Z-ordering, after many small appends
- **vacuum** with a retention warning (vacuum removes old files, and that breaks time travel to those versions)
- **compare tables**: row counts and per-column sum, min, max and null count for two tables, **plus a row-level join on the business key** that lists the rows whose values differ beyond a tolerance. The spike showed aggregates alone can miss real drift: identical sums hid 300 mismatched rows (design §4.4). Station F's yield-wave validation (P0-8) needs this in v1, so it isn't left to Station D (P1-2).

The server writes all SQL and resolves every table name itself. The client names an operation and a table from the pack; it never sends SQL or a path. An expected failure (for example, a schema-enforcement rejection) comes back as a result showing the real error, not as a server error (design §4.4).

Acceptance:
- [ ] Each operation returns the real result: rows affected, new version, schema, file count, error text.
- [ ] Predict is committed before manipulate, and cannot be changed after the outcome is shown. This reuses the `learning_attempts` rules (prediction is write-once).
- [ ] The replayed-batch defect produces real duplicates on plain append, and none with MERGE on the business key.
- [ ] The small-files batch shows a real file count before and after compaction.
- [ ] Comparing a `legacy.*` table with its migrated copy returns matching row counts and the planted value differences.

**P0-5 · Station B: ADLS (deterministic simulation)**
It is a pure TypeScript model in `frontend/src/services/lakehouse/`, the same pattern as the Agile Metrics models.
- **Levers:**
  - hierarchical namespace on or off (directory rename is atomic vs a copy per blob)
  - landing layout: copied from HDFS as-is vs redesigned for object storage (`bronze/<source>/<yyyy>/<mm>/<dd>/`)
  - an access puzzle: a vendor needs write access to one folder only. RBAC at container scope is too broad, while a directory ACL also needs execute on the parent folders.
  - access tier (hot or cool) and lifecycle rule
- **No landing files in v1.** The landing zone exists only in the simulation. Batches go straight from the generator into `bronze.*` tables, so no Parquet writer is needed without pyarrow. Revisit with `arro3-io` if Station B should read real files (design §4.5, §8).
- [ ] Every effect is tagged `arithmetic | assumption | convention` in a coupling ledger. Assumptions render as labelled callouts, and a completeness test fails if one is never shown (same as `couplings.ts`).
- [ ] Cost and latency figures are labelled *teaching constants*, not Azure prices.

**P0-6 · Station A: ADF + Lakeflow Jobs (deterministic simulation)**
The pipeline is a **step list**, not a canvas: Lookup watermark → Copy (through a self-hosted integration runtime from "on-prem") → run job → update watermark.
- **Levers:**
  - full vs watermark-incremental load
  - watermark updated **before vs after** the copy, combined with an injected mid-copy failure (loses rows or duplicates them)
  - **which orchestrator owns each trigger**: ADF for external triggers (an on-prem feed landing), Lakeflow Jobs for job-to-job dependencies inside Databricks
  - schedule vs tumbling-window vs event trigger, tested against **late and out-of-order files**, not just the normal case
  - retry count
  - soft deletes, which a watermark cannot see
- [ ] Output is a **batch manifest** (which row ids land in which load), and it feeds Stations B and C.
- [ ] Same ledger and teaching-constant rules as P0-5.

**P0-7 · Downstream consequences, with a default path**
- [ ] Station C ingests the batches that the learner's Station A choices produced, so an upstream mistake shows up as real rows in a real table.
- [ ] Each station can start on its own with a documented default upstream state, and says so ("using default upstream: incremental, watermark after copy").

**P0-8 · Station F: Migration Factory (deterministic simulation)**
This is the program level, and it covers the three failure patterns from the problem statement.
- **Inventory and tiering:** the learner scores a sample of jobs into Tier 1, 2 or 3 from their characteristics (RDD-heavy code, custom Java UDFs, auth dependencies across realms, feeds yield reporting). The model reveals the true tier. A **plan based on job count** and a **plan weighted by complexity** are run side by side, so the gap is visible.
- **Wave planning:** the learner orders domains into waves. The model penalises putting critical, latency-sensitive domains early and rewards pilot waves that are cheap if they go wrong.
- **Reality events** (deterministic, fixed schedule):
  - 10–20% more jobs discovered mid-program (cron wrappers)
  - pilot velocity at 40–50% of steady state
  - a fab change-freeze window
  - a wave cut over **without a downstream consumer map**, which blanks a dependent report
- **Cost lever:** production jobs on job clusters vs all-purpose clusters, and DBU spend vs total cost including the infrastructure underneath. All figures are labelled *teaching constants*, never presented as current Azure or Databricks prices.
- **Per-wave loop:** Convert → Validate (data, functional and performance parity) → Parallel run → Cutover → Hypercare. A yield-domain wave's Validate step links into Station C with a *compare tables* preset (P0-4), where **row-count parity passes but value-level comparison fails** on real tables.
- [ ] Same ledger, teaching-constant and determinism rules as P0-5 (the same inputs always give the same outcome).
- [ ] Decommission is blocked until every consumer in the map is confirmed migrated.

**P0-9 · Explain: acceptance criteria with structural checks**
After each outcome, the learner writes acceptance criteria. Deterministic checks look for: a Given/When/Then shape · a numeric threshold (for example a reconciliation tolerance) · a failure or rollback behaviour · an owner or sign-off (for yield waves, the business data owner, not only engineering QA).
- [ ] The checks are labelled *structure checks*, not a quality grade.
- [ ] v1 has no AI feedback on acceptance criteria. That's P1-6.

**P0-10 · Lab journal**
- [ ] Every Station C operation writes a journal entry: operation, table, resulting version, row and file counts, timestamp, and **source = `real engine` or `simulation`**, shown on every entry.
- [ ] Stations A, B and F write entries marked `simulation`.
- [ ] The journal exports to Markdown ("what I actually did"), for review before an interview.
- [ ] Entries are append-only. They can be deleted by the learner but never edited.
- [ ] Stored in a new `lab_journal_entries` table, not in `learning_attempts`. Engine operations aren't learning attempts, and mixing them in would distort every mastery figure calculated from that table. An entry can link to an attempt through `attempt_uid`.
- [ ] **Real-engine entries are written only by the server,** inside the operation handler. The API refuses a client-posted entry marked `real engine`, so the journal can't claim a run that didn't happen (design §4.6).

**P0-11 · Databricks notebook export (Station C)**
- [ ] Exports Databricks source format (`# Databricks notebook source` with `# COMMAND ----------` cells), using SQL and PySpark, for the same dataset and steps, including how to upload the dataset to a Volume.
- [ ] **Before shipping, a person verifies it on Databricks Free Edition.** Until then the export is marked "unverified". We don't claim it works without having run it.

**P0-12 · Standard PrepBench shipping bar**
- [ ] `/databricks-sandbox` is added to the `ROUTES` arrays in `responsive.spec.ts`, `accessibility.spec.ts` and `navigation.spec.ts`. The placeholder hub card is set to `live: true`, and the `navigation.ts` entry and `SECTION_RULES` entry are added. `Sidebar.test.tsx`'s link count, `navigation.test.ts` and `LearningLabPage.test.tsx` are updated, following the `add-learning-lab-sandbox` skill.
- [ ] axe is clean in light and dark. No horizontal scroll at 390px. No hex colours. Every font size uses `pxToRem`, including SVG text scaled by `textScale`.
- [ ] Headings go h1 → h2 → h3. Any count assertions affected by the new card or nav entry are updated.

### P1: fast follow

- **P1-1 · Recorded answer from your own results.** Each station can create an interview question whose `key_talking_points` come from *this learner's observed results*, never invented content. It can then be practised in the interview studio and graded for plan alignment. *Depends on:* the interview-question importer and create path accepting `prepared_answer` / `key_talking_points`. The importer drops them today.
- **P1-2 · Reconciliation Detective (Station D).** Legacy and migrated totals don't match. The learner finds each planted defect from the manifest using real engine queries. Their score is found vs planted. The lesson is the pack's own: *row-count parity isn't enough.*
- **P1-3 · JD-PO-005 scenario pack.** Framing, a stakeholder brief, the 10-question diagnostic, interview prompts and a regional defect batch (Arabic-script names, Hijri dates, AED rounding), packaged as content. It has its own manifest folder and ships no code.
- **P1-4 · Diagnostic before/after view** for Goal 1, built from the learner's own recorded self-ratings.
- **P1-5 · Station I: Identity and governance (simulation).**
  - **Identity:** a trust-path puzzle. Given service accounts across Kerberos realms, find which one can't get an Entra ID token after cutover. Plan the move to service principals and managed identities as a workstream with its own sign-off.
  - **Governance:** redesign a Ranger row- and column-level policy as a Unity Catalog grant or ABAC rule. The redesign must preserve *why* the policy existed, not just copy its configuration.
- **P1-6 · AI feedback on acceptance criteria.** Adds a new `LLMTask` with its own entry in per-task provider routing. With no provider, it shows **"Not Graded"** and the reason (hard rule 2). This was moved from P0-9 because it touches LLM routing and the settings UI, and v1's value doesn't depend on it.

### P2: design for, don't build

- A certification drill pack (Databricks Data Engineer Associate / DP-700; the current exam outlines need checking first).
- More stations: serving (Power BI import vs DirectQuery vs Databricks SQL, and where Synapse fits).
- An ADF pipeline JSON export as the Station A equivalent of the notebook export.
- Pack-level gating: packs are self-contained folders with a manifest, so any licensing model can switch them on or off later without touching stations.

## 8. Success metrics

PrepBench has **no telemetry**, so metrics come from the learner's own local data or from direct conversations. No product analytics.

| Kind | Metric | Target | How measured |
|---|---|---|---|
| Leading | Diagnostic confidence, before → after (both levels) | ≥ 8/10 after (stretch 10/10) | P1-4 view, learner's own ratings |
| Leading | Prediction accuracy per concept over repeat attempts | Rising across 3 attempts | `learning_attempts` (already derived on read) |
| Leading | Real-engine operations in the journal | All 10 allow-listed operations run at least once | Journal |
| Leading | Factory run completed with a complexity-weighted plan that beats the count-based plan | At least 1 full run | Journal |
| Leading | Notebook export completed on Free Edition | ≥ 1 station | Learner's own check-off |
| Lagging | Author passes a technical round for a data-platform PO role | Pass | Self-reported |
| Lagging (commercial signal) | External testers who'd pay or join a waitlist | ≥ 3 of 5–10 people shown the pack | Direct conversations |

## 9. Open questions

| # | Question | Who | Blocking? |
|---|---|---|---|
| 1 | ~~Does `deltalake` cover every allow-listed operation on Windows without pyarrow?~~ **Resolved (spike, 2026-09-24):** yes, all 10 operations, on deltalake 1.6.5 and Python 3.14.7, with pyarrow never loaded. Four design changes followed; see design §10. | Engineering | — |
| 2 | ~~Journal storage~~ **Resolved:** a new `lab_journal_entries` table (P0-10, design §4.6). | Engineering | — |
| 3 | ~~Batch file format~~ **Resolved:** no landing files in v1 (P0-5, design §4.5). | Engineering | — |
| 4 | Which interview round type do lab questions use? Existing options are `hr_screening`, `hiring_manager`, `system_design`, `behavioral`. Add `technical`? | Product (author) | No (P1) |
| 5 | Trademark use of "Azure", "Data Factory", "Databricks", "Delta Lake", "Cloudera" in UI and any marketing: nominative use plus a "not affiliated" notice. | Legal | Before any commercial release |
| 6 | Provenance of the existing seeded question content (for example `PSM_I_Question_Bank.json`) before anything is sold. | Author / legal | Before any commercial release |
| 7 | Pricing model: noncommercial + commercial licence, open core, or free engine with paid packs. | Author | No, because packs stay separable (P2) |
| 8 | Who verifies the notebook exports on Free Edition, and how often after Databricks changes? | Author | Yes, before P0-11 ships as "verified" |
| 9 | The source scenario contradicts itself in three places:<br>• job-cluster vs all-purpose DBU ratio: "roughly a third" in one section, "2–3x-plus" in another<br>• wave numbering: waves 9–11 are Finance in the wave plan but "high-risk" in the timeline<br>• the budget's low end sums to ~$10.5M, not $11M<br>Resolve these before the pack is written. Cost ratios become teaching constants, never quoted prices. | Author | Yes, before the P0-8 content is written |
| 10 | Should Station F share the Agile Metrics sandbox's composition and coupling-ledger code, or have its own model that follows the same pattern? | Engineering | No |

## 10. Timeline and phasing

There's no hard deadline, because no interview is scheduled. **Recommendation: set an application date for JD-PO-005-type roles that doesn't depend on this build finishing.** Rehearsal can start now from the scenario, using the interview-question import (see P1-1's dependency).

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 · Spike | Open questions 1 and 9 | ✅ Engine check done 2026-09-24 (design §10). **Remaining:** fix the scenario's inconsistencies (open question 9). |
| 1 · Delta first | P0-1, P0-2, P0-3, P0-4, P0-9, P0-10, P0-11, P0-12 (Station C only, default upstream) | Full test suite green with and without the engine. Notebook verified on Free Edition. |
| 2 · The program | P0-8 (Station F), linked to Station C for the yield-wave validation | A count-based plan visibly fails where the complexity-weighted plan holds. A cutover without a consumer map breaks a report. |
| 3 · The pipeline flow | P0-5, P0-6, P0-7 | A watermark mistake in A shows up as real rows in C. The ledger completeness test passes. |
| 4 · Make it interview-ready | P1-1 to P1-5 | Diagnostic taken before and after. The JD-PO-005 pack runs with no new code. |
| Later | P2 | — |

Each phase closes with the `pre-completion-checklist` skill and the full-suite run, per `CLAUDE.md`.
