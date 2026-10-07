# Phase 5 contract: the ADF Behaviour Lab

**Status: not started. Scope frozen 2026-10-07: five experiments.** This is the contract a Phase 5
implementation must satisfy. Nothing here is built. ADF's `learningLabStatus` stays
`INTEGRATION_PENDING` until [section 5](#5-when-adfs-lab-becomes-available) is met.

Sources examined: the unified prototype (`prototypes/unified-prototype/`, local only:
`src/data/labDefinitions.ts` and the five `Adf*ExperimentPage.tsx` files); the production Lakehouse
stack (`frontend/src/services/lakehouse/`, `frontend/src/components/lakehouse/`); the learning layer
(`backend/app/services/learning_service.py`, `backend/app/models/learning_attempt.py`,
`frontend/src/services/learning/`); the ADF content pack (`backend/app/content/packs/adf/v1.json`);
`docs/research/ADF_Study_Guide_Roadmap_Crosswalk.md`; and `backend/app/services/content_pack_service.py`.

---

## 1. The rule that shapes everything

```
prototype experiment UX
        ↓
the existing production behaviour model (services/lakehouse/*Model.ts + typed couplings)
        ↓
LearningService / learning_attempts            (the only persistence)
        ↓
the existing roadmap ↔ study-guide mapping     (the pack's "Roadmap alignment" blocks)
        ↓
Workspace / Evidence                           (Phase 6 -- not this phase)
```

**Prohibited:**
- A standalone ADF simulator with its own state model.
- A second persistence path.
- Any `localStorage` store for attempts, artifacts or evidence.
- Seeded or demo evidence.

The prototype's `workspaceStore.ts` and `evidenceStore.ts` (`localStorage`, `isSeed: true` records)
are **not** a production pattern. `learning_attempts` exists precisely because browser storage had
made a browser the system of record (see the model's docstring).

**When a new module is allowed.** A new pure model module is allowed only where the existing models
demonstrably cannot express the behaviour. Section 3 names each case. It must follow the Lakehouse
pattern:
- It sits beside `adfModel.ts` in `services/lakehouse/` and reuses its types and semantics wherever
  they apply.
- Its functions are pure and deterministic: no clock, no randomness.
- Every assumption is a typed entry in a couplings ledger shown on screen. `pipelineCouplings.ts` is
  the template.

---

## 2. Scope (frozen)

### Canonical count: 5

| # | Experiment | Slug |
|---|---|---|
| E1 | Concurrency Budget | `concurrency` |
| E2 | Watermark & Transient Failure | `watermark` |
| E3 | Trigger Behaviour | `triggers` |
| E4 | Copy Performance | `copy-perf` |
| E5 | Fault Tolerance | `fault-tolerance` |

Every repository source agrees on these five: the prototype registry and hub, its documentation,
`CLAUDE.md`, and the capability registry's comments. An earlier product discussion listed six
(Dependency, Retry/Timeout, Concurrency, Copy Performance, Trigger Behaviour, Fault Tolerance). That
list is not in the repository and **does not add a sixth experiment**. Its two extra items are
absorbed as follows.

### Settled scope decisions

- **S1. Dependency failure is a fault mode of E5, not an experiment.** E5 has two content-backed
  fault modes (section 3, E5). Neither becomes an experiment of its own.
- **S2. Retry/Timeout is not an experiment.**
  - **Retry** is a lever exercised inside E2 (the existing `adfModel.ts` `retries` lever, 0-3) and
    inside E5's dependency mode, where a failed step's retries run before its on-failure path.
  - **Timeout** is *not simulated anywhere*. No production model represents it. The pack states its
    defaults (activity timeout 12 hours; retry 0 by default, 0-10 attempts, interval 30-86400 s), and
    E5 may *state* those facts in its explanation and retrieval content. No experiment may make a
    timeout happen, time one, or predict one.
- **S3. Trigger backfill is out of scope.** E3 covers what one window of `adfModel.ts` shows.
  Multi-window backfill and `maxConcurrency` are not modelled. Extending the model for them is a scope
  change, not an implementation detail.
- **S4. Retrieve is a standalone retrieval attempt** (section 4.5). It does not feed the topic
  demonstration re-check, and it makes no scheduling claim.

### Source conflicts, recorded

- **C1. The prototype's topic mappings are partly wrong.** Topic numbers are the roadmap's 1-60, not
  database ids. Checked against the crosswalk:
  - correct: 10 Dependencies; 12 ForEach and batch count; 17 Tumbling window; 32 Watermark patterns;
    53 Scale and concurrency;
  - wrong: 26 is *Connectors and formats*, which the prototype pairs with triggers. 27 is *Schema
    mapping and type conversion*, which the prototype calls "Copy Activity Optimization & DIUs" and
    logs bad rows against. 52 is the *Cost model*, which the prototype pairs with watermark.
  - Copy performance is topic **51**. Bad rows are topic **28**.
- **C2. The prototype's fault-tolerance entry is internally inconsistent.** Its registry text is
  dependency/error handling (topic 10, chapter `recovery`). Its page models bad-row handling and logs
  topic 27. S1 resolves this by making both of them fault modes of one experiment.
- **C3. The prototype's lab facts break the ADF accuracy rules.** It states "cloud-to-cloud copy
  auto-scales between 2 and 256 DIUs", and treats runs × batchCount × parallelCopies as an exact
  connection count. Both are forbidden: DIU availability depends on the IR and the scenario, and the
  product is an upper-bound planning model, not a runtime law. Nothing may be ported from it
  unchecked.
- **C4. The prototype is thinner than its labels.** Only Concurrency implements the full loop:

  | Prototype page | Lines | Prediction lock | Reason | Transfer | Retrieve |
  |---|---:|:-:|:-:|:-:|:-:|
  | Concurrency | 943 | yes | yes | yes | yes |
  | Watermark | 566 | yes | partial | no | no |
  | Triggers | 122 | no | no | no | no |
  | Copy performance | 157 | no | no | no | no |
  | Fault tolerance | 120 | no | no | no | no |

  For E2-E5 the loop content (predictions, causal choices, transfer cases, retrieval prompts) is
  authored in Phase 5 and grounded in the ADF pack, not lifted from the prototype.

---

## 3. The experiments

Shared by all five (section 4 has the detail):
- Persisted only as `learning_attempts` on the **ADF preparation**.
- `challenge_id` = `adf.lab.<slug>.<challenge>` and `concept_id` = `adf.lab.<slug>`.
- Facts from the ADF pack only; assumptions as typed couplings.
- The reveal is shown only after the prediction is committed.
- Retrieval is a separate attempt.
- **Completion criteria** (common to all five): the experiment is complete when
  1. its model is pure and covered by unit tests, including its couplings ledger;
  2. its prediction, reason, transfer and retrieval challenges exist and are reachable;
  3. every stage writes through `LearningService` as section 4.1 specifies, and the server's
     refusals hold;
  4. it links to its topics and chapters through the pack's alignment index;
  5. its route passes axe in both themes and at 390 px;
  6. the experiment-specific criteria below are met.

### E1. Concurrency Budget

| | |
|---|---|
| Purpose | Show how pipeline concurrency, ForEach batchCount and parallel copies multiply into load on a capped source, and that queueing and failure come from the product of the three, not any one setting. |
| Model reused | **None exists.** Station A's `adfModel.ts` runs one batch of ten files and has no notion of concurrent runs. A new pure module, `concurrencyModel.ts`, with its own couplings, is justified. It must not reimplement `runPipeline`. |
| Facts (pack) | ForEach batchCount 1-50, default 20 (`pipelines`, `fine-tuning`). Pipeline concurrency has no maximum by default; runs queue once one is set and reached. Parallel copies are threads within one copy. |
| Assumptions (couplings) | Source connection-pool size, headroom target, per-connection wait. Demand ≈ concurrent runs × batchCount × parallel copies, shown as an **upper-bound planning model**. |
| Prediction | Before any lever moves: what happens to a 100-table load against a capped source when batchCount is raised (all succeed / slower but complete / some fail / all queue). Write-once. |
| Manipulation | Pipeline concurrency, batchCount, parallel copies, pool cap → `manipulation` `{param: {from, to}}`. |
| Observation | Peak demand vs cap, queued vs failed tasks, duration → `observed` `{outcome: {label, before, after}}`. |
| Reasoning | Choose the causal chain (pool exhaustion / throughput ceiling / queueing at pipeline concurrency) → `explanation_mechanisms`, `selected_alternative_ids`, `correct`. |
| Transfer / apply | A different cap and table count. The learner sets levers to stay under the headroom. Its own challenge, `transfer: true` when it holds. |
| Explanation | The learner's budget rule, in their words → `explanation_text` (never graded). |
| Retrieval | Which three settings multiply into source load, and which one has a hard maximum. |
| Roadmap topics | 12, 53 |
| Guide chapters | `pipelines`, `fine-tuning`, `performance-cost` |
| Specific completion | The headroom reveal names the product as a planning upper bound, not an exact count (C3). |

### E2. Watermark & Transient Failure

| | |
|---|---|
| Purpose | Show that *when* the watermark is stored, whether a failed copy is retried, and whether the sink is idempotent together decide whether rows are lost, repeated or neither. |
| Model reused | **`adfModel.ts`, as is.** `runPipeline` takes `watermark` (before / success / completion), `sink` (append / upsert), `retries` (0-3), `failureAtPercent`, `lateFile` and `outOfOrder`. Its couplings are reused, not rewritten: `watermark-timing`, `transient-failure`, `append-repeats`, `recovery-run`, `late-file`, `out-of-order`. The missed and duplicated rows are real ids from the pack's source index. |
| Challenge pattern reused | `PipelineChallenge` from `pipelineChallenges.ts` (`WATERMARK_CHALLENGE` is the template). ADF challenges are new entries with `adf.lab.watermark.*` ids. Station A's own challenge stays the Lakehouse Lab's. |
| Prediction | E.g. the watermark is stored on completion, the copy fails at 40% and nothing retries it: what does the destination hold (every row once / some twice / some missing / both)? |
| Manipulation | Watermark timing, sink, **retries**, failure point → `manipulation`. |
| Observation | The manifest's missed and duplicated row ids, and the run's steps → `observed`. |
| Reasoning | Which setting caused the loss or the repeat → `explanation_mechanisms`, `correct`. |
| Transfer / apply | The same failure with an upsert sink and one retry, or with a late file. Its own challenge, `transfer`. |
| Explanation | When the watermark should move, and why → `explanation_text`. |
| Retrieval | What a retry repeats when the sink appends, and why a watermark cannot see a late file. |
| Roadmap topics | 32; 50 (the retry half) |
| Guide chapters | `incremental`, `recovery` |
| Specific completion | No new model code. Any lever E2 needs that `adfModel.ts` lacks is a scope change. |

### E3. Trigger Behaviour

| | |
|---|---|
| Purpose | Show how schedule, tumbling-window and storage-event triggers treat the same late or out-of-order file differently, within one window. |
| Model reused | **`adfModel.ts`**: the `trigger` lever (schedule / tumbling / event) with `lateFile` and `outOfOrder`, and the `tumbling-reruns`, `event-per-file`, `late-file` and `out-of-order` couplings. One window only (S3). |
| Facts (pack) | A tumbling window copies its own window and is re-run whole; a storage event fires per file; schedule triggers run on the clock regardless of arrival (`triggers`). |
| Prediction | Which trigger loses the late file's rows, which repeats rows, which keeps everything. |
| Manipulation | Trigger, late file, out-of-order, sink → `manipulation`. |
| Observation | The manifest per trigger → `observed`. |
| Reasoning | Watermark-driven vs window-driven vs per-file selection → `explanation_mechanisms`, `correct`. |
| Transfer / apply | The other arrival fault (out of order instead of late) with a trigger chosen by the learner, `transfer`. |
| Explanation | Which trigger fits which feed → `explanation_text`. |
| Retrieval | What a tumbling-window re-run copies, and why an event trigger cannot rescue a watermark-skipped file. |
| Roadmap topics | 16, 17, 18, 19 |
| Guide chapter | `triggers` |
| Specific completion | No backfill, no `maxConcurrency` window behaviour, no multi-window history anywhere in the experiment or its copy (S3). |

### E4. Copy Performance

| | |
|---|---|
| Purpose | Show where more DIUs or parallel copies stop helping because another bottleneck binds, and what each step costs. |
| Model reused | **None exists.** `adfModel.ts` has no throughput. A new pure module, `copyPerfModel.ts`, with its own couplings, is justified. |
| Facts (pack) | DIUs apply on an Azure IR, up to 256, and **availability depends on the IR and the scenario** (no universal range, C3). Parallel copies are threads. Microsoft's sizing example (100 GB for 1.2667 DIU-hours) is for a proof of concept, not a promise (`copy`, `performance-cost`, `fine-tuning`). |
| Assumptions (couplings) | Network ceiling, source read ceiling, staging on/off effect, a per-DIU-hour price labelled as an assumption. |
| Prediction | What doubling DIUs does to duration once the source is the bottleneck. |
| Manipulation | DIUs, parallel copies, staging → `manipulation`. |
| Observation | Throughput, duration, DIU-hours, cost → `observed`. |
| Reasoning | Which bottleneck binds → `explanation_mechanisms`, `correct`. |
| Transfer / apply | A different source ceiling. The learner picks the cheapest setting that meets a deadline. `transfer`. |
| Explanation | A sizing rule in the learner's words → `explanation_text`. |
| Retrieval | Why DIUs help only up to the slowest link, and what a proof of concept is for. |
| Roadmap topics | **51**, 52 |
| Guide chapters | `copy`, `fine-tuning`, `performance-cost` |
| Specific completion | No universal DIU range and no throughput figure presented as Microsoft's unless the pack says so. |

### E5. Fault Tolerance (one experiment, two fault modes)

| | |
|---|---|
| Purpose | Show that a pipeline can *report* success while data or steps were lost. Errors become visible only when they are routed (dependency paths) or kept (rejected rows), and a retry fixes only transient faults. |
| Fault modes in scope | **(a) Dependency failure paths.** Content: `pipelines` ("every activity has four exits: on success, on failure, on completion and on skip"), `monitoring` ("a green run can hide a failure"), `pitfalls`; topic 10. **(b) Bad-row handling.** Content: `bad-rows`, `sensitive-data`; scenarios 6 and 18; topic 28. Both are taught in the shipped pack and named by the prototype, so both are in scope **as modes of this one experiment**. They share one page, one concept id and the same loop. Each mode has its own challenges (`adf.lab.fault-tolerance.dependency-*`, `adf.lab.fault-tolerance.bad-rows-*`). |
| Fault modes out of scope | **Timeout behaviour.** Not modelled by any production model (S2). The pack's timeout and retry defaults may be stated as facts; nothing times out in the simulation. |
| Model reused | **Partly.** The transient-failure and retry semantics (`failureAtPercent`, `retries`) come from `adfModel.ts` and are reused, not rewritten. Neither fault mode exists in a production model: there is no activity graph with dependency conditions, and no row-level validity. One new pure module, `faultToleranceModel.ts`, beside `adfModel.ts`, with its own couplings, is justified for exactly these two modes. Row counts must come from typed couplings or a pack dataset, never from the prototype's constants (50,000 rows / 120 bad). |
| Prediction | (a) A copy fails and its on-failure alert step is wired: what is the pipeline's reported status, and does the alert run? (b) With "skip incompatible rows" and no logging, how many rows land, and what tells anyone the rest are missing? |
| Manipulation | (a) Which exits are wired (success / failure / completion / skip), retries before failure. (b) Abort / skip / skip-and-log → `manipulation`. |
| Observation | (a) Activity statuses, the pipeline's reported status, which steps ran. (b) Rows landed, rows rejected, whether a rejected-row record exists → `observed`. |
| Reasoning | Why a green run hid a failure, or why skipping without logging is silent loss → `explanation_mechanisms`, `correct`. |
| Transfer / apply | The other mode's question, or the same mode on a new pipeline shape. `transfer`. |
| Explanation | How the learner would make failures visible → `explanation_text`. |
| Retrieval | The four dependency exits and which one runs "whatever happens"; why a retry cannot fix a type-conversion error (`recovery`: "when NOT to use retries"). |
| Roadmap topics | 10, 28; 27 (type conversion, the cause of most rejected rows); 50 (retries) |
| Guide chapters | `pipelines`, `monitoring`, `bad-rows`, `recovery` |
| Specific completion | Both modes complete. Retry behaviour is identical to `adfModel.ts` on the same inputs (a shared test). No timeout simulation. |

---

## 4. Shared architecture

### 4.1 Persistence: one path

Every stage writes to `learning_attempts` through the existing API (`POST /api/v1/learning/attempts`,
`PATCH /api/v1/learning/attempts/{uid}`) and `LearningService`. No schema change is expected. If one
is needed, repo rule 10 applies (regenerate OpenAPI and the TypeScript types).

| Stage | Field | Rule the server already enforces |
|---|---|---|
| open | `attempt_uid`, `challenge_id`, `concept_id`, `scenario_fingerprint`, `mode`, `subject_id` | idempotent on uid |
| Prediction | `prediction`, `committed_at` | write-once; a different second prediction → 400 |
| Manipulation | `manipulation` `{param: {from, to}}` | only after a commit; write-once |
| Observation | `observed` `{outcome: {label, before, after}}` | only after a commit; write-once |
| Reasoning | `explanation_mechanisms`, `selected_alternative_ids`, `rubric_coverage`, `correct` | `correct` only on completing a committed attempt |
| Transfer / apply | `transfer`, on the transfer challenge's own attempt | nullable: NULL means "not established", never false |
| Explanation | `explanation_text` (≤ 4000 chars) | only after a commit; never graded |
| complete | `completed`, `completed_at`, `duration_ms`, `hint_count` | an uncommitted attempt cannot be completed |

- **Subject:** `subject_id` is the ADF preparation the learner is working in, from
  `PreparationContext`. It is never 2 (the Lakehouse Lab's seeded Databricks subject) and never a
  default. With no preparation chosen, the lab asks for one; it does not pick.
- **Ids:** `attempt_uid` is deterministic per (subject, pack version, challenge) and at most 64
  characters. It follows the shape of `labAttemptUid` (`lk:…`) but with its own prefix (e.g.
  `ab:<subjectId>:adf@<version>:<slug>`), so ADF lab attempts are told apart by id, never by
  guessing.
- **Fingerprint:** `scenario_fingerprint` is the experiment's lever key (the `leversKey` pattern), so
  transfer is checked mechanically.
- **Mode:** `guided` for the loop; `retrieval` for the Retrieve stage. The column is a free string of
  up to 20 characters.

### 4.2 Roadmap and guide linkage

Use the production mapping, not the prototype's numbers:
- Each pack chapter's "Roadmap alignment" block names topic numbers, and
  `content_pack_service.get_pack_roadmap_alignments('adf')` indexes them.
- An experiment declares topic **numbers** and chapter **ids** (section 3).
- It resolves database rows through the roadmap linked to the ADF preparation. That roadmap's
  `title` column holds the topic number, so a database topic id is never hard-coded.
- A topic with no real experiment shows no "Lab available" badge.

### 4.3 Evidence (Phase 5 scope)

In Phase 5 the evidence *is* the completed `learning_attempts` rows: committed prediction, recorded
manipulation and observation, correctness, transfer, and the learner's explanation, all with
timestamps. They can be read with `GET /api/v1/learning/attempts?subject_id=<ADF>`. Phase 5 builds no
Evidence page, writes no Workspace artifact, and creates no evidence of any other kind. Phase 6 reads
these rows; nothing is seeded for it.

### 4.4 Model and facts

- A fact comes from the ADF pack, which is grounded in Microsoft Learn. An assumption is a typed
  coupling (`type: 'assumption' | 'convention'`) with a `uiLabel` shown on screen. The two are never
  mixed, and Microsoft facts are never confused with course recommendations.
- The same levers in give the same outcome out, so a committed prediction is checked against a
  reproducible result.

### 4.5 Retrieve (S4)

Retrieve is a short recall challenge, opened later and recorded as its own attempt (`mode:
'retrieval'`, prediction = the answer, `correct` on completion). It makes **no** scheduling claim:
the prototype removed its SM-2 interval promises, and production must not reintroduce them. It does
not write to `topic_demonstrations`.

### 4.6 Terminology and navigation

- ADF's lab is the "Behaviour Lab". Databricks' is the "Lakehouse Lab" / "Open Lakehouse Lab" at
  `/databricks-sandbox`. The two never cross.
- Proposed routes are `/lab/adf` and `/lab/adf/experiments/<slug>`. They are not created until Phase
  5 starts.
- Each new route goes into the `ROUTES` lists of `e2e/accessibility.spec.ts`,
  `e2e/responsive.spec.ts` and `e2e/navigation.spec.ts`, and gets a card in `LearningLabPage.tsx`
  (see the `add-learning-lab-sandbox` skill).
- The rail's `lab` entry and Home's lab branch already switch on with `learningLabStatus ===
  'AVAILABLE'`. They need no redesign.

---

## 5. When ADF's lab becomes AVAILABLE

ADF's `learningLabStatus` changes from `INTEGRATION_PENDING` to `AVAILABLE` in
`frontend/src/services/capabilities.ts` only when all of the following hold:

1. All five experiments meet their completion criteria (section 3).
2. The tests in section 6 exist and pass, in the full suites, not just their own files.
3. The new routes are in the three E2E route lists and pass axe in both themes and at 390 px.
4. The tests that pin `INTEGRATION_PENDING` are updated deliberately in the same change, and nothing
   else silently flips: `capabilities.test.ts`, `HomePage.phase3.test.tsx`,
   `HomePage.phase4.test.tsx`, `Sidebar.test.tsx`, `navigation.test.ts`.

One working experiment does not make the lab AVAILABLE.

---

## 6. Tests the implementation must add

- **Model:** pure, deterministic unit tests for each new module (`concurrencyModel`,
  `copyPerfModel`, `faultToleranceModel`), per lever, including its couplings ledger. Every
  assumption the model uses is listed, and every listed one is used. E2 and E3 add no model tests
  beyond `adfModel.ts`'s own, which keep passing. E5's retry behaviour matches `adfModel.ts` on the
  same inputs.
- **Accuracy:**
  - no universal DIU range;
  - no exact-connection-count claim;
  - batchCount and retry limits exactly as the pack states them;
  - no timeout simulation (S2) and no backfill (S3);
  - the pack's own content tests keep passing.
- **Loop integrity (frontend):**
  - levers stay locked until a prediction is committed;
  - the reveal text is absent before the commit;
  - a committed prediction cannot be edited in the UI;
  - transfer and retrieval are separate challenges.
- **Persistence (backend):**
  - a second, different prediction → 400;
  - `manipulation` / `observed` / `explanation_text` before a commit → 400;
  - completing an uncommitted attempt → 400;
  - retried identical writes are idempotent;
  - the ADF challenge ids and subject are covered.
- **Subject isolation:**
  - ADF lab attempts carry the ADF preparation's id and never appear under Databricks;
  - Lakehouse Station A attempts never appear under ADF;
  - with no preparation chosen, nothing is written.
- **Terminology:**
  - no "Behaviour Lab" on any Databricks surface (extend the existing Home and Learning Lab hub
    tests);
  - ADF surfaces stop saying "Integration Pending" only once AVAILABLE.
- **Capability flip:** ADF's `learningLabStatus` is AVAILABLE, and the rail and Home lab CTAs route
  to `/lab/adf`.
- **E2E:**
  - route coverage, axe, 390 px;
  - one journey that commits a prediction, reloads, and finds it still committed (held by the server,
    not the browser).
- **Overlap:** two quick commits, and a reload mid-commit, end as one attempt with one prediction
  (see the overlap rule in `CLAUDE.md`).

---

## 7. Open questions

None block Phase 5. S1-S4 settled the scope decisions that were previously open. Changing any of
them, or adding an experiment, is a scope change and needs a decision from the product owner, not an
implementation choice.
