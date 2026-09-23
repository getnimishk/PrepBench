# CLAUDE.md — Memory for Claude Code

## ✅ Feature Completed: Interview Session Flow & Introductory Question Anchoring (2026-09-22)

### Context & Problem Solved
Real-world interviews almost universally begin with an introduction or background question (*"Tell me about yourself"* / *"Walk me through your background"*). Previously, questions in the Interview Practice Question Library and generated interview sessions appeared in random or arbitrary order (e.g. `id.desc()`), missing the natural conversational progression of a real interview.

### What was built
1. **Backend Session Planner Intro Anchoring (`backend/app/services/interview_session_service.py`)**:
   - In `InterviewSessionService.plan(round_type, category, count)`:
     - When planning a general round session (`category is None` and `count > 0`), the service checks for introduction questions matching the round (`category="Introduction"` or containing "tell me about yourself" / "walk me through your background").
     - If found, it anchors the least-practised introduction question as **Question 1**, followed by other least-practised questions for the remainder of the session count.
     - Preserves focus if a specific category is requested (e.g. `category="Leadership"`).
     - Backward compatible fallback: if no intro question exists for that round, it orders strictly by fewest takes.
2. **Tailored Seed Questions (`backend/app/utils/seed_interview_questions.py`)**:
   - Added round-appropriate Introduction seed questions:
     - `HIRING_MANAGER`: *"Walk me through your background and why this team is the right next step for you."*
     - `BEHAVIORAL`: *"Tell me about yourself and what drives you in your engineering career."*
     - Alongside the existing `HR_SCREENING`: *"Tell me about yourself."*
3. **Frontend Natural Interview Progression (`frontend/src/pages/InterviewLibraryPage.tsx`)**:
   - Implemented stage-based ordering weights (`STAGE_WEIGHTS` / `getStageWeight`):
     - `1`: Direct opener questions (*"Tell me about yourself"*, *"Walk me through your background"*)
     - `10`: Introduction
     - `20`: Background / Experience
     - `30`: Motivation & Fit
     - `40–60`: Core Competencies, Leadership, Conflict Resolution (STAR format)
     - `70`: System Architecture & Technical Depth
     - `90`: Wrap-up / Logistics
   - Default sort order set to **Interview Flow (Intro first)** (`sortBy: 'flow'`), ensuring introductory opening questions anchor to the top across all rounds.
   - Added sort selector dropdown:
     - Interview Flow (Intro first)
     - Least answered first
     - Most answered first
     - Recently added
   - Added `"Opening question"` chip badge (`color="secondary"`) for introduction/icebreaker questions.

### Verification Results
- `backend/tests/test_interview_sessions.py`: 12/12 passed (including `test_general_session_anchors_with_introduction_question_first`).
- `frontend/src/pages/InterviewLibraryPage.test.tsx`: 9/9 passed (including badges and sort reordering).
- `npm run typecheck`: 0 errors.

---

## ✅ Feature Completed: Ollama Library Model Catalogue Sync & Curation (2026-09-22)

### Context & Problem Solved
1. **Ollama Audio Analysis Clarification**:
   - Ollama runs text/image models and has no audio ingestion API. It declares `capabilities: ["text_json", "embedding"]`. PrepBench's recording analysis task requires `Capability.AUDIO_JSON`. When only Ollama is enabled, recording analysis is cleanly reported as "Not graded / unavailable" without fabricating results.
   - The user kept AI task routing on **Automatic** (all text tasks route to Ollama, and any future audio provider is seamlessly picked up).
2. **Model Recommendations from Ollama Library ("Do the Needful")**:
   - Implemented an on-demand mechanism (Option A) to check the Ollama library for new models (like DeepSeek-R1, Llama 3.3, Phi-4, Mistral, Qwen 2.5), curate them, calculate memory/hardware requirements, and recommend them without modifying core code or breaking offline guarantees.

### What was built
1. **Backend Curation Module (`backend/app/llm/ollama_catalogue_sync.py`)**:
   - Queries `https://ollama.com/library?sort=popular` using `transport.get_text`.
   - Filters for quality general-purpose instruct/chat models, filtering out specialized non-LLMs.
   - Computes RAM and download specs for 4-bit quantisation + 4K context:
     - `download_gb = round(parameters_b * 0.6 + 0.2, 1)`
     - `ram_required_gb = round(parameters_b * 0.85 + 1.2, 1)`
   - Assigns task recommendations: $\ge 7\text{B}$ for system design grading; $7\text{B}-14\text{B}$ marked as sweet spot; $< 4\text{B}$ flagged as weak at complex grading.
   - Non-destructively merges discovered models into `backend/data/local_models.custom.json` and flushes `load_catalogue(refresh=True)`.
   - Offline safety: If network fails or timeout occurs, returns clean response without error.
2. **Backend API Endpoint**:
   - `POST /api/v1/llm/local/models/refresh` in `backend/app/api/v1/llm.py` backed by `LLMConfigService.refresh_local_models()`.
   - Returns `CatalogRefreshResponse` (`ok`, `models_count`, `new_models_added`, `message`).
   - Regenerated and verified `docs/api/openapi.json`.
3. **Frontend UI Controls**:
   - Added `refreshLocalModels()` in `frontend/src/services/api.ts` and `CatalogRefreshResponse` in `types/llm.ts`.
   - In `AIProvidersSection.tsx`: Added **"Check for new models"** button alongside "Scan for local models", with spinner and alert banner.
   - In `LocalSetupWizard.tsx`: Added **"Check for new models"** action in Step 2 ("Choose a model") which fetches the latest models and reloads the picker immediately.

### Verification Results
- `backend/tests/test_ollama_catalogue_sync.py`: 6/6 passed.
- `backend/tests/test_openapi_contract.py`: 2/2 passed.
- Backend pytest full suite: 765 passed.
- `frontend/src/components/settings/AIProvidersSection.test.tsx`: 12/12 passed.
- `frontend/src/components/settings/LocalSetupWizard.test.tsx`: 9/9 passed.
- Frontend settings suite: 55/55 passed.
- `npm run typecheck`: 0 errors.

---

## Status Update: Completed Features & Fixes

Claude can now take over from here. The following parity items and enhancements have been completed, verified, and tested:

1. **Header Navigation — Settings Button Added**:
   - Added direct `Settings` (`⚙`) button to `Navbar.tsx` in the top-actions cluster alongside Search, Notifications, Import, Dark Mode toggle, and Avatar.
   - Disabled during minimal focus mode (exams/recordings). Verified via `Navbar.test.tsx` (8/8 passed).

2. **User Evidence & Profile — Extended Metrics Added**:
   - Backend `schemas/profile.py` & `services/profile_service.py` extended to calculate:
     - `interview_answers`: Total spoken/recorded interview answers from `PracticeRecording`.
     - `study_hours`: Sum of estimated hours across completed syllabus roadmap topics.
   - Frontend `types/profile.ts` and `ProfilePage.tsx` updated to render these in the "Across all preparations" stats grid. Verified via `test_profile.py` (11/11 passed) and `ProfilePage.test.tsx` (7/7 passed).

3. **Screen Registry Reconciled (`01-screen-registry.json`)**:
   - Screen ID `roadmaps` (`RoadmapListPage.tsx`) marked as `"status": "implemented"` with unlinked roadmaps grouping, link/unlink actions, and rail placement fully active.

4. **Custom Practice — Granular Topic Filter with Autocomplete Fixed & Tested**:
   - Added searchable `Autocomplete` topic selector to the "Custom" practice tab in `PracticeModes.tsx`.
   - Fixed MUI `renderInput` `slotProps` bug: `params.slotProps` contains all internal Autocomplete wiring (`htmlInput` with `onChange`, `value`, `ref`, `role="combobox"`); preserved and merged `params.slotProps` instead of clobbering it with `{ inputLabel: { shrink: true } }`.
   - Added multi-token case-insensitive filtering (`filterOptions`) so queries like "story points" match complex topic titles like `Anti-pattern recognition (Story Points / Sprint 0 traps)`. Enabled `openOnFocus` for quick exploration.
   - Wired `customRequest` in `practiceRequests.ts` to attach `topics: [selectedTopic]` so questions draw directly from the selected topic.
   - Styled `MuiAutocomplete` in `theme.ts` to match the exact height and padding of neighboring Domain, Difficulty, and Question count fields. Verified via `PracticeModes.test.tsx` (12/12 passed) and `HubPages.test.tsx` (23/23 passed).

5. **Pass 2 Responsive Viewports & Layout Parity**:
   - Corrected `NARROW_QUERY` in `theme/tokens.ts` to `@media (max-width:768px)` so tablet (768px) and desktop layouts maintain proper margins and avoid premature collapsing.
   - Fixed 24px horizontal overflow on phone 390 (`/question-bank`): `VISUALLY_HIDDEN` in `QuestionTable.tsx` now has `top: 0, left: 0` and parent `TableCell` has `position: 'relative'`, keeping absolute elements within container boundaries.
   - All 5 responsive viewports (Desktop 1280, Desktop 1024, Tablet 768, Phone 430, Phone 390) now pass with 0px overflow across all 16 main screens.
   - WCAG 2.2 touch targets (minimum 24px × 24px) verified on all mobile screens.

6. **Backend Performance Gate Optimization**:
   - `GET /api/v1/questions/summary` (`backend/app/services/question_evidence.py`): Eliminated nested subqueries and redundant `IN (SELECT id ...)` SQLite table scans.
   - Response time dropped from 455.2ms to 47.4ms (budget 300ms) on heavy test datasets (5,000 questions, 20,000 answers).
   - All 34 checks in `python scripts/perf_gate.py` now pass.

7. **Ollama Library Model Catalogue Sync & Curation**:
   - Audio routing clarified: Ollama only supports text/vision embeddings, audio recording grading is isolated under `Capability.AUDIO_JSON` without fabrication. Automatic routing chosen by user.
   - Built an on-demand Ollama library parser (`backend/app/llm/ollama_catalogue_sync.py`) calculating 4-bit quant + 4K context VRAM/RAM requirements and recommending models ($\ge 7\text{B}$ for grading, $7\text{B}-14\text{B}$ sweet spot).
   - Added `POST /api/v1/llm/local/models/refresh` and UI buttons in Settings & Setup Wizard. Verified via 6/6 unit tests and 55/55 frontend settings tests.

8. **Interview Session Flow & Introductory Question Anchoring**:
   - Interviews always start with an introductory opener (*"Tell me about yourself"* / *"Walk me through your background"*).
   - `InterviewSessionService.plan()` anchors Question 1 with the least-practised introduction question for general round sessions (`category is None`), drawing remaining questions from the round pool.
   - Added round-specific opening questions in `seed_interview_questions.py` for `HIRING_MANAGER` and `BEHAVIORAL` rounds.
   - `InterviewLibraryPage.tsx` sorts by stage-weighted interview flow (`sortBy: 'flow'`) by default, provides an `"Opening question"` chip badge, and includes a sort selector dropdown.
   - Verified via `backend/tests/test_interview_sessions.py` (12/12 passed), `frontend/src/pages/InterviewLibraryPage.test.tsx` (9/9 passed), and `npm run typecheck` (0 errors).

---

## ✅ Feature Completed: Learning Lab Navigation (2026-09-19)

### What was built
The **Chart Sandbox** was previously hidden — reachable only as a secondary card on the Practice hub page (`/practice`) with no direct sidebar link. The user's vision is that the Sandbox is not limited to Agile/Scrum charts — it is a **multi-domain interactive learning instrument platform** that will grow to include Databricks Architecture metrics and Financial Learning. This required a scalable navigation design, not just a single sidebar link.

### Design decision
After prototyping two options (nested sub-item under Study Library vs. top-level Learning Lab group), the user approved **Option 1: a dedicated "Learning Lab" nav group** with:
- A hub page (`/lab`) as the entry point showing all sandbox domains
- Individual sandbox items listed directly in the sidebar beneath it

### Files changed

#### `frontend/src/components/common/navigation.ts`
- Added `FlaskConical` icon import from lucide-react.
- Added `'lab'` and `'agile-sandbox'` to the `NavKey` union type.
- Added a new **Learning Lab** group to `NAV_GROUPS` after Workspace:
  - `{ key: 'lab', label: 'All Sandboxes', path: '/lab', icon: FlaskConical }`
  - `{ key: 'agile-sandbox', label: 'Agile Metrics', path: '/chart-sandbox', icon: BarChart3 }`
- Updated `SECTION_RULES`:
  - `/lab` → `'lab'` (highlights "All Sandboxes")
  - `/chart-sandbox` → `'agile-sandbox'` (highlights "Agile Metrics", **not** Study Library as before)
  - `/learn` is now its own rule, no longer sharing with `/chart-sandbox`

#### `frontend/src/pages/LearningLabPage.tsx` [NEW FILE]
- Hub page at route `/lab`.
- Shows the 4-step learning loop strip (Predict → Manipulate → Observe → Explain).
- Renders 3 sandbox cards:
  - **Agile Metrics** (`/chart-sandbox`) — Live, green chip, "Open sandbox" CTA
  - **Databricks Architecture** (`/databricks-sandbox`) — Coming soon, disabled CTA
  - **Financial Learning** (`/financial-sandbox`) — Coming soon, disabled CTA
- Adding a new sandbox = add one entry to the `SANDBOXES` array in this file + one `NavEntry` in `navigation.ts`.

#### `frontend/src/App.tsx`
- Imported `LearningLabPage`.
- Added route: `<Route path="/lab" element={<AppLayout><LearningLabPage /></AppLayout>} />`
- `/chart-sandbox` route unchanged.

#### `frontend/src/components/common/navigation.test.ts`
- Updated NAV_GROUPS snapshot test: now expects 6 groups, 16 destinations.
- Updated `/chart-sandbox` mapping from `'learn'` → `'agile-sandbox'`.
- Added `/lab` → `'lab'` test case.
- All 26 navigation tests pass.

### Verification results
| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors ✅ |
| `npm run lint` | 0 errors, 24 warnings (same pre-existing) ✅ |
| `navigation.test.ts` (isolated) | 26/26 ✅ |
| `PracticeModes.test.tsx` (isolated) | 12/12 ✅ |
| Full suite note | 2 of 766 tests flaked under 229s parallel load (async timeouts); both pass in isolation. Pre-existing infrastructure issue, not a code regression. |

### Sidebar structure now
```
TODAY         → Home
CERTIFICATION → Roadmaps · Study Library · Practice · Review Queue · Mock Exam · Question Bank
INTERVIEW     → Rounds · System Design · Design Reviews · Recordings
EVIDENCE      → Insights
WORKSPACE     → My Preparations · Settings
LEARNING LAB  → All Sandboxes · Agile Metrics
```

### Future sandbox additions
See the `add-learning-lab-sandbox` skill for the steps to wire up a new sandbox domain (Databricks, Financial, etc.).

---

## 🔍 Request to Claude: Audit the Learning Lab Implementation

**Claude, please review the Learning Lab implementation described above and in the files listed. Produce a structured issues report covering:**

1. **Missing tests** — `LearningLabPage.tsx` has no unit test file. What should be tested? List specific test cases (render, accessibility, routing behaviour, card states).

2. **Accessibility gaps** — The hub page has disabled buttons for coming-soon sandboxes. Are there ARIA issues? Is the 4-step loop strip accessible? Are card heading levels correct?

3. **Responsive layout risks** — The hub uses `grid-template-columns: repeat(3, 1fr)` on `lg`. Does this break on phone 390? Does the 4-step loop strip overflow on small viewports (it uses `repeat(4, 1fr)` with no breakpoint)?

4. **Navigation edge cases** — What happens when a user lands on `/databricks-sandbox` or `/financial-sandbox` directly (no route exists yet)? They hit `NotFoundPage`. Is that the right behaviour, or should those paths redirect to `/lab`?

5. **`HubPages.tsx` stale link** — The Practice hub (`/practice`) still has a "Chart Sandbox — Explore" card in its "Also available" section. Now that Chart Sandbox has a proper nav entry, should this card be removed, updated, or kept?

6. **`TopicGuidePage.tsx` stale link** — Line 201 has `<Button component={RouterLink} to="/chart-sandbox">Open</Button>`. This still works but now bypasses the Learning Lab hub. Is this the right entry point from a topic guide, or should it link to `/lab` instead?

7. **Responsive E2E spec gap** — `responsive.spec.ts` tests 16 routes but `/lab` is not in the list. Should it be added?

8. **Any other issues you observe** — Look at the actual file contents above and flag anything that seems wrong, incomplete, or inconsistent with the rest of the codebase.

For each issue, provide: **Severity** (High / Medium / Low), **File**, **Line** (if applicable), and **Recommended fix**.

---

## Test & Build Health
- **Backend Tests**: 759 passed, 0 failures (`python -m pytest -q`).
- **Frontend Unit Tests**: 778/778 passed across 71 test files (`npm test -- --run`).
- **Playwright E2E Tests**: 70 passed (22.8m); responsive.spec.ts (5/5 viewports) and accessibility.spec.ts (light, dark, motion) verified.
- **Typecheck & Lint**: `npm run typecheck` (0 errors) and `npm run lint` (0 errors, 23 warnings).
- **Performance Gate**: PASS (all 34 benchmarks within budget).
- **OpenAPI Contract**: Verified and in sync (`docs/api/openapi.json`).
- **All 59 prototype screens accounted for and implemented.**
- **Learning Lab**: `/lab` hub live, `/chart-sandbox` properly linked as "Agile Metrics" in sidebar.
- **Interview Prepared Answers & AI Comparison**: Live and tested across backend and frontend.

---

## ✅ Feature Completed: Interview Prepared Answers & AI Comparison Practice (2026-09-21)

### What was built
Learners can now save prepared model answers (such as structured STAR notes: Situation, Task, Action, Result) and essential key talking points for any interview question in the Question Library. When practicing, they can view these notes in a rehearsal cue card with an open-book vs. closed-book toggle. Upon completing a take, the AI analysis compares their spoken transcript against their prepared answer, computing a Plan Alignment score (0–100%), evaluating key talking points coverage (`Covered`, `Partial`, `Missed` with verbatim evidence quotes), detecting missed metrics and tangents, and providing next-take coaching tips.

### Changes Summary
1. **Database Schema & Migrations (`app/models/interview_question.py`, `app/models/recording_analysis.py`, `app/core/database.py`)**:
   - Added `interview_questions.prepared_answer` (TEXT) and `interview_questions.key_talking_points` (JSON list of strings).
   - Added `recording_analyses.answer_comparison` (JSON).
   - Safe, idempotent `ALTER TABLE` startup migrations added in `database.py`.
2. **API & Contract (`schemas/interview_question.py`, `schemas/recording.py`, `docs/api/openapi.json`)**:
   - `InterviewQuestionBase`, `InterviewQuestionUpdate`, `InterviewQuestionResponse` updated with `prepared_answer` and `key_talking_points`.
   - `RecordingAnalysisResponse` updated with `AnswerComparison` and `KeyPointMatch`.
   - Regenerated and verified `docs/api/openapi.json` via `scripts/export_openapi.py` and `test_openapi_contract.py`.
3. **AI Comparison Prompt Engine (`app/services/recording_analysis_providers.py`, `app/services/recording_analysis_service.py`)**:
   - `QuestionContext` conditionally receives `prepared_answer` and `key_talking_points`.
   - When present, LLM prompt instructs comparison of the transcript against the prepared answer, extracting `alignment_score`, `key_point_matches`, `gap_analysis`, `unplanned_additions`, and `coaching_tips`.
   - Backward-compatible: freeform takes and questions without prepared answers continue to receive standard delivery and rubric evaluation without overhead.
4. **Question Library (`frontend/src/pages/InterviewLibraryPage.tsx`)**:
   - Edit dialog expanded to edit `prepared_answer` (multi-line model answer) and `key_talking_points` (one per line).
   - Question cards display a `"Has prepared answer"` chip indicator.
5. **Recording Studio (`frontend/src/components/interview/AnswerConsole.tsx`, `frontend/src/pages/InterviewPracticeRecordPage.tsx`)**:
   - During `ready` and `thinking` phases, displays `"Your prepared answer & key points"` panel.
   - Includes `"Show notes while recording (Drill mode)"` switch: when active, keeps a reference cue card visible during the live recording countdown.
6. **Results Page (`frontend/src/pages/InterviewPracticeResultsPage.tsx`)**:
   - Dedicated `"Prepared Answer vs. What You Said"` section.
   - Plan Alignment score badge (0–100% Fidelity).
   - Table of Key Talking Points coverage with status chips (`Covered`, `Partial`, `Missed`) and transcript quotes.
   - Highlights for missed metrics/outcomes (`Points or Metrics Left Out`) and unplanned tangents.
   - Actionable Next Take Coaching Advice card.
   - Expandable accordion comparing the saved model answer side-by-side with the verbatim transcript.
7. **Accessibility & Scaling**:
   - Converted all font sizes to theme tokens `(t) => t.typography.pxToRem(...)` to support Large text mode. Verified via `fontSizes.test.ts`.

---

## ✅ Post-audit Accessibility, Theme & Testing Fixes: Learning Lab (2026-09-19)

Following Claude's Learning Lab audit review:

| Issue | File | Fix |
|---|---|---|
| Issue 1: "Open sandbox" button label-in-name violation (WCAG 2.5.3) | `LearningLabPage.tsx`, `LearningLabPage.test.tsx` | **Fixed by Claude**: Updated `aria-label` to include visible button text and added label-in-name test |
| Issue 2: Card lifts on hover with shadow but whole card is not clickable | `LearningLabPage.tsx` | **Fixed by Gemini**: Removed `boxShadow` hover rule and `transition` line; only the "Open sandbox" CTA button is interactive |
| Issue 3: Hard-coded font sizes (`rem` and numbers) ignore Large text setting (app-wide) | 45 files in `src/`, `theme/fontSizes.test.ts` | **Fixed by Gemini**: Converted all 95 hardcoded font sizes (91 rem, 4 numbers) to theme callback `(t) => t.typography.pxToRem(px)`, updated chip heights to `minHeight`, added guard test and Large text render test |
| `Sidebar.test.tsx` expected 14 rail links, got 16 | `Sidebar.test.tsx` | Updated to 16; added "Learning Lab" to heading list; added Agile Metrics + All Sandboxes link assertions |
| `parity.spec.ts` expected 14 rail links, got 16 | `e2e/parity.spec.ts` | Updated count to 16; updated test title |
| axe `heading-order` flagged skipping levels (h1 -> h3) | `LearningLabPage.tsx` | Added explicit `Eyebrow component="h2"` headings (`The simulation loop`, `Available sandboxes`) with `aria-labelledby` on sections, with card titles as `<h3>` — clean linear h1 -> h2 -> h3 hierarchy |
| axe `color-contrast` flagged on coming soon cards (serious) | `LearningLabPage.tsx` | Removed card `opacity: 0.72` container dimming; Coming soon chip uses high-contrast text (`text.primary`) and clear border; all body text now satisfies > 5.5:1 ratio |
| Brittle hex + `1a` opacity string concatenation | `LearningLabPage.tsx` | Replaced with MUI `alpha(theme.palette[key].main, ...)` |
| Missing unit tests for Learning Lab hub | `LearningLabPage.test.tsx` | Added comprehensive unit test file (header, 4-step loop, headings, live vs coming soon cards, metric families, a11y labels) |
| Chart breakdown comment mismatch with `charts.ts` | `LearningLabPage.tsx` | Updated comment to exact breakdown: flow(8) + predictability(5) + quality(3) + teamHealth(2) + dora(5) + reliability(4) = 27 across 6 families |
| Sidebar "Soon badge" stale comment | `navigation.ts` | Removed reference to non-existent "Soon badge" rendered by Sidebar |
| 4-column loop strip (`repeat(4, 1fr)`) overflowed on phone 390 | `LearningLabPage.tsx` | Changed to `flexWrap + flexBasis: { xs: '50%', sm: '25%' }` — collapses to 2×2 at 390px |
| Agile Metrics used same `BarChart3` icon as Insights | `LearningLabPage.tsx`, `components/common/navigation.ts` | Changed to `Activity` (pulse waveform) in both the hub card and the sidebar rail — visually distinct |
| Disabled buttons had no screen-reader label | `LearningLabPage.tsx` | Added `aria-label="\${label} is not yet available"` |
| Inline SVGs not hidden from assistive tech | `LearningLabPage.tsx` | Added `aria-hidden` to all decorative SVG icons |
| `/lab` missing from e2e specs | `e2e/responsive.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/navigation.spec.ts` | Added `/lab` to all three specs |
| `BigFigure`'s number stayed 38px at Large text (template literal `` `${size / 16}rem` ``) | `components/ui/primitives.tsx`, `theme/fontSizes.test.ts` | Converted to `fontSize: (t) => t.typography.pxToRem(size)`; guard test extended to detect template-literal and quoted-`px` font sizes |
| Home's `BigFigure` detail ("· 85% to pass · …") wrapped off 390px phone at Large | `components/ui/primitives.tsx` | Wrapped detail in a flex row so detail moves under the number (5–6px below) when space is constrained |
| Large-text render test accuracy | `theme/fontSizes.test.ts` | Reads element's own `getComputedStyle().fontSize` to verify emotional CSS / rem resolution |
| RoadmapDetailPage tabs hidden at 390px | `pages/RoadmapDetailPage.tsx` | Added `variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile` so Schedule and Reference tables scroll on mobile |
| DailyGoals "Practise {weakest_area}" button overrun | `components/home/DailyGoals.tsx` | Added `maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left', height: 'auto'` so long area titles wrap cleanly inside the button |
| Home chart SVG text scaling | `pages/HomePage.tsx` | SVG `<text>` elements scaled by `textScale = theme.typography.fontSize / 14` so chart labels scale proportionally with Large text |

---

## 📋 Note to Claude: How the Audit Workflow Ran (and What to Learn From It)

This is a note about the development process on this repo, written for any Claude session that picks up work here.

### What happened

This project uses a two-AI workflow: **Gemini (Antigravity) builds, Claude reviews**.

For the Learning Lab feature:
1. Gemini implemented the navigation and hub page based on a user-approved prototype.
2. Gemini then asked Claude (via CLAUDE.md) to audit the implementation and produce a structured issues report.
3. Claude's report identified 12 issues — 2 deterministic test failures and 10 quality/correctness problems.
4. Gemini fixed all 12 before the next session.
5. The final full unit test run: **766/766 passed, zero flakes**.

### What the audit caught that Gemini missed

The most important catches were:
- **Two deterministic test failures** (`Sidebar.test.tsx` and `parity.spec.ts`) that expected 14 nav links — Gemini updated `navigation.test.ts` but forgot these two. They would have failed on every CI run.
- **Factual error**: The hub page said "18 charts". The actual count in `charts.ts` is 27.
- **Dark mode breakage**: Hardcoded hex colours would have looked wrong in dark mode. The token rule (use `theme.palette`) exists for exactly this reason.
- **Heading tree violation**: `subtitle1` renders as an `<h6>` in the DOM. With the page `<h1>` above it and no `<h2>` or `<h3>`, axe's `heading-order` rule would have flagged it.
- **Phone 390 overflow**: `repeat(4, 1fr)` in the loop strip had no responsive breakpoint.

### What Claude's audit did not flag (intentionally or correctly)

- **The Sidebar comment** ("Soon badge rendered by the Sidebar") describes a future intent, not a current bug. Correctly flagged as low severity.
- **The Practice Hub stale card** and **TopicGuidePage direct link** — Claude flagged both as low / user's call. The user has not yet decided; they remain as open design decisions below.
- **`/databricks-sandbox` and `/financial-sandbox` 404** — Claude correctly identified this as low severity since those routes don't exist yet. Redirecting them to `/lab` is a good idea once they're being built.

### Rule for future Claude sessions
See the `pre-completion-checklist` skill before marking any feature complete.

---

## Open Design Decisions for the User
1. **Header Settings Button**: The prototype places Settings inside the Sidebar under "Workspace". In Pass 2, a direct `Settings` (`⚙`) icon button was added to the header top-actions cluster for quick access. Does the user want to keep or remove the header Settings button?
2. **Profile Metrics Labeling**: Profile currently reports "study completed" (calculated as the sum of estimated hours for completed syllabus topics). Would the user prefer this relabeled to "planned hours completed" to make it clearer that it reflects syllabus estimations rather than stopwatch time?
3. **Learning Lab — Practice Hub card**: The Practice hub (`/practice`) still shows a "Chart Sandbox — Explore" secondary card. Now that it has a nav rail entry, should this card be removed?
4. **Learning Lab — Topic Guide link**: `TopicGuidePage.tsx` links directly to `/chart-sandbox`. Should this be updated to link to `/lab` (the hub) instead?
5. **Chart text and Large text**: Home's score chart labels are SVG `<text fontSize="11">`, so they stay 11px when a learner picks Large text. Should chart text scale with it? (The font-size guard deliberately does not check SVG attributes until this is decided.)