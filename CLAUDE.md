# CLAUDE.md — PrepBench

Local-first exam, interview, and system-design prep app. React 19 + TypeScript frontend,
FastAPI + SQLAlchemy + SQLite backend. No account, no telemetry; a network call happens
only if the user configures a cloud AI provider.

## Status

The UI has been rebuilt to match `PrepBench_Unified_Prototype.html` (kept outside the
repo — ask the user for it if you need it) across every screen, verified by rendering the
prototype and the app side by side, not by a registry field or a past claim. A full
accessibility pass (axe, light and dark) and a full 390px layout pass have been run across
every screen and are clean. This work is merged into `main` (PRs #25, #26, #27).

**Settled decisions, don't reopen these:**
- The header Settings button stays, even though it isn't in the prototype — kept for
  quick access, at the user's request.
- Profile's roadmap-hours figure is labelled "planned hours completed" (it sums the
  roadmap's *estimated* hours for completed topics, not time actually spent).
- Chart text (SVG labels on Home's score chart) scales with the Large-text setting via
  `textScale = theme.typography.fontSize / 14`. Apply the same pattern to any new SVG
  text.

**Known, understood, not a bug**: `frontend/e2e/navigation.spec.ts`'s per-route heading
check waits 15s (not the 5s default) because this crawl visits every screen exactly once,
so Vite compiling a route on its first visit is the common case here. If it's still
flaking after this, don't just raise the timeout further — check whether something else
(a leftover process from a prior run holding the test database file, e.g.) is genuinely
slowing things down first; that was the actual cause the one time this looked like it had
regressed.

## Tech stack

**Frontend** (`frontend/`): React 19, TypeScript 5.9, MUI v9, react-router-dom 7, Vite 8,
Vitest 4, Playwright 1.63, axe-core (accessibility), lucide-react (icons).

**Backend** (`backend/`): Python 3.14, FastAPI 0.141, SQLAlchemy 2.0, Pydantic 2.13,
pydantic-settings, uvicorn, pytest 9.1. SQLite, no Alembic — migrations are idempotent
`ALTER TABLE` steps in `app/core/database.py`, each wrapped so one failing step can't
crash startup.

**Environment**: `backend/.venv/Scripts/python.exe` for all Python — never a bare `python`
or `pip`. Node 22+. Git Bash / PowerShell on Windows.

## Design system — use it, don't restyle by hand

- **Tokens**: `frontend/src/theme/tokens.ts` — light/dark colour tokens. In `sx`, use
  `'pb.accent'`, `'pb.successSoft'`, `'pb.warning'`, `'pb.dangerSoft'`, etc. Outside `sx`,
  use `usePb()` from `theme/usePb.ts`. **Never hard-code a hex colour** — it breaks dark
  mode, and this has caused real review findings in this repo more than once.
- **Primitives**: `frontend/src/components/ui/primitives.tsx` — `PageHead`, `Panel`
  (`soft` variant), `PanelHead`, `Eyebrow`, `Pill` (tone), `MetricRow`/`Metric`,
  `BigFigure`, `Bar`, `Note`, `Good`, `Sub`, `Detail`, `Row`, `Grid`, `Section`, `Actions`.
  Build screens from these, not ad hoc `Paper`/`Card`/`Typography`.
- **Buttons**: `variant="contained" color="ink"` = the prototype's black primary button,
  one per page. `variant="contained"` = its blue button. `variant="outlined"` = normal.
  Sentence case labels.
- **Forms**: the theme already puts the label above each field (no floating labels,
  `notched: false`). Don't override this per-field.
- **Font sizes**: always `(t) => t.typography.pxToRem(px)` in `sx`, never a literal
  `'14px'`/`'0.875rem'`/a bare number, and the same for any SVG `fontSize`. A hard-coded
  size breaks the Large-text accessibility setting; `theme/fontSizes.test.ts` guards the
  `sx` case but not SVG attributes, so check those by eye.
- **Breakpoints**: phone is `NARROW_QUERY` (`@media (max-width:768px)`) from `tokens.ts`.
  Check every new screen at 390px and in dark mode before calling it done — see
  `full_pass.cjs`-style tooling under "Verifying a change" below.
- **Empty table headers**: a header cell with nothing visible in it (an icon-only actions
  column, for instance) needs visually-hidden text inside it, not just an `aria-label` on
  the empty cell — axe's `empty-table-header` flags the latter. See the pattern in
  `QuestionTable.tsx` / `RoadmapTableView.tsx` (`VISUALLY_HIDDEN` constant).
- **Custom radio/checkbox styling**: cover the real input with
  `{ position: 'absolute', inset: 0, opacity: 0 }`, not `clip:` — the latter can't be
  clicked by Playwright's `.check()`.
- **Explanations** (question/interview text with Markdown): render with
  `components/common/Explanation.tsx`, never `dangerouslySetInnerHTML` or raw text.
- **Focus-mode screens** (`FocusLayout` in `App.tsx`, e.g. the exam runner, the interview
  studio, the system design answer page) deliberately have no sidebar — that's by design,
  not a layout bug, so a check that expects a nav landmark everywhere needs to exclude
  these routes explicitly.

## Hard rules — never violate these

1. **Never touch the learner's real data**: `backend/data/exam_simulator.db` (+ `-wal`/
   `-shm`), `backend/data/recordings/`, `backend/data/.llm_secrets.json`,
   `backend/data/.llm_secret_key`. Tests redirect to their own throwaway files —
   `backend/tests/conftest.py` does this before any `app.*` import, and
   `tests/test_real_database_isolation.py` pins the guarantee with a fingerprint check.
   That fingerprint check can false-positive on Windows if the real database's `-shm` file
   mtime drifts with no process touching it (a filesystem-cache quirk, seen and confirmed
   in this repo) — if you hit that, verify no process is actually writing before assuming
   a leak. On a fresh CI checkout the file doesn't exist, so this never fires there.
2. **Never fabricate a result.** No AI provider configured → the app shows "Not Graded"
   and says why, never a fake score or a silent `0%`. This applies to every AI-backed
   feature (system design grading, design review grading, recording analysis, question
   generation, the Ollama catalogue sync) and to sample/demo data — never invent example
   content, screenshots, or figures that look like the user's own.
3. **No frontend edits while Playwright is running.** Vite hot-reloads mid-run and fails
   tests for reasons that have nothing to do with the code.
4. **Don't import `app.main` outside pytest.** The one exception is
   `backend/scripts/export_openapi.py`, run with `SQLALCHEMY_DATABASE_URI`,
   `PREPBENCH_RECORDINGS_DIR`, and `PREPBENCH_SECRETS_DIR` redirected to a throwaway
   location first.
5. **Don't commit unless asked.** When committing or opening a PR, end the message with
   the attribution lines the harness gives you for that session — check the current
   system reminder for the exact model name, since it changes.
6. **Don't push directly to `main`.** Branch, push the branch, open a PR.
7. **Docs go through PRs like code.** `docs/wiki/*.md` is the source of truth for the
   GitHub wiki; `scripts/sync-wiki.sh` mirrors it. Sync only after the PR containing the
   doc change has merged to `main` — running it against unmerged content puts unreviewed
   text on the live wiki.
8. **A GitHub token without `workflow` scope can't push changes to
   `.github/workflows/*.yml`.** If a push is rejected for this, revert just that file to
   match the base branch in a follow-up commit so the rest can go through, and flag the
   workflow change for the user to push separately.
9. **After resolving a merge conflict**, run the tests for every file the conflict
   touched — not just a typecheck — before pushing. A clean textual merge can still drop
   half of what one side was doing (this happened once with `conftest.py`: the base's
   database-isolation guard and this branch's recordings/secrets redirect both had to
   survive the merge, and only running the isolation test caught that they had).

## Testing

```bash
# Backend — from backend/
.venv/Scripts/python.exe -m pytest -q

# Frontend — from frontend/
npm run typecheck        # tsc --noEmit && tsc --noEmit -p e2e
npm run lint              # eslint . --report-unused-disable-directives
npm test                  # vitest run
npx playwright test       # full browser suite, ~20-45 min
```

**Verifying a visual/accessibility change across every screen**: don't spot-check a
handful of routes and call it done. Stand up a read-only snapshot of the database on its
own port (see any `docs/implementation/` audit note for the pattern — a copy of
`exam_simulator.db`, empty recordings/secrets folders, backend on one port, frontend
pointed at it on another), then run axe in both themes and check for horizontal overflow
at 390px across the *full* route list (the accessibility/responsive/navigation specs'
`ROUTES` arrays are the canonical list). Stop those two servers when done — never point
this kind of check at the ports the user's own app or the test suites use.

**When a browser test fails**: re-run it alone before concluding anything. A test that
fails only inside a long full-suite run and passes alone is a load/timing issue, not a
bug — say so rather than guessing, and check for a leftover process (a prior run's backend
still holding the test database's file open on Windows is a real, seen cause) before
assuming the timeout itself needs raising again. Never loosen a test just to make it pass;
fix the app if the app is wrong, fix the test only if wording or structure changed.

**Before marking any feature complete**, check:
1. Does an existing test assert a count you just changed (nav links, screens, table
   rows)? Search for `toHaveLength`/`toHaveCount` across the codebase.
2. Any hard-coded colour or font size (including SVG `fontSize`) in the new code?
3. Is the new route in `responsive.spec.ts`, `accessibility.spec.ts`, and
   `navigation.spec.ts`?
4. Are heading levels correct (`h1` → `h2` sections → `h3` cards, no skips)? Run axe.
5. Run the *full* suite (`npm test -- --run`, `pytest -q`), not just the file you touched.

## Project structure

```
frontend/src/
  pages/                 one file per screen/route
  components/ui/         shared primitives — see Design system above
  components/<feature>/  feature-scoped components (exam/, interview/, question_bank/, sandbox/, roadmap/…)
  theme/                 tokens.ts, theme.ts, usePb.ts, fontSizes.test.ts
  services/              API client, per-domain helpers
  types/                 TS interfaces, usually matching a backend schema
e2e/                     Playwright specs + helpers.ts + a throwaway-DB config

backend/app/
  api/v1/                one router file per resource
  models/                SQLAlchemy models
  schemas/               Pydantic request/response models
  services/              business logic; routers stay thin
  repositories/          query logic, kept separate from services where it recurs
  core/                  config, database (incl. migrations), exceptions
  llm/                   provider adapters, task routing, local-model setup, Ollama sync
backend/tests/           pytest, one file per feature/concern
backend/scripts/         perf_gate.py, export_openapi.py, upgrade_check.py, fresh_install_check.py

docs/
  wiki/                  source of truth for the GitHub wiki (see rule 7)
  implementation/        screen registry, parity report, phase/gate reports
  api/openapi.json       generated — regenerate after any schema change:
                         .venv/Scripts/python.exe scripts/export_openapi.py  (env-redirected, see rule 4)
                         .venv/Scripts/python.exe -m pytest -q tests/test_openapi_contract.py
```

## Conventions worth knowing

- **Readiness is computed from full mocks only.** A drill is never a readiness signal.
  Zero mocks reads "needs evaluation", never `0%`. See `docs/wiki/Readiness.md`.
- **AI task routing is per-task**, not global — `llm_task_binding` maps each of the seven
  `LLMTask`s to a provider independently.
- **Recordings/database/secrets in tests** are redirected via `PREPBENCH_RECORDINGS_DIR`,
  `PREPBENCH_SECRETS_DIR`, `SQLALCHEMY_DATABASE_URI` env vars, set in `conftest.py` before
  any app import — this is the mechanism, not a suggestion; new tests that open their own
  `SessionLocal()` bypass it and have caused real leaks before.
- **The Learning Lab** (`/lab`) is a hub for simulation sandboxes (predict → manipulate →
  observe → explain). Agile Metrics is live; adding a new one means: a card in
  `LearningLabPage.tsx`, a `NavEntry` in `navigation.ts`, a route in `App.tsx`, and the
  page itself. See `add-learning-lab-sandbox` skill if available.
- **Interview sessions and exam-taking are "focus modes"**: `FocusLayout` in `App.tsx`
  drops the sidebar/picker so nothing on screen can navigate away mid-recording or
  mid-paper. The interview studio (`bare` prop) draws its own header bar entirely.
- **Interview questions can carry a prepared answer and key talking points**; a take is
  then graded against them (plan alignment score, per-point coverage) in addition to the
  normal content/delivery scoring. Optional per question — freeform questions score as
  before.
- **The Ollama catalogue sync** (`app/llm/ollama_catalogue_sync.py`) only ever runs from
  its own `POST /api/v1/llm/local/models/refresh` endpoint — never at startup, never on a
  schedule. Keep it that way; it's the offline guarantee. It's also offline-*safe*: a
  failed network call or an empty parse returns `ok=False` with a message and changes
  nothing, never raises.

## Where to look next

- `docs/wiki/Home.md` — index of the wiki, four core rules, license
- `docs/wiki/Architecture.md` — backend layering, table inventory, why no Alembic
- `docs/wiki/AI-Providers.md` — provider routing, local model setup, the catalogue sync
- `docs/wiki/Development-Guide.md` — full setup, conventions, how to add an endpoint/chart
- `docs/implementation/PARITY-REPORT.md` — prototype-parity history and known deviations
- `docs/implementation/01-screen-registry.json` — per-screen route/component mapping
  (status field is not proof of parity on its own — see Status above)
