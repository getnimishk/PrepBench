# Phase 5 contract: the ADF Behaviour Lab

**Status: not started.** This is the design contract a Phase 5 implementation must satisfy. Nothing
here is built. ADF's `learningLabStatus` stays `INTEGRATION_PENDING` until the conditions in
[When ADF's lab becomes AVAILABLE](#when-adfs-lab-becomes-available) are met.

Written 2026-10-07 from: the unified prototype (`prototypes/unified-prototype/`, local only:
`src/data/labDefinitions.ts` and the five `Adf*ExperimentPage.tsx` files), the production
Lakehouse stack (`frontend/src/services/lakehouse/`, `components/lakehouse/`), the learning layer
(`backend/app/services/learning_service.py`, `models/learning_attempt.py`,
`frontend/src/services/learning/`), the ADF content pack (`backend/app/content/packs/adf/v1.json`),
and `docs/research/ADF_Study_Guide_Roadmap_Crosswalk.md`.

---

## 1. The rule that shapes everything

```
prototype experiment experience
        ↓
the existing production behaviour model (services/lakehouse/*Model.ts + typed couplings)
        ↓
LearningService / learning_attempts  (the only persistence)
        ↓
the existing roadmap ↔ study-guide mapping (pack "Roadmap alignment" blocks)
        ↓
Workspace / Evidence (Phase 6 -- not this phase)
```

Prohibited: a standalone ADF simulator with its own state model, a second persistence path, any
`localStorage` store for attempts, artifacts or evidence, and seeded or demo evidence. The
prototype's `workspaceStore.ts` / `evidenceStore.ts` (`localStorage`, `isSeed: true` records) are
**not** a production pattern; `learning_attempts` exists precisely because browser storage made a
browser the system of record (see the model's docstring).

A *new pure model module* is allowed only where the existing models demonstrably cannot express the
behaviour (section 3 says where). It must follow the Lakehouse pattern: pure, deterministic
functions, no clock, no randomness, and every assumption a typed entry in a couplings ledger shown
on screen (`pipelineCouplings.ts` is the template).

---

## 2. The canonical experiment list, and the conflicts in its sources

### What the sources say

| Source | Experiments |
|---|---|
| Prototype registry (`labDefinitions.ts`) | 5: `adf-concurrency`, `adf-watermark`, `adf-triggers`, `adf-copy-perf`, `adf-fault-tolerance` |
| Prototype hub page, docs, `CLAUDE.md`, capability registry comments | "5 behaviour labs" (same five) |
| Production Home (Phase 3, pending cards) | names two: Concurrency & Parallelism Budget; Watermark CDC & Fault Tolerance |
| Earlier product discussion (not in the repository) | 6: Dependency, Retry/Timeout, Concurrency, Copy Performance, Trigger Behaviour, Fault Tolerance |

The six-item list appears nowhere in the repository. The five-item list is consistent across every
repository source. **Proposed canonical list: the five below.** It does not invent a sixth.

### How complete the prototype actually is

Only one prototype experiment implements the full loop. The others are much thinner than their
`status: 'mature'` label says:

| Prototype page | Lines | Prediction lock | Reason | Transfer | Retrieve |
|---|---:|:-:|:-:|:-:|:-:|
| Concurrency | 943 | yes | yes | yes | yes |
| Watermark | 566 | yes | partial | no | no |
| Triggers | 122 | no | no | no | no |
| Copy performance | 157 | no | no | no | no |
| Fault tolerance | 120 | no | no | no | no |

So for three of the five, the prototype supplies a topic and an outcome table, not a learning loop.
The loop content (prediction options, causal choices, transfer cases, retrieval prompts) has to be
authored in Phase 5, grounded in the ADF pack -- not lifted from the prototype.

### Conflicts recorded, not resolved

- **C1. Fault tolerance means two different things.** The registry entry is "Error Handling,
  Conditional Branching & Dead-Letter Queues", mapped to topic 10 (Dependencies) and chapter
  `recovery`. The page it routes to models Copy-activity *bad-row* handling (abort / skip / skip and
  redirect) and logs its evidence against topic 27. Those are two experiments. **Decision needed:**
  E5 is either (a) dependency conditions and failure paths (topic 10) or (b) bad-row fault tolerance
  (topic 28). The six-item list contains both "Dependency" and "Fault Tolerance", which suggests (a)
  and (b) are both wanted -- that would make six, and is the user's call, not this contract's.
- **C2. Retry/Timeout.** In the five-item list it is not an experiment of its own: retries are a
  lever of the watermark experiment (Station A's `retries`, 0-3) and of the fault-tolerance one.
  The six-item list makes it separate. **Decision needed** if it should stand alone (topic 50,
  chapter `recovery`).
- **C3. The prototype's topic mappings are partly wrong.** Checked against the crosswalk (topic
  numbers are the roadmap's 1-60, not database ids):
  - correct: 10 Dependencies, 12 ForEach/batchCount, 17 Tumbling window, 32 Watermark patterns,
    53 Scale & concurrency;
  - wrong: 26 is *Connectors, formats* (prototype pairs it with triggers); 27 is *Schema mapping and
    type conversion* (prototype calls it "Copy Activity Optimization & DIUs" and logs bad rows to
    it); 52 is *Cost model* (prototype pairs it with watermark). Copy performance is topic **51**;
    bad rows are topic **28** (chapter `bad-rows`).
- **C4. The prototype's lab facts break the ADF accuracy rules.** `labDefinitions.ts` states
  "Cloud-to-cloud copy auto-scales between 2 and 256 DIUs" and treats
  runs × batchCount × parallelCopies as an exact connection count. Both are forbidden by the ADF
  accuracy rules (DIU availability depends on the IR and scenario; the product is an upper-bound
  planning model, not a runtime law). Nothing may be ported from it unchecked.

---

## 3. The experiments

Shared by all five (section 4 has the detail): persisted as `learning_attempts` on the **ADF
preparation**, challenge ids under `adf.lab.<experiment>.<challenge>`, facts from the ADF pack only,
assumptions as typed couplings, retrieval without SM-2 claims.

### E1. Concurrency budget

| | |
|---|---|
| Prototype source | `adf-concurrency`, `AdfConcurrencyExperimentPage.tsx` (the only full loop) |
| Production model to reuse | **None models concurrency.** Station A's `adfModel.ts` runs one batch of ten files. A new pure module is justified here, in the Lakehouse pattern, with its own couplings ledger. It must not duplicate `runPipeline`. |
| Facts (from the ADF pack) | ForEach `batchCount` 1-50, default 20; pipeline concurrency has no maximum by default and runs queue when one is set and reached; parallel copies are threads per copy |
| Assumptions (couplings, on screen) | source connection-pool size, headroom target, per-connection timeout; connection demand ≈ concurrent runs × batchCount × parallel copies as an **upper-bound planning model** |
| Predict | before any lever moves: what happens to a 100-table load against a capped source when batchCount is raised. Write-once `prediction` |
| Manipulate | pipeline concurrency, batchCount, parallel copies, pool cap → `manipulation` `{param: {from, to}}` |
| Observe | demand vs cap, queued vs failed tasks, duration → `observed` `{outcome: {label, before, after}}` |
| Reason | choose the causal chain (pool exhaustion vs throughput ceiling vs queueing) → `explanation_mechanisms`, `selected_alternative_ids`, `correct` |
| Apply / transfer | a new constraint profile (different cap and table count) as its own challenge, `transfer: true` on success |
| Explain | the learner's own budget rule → `explanation_text` (never graded) |
| Retrieve | a later retrieval challenge, its own attempt (section 4.5) |
| Roadmap topics | 12 (ForEach, batch count and parallelism), 53 (Scale and concurrency trade-offs) |
| Guide chapters | `pipelines`, `fine-tuning`, `performance-cost` |

### E2. Watermark timing and transient failure

| | |
|---|---|
| Prototype source | `adf-watermark`, `AdfWatermarkExperimentPage.tsx` (prediction lock, partial reasoning) |
| Production model to reuse | **`adfModel.ts` as is**: `runPipeline` with `watermark` (before / success / completion), `sink` (append / upsert), `retries`, `failureAtPercent`, `lateFile`, `outOfOrder`, `deletes`. Its couplings (`watermark-timing`, `transient-failure`, `append-repeats`, `delete-invisible`, …) are reused, not rewritten. |
| Existing challenge pattern | `WATERMARK_CHALLENGE` in `pipelineChallenges.ts`. Phase 5 adds ADF-scoped challenges in the same shape. Station A's own challenge stays the Lakehouse Lab's. |
| Predict | e.g. watermark stored on completion, copy fails at 40%, no retry: what does the destination hold? |
| Manipulate | watermark timing, sink, retries, failure point → `manipulation` |
| Observe | the manifest's missed and duplicated row ids, which are real ids from the pack's source index → `observed` |
| Reason | which setting caused the loss or repeat → `explanation_mechanisms`, `correct` |
| Apply / transfer | the same failure with an upsert sink, or a late file: its own challenge, `transfer` |
| Explain / Retrieve | `explanation_text`; retrieval challenge |
| Roadmap topics | 32 (Watermark patterns); 50 (Reliability, idempotency and recovery) for the retry half |
| Guide chapters | `incremental`, `recovery` |

### E3. Trigger behaviour

| | |
|---|---|
| Prototype source | `adf-triggers` (no loop: a configure-and-show page) |
| Production model to reuse | `adfModel.ts`'s `trigger` lever (schedule / tumbling / event) with the `tumbling-reruns`, `event-per-file`, `late-file` and `out-of-order` couplings. It models one window. **Multi-window backfill and `maxConcurrency` are not modelled.** Either extend `adfModel.ts` (the same module, new couplings) or keep E3 to what one window shows. The choice must be recorded in the PR. |
| Facts (pack) | tumbling-window backfill runs one per historical window, sequentially or up to `maxConcurrency`; tumbling windows support retry policies; storage events fire per file |
| Loop | predict which trigger loses, repeats or keeps a late file's rows → change trigger, late or out-of-order → observe the manifest → reason → transfer to the other trigger type |
| Roadmap topics | 16 (Schedule), 17 (Tumbling window), 18 (Event and custom event), 19 (Time zones and window semantics) |
| Guide chapter | `triggers` |

### E4. Copy performance

| | |
|---|---|
| Prototype source | `adf-copy-perf` (no loop) |
| Production model to reuse | **None models throughput.** A new pure module is justified, with couplings, beside `adfModel.ts` |
| Facts (pack) | DIUs apply on an Azure IR, up to 256, and **availability depends on the IR and scenario** (no universal range); parallel copies are threads; Microsoft's sizing example (100 GB for 1.2667 DIU-hours) is for a proof of concept, not a promise |
| Assumptions (couplings) | network bottleneck, source read ceiling, a stated per-DIU-hour price clearly labelled as an assumption |
| Loop | predict where doubling DIUs stops helping → move DIUs, parallel copies, staging → observe throughput, duration, cost → reason (which bottleneck binds) → transfer to a different source ceiling |
| Roadmap topics | **51** (Copy performance: DIUs, parallel copies and bottlenecks), 52 (Cost model) |
| Guide chapters | `copy`, `fine-tuning`, `performance-cost` |

### E5. Fault tolerance (scope pending decision C1)

| | (a) Dependencies and failure paths | (b) Bad rows |
|---|---|---|
| Prototype source | registry entry `adf-fault-tolerance` | `AdfFaultToleranceExperimentPage.tsx` |
| Production model | none. `adfModel.ts` injects one failure but has no activity graph or dependency conditions | none. `adfModel.ts` has no row-level validity |
| Facts (pack) | Success / Failure / Completion / Skipped dependencies decide pipeline status; retry 0-10, interval 30-86400 s, default retry 0, default timeout 12 h | skip incompatible rows, log them to a session log; skipping without logging hides data loss |
| Roadmap topics | 10; 50 for retries | **28** (fault tolerance and skipped rows), 27 (type conversion) |
| Guide chapters | `pipelines`, `monitoring`, `recovery` | `bad-rows` |

Either way the loop is the same: predict the run status or row counts → change the policy →
observe → reason → transfer → explain → retrieve.

---

## 4. Shared architecture

### 4.1 Persistence: one path

Every stage writes to `learning_attempts` through the existing API
(`POST /api/v1/learning/attempts`, `PATCH /api/v1/learning/attempts/{uid}`) and `LearningService`.
No schema change is expected. If one is needed, rule 10 applies (OpenAPI and TypeScript
regeneration).

| Stage | Field | Rule already enforced by the server |
|---|---|---|
| open | `attempt_uid`, `challenge_id`, `concept_id`, `scenario_fingerprint`, `mode`, `subject_id` | idempotent on uid |
| Predict | `prediction`, `committed_at` | write-once; a different second prediction → 400 |
| Manipulate | `manipulation` `{param: {from, to}}` | only after a commit; write-once |
| Observe | `observed` `{outcome: {label, before, after}}` | only after a commit; write-once |
| Reason | `explanation_mechanisms`, `selected_alternative_ids`, `rubric_coverage`, `correct` | `correct` only on completion of a committed attempt |
| Apply | `transfer` on the transfer challenge's own attempt | nullable: NULL is "not established", never false |
| Explain | `explanation_text` (≤ 4000 chars) | only after a commit; never graded |
| complete | `completed`, `completed_at`, `duration_ms`, `hint_count` | an uncommitted attempt cannot be completed |

- **Subject:** `subject_id` = the ADF preparation the learner is working in, from
  `PreparationContext`. Never 2 (the Lakehouse Lab's seeded Databricks subject), and never a
  default. With no preparation chosen the lab asks for one; it does not pick.
- **Ids:** `challenge_id` = `adf.lab.<experiment>.<challenge>` (e.g. `adf.lab.concurrency.pool-exhaustion`);
  `concept_id` = `adf.lab.<experiment>`; `attempt_uid` deterministic per (subject, pack version,
  challenge), ≤ 64 chars, in the shape of `labAttemptUid` (`lk:…`) but with its own prefix (e.g.
  `ab:<subjectId>:adf@<version>:<slug>`) so ADF lab attempts are told apart by id, never by guessing.
- `scenario_fingerprint` = the experiment's lever key (the pattern of `leversKey`), so transfer is
  checked mechanically.
- `mode` = `guided` for the loop; `retrieval` for the Retrieve stage (the column is a free
  20-character string).

### 4.2 Roadmap and guide linkage

Use the production mapping, not the prototype's numbers. Each pack chapter's "Roadmap alignment"
block names topic numbers; `content_pack_service.get_pack_roadmap_alignments('adf')` indexes them.
An experiment declares its topic **numbers** and chapter **ids** (section 3). It resolves database
topic rows through the roadmap linked to the ADF preparation. The roadmap's `title` column holds
the topic number for this roadmap, so it must never hard-code a database topic id. A topic with no
real experiment shows no "Lab available" badge.

### 4.3 Evidence (Phase 5 scope)

In Phase 5 the evidence *is* the completed `learning_attempts` rows: committed prediction, recorded
manipulation and observation, correctness, transfer, and the learner's explanation, with
timestamps. They are readable with `GET /api/v1/learning/attempts?subject_id=<ADF>`. Phase 5 builds
no Evidence page, writes no Workspace artifact, and creates no evidence records of any other kind.
Phase 6 reads these rows; nothing is seeded for it.

### 4.4 Model and facts

- A fact comes from the ADF pack, which is grounded in Microsoft Learn. An assumption is a typed
  coupling (`type: 'assumption' | 'convention'`) with a `uiLabel` shown on screen. The two are never
  mixed, and Microsoft facts are never confused with course recommendations.
- Same levers in, same outcome out: no clock, no randomness, so a committed prediction can be
  checked against a reproducible result.
- The reveal text for an outcome is shown only after the prediction is committed (the
  `PipelineChallenge.reveal` pattern).

### 4.5 Retrieve

Retrieve is a short recall challenge opened later, recorded as its own attempt (`mode:
'retrieval'`, prediction = the answer, `correct` on completion). It makes **no** scheduling claims:
the prototype removed its SM-2 interval promises and production must not reintroduce them. If
spaced re-checks are wanted, the existing mechanism is the topic demonstration re-check
(`topic_demonstrations.next_recheck_at`) on the mapped roadmap topic. Whether to use it is a Phase 5
decision; it must not be a second scheduler.

### 4.6 Terminology and navigation

- ADF: "Behaviour Lab". Databricks: "Lakehouse Lab" / "Open Lakehouse Lab" at `/databricks-sandbox`.
  The two names never cross.
- Proposed routes: `/lab/adf` and `/lab/adf/experiments/<slug>`. These are not created until Phase 5
  starts. Each new route goes into the `ROUTES` lists of `e2e/accessibility.spec.ts`,
  `e2e/responsive.spec.ts` and `e2e/navigation.spec.ts`, and gets a card in `LearningLabPage.tsx`
  (see the `add-learning-lab-sandbox` skill).
- The rail's `lab` entry and Home's lab branch already switch on with `learningLabStatus ===
  'AVAILABLE'`; they need no redesign.

---

## 5. When ADF's lab becomes AVAILABLE

`learningLabStatus` for ADF changes from `INTEGRATION_PENDING` to `AVAILABLE` in
`frontend/src/services/capabilities.ts` only when all of these hold:

1. Every experiment in the agreed Phase 5 scope (the five above, with C1/C2 decided) runs the full
   loop against a production model, persisting only through `learning_attempts`.
2. The tests in section 6 exist and pass, in the full suites, not just their files.
3. The new routes are in the three E2E route lists, and pass axe in both themes and at 390 px.
4. The tests that pin `INTEGRATION_PENDING` (`capabilities.test.ts`, `HomePage.phase3.test.tsx`,
   `HomePage.phase4.test.tsx`, `Sidebar.test.tsx`, `navigation.test.ts`) are updated deliberately in
   the same change, and nothing else silently flips.

Per experiment, "available" means its model, its challenges, persistence and tests all exist. One
working experiment does not make the lab AVAILABLE.

---

## 6. Tests the implementation must add

- **Model:** pure, deterministic unit tests per model and per lever, including the couplings ledger
  (every assumption the model uses is listed, and every listed one is used).
- **Accuracy:** no universal DIU range, no exact-connection-count claim, batchCount and retry limits
  as the pack states them. The pack's own content tests keep passing.
- **Loop integrity (frontend):** levers locked until a prediction is committed; reveal text absent
  before the commit; a committed prediction cannot be edited in the UI; transfer is a separate
  challenge.
- **Persistence (backend):** a second, different prediction → 400; `manipulation` / `observed` /
  `explanation_text` before a commit → 400; completing an uncommitted attempt → 400; retried
  identical writes are idempotent. Existing `LearningService` tests cover the rules; add tests for
  the ADF challenge ids and subject.
- **Subject isolation:** ADF lab attempts carry the ADF preparation's id and never appear under
  Databricks; Lakehouse Station A attempts never appear under ADF; no preparation chosen → nothing is
  written.
- **Terminology:** no "Behaviour Lab" on any Databricks surface (extend the existing Home and Learning
  Lab hub tests); ADF surfaces stop saying "Integration Pending" only when AVAILABLE.
- **Capability flip:** ADF `learningLabStatus` is AVAILABLE, and the rail and Home lab CTAs route to
  `/lab/adf`.
- **E2E:** route coverage, axe, 390 px; one journey that commits a prediction, reloads, and finds it
  still committed (server-held, not browser-held).
- **Overlap:** two quick commits, and a reload mid-commit, end as one attempt with one prediction
  (see the overlap rule in `CLAUDE.md`).

---

## 7. Decisions needed before Phase 5 starts

- **D-P5-1** (C1): E5 is dependency failure paths, bad-row fault tolerance, or both (both makes six
  experiments).
- **D-P5-2** (C2): is Retry/Timeout an experiment of its own, or a lever of E2/E5?
- **D-P5-3** (E3): extend `adfModel.ts` to multi-window backfill and `maxConcurrency`, or scope E3 to
  one window.
- **D-P5-4** (4.5): Retrieve as a standalone retrieval attempt only, or also feeding the topic
  demonstration re-check.
