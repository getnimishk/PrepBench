# Phase 3 Gate Report — Shell and Preparation Context

**Date:** 2026-09-13 · **Format:** plan §40 · **Gate decision: PASS**

Phase 3a (subjects CRUD API) is reported separately in
[GATE-3A-REPORT.md](GATE-3A-REPORT.md). This covers the rest of Phase 3.

---

## Implemented

| Item | Result |
|---|---|
| Preparation picker in the header | On every screen except focus layouts (exam runner, interview recording), where it is hidden deliberately |
| Selected preparation | Shared app-wide; survives reload; falls back safely when the selected one is deleted or archived |
| 13-item sidebar | Grouped: Certification · Interview · Workspace |
| My Preparations, Add, Edit screens | New routes `/preparations`, `/preparations/new`, `/preparations/:id/edit` |
| Home, Insights, Mock Exam follow the picker | Previously each guessed its own preparation ("most mocks wins") and ignored the picker |
| Question Bank scoped | Defaults to the picked preparation; "All questions" is one click away |
| Roadmaps grouped | This preparation's roadmaps, plus a labelled "Not linked" group with a Link action |
| Browser tests (Playwright) | 8 tests, isolated from real data, added to CI |
| API contract snapshot | `docs/api/openapi.json` + a test that fails when the API shape changes |

## Proof it works

- **Isolation (plan §9), in a real browser:** pick preparation A → only A's questions show → switch to B → only B's → switch back → A's are intact. Passes.
- **Persistence (plan §30):** the chosen preparation survives a hard reload. Passes.
- **Real data untouched:** after every E2E run the real database still has exactly 3 preparations and 712 questions. The tests use `backend/data/e2e_exam_simulator.db`, deleted and re-seeded before each run.
- **Contract test can fail:** adding a probe field to a schema made it fail and name the schema (`LearningAttemptResponse`); reverted.

## Bugs found and fixed during this phase

1. **Picker read "No preparation" after deleting.** The edit page cleared the selection by hand after the context had already picked a valid fallback. Removed; covered by an E2E assertion.
2. **Question count disagreed with the exam engine** (found at the start of 3a; see GATE-2 report).

## Deviations from the prototype

- **Add preparation has 2 steps, not 3.** The prototype's middle step picks from a certification catalogue. No catalogue exists, and hardcoding the prototype's four examples would make them look like the supported set. Step 2 asks for the name and exam profile together.

## Corrections to earlier reports

- Phase 2's impact report said roadmap import accepts `subject_id`. **It never did.** Corrected in place. The Roadmaps screen now links an imported roadmap straight after import using the ordinary update.

## Files

New: `PreparationContext.tsx`, `PreparationPicker.tsx`, `PreparationsPage.tsx`, `PreparationNewPage.tsx`, `PreparationEditPage.tsx`, `playwright.config.ts`, `e2e/` (helpers, 2 specs, tsconfig), `backend/scripts/export_openapi.py`, `backend/tests/test_openapi_contract.py`, `docs/api/openapi.json`.

Changed: `App.tsx`, `Navbar.tsx`, `Sidebar.tsx`, `HomePage.tsx`, `AnalyticsPage.tsx`, `ExamSetupPage.tsx`, `QuestionBankPage.tsx`, `RoadmapListPage.tsx`, `api.ts`, `types/subject.ts`, `types/roadmap.ts`, `vite.config.ts`, `package.json`, `.github/workflows/ci.yml`, `.gitignore`.

## API / DB changes

None beyond Phase 3a. Frontend-only plus tooling.

## Tests

| Suite | Before Phase 3 | After |
|---|---|---|
| Backend | 494 | **522** (+24 subjects CRUD, +2 migration, +2 contract) |
| Frontend unit | 471 | **471** |
| E2E (browser) | none | **8** |
| Typecheck | app only | app **and** E2E tests |
| Lint | 0 errors / 16 warnings | 0 errors / 17 warnings — the new one is the same fast-refresh hint `ThemeContext.tsx` already carries |

## Known limitations

- **Archive is only partly visible.** An archived preparation leaves the picker, but Home and Insights still load every preparation for their "other preparations" sections.
- **Browser tests still write to the real `backend/data/` folder for recordings and AI secrets** if a test ever touches those. None of the current 8 do. Same root cause as the open memory note about the pytest suite.
- **The pytest real-database fix lives on branch `claude/brave-wilson-b76a75`** and is not merged here.
- **The API contract checks the backend only.** It proves the API shape didn't change silently; it does not prove the hand-written frontend types match it.
- **Frontend unit tests don't cover the new screens yet** — they are covered by the E2E tests instead.

## Gate decision

**PASS.** Every screen in scope has a route, loads real data, performs real saves, and the §9 isolation journey passes in a browser against an isolated database.

**Next: Phase 4 — Home and daily goals.**
