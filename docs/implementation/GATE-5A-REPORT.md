# Phase 5a Gate Report — Topics and Demonstrations

**Date:** 2026-09-13 · **Format:** plan §40 · **Gate decision: PASS**
**Preceded by:** [05-topic-demonstration-impact-report.md](05-topic-demonstration-impact-report.md)

Phase 5 is split. 5a is the topic learning loop, which the prototype fully
specifies and your data already supports. 5b is the study guide — see the end.

---

## Implemented

**Topic page** — `/roadmaps/:roadmapId/topics/:topicId`
Learning objective, success criterion, status, progress, evidence notes, the
demonstration history with next recheck date, previous/next across the whole
syllabus, and the other topics in the same phase.

**Demonstrate page** — `/roadmaps/:roadmapId/topics/:topicId/demonstrate`
The order is enforced, not suggested:
1. Write your explanation — the "reveal" button stays disabled until you've written at least a sentence.
2. Reveal the standard — your answer locks, so it can't be edited after reading the model answer.
3. Grade yourself: **Not yet** / **Partially** / **Yes, unprompted**.

**Syllabus table** — topic titles now open the topic page.

**Reference tables** — already existed as a tab on the roadmap page; no change needed.

## The rule that changed

**A topic can only be completed by demonstrating it.** Plan §11 forbids a "mark
complete" action. Both old routes are now refused by the server, not just hidden:
setting status to completed, and setting progress to 100%.

Still allowed on purpose: moving a topic back, editing notes, and **Skipped** —
for material you already know. Skipping takes a topic out of the progress total
without claiming you demonstrated it.

In the table's status menu, "Completed" is still listed but disabled, with the
reason: *"demonstrate the topic to complete it."*

## What each grade does

| Grade | Topic becomes | Recheck |
|---|---|---|
| Yes, unprompted | Completed, 100% | Spaced further out each time: 1 day, 6 days, then longer |
| Partially | In progress | Hard pass |
| Not yet | In progress — **even if it was completed** | Tomorrow; the ladder resets |

Every attempt is kept with the exact text you wrote. The history can't be edited.

## Deviations from the prototype

- **No 65% / 30% progress numbers.** The prototype sets these on Partial / Not yet.
  Nothing measures them, so a partial grade leaves your own progress figure alone.
  Plan §37 forbids a number without a source.
- **No "Completed" status button** on the topic page, per plan §11.

## Also done

- **One scheduling formula.** The spaced-repetition maths was pulled out of the
  question-review code into one function both use, so a topic and a question graded
  the same way always come back on the same day. The 51 existing scheduling tests
  confirmed nothing changed.

## API / DB changes

| | |
|---|---|
| `POST /roadmaps/{id}/topics/{tid}/demonstrations` | **New** |
| `GET /roadmaps/{id}/topics/{tid}/demonstrations` | **New**, newest first |
| `PATCH /roadmaps/{id}/topics/{tid}` | **Now refuses** a change into completed (400) |
| `topic_demonstrations` table | **New**, deleted along with its topic |

API contract regenerated deliberately.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 539 | **554** (+15 demonstration rules) |
| Frontend unit | 475 | **476** (+1: Completed can't be picked) |
| E2E | 10 | **12** (+2: full journey checked against the database; menu + API both refuse the shortcut) |

**7 existing roadmap tests updated.** Six used "set to completed" as setup and now
complete topics through a real demonstration. The seventh was worse: its setup was
now refused, so it would have kept **passing while testing a topic that was never
completed**. Caught and fixed.

## Known limitations

- **No roadmap editor screen yet** (rename / reorder / add / remove phases). The API supports all of it; the roadmap page only edits the schedule.
- **Rechecks aren't surfaced anywhere else.** A due recheck shows on the topic page, but not on Home or in the review queue.
- **Grading is self-assessment.** Honest by design — your written answer is stored beside the grade — but not independently verified. AI grading could be added later with the existing "not graded" fallback.
- **Learn home and topic pages aren't linked to preparations yet** beyond the roadmap grouping from Phase 3.

## Phase 5b — study guide — needs a content decision

The prototype's study guide is entirely placeholder: five hardcoded section titles,
the same paragraph under every section, a made-up "2 of 5 complete", and a
"Mark complete" button that only shows a message. None of it can be kept.

Real guide content has to come from somewhere, and nothing supplies it today.
Options:
1. **You write it** — sections per topic, stored and editable.
2. **AI drafts it** from the topic's objective, stored and editable, with an honest "not generated" when no AI is configured.
3. **Both** — one data model: AI drafts, you edit.

## Gate decision

**PASS.** Completion is earned against the success criterion, every attempt is
stored as evidence, and the whole journey is proven in a browser against the database.
