# Phase 12 — Chart Sandbox Evidence: DB Impact Report

**Date:** 2026-09-14 · plan §7 (audit → impact → migration → validation)

## Audit

- `learning_attempts` was added in Phase 2 with the rules the sandbox depends on: a prediction is write-once, and an attempt cannot be completed without one.
- **The client never used it.** Attempts were still written to `localStorage` (`prepbench.learning.attempts.v1`), so they lived in one browser profile and vanished with cleared site data.
- The user's real database has the table with **0 rows** (checked read-only).
- **Bug found:** the client names a scenario by every parameter (`key=value|…`, about 480 characters). The API accepted at most 200, so every real attempt would have been refused with 422. It was never noticed because nothing called the API.
- Nothing stored *what was changed*, *what the model showed*, or *the learner's own explanation*.

## Change

| Object | Change | Reversible by |
|---|---|---|
| `learning_attempts.manipulation` | **New nullable column** (JSON): `{param: {from, to}}` | code revert (column ignored) |
| `learning_attempts.observed` | **New nullable column** (JSON): `{outcome: {label, before, after, unit, precision, percent?}}` | code revert |
| `learning_attempts.explanation_text` | **New nullable column** (TEXT, ≤ 4000 chars via API) | code revert |
| `learning_attempts.scenario_fingerprint` | Declared length 200 → 1000 (model, API, fresh-table DDL) | code revert |

Additive only. SQLite does not enforce `VARCHAR` lengths, so widening needs no rewrite of existing rows.

## Rules the server enforces

- `manipulation` and `observed` can only be recorded **after** a prediction is committed, and once. The same value again is a retry (accepted); a different value is refused (400).
- `explanation_text` needs a committed prediction and can be reworded.
- `committed_at` / `completed_at` may be supplied (for history moved from the browser), but never in the future (a client up to 2 minutes ahead is taken as "now") and never before the attempt started.
- The **same** prediction arriving twice is a retry, not an amendment (200, first commit time kept). A **different** one is still refused (400).
- A start time with a UTC offset is stored as UTC.

## Existing data

No rows in the real database. Any attempt recorded before this change keeps `NULL` in the new columns, which is the truth: nothing about its experiment was stored.

**Browser history** is moved once: on opening the sandbox, each attempt in `localStorage` is sent with its own id and times. Those that land are removed from the browser; any that fail stay there and are tried again next time. Posting is idempotent on the id, so nothing is counted twice.

## Migration

`apply_lightweight_migrations()`: `ALTER TABLE learning_attempts ADD COLUMN` for each missing column. Forward-only, idempotent, runs on every start.

## Validation

- `tests/test_phase2_migrations.py::test_the_migration_adds_the_experiment_columns_to_learning_attempts` — an old table gains the columns, and running twice changes nothing.
- `tests/test_learning_attempts.py` — the rules above, including a real 480-character fingerprint.
