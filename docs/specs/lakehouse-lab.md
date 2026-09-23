# Lakehouse Lab — PRD

**Status:** Draft for review · **Date:** 2026-09-23 · **Owner:** Nimish Kanungo
**Where it lives:** Learning Lab (`/lab`) → `/databricks-sandbox`. This is the "Databricks architecture" domain that `docs/wiki/Chart-Sandbox.md` already lists as next. It takes over the existing placeholder card in `LearningLabPage.tsx` (`path: '/databricks-sandbox'`, `live: false`), and it follows the top-level route convention set by `/chart-sandbox`. The nav key is `'databricks-sandbox'`, as `navigation.ts` already anticipates. It's wired in using the `add-learning-lab-sandbox` skill.

---

## 1. Problem statement

People moving into **Technical Product Owner roles on data platform and migration work** get probed on Azure Data Factory, ADLS and Delta Lake by interviewers who expect *judgment*: why incremental over full load, what happens to the table when a load fails halfway, how you'd roll back. Many candidates, the author included, are strong on PO craft but thin on this platform depth. Today they learn it from vendor docs and videos. That gives them vocabulary but not the cause-and-effect understanding that survives a follow-up "why?". It also leaves them with nothing they can honestly say they've *done*.

What it costs to leave this unsolved: the candidate fails the technical round of roles like JD-PO-005 (Databricks + Azure + Data Migration PO), or overclaims hands-on experience and gets caught.

## 2. Goals

1. **Understanding:** a learner who finishes the three stations can answer 8 of 10 questions from a fixed diagnostic set (ADF, ADLS, Delta) with confidence. The same set is taken before and after, and each answer is recorded in the interview studio and self-rated.
2. **Honest hands-on claim:** every learner who installs the optional engine leaves with a Lab journal of **real** Delta Lake operations they ran (write, schema enforcement, MERGE, time travel, restore), each labelled as run on the real engine.
3. **Bridge to the real platform:** every Delta exercise exports as a Databricks notebook that has been verified to run on Databricks Free Edition, so "I've done this on Databricks" is one paste away and is true.
4. **No harm to non-lab users:** a learner who never opens the Lab downloads nothing extra, and nothing about their start-up, tests or performance changes.
5. **Reusable engine, content on top:** JD-PO-005 ships as a *scenario pack* on the station engine, not as code. That proves a second pack (certification drills) needs content, not new code.

## 3. Non-goals

| Not doing | Why |
|---|---|
| Recreating the Azure portal or ADF Studio's drag-and-drop canvas | Weeks of work to teach button locations. Interviewers ask about consequences, not clicks. |
| Connecting to real Azure or Databricks | Breaks the local-first/no-network promise. The notebook export covers the real-platform step instead. |
| Running Spark locally | Needs Java and hundreds of MB. `deltalake` (delta-rs) implements the Delta protocol without it. |
| An in-app "install engine" button | A new class of network call. A documented command keeps the offline guarantee simple. Revisit only if this is shown to hurt adoption. |
| Stations for Unity Catalog, Synapse, Power BI serving, or cutover | These are good candidates (see P2), but v1 proves the ADF → ADLS → Delta flow first. |
| Licensing, payment, or feature gating | The pricing model isn't decided (see Open questions). v1 only keeps pack boundaries clean so any model fits later. |
| A free-form SQL/Python console on the engine | This is a code-execution surface. v1 exposes only a fixed allow-list of operations. |

## 4. The design in one picture

```
            one fictional dataset (deterministic, planted defects, manifest)
                                     │
  ┌──────────── Station A ───────────┼──────── Station B ────────┼─────── Station C ────────┐
  │  ADF (simulation)                │  ADLS (simulation)        │  Delta Lake (REAL engine, │
  │  which rows move, when, how      │  where they land, who     │  optional install)        │
  │  often, and what a failure does  │  can touch them           │  what makes them reliable │
  └──────────────┬───────────────────┴─────────────┬─────────────┴────────────┬──────────────┘
                 │ batch manifest (row ids per load)│ landing paths            │ real table versions
                 └──────────────────────────────────┴──────────────────────────┘
                                     │
   every station:  Predict → Manipulate → Observe → Explain
                   ├─ acceptance criteria (structural checks)
                   ├─ 60-second recorded answer (interview studio)   [P1]
                   └─ Databricks notebook export (Delta)             
                                     │
                               Lab journal (real vs simulated, labelled)
```

**Why one flow and not three sandboxes:** the interview question is "walk me through how data gets from source to dashboard." Upstream choices must have visible downstream consequences. For example, a watermark updated *before* the copy in Station A produces missing rows that you then catch in Station C.

## 5. User stories

**Candidate preparing for a data-platform PO interview (primary)**
- As a PO candidate weak on Azure, I want to change one ingestion choice and see what it does to the target table, so that I can explain the trade-off rather than recite it.
- As a PO candidate, I want to run real Delta operations and keep a record of them, so that I can honestly say I've used MERGE, schema enforcement and time travel.
- As a PO candidate, I want to write acceptance criteria for each decision and get them checked, so that I practise the PO half of the job on data work.
- As a PO candidate, I want to export the same exercise as a Databricks notebook, so that I can repeat it on the real platform and claim that too.
- As a PO candidate, I want to rehearse a 60-second spoken answer built from *my own* lab results, so that the knowledge comes out fluently in the room.

**Certification learner (secondary)**
- As a certification learner, I want the same stations without any interview framing, so that I can learn the concepts for the exam.
- As a certification learner who doesn't want extra installs, I want the Lab to work in concept mode without the Delta engine, so that I'm not forced to install something I don't need.

**Edge cases**
- As a learner without the engine installed, I want to be told plainly that the real run is unavailable and how to add it, and never to be shown simulated output as if it were real.
- As a learner who has made a mess of the lab tables, I want to reset the lab data without losing my journal, so that I can start over without losing evidence.
- As a learner who skips Station A, I want Station C to start from a sensible default upstream state, so that I can go straight to Delta.

## 6. Requirements

### P0: must ship

**P0-1 · Shared fictional dataset**
A deterministic, seeded generator in the repo produces one small dataset (about 5k customers, accounts and transactions) for a clearly fictional organisation, labelled *fictional* in the UI. It includes **planted defects with a manifest** (ground truth): a schema change in a later batch, updates and deletes for CDC, a replayed batch (duplicates), trailing spaces, decimal-precision differences, Arabic-script names, Hijri-dated fields, and AED rounding.
- [ ] Same seed → byte-identical output (tested).
- [ ] The manifest lists every planted defect with the rows it affects.
- [ ] Nothing in it resembles the learner's own data. It never reads from or writes to `exam_simulator.db`.

**P0-2 · Optional Delta engine, with honest fallback**
- [ ] `deltalake` is in a separate `backend/requirements-lab.txt`, not in `requirements.txt`.
- [ ] Imported lazily inside the lab service only. `app.main` starts with it absent (tested).
- [ ] `GET /api/v1/lab/lakehouse/engine` → `{available, version, install_command}`.
- [ ] Given the engine is absent, when the learner opens Station C, then the concept steps work and the run panel says *"Real engine not installed"* with the command. No simulated result appears in its place.
- [ ] Engine tests use `pytest.importorskip("deltalake")`. The default suite passes without it.

**P0-3 · Lab data isolation (hard rule 1 extension)**
- [ ] Lab tables live under a directory set by `PREPBENCH_LAB_DIR` (default `backend/data/lab/`), never next to the real database.
- [ ] `conftest.py` redirects `PREPBENCH_LAB_DIR` before any `app.*` import, the same way as recordings and secrets.
- [ ] Every engine operation resolves paths inside the lab dir. A path outside it is refused (tested with `..` traversal).
- [ ] "Reset lab data" deletes lab tables only. The journal survives.

**P0-4 · Station C: Delta Lake, "the load that went wrong"** (real engine)
Operations are a fixed allow-list, not free-form code: create table from batch 1 · append a drifted batch under **schema enforcement** (a real failure, with the real error shown) · the same append with **schema evolution** · **MERGE** a CDC batch (updates and deletes) · table **history** · **time travel** read of version N · **restore** to version N · **vacuum** with a retention warning (vacuum removes old files, and that breaks time travel to those versions).
- [ ] Each operation returns the real result: rows affected, new version, schema, error text.
- [ ] Predict is committed before manipulate, and cannot be changed after the outcome is shown. This reuses the `learning_attempts` rules (prediction is write-once).
- [ ] The replayed-batch defect produces real duplicates on plain append, and none with MERGE on the business key.

**P0-5 · Station B: ADLS (deterministic simulation)**
It is a pure TypeScript model in `frontend/src/services/lakehouse/`, the same pattern as the Agile Metrics models.
- Levers: hierarchical namespace on or off (directory rename is atomic vs a copy per blob) · landing layout (`raw/<source>/<yyyy>/<mm>/<dd>/` vs flat) · access puzzle (a vendor needs write access to `raw/vendor-x/` only: RBAC at container scope is too broad, while a directory ACL also needs execute on the parent folders) · access tier (hot or cool) and lifecycle rule.
- [ ] Every effect is tagged `arithmetic | assumption | convention` in a coupling ledger. Assumptions render as labelled callouts, and a completeness test fails if one is never shown (same as `couplings.ts`).
- [ ] Cost and latency figures are labelled *teaching constants*, not Azure prices.

**P0-6 · Station A: ADF (deterministic simulation)**
The pipeline is a **step list**, not a canvas: Lookup watermark → Copy (through a self-hosted integration runtime from "on-prem") → run notebook → update watermark.
- Levers: full vs watermark-incremental load · watermark updated **before vs after** the copy, combined with an injected mid-copy failure (loses rows or duplicates them) · schedule vs tumbling-window trigger (backfill and dependency behaviour) · retry count · soft deletes, which a watermark cannot see.
- [ ] Output is a **batch manifest** (which row ids land in which load), and it feeds Stations B and C.
- [ ] Same ledger and teaching-constant rules as P0-5.

**P0-7 · Downstream consequences, with a default path**
- [ ] Station C ingests the batches that the learner's Station A choices produced, so an upstream mistake shows up as real rows in a real table.
- [ ] Each station can start on its own with a documented default upstream state, and says so ("using default upstream: incremental, watermark after copy").

**P0-8 · Explain: acceptance criteria with structural checks**
After each outcome, the learner writes acceptance criteria. Deterministic checks look for: a Given/When/Then shape · a numeric threshold (for example a reconciliation tolerance) · a failure or rollback behaviour · an owner or alert.
- [ ] The checks are labelled *structure checks*, not a quality grade.
- [ ] Optional AI feedback goes through the normal task routing. With no provider, it shows **"Not Graded"** and the reason (hard rule 2).

**P0-9 · Lab journal**
- [ ] Every Station C operation writes a journal entry: operation, table, resulting version, row counts, timestamp, and **source = `real engine` or `simulation`**, shown on every entry.
- [ ] Stations A and B write entries marked `simulation`.
- [ ] The journal exports to Markdown ("what I actually did"), for review before an interview.
- [ ] Entries are append-only. They can be deleted by the learner but never edited.

**P0-10 · Databricks notebook export (Station C)**
- [ ] Exports Databricks source format (`# Databricks notebook source` with `# COMMAND ----------` cells), using SQL and PySpark, for the same dataset and steps, including how to upload the dataset to a Volume.
- [ ] **Before shipping, a person verifies it on Databricks Free Edition.** Until then the export is marked "unverified". We don't claim it works without having run it.

**P0-11 · Standard PrepBench shipping bar**
- [ ] `/databricks-sandbox` is added to the `ROUTES` arrays in `responsive.spec.ts`, `accessibility.spec.ts` and `navigation.spec.ts`. The placeholder hub card is set to `live: true`, and the `navigation.ts` entry and `SECTION_RULES` entry are added. `Sidebar.test.tsx`'s link count, `navigation.test.ts` and `LearningLabPage.test.tsx` are updated, following the `add-learning-lab-sandbox` skill.
- [ ] axe is clean in light and dark. No horizontal scroll at 390px. No hex colours. Every font size uses `pxToRem`, including SVG text scaled by `textScale`.
- [ ] Headings go h1 → h2 → h3. Any count assertions affected by the new card or nav entry are updated.

### P1: fast follow

- **P1-1 · Recorded answer from your own results.** Each station can create an interview question whose `key_talking_points` come from *this learner's observed results*, never invented content. It can then be practised in the interview studio and graded for plan alignment.
- **P1-2 · Reconciliation Detective (Station D).** Source and target totals don't match. The learner finds each planted defect from the manifest (encoding, Hijri, AED rounding, soft deletes, replays) using real engine queries. Their score is found vs planted.
- **P1-3 · JD-PO-005 scenario pack.** Framing, a stakeholder brief, the 10-question diagnostic, and interview prompts packaged as content. It has its own manifest folder and ships no code.
- **P1-4 · Diagnostic before/after view** for Goal 1, built from the learner's own recorded self-ratings.

### P2: design for, don't build

- A certification drill pack (Databricks Data Engineer Associate / DP-700; the current exam outlines need checking first).
- More stations: Unity Catalog governance (PII in bronze, vendor access), serving (Power BI import vs DirectQuery vs Databricks SQL, and where Synapse fits), cutover rehearsal.
- An ADF pipeline JSON export as the Station A equivalent of the notebook export.
- Pack-level gating: packs are self-contained folders with a manifest, so any licensing model can switch them on or off later without touching stations.

## 7. Success metrics

PrepBench has **no telemetry**, so metrics come from the learner's own local data or from direct conversations. No product analytics.

| Kind | Metric | Target | How measured |
|---|---|---|---|
| Leading | Diagnostic confidence, before → after | ≥ 8/10 after (stretch 10/10) | P1-4 view, learner's own ratings |
| Leading | Prediction accuracy per concept over repeat attempts | Rising across 3 attempts | `learning_attempts` (already derived on read) |
| Leading | Real-engine operations in the journal | All 8 allow-listed operations run at least once | Journal |
| Leading | Notebook export completed on Free Edition | ≥ 1 station | Learner's own check-off |
| Lagging | Author passes a technical round for a data-platform PO role | Pass | Self-reported |
| Lagging (commercial signal) | External testers who'd pay or join a waitlist | ≥ 3 of 5–10 people shown the JD pack | Direct conversations |

## 8. Open questions

| # | Question | Who | Blocking? |
|---|---|---|---|
| 1 | Does `deltalake` 1.6.x cover every allow-listed operation (MERGE, restore, vacuum, history) on local Windows paths, fed from `arro3` tables without pyarrow? The wheel exists for Python 3.14 (checked: abi3, win_amd64, ~53 MB). A 1-day spike should confirm the rest. | Engineering | **Yes**, before Phase 1 |
| 2 | Journal storage: extend `learning_attempts` (it already has `manipulation`/`observed` JSON), or add a new `lab_journal_entries` table? Engine operations aren't attempts, so a new table is probably cleaner. | Engineering | Yes, before Phase 1 |
| 3 | Batch file format between stations (CSV/JSON vs Parquet, given no pyarrow). | Engineering | No |
| 4 | Which interview round type do lab questions use? Existing options are `hr_screening`, `hiring_manager`, `system_design`, `behavioral`. Add `technical`? | Product (author) | No (P1) |
| 5 | Trademark use of "Azure", "Data Factory", "Databricks", "Delta Lake" in UI and any marketing: nominative use plus a "not affiliated" notice. | Legal | Before any commercial release |
| 6 | Provenance of the existing seeded question content (for example `PSM_I_Question_Bank.json`) before anything is sold. | Author / legal | Before any commercial release |
| 7 | Pricing model: noncommercial + commercial licence, open core, or free engine with paid packs. | Author | No, because packs stay separable (P2) |
| 8 | Who verifies the notebook exports on Free Edition, and how often after Databricks changes? | Author | Yes, before P0-10 ships as "verified" |

## 9. Timeline and phasing

There's no hard deadline, because no interview is scheduled. **Recommendation: set an application date for JD-PO-005-type roles that doesn't depend on this build finishing.**

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 · Spike | Open questions 1–2 | All 8 operations run from a test on Windows. Storage decided. |
| 1 · Delta first | P0-1, P0-2, P0-3, P0-4, P0-8, P0-9, P0-10, P0-11 (Station C only, default upstream) | Full test suite green with and without the engine. Notebook verified on Free Edition. |
| 2 · The flow | P0-5, P0-6, P0-7 | A watermark mistake in A shows up as real rows in C. The ledger completeness test passes. |
| 3 · Make it interview-ready | P1-1 to P1-4 | Diagnostic taken before and after. The JD pack runs with no new code. |
| Later | P2 | — |

Each phase closes with the `pre-completion-checklist` skill and the full-suite run, per `CLAUDE.md`.
