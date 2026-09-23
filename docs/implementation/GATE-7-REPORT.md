# Phase 7 Gate Report — Practice and Review

**Date:** 2026-09-13 · **Format:** plan §40 · **Gate decision: PASS**

---

## Implemented

### Everything follows the picked preparation

Before this phase, several places still mixed preparations together. Each is now scoped, with a test:

| Where | What leaked before |
|---|---|
| Review queue | Another preparation's mistakes after switching |
| "From memory" count on Review | A global count, offering a drill the engine then refused |
| Memory / spaced drill | Drew due questions from every preparation |
| Weak topics (Home list + weak-topic drill) | Topic names repeat across banks, so one preparation's weakness decided another's drill |
| "Continue" on Home and Practice | Could open another preparation's unfinished session |
| Practice page | Ignored the picker and led with the preparation that had most mocks |
| History on Review | Listed every preparation's sessions |
| Filter choices (Question Bank, Exam setup, Custom) | Offered every bank's domains and topics |

### My Practice — the prototype's five formats

`/practice` now has tabs: **Recommended**, **Weak topic focus**, **Spaced repetition**, **Custom**, **Full mock**. The tab is in the address, so it can be linked and survives a reload.

Every format first asks the server what it would draw (**new `POST /exams/preview`**, the same selection code that starts a session). So before you press Start you see:

- how many questions match and how many will be drawn;
- how they split: *missed before · due for review · never attempted · right every time*;
- or the exact reason the session can't start (e.g. "A PSM I mock is 80 questions and only 12 are available").

**Custom** has Domain, Difficulty and Question count; changing any of them changes the session, and the count updates as you choose.

### Spaced repetition cards — `/practice/spaced`

The prototype's card flow: the question alone → **Show answer** → grade **Again / Hard / Good / Easy**. Each grade button shows when the card would come back, using the server's own SM-2 step. The grade is saved and moves the schedule.

- A card can't be graded twice for one recall (server returns 409).
- A grade that didn't save doesn't advance the deck.
- End of deck: counts per grade, how many come back tomorrow, how many are still due.

Review's "From memory" button opens the same cards.

### Session result

The result page now also shows answered/skipped, missed, **by domain** and **by topic** (worst first), and a "what to do next" line: a mock's misses go to the review queue, a drill's come back on the schedule tomorrow. All counted from the session's own answers.

### Review loop

Miss → explanation → check with a different question → schedule. Already real; now proven in a browser including a reload.

---

## Files changed

**Backend** — `api/v1/review.py`, `home.py`, `exams.py`, `questions.py`, `router.py`, **new** `api/v1/spaced.py` · `services/exam_engine.py` (selection split out, preview, composition), `home_service.py`, `sm2_service.py`, `question_service.py`, **new** `services/spaced_review_service.py` · `repositories/subject_repository.py`, `spaced_repetition_repository.py`, `analytics_repository.py`, `question_repository.py` · `schemas/exam.py`, **new** `schemas/spaced.py` · `docs/api/openapi.json`

**Frontend** — `pages/HubPages.tsx`, `ReviewPage.tsx`, `HomePage.tsx`, `ExamSetupPage.tsx`, `QuestionBankPage.tsx`, `ExamReviewPage.tsx`, `App.tsx`, **new** `pages/SpacedReviewPage.tsx` · **new** `components/practice/PracticeModes.tsx`, `components/exam/SessionBreakdown.tsx` · `services/api.ts`, **new** `services/practiceRequests.ts` · types `exam.ts`, `review.ts`, `subject.ts`, **new** `spaced.ts`

**Tests** — see below.

## API changes

All additive. A call without the new parameters behaves exactly as before.

| Endpoint | Change |
|---|---|
| `GET /review/queue` | optional `subject_id`; response adds `spaced_due` |
| `GET /home/focus-topics` | optional `subject_id` |
| `GET /home/activity` | optional `subject_id` (that preparation's exam sessions only) |
| `GET /home` | `per_subject[].resumable` added |
| `GET /questions/filters` | optional `subject_id` |
| `POST /exams/preview` | **new** — what a session would draw, or why not |
| `GET /spaced/deck`, `POST /spaced/grades` | **new** — card flow |
| `POST /exams` | weak-topic and spaced modes now use the named preparation's lists; refusals name it |

Also fixed: the Review page always asked for 20 items, so a daily review cap above 20 in Settings did nothing. It now lets the server use the cap.

The API contract snapshot was regenerated (99 paths).

## DB changes

None.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 575 | **595** (+20: scoping of queue, memory count, spaced drill, weak topics, Continue, history, filters; preview counts, refusals and composition; card deck order, interval previews, grading, double-grade refusal) |
| Frontend unit | 476 | **508** (+32: Review/Home/Practice follow the picker; five formats; Custom changes the request; card runner hides the answer, grades, won't advance on a failed save; result breakdown) |
| E2E | 15 | **21** (+6: Review switch-and-back walk; Custom filter → run → result → evidence shows up; formats follow the picker; spaced "nothing due" including the card page; mock too big for the bank; review loop with reload) |

Typecheck and lint: clean (0 errors; the 17 existing warnings are unchanged).

## Failures during the phase

- A guard test pinned the review queue's fields to "counts, never deadlines". `spaced_due` is a count, so the list was updated on purpose.
- My own weak-topic test had wrong arithmetic (pooled 3/6 is weak). Fixed the test; it now shows the leak more clearly.
- Two picker tests matched the preparation name twice after it was added to the page header. Tightened.
- On a phone-width screen, long topic names stretched the weak-topic panel off screen. Fixed and checked at 375px.
- Found and removed a duplicate `count_due` in the schedule repository.
- **Not from this phase:** `tests/test_subjects.py::test_seeded_subjects_exist…` fails when that file is run on its own (it depends on app start-up seeding first). It passes in the full suite.

## Known limitations

- **Card grading isn't covered by the browser suite.** Nothing becomes due through the public API without waiting a day, so the browser tests cover the empty deck only. Grading is covered by backend and component tests.
- **The preview describes the matching pool, not the exact questions drawn**, because sessions draw at random.
- **Self-grades aren't logged separately.** The saved schedule is the record, so the end-of-deck summary is gone once you leave the page.
- **Scoped history leaves out interview, system design and design reviews.** Those don't belong to a preparation yet (Phases 9–11).
- **No "ordering" control in Custom.** The prototype's control did nothing, so it wasn't copied.
- **Practice-mode runner:** the last question's explanation isn't shown before Submit. This is existing runner behaviour, for Phase 8.

## Fixture audit

No fixture or placeholder numbers on any new screen. Every count comes from the API. Where the server has nothing to show, the screen says so.

## Security

Single-user, by your decision (auth later). New inputs are validated: an unknown grade → 422, out-of-range deck size → 422, unknown preparation → 404. The preview is read-only, and a grade can't be applied twice.

## Performance

The preview's composition query runs in chunks of 900 question IDs, so a large bank stays within SQLite's limits. On your own 709-question PSM I bank it responded instantly in the browser. Custom waits 250 ms after typing before asking again.

## Gate decision

**PASS.** Phase 7 is complete. Next: Phase 8, the certification mock exam (flag, navigate, reload, resume, submit, result, review, readiness update, in a browser).
