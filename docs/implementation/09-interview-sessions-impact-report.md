# Phase 9 — Interview Sessions: DB Impact Report

**Date:** 2026-09-13 · plan §7 (audit → impact → migration → validation)

## Audit

- `practice_recordings` holds one row per recorded answer (file on disk under `backend/data/recordings/`, metadata in the table). No grouping of answers into a sitting exists.
- `recording_analyses` is one row per recording (upsert), status `analyzed` / `unavailable` / `error`.
- `interview_questions` is shared across preparations. **Ruling:** interview practice stays shared, as in the prototype, where the Interview nav group sits outside any preparation and Home's interview goal is flat. No `subject_id` is added.

## Change

| Object | Change | Reversible by |
|---|---|---|
| `interview_sessions` | **New table**: `id`, `round_type`, `category`, `question_ids` (JSON, ordered), `thinking_seconds`, `created_at`, `ended_at` | code revert (table unused) |
| `practice_recordings.session_id` | **New nullable column**, FK → `interview_sessions.id` `ON DELETE SET NULL`, indexed | code revert (column ignored) |
| `practice_recordings.plan_note` | **New nullable column** (TEXT) | code revert |

Additive only. Recordings are not moved or rewritten; audio stays on disk. Binary data is not put in the database.

## Existing data

Every recording made before this change gets `session_id = NULL` and `plan_note = NULL`, so it stays a standalone take, which is what it was. Home's interview goal and the recordings list read the same rows as before.

## Migration

`apply_lightweight_migrations()`: `CREATE TABLE IF NOT EXISTS interview_sessions`, then `ALTER TABLE practice_recordings ADD COLUMN` for each missing column, then `CREATE INDEX IF NOT EXISTS`. Forward-only, idempotent, runs on every start.

## Validation

`tests/test_phase2_migrations.py` builds a pre-Phase-9 `practice_recordings` table with a row in it, then checks:

- the columns are added;
- the old row keeps `NULL`s;
- running the migration twice changes nothing;
- an upgraded database has the same columns as a fresh one.
