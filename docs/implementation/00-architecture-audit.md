# 00 — Architecture Audit

**Date:** 2026-09-12 · **Branch:** `main` @ `56c8bbb` · **Auditor:** Claude Code
**Purpose:** Gate 0 of the Phase-Gate Implementation Plan. Establishes what exists
before any implementation begins.

---

## 1. Headline

PrepBench is **not a greenfield project**. It is a working, tested, CI-gated
application of roughly 62,000 lines:

| Side | Lines | Files | Tests | Status |
|---|---|---|---|---|
| Backend (Python/FastAPI) | ~27,950 | 91 `.py` | 465 passing | 82% statement coverage |
| Frontend (TypeScript/React) | ~34,400 | 45 test files | 471 passing | no coverage gate |

Both suites were run at audit time and both are green. **This codebase is the
production architecture. The prototype is not.**

The single most important consequence for the implementation plan: most of the
prototype's 59 screens map onto capability that *already exists and is already
tested*. The work is predominantly **surfacing and connecting**, not building.
Treating the prototype as a blank-slate spec would rebuild ~110 working
endpoints and 936 passing tests for no gain.

---

## 2. Stack

### Backend

| Concern | Implementation |
|---|---|
| Framework | FastAPI, entry `backend/app/main.py` |
| ORM | SQLAlchemy (declarative, `Base` in `app/core/database.py`) |
| Database | **SQLite**, single file; WAL journal, `foreign_keys=ON`, `busy_timeout=10000` |
| DB location | `settings.SQLALCHEMY_DATABASE_URI` → `backend/data/exam_simulator.db` |
| Migrations | **No Alembic.** Hand-rolled `apply_lightweight_migrations()` |
| Layering | `api/v1` → `services` → `repositories` → `models` (consistently applied) |
| Validation | Pydantic v2 schemas in `app/schemas` |
| AI | `app/llm` gateway with provider adapters, task-level routing, secret refs |
| File storage | Local filesystem, `backend/data/recordings/`; DB holds metadata only |
| Background jobs | **None.** All work is synchronous request/response |
| Auth | **None.** No user table, no session, no token, no authorization layer |
| Python | 3.14 (venv at `backend/.venv`; CI pins 3.14) |

### Frontend

| Concern | Implementation |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 8, `strictPort: true` on 5173, proxies `/api` → `127.0.0.1:8000` |
| UI kit | MUI 9 (`@mui/material`, `@emotion`) + `lucide-react` icons |
| Routing | `react-router-dom` 7, `BrowserRouter`, routes declared in `App.tsx` |
| Charts | `chart.js` + `react-chartjs-2` |
| HTTP | `axios` instance in `services/api.ts` |
| State | React local state + context (`ThemeContext`, `SidebarContext`). No Redux/Zustand/Query |
| Tests | Vitest + Testing Library + jsdom |

### CI

`.github/workflows/ci.yml` — runs on every push and PR:

- **backend**: `pip install -r requirements.lock` → `pytest -q --cov`
- **frontend**: `npm ci` → `lint` → `typecheck` → `test`

No E2E job, no visual-regression job, no performance job, no coverage threshold.

---

## 3. Layering, verified

The service/repository split is real and consistently observed. Example, the
exam path:

```
POST /api/v1/exams            api/v1/exams.py
  -> ExamEngine.create_exam   services/exam_engine.py   (decides what a mode means)
    -> QuestionRepository     repositories/question_repository.py  (only queries)
      -> Question / Option    models/
```

`question_repository.py` carries an explicit comment recording that the
*decisions* ("which certification tokens are meaningful, what counts as a weak
topic") stay in the service and only the query lives in the repository. The
boundary is deliberate, documented, and should be preserved.

**Reuse consequence:** any new capability belongs in an existing service where
one covers the domain. The plan's Rule 4 is already the house style.

---

## 4. Migration strategy — a hard constraint

There is **no migration framework**. Schema arrives two ways:

1. `Base.metadata.create_all(bind=engine)` at startup (`main.py:20`) — covers a
   fresh database.
2. `apply_lightweight_migrations()` (`main.py:27`) — idempotent `PRAGMA
   table_info` / `ALTER TABLE ADD COLUMN` / `CREATE INDEX` steps for an existing
   database. Seven steps exist today:
   - `app_settings` columns
   - `exam_answers` unique index
   - `practice_recordings.interview_question_id`
   - LLM provider configuration tables
   - `review_checks` table
   - `system_design_drafts` table
   - `recording_analyses` content columns

Failures are **collected rather than raised at the point of failure**, then
`_raise_if_migrations_failed()` refuses to start the app on a partially upgraded
schema. That design is sound and well reasoned in comments.

### What this means for the plan

Plan §7 Step C asks for "a reversible migration where supported" and Step D asks
to run "migration down where supported".

> **Neither is supported here.** There is no down-migration mechanism, and
> SQLite cannot drop or alter a column in place in the general case.
> The repository's strategy is forward-only, additive, idempotent.

The plan's own qualifier — "where supported" — covers this. Recorded as
**RISK-01**; the substitute validation is in
[00-risk-register.md](00-risk-register.md).

**Rule to follow:** every schema change in this programme must be
(a) additive, (b) idempotent, (c) a new numbered step in
`apply_lightweight_migrations()`, (d) covered by a test that runs it twice, and
(e) covered by a test that runs it against a database built by `create_all`.
`backend/tests/test_schema_and_ownership.py` and `test_database_pragmas.py` are
the existing homes for that.

---

## 5. Single-user, local-first — the other hard constraint

There is **no `User` entity anywhere in the schema**, no authentication
middleware, no authorization check, and no ownership column on any table. CORS
is open to the local Vite origin and desktop shells. The app is launched by
`start_app.bat` / `start_app.sh` against a local SQLite file.

This is coherent with the prototype, which presents itself as a local-first
preparation workspace.

### What this means for the plan

Plan §34 (Security Gate) requires:

> A user must not be able to access another user's preparation / questions /
> recordings / transcripts / attempts / evidence / analytics by changing an ID
> in the URL/API.

**That requirement is not satisfiable and not meaningful in the current
architecture, because there is exactly one user and no concept of a second
one.** Implementing it means introducing authentication, a user table, an
ownership column on ~20 tables, and an authorization layer — which plan Rule 3
("no speculative architecture") forbids unless the audit proves necessity.

The audit does **not** prove necessity. Recorded as **RISK-02**; it needs a
product decision, not an implementation.

The security work that *is* both applicable and valuable in a single-user local
app is real and should be done: input validation, file-upload validation
(size/MIME/path), XSS, SQL injection, prompt injection where learner text
reaches an AI provider, and secret handling. Several are already covered — see
[00-test-audit.md](00-test-audit.md).

---

## 6. AI integration

`app/llm/` is a proper gateway, not scattered SDK calls:

- `gateway.py` — `LLMGateway.is_available(task)` / `.run(task, prompt)`
- `profiles.py` — provider profiles
- `adapters/` — per-provider transport
- `secrets.py` — API keys held by reference (`api_key_ref`), not inline
- `types.py` — `LLMTask` enum, so routing is per task
- `local_setup.py` + `system_info.py` — local runner detection, RAM-aware model
  suggestions, launcher-script generation

Task routing is persisted in `llm_task_binding` (task → provider + model), and
providers in `llm_provider_config` with verification state (`last_verified_at`,
`last_verify_error`, `last_latency_ms`).

**The "never fabricate grading" rule of plan §15/§20 is already implemented and
tested.** Every grading surface defaults to an ungraded state and degrades
honestly:

| Surface | Column | Default | On failure |
|---|---|---|---|
| Design review | `design_review_attempts.grading_status` | `not_graded` | `not_graded`, `axis_verdict` stays NULL |
| System design | `system_design_attempts.grading_status` | `unavailable` | error recorded in `grading_error` |
| Recording analysis | `recording_analyses.analysis_status` | `unavailable` | error recorded in `analysis_error` |

`design_review_service.py:144-171` is the reference implementation, with the
reasoning in a docstring: *"inventing 'missed' would blame the learner for a
missing API key."* Any new graded surface must match this pattern.

---

## 7. Existing seed and fixture infrastructure

`app/utils/` holds a deliberate seeding layer:

- `seed_subjects.py`, `seed_data.py`, `seed_design_reviews.py` (1,004 lines),
  `seed_interview_questions.py`, `seed_system_design_prompts.py`
- `seed_ledger.py` + the `seeded_content` table — records what has been seeded
  by `(namespace, content_key)` so re-seeding is idempotent and learner-authored
  content is never clobbered
- `verify_question_bank.py`, `integrity_check_service.py` — compare the bank
  against its source file
- `reconcile_evidence.py` — evidence reconciliation utility

The seed ledger is the mechanism that makes plan §37's rule ("fixtures are
acceptable only for seed data / demo / test / empty-state") enforceable, and it
already exists.

> **Carried from prior context:** the user has imported their own question banks
> beyond the seeded packs. Any operation that rebuilds or clears content must
> respect the seed ledger and must not assume seed-only data.

---

## 8. Import/export, already built

- `import_service.py` (697 lines) — question import
- `roadmap_import_service.py` (708 lines) — roadmap import, CSV/Markdown/JSON
- `interview_question_import_service.py` (172 lines)
- `question_validator.py` (331) + `content_validator.py` (350) — row- and
  field-level validation with structured errors
- `export_service.py` + `utils/pdf_generator.py` + `utils/excel_generator.py`
- Endpoints: `POST /imports/validate` → `POST /imports/confirm` (staged), plus
  `/imports/file`, `/imports/repair`, `/imports/auto-refine-batch`

The prototype's staged `Upload → Parse → Validate → Duplicate detection →
Preview → Audit → Confirm` flow is **the shape already implemented**. Plan §12 is
mostly a wiring exercise, not new machinery.

---

## 9. Where the frontend is the system of record — must change

Two places hold learner state in the browser. Plan §6 forbids browser storage as
the system of record for production data.

### 9.1 `frontend/src/services/learning/attempts.ts` — blocking

```
const STORAGE_KEY = 'prepbench.learning.attempts.v1';
```

Its own header comment is candid about it:

> *"Phase 1 persists to localStorage where the browser allows it, and to an
> in-session fallback where it does not. There is no backend change in this
> phase by decision … but the storage boundary is deliberately thin so a later
> move to the backend touches this file and nothing else."*

This is the **learning/sandbox evidence store** — predictions, commitments,
hints, rubric coverage, transfer. It is the substrate for `mastery.ts`,
`placement.ts`, `recommendations.ts`, `progress.ts` and the whole
`ChartSandboxPage` (932 lines). Mastery and recommendations are *derived on read*
and never stored, which is a good design and makes the backend move cheaper.

Consequence: **Phase 12 (Sandbox) and the learning half of Phase 5 have no
server-side persistence at all today.** This is the single largest true
implementation gap. The author has pre-paid for the migration by isolating the
boundary — the move should touch `attempts.ts` and a new repository, nothing
else.

### 9.2 `frontend/src/pages/SystemDesignAnswerPage.tsx` — acceptable

Uses `localStorage` as a **recovery buffer** alongside the real
`system_design_drafts` table and `PUT /system-design/prompts/{id}/draft`. That is
precisely the "temporary drafts / recovery state" use plan §6 permits. No change
required; confirm on load that the server draft is authoritative.

---

## 10. Prototype-to-production architecture gaps

| # | Gap | Severity | Phase |
|---|---|---|---|
| A-1 | Learning/sandbox evidence is localStorage-only | **Blocking** | 5, 12 |
| A-2 | Preparations (`subjects`) have **no create/update API** — seed-only | **Blocking** | 3 |
| A-3 | Roadmaps have **no `subject_id`** — not preparation-scoped | **Blocking** | 3, 5 |
| A-4 | Questions scope to preparation by **string match**, not FK | High | 3 |
| A-5 | No structured study-guide content entity (`TopicContent`) | High | 5 |
| A-6 | No topic-demonstration / understanding-check entity | High | 5 |
| A-7 | No daily-goal model (derivable — see data-model audit) | Medium | 4 |
| A-8 | No notifications entity | Medium | 14 |
| A-9 | No browser E2E framework at all | High | all |
| A-10 | No visual-regression harness | Medium | 16 |
| A-11 | Nav IA: production has 4 sidebar items, prototype has 13 | **Decision** | 3 |
| A-12 | Home: production *deliberately refuses* a daily goal | **Decision** | 4 |

A-11 and A-12 are not defects. They are documented, deliberate product decisions
that the prototype reverses. They need the user's ruling before Phase 3/4 — see
[00-risk-register.md](00-risk-register.md).

---

## 11. Commands that work

```bash
cd backend && ./.venv/Scripts/python.exe -m pytest -q
```

```bash
cd backend && ./.venv/Scripts/python.exe -m pytest -q --cov --cov-report=term-missing
```

```bash
cd frontend && npm test
```

```bash
cd frontend && npm run typecheck && npm run lint
```

> **Environment note carried forward:** the PATH `python` is a dead 3.7 and the
> `py` launcher's 3.13 entry is stale. Use `backend/.venv/Scripts/python.exe`
> explicitly, as above. Norton intercepts TLS, which breaks plain `pip`/`uv`
> installs — use `uv --system-certs` if dependencies need changing.
