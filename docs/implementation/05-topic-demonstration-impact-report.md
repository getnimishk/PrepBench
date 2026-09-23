# 05 — Topic Demonstration Impact Report

**Format:** plan §7 + §8 · **Date:** 2026-09-13 · written before implementation

## Why

Plan §11: *"Completion must not be a fake Mark complete action. It must be based
on evidence/success criteria."* Today a topic becomes complete two ways, both
through `PATCH /roadmaps/{id}/topics/{tid}`, and neither involves evidence:

1. `status: "completed"`
2. `progress_percentage: 100` (implies completed)

The prototype's own `topic-demonstrate` screen shows the real mechanism: write
your explanation *before* seeing the standard, then grade yourself against the
success criterion — Not yet / Partially / Yes, unprompted — with a spaced recheck.

## Existing structure

`roadmap_topics` already has `learning_objective`, `success_criteria`, `status`,
`progress_percentage`, `started_at`, `completed_at`, `evidence_notes`.
`_reconcile_topic_state` is the single write path for topic state.

Real data: 2 roadmaps, 74 topics, **all not started**, every one with an objective
and a success criterion. Nothing is stranded by the change.

## Change

### New table `topic_demonstrations` — an append-only evidence log

| Column | |
|---|---|
| `id` | PK |
| `topic_id` | FK `roadmap_topics.id` **CASCADE**, indexed — a demonstration of a deleted topic is meaningless |
| `response_text` | TEXT, required, at least 20 characters — one word is not a demonstration |
| `self_grade` | `not_yet` \| `partial` \| `yes` |
| `repetition`, `interval_days`, `ease_factor` | SM-2 state **after** this attempt |
| `next_recheck_at` | when to demonstrate it again |
| `created_at` | |

Each row carries the schedule state *after* it, so the latest row is the current
state and no earlier row is ever edited.

### Rules

- **Only a demonstration can move a topic into completed.** `PATCH` refuses any
  change that would make a not-completed topic completed, by either route. Moving
  a completed topic back, editing notes or titles, and **skipping** (the existing
  "I already know this" escape hatch, which leaves the progress total) stay allowed.
- `yes` → completed, progress 100, completion time stamped.
- `partial` / `not_yet` → in progress. **Progress % is left as it was.** The
  prototype sets 65% and 30%; those are invented numbers, and plan §37 forbids a
  number without a source.
- A failed recheck of a completed topic (`not_yet`) moves it **back** to in
  progress. The evidence now says it cannot be done unprompted.
- Recheck interval uses the same SM-2 formula as `SM2Service`: `not_yet` = failed
  recall, `partial` = hard, `yes` = easy.

### API

| Endpoint | |
|---|---|
| `POST /roadmaps/{id}/topics/{tid}/demonstrations` | **New**, nested under the existing roadmaps router |
| `GET /roadmaps/{id}/topics/{tid}/demonstrations` | **New**, newest first |
| `PATCH /roadmaps/{id}/topics/{tid}` | **Behaviour change:** refuses a transition into completed (400, message says to demonstrate) |

## Test impact

About 8 tests in `test_roadmaps.py` use `PATCH status=completed` as setup for
progress and schedule arithmetic. Their intent is unchanged; their setup moves to
a helper that completes the topic through a passing demonstration.

New tests: the PATCH refusal (both routes), each grade's effect, recheck revert,
minimum response length, cascade on topic delete, schedule advancing.

## Migration / rollback

New table only — `create_all` for fresh installs, `CREATE TABLE IF NOT EXISTS`
step for existing ones. Rollback: revert the code; the table is orphaned. No
existing column changes.
