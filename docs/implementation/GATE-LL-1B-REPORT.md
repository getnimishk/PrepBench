# Lakehouse Lab Phase 1B Gate Report — Page Shell, Station C UI, Journal

**Date:** 2026-10-02 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-lab-phase-1b`

**Ruling:** a learner can do Station C end to end in the browser at `/databricks-sandbox`, with and
without the engine: predict (write-once), set up the tables, run any of the nine operations on the
real engine, read the engine's own result, write acceptance criteria with structure checks, and
review the journal. PRD P0-4 (UI), P0-9, P0-10 (UI), P0-11 (button) and P0-12. **Gate decision:
PASS**, with one item that stays open and is the author's: running the exported notebook on
Databricks Free Edition (it stays marked **Unverified**).

---

## Audit: what the work found

1. **The mockup's "sums match" example isn't what this dataset does.** Mockup A5 (and the
   prototype) say "the sums match; the drift only shows up when rows are compared by key". That
   came from the spike's constructed example. On the real pack, comparing `legacy.defects` with
   `silver.defects` on the real engine gives equal row counts (5,000 = 5,000) and **939 mismatched
   rows in 3 columns**, and `yield_pct`'s totals already differ in the fourth decimal
   (462777.9586 vs 462777.9429), `scrap_qty` differs in its null count (0 / 40), `inspected_at` by
   up to 28,800 s. So the page does **not** hard-code that sentence. `CompareResult` and
   `reconciliationFacts()` work out, from the result, which columns differ only at row level and
   say what happened: here, "every column with differing rows also shows a difference in its totals
   this time". The challenge's lesson ("matching row counts did not mean matching data") is true
   either way and is what is asserted.
2. **The mockup's drifted batch is batch 2; the pack's is batch 3** (`dataset.json`: `drift`,
   batch 3, `inspector_id`; `replay`: batch 2). The challenges follow the pack. The real error text
   on the engine is `Cannot cast schema, number of fields does not match: 9 vs 8` (the mockup's
   "4 vs 3" was illustrative); the page shows whatever the engine returns, verbatim.
3. **Lab challenges are not registered in `services/learning/challenges.ts` / `concepts.ts`**, which
   the plan said to do. Both are the Chart Sandbox's: `ConceptId` is a closed union, `CONCEPTS`
   decides `isChartSandboxAttempt`, and mastery, placement and recommendations are derived from it.
   A lab concept registered there would flow into the Chart Sandbox's figures. The lab has its own
   registry (`services/lakehouse/stationC.ts`) and its attempts are told apart by their
   `lakehouse.c.` ids; a test pins that they stay out of the Chart Sandbox and that the lab reads
   only its own.
4. **Review found two real bugs, both fixed** (below). Both were the same kind of thing: the page
   could have said something about a run the engine never did.

## Implemented

| Plan task | Where |
|---|---|
| Nav entry, `SECTION_RULES`, hub card live with new copy, route, e2e `ROUTES` ×3, Sidebar/navigation/hub tests | `navigation.ts`, `LearningLabPage.tsx`, `App.tsx`, `e2e/{accessibility,responsive,navigation}.spec.ts` |
| Types mirroring `schemas/lab.py`; client | `types/lakehouse.ts`, `services/api.ts`; `apiContract.check.ts` now checks six lab shapes against the generated types |
| Page: `PageHead`, station rail (select on a phone), `?station=` (default `c`) | `pages/DatabricksSandboxPage.tsx` |
| `StationShell` (Predict → Manipulate → Observe → Explain, write-once prediction) | `components/lakehouse/StationShell.tsx`, `LoopSteps.tsx` |
| Station C: four challenges, operation form for all nine operations, set-up, follow-ups, reset | `StationC.tsx`, `OperationForm.tsx`, `services/lakehouse/stationC.ts` |
| `EnginePanel` (real result / "Real engine not installed"), `CompareResult` | `EnginePanel.tsx`, `CompareResult.tsx` |
| Journal drawer: source pill on every entry, delete, Markdown export | `JournalDrawer.tsx` |
| `acChecks` (four structure checks, pure) | `services/lakehouse/acChecks.ts` |
| Learning attempts on the seeded `databricks` skill's subject, deterministic ids | `services/lakehouse/attempts.ts` |
| Notebook download with an **Unverified** pill while `notebook_verified_on` is null | `StationC.tsx` |

**Stations F, A and B** are shown in the rail as "(not built yet)" and open a panel saying so. Nothing
pretends they exist; they are Phases 2 and 3.

## Exit criteria

- [x] **Station C works end to end in both engine states.**
  - *With the engine* (a scratch venv with `deltalake` 1.6.6, on a copy of the real data in a
    disposable second server): each of the four challenges was driven through the browser against
    the real engine. Real results seen: the schema refusal (`9 vs 8`), plain append of batch 2
    again giving 3,000 rows (a real duplicate), vacuum with 0 hours refused by the engine's
    retention check (`minimum retention for vacuum is configured to be greater than 168 hours`),
    and the comparison above. The attempt is completed with `correct` computed from the committed
    prediction against the engine's result.
  - *Without the engine*: the prediction is saved, Run and Set-up are disabled, the observe panel
    says "Real engine not installed" with the install command, and **no number, row, version or
    verdict appears** (`databricks-sandbox.spec.ts` asserts it; so do `EnginePanel` and `StationC`
    tests).
- [x] **axe clean in light and dark, no horizontal scroll at 390 px:** 28 checks on the disposable
  setup (engine and no-engine servers × light/dark × 1280/390 px × fresh page, result with
  structure checks, journal drawer, not-installed observe): **0 violations, 0 overflow.**
- [x] **Frontend suites green** (below).
- [ ] **Notebook run on Databricks Free Edition: open, the author's.** It is exported and marked
  Unverified in the file header and in the UI; `notebook_verified_on` stays null.

## Gate checklist

| Item | Result |
|---|---|
| Backend default suite (no `deltalake`) | **937 passed, 1 skipped**, including the real-database guard. No backend code changed. |
| Backend engine suite (`-m lab`, scratch venv with `deltalake` 1.6.6) | **12 passed.** |
| `npm run typecheck` | clean (also `tsc -p e2e`) |
| `npm run lint` | 0 errors, **28 warnings, unchanged** (three new ones from helpers in component files were moved to `services/lakehouse/present.ts` and `stationC.ts`) |
| `npm test` | **1030 passed, 92 files** |
| Playwright, touched specs | `databricks-sandbox.spec.ts` 2 passed; `parity.spec.ts` passed after its rail count was updated |
| Playwright, full suite, from PowerShell | **90 passed** (13.4 min) |
| Visual + accessibility pass | above |
| Pre-completion checklist | count assertions: the rail count in `parity.spec.ts` (17 → 18) was missed at first and caught by the full run, as were the Sidebar and `navigation.test.ts` ones; no hex colours or literal font sizes (`pxToRem` throughout; no SVG in this phase); route in all three e2e `ROUTES`; heading levels h1 → h2 → h3 (journal drawer h2); overlap: see below |
| OpenAPI | no schema changed; nothing to regenerate |
| Honesty review | every figure on screen comes from the engine's result; the verdict compares the committed prediction with what the engine did; no result, no verdict |

**Failures during the phase, stated as such**
- The first full Playwright run: **1 failed, 88 passed** — `parity.spec.ts`'s rail count. Real: fixed, re-run alone, then the whole suite again (90 passed).
- The first full Vitest run: **1 failed of 1027** while the backend suite was running in parallel on the same machine; I did not identify which test (I only saw the summary), and the next two full runs were green (1027, then 1030). Treated as load, not a bug, but I can't prove which test it was.

**Overlap checks (checklist 5).** Only the latest operation's answer is applied (`runSeq`), so a
result that arrives after switching challenge is dropped (test: "ignores a result that arrives after
the learner moved to another challenge"). A prediction's server refusal is shown and the server's
copy is re-read.

## Code review (`code-review` at high): 2 findings, both fixed

1. A "table doesn't exist yet" refusal was classified as the challenge's outcome, so a learner who
   skipped set-up and had predicted "refused" would have been marked right on a result the engine
   never gave for that question. `isNotCreated()` now excludes it; tests added.
2. Run, the follow-ups and the form stayed enabled while set-up was running, so a click aborted
   set-up half-way and left a step stuck on "running". All are now disabled while set-up runs;
   test added.

Rejected: none.

## Not in this phase (by the plan)

Stations F, A and B (Phases 2 and 3); the journal's entries from simulations (they begin with
Station F); notebook verification (the author); the prototype side-by-side render (see below).

**Parity with the prototype.** `PrepBench_Unified_Prototype.html` isn't on this machine, so the
mockup-by-mockup side-by-side the plan asks for was not done. The page was built from the plan's
mockups and the in-repo `prototypes/lakehouse-and-roles` prototype (which uses the app's own
primitives), and checked by rendering the app at desktop, 390 px and dark. If you want the strict
comparison, send the HTML and it's a small follow-up.

## Session handoff

```
### Handoff — 2026-10-02
Phase / branch / PR: Lakehouse Lab 1B / feat/lakehouse-lab-phase-1b / (see the PR)
Done: wiring (nav, hub card, route, e2e routes); Station C UI on the real engine; journal drawer;
  structure checks; learning attempts on the databricks skill; notebook download (Unverified).
  Gate evidence above.
Not done: notebook verification on Databricks Free Edition (the author, PRD open question 8);
  strict prototype side-by-side (needs the HTML); Stations F, A, B.
Tests: backend default ✅ · backend lab ✅ · typecheck ✅ · lint ✅ · vitest ✅ · playwright full ✅
Known failures: one unidentified Vitest failure in a full run under load; not reproduced.
Decisions made: lab challenges kept out of the Chart Sandbox registry (audit 3); the compare
  note is derived from the result (audit 1); challenges follow the pack's batches (audit 2).
Next step: Phase 2 (Station F, the Migration Factory) per lakehouse-lab-plan.md §6, after this merges.
```
