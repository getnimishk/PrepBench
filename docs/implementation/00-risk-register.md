# 00 — Risk Register

**Date:** 2026-09-12 · **Gate:** 0
Severity: **BLOCKER** (stops a phase) · **HIGH** · **MEDIUM** · **LOW**
Type: **DECISION** needs the user's ruling · **TECHNICAL** needs engineering

---

## RISK-01 — No reversible migrations · HIGH · TECHNICAL

**Risk.** Plan §7 Step C/D require a reversible migration and a `migration down`
validation. The repository has no migration framework: schema comes from
`Base.metadata.create_all()` plus a hand-rolled, forward-only, idempotent
`apply_lightweight_migrations()`. A bad schema change therefore has **no rollback
path** other than restoring a backup of `exam_simulator.db`.

**Correction to an earlier draft of this entry:** `DROP COLUMN` *is* available and
*is* already used — `database.py:156-183` drops six dead `app_settings` columns,
guarded by a `sqlite3.sqlite_version >= (3, 35)` check and skipped rather than
failed on older SQLite. So the constraint is not "SQLite cannot drop columns"; it
is that **there is no mechanism to run a migration backwards**. Every step is a
one-way function applied at startup.

**Why not just add Alembic.** Rule 3 forbids introducing new infrastructure unless
the audit proves necessity. Retro-fitting Alembic onto a database whose current
state was produced by `create_all` plus seven ad-hoc steps requires authoring a
baseline that matches every existing learner's file. That is a project in itself
and it risks the one thing that must not break: the user's own imported question
banks.

**Mitigation — the substitute for Step C/D.** Every schema change in this
programme must be:

1. **Additive only.** New table, or new nullable column with a default. Never a
   drop, never a type change, never a rename.
2. **Idempotent.** Guarded by `PRAGMA table_info` / `sqlite_master` inspection,
   exactly as the seven existing steps are.
3. **A new numbered step** in `apply_lightweight_migrations()`, never an edit to
   an existing step (plan §7 Step C's "never edit an applied migration" still
   applies and is achievable).
4. **Tested twice over:** run-twice-is-a-no-op, and correct against a database
   built fresh by `create_all`.
5. **Preceded by a backup instruction** in the phase gate report, since restore is
   the only rollback.

Because every change is additive, "rollback" is reverting the *code* — the extra
column becomes inert. That is a genuine, testable rollback story; it is just not
a down-migration.

**Owner:** engineering. **Blocks:** nothing, once the above is adopted.

---

## RISK-02 — Multi-user security gate is unsatisfiable · HIGH · DECISION

**Risk.** Plan §34 requires that a user cannot reach another user's preparation,
questions, recordings, transcripts, attempts, evidence or analytics by changing an
ID. **There is no second user.** No `users` table, no auth middleware, no session,
no token, no ownership column on any of the 24 tables. CORS is open to the local
Vite origin. The app runs against a local SQLite file started by `start_app.bat`.

Satisfying §34 literally means: authentication, a user table, an owner column on
~20 tables with a backfill, an authorization layer on all 105 endpoints, and a
login UI the prototype does not contain. That is a larger programme than the one
in this plan, and Rule 3 forbids it absent proven necessity. **The audit does not
prove necessity** — every signal in the repository and the prototype says
single-user, local-first.

**Decision needed from the user. Three options:**

| Option | Consequence |
|---|---|
| **A. Confirm single-user (recommended)** | §34 is rewritten as a single-user security gate: input validation, upload size/MIME/path validation, XSS, SQL injection, prompt injection, secret handling, safe file paths. All applicable, all valuable, several already covered. Multi-user isolation is recorded as an explicit non-goal |
| **B. Add auth now** | A dedicated phase before Phase 3. Roughly doubles the programme. Needs UI the prototype does not specify |
| **C. Defer** | §34 stays open, the final release gate can never report PASS |

**Recommendation: A.** The parts of §34 that are real in a local app are worth
doing properly, and several already are: `test_llm_secrets.py` (258 lines) covers
secret handling, `test_review_fixes.py` covers oversized-upload rejection, and
`test_product_invariants.py::test_a_client_cannot_declare_its_own_provenance`
covers client-forged fields.

**Blocks:** Phase 16's security gate, and the final release gate's wording.
Does not block Phases 3–15.

---

## RISK-03 — The prototype reverses two deliberate product decisions · HIGH · DECISION

The plan says the prototype is the authoritative UI/UX contract. In two places the
prototype reverses a decision the production code reached deliberately and
recorded in detail. Implementing the prototype silently would discard reasoning the
user themselves arrived at over several iterations.

### 03a — Navigation breadth

| | Sidebar items |
|---|---|
| Production | **4** + Settings: Home, Practice, Learn, Review |
| Prototype | **13**: home, learn, practice, review, exam-setup, question-bank, interview, system-design, design-reviews, recordings, insights, preparations, settings |

Production reaches the other areas through hub pages (`PracticeHubPage`,
`LearnHubPage`). The prototype promotes them all to top level.

### 03b — Home and daily goals

`HomePage.tsx:20-49` records four rounds of correction, and its closing line is
explicit:

> *"Still refused: a second chart, a streak, **a daily goal**, an activity feed,
> and a row of equally loud buttons — a page with four primary actions has none."*

Plan §10 makes **two standing daily goals the operating dashboard** of Home, and
the prototype's `todayStrip()` renders them as the first thing under the headline,
with three buttons in each panel.

**In fairness to the prototype:** its daily goal is not the thing that was
rejected. What `HomePage` refused was a *streak and a goal ring* — gamification. The
prototype's goal is derived from what the schedule says is due, is capped, and
carries its own disclaimer in the UI copy: *"Your goal is what the schedule says
is due, capped at N a day — not a quota."* and *"Nothing is due. That is the system
working, not a missed day."* That is a materially different, and better, idea than
a streak ring.

**Decision needed. Options:**

| Option | Consequence |
|---|---|
| **A. Implement the prototype as specified (plan-literal)** | Nav grows to 13; Home leads with two goal panels. Honours the plan's "prototype is authoritative" rule |
| **B. Keep production IA, adopt the goals** | Adopt `todayStrip()` on Home (it is the better idea, and honestly framed) but keep the 4-item sidebar and hub pages. Preserves a decision made against a real density problem |
| **C. Keep production, treat prototype as inspiration** | Contradicts the plan |

**Recommendation: B**, and flagged rather than assumed because it is the user's
call, not mine. The prototype's own comments show the same authorial voice that
wrote `HomePage.tsx` — this looks like an evolving view rather than a
contradiction, and the user is the only one who can say which way it evolved.

**Blocks:** Phase 3 (nav) and Phase 4 (Home). Nothing else.

---

## RISK-04 — Preparation isolation rests on string matching · BLOCKER · TECHNICAL

**Risk.** Plan §2 demands complete preparation isolation and §24 demands an
automated E2E proving no leakage across three preparations. Today:

- `questions` → preparation by **string match** on `Question.certification` ==
  `Subject.certification`
- `roadmaps` → **no `subject_id` at all**; unscoped
- `interview_questions` → unscoped global pool
- `practice_recordings` → unscoped
- `design_reviews` → `domain` string, resolved in `home_service._design_domain()`
- `system_design_prompts` → `category` string
- `exam_sessions` → a real FK, but **nullable**

The prototype inherits the same weakness and says so: *"roadmaps are standalone in
the schema, so they are scoped by roadmap, not preparation."*

**Why it is a blocker.** Phases 4–13 all build surfaces that read
preparation-scoped data. If isolation is fixed after them, every one of those
surfaces needs reworking and every isolation test written before the fix asserts
against the leak. Fix it in Phase 3.

**Mitigation.** A dedicated impact assessment
(`02-preparation-isolation-impact.md`) as the first act of Phase 2, covering at
minimum:

- Add `roadmaps.subject_id` (nullable FK, `SET NULL`), backfill by title/slug
  heuristic **with a report of anything unmatched**, never a silent guess
- Add `questions.subject_id` (nullable FK), backfill from the existing
  `certification` string, keep the string column and the string filter working
- Every new scoping filter arrives as an **optional query parameter** first
  (see [00-api-audit.md](00-api-audit.md) §4) so no existing endpoint's default
  response set changes
- Extend `test_schema_and_ownership.py` — it already has
  `test_ownership_cannot_be_claimed_by_a_lookalike_slug`, which is precisely this
  risk under test
- Decide explicitly whether `interview_questions` should stay a global pool. A
  behavioural question ("tell me about a conflict") is genuinely
  preparation-agnostic; forcing it into one preparation may be wrong. **Scope the
  attempt (`practice_recordings`), not necessarily the question.**

**Owner:** engineering, with one product question (interview pool scoping).
**Blocks:** Phases 4–13.

---

## RISK-05 — No API contract between backend and frontend · MEDIUM · TECHNICAL

**Risk.** Request/response shapes are hand-maintained twice: Pydantic schemas in
`backend/app/schemas/` and TypeScript types in `frontend/src/types/`. Nothing
asserts they agree. `npm run typecheck` validates the frontend against its own
types. A field renamed in a Pydantic schema type-checks clean on both sides and
fails at runtime.

There is no OpenAPI artefact in the repo (FastAPI serves `/docs` live only) and no
generated client.

**Mitigation.** Cheapest credible option, in Phase 3: export the OpenAPI document
in CI and fail the build when it changes without a matching frontend type change.
Generating the client outright would be better but is a larger change to
`api.ts`'s 751 lines of hand-written wrappers. Plan §31 asks for contract tests;
this is the minimum version of that.

**Blocks:** nothing. Raises the cost of every later phase if left.

---

## RISK-06 — No browser E2E harness · HIGH · TECHNICAL

**Risk.** Six of the plan's eight E2E journeys, plus its entire
persistence/reload gate (§30), accessibility gate (§21), responsive gate (§21) and
visual-regression gate (§36), require a real browser. None exists. The two
`test_e2e_*.py` files are API-level `TestClient` tests — they never render, click
or reload.

Specifically unsatisfiable today: §14's `reload → resume` (reload *is* the
assertion), §25's `getUserMedia`/`MediaRecorder` interview flow, §30's "hard
reload / browser restart", §36's screenshot comparison.

**Mitigation.** Add Playwright in Phase 3. One devDependency, one CI job. It can
assert DB state via the API in the same test, which satisfies §23's *"must assert
database state, not just visible text"*. Fake media devices cover §25.

This is **not** speculative architecture under Rule 3 — the audit proves the
necessity, because the named requirements cannot otherwise be met.

**Blocks:** every phase gate's "E2E" line from Phase 3 onward.

---

## RISK-07 — Least-covered modules sit on the highest-gap phases · MEDIUM · TECHNICAL

`content_validator.py` 30%, `import_service.py` 60%, `question_repository.py` 62%
— these are on the Phase 6 (import) and Phase 3 (isolation) critical paths.
`integrity_check_service.py`, `seed_data.py`, `verify_question_bank.py` and
`build_scrum_guide_index.py` are at **0%**.

**Mitigation.** Raise coverage on the module being changed, within the phase that
changes it. Do not touch the 0% modules without adding tests first.

---

## RISK-08 — Scope · HIGH · DECISION

**Risk.** The plan specifies 17 phases, ~59 screens, 4 new tables, 3 new columns,
a new E2E harness, a visual-regression harness, an accessibility harness, and full
unit/integration/component/E2E coverage for all of it. That is a multi-month
programme, not a single work session.

The plan itself forbids doing it as "one large uncontrolled change" (§3) and
requires a gate review before each phase advances.

**Mitigation.** Proceed strictly one phase at a time, gate report at each
boundary, user sign-off before advancing. Phase 0 is complete with this document
set. Phase 1 (screen registry) is delivered alongside it. **Phase 2 should not
begin until RISK-02, RISK-03 and the RISK-04 interview-pool question are answered**
— all three change what gets built.

---

## Summary — what is needed before Phase 2

| Risk | Needs | From |
|---|---|---|
| RISK-02 | Confirm single-user, or commission auth | **User** |
| RISK-03a | Nav: 4 items or 13 | **User** |
| RISK-03b | Home: adopt the two daily goals? | **User** |
| RISK-04 | Should `interview_questions` stay a global pool? | **User** |
| RISK-01 | Adopt the additive-idempotent migration rule | Engineering (recommended, no blocker) |
| RISK-06 | Approve adding Playwright | **User** (one new dependency) |
| RISK-05 | Approve OpenAPI drift check in CI | Engineering |
