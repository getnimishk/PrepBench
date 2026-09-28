# Skills Plan Phase 4 Gate Report — Roles from a Job Description, and the Diagnostic

**Date:** 2026-09-28 · **Format:** skills-and-content-packs-plan.md §3 · **Branch:** `feat/skills-phase-4`

**Ruling:** a role can be created from a job description, its requirements linked to Skills the
learner confirmed, diagnosed twice with a before/after view, and its readiness stays "Needs
evaluation" throughout. **Gate decision: PASS** (see "Failures during the phase").

---

## Implemented

### Data and API (`models/role.py`, `schemas/role.py`, `services/role_service.py`, `api/v1/roles.py`)

- Tables `roles`, `role_requirements`, `role_diagnostic_attempts`, as §8 describes, created by an
  idempotent `CREATE TABLE IF NOT EXISTS` step in `core/database.py`. `role_requirements.subject_id`
  and both child tables' `role_id` use ON DELETE SET NULL / CASCADE as specified; deleting a Skill
  also unlinks explicitly in `subject_service.delete` (as it does for learning attempts).
- `GET/POST /roles`, `GET/PUT/DELETE /roles/{id}`, `PUT /roles/{id}/requirements`,
  `GET/POST /roles/{id}/diagnostics`. **No readiness field on any response** (a test checks every
  key of every role response).
- The service enforces:
  - a requirement links only to an existing **Skill** (a certification is refused);
  - every `question_ref` resolves to a shipped pack version's diagnostic question or written
    scenario lens, every "covered" index is one of that question's points, and a scenario question
    is answered in its own lens;
  - **the first attempt fixes the question set and lens**: a retake with different questions or
    another lens is refused (400), and the role's lens can't be changed once diagnosed;
  - a retake keeps the first attempt's fits/core label per question.
- `docs/api/openapi.json` regenerated (env redirected to the scratchpad): 4 paths and 10 schemas
  added, nothing removed or changed (checked structurally against `main`).

### Parser and link suggestions (`services/roles/jdParse.ts`)

- `parseJobDescription` ported **unchanged from the prototype's current version**, including the
  numbered-heading fix (a numbered line with symbol bullets under it is a heading, by structure).
  All the prototype's parser tests ported, plus a Windows line-endings case.
- The prototype's shared-word `matchPreparation` is **replaced** by `suggestLink`: a Skill is
  suggested only when the requirement names it, a guide attached to it, or that guide's id ("ADF"),
  as whole words; never on a common word ("data", "system"); none when two Skills are named.
- **No link is saved unconfirmed (D8):** the evidence select starts at "Not linked: a gap"; the
  suggestion is marked "(suggested)" with a "Link to …" button. Tested in Vitest and e2e.

### Diagnostic selection (`services/roles/diagnostic.ts`)

- Candidates: the diagnostic questions and written-scenario lens questions of the packs attached to
  the **confirmed linked Skills**, at their pinned versions (D9).
- Ranking kept from the prototype (keyword hits per requirement, mandatory ×2) and its rule that
  **"pipeline" and "load" are never keywords** (now applied to every pack; tested).
- **Minimum relevance 2** (one keyword in a mandatory requirement, or two in preferred ones); below
  it a question is a core topic.
- Filled to ten from a **labelled core set**: the linked packs' remaining questions, then the other
  shipped packs', each pack's diagnostic questions before its scenarios. With no linked Skill, all
  ten are core topics (tested).
- The intro states the real count: "10 interview questions: N fit this job's requirements, the rest
  are core topics…" (or "all core topics" when none fit), and each question is pilled Fits / Core topic.

### Pages

- `/preparations/roles/new` (`RolePreparationNewPage`), `/preparations/roles/:roleId`
  (`RolePreparationPage`, with the prototype's before/after `DiagnosticResults` table and editable
  links), `/preparations/roles/:roleId/diagnostic` (`RoleDiagnosticPage`); "Jobs you're preparing
  for" on My Preparations (`components/roles/JobsSection.tsx`); the third card "A job you want" on
  `/preparations/new`. Real primitives; **nothing in localStorage** — diagnostic answers are page
  state until "Finish and save".

## Decisions the plan didn't cover

1. **Step 3 of the new-role flow no longer promises unbuilt features.** The prototype's step 3 and
   role page offered a Lakehouse Lab, a gap roadmap and an imported question set; none exists yet,
   so the step shows only the diagnostic and "Readiness: Needs evaluation", and the role page's
   "Next" lists the diagnostic, Scenarios and the interview question library.
2. **The lens is chosen on the diagnostic's intro**, defaulted from the title (`guessLens`), and is
   fixed by the first attempt (the server refuses a later change).
3. **Scenario keywords live in `diagnostic.ts`** (`SCENARIO_KEYWORDS`, the prototype's list): the
   pack format has no keywords on scenarios, and adding them would need a `v2` pack.
4. **Evidence choices are Skills only**, as D8 says; certifications are never offered.
5. **One `VISUALLY_HIDDEN`** (`components/ui/visuallyHidden.ts`) now serves the three tables that
   had their own copy (found by the code review).

## Tests

| Suite | Before (Phase 3) | After |
|---|---|---|
| Backend | 824 (+3 guard hits) | **843 passed, 0 failed** (the real-database guard fix, PR #37, removed the `-shm` false positives; real `.db`/`-wal` hashes unchanged) |
| Frontend unit | 830 | **868 passed** (81 files) |
| E2E `roles.spec.ts` (new) | — | **3/3**: the flow (sample JD → confirm a suggested link → create → diagnostic → server refuses a changed retake → retake → before/after, readiness "Needs evaluation" throughout); axe light and dark + 390 px on the role page with a before/after table, the diagnostic intro, the new-role page (and its step 2 table) and My Preparations |
| E2E crawl specs + `preparations.spec.ts` | — | accessibility 2/2, responsive 5/5, preparations 5/5; navigation 1/1 alone (see below) |
| E2E full suite | 76 | Run 1: **77/80** (3 failures, below). Run 2, on the final code: **79/80**; the one failure, `accessibility.spec.ts` (light), **passed alone 4/4** |

Backend tests (`tests/test_roles.py`, 15): CRUD, archive, no readiness field, bad input, whitespace
refused, requirement links replaced (Skill only; 404/400), deleting a linked Skill makes a gap,
deleting a role cascades but keeps the Skill, diagnostics oldest first, **retake with different
questions refused**, retake in another lens refused and the lens then fixed, refs must ship
(unknown pack/version/question, planned scenario, wrong lens, bad point index, duplicates),
retake keeps fits labels, migration creates the tables like a fresh install (idempotent).

Frontend: `jdParse.test.ts` (prototype parser cases + suggestion rules), `diagnostic.test.ts`
(prototype selection cases on the pack data, plus linked-only fits, no-link → ten core, threshold,
no pipeline/load keywords, points and study links for every question in every lens),
`RolePages.test.tsx` (the three pages, incl. the relink lock and an archived Skill),
`PreparationsPage.test.tsx` (jobs section), `PreparationNewPage.test.tsx` (the third card).

Count assertions checked: no nav change (the pages sit under My Preparations, whose section rule
already covers `/preparations/...`); the new-preparation card grid is three columns (as the
prototype) and collapses to one on a phone.

## Accessibility and responsive

- The three routes are in all three crawl specs (a role seeded through the API) and pass: axe light
  and dark, five viewports.
- `roles.spec.ts` audits the populated pages (before/after table, fit/core pills, the step-2
  requirements table with its evidence selects): **0 violations** light and dark, no horizontal
  scroll at 390 × 844.
- Manual pass on CLAUDE.md's disposable second server (a copy of the learner's database in the
  scratchpad; backend :8211, Vite :5384 — :5383 was held by another session's leftover server),
  driven by a standalone Playwright script with a Skill, a linked role and two diagnostic attempts
  seeded on the copy: `/preparations`, `/preparations/new`, `/preparations/roles/new`, the role page
  and the diagnostic — **0 axe violations in light and dark, no horizontal scroll at 390 × 844**
  (10 of 10 checks). The real `.db`/`-wal` hashes were unchanged afterwards.

## Honesty review

- No readiness, score or "matched" claim: readiness reads "Needs evaluation" with its reason; the
  diagnostic is labelled "Your own rating"; questions say "Fits" or "Core topic", and a core topic
  says it was "chosen to make up the ten".
- The only sample content is the prototype's job description, labelled **"SAMPLE JOB DESCRIPTION
  (fictional)"** in its first line, behind a "Use a fictional sample" button.
- Every diagnostic question and key point is the shipped pack's text (from the documentation
  notes); nothing was written for this phase.

## Code review (`code-review` at high, 7 findings, all fixed)

1. Two quick relinks could undo each other (whole list replaced) → selects locked while one saves.
2. A retake could relabel fits/core → the server keeps the first attempt's labels.
3. Whitespace-only names/requirements were stored blank → stripped before the length check.
4. Diagnostic dates parsed a naive UTC timestamp as local → read as UTC.
5. "Open" on an archived linked Skill selected something the picker can't hold → labelled
   "(archived)", no Open.
6. `GET /roles` had an N+1 on requirements → counted in one grouped query.
7. `VISUALLY_HIDDEN` duplicated a third time → one shared constant.

Rejected: none.

## Failures during the phase

- **`navigation.spec.ts` in the crawl batch** (alongside accessibility, responsive and
  preparations): a `page.goto` of a guide chapter timed out at 20 s, then the test hit its 600 s
  limit. Re-run alone: **passed in 3.6 min.** Two `node` processes were running during the batch —
  an audit Vite server on port 5383 left by another session's worktree (`brave-wilson…`), not an
  e2e server; I didn't stop it (not this session's), and used other ports for my own audit.
  This crawl's solo time has grown with each phase (2.8 → 3.2 → 3.6 min: every guide chapter link
  is its own shape, and each phase adds routes), and it now fails its 600 s limit inside long
  batches. Flagged rather than "fixed" by raising the timeout (CLAUDE.md).
- **Full suite, run 1 (77/80):** `insights.spec.ts` ("socket hang up" from the e2e backend) and
  `mock-exam.spec.ts` (a count not shown within 5 s) — **4/4 when re-run alone**, load/timing.
  `roles.spec.ts` failed for a real reason in the *test*: earlier specs leave other Skills with the
  ADF pack in the shared e2e database, so the sample requirement names several Skills and
  `suggestLink` correctly offers no suggestion, and the test waited for a "Link to …" button that
  never came. The e2e flow now confirms the link through the select (the suggestion rule is covered
  in Vitest); re-run after `guides` and `scenarios` (reproducing the shared state): 9/9.
- **Full suite, run 2 (79/80):** `accessibility.spec.ts` (light) — the page showed "Could not load
  the interview rounds" (the backend didn't answer one request); **4/4 alone**.
- `PreparationsPage.test.tsx`: 6 failures on first run — its API mock had no `getRoles`, so the new
  section rendered its own error and a second "Retry" button. Mock extended; section tests added.

## Session handoff

```
### Handoff — 2026-09-28
Phase: 4 · Branch: feat/skills-phase-4 · PR: (opening after this report)
Done: roles tables + /roles API (no readiness; retake must match the first attempt's questions and
  lens); jdParse ported with the numbered-heading fix and its tests; link suggestions that save
  nothing until confirmed; diagnostic selection from confirmed linked Skills' packs with threshold
  and labelled core fill; the three role pages, "Jobs you're preparing for", "A job you want".
  Backend 843 passed; frontend 868/868; roles.spec 3/3; full Playwright 79/80 with the
  one failure passing alone.
Not done: nothing in the phase's exit criteria.
Next step: the author reviews and merges; then Phase 5 (hand over to lakehouse-lab-plan.md).
Surprises / decisions made: see "Decisions the plan didn't cover"; the navigation crawl's growing
  runtime inside long batches.
```
