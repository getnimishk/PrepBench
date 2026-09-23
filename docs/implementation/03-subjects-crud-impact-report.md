# 03 — Subjects CRUD Change Impact Report

**Format:** plan §8 (API) + §7 Step B (DB) · **Date:** 2026-09-12
**Status:** written *before* implementation.

Phase 3's first unit: make preparations creatable and editable. This is the
largest remaining API gap — `prep-new` and `prep-edit` cannot exist without it,
and the prototype puts "＋ Add preparation" in the preparation picker on **every**
screen.

Chosen first because it touches neither `main.py` nor `conftest.py`, which a
concurrent session is changing.

---

## 1. Current API

```
GET /api/v1/subjects          -> List[SubjectWithReadiness]
GET /api/v1/subjects/{id}     -> SubjectWithReadiness
```

That is all. There is **no create, update or delete**. Preparations exist only
through `app/utils/seed_subjects.py`, which seeds three
(Scrum/PSM I, Databricks, System Design).

### Consumers of the existing endpoints

| Caller | Uses |
|---|---|
| `frontend/src/services/api.ts:633` `getSubjects()` | `GET /subjects` |
| `frontend/src/services/api.ts:639` `getSubject(id)` | `GET /subjects/{id}` |
| `pages/HomePage.tsx:83` | `getSubjects()` |
| `pages/HubPages.tsx:230` | `getSubjects()` |
| `pages/AnalyticsPage.tsx:109` | `getSubjects()` |
| `pages/ExamSetupPage.tsx:71` | `getSubjects()` |
| `pages/SubjectPage.tsx` via route `/subjects/:subjectId` | `getSubject(id)` |
| `backend` — `SubjectRepository`, `HomeService`, `ExamEngine`, `readiness` | the model |
| Tests | `test_subjects.py` (230 lines), `test_schema_and_ownership.py`, `test_product_invariants.py`, `test_home.py` |

### Current response, current behaviour

`SubjectWithReadiness` = `SubjectResponse` (`id`, `name`, `slug`, `kind`,
`pass_mark`, `exam_question_count`, `exam_minutes`, `has_exam_profile`) plus a
computed `readiness` block and `question_count`.

`question_count` now reads `Question.subject_id` (fixed in Phase 2).

---

## 2. Required change

Three endpoints, and three new columns the prototype's own forms demand.

### What the prototype's forms actually collect

`prep-new` is three steps:

1. **Kind** — Certification ("a named exam … fixed paper, timebox and pass mark")
   or Skill ("no pass mark")
2. **Which certification** — catalogue search, or "Not listed — create custom"
3. **Exam profile** — Questions `80`, Time limit `60 minutes`, Pass mark `85%`,
   **Target exam date** `2026-12-01`, and a starting question bank choice

`prep-edit` collects Name, Type, **Description**, Pass mark (disabled for a
skill), **Target exam date**, and a danger zone with two distinct actions:

> **Archive preparation** — *"Hides it from the picker. History and questions are kept."*
> **Delete preparation** — *"Permanently removes 712 questions, 6 mocks and all review state."*

### Columns needed

| Column | Type | Why |
|---|---|---|
| `description` | `String(300)`, nullable | `prep-edit`'s Description field. The prototype's fixture calls it `subtitle` and renders it as the page sub-line on Home and the picker |
| `target_exam_date` | `Date`, nullable | Both forms collect it. Nullable because a skill has no exam and a certification may not be booked yet — and a *guessed* date would drive a countdown nobody chose |
| `is_archived` | `Boolean`, not null, default `0` | Archive is a distinct, non-destructive action from delete. `roadmaps.is_archived` already sets this precedent, so the shape matches |

**Not added:** nothing else. The starting-question-bank choice in step 3 is a
client-side branch into the existing import flow, not a stored field.

---

## 3. Design decisions, with reasons

### 3.1 The server derives `slug`, and never changes it

`slug` is `unique=True, index=True` and appears in `/subjects/:subjectId`-adjacent
lookups and in `seed_subjects`. The client should not have to invent one.

Derived from `name` on create, de-duplicated with a numeric suffix.
**Never regenerated on update**, even when the name changes: a slug that moves
breaks any link anyone kept. The name is the label; the slug is the identity.

### 3.2 A certification must arrive with its whole exam profile

`Subject.has_exam_profile` requires `pass_mark`, `exam_question_count` **and**
`exam_minutes` to be non-null, and `ExamEngine` refuses a mock without it
(`test_a_mock_without_an_exam_profile_is_refused`).

So a `CERTIFICATION` created without all three is a valid row that cannot do the
one thing a certification exists for. `POST` therefore **requires all three for
`kind=certification`** and **rejects them for `kind=skill`** — a pass mark on a
skill is a number that can never be measured against, and `readiness` deliberately
reports "uncomputable rather than zero" for exactly that reason.

The prototype agrees: step 3 exists only on the certification branch, pre-filled,
captioned *"These come from the official exam."*

### 3.3 A `certification` string may be claimed by only one preparation — 409

This falls straight out of Phase 2. `QuestionRepository.resolve_subject_id`
refuses to attribute a question when two subjects share a certification string,
and the migration backfill skips those rows and logs a warning, because choosing
one would be a coin toss decided by insertion order.

Better to make the ambiguous state **unreachable** than to keep handling it.
`POST` and `PUT` reject a `certification` already held by another subject with
409 and a message naming the holder.

> Note this is a *validation* rule, not a DB constraint. Adding
> `UNIQUE(certification)` to `subjects` would require rebuilding the table, which
> breaks the additive-only rule (RISK-01). Existing databases may already hold a
> duplicate; those keep working and keep logging, they just cannot be created any
> more.

### 3.4 Creating a preparation adopts matching unowned questions

If the new `certification` exactly matches questions that are currently unowned,
`POST` binds them and reports how many.

This is the case that makes the feature useful rather than ceremonial: the learner
has already imported a bank, and "add the preparation it belongs to" should find
it. Same exact-equality rule as the Phase 2 backfill and
`resolve_subject_id` — no token matching, and **only unowned questions**, so it
can never take another preparation's.

### 3.5 Delete is destructive and archive is not — and the UI's numbers must be true

The prototype states both, and they must actually differ:

- **Archive** → `is_archived = true`. Nothing else changes. Reversible.
- **Delete** → destroys the preparation's questions and its exam evidence.

Delete requires `confirm_name` to exactly equal the subject's name, matching the
prototype's *"Type the name to confirm deletion"*. A mismatch is a 400, not a
silent no-op.

**The cascade is performed explicitly in the service, not by `ondelete`.** Two
reasons:

1. `questions.subject_id`, `exam_sessions.subject_id` and `roadmaps.subject_id`
   are all `SET NULL`. Changing them to `CASCADE` means rebuilding three tables —
   forbidden by the additive-only rule.
2. An irreversible user-facing action should read as code, not as a schema side
   effect. The service can then **return what it deleted**, which is what makes
   the prototype's "712 questions, 6 mocks" honest rather than decorative.

What delete removes, exactly:

| Removed | Via |
|---|---|
| Questions owned by the subject | explicit delete; existing cascades take options, exam answers, SR items |
| Exam sessions belonging to the subject | explicit delete; existing cascade takes answers, and review_checks hang off answers |
| The subject row | last |

What delete **keeps**, deliberately:

| Kept | Why |
|---|---|
| Roadmaps — unlinked, not deleted | The prototype's delete copy names questions, mocks and review state. It does **not** claim to delete roadmaps, and a roadmap is separately imported content. Unlinking leaves it in the "not linked to a preparation" group built in Phase 2 |
| Interview questions and recordings | Not scoped to a preparation at all yet — see the open question in the Gate 2 report |
| Design reviews, system-design prompts | Shared content scoped by string, not owned |

The response reports every count, including the roadmaps it unlinked rather than
removed, so the UI cannot claim more than happened.

---

## 4. Backward compatibility

| Concern | Assessment |
|---|---|
| `GET /subjects` response | **Gains** `description`, `target_exam_date`, `is_archived`. Additive |
| `GET /subjects` result set | **Unchanged** — archived subjects are still returned by default, behind an optional `include_archived` that defaults to `true` for now. Flipping that default would silently remove rows from Home, Analytics, Exam Setup and the Practice hub, all of which call `getSubjects()` with no arguments |
| `seed_subjects.py` | Untouched. New columns are nullable or defaulted |
| Frontend `Subject` type | Needs the three new optional fields. Extra fields are tolerated today, so the backend can ship first |
| Existing tests | `test_subjects.py`, `test_schema_and_ownership.py`, `test_home.py`, `test_product_invariants.py` all construct `Subject(...)` directly and must keep passing — the new columns are nullable/defaulted, so they will |

**No existing endpoint's default response set changes.**

### `include_archived` default — flagged, not decided

Defaulting to `true` is the compatible choice and is what ships here. But it means
archiving hides a preparation from *nothing* until the frontend opts in, so the
Archive button would appear to do nothing — a §38 violation if left that way.
**Phase 3's shell work must pass `include_archived=false` in the picker** in the
same phase, or Archive should not be surfaced yet.

---

## 5. Validation and error semantics

| Case | Status | Message names |
|---|---|---|
| Success (create) | 201 | the adopted-question count |
| Success (update / archive) | 200 | — |
| Success (delete) | 200 | every count removed and unlinked |
| Missing `name` | 422 | Pydantic |
| `name` already used | 409 | the existing preparation |
| `certification` already claimed | 409 | the preparation holding it |
| `kind=certification` without a full exam profile | 422 | which of the three is missing |
| `kind=skill` with a pass mark or exam profile | 422 | that a skill has no exam to measure against |
| `pass_mark` outside 0–100 | 422 | Pydantic bounds |
| Unknown id | 404 | — |
| Delete with a wrong `confirm_name` | 400 | that the name must match exactly |

**Authorization: unchanged.** No auth layer exists (RISK-02, ruled single-user for
now), so there are no 401/403 cases to write. Per the api-audit, tests asserting a
401 the app cannot produce will not be written.

---

## 6. DB impact

Three additive, idempotent columns on `subjects`, as one new numbered step in
`apply_lightweight_migrations()`:

```sql
ALTER TABLE subjects ADD COLUMN description VARCHAR(300);
ALTER TABLE subjects ADD COLUMN target_exam_date DATE;
ALTER TABLE subjects ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0;
```

No backfill. `description` and `target_exam_date` are genuinely unknown for the
three seeded subjects, and inventing either would be fabricating content — a made-up
target date in particular would drive a countdown the learner never set.

**Rollback:** revert the code; the columns go inert. No data is lost.

**Query impact:** none. No new index — `is_archived` on a table of single-digit
row count does not warrant one, and §33 forbids an index without query-plan
evidence.

---

## 7. Test impact

New file `test_subjects_crud.py`:

- create a certification, create a skill
- slug derived from name; duplicate names get distinct slugs
- **slug does not change when the name changes**
- 409 on duplicate name; 409 on duplicate certification, naming the holder
- 422: certification missing each of the three profile fields; skill carrying a pass mark
- creating a preparation **adopts matching unowned questions** and reports the count
- creating a preparation does **not** take another preparation's questions
- update changes description/target date/pass mark; archive sets the flag and keeps everything
- delete removes questions and sessions, **unlinks** roadmaps, and reports each count
- delete with a wrong `confirm_name` → 400 and **nothing is deleted**
- 404s

Must stay green: `test_subjects.py` (230 lines), `test_schema_and_ownership.py`,
`test_product_invariants.py`, `test_home.py`, and the Phase 2 suites.

Migration coverage goes into the existing `test_phase2_migrations.py` pattern —
run-twice idempotency and upgraded-equals-fresh parity for the three new columns.
