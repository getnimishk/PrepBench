# Phase 8 Gate Report — Certification Mock Exam

**Date:** 2026-09-13 · **Format:** plan §40 · **Gate decision: PASS**

---

## Implemented

### Exam Setup (`/exam-setup`, the "Mock Exam" nav item)

Rebuilt to the prototype. Everything on it comes from the server:

- **Exam profile** — questions, time limit, pass mark and **how many correct to pass**, all taken from the preparation. Not editable here; there's a link to edit the profile if the real exam changed.
- **Readiness check** — question bank (available vs needed), roadmap topics complete, review debt (unread misses and cards due), last mock (when, and the score). Nothing blocks you from starting.
- **Question source** — the one real choice: *Whole bank*, *Exclude recently seen* (last 7 days) or *Unseen only*, each with its real count, or the reason it can't fill a paper.
- **Domain weighting** — how many questions each domain contributes. The prototype says "mirrors the blueprint", but PrepBench has no official blueprints, so the mock takes each domain **in proportion to the bank**, and the page says so.
- **Exam conditions** — timer on, flags on, no pause, explanations only after submitting. These are shown as facts, not as switches; the prototype's switches only showed a message.
- **Previous mocks** — date, score, pass / not yet (against the preparation's pass mark), time used, and a link to each.
- **An unfinished mock** shows a banner: *Resume* or *Discard*. Starting a new mock asks before discarding the open one.

The page follows the preparation picked in the header. The old Subject menu, which could disagree with the header, is gone.

### The mock itself

| Plan item | Now |
|---|---|
| Question set | Each domain gets its share of the bank (was: random) |
| Timer | Counts from the start time; **the server now refuses answers after the limit** (30 s grace), and the page then submits the paper |
| Answer state / autosave | A picked answer saves itself within half a second (was: only when you moved to another question) |
| Flagging, palette, navigation | Unchanged, now tested after a reload |
| Resume | **Reload returns you to the question you were on** (was: question 1), with answers and flags |
| Submit | Confirmation names unanswered and flagged questions |
| Scoring, pass/fail | Against the preparation's pass mark |
| Exam review | Adds time used and flags to the result |
| Readiness | Updates on submit; the result page shows "Where this leaves you" |

### Also fixed

- **Home's "time left" on an unfinished mock** was based on time recorded at submit, so a paper open for an hour still showed its full time. It now uses the clock, like the runner.
- **Home's "Practise Daily Scrum" topic links** dropped the topic and opened a generic drill. They now drill that topic.

## Files changed

**Backend** — `services/exam_engine.py` (domain-proportional draw, question source, server-side time limit, resume position, discard), `services/home_service.py` (time left), `repositories/exam_repository.py`, `subject_repository.py` · `api/v1/exams.py` (DELETE), `subjects.py` (mocks history) · `schemas/exam.py`

**Frontend** — `pages/ExamSetupPage.tsx` (rewritten), **new** `components/exam/MockExamSetup.tsx`, `pages/ExamRunnerPage.tsx`, `components/exam/SessionBreakdown.tsx`, `components/exam/ExamTimer.tsx`, **new** `services/examClock.ts`, `services/api.ts`, `types/exam.ts`

## API changes

All additive; existing calls behave as before, except the time limit rule below.

| Endpoint | Change |
|---|---|
| `POST /exams`, `POST /exams/preview` | optional `question_source` (`all` default); a mock's questions are drawn per domain; preview adds `domain_plan` |
| `POST /exams/{id}/answer` | optional `current_question_index`; **refused after a timed session's limit + 30 s** |
| `DELETE /exams/{id}` | **new** — discard an unfinished session; 409 for a submitted one |
| `GET /subjects/{id}/mocks` | **new** — mock history |
| `GET /home` | `resumable.seconds_remaining` now by the clock |

## DB changes

None. `current_question_index` already existed on sessions but was never written.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 595 | **608** (+13: domain shares add up and match the preview; unseen / not-recent sources; nothing-unseen refusal; answer refused after the limit, allowed in the grace, never for untimed; position kept; discard vs submitted; history judged by the preparation's pass mark; API) |
| Frontend unit | 508 | **520** (+12: setup page states profile, counts, weighting, history; source choice reaches the request; open mock asks before discarding; skill has no mock; picker wins over the address; topic link drills the topic; runner resumes position, autosaves, sends position, submits when time is up, names flags; result shows time and flags) |
| E2E | 21 | **23** (+2: the plan's full walk — start, answer, flag, navigate, **reload, resume**, submit, result, review, readiness; discard an open mock) |

Typecheck and lint clean (0 errors; 17 existing warnings).

## Failures during the phase

- One Home test checked a fetch the instant the heading appeared and failed once under full-suite load. It now waits for it.
- The known ordering-dependent `test_subjects.py` test failed again when a subset was run with `-x`. Not from this phase; it passes in the full suite.

## Known limitations

- **No official blueprints.** Domain weighting follows the bank. If your bank over-represents a domain, so will the mock; the page says this.
- **"Unseen" means not answered in a submitted session.** Questions only seen in an unfinished or discarded session still count as unseen.
- **Discard is permanent.** It asks first, and only applies to unfinished sessions, which aren't evidence.
- **The 30 s grace** is for a save sent as the clock hit zero. It isn't extra time, and the page submits at zero anyway.
- **Score report stays on the review page** rather than a separate route. Everything the prototype's score report shows is on that one page.

## Fixture audit

No placeholder numbers. The prototype's hard-coded readiness rows, blueprint table and mock history are replaced by live data or an honest "none yet".

## Security

Single-user by your decision. The time limit moved from the browser to the server, so a timed mock can't be answered after its time by editing requests. Discard refuses submitted sessions.

## Performance

The setup page asks for three previews in parallel (one per question source), each chunked for large banks. On your 709-question PSM I bank the page loaded promptly.

## Gate decision

**PASS.** Phase 8 is complete. Next: Phase 9, the interview system.
