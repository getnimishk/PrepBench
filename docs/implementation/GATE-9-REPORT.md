# Phase 9 Gate Report — Interview System

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

**Ruling:** interview practice stays **shared across preparations**, as in the prototype. The Interview nav group sits outside any preparation there, and Home's interview goal is flat. No preparation link was added to interview questions or recordings.

---

## Implemented

### Sessions — setup → session → report

- **Set up a session** (`/interview-practice/setup`): round, category, 1 / 3 / 5 questions, and thinking time (the round's own seconds, or none). The question list shown is the server's plan, least-practised first, and it is exactly what the session asks.
- **The session** (`/interview-practice/sessions/:id`, focus mode):
  - numbered question buttons;
  - think → answer → stop;
  - a bar showing the round's target length while you speak;
  - an optional plan note kept with the answer;
  - each answer saved and analysed straight away, with *Retake it* and *Next question*;
  - *End session* asks first.
  - **A reload resumes at the first question without an answer.** While an answer is being recorded nothing else can be clicked, so the take can't be lost. Space starts and stops an answer; Esc ends the session.
- **Session report** (`/interview-practice/sessions/:id/report`): answers and speaking time, content and delivery averages over **analysed answers only**, the weakest rubric category with *Work on it*, and each answer with a link to it. When nothing was analysed it says **Not graded** and why.

### One answer, the full chain

The plan's chain is prompt → record → stop → save → playback → transcript → content → delivery → recommendation → retry → compare. The answer page (`/interview-practice/recordings/:id/results`, also `/recordings/:id`) now has:

- playback;
- **the answer's length against the round's target**, which needs no AI;
- the plan note;
- **Not graded** with *Settings* and **Analyse again** when there's no provider or the analysis failed;
- when graded: **What to work on** (the lowest-graded category, its feedback, and *Retake this question*), content, delivery, transcript;
- **Compare**: every take of that question with date, length, content %, delivery % and status. A take that wasn't graded shows "Not graded", never 0%.

### Also

- **Question library** (`/interview-practice/library`): every question by round, how often each has been answered, *Practise*, edit, delete (asks first; recordings are kept), import. Editing and importing moved here from the practice page.
- **Practice page**: opens on the least-practised question with its target length, and has *Set up a session* and *Question library*.
- **Single takes** use the same answer console as sessions: thinking time, plan note, target bar. **A take whose save failed is kept in memory with "Try saving again"** instead of being lost.
- **Recordings** items link to their detail page.

### Test data kept away from your recordings

Recordings were always written to `backend/data/recordings`, where your own audio lives, and the backend tests had been writing there too. The folder can now be overridden:

- the backend tests use a temp folder;
- the browser tests use `backend/data/e2e_recordings` (wiped each run, gitignored).

Nothing new was written to your recordings folder.

## Files changed

**Backend** — new `models/interview_session.py`, `services/interview_rounds.py`, `services/interview_session_service.py`, `schemas/interview_session.py`, `api/v1/interview_sessions.py` · `models/practice_recording.py`, `core/database.py` (migration), `core/config.py` (`RECORDINGS_DIR`), `api/v1/recordings.py`, `repositories/recording_repository.py`, `services/interview_question_service.py`, `services/recording_analysis_service.py`, `schemas/recording.py`, `schemas/interview_question.py` · `tests/conftest.py`

**Frontend** — new `pages/InterviewSessionSetupPage.tsx`, `InterviewSessionPage.tsx`, `InterviewSessionReportPage.tsx`, `InterviewLibraryPage.tsx`, `components/interview/AnswerConsole.tsx`, `services/interviewText.ts`, `types/interviewSession.ts` · rewritten `InterviewPracticeSetupPage.tsx`, `InterviewPracticeRecordPage.tsx`, `InterviewPracticeResultsPage.tsx` · `RecordingsPage.tsx`, `App.tsx`, `services/api.ts`, types · `playwright.config.ts` (fake microphone, recordings folder)

## API changes (additive)

| Endpoint | Change |
|---|---|
| `GET /interview-sessions/plan`, `POST /interview-sessions`, `GET /interview-sessions/{id}`, `POST …/finish`, `GET …/report` | **new** |
| `POST /recordings` | optional `session_id` (the answer must be one of that session's questions, else 400) and `plan_note` |
| `GET /recordings` | optional `interview_question_id`; each item adds `analysis_status`, `content_percent`, `delivery_percent` |
| `GET /interview-questions` | items add `practice_count` |
| `GET /interview-questions/round-types` | adds target length, thinking seconds, plan prompt, "listening for", rubric categories |

## DB changes

New table `interview_sessions`, plus nullable `practice_recordings.session_id` and `plan_note`. See `09-interview-sessions-impact-report.md`. Additive; older recordings stay standalone takes. Audio stays on disk.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 608 | **620** (+12: least-practised order and plan equals session; thinking time; category and empty-round refusal; an answer must belong to its session; retakes kept; report uses latest takes, analysed-only averages and the weakest category; ungraded report gives a reason and no scores; finish idempotent; library counts and take comparison; round guidance; API; migration adds the table and columns without touching old takes) |
| Frontend unit | 520 | **537** (+17 net: setup shows the plan and starts it; session resumes, saves under the session, shows "Not graded", locks navigation mid-answer, confirms end; report never shows 0 for ungraded; library lists/edits/deletes/imports; record page keeps the plan note, thinking time, keeps a failed save; results page has analyse-again, recommendation, measured length, compare) |
| E2E | 23 | **25** (+2: **a real recorded session** with fake microphone, reload and resume, finish, honest report, answer page, retake, compare; library → practise) |

Typecheck and lint clean (0 errors; 17 existing warnings).

## Failures during the phase

- A patch script stopped partway (an exact-text match failed on a comment). The rest was applied separately and checked by tests.
- A test ran into two "Settings" links (sidebar and notice). Narrowed.
- 4 Chart Sandbox tests failed once with ~2-hour durations while the computer slept. They pass 30/30 on their own and in the full rerun.

## Known limitations

- **No self-marking without a provider.** The prototype lets you mark your own content (Missed / Partly / Covered) and count filler words by hand. Not built. Without a provider, answers show **Not graded** plus the clock measurement.
- **Transcript, content and delivery scores need a provider** that can analyse audio. The browser tests cover the no-provider path; graded analysis is covered by backend tests with a faked provider.
- **Analysis runs when an answer is saved.** Leaving the screen while it runs still saves the result; the page just won't show it until reopened.
- **Interview practice is not per-preparation**, by the ruling above.

## Fixture audit

No placeholder numbers. The prototype's worked example panel ("what a provider would return") is not reproduced. Without a provider the page says Not graded rather than showing example scores.

## Security

Single-user by your decision. Uploads still accept only audio types, with a 100 MB limit. A session answer is refused if it isn't one of that session's questions. Test recordings can't land beside real ones.

## Performance

Question practice counts come from one grouped query. The recordings list includes analysis summaries, so comparing takes costs one request, not one per take.

## Gate decision

**PASS.** Phase 9 is complete. Next: Phase 10, System Design (structured answer fields that really autosave, rubric grading, improvement, retry).
