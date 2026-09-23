# Phase 4 Gate Report — Home and Daily Goals

**Date:** 2026-09-13 · **Format:** plan §40 · **Gate decision: PASS**

---

## Implemented

Home now leads with the two standing daily goals from the prototype, as decided.

**Certification practice** (for the picked preparation) shows: target, completed,
remaining, reviews due, how many are queued beyond today, weakest area, and the
state — Not started / In progress / Done / Nothing due. Buttons: Start or
Continue review, Practise {weakest area}, Mock exam.

**Interview practice** (not tied to a preparation) shows: today's target of 1,
answers recorded today, latest content and delivery scores, and the round you've
practised longest ago. Buttons: Practise a round, System design, Recordings.

**Settings** gained a "Daily review cap" field.

## How the numbers are made

Nothing is stored. Every number is recalculated from the data that caused it, on
each visit, so a goal can't drift from reality.

| Number | Source |
|---|---|
| Due | Unreviewed mistakes from finished mocks, for this preparation |
| Done today | Mistakes marked reviewed since **local** midnight |
| Target | `min(cap, due + done today)` — follows what's due, never a quota |
| Queued beyond today | What the cap left for tomorrow |
| Weakest area | The readiness rules' own weakest domain, or nothing |
| Recorded today | Interview recordings since local midnight |
| Content / delivery | Latest **successfully** analysed answer, or "not analysed yet" |
| Longest-since round | The round practised longest ago, or one never practised |

Three deliberate wording choices:
- A day with nothing due says *"That is the system working, not a missed day."*
- Scores never show 0% when nothing was analysed — that would blame you for a missing AI key.
- The round is described as *"the round you practised longest ago"*, not as a recommendation, because nothing models which round has gone stale.

## Bugs found and fixed

1. **Home contradicted itself.** "Other preparation" said *"Interview: 1 analysed
   answer"* while the new goal said nothing had been analysed. The goal was right:
   your only analysis had **failed**, and the old count included failures. Its own
   comment said it should count only analysed answers; the query didn't filter.
   Fixed to match the System Design line beside it. Found by looking at the new
   panel on real data. Covered by two tests.

2. **Your real cap was 40 instead of 20.** For a few minutes in Phase 2 the
   default was 40, and because the test suite was writing to your real database
   at the time, that value landed there before I withdrew it. You never set it.
   Corrected to 20 with a guarded update that only touched that exact value.

## Decisions recorded

- **Default cap is 20, not the prototype's 40.** 20 is what the review queue was
  already built around, with a stated reason: twenty mistakes read properly is a
  real evening, and past that people start clicking instead of reading.
- **Home's header comment updated.** It listed "a daily goal" among things Home
  refuses. That changed by decision, and the comment now says what changed and why.

## API changes

| Endpoint | Change |
|---|---|
| `GET /home/daily-goals?subject_id=` | **New.** A sub-route of `/home`, like its existing `/home/focus-topics`. Certification goal is null without a preparation |
| `GET /settings`, `PUT /settings` | Gain `review_daily_cap` (1–200) |
| `GET /review/queue` | `limit` now optional. Route refuses above 200; handler clamps to your cap. A caller can ask for fewer, never more |

API contract regenerated deliberately; the contract test caught both changes first.

## DB changes

One additive column: `app_settings.review_daily_cap INTEGER NOT NULL DEFAULT 20`.
Tested for upgrade, idempotency and default.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 522 | **539** (+13 goal arithmetic, +2 consistency, +1 queue clamp, +1 migration) |
| Frontend unit | 471 | **475** (+4 Home goal tests) |
| E2E | 8 | **10** (+2 daily goals, asserting server numbers against the screen) |
| Typecheck / lint | clean / 0 errors | clean / 0 errors |

Three existing guard tests were updated on purpose, not worked around: the exact
`app_settings` column list, the exact settings API fields, and the review queue's
bound — which now checks both halves (route ceiling **and** clamp to your cap).

## Known limitations

- **The interview target is fixed at 1 per day.** The prototype does the same and says so.
- **Signals use only the latest analysed answer**, not a trend.
- **No streak, no history of past days** — by design.

## Gate decision

**PASS.** Both goals render on real data, every number traces to its source, and
the goal is proven preparation-scoped in a browser.

**Next: Phase 5 — Learn, Roadmaps and topic learning.**
