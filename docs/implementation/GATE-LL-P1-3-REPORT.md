# Lakehouse Lab Phase 4, P1-3 Gate Report — the JD-PO-005 Scenario Pack

**Date:** 2026-10-03 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-lab-p1-3`

**Ruling:** a second scenario pack, with its own framing, a stakeholder brief, a regional defect batch
(Arabic-script names, Hijri-format dates, AED rounding) and fourteen interview questions, runs on the
Lab with **no change to the loader, the dataset generator or any operation**: PRD Goal 5, "a second
pack is content, not new code". **Gate decision: PASS.** The only code added is generic: a scenario
picker, and a rail that offers the stations a pack lists. Open items are at the end.

---

## Audit: what the work found

1. **No JD-PO-005 text exists in the repo, so the pack is a rehearsal for a kind of role.** It says so
   in its first line and again in the framing: nothing is taken from a real job advertisement, and the
   group, its sites and its people are invented. It does not claim to be the author's role.
2. **The pack is content only, and a test checks it.** Four files (`manifest.json`, `scenario.md`,
   `dataset.json`, `interview-questions.json`) and no code. To run Station C unchanged it keeps the
   first pack's table shape (a `defects` table keyed on `defect_id`, a batch 3 that adds `inspector_id`,
   a replayed batch 2, a change batch) and changes the *content*: Arabic inspector names, Hijri-format
   text, AED amounts held to four decimals, Gulf time.
3. **The risk that was new in this pack was text, and it held.** On the real engine (Delta Lake
   1.6.6), all 3,000 Arabic names and Hijri strings come back from a real write and read **identical
   to the pack's own**; an Arabic-script `WHERE` finds exactly the rows the data says; the legacy-vs-
   migrated comparison reports **zero** differences in the name and date columns and finds every
   planted difference in the others (AED rounding 180 rows, Gulf time about 12%, null-vs-zero 24).
   In the browser, with the challenge's 0.0001 tolerance, the AED comparison shows 179 rows: one amount
   differs from its two-decimal rounding by exactly 0.0001, which the tolerance excludes. The engine test,
   at tolerance 0, finds all 180. (The first pack's 299-of-300 is the same effect.)
4. **The Hijri strings are not converted from the Gregorian column,** and the pack says so. They are
   sample text values (Ramadan to early Shawwal 1447) for storage, sorting and display tests. Converting
   them properly would need calendar code, which is exactly what a content-only pack can't carry.
5. **An existing test assumed it was the only pack** (`test_the_shipped_pack_loads_and_is_fictional`
   compared the pack list to one id). That is the kind of hidden assumption this task exists to find; it
   now checks its own pack is present. Nothing else in the backend or frontend needed to change.
6. **The data-only pack sorts first on disk, so "the first pack" can't be the default.** The page now
   opens the pack with the most stations (the full scenario), and a `?pack=` address picks another. A
   test pins that the default is the full scenario.
7. **The interview questions go through the existing importer unchanged,** as technical-round questions,
   and are **questions only**: no prepared answer and no talking points. Those have to come from what the
   learner did in the Lab (P1-1), so they are not invented here. The importer doesn't check for questions
   you already have, so the pack says to import the file once; that is existing behaviour and is not
   changed.
8. **The ten diagnostic questions cover both levels** (ingestion, storage and access, Delta, reconciliation,
   migration planning, governance and identity) **and the regional data**, followed by four prompts about
   stakeholders and delivery. They are tagged `Diagnostic: …` and `Prompt: …`.
9. **Environment finding, not a product one.** The backend suite's real-database guard failed at first
   with "exam_simulator.db-wal changed". It was not the tests: your running PrepBench (ports 8000 and
   5173) writes that file about every 20 seconds, which I confirmed with no tests running, so any backend
   run while the app is open will trip the guard. I didn't stop your app or touch the file. The backend
   suites ran from a throwaway checkout, where the real database doesn't exist (as on a fresh CI checkout),
   and the isolation test passes there. Another session's servers on ports 5383, 5384, 8210 and 8211 were
   left alone, and my own used 8220 and 5393.

## Implemented

| Plan task | Where |
|---|---|
| Framing and a stakeholder brief | `backend/app/data/lab_packs/jd-po-005-v1/scenario.md` |
| A regional defect batch: Arabic-script names, Hijri-format dates, AED rounding, Gulf time | `dataset.json` (6 planted differences, all counted in the scenario) |
| The 10-question diagnostic and the interview prompts | `interview-questions.json`, ready for the Interview Library's import |
| Own manifest folder, ships no code | `manifest.json` (`stations: ["c"]`); a test asserts four files and no `.py` |
| The pack is reachable | scenario picker and `?pack=` on the Lab page; the rail offers only the stations a pack lists (the manifest field existed and was unused) |

## Exit criteria

- [x] **The pack runs with no new code**: every Station C operation on it, on the real engine
  (create, append, schema enforcement refusing batch 3 and evolution accepting it, a replayed batch
  repeating on an append and not on a merge, the change batch applied as the pack describes it,
  comparison finding exactly the planted differences, a manifest missing 100 ids leaving exactly 100 rows
  missing), with every number taken from the pack's own manifest.
- [x] **Generic checks over every shipped pack**, not by name: fictional and says so, lists only stations
  the Lab has, has the table and columns Station C relies on, byte-identical dataset across two
  generations, every planted difference really in the data and nothing else, contiguous batches in the
  source index, served and exportable (CSV, notebook) through the unchanged API.
- [x] **Regional text is really there and survives**: 12 Arabic-script names, 33 Hijri-format strings,
  CSV exports decode as UTF-8 with the names intact, the notebook renders.
- [x] **The interview file imports through the existing importer** as technical questions, with no prepared
  answers.
- [x] **Honesty review**: the pack is fictional and says so; nothing in it is a result ("Nothing in this
  pack is a result" ends the framing); the diagnostic gives questions, not answers; costs and counts shown
  by the Lab are the engine's.

## Gate checklist

| Item | Result |
|---|---|
| Backend default suite (no `deltalake`), from the isolated checkout | **966 passed, 2 skipped** (the two engine modules), including the real-database isolation test and the OpenAPI contract test |
| Backend engine suite (`-m lab`, scratch venv, `deltalake` 1.6.6) | **26 passed** (18 earlier, 8 new for this pack) |
| `npm run typecheck` | clean (also `tsc -p e2e`) |
| `npm run lint` | 0 errors, **28 warnings, unchanged** |
| `npm test` | **1196 passed, 99 files** |
| Playwright, touched spec | `databricks-sandbox.spec.ts` **6 passed** (one new: the second pack is reachable and runs Station C) |
| Playwright, full suite, from PowerShell | **91 passed, 2 failed** (17.9 min): `settings.spec.ts` and `study-guide.spec.ts`, which this work doesn't touch. Re-run alone, **both pass (8 of 8)**. Treated as load (the run was slower than usual, with other servers running on the machine), not as a bug; I did not get a second clean full run |
| axe light and dark, 390 px overflow | **12 checks** on a disposable server (the default scenario with the picker; the JD pack's Station C fresh; and its real comparison result, on the real engine; × light/dark × 1280/390 px): **0 violations, 0 overflow**. The three crawl specs also cover `/databricks-sandbox?pack=jd-po-005-v1` |
| Pre-completion checklist | counts: none changed; no hex colours or literal font sizes; the pack route is in all three e2e `ROUTES`; heading levels unchanged (the picker is a labelled select, not a heading); overlap: below |
| OpenAPI | no schema changed; nothing to regenerate |
| Honesty review | above |

**Overlap check (checklist 5).** Changing pack drops the old pack's content before the new one loads, so
nothing of one pack is shown for another; the journal follows the loaded pack's id; links keep only a pack
that is really installed (a stale one is dropped, tested against the router's own address).

**Failures during the phase, stated as such**
- One existing backend test assumed a single pack (audit 5); fixed.
- The real-database guard tripping was the running app, not the tests (audit 9).
- A slip of mine: undoing a mutation check with `git checkout` also discarded the page's uncommitted
  changes. I re-applied them from the same patch, re-ran the page tests (20 passed) and committed at
  once. The mutation check itself did what it was for: the new test fails without the fix.

## Code review

I did not run the `code-review` skill separately this time, to keep the cost down; the review I did is
the audit above plus a pass over the page change (it found the stale-pack-in-links case, now fixed and
tested). Say so if you want the full skill run on this diff.

## Not in this phase, and open

- **The pack's files reach the learner from the repo folder, not from the app.** The interview questions
  have to be imported from `backend/app/data/lab_packs/jd-po-005-v1/interview-questions.json`, and the
  framing and brief are in `scenario.md`; the Lab page doesn't display a pack's `scenario_md` (the first
  pack's isn't shown either). A "pack documents" panel would be new code, and is a follow-up if you want it.
- **No job-description text for the role flow.** Without the real JD there is nothing honest to write; a
  fictional one would be possible, but the pack doesn't pretend to be the author's role.
- Stations F, A and B stay the first pack's; this pack offers only Station C, by design.
- P1-1, P1-2, P1-5 and P1-6 are still to do.
- The strict side-by-side with `PrepBench_Unified_Prototype.html` is still not possible (the file isn't on this
  machine); this change adds one select to the Lab page.

## Session handoff

```
### Handoff — 2026-10-03
Phase / branch / PR: Lakehouse Lab Phase 4, P1-3 / feat/lakehouse-lab-p1-3 / (see the PR)
Done: the jd-po-005-v1 pack (framing, brief, regional dataset, 14 interview questions, content only);
  generic checks over every pack; real-engine tests of the pack incl. Arabic round trip; a scenario
  picker and a rail that offers a pack's own stations; one stale test fixed.
Not done: P1-1, P1-2, P1-5, P1-6; a pack documents panel; a JD text for the role flow.
Tests: backend default ✅ (isolated checkout) · backend lab ✅ · typecheck ✅ · lint ✅ · vitest ✅ ·
  playwright: spec ✅, full run 91/93 with two unrelated specs passing alone
Known failures: none open. Backend runs while PrepBench is open trip the real-database guard (the
  app writes the WAL); run them from a checkout without backend/data, or close the app.
Decisions made: default pack = most stations; the pack ships questions only; Hijri strings are text.
Next step: P1-1 (station results to an interview question), after this merges; or the pack documents
  panel if you want the content reachable without opening the repo folder.
```
