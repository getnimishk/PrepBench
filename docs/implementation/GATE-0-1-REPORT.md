# Phase 0 + 1 Gate Report

**Date:** 2026-09-12 · **Branch:** `main` @ `56c8bbb`
**Format:** per plan §40

---

## Implemented

Phase 0 (Repository and Architecture Audit) and Phase 1 (Prototype Contract and
Screen Inventory), complete. No production code changed.

- Full backend audit: 15 routers, 105 endpoints, 24 tables, layering verified
- Full frontend audit: 26 routes, component inventory, state and storage audit
- Migration strategy identified and its constraints documented
- Test baseline **measured by running both suites**, not estimated
- All 59 prototype screens extracted from the prototype's own `pages{}` +
  `addPage()` registry and mapped to production routes, components and endpoints
- Prototype fixture/persistence layer (`localStorage` key `prepbench.v1`) mapped
- Plan §6's ~50 candidate entities each resolved to
  EXISTS / EXTEND / DERIVE / NEW / DECIDE

## Files changed

Created — documentation only:

```
docs/implementation/00-architecture-audit.md
docs/implementation/00-data-model-audit.md
docs/implementation/00-api-audit.md
docs/implementation/00-test-audit.md
docs/implementation/00-risk-register.md
docs/implementation/01-screen-registry.json
docs/implementation/GATE-0-1-REPORT.md
```

No source file, schema, migration, endpoint or test was modified.

## API changes

**None.** Audit only.

## DB changes

**None.** Audit only.

## Tests

| Suite | Result |
|---|---|
| Backend unit + integration | **465 passed** (103s) |
| Backend coverage | **82%** — 6,895 statements, 1,208 missed |
| Frontend component + unit | **471 passed**, 45 files (145s) |
| E2E | **Not run — no browser E2E framework exists** (RISK-06) |
| Visual | **Not run — no harness exists** (A-10) |

Registry self-validated: 59 entries, no duplicate ids, status counts match the
declared summary, and every id cross-checked against the prototype's own registry.

## Failures

None. Both suites were green before this work and are green after, which is
expected — no source changed.

## Known limitations

1. **No down-migrations are possible.** Forward-only additive steps in
   `apply_lightweight_migrations()`; rollback is a code revert plus a DB restore.
2. **No auth, no user entity.** Plan §34's multi-user isolation requirement is
   not satisfiable as written.
3. **No browser E2E.** Six of eight plan E2E journeys, plus the
   persistence/reload, accessibility, responsive and visual gates, cannot be
   executed.
4. **No API contract enforcement.** Backend Pydantic and frontend TypeScript types
   are hand-mirrored with nothing asserting agreement.
5. **Frontend coverage is unmeasured.**
6. Audit is static plus test-run. The app was **not launched** in this phase, so
   no runtime/console-error audit was performed. That belongs to Phase 3.

## Fixture audit

Per plan §37, classifying the prototype's data:

| Prototype dataset | Classification | Production source |
|---|---|---|
| `prepData` (4 preparations, scores, trends) | **FIXTURE** | `subjects` + readiness service |
| `QB` (question bank) | **FIXTURE** | `questions` table |
| `RMDATA` (roadmaps) | **FIXTURE** | `roadmaps` / `roadmap_phases` / `roadmap_topics` |
| `DR` (design reviews) | **FIXTURE** | `design_reviews` (real seed exists — 1,004-line seeder) |
| `IQ_DATA` (interview questions) | **FIXTURE** | `interview_questions` (real seed exists) |
| `SD_DATA` (system design) | **FIXTURE** | `system_design_prompts` (real seed exists) |
| `IVROUNDS` / `IVDELIVERY` / `IVMEASURED` (rubric) | **CONFIGURATION** | `recording_analysis_service.py` — stays in code, correctly |
| `qbDomains`, `DIFF`, `TYPE`, `GRADES` | **CONFIGURATION** | enums in `models/question.py` |
| `TOPIC_STOP` (stopwords) | **CONFIGURATION** | stays in code |
| `localStorage['prepbench.v1']` | **FIXTURE PERSISTENCE** | must become the SQLite DB |

**Removed in this phase:** nothing — no code changed.

**Remaining intentional fixtures:** all of the above, until each owning phase
replaces them. The repository already has the right mechanism for legitimate seed
content (`seeded_content` ledger, unique on `(namespace, content_key)`), so
seeded packs and learner-imported content can coexist without clobbering.

> The user has imported their own question banks beyond the seeded packs. No
> operation in this programme may assume seed-only data.

**Metrics needing a traceable source before Phase 13 can pass** (plan §19 names
three; the prototype's real figures are):

| UI metric | Prototype value | Production derivation | Status |
|---|---|---|---|
| Readiness score | `93%` hardcoded per prep | `services/readiness.py` from `exam_sessions` | **Traceable** |
| Weakest area | `"Scrum Events"` hardcoded | `GET /home/focus-topics` from `exam_answers` | **Traceable** |
| Verified count | `"37 verified"` hardcoded | `ReviewService.verified_count()` from `review_checks` | **Traceable** |
| Daily goal done/target | `reviewedToday` in localStorage | `COUNT(review_checks)` since local midnight | **Needs implementing** |
| Sandbox mastery | derived from localStorage attempts | — | **No server source (A-1)** |

## Security

Audited, not changed:

- **Positive:** API keys held by reference (`api_key_ref`), not inline;
  `test_llm_secrets.py` (258 lines) covers secret handling; recording uploads
  reject oversized files (413, tested); clients cannot forge `exam_sessions.source`
  (tested); recordings stored on disk with DB metadata, not as BLOBs; FK
  enforcement applied to every engine including the test engine.
- **Gap:** no authentication or authorization of any kind — see RISK-02. This is
  coherent with a single-user local app but makes plan §34 as written
  unsatisfiable.
- **Not yet audited** (deferred to Phase 16, per the plan's own ordering): upload
  MIME/path handling in depth, XSS surface, prompt-injection surface where
  learner text reaches an AI provider.

## Performance

Not measured in this phase — correct per the plan, which places the performance
gate at §33. Observations recorded for later:

- SQLite with WAL and a 10s busy timeout; single-user, so write contention is a
  non-issue
- `questions.options` uses `lazy="joined"`, avoiding the obvious N+1 on the
  question bank
- `review_queue` uses `joinedload` down two levels — deliberate
- `home_service` composes five endpoints' worth of aggregates; the likeliest
  N+1 candidate and the first thing to profile in Phase 33

---

## Gate decision

# PASS — with four decisions required before Phase 2

Gate 0's eight criteria (plan §4):

| Criterion | Status |
|---|---|
| Current architecture documented | **Yes** |
| Current DB schema documented | **Yes** — 24 tables |
| Current APIs documented | **Yes** — 105 endpoints |
| Current test coverage documented | **Yes** — measured, 936 tests, 82% backend |
| Existing reusable services identified | **Yes** |
| Prototype-to-production gaps identified | **Yes** — 12 architecture gaps, 59 screens classified |
| Migration risks identified | **Yes** — RISK-01 |
| API breaking-change risks identified | **Yes** — api-audit §4 |

Gate 1 (plan §5) is **satisfied as an inventory**, and deliberately not as an
implementation: the plan's Gate 1 checklist (route, states, a11y, E2E, deep-link
test per screen) is the *acceptance* criterion for each screen's owning phase, not
for the inventory phase.

### Phase 2 is blocked on four answers

| # | Question | Why it blocks |
|---|---|---|
| 1 | Confirm PrepBench is single-user local-first, so §34's multi-user isolation becomes an explicit non-goal? | Changes whether an auth phase exists at all |
| 2 | Sidebar: 13 items as in the prototype, or keep production's 4 + hubs? | Phase 3 builds the shell |
| 3 | Home: adopt the prototype's two daily goals, reversing `HomePage.tsx`'s documented refusal? | Phase 4 is entirely this |
| 4 | Should `interview_questions` stay a global pool, or be preparation-scoped? | Changes the Phase 3 isolation schema |

Plus two approvals that unblock testing rather than building:

| # | Approval | Effect |
|---|---|---|
| 5 | Add Playwright (one devDependency + one CI job) | Without it, every gate from Phase 3 reports "E2E: not run" |
| 6 | Add an OpenAPI drift check in CI | Closes RISK-05 cheaply |

### Recommended Phase 2 scope, once answered

Preparation isolation first, because Phases 4–13 all read preparation-scoped data
and building them on string matching means reworking every one:

1. Write `02-preparation-isolation-impact.md` (plan §7 Step B format)
2. `roadmaps.subject_id` — nullable FK, heuristic backfill **with an unmatched
   report**, never a silent guess
3. `questions.subject_id` — nullable FK backfilled from `certification`, keeping
   the string column and filter working
4. Every new scoping filter as an **optional** query parameter, so no existing
   endpoint's default response set changes
5. `learning_attempts` table — mirroring `frontend/src/types/learning.ts`, so
   moving `attempts.ts` off `localStorage` is a storage-function swap
6. `app_settings.review_daily_cap`
7. Extend `test_schema_and_ownership.py` and `test_product_invariants.py`, which
   already test exactly this class of leak
