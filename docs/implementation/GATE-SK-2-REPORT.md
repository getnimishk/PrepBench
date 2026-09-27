# Skills Plan Phase 2 Gate Report — Guides in the Study Library

**Date:** 2026-09-27 · **Format:** skills-and-content-packs-plan.md §3 · **Branch:** `feat/skills-phase-2`

**Ruling:** guides ship as specified in §6: a learner with an ADF skill reads all 21 chapters from
the Study Library, at the exact version their preparation pinned in Phase 1. **Gate decision: PASS.**

---

## Implemented

### Routes and pages

- `/learn/guides/:packId` (`pages/GuidePage.tsx`) and `/learn/guides/:packId/:chapterId`
  (`pages/GuideChapterPage.tsx`), ported from the prototype's `GuidePage.tsx`/`GuideChapterPage.tsx`
  onto the real primitives (`PageHead`, `Panel`, `PanelHead`, `Row`, `Explanation`, MUI `Table`).
- **Version resolution** (D4): both pages check the active preparation's `content_packs` for the
  requested `packId`. Linked → fetch that exact pinned version. Not linked (no preparation
  selected, or selected but hasn't attached this pack) → fetch the latest version and say so in a
  `Note`: *"Not attached to \<name\> — attach it to keep your place"* or *"No preparation
  selected"*, matching the plan's wording.
- No progress tracking on chapters (D6 — guide chapters are not roadmap topics).
- **Practice links are not rendered at all.** The prototype linked a written scenario's chapter to
  `/adf-sandbox/N`; that route doesn't exist in the real app until Phase 3, so rather than link to
  a 404 or gate it behind a flag, the chapter page simply never emits that section yet (plan §6
  task 4 — "hidden" is achieved by omission, not a feature flag).
- Checked every pack's table heads for an empty header cell needing the `VISUALLY_HIDDEN` pattern
  (CLAUDE.md) — none exist in either shipped pack, so neither guide page needed it.

### Study Library

- `pages/StudyLibraryPage.tsx` gains a `GuideSection`: for a preparation with one or more attached
  packs, one panel per pack (title, chapter count, "All chapters", and every chapter with "Read"),
  fetched at each pack's **pinned** version. A preparation with no packs sees no change at all (D2
  — no fixed technology catalogue; the panel exists only because a pack was actually attached).

### Navigation

- No change needed. `SECTION_RULES`'s existing `[/^\/learn(\/|$)/, 'learn']` already matches
  `/learn/guides/...`, so the Study Library rail entry was already highlighted correctly before
  this phase touched anything.

## Files changed

**Frontend** — new `pages/GuidePage.tsx`, `pages/GuideChapterPage.tsx`, `pages/GuidePage.test.tsx`,
`pages/GuideChapterPage.test.tsx`, `e2e/guides.spec.ts` · `App.tsx` (two routes),
`pages/StudyLibraryPage.tsx` (+ `.test.tsx`), `e2e/helpers.ts` (`createSkillWithPack`),
`e2e/accessibility.spec.ts`, `e2e/responsive.spec.ts`, `e2e/navigation.spec.ts` (the two new routes
added to each `ROUTES`/`routes` array).

No backend changes.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 807 | **807** (unchanged; this phase touches no backend code) |
| Frontend unit | 788 | **796** (+8: `GuidePage.test.tsx` ×3 — pinned-version fetch and no note, latest-version fetch with the preparation-named note, latest-version fetch with the no-preparation note; `GuideChapterPage.test.tsx` ×3 — the same pinned/latest split plus "chapter not found"; `StudyLibraryPage.test.tsx` +2 — no Guide panel without a pack, a Guide panel listing the pinned version's chapters with a working "Read"/"All chapters" link) |
| E2E (new spec) | — | **2/2** (`guides.spec.ts`: a Skill with the ADF pack reads all 21 chapters, including the longest one — Pitfalls, four tables — via Read/Previous/All-chapters links, with no "not attached" note anywhere; a preparation without the pack sees the latest version and the note) |
| E2E (touched specs) | — | **9/9** (`navigation.spec.ts` 1, `accessibility.spec.ts` 3, `responsive.spec.ts` 5 — light+dark, all viewports, with the two new guide routes added) |
| E2E (full suite) | — | **72/72** (one first-pass failure, `navigation.spec.ts`'s crawl timing out on an unrelated route, `/question-bank?question=134` — same documented load/timing flake as Phase 1's gate; re-ran alone and it passed in 2.8 minutes) |

Typecheck and lint clean (0 errors; 28 pre-existing warnings, +1 new `exhaustive-deps` warning on
`StudyLibraryPage.tsx`'s `GuideSection` effect — deliberate: it re-fetches on `preparation.id` and
`links.length` only, matching the existing precedent of `ExamRunnerPage.tsx` and
`PreparationEditPage.tsx` leaving the same class of warning unaddressed rather than over-widening
the dependency array).

## Honesty review

- No score, readiness or "matched" claim anywhere in this phase's UI.
- Every chapter's text is exactly what the pack file carries (itself converted by code from the
  prototype's documentation-sourced content in Phase 1) — nothing summarised, retyped or invented
  for this phase.
- The "not attached" note never overstates: it names the exact version being shown and why.

## Accessibility and responsive audit

Manually verified in the built-in browser against a disposable second server (never the running
app), then confirmed authoritatively by the automated suite:

- `/learn/guides/adf` and `/learn/guides/adf/pitfalls` (the longest chapter, four tables): **0 axe
  violations**, light and dark (`accessibility.spec.ts`, now covering both routes); no horizontal
  scroll at any of the five `responsive.spec.ts` viewports including 390×844.
- Confirmed by direct axe-core run in the browser pane against a live Skill preparation with the
  ADF pack attached: 4 `<table>` elements on the Pitfalls chapter, 0 violations.

## Known limitations

- **Diagnostic questions and scenario content still aren't surfaced anywhere** — Phase 3 (scenario
  sandbox) and Phase 4 (roles/diagnostic) read the same pack data this phase's pages read.
- **The ADLS guide has no scenarios to link to** and none are expected in v1, so its chapters show
  no practice section at all, same as ADF's non-written chapters.

## Fixture audit

No placeholder or invented content; every string on these pages is the shipped pack's own text or a
literal UI label (e.g. "Read", "All chapters", the not-attached note).

## Failures during the phase

- One frontend unit test (`RoadmapEditorPage.test.tsx`, entirely unrelated to guides) failed once
  inside a full-suite run alongside two other heavy background jobs (a Playwright accessibility
  pass and the full backend suite, all started at once by this session for the same audit); re-ran
  alone and it passed in 15s. A load/timing flake from over-parallelizing this session's own
  verification work, not a regression.
- `navigation.spec.ts`'s crawl failed once in the full Playwright run (10-minute overall timeout,
  on `/question-bank?question=134`, unrelated to this phase) and once again in Phase 1's full run
  (on a different unrelated route). Re-ran alone both times; it passed in under 3 minutes each
  time. This is the exact flake CLAUDE.md documents for this test (Vite compiling a route on first
  visit, under load in a long single-worker run), not a regression.

## Session handoff

```
### Handoff — 2026-09-27
Phase: 2 · Branch: feat/skills-phase-2 · PR: (opening after this report)
Done: /learn/guides/:packId and /learn/guides/:packId/:chapterId, the Study Library's Guide
  panel, version resolution (pinned vs latest) on both new pages, e2e/unit coverage, the two new
  routes added to all three canonical e2e specs. Backend 807/807 (untouched), frontend unit
  796/796, touched e2e specs 9/9 (both themes, all viewports), new guides.spec.ts 2/2, full
  Playwright suite 72/72 (one flaky first-pass failure on an unrelated route, confirmed a known
  load/timing issue by re-running alone).
Not done: nothing outstanding for this phase's exit criteria.
Next step: gate PASSES. Wait for the author to merge this PR before starting Phase 3 (scenario
  sandbox in the Learning Lab) -- its entry criterion is this phase's gate, not just this report
  existing.
Surprises / decisions made:
  - Practice links are omitted entirely rather than flagged/hidden behind a conditional -- there
    is simply no code path that renders a scenario link yet, so Phase 3 adding the route is the
    only thing that will make them appear.
  - No navigation.ts change was needed; the existing /^\/learn(\/|$)/ rule already covered the new
    routes. Worth noting so a future phase doesn't assume this file always needs touching for a
    new /learn/* route.
```
