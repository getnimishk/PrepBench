# Phase 16 Gate Report — Loading, Empty, Error and Offline States

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

---

## Audit first

Before changing anything, every screen was opened in a real browser twice: once with every API request refused (the server gone), and once with every response held back for six seconds (a slow server). What each screen said was recorded and checked against plan §22: loading must not look like data, empty must say why, errors must say what failed, whether anything was saved, and offer a retry, and work must not be called saved when it wasn't.

**With the server gone, screens made claims about data they hadn't read:**

| Screen | What it said |
|---|---|
| My preparations | "No preparations yet", under the error |
| Header picker | "No preparation", and "No preparations yet. Add one to get started." |
| Settings | "Preparations: 0 active" |
| Getting started | Every step "To do", "4 of 4 steps to go" |
| AI providers | "No AI provider set up yet" |
| Interview practice | "No questions in this round yet" |
| Interview library | "Loading…" that never ended, and "All · 0" |
| Design Review list, System Design | The empty-list message under the error |
| Question Bank | "0 questions" |

**Errors that didn't say why, or offered no way on:** about 20 screens said some version of "Failed to load… check the backend connection", without saying nothing was changed. Mock setup and interview session setup said only "Could not load …". The design review, System Design prompt and results, preparation, review queue, practice, interview question, recording results, interview session and session report screens had no Retry. The practice page called preparations "subjects".

**While loading:** Appearance showed a theme selected before the saved one had been read. Shortcuts showed the switch on before the setting was read. Interview session setup showed thinking time "0s" before the round was known. 25 screens showed a spinner with no words and no accessible name.

**Work in progress, with the server gone:**

- **System Design:** edits typed while the server was down were lost when the tab closed, and nothing said they weren't saved.
- **Mock exam:** an answer picked while the server was down was un-picked after a four-second "Network error" message.
- **Whole app:** nothing said the server was gone; each screen found out on its own, one failed request at a time.
- **Header picker:** a list that failed to load stayed empty until the page was reloaded.

## Implemented

**The app knows when the server is gone.** Every request reports whether it got an answer. When one doesn't, a banner appears on every screen, including exams and interviews: "Can't reach PrepBench's server, so nothing you do now is being saved to your data." It checks again every five seconds and on Try again, then says "Connected to the server again." A new health endpoint answers without touching the database, so a slow database isn't mistaken for a missing server.

**Failures say what, why, and that nothing changed.** One helper produces "Could not load your roadmaps. Could not reach the PrepBench server. Check that the backend is running, then try again. Nothing was changed." It's used on 27 screens and in the preparation list, and every one of those screens now has Retry.

**Unread isn't empty.** None of the screens in the first table show an empty message, a zero or "To do" for data they couldn't read:

- Getting started marks such steps "Not checked" and says how many couldn't be checked.
- Settings says "Could not be read".
- The picker says "Preparations unavailable", offers Try again, and reads the list again by itself when the server answers.
- Interview practice and the library show the failure and Retry, and no counts.
- Archiving a preparation no longer says "Nothing was changed" when the archive worked but the list then failed to refresh.

**Loading looks like loading.** 25 screens have a labelled loading state ("Loading your review queue…"). Appearance shows no theme selected until the saved one is read, the Shortcuts switch isn't drawn on or off until it's known, and thinking time says "On" until the round's own time is known.

**Work is kept on the device, and called exactly that:**

- **System Design answers:**
  - A copy is kept in the browser before each save, and removed once the server has it.
  - With the server gone, the status reads "Saved on this device · not on the server yet", and the answer is sent when the server returns.
  - Closing the tab doesn't lose it: the next visit restores the copy if it's newer than the server's, then sends it.
- **Mock exam answers:**
  - A pick made while the server is unreachable stays picked, and is kept on the device (one per question, the latest pick wins).
  - The top bar says "Saved on this device · 1 answer not on the server yet". Kept answers are sent when the server answers, or on the next visit. Then it says "Saved · every answer is on the server".
  - The paper won't submit while answers are only on the device, and says why.
  - Answers the server refuses are named, not dropped silently. For example, the time may run out while the server is away.
  - A save with no reply after 15 seconds counts as not arrived. Resending is safe: the server replaces a question's answer, it doesn't add one.
- **All five save states from the plan are in use:** Saved on this device, Saving…, Offline: not saved yet (when the browser refuses storage), Saved, Not saved.
- **Data and storage** lists how many pieces of work are kept in this browser.

## Files changed

**Backend:** `app/api/v1/system.py` (health endpoint), `tests/test_system_and_notifications.py`, `docs/api/openapi.json` (regenerated).

**Frontend, new:** `services/connection.ts`, `hooks/useConnection.ts`, `services/localDrafts.ts`, `services/examOutbox.ts`, `components/common/ConnectionBanner.tsx`.

**Frontend, changed:**
- Shared code: `App.tsx`, `services/api.ts`, `services/apiError.ts`, `context/PreparationContext.tsx`, `context/ThemeContext.tsx`, `hooks/usePreferences.ts`, `components/common/PreparationPicker.tsx`, `components/settings/AIProvidersSection.tsx`.
- Pages with the larger changes: `SystemDesignAnswerPage`, `ExamRunnerPage`, `PreparationsPage`, `OnboardingPage`, `settings/SettingsHome`, `settings/AppearanceSettingsPage`, `settings/ShortcutsSettingsPage`, `settings/DataSettingsPage`.
- Pages with error, retry and loading changes only: `AnalyticsPage`, `DesignReviewListPage`, `DesignReviewPage`, `ExamReviewPage`, `ExamSetupPage`, `HomePage`, `HubPages`, `InsightsDomainPage`, `InterviewLibraryPage`, `InterviewPracticeRecordPage`, `InterviewPracticeResultsPage`, `InterviewPracticeSetupPage`, `InterviewSessionPage`, `InterviewSessionReportPage`, `InterviewSessionSetupPage`, `PreparationEditPage`, `QuestionBankPage`, `RecordingsPage`, `ReviewPage`, `RoadmapDetailPage`, `RoadmapListPage`, `RoadmapTopicPage`, `SpacedReviewPage`, `SubjectPage`, `SystemDesignResultsPage`, `SystemDesignSetupPage`, `TopicDemonstratePage`, `TopicGuidePage`.
- Test setup: `test/setup.ts` (in-memory localStorage when the test environment has none).

## API / DB changes

- **`GET /api/v1/system/health`** is new and additive. It returns `{status, version}` without a database read. The OpenAPI snapshot is regenerated.
- **No database changes.** The exam-answer resend depends on the existing `(session_id, question_id)` upsert, which was checked before relying on it.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 672 | **673** (+1: health answers without the database) |
| Frontend unit | 633 | **663** (+30) |
| E2E | 47 | **53** (+6) |

**New unit tests (30):**
- the connection banner (3), and failure messages in words (2)
- System Design copies kept on the device (3)
- preferences not shown before they're read (2)
- Settings not counting unread preparations (1), and Getting started marking unread steps Not checked (1)
- interview library (1), interview practice (2), interview question and recording results Retry (2), AI providers (1)
- the preparations page (4)
- the preparation list re-read when the server returns, and the picker (3)
- mock answers kept, sent, restored, refused and blocking submission (5)

Existing tests were updated where a message changed; the design review failure test now also retries.

**The full browser run:** 52 of 53 passed. The System Design test still expected the old save wording ("Saved at … You can leave and come back."). The page now uses the shared status ("Saved · at 05:57 PM. You can leave and come back"), so the test's expectation was updated. It was rerun with the interview tests after the last code change (Retry on the interview question and recording results screens), and all 3 passed.

**New browser tests (6, `e2e/offline.spec.ts`):**
- a System Design answer kept on the device, then saved when the server is back
- kept edits surviving a closed tab, restored and sent next visit
- a failed screen saying why and loading on Retry
- nine screens opened with the server gone, none of which claim empty, zero or "to do"
- the picker recovering on its own
- mock answers kept, sent without leaving the paper, kept across a reload, and counted on the server

Typecheck clean. Lint 0 errors (the same 16 warnings as before the phase).

## Known limitations

- **Only System Design answers and mock answers are kept on the device.** Shorter work stays in its open form when a save fails, and the error says it wasn't saved, but closing the tab loses it. That covers a design review justification, notes, question edits and study guide edits.
- **Interview recordings aren't kept on the device.** A failed upload keeps the take on the page for Retry; closing the tab loses the audio.
- **Noticing the server is back takes up to five seconds.** Detection comes from failed requests and a health check every five seconds, not from a push.
- **Kept mock answers the server refuses aren't recorded.** This happens when the time limit passes while the server is away (after the existing 30-second grace). The server's clock is authoritative; the runner says how many answers weren't recorded.
- **Loading labels are words, not progress.** No screen estimates how long a read will take.

## Gate decision

**PASS.** Phase 16 is complete. Next: Phase 17, the full certification journey and the release gate.
