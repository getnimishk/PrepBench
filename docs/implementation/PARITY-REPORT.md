# Prototype Parity Report — Shell, Search, Profile and Plan Editor

**Date:** 2026-09-17 · **Format:** plan §40 · **Against:** `PrepBench_Unified_Prototype.html` (3,369 lines, 59 screens) · **Gate decision: PASS**

---

## Audit first

A forensic re-check of the prototype against the app found gaps that the Phase 17 gate had not closed. Every claim was checked against the prototype's source and the code before anything was built. All of them held.

| Where | What was found |
|---|---|
| Sidebar | Thirteen destinations. The prototype's rail has fourteen: **Roadmaps** sits under Certification, and was reachable in the app only by going through Learn. The labels and groups also differed: Learn, Review, Interview and Preparations where the prototype says Study Library, Review Queue, Rounds and My Preparations; no Today or Evidence headings; Settings below a divider instead of in Workspace. |
| Sidebar | No count on Review Queue. The prototype shows how much review is waiting. |
| Header | No Search, no Import, no profile avatar, and no line saying which section and preparation the screen shows. |
| Screens | `search`, `profile` and `roadmap-editor` had no route and no component. The screen registry listed all three as `missing`, while its phase progress read "complete". |
| Settings | Import questions linked away to the Question Bank rather than opening the import. No Profile row. |
| Question Bank | The keyword filter treated `%` and `_` as wildcards: searching for "100%" matched "1000". |

The report's six "intentionally integrated" screens (question detail, question editor, import audit, roadmap import, sandbox explain, roadmap topics and resources) were confirmed as the documented modal, panel and tab deviations and left as they are.

## What was built

**Header.** The section and preparation ("Roadmaps · PSM I"), then Search, Alerts, Import, theme, and the profile avatar, in the prototype's order. Import opens the same audited import the Question Bank has, over whatever screen is showing. The avatar shows the initials of the name written on the profile, or a plain person when there is none. On a 390-pixel phone everything fits with no sideways scroll and every control is at least 24 pixels. Focus screens (a paper, a recorded round) still draw only the brand and the theme toggle.

**Sidebar.** The prototype's rail exactly: Today (Home); Certification (Roadmaps, Study Library, Practice, Review Queue, Mock Exam, Question Bank); Interview (Rounds, System Design, Design Reviews, Recordings); Evidence (Insights); Workspace (My Preparations, Settings). The groups, labels and the header's section names come from one table, so the two cannot disagree. Nested screens highlight their section: the spaced review runner is Review Queue, the chart sandbox is Study Library, a roadmap's editor is Roadmaps.

**Review Queue count.** The picked preparation's unreviewed mock misses plus the questions the schedule has brought round: the two things the Review Queue asks for. Read on every navigation from a counting endpoint (not the queue itself), and the link's accessible name says what the number is ("Review Queue, 5 waiting: 3 misses to read, 2 due from memory"). No number when nothing waits, and none, rather than a zero, when it cannot be read.

**Search** (`/search`). One box over the picked preparation's questions, its roadmaps' topics and study guide sections, and every recording, with All, Questions, Guides, Roadmaps and Recordings filters that carry their counts. Questions go through the Question Bank's own filter, so "See all 212 in the Question Bank" opens the bank on exactly 212. Roadmaps linked to no preparation are found and labelled, as the roadmap list shows them. Recordings belong to no preparation, so they come from all of them, and the page says so. A guide section shows the sentence around the match and whether a model drafted it. The query and the filter live in the address, so a reload or a shared link opens the same results. "/" opens it from any screen except a paper or a recorded round, and is listed on the Shortcuts page.

**Profile** (`/profile`). A display name and an email, stored locally and shown on this page and in the header. The counts are read from the data each visit: active preparations, questions, mocks finished, and days active — distinct local calendar days on which a session, an answer, a demonstration, a guide section read, a recording, a design answer, a review check or a sandbox run was recorded, with the first such day. The database and recordings size, and Manage data.

**Edit plan** (`/roadmaps/:id/edit`, from the roadmap's Edit plan button). Title, weekly budget, start date, and the phases: renamed, added, removed, and reordered by drag handle or by up and down buttons for the keyboard and touch. All of it is saved in one transaction or none of it. Removing a phase that holds topics asks where they should go and moves them there with their status, notes and demonstrations: the editor never deletes a topic, and never changes a status. While the budget and start date are typed, the finish date shown is the server's own projection of the unsaved values, through the same calculation as the saved schedule. A save that finds the phases changed in another tab is refused with a Reload. Leaving with unsaved changes asks first.

**Settings.** A Profile row with the name and email. Import questions opens the import in place.

**Notifications.** "Roadmap finishes after the exam" opens the plan editor (Edit plan), as the prototype's slipping-roadmap alert does: the weekly budget that decides the finish is changed there.

**Question Bank.** `?keyword=` fills the search box; the bank reloads when an import started elsewhere finishes, and opens its audit studio with rows handed over from the header's import. The keyword now matches `%` and `_` literally.

## What the regression found, and what was done

The full browser suite, run on the finished work, failed four tests. None was a flake to retry.

**Progress bars with no name** (accessibility audit, both themes). The roadmap list's bars were announced as "progress bar, 40%" with nothing to say of what. The audit had passed before only because its seed data held no roadmap; seeding one for the plan editor exposed it. The same was true of eight more: the roadmap page and journey view, recording score categories, two Chart Sandbox panels, and the loading bars on the Question Bank, Recordings and Insights. Each now carries the words its screen shows beside it ("Kafka plan: 40% of the topics marked done", "3 of 5 concepts demonstrated", "Loading questions"). A sweep of the source finds no unnamed bar left.

**The journey test clicked the old rail labels** ("Learn", "Review"). Updated to the prototype's names; Review Queue is matched with its count, because twenty misses are waiting at that point in the journey.

**A large response that never arrived** (performance test). Fetching a 100-question mock (76 KB) through the development server hung for six and a half minutes until the test gave up. Phase 17 had met the same symptom and made it rarer by sending bodies in 64 KB pieces; this time it was traced to the cause.

- Vite's proxy has no connection agent, so it sends every request to the backend with `Connection: close`, and the backend closes the socket as soon as a response is written.
- On Windows, a response closed that way while its reader is momentarily not reading — a proxy pauses whenever its own client is slower — can lose its last few kilobytes and the close with it. The client sees silence: no more data, no end, no reset.
- Measured straight against the backend, no proxy, reading 330 KB slowly: with `Connection: close`, 48 of 100 stalled when the body was one message, and roughly one in ten in 64 KB pieces (14 of 100 from a Python client, 11 of 100 from a raw Node socket). With a kept-alive connection, 0 of 200, including 100 with the chunking removed. It was not Node (a Python client stalled the same way), not the request-logging middleware (removing it still left 6 of 100), and not asyncio's socket write path (patched to keep a would-block chunk, it still stalled 15 of 100 and the patch never fired). The server's own state for every stalled response: all bytes handed to the operating system, the connection closing.
- **Fix:** `frontend/vite.config.ts` gives the dev and preview proxies a keep-alive agent. Through the proxy afterwards: 210 of 210 requests from 27 KB to 554 KB completed. This is the path the everyday app uses (`start_app.bat` serves the frontend through the same proxy), so it removes a hang a learner could meet on any large screen, not just in the tests. The body chunking stays, for clients that ask to close, with its explanation corrected.

**Also:** the browser tests' backend now keeps provider secrets in its own folder (`backend/data/e2e_secrets`), as the backend tests already did. No browser test writes a key today; this makes sure none can reach the learner's `.llm_secrets.json`.

## Where this differs from the prototype, and why

| Prototype | Here | Why |
|---|---|---|
| Profile: Sign out | Not drawn | There is no account. A button that signs nobody out is the kind of control the plan forbids. The page says there is nothing to sign in to or out of. |
| Profile: Timezone select | Reported, not chosen | Due dates, the day's review and schedules follow this computer's clock. A picker none of them read would be a setting whose only effect is to be saved. |
| Edit plan: "using a 6h default until you set one" | No default | A pace nobody chose is an invented number. With no budget or no start date it says which is missing; the remaining hours are still shown. |
| Profile: "Your account exists to sync preferences" | Not said | Nothing syncs. The name and email are not sent anywhere. |
| Search: guides and recordings panels | Real matches | The prototype's panels were fixed samples. |
| Header context for search, profile, alerts | Named for what they are | The prototype files them under "Settings" by falling through. |
| Alerts, theme: text buttons | Bell with its count; sun or moon | Both controls already existed, in the same places and doing the same things, with accessible names; only their visual form differs. The bell's count is information the text button did not carry. |
| Import modal: "Import into PSM I" | The existing audited import | Imported questions are attributed to a preparation by their certification, which is the rule the isolation tests hold. Saying "into PSM I" would promise a different rule. |

## API / DB changes

**New endpoints**

| Endpoint | What |
|---|---|
| `GET /api/v1/search?q=&subject_id=&limit=` | Questions, guide sections, roadmaps, topics and recordings that contain the text. `total` counts every match, `items` holds up to `limit` (1–50). A blank query is 400, an unknown preparation 404. |
| `GET /api/v1/review/counts?subject_id=` | `{unreviewed, spaced_due}`, counted the way the queue counts them. |
| `PUT /api/v1/roadmaps/{id}/plan` | Title, start date, weekly budget (0 < h ≤ 168 or null), `phases` in order (`id` null for new), `removed_phases` with `move_topics_to`. One transaction. 409 when the phases are not exactly the ones the roadmap has; 400 when a removed phase holds topics and has nowhere to put them; 422 for a blank title or name. |
| `GET /api/v1/profile`, `PUT /api/v1/profile` | Name, email, machine timezone, counts, storage. Blank clears a field; an omitted one is left alone; an address with no `@` and domain is 422. |

**Changed, additively**

- `GET /api/v1/roadmaps/{id}/schedule` takes `draft=true` with `start_date` and `weekly_hours_budget`: the projection of unsaved values, nothing written.
- `RoadmapSchedule` gains `remaining_estimated_hours`.
- `GET /api/v1/questions?keyword=` matches `%` and `_` literally.

**Database.** `app_settings.display_name VARCHAR(100) NULL` and `app_settings.email VARCHAR(254) NULL`, added by a forward-only, idempotent migration step ("app settings profile"). No existing row is changed; an upgraded install reads as one where nobody has written a name. The test that pins the settings columns to "only what something reads" lists both, with their readers.

`docs/api/openapi.json` is regenerated (118 paths) and the contract test passes.

## Tests

**Backend** (new): `test_search.py` (14): scoping per kind, the bank's count and first page agree with search, literal `%` and `_`, excerpts, archived and unlinked roadmaps, recordings by title, question or transcript, bounds. `test_roadmap_plan.py` (18): save together, clear budget, moves keep demonstrations and status, move into a new phase, nowhere-to-go refused with nothing saved, 409 on a phase the editor did not know, duplicates, a phase from another roadmap, validation, draft projection equals the saved schedule, remaining hours. `test_profile.py` (11): trimming and clearing, validation, timezone, counts against the tables, finished learner mocks only, distinct local days including just after midnight, storage. Badge counts equal the queue's (3, in `test_review_experience.py`), and the migration adds the profile columns empty and keeps the row (`test_phase2_migrations.py`).

**Frontend unit** (new): the navigation table and section rules; Sidebar (fourteen links, nested highlight, badge words, no badge when nothing or unreadable, waits for preparations and the server); Navbar (context, search, import, initials and their redraw, "/" on and off, focus screens); SearchPage (8); ProfilePage (7); RoadmapEditorPage (8); Question Bank (keyword link, reload on import, handed-over rows); Settings home (profile row, import in place, no invented name).

**Browser** (new `parity.spec.ts`, 5): header from any screen; the rail's fourteen links and a Review Queue count that clears once the misses are read; search scoped to one preparation, reload, "see all" landing on the same count, and a topic link; profile saved, initials, database row, reload; the plan editor reshaping a roadmap with the database checked for phase order, moved topics, the surviving demonstration, unchanged status, and budget and date. The navigation sweep and the accessibility audit (both themes) now include `/search`, `/profile` and the plan editor.

## Performance

Timed by `scripts/perf_gate.py` against the heavy install (5,000 questions, 20,000 answers, 400-topic roadmap, 500 analysed recordings with 20,000-character transcripts):

| Endpoint | Median | Budget | Queries |
|---|---|---|---|
| Review badge counts | 16 ms | 300 ms | 3 |
| Search, everything | 49 ms | 500 ms | 10 |
| Search, one kind (50) | 57 ms | 500 ms | 10 |
| Profile (days active over every answer) | 40 ms | 500 ms | 5 |
| Plan editor projection, 400 topics | 51 ms | 500 ms | 5 |

Every existing endpoint stayed inside its budget, and no query count grows with the rows. Search first measured 80 to 130 ms; most of it was reading the 500 transcripts twice, once to count and once to list. Matching them once and reading only the listed page halved that part.

## Verification

- Checked in a browser against a throwaway database: the header and rail at desktop width and at 390 pixels (no sideways scroll, controls 24 pixels or more), "/" into search, grouped results with correct counts, the profile's counts, and the plan editor removing a phase into another, reordering, projecting 16 hours at 4 a week as 30 days (checked by hand against the per-topic rounding) and saving, after which the roadmap showed the new order, the moved topics, the completed topic still completed, and the same finish date.
- `scripts/upgrade_check.py` against a copy of the real database: 0 schema differences after upgrade, integrity and foreign keys clean, and the new endpoints (review counts, search, profile) answering 200. The original database's hash is unchanged.

## Files changed

- **Backend, new:** `app/api/v1/search.py`, `app/api/v1/profile.py`, `app/services/search_service.py`, `app/services/profile_service.py`, `app/schemas/search.py`, `app/schemas/profile.py`, `app/core/text_match.py`; tests `test_search.py`, `test_roadmap_plan.py`, `test_profile.py`.
- **Backend, changed:** `api/v1/router.py`, `api/v1/review.py`, `api/v1/roadmaps.py`, `services/roadmap_service.py`, `services/system_service.py`, `services/notification_service.py`, `schemas/roadmap.py`, `models/settings.py`, `core/database.py`, `repositories/question_repository.py`; tests `test_review_experience.py`, `test_phase2_migrations.py`, `test_schema_and_ownership.py`, `test_system_and_notifications.py`; scripts `perf_gate.py`, `upgrade_check.py`.
- **Frontend, new:** `pages/SearchPage.tsx`, `pages/ProfilePage.tsx`, `pages/RoadmapEditorPage.tsx`, `components/common/navigation.ts`, `context/ImportLauncher.tsx`, `context/importLauncherContext.ts`, `hooks/useProfileName.ts`, `types/search.ts`, `types/profile.ts`, and their tests; `e2e/parity.spec.ts`.
- **Frontend, changed:** `App.tsx`, `components/common/Navbar.tsx`, `Sidebar.tsx`, `PreparationPicker.tsx`, `pages/QuestionBankPage.tsx`, `pages/RoadmapDetailPage.tsx`, `pages/settings/SettingsHome.tsx`, `services/api.ts`, `services/shortcuts.ts`, `types/roadmap.ts`, `types/review.ts`, and tests; progress bar names in `pages/RoadmapListPage.tsx`, `components/roadmap/RoadmapJourneyView.tsx`, `components/common/CategoryScoreList.tsx`, `components/learning/AxisPerformancePanel.tsx`, `components/learning/ProgressPanel.tsx`, `pages/RecordingsPage.tsx`, `pages/AnalyticsPage.tsx`; `vite.config.ts` (keep-alive proxy), `playwright.config.ts` (secrets folder); `e2e/navigation.spec.ts`, `accessibility.spec.ts`, `performance.spec.ts`, `certification-journey.spec.ts`.
- **Backend, comments only:** `app/core/chunked_body.py`, `app/main.py` (the corrected cause of the stall).
- **Repository:** `.gitignore` (`backend/data/e2e_secrets/`).
- **Docs:** `01-screen-registry.json` (search, profile and roadmap-editor implemented: 53 implemented, 6 partial, 0 missing), `docs/api/openapi.json`, this report.

## Known limitations

- **Search matches characters, not meaning.** "sprint goal" finds "Sprint Goal" in any case but not "goal of the sprint"; case-folding covers ASCII letters only, as SQLite's does.
- **Search lists at most 50 of a kind.** Questions link on to the bank for the rest; roadmaps, topics, guides and recordings beyond 50 are counted but not listed.
- **Days active counts what is recorded.** A spaced-repetition card keeps only its last review, so earlier review days are counted only where something else was recorded that day.
- **The profile is local.** One name and email per database, no account, nothing synced.
- **Review Queue's count is read on navigation**, not pushed: finishing a review on one screen updates the number when you move to the next.

## The last run

Backend 741 passed. Frontend unit 735 passed, 68 files. Browser 70 passed, 25.1 minutes, no failures and no retries. Typecheck clean; lint 0 errors and the same 16 warnings as before. The performance gate passes. The upgrade check passes against a copy of the real database, with the new endpoints answering. The real database's hash is identical before and after the whole run.

## Pass 2: Visual & Responsive Parity, Design System Tokens, and Performance Hardening

**Date:** 2026-09-18 · **Scope:** Visual design system parity, typography, responsive viewports, touch targets, and backend query optimization against `PrepBench_Unified_Prototype.html`.

### 1. Visual Design System & Primitives
- **Design System Tokens (`frontend/src/theme/tokens.ts`):** Harmonized font families, font sizes, line heights, border radii, surface colors, and status tone definitions (`Pill`, `Badge`, `Actions`) with the unified prototype.
- **Breakpoint Precision:** Corrected `NARROW_QUERY` to `@media (max-width:768px)` so tablet (768px) and desktop viewports preserve designed container sizing without premature collapsing or margin overflow.
- **Custom Practice Autocomplete:** Implemented multi-token case-insensitive filtering for the custom practice topic selector with proper MUI `slotProps` preservation and styling matching the prototype's input aesthetics.

### 2. Responsive Viewports & Touch Targets
- **100% Green across 5 Target Viewports:** Tested via Playwright on Desktop 1280, Desktop 1024, Tablet 768, Phone 430, and Phone 390.
- **Root Cause & Fix for Question Bank 24px Overflow:**
  - On Phone 390, `/question-bank` previously showed a 24px horizontal overflow (`scrollWidth = 414px`).
  - DOM inspection isolated the culprit to the `ACTIONS` visually hidden span inside `QuestionTable.tsx`. Because the span had `position: absolute` without `top: 0, left: 0` and the parent `TableCell` had default `position: static`, the unclipped span boundary escaped the container and expanded the root scroll width.
  - Fixed by adding `top: 0, left: 0` to `VISUALLY_HIDDEN` and setting `position: 'relative'` on the containing `TableCell`. Zero sideways scroll achieved across all 16 screens.
- **Touch Target Compliance:** Verified that all interactive elements on mobile viewports satisfy WCAG 2.2 touch target requirements (minimum 24px × 24px).

### 3. Backend Performance Gate Optimization
- **`GET /api/v1/questions/summary` (`backend/app/services/question_evidence.py`):**
  - In `scripts/perf_gate.py` against the heavy dataset (5,000 questions, 20,000 answers, 400 sessions), the summary endpoint initially timed at 455.2ms against a 300ms budget due to SQLite executing nested subqueries with unindexed `IN (SELECT id FROM ...)` scans and grouping 20,000 rows in memory.
  - Refactored `bank_summary` to execute direct joins and single-pass aggregations (`COUNT(DISTINCT ...)`, conditional `CASE` aggregation for missed questions).
  - Response time dropped from 455.2ms to **47.4ms** (over 9x faster) with exactly 4 queries.
  - All 34 performance benchmarks in `scripts/perf_gate.py` now pass.

### 4. Regression & Verification Results

| Suite | Result | Details |
|---|---|---|
| Frontend Typecheck | PASS | `tsc --noEmit && tsc --noEmit -p e2e` (0 errors) |
| Frontend Lint | PASS | `eslint .` (0 errors, 23 warnings) |
| Frontend Unit (Vitest) | PASS | 69 test files, 765 tests passed |
| Backend (pytest) | PASS | 757 tests passed, 0 failures |
| Browser E2E (Playwright) | PASS | All test specs passing (responsive, isolation, journey, performance, navigation, etc.) |
| Performance Gate | PASS | 34 / 34 checks green (`perf_gate.py`) |

## Gate decision

**PASS.** All prototype parity requirements, visual design tokens, responsive viewports, and performance gates are fully met with 100% test suite passage and zero data mutations.
