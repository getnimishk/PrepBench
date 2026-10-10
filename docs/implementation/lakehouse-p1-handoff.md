# Lakehouse Lab P1: implementation handoff

This is the brief for building the rest of the Lakehouse Lab's Phase 4, "interview-ready". Read it before
writing any code. It goes with `lakehouse-lab-plan.md` §8 and `docs/specs/lakehouse-lab.md` (the P1 list). It
was written on 2026-10-09 against `main` @ 6fcd46f (PR #83).

## Where Phase 4 stands

| Item | Status | Evidence |
|---|---|---|
| P1-1 Interview questions from your own lab results | **To build** | (this brief) |
| P1-2 Station D: Reconciliation Detective | **To build** | (this brief) |
| P1-3 JD-PO-005 scenario pack | **Merged** (PR #68) | `GATE-LL-P1-3-REPORT.md`, `backend/app/data/lab_packs/jd-po-005-v1/` |
| P1-4 Diagnostic before/after view | **Delivered, nothing to build** (checked 2026-10-09) | Built by the skills plan's Phase 4 as the role diagnostic: routes `/preparations/roles/:roleId` and `/preparations/roles/:roleId/diagnostic` in `App.tsx`; `RolePreparationPage.tsx` ("Diagnostic: before and after"), `RoleDiagnosticPage.tsx`, `services/roles/diagnostic.ts`; covered by `RolePages.test.tsx` and `e2e/roles.spec.ts`; `GATE-SK-4-REPORT.md` |
| P1-5 Station I: Identity and governance | **To build** | (this brief) |
| P1-6 AI feedback on acceptance criteria | **To build** | (this brief) |

## The working rule: one item, one session, one PR

- Each session builds **one** item, on its own branch from the latest `main`
  (`feat/lakehouse-p1-1-interview-questions`, `feat/lakehouse-p1-2-station-d`, `feat/lakehouse-p1-5-station-i`,
  `feat/lakehouse-p1-6-ac-feedback`), and opens **one** PR. Don't start a second item in the same session, and
  don't fold "small" fixes to other areas into the PR. Note them in the PR description instead.
- Suggested order: **P1-2, then P1-1, then P1-6, then P1-5**. P1-2 is the most native fit. P1-1's design is
  settled below. P1-6 is small. P1-5 is the largest, and most of its effort is getting the content right.
- **Session settings.** Set these in the session's model and effort menus before sending the starter prompt.
  A coordinating session can also set them for a session it started.

  | Item | Model | Effort | Why |
  |---|---|---|---|
  | P1-2 Station D | Sonnet | low (medium if the engine needs a new op) | Copies Station F's pattern, and its grading is deterministic |
  | P1-1 Interview questions | Sonnet | medium | One capability rule that must stay tied to real data, plus a schema change and OpenAPI regeneration |
  | P1-6 AI feedback | Sonnet | low | Mechanical: a new task, a binding, the Not Graded paths |
  | P1-5 Station I | Opus | high | Most of the work is content that must be checked claim by claim. A lower setting writes plausible but unchecked claims |

  If a session at low effort hits a stop condition or a second failed fix, end the session and restart the
  item at medium. Don't keep retrying at low.
- Each PR ends with a gate report, `docs/implementation/GATE-LL-P1-<n>-REPORT.md`, in the shape of
  `GATE-LL-P1-3-REPORT.md`. Each PR also updates the Phase 4 row of `lakehouse-lab-plan.md` §1's status table.
- Don't commit, push or open the PR until the user asks. That is CLAUDE.md hard rule 5.

## Safeguards that apply to every item

Read `CLAUDE.md` first. These are the rules each item is most likely to trip over.

**The learner's data**
- Never open, edit, checkpoint or delete `backend/data/exam_simulator.db` (+ `-wal`/`-shm`),
  `backend/data/recordings/` or `backend/data/.llm_secret*`. To look at the real data, copy the `.db` and `-wal`
  to the scratchpad and read the copy.
- Tests use their own databases. A test that opens its own `SessionLocal()` bypasses the redirect in `conftest.py`.
  Use the fixtures, as `tests/test_interview_sessions.py` does.
- Never seed, repair or rewrite learner data at startup, and never mark a capability `true` by hand.

**Running things on this machine (Windows)**
- Use `backend/.venv/Scripts/python.exe`, never a bare `python`. The lab engine's own tests need a scratch venv:
  `uv venv` + `uv pip install --system-certs -r requirements-lab.txt -r requirements-dev.txt`. Never install into
  `backend/.venv`.
- Before a full backend run, check ports 8000/5173. If the learner's PrepBench is running, its WAL trips the
  real-database guard. Then run `pytest` from a throwaway `git worktree` holding a copy of your changes, and remove
  the worktree afterwards.
- Run Playwright from **PowerShell**, not Git Bash, inside a `Start-Job` with a `Wait-Job -Timeout`. Full runs use
  `PREPBENCH_E2E_WORKERS=3`. **No frontend edits while Playwright is running** (hard rule 3).
- This machine runs out of memory on long browser runs (`Target crashed`, `ERR_INSUFFICIENT_RESOURCES`). That is
  not a test failure. Re-run the spec alone with 1 worker before concluding anything, and report both runs.
- Files are CRLF in the working tree. Git Bash `sed -i` and heredoc appends write LF, or mix the two. Check for
  mixed endings before finishing.
- Never import `app.main` outside pytest, except `scripts/export_openapi.py` with `SQLALCHEMY_DATABASE_URI`,
  `PREPBENCH_RECORDINGS_DIR` and `PREPBENCH_SECRETS_DIR` pointed at a scratch folder.

**Contracts**
- Any change under `backend/app/schemas/`, or to a route's parameters, means regenerating
  `docs/api/openapi.json` (`scripts/export_openapi.py`, env-redirected) and the TypeScript types
  (`npm --prefix frontend run types:api`), then running `tests/test_openapi_contract.py` (hard rule 10).
- Scope is the preparation, found by **slug**. The lab writes under the preparation whose slug is `databricks`
  (`SKILL_SLUG` in `services/lakehouse/attempts.ts`). Never use id 2.
- Omitting `subject_id` never means "all". A preparation's own rows are reachable only with that preparation's
  `subject_id` (Phases 6 and 8, PRs #82 and #83).
- Capabilities come from the live record (`services/capabilities.ts`): the known table is matched by exact slug,
  and anything else is derived from the record. Always pass the Subject record, not its id.
- Lab attempts are `learning_attempts` rows. Their ids come from `labAttemptUid()`. A 409 means the id belongs to
  another preparation, and the code moves on to the next generation (`~n`). Find an attempt with `findLabAttempt`,
  never by recomputing its id.
- Evidence levels come from `evidence_service._level`:
  - unfinished → activity;
  - finished but not correct → completed;
  - correct → demonstrated;
  - correct plus transfer or the learner's own explanation → evidenced.

  A correct result graded by AI or by the learner never counts. Only a model or answer key may set
  `correct = true`.
- Hard rule 2: never fabricate. That rules out invented talking points, invented figures, sample content that
  looks like the learner's own, and a score where AI is unavailable ("Not Graded", and why).
- The UI is built from `components/ui/primitives.tsx`, with colours from tokens (never hex) and font sizes as
  `pxToRem` (including SVG `fontSize`). Every heading-variant `Typography` sets `component`. Check every changed
  screen at 390px and in dark mode.

**Stop and ask the user, rather than guessing, when:**
- the change needs a new table, a migration, or a change to an existing column;
- a test fails and the only way to pass it is loosening the test;
- the item seems to need a change outside its own scope (another station, the interview engine, capabilities
  beyond what is specified here);
- a technical claim in the content can't be checked against an official source;
- the work grows past roughly twice the expected size.

## Patterns to read before any lab item

| What | Where |
|---|---|
| The lab page and its stations | `pages/DatabricksSandboxPage.tsx` (route `/databricks-sandbox`), `components/lakehouse/StationShell.tsx`, `StationA/B/C/F.tsx`, `useLabAttempt.ts`, `LoopSteps.tsx`, `CouplingLedger.tsx` |
| Challenges and attempts | `services/lakehouse/stationC.ts`, `pipelineChallenges.ts`, `attempts.ts` (`LAB_PREFIX`, `labAttemptUid`, `findLabAttempt`) |
| Pure models with their source records | `services/lakehouse/factoryModel.ts` + `factoryCouplings.ts`, `adlsModel.ts`, `adfModel.ts` + `pipelineCouplings.ts` |
| Acceptance-criteria checks | `services/lakehouse/acChecks.ts`, `components/lakehouse/AcExplain.tsx` |
| Engine (Python, allow-listed ops) | `backend/app/services/lab/operations.py` (`_compare_tables`), `engine.py`, `schemas/lab.py`, `api/v1/lab_lakehouse.py` |
| Packs | `backend/app/data/lab_packs/semiconductor-v1/` (`manifest.json` `stations: [a,b,c,f]`, `dataset.json` with 8 planted `defects`), `pack_service.py`, `tests/test_lab_packs.py` |
| How lab work is titled in Workspace and Evidence | `frontend/src/services/portfolio.ts` (`LAKEHOUSE_TITLES`, `challengeById`) |
| Tests | `components/lakehouse/*.test.tsx`, `services/lakehouse/*.test.ts`, `backend/tests/test_lab_*.py`, `e2e/databricks-sandbox.spec.ts` |

## Common mistakes: read before writing code

Each of these turned up in a real review of a Phase 4 item (P1-1, 2026-10-10), or in an earlier session on this
repo. Tests passed anyway in every case. Treat them as part of the acceptance criteria of every item.

**Code**
1. **No silent fallback to "no preparation".** Never send `subject_id: null` for data that belongs to a
   preparation. If that preparation doesn't exist, refuse with a visible message. A P1-1 draft would have put
   private interview questions in the shared library, seen from every preparation.
2. **React effects reset on identity, not on value.** Never put an object or array that is re-created on each
   fetch or render into a dependency array that resets state. Depend on a stable id, or on a value-compared key
   (a string). A new `react-hooks/exhaustive-deps` warning is a bug to fix, not to disable. A P1-1 draft's form
   wiped the learner's typing on every refetch.
3. **Stale and overlapping responses.** A screen that asks the server again must show only the latest
   request's answer, and must clear or mark an answer that no longer matches its input. Test it by resolving
   an older request after a newer one (`QuestionBankPage.test.tsx` has the pattern).
4. **Identities come from stable ids.** Anything stored or used as a key (`source_ref`, attempt uids, challenge
   ids) is built from letters, slugs or enum values, never from a display label. A P1-1 draft stored
   `station/station a/…`. Type the parameter (`LabStation`, a `Literal`) so a label can't get in.
5. **Test the real condition.** Branch on the data that decides the case, not on a guess that usually agrees.
   A P1-1 draft used "has no scenarios" to mean "has lab questions".
6. **Never `String()` an unknown value into the UI.** Handle each expected type and skip the rest. Otherwise
   `[object Object]` reaches the learner.
7. **AI output:** render it with `components/common/Explanation.tsx`, never `dangerouslySetInnerHTML`. Every
   failure path is "Not Graded" with a reason. The AI never sets `correct`, completes an attempt, or moves an
   evidence level. Tests use a fake provider and never reach the network.

**Text and content**

8. **No unsourced technical claims in copy.** That includes defaults, placeholders and prompts. Prefer asking
   or describing over asserting. A P1-1 draft's default question claimed how Delta Lake behaves, which was
   wrong for half the stations.

**Tests and reporting**

9. **Tests assert the intended behaviour from this brief, not the current output.** Write the test, watch it
   fail for the right reason, then write the code. A P1-1 draft's test pinned its own bug as correct.
10. **Run the full suites, not a selection:** `pytest -q`, `npm test -- --run`, typecheck, and lint. Lint must
    show 0 errors and no more warnings than `main` had (take that count before starting). If a screen
    changed, also run Playwright's `accessibility` and `responsive` specs, not only the item's own spec.
11. **Report only what you ran and read.** The gate report gives exact commands and observed results, and
    says what wasn't run and why. When it names another item, it copies the wording from this brief. A P1-1
    draft invented descriptions for P1-5 and P1-6.
12. **One tool in the folder at a time.** Before running anything, check that no other session, Playwright,
    pytest or test server is running, and that the learner's PrepBench app is closed. Two concurrent Playwright
    runs share ports and break each other, and the app's memory use makes browser tests time out.

---

## P1-1: interview questions from your own lab results

**Goal.** From a finished station result, the learner saves an interview question to the Databricks
preparation. Its `key_talking_points` come **only from what this learner observed** in that attempt. They then
rehearse it in the interview studio, where it's graded on whether they hit their points.

**Decided (the user, 2026-10-09).** Databricks gets the interview capability **once it owns at least one saved
interview question generated by the lab**. The capability must come from real data owned by that preparation,
**never a hand-set flag**. Leave `interview: false` in the known-subject table, and leave
`KNOWN_PRODUCTION_SUBJECTS` alone.

**Read first:**
- `ScenarioPage.tsx` and `services/scenarios/scenarioAttempts.ts` (`sayItSourceRef`). This is the existing
  save-by-source flow to copy.
- `PUT /interview-questions/by-source` in `backend/app/api/v1/interview_questions.py` and
  `interview_question_service.py`. A question is unique per (`source_ref`, `subject_id`). The round is
  `technical` (D14).
- `backend/app/api/v1/subjects.py`: `SubjectWithReadiness` and how `roadmap_count` is computed. That is the
  pattern for a count taken from the record.
- `services/capabilities.ts`: `liveCurriculum`, `getSubjectCapabilities`, `deriveCapabilities`. Also the slug
  rule from PR #83 and its tests in `capabilities.test.ts`.
- `InterviewHubPage.tsx`. A non-System-Design preparation's main button currently goes to `/scenarios`
  ("Practise from … scenarios"), and Databricks has no written scenarios.

**Build:**
1. **Source refs.** Give lab questions a stable prefix of their own, separate from the scenario refs. For
   example: `lab/<packId>@<version>/station/<station>/<challenge>`. Max 150 characters.
2. **Backend count.** Add `lab_interview_question_count: int = 0` to `SubjectWithReadiness`. It counts the
   `interview_questions` rows with `subject_id == subject.id` and that source-ref prefix. Regenerate OpenAPI and
   types.
3. **Capability.** In `getSubjectCapabilities`, `interview` is true when the profile says so, **or** when
   `lab_interview_question_count > 0`. That covers the known-table path and the derived path. A record without
   the field (an older payload) leaves the profile's value alone, the same rule `liveCurriculum` follows.
4. **Station UI.** On a finished attempt, offer "Save as interview question". It shows the talking points built
   from the attempt's own recorded observations, editable by the learner before saving. `prepared_answer` stays
   empty unless the learner writes one. Save through `PUT /interview-questions/by-source` with the Databricks
   preparation's id. Saving again updates the same row.
5. **Interview hub.** For a preparation whose interview rounds come from lab questions, the main button must
   lead somewhere real (the interview library, or practice setup filtered to that preparation), not
   `/scenarios`. Keep the change small.

**Acceptance criteria:**
- No talking point exists unless it traces to a value in the learner's own attempt. An attempt with no
  observations offers nothing to save.
- With no lab question saved, Databricks still has `interview: false`, and its hub still says Interview
  Unavailable. After one save it has interview rounds. Delete that question and they go away.
- A question saved under Databricks is private to it: another preparation, or none, can't read it
  (`GET /interview-questions/{id}` gives 404). The capability count never includes another preparation's rows.
- A preparation that isn't `databricks` but owns a question with the lab prefix gets interview from its own
  count, by the same rule. There's no special case on the slug.

**Verify:** backend tests for the count, the scoping and re-saving; `capabilities.test.ts` cases (0 → false,
1 → true, field absent → profile unchanged, a renumbered Databricks); station component tests;
`InterviewHubPage.test.tsx`; `e2e/databricks-sandbox.spec.ts`.

**Stop if** the count can't be computed without a new column or table, or if the learner's existing attempts don't
hold enough observations to build talking points honestly.

---

## P1-2: Station D, the Reconciliation Detective

**Goal.** The legacy and migrated totals disagree. The learner finds each planted defect using real engine
queries. The score is defects **found against those planted in the manifest**. The lesson is the pack's own:
*matching row counts doesn't mean the data is right*.

**Read first:** `operations.py` `_compare_tables` and its tests. `dataset.json` → `defects`: eight planted
defects (`precision`, `tz-shift`, `null-scrap`, `drift`, `cdc`, `replay`, `late`, `small-files`), each with
`table`, `about` and `affects`. Also `StationF.tsx` and `factoryModel.ts`, the closest station to copy, and how
Station F uses `compare_tables` and `CompareResult.tsx`. Also the manifest's `stations` list and
`tests/test_lab_packs.py`.

**Build:**
- Add `d` to the pack's `stations`.
- Add a Station D component inside the existing station shell, with challenge ids `lakehouse.d.<defect>`. The
  learner runs allow-listed operations and claims a defect by naming it with the query result that shows it.
- Grading is deterministic, against the manifest. Only a claim backed by a matching result sets `correct`.
- Add titles to `portfolio.ts`, so the work appears properly in Workspace and Evidence.
- Use existing operations only. If a defect can't be shown with the current allow-list, **stop and ask** before
  adding one. A new op changes `schemas/lab.py`, the engine, its tests and the OpenAPI document.

**Acceptance criteria:**
- The score is `found / planted` from the manifest, never estimated.
- A defect claimed without a supporting query result isn't counted.
- Attempts are stored under the Databricks preparation by slug. Re-running after a 409 moves to the next
  generation.
- The station says it's a teaching simulation over a fictional pack, not a real Hadoop or Databricks system.
- Evidence shows Station D work at the right level: correct → demonstrated, plus an explanation → evidenced.

**Verify:** engine tests in the scratch venv (`test_lab_engine*.py`, `test_lab_packs.py`); component and
service tests; `e2e/databricks-sandbox.spec.ts`; axe and 390px on the lab page in light and dark.

**Stop if** grading would need AI, or a defect in `dataset.json` turns out not to be reproducible from the
engine's output.

---

## P1-5: Station I, identity and governance (a simulation)

**Goal.** Two puzzles, both pure simulation, with no real Azure or Databricks calls:
- **Identity.** Service accounts are spread across Kerberos realms. Find the one that can't get an Entra ID
  token after the cutover, then plan the move to service principals and managed identities as a workstream with
  its own sign-off.
- **Governance.** Redesign an Apache Ranger row- and column-level policy as a Unity Catalog grant, row filter or
  column mask (or an ABAC rule, if that is generally available at build time). Keep *why* the policy existed,
  not just its configuration.

**Read first:** `factoryModel.ts` + `factoryCouplings.ts` and `adfModel.ts` + `pipelineCouplings.ts`. They are
pure models whose source records are typed (kind `fact` means "from the guide"). Also `CouplingLedger.tsx`,
`stationC.ts`, and the ADF accuracy rules in CLAUDE.md, which set the standard of care.

**Build:**
- A pure TypeScript `services/lakehouse/identityModel.ts`, with its own typed source records.
- A Station I component, with challenge ids `lakehouse.i.*`.
- Add `i` to the pack's stations, and add titles in `portfolio.ts`.

**Content rule, the main risk:** every technical claim must cite an official source in its source record
(Microsoft Learn for Entra ID, Kerberos and managed identities; Databricks documentation for Unity Catalog).
Check each claim against that source. Separate documented fact from the simulation's own simplification, and
label the simplifications. The fictional scenario must never read as a statement about a real tenant.

**Acceptance criteria:**
- Each claim shown has a source record. The model is deterministic and pure, with unit tests for each puzzle's
  answer.
- Feature status (for example Unity Catalog ABAC) is stated as checked on a named date, not assumed.
- Grading is deterministic. The written migration plan or rationale counts as the learner's explanation, which
  makes it evidenced. It is never auto-scored.

**Verify:** model and component tests; `e2e/databricks-sandbox.spec.ts`; axe and 390px in light and dark.

**Stop if** you can't check claims against official documentation in the session. List the unverified claims and
ask, rather than shipping them.

---

## P1-6: AI feedback on acceptance criteria

**Goal.** When a learner writes acceptance criteria in the lab, an AI provider gives feedback on them. This
**adds to** the existing deterministic checks (`acChecks.ts`) and doesn't replace them.

**Read first:** `backend/app/llm/types.py` (`LLMTask`, and the `TaskSpec` table), `llm/gateway.py`,
`services/llm_config_service.py` (task labels and the "what happens without a provider" text),
`design_review_service.py` (the `not_graded` paths to copy), `docs/wiki/AI-Providers.md`, and the AI providers
settings section with its tests. Search for assertions on the number of tasks: `toHaveLength` / `toHaveCount`
across the frontend, and any backend test that lists every task.

**Build:**
1. A new task, for example `LLMTask.ACCEPTANCE_CRITERIA_FEEDBACK`, with a `TaskSpec`, a label and a
   no-provider message in `llm_config_service.py`. It gets its own per-task binding like the others.
2. One endpoint on the lab router that takes the criteria text and returns feedback, or `not_graded` with a
   reason.
3. In `AcExplain.tsx`, a "Get AI feedback" action. The result is shown beside the deterministic checks and
   labelled as AI feedback.
4. Update `docs/wiki/AI-Providers.md` in the same PR (rule 7: sync the wiki only after merge).

**Acceptance criteria:**
- The response schema has no score or verdict field. Its status is a `Literal` (for example `"feedback" |
  "not_graded"`), and the UI shows no number.
- Editing the criteria after asking clears or marks the old feedback. Asking twice shows only the latest answer
  (common mistake 3).
- No provider for the task → "Not Graded" and why. A provider failure, timeout or unreadable reply →
  `not_graded`, never a made-up verdict or score.
- The feedback **never** sets `correct` and never raises an evidence level. Evidence treats AI-assessed work as
  "completed" at most.
- Feedback isn't stored (no new table). If storing it starts to look necessary, stop and ask.
- Nothing calls the network unless the learner set up a cloud provider for this task, which is the offline
  guarantee.

**Verify:** backend tests for each `not_graded` path, using a fake provider (no network); the task-list and
settings tests updated to the new count; component tests for the action and the Not Graded state; OpenAPI and
types regenerated; full suites.

**Stop if** routing the new task needs changes to how existing tasks are bound or migrated.

---

## Verification every PR reports

Report the exact commands and the observed results. Keep confirmed passes separate from tests not run and from
environment failures.

1. Write the item's new tests first, and show that they fail without the change.
2. Run the affected test files, then the full suites: `pytest -q` (from a worktree if the app is running), and
   `npm test -- --run`, `npm run typecheck`, `npm run lint` (0 errors) in `frontend/`.
3. Playwright: run `e2e/databricks-sandbox.spec.ts`, plus `accessibility`, `responsive` and `navigation` if a
   screen or route changed. Use 3 workers from PowerShell, and re-run any crash alone before judging it.
4. Run CLAUDE.md's pre-completion checklist: count assertions, hex colours and font sizes, route coverage in the
   three specs, heading levels, overlapping requests, and full suites.
5. Write the gate report, update the plan's status row, and confirm in the PR description that nothing outside
   the item changed.

## A starter prompt for each session

> Build Lakehouse Lab item **P1-n** only. Read `CLAUDE.md` and `docs/implementation/lakehouse-p1-handoff.md`
> (the safeguards, the common mistakes, then the P1-n section), on a new branch from the latest `main`. Write the tests first, follow
> the stop conditions, and don't commit or push until I ask.
