# Lakehouse Lab Phase 2 Gate Report — Station F, the Migration Factory

**Date:** 2026-10-03 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-lab-phase-2`

**Ruling:** the program level works. A learner tiers twelve jobs (a real, write-once prediction),
orders the five domains into the programme's waves, picks a cluster policy, a contingency buffer and
whether a consumer map exists, and runs the plan. A plan sized by job count and a plan weighted by
complexity are shown side by side against the same fixed schedule of events, and a cutover without a
consumer map breaks a report. The yield wave's Validate step leads to Station C's real comparison.
PRD P0-8 and the Phase 2 exit. **Gate decision: PASS.** Open items that are not this phase's are
listed at the end.

---

## Audit: what the work found

1. **The prototype's Station F was fixed numbers, not a model.** `runFactory` in the review
   prototype returned a hard-coded 19, 17 and 18 months. The phase builds a real, deterministic
   model (`services/lakehouse/factoryModel.ts`), driven entirely by the pack's `factory.json`: the
   model contains no constant of its own, so changing the story is a change to the pack's content.
   `factory.json` was a stub; it now holds the signals, tier rules, a twelve-job sample, five domains
   with job counts per tier, the event schedule and the teaching constants, each with a label.
2. **A first choice of constants made the change freeze do nothing.** With a steady speed of 600
   effort units a month, no cutover fell inside months 11 to 12, so the "fab change freeze" event
   was listed and had no effect. A sweep over the speed found 540: the freeze holds wave 9's
   cutover back 0.7 months while the weighted plan still holds. The sweep is why the constant is
   540; it is a teaching constant like the others, and says so.
3. **The result on the reference inventory** (default order, 20% buffer, no consumer map):

   | | promised | ended | |
   |---|---|---|---|
   | Plan by job count | month 10 | month 21 | 10.9 months late |
   | Plan weighted by complexity | month 20 | month 21 | 0.8 months late: "about on plan" |

   With no buffer at all even the weighted plan is 3.5 months late: the events are real, and the
   buffer is a lever the learner sees.
4. **A true result that cuts against the tidy lesson, left in.** If the learner puts the hardest
   domain first, the count plan prices every job at the *pilot's* average, so it becomes nearly
   right (it promises month 27 and lands month 27), while the weighted plan is 7 months late: it
   doesn't know the pilot runs slowly or that an early critical domain costs rework. That is what
   the model does, and it is a fair lesson (a pilot of hard jobs changes what a count-based plan
   learns), so it isn't tuned away. The ledger's "count plan extrapolates the pilot" convention says
   how the count plan is built. The tests pin the claim that matters: on the reference inventory the
   count plan is worse than the weighted one for every buffer from 0 to 50%.
5. **The mockup links to `yield_daily`; the pack's tables are `defects` and `telemetry`.** The link
   from the yield wave's Validate step goes to Station C's reconciliation challenge on
   `legacy.defects` and `silver.defects` (the pack's "Yield and defect analytics" data), which is
   the real, planted-difference comparison the PRD wants. The pack's content names those two
   tables, and a backend test checks they exist in the pack.
6. **The page now opens on Station F**, not Station C: the programme comes first (the prototype's
   overview did the same). Direct links (`?station=c`) are unchanged.

## Implemented

| Plan task | Where |
|---|---|
| Pack content: inventory sample, tier rules, domains, fixed event schedule, cost teaching constants (from the Phase 0 decisions) | `backend/app/data/lab_packs/semiconductor-v1/factory.json`; consistency test in `tests/test_lab_default.py` |
| `factoryModel`: pure and deterministic; plan by count vs by complexity; events; cluster-cost lever; decommission blocked until consumers confirmed | `services/lakehouse/factoryModel.ts` |
| Ledger for Station F, typed, with the completeness and composition tests | `factoryCouplings.ts`, `components/lakehouse/FactoryLedger.tsx` |
| Station F: tiering exercise, wave planner, timeline with events | `StationF.tsx`, `FactoryTimeline.tsx` (SVG, `textScale`, theme tokens) |
| Link F → C with a compare preset | `?station=c&challenge=reconciliation&from=f&wave=10`; Station C says where it was opened from |
| Journal entries from F are `simulation` | `addLakehouseJournalEntry`; the server forces and checks the source |
| Shared with Station C | `StationShell` (wide Predict), `AcExplain` (acceptance criteria and structure checks), generic lab attempts (`lakehouse.f.` ids) |

**Decisions the plan left open**
- *Tiering is a real prediction.* It is committed to the server, write-once, before the true tiers
  and the reasons are shown; the browser's model then scores it and closes the attempt with
  `observed.source = "simulation"`, so it can't be mistaken for an engine result. A prediction that
  reached the server without its scoring is closed on the next load.
- *The model is not part of the Chart Sandbox's mastery*: its attempts use `lakehouse.f.` ids, kept
  out by the same rule as Station C's.
- *Costs are indexes relative to job clusters*, never currency: compute (1.0× or the inverse of the
  ratio) and total with infrastructure (a share the pack labels as a teaching constant).

## Exit criteria

- [x] **The count-based plan visibly fails where the weighted one holds** (audit 3; model tests:
  worse for every buffer 0–50%, weighted within a month at the default; `databricks-sandbox.spec.ts`
  asserts both lines on screen).
- [x] **A cutover without a consumer map breaks a report**, naming it, at the yield wave's cutover;
  decommission stays blocked, naming the three unconfirmed consumers, until a map is built.
- [x] **Every cost figure carries the teaching-constant label** (a test per metric, the e2e spec
  counts both, and the ledger prints the pack's own labels).
- [x] **Determinism**: the same pack and plan give byte-identical runs (test).
- [x] **Each scheduled event fires at its scheduled month, whatever the plan**; the pilot is the
  only slow slot; a cutover inside the freeze waits for it to end; a freeze that touches nothing
  says so.
- [x] **Decommission is blocked until every consumer is confirmed.**
- [x] **The ledger is complete and its composition is frozen** at 4 arithmetic, 10 assumptions and
  3 conventions; a test renders the ledger and checks every effect's caveat and effect chain is on
  screen, with its kind.

## Gate checklist

| Item | Result |
|---|---|
| Backend default suite (no `deltalake`) | **938 passed, 1 skipped** (includes the real-database guard) |
| Backend engine suite (`-m lab`, scratch venv, `deltalake` 1.6.6) | **12 passed** |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors, **28 warnings, unchanged** |
| `npm test` | **1089 passed, 95 files** |
| Playwright, touched spec | `databricks-sandbox.spec.ts` 3 passed |
| Playwright, full suite, from PowerShell | **91 passed** (13.4 min) |
| axe light and dark, 390 px overflow | 24 checks on the disposable setup (Station F fresh, tiering revealed, plan run with timeline/ledger/structure checks, journal drawer with simulation entries, Station C opened from F; × light/dark × 1280/390 px): **0 violations, 0 overflow** |
| Pre-completion checklist | counts: the sidebar and parity counts did not change; no hex colours or literal font sizes (SVG text uses `textScale`, colours come from the tokens; a test checks both); route unchanged, already in all three e2e `ROUTES`; heading levels h1 → h2 → h3 (the ledger is an h3); overlap: see below |
| OpenAPI | no schema changed; nothing to regenerate |
| Honesty review | every month and cost on screen is the model's from the pack's teaching constants and says so beside it; the run says "Simulation"; nothing from F claims to be an engine run; journal entries are `simulation` |

**Overlap checks (checklist 5).** The model is a pure function of its input, so a plan that changes
while a result is showing marks the result stale ("The plan changed. Run it again") instead of
showing a mix; Station F's attempt is deterministic by id, so a second tab can't commit a second
tiering.

**Failures during the phase, stated as such**
- The first full Vitest run: **1 failed of 1088**: my own new test typed a 150-character string key
  by key through the Station F page and timed out at 20 s under load (it passed alone). Fixed by
  pasting the text; the same change was made to the equivalent Station C test. Re-run: 1089 passed.
- The e2e spec: my scripted edits scrambled `databricks-sandbox.spec.ts` once (a duplicate test
  title, then the Station F header sitting above Station C's body). Two Playwright runs of the file
  failed on that. The file was rebuilt cleanly from the committed one and passes (3 of 3).
- Neither is a product bug; both were my edits.

## Code review: 2 findings, both fixed

1. A prediction committed to the server whose scoring request failed stayed open forever: the
   attempt is now closed on the next load, by the same deterministic model; tested.
2. A pack domain with no jobs would have made the count plan divide by zero (NaN months on screen):
   the pack parser now refuses it with a reason; tested.

Rejected: none.

## Not in this phase (by the plan), and open

- Stations A and B and the downstream flow (Phase 3). The rail shows them as "(not built yet)".
- **Notebook verification on Databricks Free Edition** stays the author's (PRD open question 8).
- **Strict side-by-side with `PrepBench_Unified_Prototype.html`** was not possible: the file isn't on
  this machine. Station F was built from the plan's mockups A7 and A8 and the in-repo prototype,
  and checked by rendering at desktop, 390 px and dark.
- The timeline sits in a half-width column on desktop; on a phone it scrolls inside its own box at
  a readable size rather than shrinking the text. A full-width Observe panel would be a layout
  choice for the author.

## Session handoff

```
### Handoff — 2026-10-03
Phase / branch / PR: Lakehouse Lab 2 / feat/lakehouse-lab-phase-2 / (see the PR)
Done: real Factory model from pack content; Station F UI (tiering prediction, wave planner,
  timeline, events, incidents, cost, decommission); coupling ledger with frozen composition;
  F -> C compare link; simulation journal entries; evidence above.
Not done: Stations A and B (Phase 3); notebook verification (the author); strict prototype
  side-by-side (needs the HTML).
Tests: backend default ✅ · backend lab ✅ · typecheck ✅ · lint ✅ · vitest ✅ · playwright full ✅
Known failures: none open.
Decisions made: steady velocity 540 (audit 2); page opens on Station F; link goes to
  legacy.defects vs silver.defects; tiering is a write-once server prediction scored by the model.
Next step: Phase 3 (Stations A and B and the downstream flow) per lakehouse-lab-plan.md §7,
  after this merges.
```
