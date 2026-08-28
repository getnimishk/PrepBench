# Development Guide

## Environment

**Python 3.14** and **Node 22** — what CI pins, and what the dependency set is resolved against.

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows
source .venv/bin/activate       # macOS / Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
# Frontend
cd frontend
npm install
npm run dev
```

### Three dependency files

| File | Contains | Use when |
|---|---|---|
| `requirements.txt` | Runtime dependencies | Running the app |
| `requirements-dev.txt` | The above plus the test runner | Developing |
| `requirements.lock` | Every version including transitives | Reproducing a known-good tree exactly |

CI installs `requirements.lock`, so a green run means the same tree that is green locally. If you change a dependency, regenerate the lock or CI is testing something else.

## Tests

```bash
cd backend && python -m pytest -q
cd frontend && npm test && npm run typecheck && npm run lint
```

Roughly 245 backend and 373 frontend tests. Run `pytest --collect-only -q` and `vitest run` for the current figures rather than trusting this line.

**Order matters when reproducing CI locally:** lint, then typecheck, then test. Both of the first two fail in seconds and catch breakage the test suite takes minutes to reach.

### The vitest timeout is raised deliberately

20 seconds, not the 5-second default. The heaviest tests drive a full MUI dialog through render → type → save → refetch, which measures around 7 seconds even running alone. Tests were failing intermittently with nothing wrong in the code under test — the classic way a suite loses its credibility.

Raised rather than papered over with retries, so a genuine hang still fails instead of being retried away.

## Conventions

### Backend: stay in your layer

Router → Service → Repository → Model. A layer talks only to the one beneath it.

- A router that builds a query is in the wrong layer.
- A service that returns an ORM object across the HTTP boundary should be returning a schema.
- A repository that makes a business decision belongs in a service.

### Schema changes must be additive

There is no Alembic. Startup runs `create_all` plus `apply_lightweight_migrations()`, which adds missing columns and indexes. **Adding a nullable column or an index works. Renaming, retyping, or dropping does not** — that needs a hand-written path, and the helper will not do it for you.

See [Architecture](Architecture#schema-changes-without-alembic) for why the trade was made.

### Route ordering

Register literal paths **before** parameterised siblings. `/analytics` must come before `/{prompt_id}` or FastAPI matches the literal as an ID.

### Never fabricate a value

If something cannot be computed, say so. Empty state, `None`, `—`, "Not Graded". Not `0%`, not a heuristic stand-in, not a plausible default. This is enforced by convention across every scoring path in the app, and it is the reason several endpoints return `Optional[float]` where a float would be more convenient.

---

## How to add things

### An endpoint

1. Schema in `app/schemas/` — the request and response shapes.
2. Repository method in `app/repositories/` if it needs a new query.
3. Service method in `app/services/` for the logic.
4. Route in the relevant `app/api/v1/*.py`, watching the ordering rule.
5. Test in `backend/tests/`.

The router is registered already if the file exists; new router files need a line in `app/api/v1/router.py`.

### A chart view

In `frontend/src/services/metrics/`:

1. Add the view to the union in `charts.ts` with its `family`, `tier`, `primitive`, and `stage`.
2. **TypeScript will now fail to compile** — `buildChartPayload` switches exhaustively over the union, so it demands a payload for the new view. This is intentional: you cannot add a chart and forget to feed it.
3. Add the payload case in `chartData.ts`.
4. Declare any relationship it depends on in `couplings.ts`, typed `arithmetic | assumption | convention`.

> [!IMPORTANT]
> A coupling that reaches no chart fails the completeness test. That is deliberate — an assumption the learner never sees is one they read as a fact.

You do not write a component. Four primitives cover all 27 views; pick the one that fits.

### A learning concept or challenge

In `frontend/src/services/learning/`:

1. Concept in `concepts.ts`, with its `prerequisites`.
2. Challenges in `challenges.ts` referencing it.
3. Scenario in `scenarios.ts` if it needs a new parameter set.

The integrity suite will then check your work: **vocabulary leaks** (a challenge may only use terms licensed by its concept or a transitive prerequisite), **relationship leaks** (the card that asks a question must not answer it), and **unbalanced options** (a hedged distractor among confident ones is a giveaway).

> [!WARNING]
> If you add a regex-based guard, **prove it can fail before trusting that it passes.** Two guards here once matched nothing because `` `\b` `` inside a template literal is the JavaScript escape for backspace, not a word boundary — so `` new RegExp(`\b${x}\b`) `` was built from control characters. Write `` `\\b${x}\\b` ``. There is a test asserting those checks can fail; add yours to it.

### A provider profile

No code needed for anything OpenAI-compatible. Add an entry to `data/llm_profiles.custom.json` — it merges over the built-ins and wins on key collision. See [AI Providers](AI-Providers).

---

## Things that must not regress

These are load-bearing. Each has caused or nearly caused a real problem.

| Rule | Why |
|---|---|
| No endpoint returns an API key | Only `has_api_key` and the last four characters |
| The credential store stays out of git | `backend/data/.llm_secrets.json`, `.llm_secret_key` |
| PrepBench never downloads or launches a model | Enforced in `local_setup.py` |
| `reveal` payload is stripped server-side | For any endpoint serving an unanswered question |
| No coefficient is presented as an industry constant | Calibration constants say what they are |
| PrepBench stays fully offline | No issue-tracker integration, now or later |

## See also

- [Architecture](Architecture) · [Chart Sandbox](Chart-Sandbox) · [Troubleshooting](Troubleshooting)
