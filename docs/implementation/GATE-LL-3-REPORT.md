# Lakehouse Lab Phase 3 Gate Report — Stations A and B, and the Downstream Flow

**Date:** 2026-10-03 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-lab-phase-3`

**Ruling:** the pipeline level is one connected flow. Station A simulates an ADF + Lakeflow load
over the pack's real source rows and produces a batch manifest; Station C writes exactly that
manifest into a real Delta table and the real engine measures what is there; Station B simulates
ADLS (layout, the access puzzle, tier and lifecycle cost). PRD P0-5, P0-6, P0-7 and the Phase 3
exit: **a watermark mistake in Station A shows as real rows in Station C**. **Gate decision: PASS.**
Open items that aren't this phase's are at the end.

---

## Audit: what the work found

1. **The prototype's A and B were fixed numbers, not models.** Its `runPipeline` returned 260 and
   3,110 whatever the settings. Both stations are now deterministic models: Station A runs over the
   pack's real source index (5,000 rows, with the batch each arrives in), so the ids it says were
   lost or repeated are real ids; Station B reads every figure from the pack's new `pipeline.json`.
2. **The real engine confirms what the model says.** A manifest naming 740 of batch 2's 1,000 ids
   leaves exactly **260** real rows missing (counted through `QueryBuilder`); a manifest repeating
   260 ids stores 260 rows twice; the same repeats merged on the key change nothing. In the browser,
   against the real engine, the default scenario (watermark moved before the copy, failure at 60%,
   no retry) gave: model "400 rows missed (ids 1601–2000), 0 repeated"; engine "400 and 0. They
   agree." Station C prints that cross-check, and says when the two differ.
3. **Four small backend additions were needed, all schema-visible** (OpenAPI and the generated
   types regenerated, the contract check extended to seven lab shapes): `append_batch` takes an
   optional `manifest` of ids; `compare_tables` takes an optional `through_batch`, so a table
   loaded through batch 2 isn't reported as missing batches 3 to 5; the source index carries
   each row's `batch`; the pack can carry a `pipeline.json`. A repeated id in a manifest is written
   twice on an append and once on a merge; an unknown id, or ids from batches with different
   columns, are refused (400) before the engine is touched.
4. **A model bug, found by a test.** Under an event trigger a run queries the source for everything
   newer than the watermark among the rows that have arrived, so a failed file's rows are copied
   again by the next run. My first version limited each run to its own file and lost them. The
   test of the trigger's blast radius caught it. Fixed; the model is now also checked by
   invariants over **every combination of 1,152 lever settings** (each expected row is landed,
   missed or pending, never none and never two; repeats match an independent tally; nothing
   outside the source is written).
5. **The mockup's numbers (260 of 3,110, ids 3121–3380) are the prototype's.** The pack's batch is
   1,000 rows: the challenge's scenario loses 400 (ids 1601–2000). The default upstream, stated on
   screen ("Using the default upstream: nothing goes wrong"), is a scheduled incremental load with
   the watermark updated when the copy succeeds, an append, deletes handled, and no failure: a
   clean batch.
6. **The comparison in Station C includes the legacy job's planted value differences**, which have
   nothing to do with Station A. The cross-check says so beside its numbers.

## Implemented

| Plan task | Where |
|---|---|
| `source-index` endpoint | existed (Phase 1A); it now also says which batch each row arrives in |
| `adfModel`: a `BatchManifest` from levers (full vs incremental, watermark timing with an injected failure, retries, sink, trigger kind against late and out-of-order files, deletes, which orchestrator owns each trigger) | `services/lakehouse/adfModel.ts` |
| `adlsModel`: hierarchical namespace (atomic rename vs a copy per object), landing layout, the access puzzle (RBAC scope vs a directory ACL plus execute on the parents), tier and lifecycle cost. **No landing files** (design §4.5) | `services/lakehouse/adlsModel.ts` |
| Ledger entries for A and B, completeness extended | `pipelineCouplings.ts` (A: 3 arithmetic, 8 assumptions, 4 conventions; B: 3, 8, 2), `CouplingLedger.tsx` |
| `append_batch` accepts a manifest; the server writes exactly those rows | `schemas/lab.py`, `services/lab/operations.py` |
| `StationA`, `StationB` | `components/lakehouse/StationA.tsx`, `StationB.tsx` |
| The downstream flow: A's manifest → Station C's fifth challenge, "Load Station A's batch" | `stationC.ts` (`downstreamChallenge`), `DatabricksSandboxPage.tsx` |
| A default upstream stated on screen | "Using the default upstream: nothing goes wrong" / "the upstream you last ran in Station A", with a way back to A |
| Journal entries from A and B are simulations | `addLakehouseJournalEntry`; the server forces the source |

**Decisions the plan left open**
- *The two predictions* are real, write-once attempts (`lakehouse.a.watermark-order`,
  `lakehouse.b.vendor-access`), their outcomes worked out by the models and recorded as
  simulations, like Station F's. Station C's downstream challenge has its own attempt per upstream
  (a short hash of the settings in the id), so changing Station A's settings means a new prediction.
- *A tumbling window ignores the watermark and the load type* (it copies its own window and re-runs
  it whole), and *an event trigger ignores the load type* (one run per file). The page says so
  beside the disabled controls instead of pretending they apply.
- *Station A's upstream is remembered for the session* (sessionStorage), and anything unreadable
  falls back to the default upstream.
- *Station B has no data effect on C* (design: no landing files). It says so in its ledger.
- *The page lists all four stations and no longer has an "(not built yet)" state.*

## Exit criteria

- [x] **A watermark mistake in A shows as real rows in C**: the manifest of the default scenario,
  written for real, leaves 400 rows missing (engine suite; and live in the browser, with the model
  and the engine agreeing).
- [x] **The manifest's ids are always a subset of the source index** (invariant over 1,152
  combinations), **watermark-before-copy with a failure always loses rows and watermark-after-copy
  always repeats them** (model tests, with the retry, sink and trigger variants).
- [x] **ADLS effective permissions for each puzzle case** (allowed, denied at the first parent that
  lacks execute, denied for write or execute missing on the target, too broad under RBAC, no ACL
  without a hierarchical namespace).
- [x] **The ledger completeness test passes**: the compositions are frozen, every finding rests on a
  ledger entry, and a component test checks every entry's caveat and effect is on screen for A and B.
- [x] **Engine suite: a manifest with missing ids gives exactly that many missing rows in
  `bronze.*`**, counted through `QueryBuilder`.
- [x] **E2E: a mistake in A appears in C** (with the engine absent, the CI default: A's run, the
  hand-off, Station C's banner and upstream line, and "Real engine not installed" with no result).

## Gate checklist

| Item | Result |
|---|---|
| Backend default suite (no `deltalake`) | **942 passed, 1 skipped** (includes the real-database guard and the OpenAPI contract test) |
| Backend engine suite (`-m lab`, scratch venv, `deltalake` 1.6.6) | **18 passed** (12 earlier, 6 new) |
| `npm run typecheck` | clean (also `tsc -p e2e`); the API contract check covers seven lab shapes |
| `npm run lint` | 0 errors, **28 warnings, unchanged** |
| `npm test` | **1188 passed, 99 files** |
| Playwright, touched spec | `databricks-sandbox.spec.ts` 5 passed |
| Playwright, full suite, from PowerShell | **93 passed** (16.2 min) |
| axe light and dark, 390 px overflow | **36 checks** on the disposable setup (Station A fresh, prediction revealed, run with findings, ledger and structure checks; Station C opened from A; Station B fresh, tested with costs and checks, without a hierarchical namespace; journal drawer; × light/dark × 1280/390 px): **0 violations, 0 overflow** |
| Pre-completion checklist | counts: no nav or screen count changed; no hex colours or literal font sizes; route unchanged and in all three e2e `ROUTES`; headings h1 → h2 → h3 (h4 inside a panel for the manifest and results sections); overlap: below |
| OpenAPI | regenerated (`scripts/export_openapi.py`, redirected) and the contract test passes; `npm run types:api` run |
| Honesty review | every figure from A and B is the model's and says so ("Simulation" on every result, teaching-constant labels beside every B figure); Station C's numbers are the engine's; the journal source is right on every entry; no landing files |

**Overlap checks (checklist 5).** Both models are pure functions of their input, so a result whose
settings changed is marked stale and the hand-off to Station C is disabled until it is run again;
Station C's downstream challenge is keyed by its upstream, so a result for one upstream can't be
shown against another; a result for Station C that arrives after switching challenge is still
dropped (Phase 1B's guard).

**Failures during the phase, stated as such**
- One axe `region` violation on Station C at 390 px was a MUI tooltip left open by the audit script's
  mouse pointer after a navigation; reproduced only with the pointer resting over a header control,
  so the script now moves it away before each check. Not a page problem.
- **Two unrelated Vitest tests failed in separate full runs** (`ThemeContext`, then `RoadmapEditorPage`), each passing alone. Neither file is touched by this phase, but a pattern like that points at load, and the cause was mine: Station A's invariant tests ran about 20 s of CPU in a parallel worker, starving other tests until their timeouts fired. The model now runs each of the 1,152 combinations once and shares the result across the checks (the file runs in under 3 s), and the repeat-count check is a more independent tally. The full run after that was clean.
- Two test-only slips of mine (a test that timed out looping with `includes`, and a Playwright
  locator that matched two elements) were fixed in the tests; neither was a product bug.

## Code review: 1 finding, fixed

1. An access result was marked stale when only the tier or the layout changed, though neither can
   change who can write where; it now depends on the namespace, the grant and the ACL only; tested.

Rejected: none.

## Not in this phase (by the plan), and open

- Phase 4 (interview-ready). The rail has nothing left marked "not built yet"; Station I is a P1 item.
- **Notebook verification on Databricks Free Edition** stays the author's (PRD open question 8). The
  notebook still covers Station C's own steps only.
- **Strict side-by-side with `PrepBench_Unified_Prototype.html`** was not possible (the file isn't
  on this machine). Stations A and B were built from the plan's mockups A9 and A10 and the in-repo
  prototype, and checked by rendering at desktop, 390 px and dark.
- Station C's downstream challenge writes Station A's manifest, but a soft-deleted row is only
  reported by Station A: applying deletes needs the CDC MERGE of Station C's own challenge.

## Session handoff

```
### Handoff — 2026-10-03
Phase / branch / PR: Lakehouse Lab 3 / feat/lakehouse-lab-phase-3 / (see the PR)
Done: adfModel and adlsModel (deterministic, invariant-tested); Stations A and B; A -> C downstream
  flow with the real engine measuring A's manifest; backend: manifest, through_batch, batch in the
  source index, pipeline.json; ledgers for A and B; evidence above.
Not done: Phase 4 (P1 items); notebook verification (the author); strict prototype side-by-side.
Tests: backend default ✅ · backend lab ✅ · typecheck ✅ · lint ✅ · vitest ✅ · playwright full ✅
Known failures: none open.
Decisions made: tumbling ignores watermark/load, event ignores load (audit, decisions); upstream kept
  in sessionStorage; downstream attempt keyed by upstream; predictions closed as simulations.
Next step: Phase 4 per lakehouse-lab-plan.md §8, one PR per item (P1-3, the JD-PO-005 pack, first),
  after this merges.
```
