# Phase 8 — Production readiness, curriculum integrity and full-system validation

Branch `feat/phase-8-production-readiness`, from `main` @ 40e9319 (PR #79, Phase 7, merged
2026-10-08). Phase 8 adds no product surface. It proves and hardens what Phases 1–7 built.

## 0. Starting condition

| Check | Result |
|---|---|
| Phase 7 merged into `main` | Yes — PR #79, merge commit 40e9319, parents f972878 (Phase 6) and cc7aeaf (Phase 7) |
| `origin/main` tree vs the verified Phase 7 commit | Identical (`git diff cc7aeaf origin/main` empty); no commits after the merge |
| Local `main` | Was stale (066472b); fast-forwarded to 40e9319 before branching |
| Untracked files in the checkout | Pre-existing prototype files (`PrepBench_Unified_*.md`, `package.json`, `package_review.py`, `start_unified_prototype.bat`, `frontend/public/assets/brand/ref-*.png`); not Phase 8's, left untracked |

## 8.1 Phase 7 baseline

The **code** baseline is exactly the tree Phase 7 verified (pytest 1044 passed / 2 skipped,
Vitest 1485, full Playwright 103/103).

The **learner's data** has not yet been through any Phase 7 learner action (read from a scratch
copy of the database, never the learner's file):

| | Learner's database today | After the learner's Phase 7 actions |
|---|---|---|
| PSM I | roadmap 3 (lakehouse) linked | no roadmap |
| System Design | roadmap 4 (copy) linked | no roadmap |
| Databricks | no roadmap, no ADLS | roadmap 3, ADLS optional |
| ADF roadmap 6 | 60/60 titles bare numbers | 60 real titles |
| Agentic AI roadmap 5 | 596 sections `learner` | 581 `course`, 15 `learner` |

Phase 8's rules forbid closing that gap from code (no silent rewrite, no startup repair), so the
app correctly shows what is linked today. The actions exist, preview first, and are verified on
a scratch copy below. **They are the learner's to run.**

D1–D6 verified in code: importer and title repair (D1), `learner | ai | course` (D2), Unlink and
the live `roadmap` capability (D3), demonstration-only completion (D4), ADLS by learner action
(D5), System Design work unowned with no backfill (D6). No Phase 7 regression found in
Certification, Interview, Learning Lab, Workspace or Evidence (full suites below).

## Findings and fixes

| # | Finding | Where | Fix |
|---|---|---|---|
| F1 | Unreachable positional mapping: Phase 7 replaced `find_mapped_chapters_for_topic`'s body but left the old one after the new `return` — an all-packs title match and an `order_index + 1` fallback | `content_pack_service.py` | Dead code and its only caller (`get_linked_pack_for_roadmap`) removed. No behaviour change: it never ran |
| F2 | System Design decided by `subject.id === 3` on the Interview hub and practice setup (a learner preparation reusing id 3 would be treated as System Design); "System Design Studio (32 prompts)" hard-coded | `InterviewHubPage.tsx`, `InterviewPracticeSetupPage.tsx` | New capability `systemDesignStudio`, read from the `system-design` slug — the same editorial rule the backend uses (`home_service._owns_system_design`); count removed |
| F3 | Home fell back to PSM I (`has_exam_profile ?? subjects[0]`) while the preparation provider was still loading with nothing stored, and started PSM I-scoped requests | `HomePage.tsx` | The context says whether a provider supplies it (`provided`); Home waits for a loading provider and never guesses |
| F4 | `GET /learning/attempts` with no `subject_id` returned **every preparation's** attempts | `learning_attempt_repository.py` | Omitted = attempts with no preparation (the Chart Sandbox's — the only caller that omits it, and it only keeps its own). Reverses a note in CLAUDE.md that said the sandbox needed "all"; it did not |
| F5 | With no preparation chosen, the sidebar's Review badge and `/review` read **every preparation's** mock misses | `Sidebar.tsx`, `ReviewPage.tsx` | No preparation, no request: the badge is hidden, `/review` says to choose a preparation |
| F6 | `GET /interview-questions` with no `subject_id` returned every question including a preparation's own (ADF's saved Say-it answers), and the library and practice screens asked that way — another preparation would list ADF's questions (latent: the learner has none saved yet) | `interview_question_repository.py`, `InterviewLibraryPage.tsx`, `InterviewPracticeSetupPage.tsx` | Omitted = the shared library (no owner); screens show shared + the chosen preparation's own (`services/interviewLibrary.ts`), latest request wins |
| F7 | Two Workspace/Evidence assertions checked "no lab run at all" rather than "not this preparation's", so they failed when other tests left unowned runs | `test_workspace_evidence.py` | Asserted by owner |
| F8 | System Design's interview practice opened on the `system_design` tab before the round tabs had loaded — MUI logged an invalid Tabs value on every visit (found by the rendered audit) | `InterviewPracticeSetupPage.tsx` | The tab on screen is always one that exists; the asked-for round is selected once its tab loads |
| F9 | A Phase 7 test asserted an effect-driven fetch had happened as soon as a link rendered; it failed once in a full Vitest run under load | `RoadmapTopicPage.test.tsx` | Waits for the call instead of assuming it |

### Kept, and why (not "omitted = all" leaks)

These endpoints still treat an omitted `subject_id` as unscoped. No screen calls them without a
preparation where a preparation's view is expected:

- `GET /review/queue`, `GET /review/counts`, `GET /home/activity`: every caller now passes a
  preparation or does not call (F5). Changing the API default would rewrite the review test
  suite's ~15 direct calls and require a "belongs to no preparation" rule for mocks that does not
  exist (a mock belongs by `subject_id` *or* certification string).
- `GET /analytics/*`: Insights calls only with a preparation.
- `GET /questions`: the Question Bank's catalogue; the preparation-scoped views pass `subject_id`.
- `GET /roadmaps`: the documented catalogue default; every screen uses `getScopedRoadmaps` or
  filters to its preparation.
- `GET /home`: the deliberate all-preparations overview, broken down per preparation.

## 8.2–8.3 Curriculum and knowledge relationships

Checked on a scratch copy of the learner's database, in both states (as-is, and after the
learner's Phase 7 actions run there exactly as the learner would run them).

| Preparation | As the data stands | After the learner's actions | Verdict |
|---|---|---|---|
| PSM I | Certification, 709 questions; roadmap 3 linked, so Home truthfully shows its 63 topics / 13 phases / 188h | 709 questions, **no roadmap**, "Link or import a roadmap"; Study Library's practice from the bank | Truthful in both; the lakehouse claim disappears only by the learner's Unlink |
| Databricks | No roadmap, no pack: "No curriculum linked yet"; Lakehouse Lab available | Roadmap 3 + ADLS: 63 topics, 11 guide chapters, 0 scenarios claimed | Truthful; one Lakehouse Lab (`/databricks-sandbox`), no second |
| System Design | Roadmap 4 (copy) linked | "No curriculum linked yet"; interview, studio and design reviews by the `system-design` slug | Truthful; no replacement roadmap, no ownership backfill (D6) |
| Kafka | Certification, **0 questions**: Home "0 questions in the bank", the hub "0 Questions Loaded", mocks locked | Same (roadmap 1, 45 topics, 10 phases, 134h, live) | No PSM I substitution, no runnable mock |
| Agentic AI | 77 topics / 14 phases / 342h; 596 sections "Written by you" | 581 "Course lesson" (exact six-field matches), 15 still "Written by you" | No pack created, no content generated, no row relabelled without proof |
| ADF | 60 topics / 12 phases / 176h with bare-number titles; 21 chapters, 18 scenarios | 60 real titles (ids unchanged, topic 278 still in progress with its 122-character note; a second run changes nothing) | Matches the expected 12 / 60 / 21 / 18 / 5 |

**ADF relationships** (from the pack and the registry, not from position):

- The pack aligns all 60 topic numbers, by title and by number; 21 unique chapters; 18 written
  scenarios, each on a real chapter.
- The lab registry holds exactly the five canonical experiments (Concurrency Budget, Watermark &
  Transient Failure, Trigger Behaviour, Copy Performance, Fault Tolerance with the `dependency` and
  `bad-rows` tracks). Each of its 17 topic links names the topic exactly as the pack aligns it.
  Now pinned by `curriculumLinks.test.ts`.
- Topic → chapter by title or stated number only; topic → scenario through the scenario's
  `chapter`, many-to-many; topic → experiment through the registry's topic numbers. A topic with
  no mapped chapter links nothing.
- Scenario and lab evidence shows on a topic, read-only; completion stays demonstration-only (D4):
  every roadmap-6 status unchanged after every action.

**Learner-data integrity (8.6):** nothing at startup writes curriculum tables (no `UPDATE`/`INSERT`/
`DELETE` on roadmaps, topics, guide sections or pack links in `main.py`, `core/database.py` or the
seeders; Phase 7 changed no startup code). Every repair is preview → confirm; the title repair
changes only `title`, rolls back if anything else would move, and is idempotent. Phase 8 deletes
nothing and writes nothing to learner rows.

## 8.4 Isolation

New `backend/tests/test_phase8_isolation_matrix.py` (54 tests): seven preparations shaped like the
real ones (a certification with a bank, one with none, Databricks + ADLS, System Design, Agentic
AI, two on the ADF pack), each with its own roadmap, topic, guide section, demonstration,
learning attempt, interview question and (certification) question. For **all 42 ordered pairs**,
none of one preparation's work appears in the other's roadmaps, Workspace, Evidence, learning
attempts, interview questions, questions or review queue; with no preparation, none of anyone's;
a deleted preparation's reused id inherits nothing; packs map only within their preparation.
Checked to fail when the old "omitted = all" attempts list is put back.

Existing suites still pass: preparation isolation (17), subject isolation (8), learning-attempt
isolation (16), Workspace/Evidence (14), and the frontend latest-request-wins tests.

## 8.7–8.10 Verification (final, on the final code)

| Suite | Result |
|---|---|
| Backend `pytest -q` | **1098 passed, 2 skipped, 0 failed** (1044 + the 54-test isolation matrix); run from a throwaway worktree holding the same changes, because the learner's app was open and writes the real WAL |
| Vitest | **127 files, 1500 tests passed** |
| `npm run typecheck` (app + e2e, incl. `apiContract.check.ts`) | clean |
| `npm run lint` | 0 errors; the same 67 warnings as `main` (none new) |
| OpenAPI | regenerated (148 paths; description-only changes for the two re-scoped lists); `test_openapi_contract` passes |
| Playwright, full suite from a clean state (no leftover servers or processes, `test-results` cleared, default 2 workers, `chromium` + `chromium-dev` navigation crawl + `performance`) | **103 passed, 0 failed, 0 flaky, 0 skipped** (17.2 min) |

Along the way, and why each was not a product defect or was fixed:

- An earlier full Playwright run failed `offline.spec` on `/review`: with the server cut off and
  nothing chosen, Review (after F5) said "No preparation is chosen" — true, but it hid that the
  preparations could not be read. Fixed: Review waits while preparations load and says "Could not
  load your preparations" with Retry when they fail, as Exam setup and Practice already did; the
  spec's expected wording updated for that structural change.
- The same run failed `certification-journey` with "socket hang up" on one of its own API calls; it
  passes alone, and the final full run is green. The audit showed the same keep-alive race
  (Vite proxy `ECONNRESET` / `socket hang up`, backend logging no error, every endpoint 200 on
  retry).
- One full Vitest run failed a Phase 7 test (F9) and another overlapped the backend suite (two
  load timeouts, both pass alone); the final full run is green.

## 8.8 Accessibility and layout, on real data

Rendered on the scratch copy in **both data states**, for all six preparations and no preparation,
in light and dark, at 1280px and 390px — 81 screens per state, including Home, Study Library,
Roadmaps, Workspace, Evidence, Certification, Interview, interview practice and library, Review,
Exam setup, Question Bank, the Lakehouse Lab, System Design studio and design reviews, ADF's
roadmap, a topic, a scenario and the lab:

- **0 axe violations** (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`), **no
  sideways scroll** at 390px.
- Console: one real warning, fixed (F8); otherwise only proxy connection resets from requests the
  audit cut off by navigating on.
- No preparation screen asked a preparation-scoped list without a preparation (the audit flagged
  every such request; the only unscoped reads were Workspace/Evidence's own labelled
  "no preparation" panel, by design).

## 8.11 Production hardening added

- `test_phase8_isolation_matrix.py` (54 tests), checked to fail on the old leak.
- Registry ↔ pack agreement for the ADF lab (`curriculumLinks.test.ts`).
- `systemDesignStudio` ownership by slug, not id (`capabilities.test.ts`, `InterviewPracticeSetupPage.test.tsx`).
- Home waits for a loading provider (`HomePage.phase3.test.tsx`).
- Review and the sidebar make no unscoped request; Review is honest when preparations fail (`ReviewPage.test.tsx`, `Sidebar.test.tsx`).
- The interview library is shared + own, never another's (`interviewLibrary.test.ts`, backend and e2e).

## 8.12 Release gate

**Remaining, not blockers in code — the learner's own actions** (each is a preview-then-confirm
action in the app; Phase 8 must not run them):

1. Repair ADF topic titles (roadmap page → Curriculum tools → Repair numbered topic titles, with
   `docs/research/ADF_Master_Roadmap_Mapped.xlsx`).
2. Label Agentic AI course lessons (roadmap 5 → Curriculum tools → Label course lessons, with
   `docs/research/agentic-ai/lessons/*.guide.json`).
3. Roadmaps: unlink roadmap 3 from PSM I and link it to Databricks; unlink (and archive) roadmap 4
   from System Design.
4. Optionally attach ADLS to Databricks (the preparation's edit page).

Until then the app shows, truthfully, what is linked: PSM I's Home lists roadmap 3's 63 topics.

**Known limitations kept:** System Design attempts and design reviews have no owner (D6);
`/review/*`, `/home/activity`, `/analytics/*`, `/questions`, `/roadmaps` keep an unscoped API
default with every screen scoped (see "Kept, and why"); the backlog items in CLAUDE.md are
unchanged.
