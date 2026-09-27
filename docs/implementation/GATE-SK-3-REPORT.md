# Skills Plan Phase 3 Gate Report — Scenario Sandbox in the Learning Lab

**Date:** 2026-09-27 · **Format:** skills-and-content-packs-plan.md §3 · **Branch:** `feat/skills-phase-3`

**Ruling:** scenarios 1–4 of the ADF pack work end to end for all four roles, recorded as
learning attempts on the active Skill preparation; the check's first answer locks on the server;
a Say-it answer is saved to the interview question library as a `technical` question and updated
in place when saved again; the Chart Sandbox's figures are unchanged by any of it.
**Gate decision: PASS** (see "Failures during the phase" for the two known, non-product failures).

---

## Implemented

### Task 4a — the `technical` interview round (D14), its own commit (`a333fbc`)

- Backend: `InterviewRoundType.TECHNICAL`, a `ROUND_RULES` entry, `CONTENT_CATEGORIES_BY_ROUND`
  entry, the label ("Technical") and AI question-generation guidance.
- **No data migration, checked rather than assumed:** in a copy of an existing install's database
  (read-only backup to the scratchpad), `interview_questions.round_type` is `VARCHAR(14) NOT NULL`
  with **no CHECK constraint**, holding enum *names*; `TECHNICAL` (9 chars) fits.
  `test_a_technical_row_reads_back_on_an_upgraded_database` pins it on that exact legacy DDL.
- Frontend: `'technical'` in the `InterviewRoundType` union; the typecheck flagged nothing else,
  because every other surface (library tabs, practice studio, session planner, importer) reads
  rounds from `GET /interview-questions/round-types`. The one hand-written label map
  (`DailyGoals.tsx`) was typed `Record<string, …>`; it now has "Technical" and is typed by the
  union so the next round is flagged by tsc.
- **Proposed defaults, for the author to confirm** (plan §7 4a, used as written):
  - answer length 60–120 s, thinking 30 s;
  - plan prompt: "What it is → how you'd approach it → the risk you'd watch → how you'd know it worked";
  - listening for: "The interviewer is checking that you understand how it works and where it breaks.
    Say what you'd do and why, name the risk you'd watch, and be clear about what you have done
    yourself and what you would do.";
  - rubric: Technical Accuracy, Structure & Clarity, Trade-off Reasoning, Risks & Failure Modes.
- **Decision not in the plan:** Home's "round practised longest ago" iterated every enum member, so
  adding a round would have told every learner "Technical — never practised" with nothing to
  practise. It now considers only rounds that have at least one question
  (`test_a_round_with_no_questions_is_never_named`; `test_a_never_practised_round_is_named_first`
  given a second round with a question so it still tests what its name says).

### Persistence through `learning_attempts` (D7) — `services/scenarios/scenarioAttempts.ts`

Read against `schemas/learning.py` and `services/learning_service.py` first. The service's rules
are unchanged; the encoding was adjusted to them:

| Attempt | challenge_id | concept_id | fingerprint | prediction | completed |
|---|---|---|---|---|---|
| each check question | `<pack>/<scenario>/check/<i>` | `<pack>/<chapter>` | `pack_version=<v>` | chosen option index | at once, with `correct` |
| each role lens | `<pack>/<scenario>/lens/<role>` | `<pack>/<chapter>` | `pack_version=<v>;lens=<role>` | `case-notes` | when the debrief opens |

- **The lock is the server's:** attempt ids are deterministic per (preparation, pack@version,
  scenario, question or lens), so a second answer — another tab, a reload — reaches the attempt
  holding the first and the service refuses a different prediction.
- **Where the plan's encoding had to change:** the service refuses `explanation_text` on an attempt
  with no committed prediction, so a lens's case notes can't be saved as drafts. The case notes
  *are* the learner's committed analysis before seeing the debrief, so "Show the debrief" commits
  the marker prediction `case-notes`, the notes (headed per task) and completion **in one request**.
  Consequences, stated on the page: notes typed before the debrief are page state until then, and
  they can't be changed after it (they stay beside the debrief, read-only). The Say-it answer is
  appended to the same `explanation_text` under its own heading; ticked Say-it points are
  `rubric_coverage`. Field caps (notes 500, answer 1,500) keep every role of every written scenario
  under the 4,000-character limit — a test checks this against the shipped pack.
- A subject id can be reused by SQLite after a delete (no `AUTOINCREMENT`), and a deleted
  preparation's attempts remain with `subject_id` NULL. An attempt that comes back belonging to
  another preparation is skipped by stepping to the next id in a fixed sequence (`~1`, `~2`), so
  every tab still lands on the same attempt (found by the code review).
- The pack version is in every id (D4): an upgraded pack starts a fresh record.

### Chart Sandbox protected

`fetchAttempts()` now returns only attempts at the Chart Sandbox's own concepts
(`isChartSandboxAttempt`, keyed on `services/learning/concepts.ts`).
`scenarioIsolation.test.ts` proves a scenario attempt changes no mastery, readiness, placement,
probe, has-history or recommendation figure, and that without the filter a scenario-only learner
would skip the placement probe. Settings → Data now labels the table "Learning Lab answers (Chart
Sandbox and scenarios)".

### Say-it → interview question library (task 4)

- `interview_questions.subject_id` (FK `subjects.id` **ON DELETE SET NULL**) and `source_ref`
  (String 150), added by an idempotent step in `core/database.py`, plus a unique index on
  **(`source_ref`, `subject_id`)**.
- `PUT /api/v1/interview-questions/by-source`: first save creates a learner-owned row
  (`round_type = "technical"`, `question_text` = the lens question, `prepared_answer` = the
  learner's answer, `key_talking_points` = the lens points, `category` = the pack title); saving
  again from the same preparation updates that row. The category is only set on create (the
  learner may rename it in the library). A lost insert race updates instead of returning 500.
- `GET /interview-questions` gains `subject_id` and `source_ref` filters; the library's round
  filter still works (tested). Deleting the Skill keeps the question and drops the link.
- **Decision not in the plan:** the plan matched on `source_ref` alone, whose example
  (`adf@1/scenario/1/lens/po`) names no preparation — two Skills with the same pack would have
  overwritten each other's answers. The match is per preparation (found by the code review).

### The sandbox (plan §7 task 1, `add-learning-lab-sandbox` skill)

- `/scenarios` (`ScenarioSandboxPage`): the active preparation's attached packs, at their pinned
  versions, by level, with status (Planned / Ready / In progress / Practised · N roles). Empty states
  say why (no preparation, a certification, a skill with no guide, guides with no scenarios, a pack
  that failed to load) and offer "Attach a guide".
- `/scenarios/:packId/:scenarioId` (`ScenarioPage`), ported from `AdfUnitPage.tsx`: the four role
  lenses, learn → check → case → debrief → Say-it, the honesty note, the locked-question contrast
  fix (`'&.Mui-disabled': { color: 'text.primary' }`, also on the option labels). The prototype's
  banner and localStorage are gone (D13); the role opens on the one last practised here.
- Learning Lab card "Scenarios" ("Incidents from real projects, practised in your role"); the chip
  heading is now per card ("Each scenario", not "Metric families"). Nav entry "Scenarios" in the
  Learning Lab group; section rule; routes in `App.tsx`.

### Guide chapters: "Practise this" (task 5)

A chapter shows "Practise this" (the ink button) and a list of the written scenarios that practise
it — its own scenarios plus the pack's `practice_links` (Recovery → scenarios 1 and 4). Planned
scenarios are not linked.

## API changes (additive)

| Endpoint | Change |
|---|---|
| `GET /interview-questions/round-types` | adds `technical` |
| `PUT /interview-questions/by-source` | **new** |
| `GET /interview-questions` | `subject_id`, `source_ref` filters; items carry both fields |

`docs/api/openapi.json` regenerated with the database, recordings and secrets redirected to the
scratchpad (rule 4); `tests/test_openapi_contract.py` passes.

## DB changes

`interview_questions.subject_id`, `interview_questions.source_ref`, unique index
`uq_interview_questions_source (source_ref, subject_id)`; a `technical` enum member stored as
`TECHNICAL` in the existing column. Additive; tested on a legacy table (fresh vs upgraded,
idempotent, rows kept).

## Tests

| Suite | Before (Phase 2) | After |
|---|---|---|
| Backend | 807 | **824 passed** — plus the 3 known `-shm` guard hits described below |
| Frontend unit | 796 | **830 passed** (78 files) |
| E2E touched specs | — | `scenarios.spec.ts` 4/4 (flow; guide link; axe light + dark and 390 px on the fully open scenario), `chart-sandbox` 2/2, `guides` 2/2, `parity` 5/5, `interview` 2/2, `accessibility` 2/2, `responsive` 5/5, `navigation` 1/1 (alone) |
| E2E full suite | 72 | **76/76 passed on the first run** (27.7 min, after the code-review fixes) |

New backend tests: `test_interview_question_sources.py` (12: migration fresh/legacy/idempotent,
technical read-back, create/update by source, per-preparation rows, race, filters, 404/422, delete
keeps the question); technical-round cases in `test_interview_questions.py`, `test_recordings.py`
("Not Graded" with no provider; its own rubric), `test_daily_goals.py`.
New frontend tests: `scenarioAttempts.test.ts` (encoding, lock, id reuse, text round-trip, the
4,000 budget over the shipped pack, status), `scenarioIsolation.test.ts`, `ScenarioPage.test.tsx`,
`ScenarioSandboxPage.test.tsx`, chapter practice links, Learning Lab card, import modal.
Count assertions updated: rail 16 → 17 (`Sidebar.test.tsx`, `navigation.test.ts`,
`parity.spec.ts`), round types four → five (`test_round_types_lists_all_five`), Learning Lab cards
3 → 4, `fontSizes.test.ts` (two "Live" chips now).

## Accessibility and responsive

- `/scenarios` and `/scenarios/adf/1` are in all three crawl specs (as the empty/not-attached
  states, since the crawls select a certification) and pass: axe light + dark, 5 viewports.
- The real UI — the scenario with the check answered, notes committed, debrief and Say-it open —
  is audited in `scenarios.spec.ts`: **0 axe violations** light and dark, **no horizontal scroll at
  390 × 844**, on both routes.
- Manual pass on CLAUDE.md's disposable second server (a copy of the learner's database in the
  scratchpad, backend :8210, Vite :5383; the real `.db`/`-wal` hashes unchanged afterwards): a
  Skill with the ADF pack, scenario 1 worked to the Say-it step in the browser pane. axe (the same
  tags): **0 violations in light** on `/scenarios/adf/1`; in **dark**, one `color-contrast` on both
  pages — the **header's profile initials** (`Navbar.tsx`, #8ea6ff on #edf1ff, 2.05:1), outside
  `main`, shown only when a profile name is set (the e2e database has none, so no spec sees it).
  Not from this branch (the header is untouched); offered as a separate follow-up task. No
  horizontal scroll at 390 × 844 on either page, light or dark.

## Honesty review

- The check says "practice only" and "never counts towards readiness"; Say-it coverage says "by
  your own reading. Nothing here is graded." No score, readiness or "matched" claim was added.
- A saved Say-it question is graded like any other only when a provider is configured; with none,
  "Not Graded" (tested for the technical round).
- Every scenario string is the shipped pack's (converted in Phase 1 from the reviewed prototype);
  nothing was written or edited for this phase. "Everything in the case is fictional" is stated on
  the page.

## Code review (`code-review` at high, 9 findings, all fixed)

1. Say-it upsert keyed on `source_ref` alone overwrote another Skill's answer → per preparation.
2. Deterministic attempt ids collide when SQLite reuses a deleted subject's id → generation step.
3. Out-of-order tick saves could leave an older coverage map → saves serialised.
4. "Saved." never showed → compared with the text actually saved.
5. Settings → Data called scenario attempts "Chart Sandbox answers" → relabelled.
6. Concurrent first saves → 500 → caught, updates the winner.
7. Duplicate `practice_links` rendered twice → de-duplicated.
8. Unused exports `isScenarioChallengeId`, `EMPTY_PROGRESS` → removed.
9. One pack failing to load blanked the sandbox → others still shown, the failed one named.

Rejected: none.

## Failures during the phase

- **Backend real-database guard (`-shm`).** Every full run ends with 2 failures + 1 teardown error
  from `test_real_database_isolation.py` / the conftest guard, each reporting *only*
  `exam_simulator.db-shm changed` (mtime). The real `.db` and `-wal` SHA-256 were identical before
  and after every run (baseline taken at the start of the session). Cause found: a bare read-only
  `sqlite3` open of the real database — what the guard's own `_read_schema` does — moves the `-shm`
  mtime by itself, because the install has an un-checkpointed `-wal` from 2026-09-22. Pre-existing,
  not from this branch; a follow-up task was offered to fix the guard (never by touching the
  learner's files).
- **`navigation.spec.ts`.** In the touched-spec batch it failed on `/question-bank?question=7`
  (heading not visible in 15 s) — the same route and flake as Phase 2's gate. Re-run alone: once a
  Playwright client error ("Object with guid response@… was not bound") left the final `goto`
  unanswered and the test idle until its 600 s timeout, after the crawl itself had finished every
  route in ~215 s (read from the trace); a second run alone **passed in 3.2 min**. Two Python
  processes from the previous batch's servers were still alive when the first re-run started.
- **`scenarios.spec.ts`, first run:** 3 failures — the check's radio showed nothing until the server
  answered, so `.check()` saw no change. Fixed in the app (the choice shows at once and the question
  is disabled while it saves), 4/4 since.
- **`ScenarioPage.test.tsx`:** a blur-save set `busy`, which disabled the checkbox being clicked and
  swallowed the click — fixed in the app (autosave and ticks never disable anything).

## Session handoff

```
### Handoff — 2026-09-27
Phase: 3 · Branch: feat/skills-phase-3 · PR: (opening after this report)
Done: technical round (D14, own commit); scenario sandbox /scenarios and /scenarios/:packId/:scenarioId
  with the four lenses; persistence via learning_attempts with a server-side lock; Chart Sandbox
  isolation + test; Say-it → interview library (subject_id/source_ref, upsert per preparation);
  guide chapters' "Practise this". Backend 824 passed (+3 known -shm guard hits, hashes unchanged),
  frontend 830/830, scenarios.spec 4/4 incl. axe light/dark and 390px, crawl specs green,
  full Playwright 76/76 first run.
Not done: nothing in the phase's exit criteria.
Next step: the author confirms the D14 defaults and merges; then Phase 4 (roles + diagnostic) on
  feat/skills-phase-4.
Surprises / decisions made:
  - Lens notes are committed with the debrief (service refuses explanation_text before a
    prediction); drafts before that are page state only, and notes lock after it.
  - Say-it questions are unique per (source_ref, preparation), not per source_ref.
  - Home's "longest since" round ignores rounds with no questions.
  - The -shm guard false positive is caused by the guard's own read-only open (follow-up offered).
```
