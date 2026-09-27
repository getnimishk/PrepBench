# Skills, Content Packs and Role Preparation — Phase-Gated Implementation Plan

**Date:** 2026-09-26 · **Owner:** Nimish Kanungo
**Source prototype:** `prototypes/lakehouse-and-roles/` (untracked, never committed; read it, don't copy its storage)
**Reviews this plan settles:** `prototypes/lakehouse-and-roles/GEMINI-FINAL-REVIEW.md`, and ChatGPT's final review
(the author's copy, `CHATGPT-FINAL-REVIEW.md`). Both recommended the model below.
**Sister plan:** [lakehouse-lab-plan.md](lakehouse-lab-plan.md). This plan runs **first**; the Lakehouse Lab plan
continues after Phase 4 here (see §8).

This plan is written to be picked up **cold, in a new session**. Each phase has entry criteria, tasks with file paths,
tests, exit criteria and a gate. Don't start a phase until the previous gate has passed.

---

## 0. Starting a session on this plan

1. Read `CLAUDE.md`, then this file's **Status** table (§2), then **Decisions** (§1), then your phase.
2. Check what changed since the last session. The author also works with Gemini between sessions:
   ```bash
   git fetch origin && git log --oneline -10 origin/main
   ```
3. Open the prototype for reference: `prototypes/Start.bat --sample` (or `node run.mjs --sample --no-open` in
   `prototypes/lakehouse-and-roles/`). It shows every screen this plan builds. **Its data layer is localStorage and
   must not be ported**; its content and UI are the reference.
4. Branch from `main` as `feat/skills-phase-<n>`. **One PR per phase.** Never push to `main`.
5. Before stopping, update the Status table and write the **session handoff** (§9) in the gate report, or in the PR
   description if the gate hasn't been reached.

**Hard rules that bite here** (from `CLAUDE.md`):
- Never touch `backend/data/` (the learner's database, recordings, secrets). Tests redirect via `conftest.py`; any new
  test that opens its own `SessionLocal()` bypasses that and has leaked before.
- Never fabricate a result. A skill is never "ready". Role readiness stays **"Needs evaluation"**: readiness comes only
  from full mocks. The diagnostic is the learner's own rating and is never shown as a score.
- Migrations are idempotent `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` steps in `backend/app/core/database.py`,
  each wrapped so one failing step can't crash startup. No Alembic.
- Guide and scenario content is written **only from official documentation**, as recorded in
  `docs/research/*-documentation-notes.md`. A content change that isn't in the notes is a defect.
- Design system only: `primitives.tsx`, `pb.*` tokens, `pxToRem` font sizes; no hex colours; check 390px and dark
  mode; new routes go into `frontend/e2e/responsive.spec.ts`, `accessibility.spec.ts` and `navigation.spec.ts`.
- No frontend edits while Playwright is running. Docs go through PRs. Don't commit unless the author asks.

---

## 1. Decisions (settled with the author, 2026-09-26; don't reopen)

| # | Decision | Why |
|---|---|---|
| D1 | **Each technology is a Skill preparation** (`subjects.kind = skill`). No new "technology" table. | `backend/app/models/subject.py`: "Subjects, not formats, are what the navigation grows with". A skill "can never be ready, only practised". |
| D2 | **Guides and scenarios are formats**, shown for the active skill: guides in the Study Library, scenarios in the Learning Lab. | Formats are a fixed set; subjects grow. The prototype's fixed "Service guides" catalogue panel goes away. |
| D3 | **Built-in content lives as versioned files in the repo**, `backend/app/content/packs/<pack_id>/v<version>.json`, reviewed through PRs like code. | Content is shared, read-only and doc-sourced; git gives the history and review. |
| D4 | **A learner's skill pins a pack version** (`subject_content_packs.pack_version`). A newer version is offered as an upgrade, never applied silently. Every published version file stays in the repo. | Past attempts and diagnostics keep pointing at the exact text they used (ChatGPT's provenance point). |
| D5 | **Packs are offered, not forced.** Creating a Skill shows the built-in packs; one whose title matches the name is preselected. A pack can also be attached later from the preparation's edit page. | The learner owns their preparations. |
| D6 | **Guide chapters are not roadmap topics.** The roadmap stays the learner's own plan. (Later: "make a roadmap from this guide", via the existing roadmap import.) | Keeps the two concepts clean; no reading-progress tracking in v1. |
| D7 | **Scenario progress is stored as `learning_attempts`**; a Say-it answer can be saved to the **interview question library** (`interview_questions`, with `prepared_answer` and `key_talking_points`) against the skill. | Reuses the existing evidence tables and the prediction-lock rule. |
| D8 | **Roles are their own tables** (`roles`, `role_requirements`, `role_diagnostic_attempts`), not a third subject kind. Requirements link to skill subjects **only when the learner confirms the link**; the parser only suggests. | A new subject kind would touch every readiness and kind switch in the app. Confirmed links replace shared-word matching (both reviews). |
| D9 | **The diagnostic draws from the packs of the role's linked skills**; questions that don't fit a requirement are labelled "core topic", never "matched". Text answers only in v1. | ChatGPT F-02; recorded answers are a later item. |
| D10 | **Build order: foundation → guides → scenarios → roles + diagnostic → the Lakehouse Lab plan.** | Roles are medium effort and high value; the lab needs the heavy engine and has its own phased plan. |
| D11 | **The Lakehouse Lab belongs to the seeded "Databricks Data Platform" skill** (`seed_subjects.py`, slug `databricks`). | It already exists as a skill; no umbrella skill needed. |
| D12 | **Cross-cutting topics** (reconciliation, PII in banking, migration planning, recovery) **stay as chapters** inside technology guides. | Both reviews. Promote one to a skill only if it later gets its own practice and evidence. |
| D13 | **Review tooling never ships**: `/prototype`, reviewer notes, `PrototypeBanner`, `run.mjs`, `Start.bat` stay in the prototype. | They are for reviewing ideas, not for learners. |
| D14 | **A new `technical` interview round** (confirmed by the author 2026-09-27). Saved Say-it questions, and later the Lakehouse Lab's questions (its open question 4), use `round_type = "technical"`. Built in Phase 3, task 4a. | `hiring_manager`'s rubric grades STAR structure and "Specificity of Example", i.e. a real story. The scenarios' honesty rule tells learners *without* one to say how they would handle it, so those answers would be marked down unfairly under it. |

---

## 2. Status

| Phase | Scope | Depends on | Status | Gate report |
|---|---|---|---|---|
| 0 | Docs into the repo: research notes, this plan, Lakehouse plan cross-links | — | **Merged** (PR #33) | PR description |
| 1 | Content-pack foundation: pack files, loader, validation, API, skill ↔ pack link | 0 merged | Gate passed, PR open | `GATE-SK-1-REPORT.md` |
| 2 | Guides in the Study Library | 1 gate | Not started | `GATE-SK-2-REPORT.md` |
| 3 | Scenario sandbox in the Learning Lab | 2 gate | Not started | `GATE-SK-3-REPORT.md` |
| 4 | Roles from a job description + diagnostic | 3 gate | Not started | `GATE-SK-4-REPORT.md` |
| 5 | Hand over to the Lakehouse Lab plan | 4 gate | Not started | — |
| Later | See §10 | — | Not planned | — |
Gate reports go in `docs/implementation/`, next to the existing `GATE-*.md` files.

---

## 3. The gate protocol (every phase)

A phase **passes** only when every box is ticked **with evidence in the gate report** (a test name, a command output
or a screenshot). "I believe it works" isn't evidence.

This mirrors `lakehouse-lab-plan.md` §2 without its `deltalake` engine suite. Each plan keeps its own copy so it can
be picked up cold; **if you change the gate in one, change it in the other.**

- [ ] Every exit criterion of the phase is met.
- [ ] Backend: `backend/.venv/Scripts/python.exe -m pytest -q` green (the known real-database `-shm` timestamp quirk
      only after confirming by hash that nothing wrote to the real files).
- [ ] Frontend: `npm run typecheck`, `npm run lint`, `npm test` green.
- [ ] Browser: `npx playwright test` for the touched specs, then the full suite before the PR merges. A failure is
      re-run alone before concluding anything.
- [ ] Visual/accessibility pass on every new or changed route: axe clean in light **and** dark, no horizontal scroll at
      390 × 844. Use the disposable second-server setup in `CLAUDE.md`, never the author's running app.
- [ ] Pre-completion checklist: count assertions (`toHaveLength`/`toHaveCount`, nav link counts), hard-coded colours
      or font sizes, route in all three e2e specs, heading levels.
- [ ] OpenAPI: schema changed → regenerate with `scripts/export_openapi.py` (env-redirected), run
      `tests/test_openapi_contract.py`.
- [ ] Honesty review: no score, readiness or "matched" claim that isn't true; every content statement traceable to
      the notes.
- [ ] Gate report written, Status table updated, PR opened.

A failed gate means fixing and re-running it; never carry a known failure into the next phase.

---

## 4. Phase 0: docs into the repo

**Entry:** none. **Branch:** `docs/skills-plan`.

Tasks:
1. Add `docs/research/adf-documentation-notes.md`, `docs/research/adls-gen2-documentation-notes.md` and
   `docs/research/lessons/unit-01-loading-only-new-data.md` (currently untracked in the author's tree). They are the
   source every pack is checked against.
2. Add this plan, and `docs/implementation/lakehouse-lab-plan.md` if it isn't on `main` yet.
3. **Bring the Lakehouse Lab system design to `main`.** Commits `179c77e` (adds `docs/specs/lakehouse-lab-design.md`,
   353 lines) and `68422f1` (spike results in the design and PRD) were pushed to `docs/lakehouse-lab-spec-program-level`
   *after* PR #32 merged, so they never landed. Cherry-pick both onto this branch; the PRD change may conflict, so
   resolve it by keeping both sides' content. After this, the design link in `lakehouse-lab-plan.md` works.
4. `lakehouse-lab-plan.md` already carries the cross-links (a "Read first" note: this plan runs first, D10; D11; P1-3
   and P1-4 annotated as covered by Phase 4 here; open question 4 answered by D14). **Check they're still accurate**,
   and remove the "not on `main` yet" line once task 3 is done.
   In the Lakehouse PRD (`docs/specs/lakehouse-lab.md`), mark **open question 4 resolved: a new `technical` round
   (D14, built in skills plan Phase 3)**.
5. Don't add anything under `docs/wiki/` yet (rule 7: wiki only after merge, and only when features ship).

**Exit:** the docs PR is merged.

---

## 5. Phase 1: content-pack foundation

**Entry:** Phase 0 merged.

### Pack format
One JSON file per published version: `backend/app/content/packs/<pack_id>/v<version>.json`.

```jsonc
{
  "pack_id": "adf",                    // stable forever; also the URL segment
  "version": 1,                        // integer; a new file for any change a learner could notice
  "title": "Azure Data Factory",
  "summary": "Moves data and runs the schedule",
  "docs_url": "https://learn.microsoft.com/en-us/azure/data-factory/",
  "source_notes": "docs/research/adf-documentation-notes.md",
  "chapters": [
    { "id": "what-it-is", "title": "...", "summary": "...", "sources": "§1, §18.1",
      "blocks": [ { "heading": "...", "md": "...", "table": { "head": [], "rows": [[]] } } ],
      "practice_links": [ { "scenario_id": "1", "label": "..." } ] }
  ],
  "scenario_levels": [
    { "name": "Moving data", "about": "...",
      "scenarios": [ { "id": "1", "number": 1, "title": "...", "outcome": "...", "sources": "...",
                       "chapter": "incremental", "content": { /* UnitContent, see prototype units.ts */ } } ] }
  ],
  "diagnostic_questions": [
    { "id": "reconciliation", "topic": "...", "question": "...", "points": ["..."],
      "keywords": ["reconcil", "..."], "chapter": "reconciliation" }
  ]
}
```

- **Scenario ids are stable** (the prototype keeps ids stable while display numbers change; keep that). A scenario
  without `content` is *planned* and is listed but can't be opened.
- `md` uses the same Markdown subset as `components/common/Explanation.tsx`. **Table cells are plain text** (no `**`).
- Cross-references inside chapter text say "chapter N". A validator test (below) proves every N exists and that the
  referenced chapter is the one meant, by keeping a map of expected references in the test.

### Tasks
1. **Convert the prototype content** to `adf/v1.json` and `adls/v1.json`:
   - Sources: `prototypes/lakehouse-and-roles/src/services/guides/adf.ts` (21 chapters), `adls.ts` (11),
     `services/adf/units.ts` + `movingData.ts` (18 scenarios, 1–4 written), `services/roles/diagnostic.ts`
     (`TOPIC_QUESTIONS`, 12 items; their `learn` links become `chapter` ids; `lake-access` and `lake-resilience` go to
     the ADLS pack).
   - Convert by code, not by hand: a throwaway Vitest file inside the prototype that imports the modules and writes
     `JSON.stringify(..., null, 2)` to the target paths (the prototype's `npm test` runs Vitest with its Vite
     resolver). Delete the converter afterwards; don't commit the prototype.
   - Diff-check: chapter counts 21 and 11, scenario count 18, written 4, diagnostic questions 12.
2. **Loader and schema** — `backend/app/content/packs.py` (new): Pydantic models for the format above; `load_packs()`
   reads every `v*.json` once at startup (cached); `latest(pack_id)`, `get(pack_id, version)`. A malformed file is
   **logged and skipped, never fatal** (same spirit as the Lakehouse pack loader). Use `content_validator.py`'s
   conventions if they fit.
3. **Table** — `subject_content_packs` (in `backend/app/models/subject_content_pack.py`, created in `database.py`
   with `CREATE TABLE IF NOT EXISTS`):
   `id`, `subject_id` (FK `subjects.id`, **ON DELETE CASCADE**: the link is meaningless without the subject),
   `pack_id` (String 50), `pack_version` (Integer), `attached_at`; unique (`subject_id`, `pack_id`).
4. **API** — new router `backend/app/api/v1/content_packs.py`, registered in `router.py`; thin router, logic in
   `services/content_pack_service.py`:
   - `GET /content-packs` → `[{pack_id, latest_version, title, summary, chapter_count, scenario_count, written_scenario_count}]`
   - `GET /content-packs/{pack_id}?version=N` → the full pack (latest if no version); 404 for an unknown pack/version.
   - `POST /subjects/{id}/content-packs` `{pack_id}` → attach at the latest version. **Refused for a certification
     subject** (packs are for skills, D1) and for an unknown pack.
   - `PUT /subjects/{id}/content-packs/{pack_id}` `{version}` → upgrade (only to an existing, newer version).
   - `DELETE /subjects/{id}/content-packs/{pack_id}` → detach; attempts already recorded are kept.
   - `SubjectWithReadiness` gains `content_packs: [{pack_id, pack_version, latest_version, title}]`.
5. **Frontend plumbing** — `frontend/src/types/contentPack.ts`, API functions in `services/api.ts`, and in
   `pages/PreparationNewPage.tsx` (Skill path): a "Start from a built-in guide" choice listing packs, preselected
   when the name matches a pack title (D5); attach after the subject is created. In `PreparationEditPage.tsx`: show
   attached packs, "Update to version N" when newer, attach/detach.

### Tests
- `backend/tests/test_content_packs.py`: every shipped pack loads and validates; ids unique within a pack; every
  `scenario.chapter`, `practice_links.scenario_id` and `diagnostic_questions.chapter` resolves; every "chapter N" in
  chapter text is in range **and** matches the expected-reference map; no `**` in table cells; `adf` has 21 chapters /
  18 scenarios / 4 written; `adls` has 11 chapters; a malformed file in a temp packs dir is skipped with a log, not
  fatal.
- Attach/upgrade/detach: happy paths; certification refused; unknown pack 404; downgrade refused; delete subject
  removes links (CASCADE) but not learning attempts.
- Frontend unit tests for the pack-choice step (preselect on title match; none preselected otherwise).

### Exit
- The two packs ship and validate; the API and subject response carry them; a skill can be created with a pack and
  have it upgraded or detached; the gate passes.

---

## 6. Phase 2: guides in the Study Library

**Entry:** Phase 1 gate.

Tasks:
1. Routes in `App.tsx` (inside `AppLayout`): `/learn/guides/:packId` and `/learn/guides/:packId/:chapterId`.
   The pack version comes from the **active preparation's** link; with no active link, show the latest version and
   say so ("Not attached to your current preparation — attach it to keep your place").
2. `pages/GuidePage.tsx`, `pages/GuideChapterPage.tsx`: port from the prototype (`src/pages/Guide*.tsx`), using the
   real primitives. Chapter tables need visually-hidden text in any empty header cell (`CLAUDE.md`).
3. `pages/StudyLibraryPage.tsx`: when the selected preparation has packs, add a **"Guide"** panel listing each pack's
   chapters with "Read"; nothing changes for preparations without packs. **No fixed technology catalogue** (D2).
4. Practice links: chapter → scenario links render only for written scenarios, and point at Phase 3's route; until
   Phase 3 ships they're hidden (feature-flag-free: a scenario route that doesn't exist yet simply isn't linked).
5. Navigation: guides sit under the Study Library entry (no new nav item). Add the section rule in
   `components/common/navigation.ts` so `/learn/guides/...` highlights Study Library.

Tests: route in all three e2e specs (use the e2e helpers to create a skill with the `adf` pack; one guide and one
chapter route); unit test for version selection (attached vs latest); axe on the longest chapter (ADF 21, Pitfalls,
four tables).

**Exit:** a learner with an ADF skill reads all 21 chapters from the Study Library; the gate passes.

---

## 7. Phase 3: scenario sandbox in the Learning Lab

**Entry:** Phase 2 gate.

Tasks:
1. **One sandbox for all packs:** routes `/scenarios` (the active skill's scenarios by level) and
   `/scenarios/:packId/:scenarioId`. A card on `pages/LearningLabPage.tsx` ("Scenarios": incidents from real
   projects, practised in your role) and a `NavEntry` in the Learning Lab group of `navigation.ts` — follow the
   `CLAUDE.md` "adding a Learning Lab sandbox" checklist. Port `AdfSandboxPage.tsx` / `AdfUnitPage.tsx` from the
   prototype, including the four role lenses, the locked check, the case notes gate, the debrief order and the
   honesty note. Keep the locked-question contrast fix (`'&.Mui-disabled': { color: 'text.primary' }`).
2. **Persistence through `learning_attempts`** (D7), with `subject_id` = the active skill:
   - Each check question = one attempt: `challenge_id` `"<pack>/<scenario>/check/<i>"`, `concept_id`
     `"<pack>/<chapter>"`, `scenario_fingerprint` `"pack_version=<v>"`, the chosen option committed as the
     **prediction** (so the service's lock-once rule enforces "your first answer locks"), completed with `correct`.
   - Each role lens = one attempt: `challenge_id` `"<pack>/<scenario>/lens/<role>"`, fingerprint
     `"pack_version=<v>;lens=<role>"`; case notes in `explanation_text` (headed per task); ticked Say-it points in
     `rubric_coverage`; completed when the debrief is opened.
   - Confirm these shapes against `backend/app/schemas/learning.py` and `services/learning_service.py` before
     writing; adjust the encoding, not the service's rules.
3. **Protect the Chart Sandbox.** `frontend/src/services/learning/attempts.ts::fetchAttempts()` returns **every**
   attempt. Filter the Chart Sandbox's history to its own concept ids (from `services/learning/concepts.ts`) or add a
   server-side filter; add a test that a scenario attempt never changes an Agile mastery or placement figure.
4a. **Add the `technical` interview round (D14)** before the Say-it task, in its own commit:
   - Backend: `InterviewRoundType.TECHNICAL = "technical"` in `models/interview_question.py` (SQLite stores the enum
     as text, so no data migration; confirm no CHECK constraint exists on the column before assuming so); a
     `"technical"` entry in `ROUND_RULES` (`services/interview_rounds.py`) and in `CONTENT_CATEGORIES_BY_ROUND`
     (`services/recording_analysis_providers.py`).
   - Proposed defaults (confirm the wording with the author in the PR, don't block on it):
     - `target_seconds` (60, 120) and `thinking_seconds` 30: the scenarios ask for an answer "in under two minutes";
     - `plan_prompt`: "What it is → how you'd approach it → the risk you'd watch → how you'd know it worked";
     - `listening_for`: "The interviewer is checking that you understand how it works and where it breaks. Say
       what you'd do and why, name the risk you'd watch, and be clear about what you have done yourself and what
       you would do.";
     - rubric categories: "Technical Accuracy", "Structure & Clarity", "Trade-off Reasoning", "Risks & Failure Modes".
   - Frontend: add `'technical'` to `InterviewRoundType` in `types/interviewQuestion.ts`; the typecheck then flags every
     `Record<InterviewRoundType, …>` label map that lacks it. Also check by search (`hiring_manager`) the places a
     union doesn't cover: `components/home/DailyGoals.tsx`, `pages/InterviewLibraryPage.tsx`,
     `InterviewPracticeSetupPage.tsx`, `InterviewSessionSetupPage.tsx`, `components/interview/InterviewQuestionImportModal.tsx`,
     `types/interviewSession.ts`. Label: "Technical".
   - The interview question importer accepts `technical`; the mock-interview planner offers it like the other rounds.
   - Tests: backend `test_interview_questions.py` / `test_recordings.py` cases for the new round (rules and rubric
     returned); any count assertion over round types (search `toHaveLength`, `len(`) updated; the import modal's
     tests. **"Not Graded" with no AI provider** holds for this round as for the others (hard rule 2).
4. **Say-it → interview question library:** add `interview_questions.subject_id` (nullable, FK SET NULL) and
   `interview_questions.source_ref` (String 150, e.g. `"adf@1/scenario/1/lens/po"`) via idempotent migrations. The
   "Add to my interview question library" button creates a learner-owned row: `question_text` = the lens question,
   `prepared_answer` = the learner's answer, `key_talking_points` = the lens points, and **`round_type = "technical"`** (D14, added in task 4a). Re-adding updates the same row
   (match on `source_ref`). Check the interview library filters still work with the new column.
5. Guide chapter pages now show "Practise this" for written scenarios (Phase 2, task 4).

Tests: pytest for the migration (fresh and existing DB) and the Say-it create/update-by-`source_ref`; Vitest for the
attempt encoding, the lock (a second answer to a check is refused), and the Chart Sandbox isolation test; e2e:
`/scenarios` and `/scenarios/adf/1` in all three specs, plus one flow test (answer the check → notes → debrief →
save Say-it → it appears in Interview → Question library). Update any nav-link count assertions.

**Exit:** scenarios 1–4 work end to end for all four roles, persisted in the database; the Chart Sandbox's figures
are unchanged by them; the gate passes.

---

## 8. Phase 4: roles from a job description, and the diagnostic

**Entry:** Phase 3 gate.

### Data (idempotent `CREATE TABLE IF NOT EXISTS` in `database.py`)
- `roles`: `id`, `name` (String 200), `interview_date` (Date, nullable), `job_description` (Text), `lens`
  (String 10: `po|pm|dm|em`, the learner's choice, defaulted from the title), `is_archived`, `created_at`, `updated_at`.
- `role_requirements`: `id`, `role_id` (FK CASCADE), `order_index`, `text`, `kind` (`mandatory|preferred`),
  `subject_id` (FK `subjects.id` SET NULL, nullable) = **a link the learner confirmed** (D8).
- `role_diagnostic_attempts`: `id`, `role_id` (FK CASCADE), `taken_at`, `lens`, `items` (JSON:
  `[{question_ref, answer, covered: [int], confidence: "not-yet"|"partly"|"confident", fits_requirement: bool}]`),
  where `question_ref` = `"<pack>@<version>/diagnostic/<id>"` or `"<pack>@<version>/scenario/<id>/lens/<role>"`.

### API (`api/v1/roles.py`, `services/role_service.py`)
- `GET/POST /roles`, `GET/PUT/DELETE /roles/{id}` (delete = the role and its requirements/attempts; subjects untouched).
- `PUT /roles/{id}/requirements` → replace the list, including confirmed `subject_id` links.
- `GET/POST /roles/{id}/diagnostics`. The **first** attempt fixes the question set and lens; a retake must send the
  same `question_ref`s (refused otherwise) so before/after compares like with like.
- Readiness: a role exposes **no readiness number**. The page shows "Needs evaluation" and why.

### Frontend
1. Port `jdParse.ts` (+ its tests) to `frontend/src/services/roles/`. It stays pure and suggests links: for each
   requirement it proposes skills whose name or attached pack title it mentions; the learner confirms or clears each
   in the "confirm requirements" step. **No link is saved unconfirmed.**
2. Pages (port from the prototype, real primitives): `RolePreparationNewPage` (`/preparations/roles/new`),
   `RolePreparationPage` (`/preparations/roles/:roleId`), `RoleDiagnosticPage`
   (`/preparations/roles/:roleId/diagnostic`); the "Jobs you're preparing for" section on `PreparationsPage.tsx`; the
   third card "A job you want" on `PreparationNewPage.tsx`.
3. **Diagnostic selection** (port `diagnostic.ts`, then change the source): candidates = diagnostic questions and
   written-scenario lens questions from the packs attached to the **confirmed linked skills**. Rank by keyword hits
   per requirement (mandatory ×2, as the prototype does). Keep a minimum-relevance threshold; fill the rest from a
   labelled **core set** so the total is 10, and mark each question "fits: <requirement>" or "core topic". The intro
   states the real count ("6 fit this job's requirements, the rest are core topics").
4. Evidence on the role page = the confirmed linked skill; the link opens that preparation. Before/after table as in
   the prototype (`DiagnosticResults`).

### Tests
- pytest: CRUD, cascade, requirement link replace, retake with a different question set refused, no readiness field.
- Vitest: parser (port the prototype's cases), link suggestion, diagnostic selection (the prototype's
  `diagnostic.test.ts` cases, plus: no linked skills → 10 core questions all labelled core; threshold respected).
- e2e: the three new routes in all three specs; one flow test (paste the sample JD → confirm requirements and links →
  create → take the diagnostic → retake → before/after table shows).

**Exit:** a role can be created from a job description, linked to confirmed skills, diagnosed twice with a
before/after view, with readiness still "Needs evaluation"; the gate passes.

---

## 9. Phase 5: hand over to the Lakehouse Lab plan

- Mark this plan's Status complete through Phase 4.
- Continue with `lakehouse-lab-plan.md` from its Phase 0/1A. Per D11 its pages and learning attempts use the
  `databricks` skill's `subject_id`, and its interview questions (its P1-1) use `interview_questions.subject_id` /
  `source_ref` from Phase 3 here.

### Session handoff template (put it in the gate report or PR description)

```
### Handoff — <date>
Phase: <n> · Branch: <name> · PR: <link or "not opened">
Done: <bullets, each with evidence>
Not done: <bullets>
Next step: <one concrete action>
Surprises / decisions made: <anything the next session must know>
```

---

## 10. Later (not planned yet)

- Scenarios 5–18 for ADF, and scenarios for ADLS Gen2 — written from the notes, one PR per level.
- New guides, **each after its own documentation walkthrough into `docs/research/`**: Azure Databricks (next), Delta
  Lake, Unity Catalog, Lakeflow, Purview/Key Vault/Entra, Synapse/Power BI.
- Recorded diagnostic answers through the interview studio (text-only in v1, D9).
- "Make a roadmap from this guide" via the roadmap import (D6).
- AI feedback on acceptance criteria and Say-it answers — a new `LLMTask`, "Not Graded" with no provider (Lakehouse
  plan P1-6).
- Real-app tidy-ups the reviews noticed in code this plan copies: the hard-coded Chart.js colour in
  `frontend/src/main.tsx` (`defaults.color = '#5f625c'`) and the ad hoc `Card` in `pages/LearningLabPage.tsx`.

## 11. Reference: where things are in the prototype

| Prototype file | Becomes |
|---|---|
| `src/services/guides/{adf,adls,catalogue}.ts` | `backend/app/content/packs/{adf,adls}/v1.json` (catalogue dropped, D2) |
| `src/services/adf/{units,movingData}.ts` | `scenario_levels` in `adf/v1.json`; progress → `learning_attempts` |
| `src/services/roles/diagnostic.ts` | `diagnostic_questions` in the packs + `frontend/src/services/roles/diagnostic.ts` |
| `src/services/roles/{jdParse,roleStore}.ts` | `frontend/src/services/roles/jdParse.ts`; `roleStore` → `/roles` API |
| `src/pages/{Guide,GuideChapter}Page.tsx` | `frontend/src/pages/` (Phase 2) |
| `src/pages/{AdfSandbox,AdfUnit}Page.tsx` | `ScenarioSandboxPage`, `ScenarioPage` (Phase 3) |
| `src/pages/Role*Page.tsx`, `MyPreparationsPage.tsx`, `overrides/PreparationNewPage.tsx` | Phase 4 |
| `src/components/lakehouse/*`, `services/lakehouse/*` | the Lakehouse Lab plan, not this one |
| `ReviewGuidePage`, `reviewNotes`, `ReviewerNotes`, `PrototypeBanner`, `run.mjs`, `Start.bat`, `mockApi` | never shipped (D13) |
