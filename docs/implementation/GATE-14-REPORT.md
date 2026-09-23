# Phase 14 Gate Report — Settings, Data, AI, Onboarding

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

---

## Audit first

See `14-settings-impact-report.md`. In short: Settings was one long page. AI providers were real, but **task routing** (who answers each task, availability, timeouts) existed only in the API. There were no Appearance, Practice, Shortcuts, Notifications, Data, About, Onboarding or States screens. The real data store is the SQLite file the server's database connection points at (`backend/data/exam_simulator.db` by default); API keys are not in it.

## Implemented

Every screen the plan lists, each doing something real:

| Screen | Route | What is real |
|---|---|---|
| Settings | `/settings` | Each row shows the current value read from where it's stored, or says it couldn't be read |
| AI providers | `/settings/ai` | Existing providers and local setup, plus **task routing**: who answers each task now, the time allowed (local or cloud), a per-task provider choice (Automatic = the gateway's own fallback order), and what each feature does with no provider (*saved as Not graded*, *generation unavailable*, …) |
| Appearance | `/settings/appearance` | Theme light / dark / **system** (follows the OS as it changes), text size standard / large, reduce motion follow-system / always. Applied at once, saved, put back if the save fails |
| Practice | `/settings/practice` | Daily review cap, timer sound, default target role. The SM-2 schedule is explained read-only, from the engine's constants |
| Shortcuts | `/settings/shortcuts` | **New shortcuts:** exam (1–9 choose, ← →, F flag; → never submits) and spaced review (Space shows, 1–4 grade), plus the existing interview Space/Esc. On/off switch. The reference and the key handlers read the same definitions |
| Notifications | `/settings/notifications`, `/notifications`, header bell | **Derived from evidence, never stored:** misses to review and reviews due, latest mock below pass, readiness out of date, roadmap finishing after the exam date, recent imports unreviewed (off by default). Each trigger can be switched off. They clear themselves when done. No streaks |
| Data & storage | `/settings/data` | The actual database file (path, size, recent writes, last written), row counts, per preparation, recordings folder, what's in browser storage, **Download backup** (a consistent SQLite snapshot), reset (moved here) |
| About & privacy | `/settings/about` | Version, platform, telemetry (none), and **what leaves this machine**, read from the enabled cloud providers and the tasks routed to them; how keys are held; licence; trademarks |
| Getting started | `/onboarding` | A checklist ticked by real state (preparation picked, questions, first mock, optional AI). Not forced on anyone |
| Interface states | `/settings/states` | New shared `LoadingState`, `EmptyState`, `ErrorState` (says whether work was saved) and `SaveStatus` (five states, each with words and an icon), shown with real product situations. Phase 16 adopts them |

### Bugs found and fixed

- **PUT /settings reset everything it wasn't sent.** The theme toggle sent a copy of the settings it had loaded; any field that copy didn't have went back to its default. Settings now change only what's sent, and triggers merge.
- **Unknown settings values were saved** (e.g. a theme no screen can show). Now refused with 422; an odd stored value reads as the default.
- **Race creating the settings row.** On a fresh install several screens read settings at once, and one request could fail with a 500 (seen in the browser-test log). The losing request now reads the winner's row.
- **Two AI tasks had no label** (showed raw keys); every task now has a label and a no-provider description.
- **"Not graded" links went to the general Settings page**; they now open AI providers.

## Files changed

**Backend** — `models/settings.py`, `core/database.py` (migration), `schemas/settings.py`, `services/settings_service.py`, `api/v1/settings.py`, `repositories/settings_repository.py`, `services/sm2_service.py` (named constants), `services/llm_config_service.py` + `schemas/llm_config.py` (labels, fallbacks); new: `api/v1/system.py`, `services/system_service.py`, `schemas/system.py`, `api/v1/notifications.py`, `services/notification_service.py`, `schemas/notifications.py`; `api/v1/router.py`

**Frontend** — new: `pages/settings/*` (9 screens), `pages/NotificationsPage.tsx`, `pages/OnboardingPage.tsx`, `components/settings/SettingsSubpage.tsx`, `components/settings/TaskRoutingSection.tsx`, `components/common/NotificationBell.tsx`, `components/common/States.tsx`, `services/shortcuts.ts`, `hooks/useShortcuts.ts`, `hooks/usePreferences.ts`, `services/format.ts`, `types/system.ts`; changed: `context/ThemeContext.tsx`, `types/settings.ts`, `types/llm.ts`, `services/api.ts`, `App.tsx`, `components/common/Navbar.tsx`, `pages/ExamRunnerPage.tsx`, `pages/SpacedReviewPage.tsx`, `components/interview/AnswerConsole.tsx`, `pages/InterviewSessionPage.tsx`, four "Not graded" links; removed: `pages/SettingsPage.tsx` (split into the screens above)

**Docs** — `14-settings-impact-report.md`, `docs/api/openapi.json` (113 paths)

## API changes (additive)

`GET/PUT /settings` (new fields; PUT changes only what is sent and refuses unknown values) · `GET /system/storage` · `GET /system/backup` · `GET /system/about` · `GET /system/review-schedule` · `GET /notifications` · `GET /llm/tasks` gains `fallback`.

## DB changes

Four columns on `app_settings` (`text_size`, `reduce_motion`, `shortcuts_enabled`, `notification_triggers`); `theme` accepts `system`. See the impact report.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 652 | **672** (+20: settings change only what is sent, refuse unknown values, defaults and merged triggers, legacy theme; storage reports the database in use; a backup is a real SQLite file with the data; About names tasks leaving the machine and key storage; review schedule from the engine; each notification trigger raises from real evidence and clears; switched-off and archived raise nothing; migration adds the columns and keeps the row; every AI task labelled with a fallback; settings-row insert race) |
| Frontend unit | 605 | **633** (+28 across the new screens, task routing, bell, notifications, onboarding, the shortcut hook, exam and spaced-review shortcuts; the old Settings page tests were replaced by per-screen tests) |
| E2E | 31 | **35** (+4: the storage screen names the browser tests' own database and a real SQLite backup downloads; a dark theme is applied at once and kept after reload; with no provider, routing shows the honest fallback; real mock misses raise a notification that switching the trigger off removes) |

Typecheck clean. Lint 0 errors (16 existing warnings, one fewer than before).

## Known limitations

- **No desktop notifications, digest or quiet hours.** Nothing runs in the background to send them, so they aren't offered.
- **No rebinding keys and no global search shortcut.** The reference lists only the shortcuts that exist.
- **No Profile screen.** There is no user account (single-user decision); the plan's Phase 14 list doesn't include it.
- **Backups are manual.** A scheduled backup would need a background job.
- **Recordings aren't in the backup.** They're files in the recordings folder, which the Data screen names.

## Gate decision

**PASS.** Phase 14 is complete. Next: Phase 15, accessibility and responsive QA.
