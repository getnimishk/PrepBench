# Phase 3a Gate Report — Preparations Are Creatable

**Date:** 2026-09-12 · **Format:** per plan §40
**Preceded by:** [03-subjects-crud-impact-report.md](03-subjects-crud-impact-report.md)

Phase 3's first unit, taken first because it touches neither `main.py` nor
`conftest.py` — a concurrent session is changing those.

---

## Implemented

**The largest remaining API gap is closed.** Preparations were seed-only:
`seed_subjects.py` put three in and nothing could add a fourth, so the
prototype's "＋ Add preparation" — which sits in the preparation picker on *every*
screen — had nothing to call.

| Endpoint | |
|---|---|
| `POST /subjects` | Create. Returns the full read shape so the picker needs no second round trip |
| `PUT /subjects/{id}` | Edit, and archive via `is_archived: true` |
| `DELETE /subjects/{id}` | Destroy, gated on a typed name, reporting every count |
| `GET /subjects` | Gains optional `include_archived` (**defaults to true**) |

Three columns the prototype's own forms collect: `description`,
`target_exam_date`, `is_archived`.

Frontend client wired: `createSubject`, `updateSubject`, `archiveSubject`,
`deleteSubject`, and `getSubjects({ includeArchived })`.

### Rules that refuse states the rest of the system cannot represent honestly

**A certification arrives with its whole exam profile, or not at all.**
`has_exam_profile` needs `pass_mark`, `exam_question_count` and `exam_minutes`
together, and `ExamEngine` refuses a mock without all three. A certification
missing one is a row that looks usable and is not — so it is refused at the door,
with a message naming which field is missing. A **skill** is refused those fields
outright: `readiness` reports a skill as uncomputable *because* it has no pass
mark, and storing one would be a number that can never be measured against.

**One certification string, one preparation — 409.** This falls straight out of
Phase 2: with two claimants, `resolve_subject_id` refuses to attribute a question
and the migration backfill skips it. Both are correct — choosing would be a coin
toss decided by insertion order — but the learner just sees questions belonging to
nothing. Better to make the ambiguous state unreachable than to keep handling its
consequences. The 409 names the preparation already holding it.

> A validation rule, not a `UNIQUE` constraint: adding one to an existing SQLite
> column means rebuilding the table, which the forward-only strategy (RISK-01)
> does not do. Databases already holding a duplicate keep working and keep
> logging; they just cannot create another.

**Creating a preparation adopts matching unowned questions.** The case that makes
this useful rather than ceremonial — the learner imported a bank first and is
adding the preparation it belongs to second. Without it the new preparation is
empty and the bank invisible to it, which looks exactly like the import having
failed. Two limits: exact string equality (never the token match that put a
Databricks question in a PSM I mock), and `subject_id IS NULL` only, so it can
never take another preparation's.

**The slug is derived once and never moves.** Derived from the name on create,
de-duplicated with a numeric suffix. Not regenerated when the name changes: the
name is the label, the slug is the identity, and a slug that moves breaks every
link anyone kept. `kind` is likewise not editable — switching a certification to a
skill would strand its pass mark and orphan the mock evidence measured against it.

**Archive and delete actually differ.** The prototype's danger zone offers both:
archive *"hides it from the picker, history and questions are kept"*; delete
*"permanently removes 712 questions, 6 mocks and all review state."* So archive
sets a flag and nothing else, and delete really destroys.

Delete requires `confirm_name` to equal the name exactly — the prototype's *"Type
the name to confirm deletion"*. A mismatch is a 400 and **nothing is deleted**,
not a silent no-op: a caller that got a 200 would report the preparation as gone.

The cascade is **explicit in the service, not `ondelete`**. Every `subject_id` in
this schema is `SET NULL`, which is right for accidental unlinking and wrong here
— the learner asked for the questions to go. Doing it in code also means the
counts can be returned, which is what makes the danger zone's numbers honest
rather than decorative:

| Delete removes | Delete keeps |
|---|---|
| Questions owned by the preparation (options, exam answers, SR rows follow) | **Roadmaps — unlinked, not destroyed.** The delete copy names questions, mocks and review state; it makes no claim on roadmaps, and a roadmap is separately imported content. It reappears in the Phase 2 "not linked to a preparation" group |
| Exam sessions belonging to it (answers, review checks follow) | Learning attempts — unlinked |
| The subject row | Interview questions, recordings, design reviews, system-design prompts — not preparation-scoped yet |

## Files changed

Modified (7):

```
backend/app/core/database.py                       subjects migration step
backend/app/core/exceptions.py                     ConflictException (409)
backend/app/models/subject.py                      description, target_exam_date, is_archived
backend/app/repositories/subject_repository.py      get_by_name/certification, slugs, save, delete
backend/app/api/v1/subjects.py                     POST, PUT, DELETE, include_archived
frontend/src/types/subject.ts                      new fields + create/update/delete shapes
frontend/src/services/api.ts                       5 client functions
```

Added (3):

```
backend/app/schemas/subject.py
backend/app/services/subject_service.py
backend/tests/test_subjects_crud.py                24 tests
```

Also updated: 7 `Subject` fixtures across 5 frontend test files, which the
typechecker caught the moment `is_archived` and `display_order` became required.
Kept required rather than optional — the backend always sends both, so a component
should not have to null-check them.

## API changes

| Endpoint | Before | After | Consumers |
|---|---|---|---|
| `POST /subjects` | **did not exist** | 201 with the full read shape | `prep-new` (Phase 3b) |
| `PUT /subjects/{id}` | **did not exist** | 200 | `prep-edit` (Phase 3b) |
| `DELETE /subjects/{id}` | **did not exist** | 200 with counts; 400 on name mismatch | `prep-edit` danger zone |
| `GET /subjects` | all subjects | optional `include_archived`, **default true** | 5 callers, all unaffected |
| `GET /subjects`, `GET /subjects/{id}` responses | — | gain `description`, `certification`, `target_exam_date`, `is_archived`, `display_order` | additive |

`ConflictException` is new in `app/core/exceptions.py`. Its own class rather than a
`status_code` argument on `InvalidExamStateException`: that one means "this
operation makes no sense here" and is a 400 by definition, whereas a name already
in use is the caller doing nothing wrong against a taken resource. A client
retrying a 400 wastes its time; a 409 tells it to change the value.

**No existing endpoint's default response set changed.**

### One flagged consequence

`include_archived` defaults to **true**, which is the compatible choice — Home, the
Practice hub, Analytics, Exam Setup and the subject page all call `getSubjects()`
with no arguments, and flipping it would silently remove rows from all five.

But it means archiving currently hides a preparation from nothing. **Phase 3b must
pass `include_archived: false` in the picker, or not surface the Archive button
yet** — a control whose effect is invisible is a §38 violation.

## DB changes

One additive, idempotent step: `description VARCHAR(300)`, `target_exam_date DATE`,
`is_archived BOOLEAN NOT NULL DEFAULT 0` on `subjects`.

**No backfill.** `description` and `target_exam_date` are genuinely unknown for the
three seeded subjects, and a made-up target date would drive a countdown the
learner never set. Verified on the real database — all three subjects read
`description=None target=None archived=0`.

Rollback: revert the code; the columns go inert. No index — `is_archived` on a
single-digit-row table does not warrant one, and §33 forbids an index without
query-plan evidence.

## Tests

| Suite | Before | After | Delta |
|---|---|---|---|
| Backend | 494 passed | **520 passed** | **+26** |
| Frontend | 471 passed | **471 passed** | 0 |
| Frontend typecheck | clean | clean | — |
| Frontend lint | 0 errors, 16 warnings | 0 errors, 16 warnings | 0 |
| E2E | not run | **not run** | no harness (RISK-06) |

`test_subjects_crud.py` — 24 tests, all passing first run: create both kinds ·
derived slug · distinct slugs for similar names · **slug does not move on rename**
· 409 on duplicate name · 409 on claimed certification naming the holder ·
parametrised 422 for each missing profile field · 422 for a skill with a pass mark
· **adoption of an unowned bank** · adoption cannot steal another preparation's ·
partial update leaves the rest alone · archive keeps everything and reverses ·
archived hidden only when asked · a skill cannot acquire a profile by update ·
rename conflict · **delete removes questions and reports counts** · **delete
unlinks a roadmap rather than destroying it** · **a wrong confirmation name deletes
nothing** · deleting one preparation leaves another's questions alone · 404s.

`test_phase2_migrations.py` — 2 added (10 total). The idempotency and
upgraded-equals-fresh parity tests now cover `subjects` as well.

## Failures

None. All 24 new tests passed on first run; no existing test needed changing on the
backend.

The only breakage was on the frontend, and it was the typechecker doing its job:
making `is_archived` and `display_order` required surfaced 7 fixtures that build
`Subject` objects. Fixed, not worked around.

## Known limitations

1. **No UI yet.** `prep-new` and `prep-edit` remain `missing` in the registry. The
   API and client functions exist; no screen calls them. That is Phase 3b.
2. **The picker does not exist**, so "＋ Add preparation" still has nowhere to live.
3. **Archive is invisible** until the picker passes `include_archived: false` — see
   the flag above.
4. **`kind` is immutable and there is no migration path.** Getting it wrong means
   delete and recreate, which destroys evidence. Acceptable at creation-time cost;
   worth revisiting if it bites.
5. **Delete is irreversible with no backup mechanism.** The typed-name gate is the
   only protection. A pre-delete export would be a real improvement and is not in
   this phase.
6. **No E2E.** The §9 isolation journey still cannot run.

## Fixture audit

**Removed:** none.

**New fixture risk: none.** Every value this unit writes is either supplied by the
learner or `NULL`. The migration invents nothing; adoption binds only on exact
equality; the delete result reports measured counts rather than predicted ones.

Worth noting against §37: the prototype's danger-zone sentence *"Permanently
removes 712 questions, 6 mocks and all review state"* now has a traceable source
on **both** sides — `question_count` and `readiness.mock_count` before the fact,
and `SubjectDeleteResult` after it.

## Security

Unchanged posture — single-user local-first (RISK-02, deferred by ruling).

One addition worth noting: `DELETE /subjects/{id}` is the most destructive endpoint
in the application and is the only one requiring an in-body confirmation that
matches stored state. That is a deliberate asymmetry with `POST /settings/reset-app`,
which takes no confirmation at all — worth revisiting in the Phase 16 security gate.

## Performance

No new index, no new N+1. `POST` does one existence check per unique field plus one
bulk `UPDATE` for adoption. `DELETE` loads owned questions and sessions to delete
them through the ORM so relationship cascades fire — O(n) in the preparation's own
rows, on an explicitly confirmed action.

---

## Gate decision

# PASS

| Criterion | Status |
|---|---|
| Impact report written before the change (§8) | **Yes** |
| Migration additive, idempotent, new step (§7 C) | **Yes** |
| Migration validated — twice, fresh-vs-upgraded (§7 D) | **Yes**, 10 tests |
| No duplicate API for an existing operation | **Yes** — extended the `/subjects` router |
| No existing endpoint's default response changed | **Yes** |
| Required test matrix (§8) | success, validation failure, not found, conflict, malformed, boundary, idempotency-adjacent — **all covered**. `unauthorized`/`forbidden` N/A, no auth layer |
| Test baseline not regressed | **Yes** — 494 → 520 backend, 471 frontend held |
| Every new value traceable (§37) | **Yes** |
| No fake interactions (§38) | **Yes** — but see limitation 3 |

### Next: Phase 3b

1. **Playwright** — wait for the concurrent `conftest.py`/`main.py` work to land first
2. `prep-new` (3-step wizard) and `prep-edit` (details + danger zone) screens
3. The preparation picker in the header, on every screen, passing
   `include_archived: false`
4. The 13-item sidebar, as ruled
5. Wire the Phase 2 `subject_id` filters into Question Bank and Roadmaps
6. The §9 isolation E2E
7. OpenAPI drift check in CI (RISK-05)
