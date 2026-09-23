# Phase 14 — Settings, Data, AI, Onboarding: Audit and Impact Report

**Date:** 2026-09-14 · plan §7 (DB) and §8 (API)

## Audit

| Prototype screen | Production before this phase |
|---|---|
| Settings | One long page: theme, timer sound, daily review cap, default target role, AI providers, reset |
| AI providers | Real: providers, local setup wizard, verify, keys. **Task routing existed in the API (`/llm/tasks`) with availability, reasons and timeouts, but no screen showed it** |
| Appearance | Theme light/dark only (the column comment already allowed `system`) |
| Practice | Daily review cap only (real). The prototype's session defaults were removed earlier because nothing read them; SM-2 numbers are engine constants |
| Shortcuts | None, except Space and Esc in interview sessions |
| Notifications | No entity and nothing producing notifications |
| Data & storage | None. The real database is SQLite at `backend/data/exam_simulator.db` (from `settings.DATABASE_PATH`; the E2E backend overrides it). Recordings are files under `backend/data/recordings`. API keys are **not** in the database (keyring, env, or an obfuscated file beside it) |
| About | None |
| Onboarding | None |
| Interface states | None |

**Source of truth (plan §20 "Data"):** the SQLAlchemy engine in use. Screens must report `engine.url`, not the default path, so a backend started against another database reports that one.

## Decisions

- **Every control must do something.** The prototype's session defaults, editable SM-2 numbers, accent colours, density, desktop notifications, daily digest, quiet hours and rebindable keys aren't built as controls. Where the prototype shows an engine fact (SM-2 intervals), it's shown read-only and taken from the engine.
- **Notifications are derived, never stored**, the same way daily goals are. They clear when the condition clears. Each trigger can be turned off. There are no streaks.
- **Onboarding isn't forced** on a fresh install. It's a page built from real state (preparation, questions, first mock, AI), linked from Settings and from Home's empty state.

## DB changes

| Object | Change | Reversible by |
|---|---|---|
| `app_settings.text_size` | **New** `VARCHAR(10) NOT NULL DEFAULT 'standard'` (`standard` / `large`) | code revert (column ignored) |
| `app_settings.reduce_motion` | **New** `VARCHAR(10) NOT NULL DEFAULT 'system'` (`system` / `always`) | code revert |
| `app_settings.shortcuts_enabled` | **New** `BOOLEAN NOT NULL DEFAULT 1` | code revert |
| `app_settings.notification_triggers` | **New** `JSON NULL`: `{trigger: bool}`; a missing trigger is on | code revert |
| `app_settings.theme` | Now also accepts `system`. Existing `light` / `dark` rows are unchanged; any other stored value reads as `light` | code revert |

Additive only, applied by `apply_lightweight_migrations()` (`ALTER TABLE ... ADD COLUMN` when missing, idempotent). The single settings row keeps its values and gets the defaults for new columns.

## API changes (additive)

| Endpoint | Purpose |
|---|---|
| `GET/PUT /settings` | New fields above. PUT now refuses an unknown theme, text size or motion value (422) instead of saving it |
| `GET /system/storage` | The database actually in use (path, size, last modified), row counts, recordings folder, per-preparation counts |
| `GET /system/backup` | A consistent SQLite snapshot as a download (SQLite backup API). API keys aren't in it because they aren't in the database |
| `GET /system/about` | Version, where data lives, telemetry (none), which enabled providers are local or cloud, and which tasks would send data off the machine |
| `GET /system/review-schedule` | The SM-2 constants the engine uses, for a read-only explanation |
| `GET /notifications` | Alerts computed from current evidence, filtered by the trigger settings |

## Validation

Migration test for the new columns on an old `app_settings` table; service tests for storage, backup (a restorable SQLite file), about, notifications (each trigger, off switch, clearing), and settings validation.
