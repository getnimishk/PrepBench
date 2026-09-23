# Phase 2 Gate Report — Data Model and Persistence Foundation

**Date:** 2026-09-12 · **Format:** per plan §40
**Preceded by:** [02-phase-2-impact-report.md](02-phase-2-impact-report.md), written
before any schema change as §7 Step B requires.

---

## Implemented

### A proven preparation-isolation defect, fixed

Ownership of a question was inferred from the `certification` **string** by
matching words. `ExamEngine.create_exam` ORed an `ILIKE` for every token of the
subject's certification name across **both** `Question.certification` and
`Question.domain`. For `"PSM I - Professional Scrum Master"` the tokens are
`PSM`, `Professional`, `Scrum`, `Master` — so any question in any preparation
whose certification *or domain* contained "Professional" or "Master" was a
candidate for a PSM I mock.

Demonstrated before being fixed:

```
AssertionError: A PSM I mock drew questions from another preparation:
['Databricks Certified Data Engineer Professional', 'PSM I - Professional Scrum Master']
```

The existing suite could not catch it: `test_product_invariants.py::_cert()`
returns a deliberately collision-proof random token, and says so — *"one unbroken
token, so another test's certification cannot match it through a shared word."*
Sound for keeping those tests independent, but it means the suite never ran on
names that overlap, which real certification names always do.

**A second leak, same root cause, also fixed.** A *skill* subject has
`certification = None` (Databricks and System Design both, in
`seed_subjects.py`). With no certification string, no question filter was built
at all — and a filter of nothing is not a narrow scope, it is every question in
the database. A Databricks drill served Scrum questions. The prototype's own
fixture says Databricks has `questions: 0`; production silently had all of them.

Scoping is now a single indexed foreign key when a subject is named.

### Changes

| # | Change |
|---|---|
| 2.1 | `questions.subject_id` — FK (`SET NULL`), indexed, backfilled by **exact** certification equality |
| 2.2 | `roadmaps.subject_id` — FK (`SET NULL`), indexed, **no backfill** by decision |
| 2.4 | `learning_attempts` — new table, plus repository, service, schemas and router |
| — | `GET /questions` and `GET /roadmaps` gain an **optional** `subject_id` filter |
| — | Question create resolves `subject_id` from `certification` by exact match |
| — | Exam-profile refusal moved before question selection |
| — | No-match refusal names the preparation; a preparation with no bank gets its own message |

### Deferred, deliberately

**`app_settings.review_daily_cap` → Phase 4.** Nothing in Phase 2 would read it.
Home's daily goal is Phase 4 and Review is Phase 7. `app_settings` had six
columns dropped precisely *because nothing read them*, guarded by
`test_the_dead_settings_columns_are_gone_from_the_table`; adding a seventh on the
promise of a future reader is the same mistake with better intentions. The model
carries a comment recording where the column belongs and why it is not there yet.

**`topic_contents` / `topic_demonstrations` → Phase 5.** Designing them without
the `guide` and `topic-demonstrate` screens' real requirements would be
speculation. They belong with the screens that define their shape.

## Files changed

Modified (16):

```
backend/app/core/database.py                     +172  four migration steps
backend/app/models/question.py                         subject_id
backend/app/models/roadmap.py                          subject_id
backend/app/models/settings.py                         comment only (see Deferred)
backend/app/models/__init__.py                         register LearningAttempt
backend/app/repositories/question_repository.py        subject scope, resolve, _apply_filters
backend/app/repositories/roadmap_repository.py         subject filter
backend/app/schemas/question.py                        subject_id in/out + filter
backend/app/schemas/roadmap.py                         subject_id in/out
backend/app/services/exam_engine.py                    FK scoping, check ordering, messages
backend/app/services/roadmap_service.py                subject_id on create, list filter
backend/app/api/v1/questions.py                        optional subject_id
backend/app/api/v1/roadmaps.py                         optional subject_id
backend/app/api/v1/router.py                           register learning router
backend/app/api/v1/subjects.py                         question_count reads subject_id
backend/app/services/home_service.py                   question_count reads subject_id
```

Added (8):

```
backend/app/models/learning_attempt.py
backend/app/repositories/learning_attempt_repository.py
backend/app/schemas/learning.py
backend/app/services/learning_service.py
backend/app/api/v1/learning.py
backend/tests/test_preparation_isolation.py        8 tests
backend/tests/test_phase2_migrations.py            8 tests
backend/tests/test_learning_attempts.py           13 tests
```

## API changes

### New — `/learning`

| Endpoint | Notes |
|---|---|
| `GET /learning/attempts` | Optional `subject_id`, `concept_id` |
| `GET /learning/attempts/{uid}` | 404 when unknown |
| `POST /learning/attempts` | **Idempotent** on `attempt_uid`; cannot carry a result |
| `PATCH /learning/attempts/{uid}` | Commit prediction, record hints/reasoning, complete |

A new router rather than an extension: no existing router owns the learning
domain, and hanging it off `/questions` or `/roadmaps` would put an unrelated
resource behind one of theirs.

### Extended — additive only

| Endpoint | Before | After | Consumers |
|---|---|---|---|
| `GET /questions` | no preparation scope | optional `subject_id`; **default unfiltered** | `QuestionBankPage` — unaffected |
| `GET /roadmaps` | all roadmaps | optional `subject_id`; **default all** | `RoadmapListPage` — unaffected |
| `POST`/`PUT /questions` | — | accept optional `subject_id`; resolved from `certification` when omitted | importers unaffected, and now attribute correctly |
| `POST`/`PUT /roadmaps` | — | accept optional `subject_id` | unaffected |
| Question + roadmap responses | — | gain `subject_id` | additive; frontend tolerates extra fields |

### Behaviour change — one, intended

`POST /exams` with a `subject_id` now scopes by `Question.subject_id` instead of
the fuzzy certification match. This is the live path: `ExamSetupPage.tsx:118,132`
sends `subject_id` and never `certification` — verified.

`POST /exams` with a `certification` string and **no** `subject_id` is unchanged
and still lenient. No production caller uses it; `test_product_invariants.py`
does. The asymmetry is documented in the code: **`subject_id` is precise and
authoritative, the certification string is lenient and legacy.**

**No existing endpoint's default response set changed.**

## DB changes

| Migration step | Table | Backfill | Rollback |
|---|---|---|---|
| `questions.subject_id` | `questions` | Exact `certification` equality; unmatched logged | Revert code — column inert |
| `roadmaps.subject_id` | `roadmaps` | **None** | Revert code — column inert |
| `learning_attempts table` | new | n/a | Revert code — table orphaned |

Three new indexes: `ix_questions_subject_id`, `ix_roadmaps_subject_id`,
`ix_learning_attempts_*`. Each on a filter this phase actually added, none
speculative.

All additive and idempotent. No column dropped, renamed or retyped. No existing
migration step edited.

### Backfill decisions worth reading

**Exact equality only.** Exact match is the *safe half* of the old rule — the
half `seed_subjects.py` relies on when it says 700-odd existing questions resolve
to PSM I. The fuzzy half is the bug, so it takes no part in repairing the data.
Unmatched questions stay NULL and are logged by certification, because an unowned
question is a fact the operator should see, not a blank for a migration to fill.

**A certification claimed by two preparations is left unowned.**
`subjects.certification` is not unique. A plain loop over subjects would let
whichever row came first claim every question — ownership decided by insertion
order. That is the same coin toss `resolve_subject_id` refuses at write time, and
the two must agree or a question's owner depends on whether it arrived before or
after the migration ran. Both refuse and log.

**Roadmaps get no heuristic.** Nothing in the old schema recorded which
preparation a roadmap served, so there is no rule to apply — only a guess at the
title. Unassigned and labelled beats assigned and wrong; `PUT /roadmaps/{id}`
accepts `subject_id` so it is a one-click fix.

## Tests

| Suite | Before | After | Delta |
|---|---|---|---|
| Backend | 465 passed | **494 passed** | **+29** |
| Backend coverage | 82% | **83%** | +1 |
| Frontend | 471 passed | **471 passed** | 0 (untouched) |
| Frontend typecheck | clean | clean | — |
| Frontend lint | 0 errors, 16 warnings | 0 errors, 16 warnings | 0 (pre-existing) |
| E2E | not run | **not run** | no harness (RISK-06) |
| Visual | not run | **not run** | no harness |

Coverage of the new code: `api/v1/learning.py` 100%, `models/learning_attempt.py`
100%, `schemas/learning.py` 100%, `services/learning_service.py` 97%,
`repositories/learning_attempt_repository.py` 96%, `services/exam_engine.py` 93%
(was 88%), `repositories/question_repository.py` 66% (was 62%).

### The 29 new tests

**`test_preparation_isolation.py` (8)** — written red, against realistic
overlapping certification names:
another preparation's questions excluded · domain-word match excluded · a
preparation still finds its own · create attributes by exact certification · an
unmatched certification stays unowned · a skill subject draws only its own · a
too-narrow filter names the preparation, not its certification string · the reported question count agrees with what an exam can draw.

**`test_phase2_migrations.py` (8)** — the substitute for the down-migration this
repository cannot provide (RISK-01), each against its own throwaway SQLite file
built from the *pre-Phase-2* table definitions:
columns arrive · table created · **running twice changes nothing** · **an upgraded
database has the same columns as a fresh one** · backfill uses exact equality ·
unmatched left unowned · a contested certification left unowned · roadmaps left
unassigned.

**`test_learning_attempts.py` (13)** — the server-side half of the learning
layer's integrity rules:
a new attempt has no verdict (null, not false) · cannot be created carrying its
own result · same uid twice is one attempt · a retried create does not overwrite ·
a prediction commits once · **a committed prediction cannot be amended** · nor
after completion · an uncommitted attempt cannot be completed · completing twice
is a no-op · a hint after committing is still recorded · rubric coverage round
trips · 404s.

## Failures

None outstanding. Two arose during implementation and both were fixed:

1. **`test_a_mock_without_an_exam_profile_is_refused`** — the refusal still fired
   but with the wrong message, because "no questions match those filters" now
   reached the learner before the exam-profile check. Fixed by splitting the
   precondition from the length check. Caught only because that test asserts on
   the message and not merely the status code.

2. **`test_the_dead_settings_columns_are_gone_from_the_table`** — broke when
   `review_daily_cap` was added. Rather than update the guard, the column was
   **withdrawn** and deferred to Phase 4, where its reader is built. The guard
   was right.

One bug was found in this phase's *own* new migration before it shipped: the
backfill loop let the first of two subjects sharing a certification claim every
question, making ownership depend on insertion order. Fixed and covered by
`test_a_certification_claimed_by_two_preparations_is_left_unowned`.

### A follow-up defect this phase's own change created

Found while starting Phase 3's §8 audit of the subjects API. Recorded here
because it is Phase 2's to own, and fixed before Phase 3 proper begins.

`question_count` on `GET /subjects` and `GET /subjects/{id}`, and the identical
count inside `HomeService.coverage_for`, both still matched on
`Question.certification == subject.certification` after the exam engine moved to
`Question.subject_id`. Two readers, two columns, one number.

That number's whole purpose is agreement with the engine — its own comment records
that a fresh install once offered *"Take your first mock"* against an empty bank,
the engine correctly refused, and a new user's only offered action was an error
message. A count sourced differently from the engine can promise an exam the
engine then refuses, or hide one it would have run. `coverage_for` computes
`can_mock` from it, so the disagreement reached two surfaces.

Reported **0 for a preparation that owned 3 questions**. Demonstrated before
fixing:

```
AssertionError: the subjects endpoint reported 0 questions for a preparation
that owns 3 -- the count and the exam engine are reading different columns
```

It bit precisely the cases the foreign key was added to serve: every **skill**
subject, which has no certification string to match at all, and any preparation a
learner binds questions to by hand. For PSM I the two agreed by luck — the
backfill used exact certification equality, so both read 709.

Both call sites now use `QuestionRepository.count_for_subject`. Covered by
`test_the_reported_question_count_agrees_with_what_an_exam_can_draw`, which
asserts the reported count **and** that the engine can really draw them — a count
test alone would pass against two consistent but wrong numbers.

Dead imports left behind by the change were removed (`func` and `Question` from
`subjects.py`, `Question` from `home_service.py`).

## Known limitations

1. **The client still writes learning attempts to `localStorage`.** The backend
   is ready — table, service, endpoints, 13 tests — but
   `frontend/src/services/learning/attempts.ts` has not been switched over. That
   is Phase 12's work, and the 1,041 lines of frontend integrity tests must pass
   unchanged against the new backing.
2. **`interview_questions` and `practice_recordings` remain unscoped.** Whether a
   behavioural question ("tell me about a conflict") *should* belong to one
   preparation is a product question, not an oversight — see Assumptions below.
3. **`design_reviews` (by `domain`) and `system_design_prompts` (by `category`)
   still scope by string.** Lower risk than questions were: neither feeds
   readiness, and `test_schema_and_ownership.py` already covers their ownership.
   Revisit in Phases 10–11.
4. **No E2E verification.** Plan §24's three-preparation isolation journey needs a
   browser harness that does not exist. The API-level tests here assert database
   state, which is the stronger half of §24, but the UI half is unverified.
5. **`subject_id` is not yet used by the UI.** The optional filters exist and are
   tested; no screen passes them until Phase 3.

## Fixture audit

**Removed:** none — no fixture drove production behaviour in the code touched.

**Remaining intentional fixtures:** unchanged from Gate 0/1. The prototype's
`prepData`, `QB`, `RMDATA`, `DR`, `IQ_DATA`, `SD_DATA` remain illustrative until
their owning phases.

**New fixture risk introduced: none.** Every value this phase added is either a
foreign key to a real row or NULL. `resolve_subject_id` returns None rather than
guessing, and the migration leaves unmatched rows NULL rather than filling them —
both are the *refusal* to invent data.

## Security

Unchanged posture; single-user local-first, as ruled in RISK-02 (revisit in a
later phase).

Two small improvements fall out of this phase:

- Questions are now bound to a preparation by foreign key rather than by string
  similarity, which removes a class of accidental cross-preparation data exposure
  — the single-user analogue of the object-level authorization §34 asks for.
- `POST /learning/attempts` cannot carry a result, and `PATCH` refuses to amend a
  committed prediction. A client cannot forge a correct answer after the fact,
  which matches the existing rule that a client cannot declare its own
  `exam_sessions.source`.

## Performance

The scoping change is **strictly cheaper**. It replaces an `OR` of up to 11
`ILIKE '%term%'` predicates — leading wildcards, which SQLite cannot index, so a
full table scan — with one indexed integer equality.

No N+1 introduced. `QuestionRepository._apply_filters` is shared by the page query
and its count, so both run the same single query shape.

Not measured under load; the performance gate is §33 and belongs to Phase 16.

## Assumptions carried, needing a ruling before Phase 9

`interview_questions` is left as a **global pool**, and `practice_recordings` is
scoped only through it. This was flagged in the Gate 0/1 report and is the one
open question from that set.

The reasoning for leaving it: a behavioural question ("tell me about a time you
disagreed with a manager") is genuinely preparation-agnostic, and forcing it into
one preparation would be wrong. **The attempt is the thing that belongs to a
preparation, not the question.** So the intended shape is
`practice_recordings.subject_id`, not `interview_questions.subject_id`.

Not implemented here because Phase 9 owns interviews and will know whether a
recording is made *within* a preparation or independently of one. Flagging rather
than guessing.

---

## Gate decision

# PASS

| Criterion | Status |
|---|---|
| Impact report written before the change (§7 Step B) | **Yes** |
| Migration additive, idempotent, new step (§7 Step C) | **Yes** |
| Migration validated — up, twice, fresh DB, seed (§7 Step D) | **Yes**, 8 tests |
| Migration down | **N/A** — no mechanism exists (RISK-01); substitute documented and tested |
| API audited before change (§8) | **Yes** |
| No duplicate API for an existing operation | **Yes** — reused `exam_sessions`, extended `/questions` and `/roadmaps` |
| No existing endpoint's default response changed | **Yes** |
| Test baseline not regressed | **Yes** — 465 → 494 |
| Every new value traceable (§37) | **Yes** — FK or NULL, never a guess |
| No fake interactions (§38) | **Yes** |

### Phase 3 is ready to start

Its scope, in order:

1. **Playwright** — approved. Needed before feature work so every later gate can
   report a real E2E line.
2. **`POST`/`PUT`/`DELETE /subjects`** — the largest remaining API gap; `prep-new`
   and `prep-edit` cannot exist without it. Note `exam_sessions.subject_id` is
   `SET NULL`, so deletion already preserves exam history.
3. **The shell** — 13-item sidebar, as ruled, plus the preparation picker that
   appears on every screen in the prototype.
4. **Wire the `subject_id` filters** built this phase into the Question Bank and
   Roadmap screens.
5. **The §9 isolation E2E**: select PSM I → observe → switch → verify everything
   changes → switch back → verify the original state intact.
6. **OpenAPI drift check in CI** (RISK-05).
