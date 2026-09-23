# 02 — Phase 2 Change Impact Report

**Format:** plan §7 Step B (DB) and §8 (API) · **Date:** 2026-09-12
**Status:** written *before* any schema change, as §7 requires.

Phase 2 makes four changes. Each is assessed separately.

| # | Change | Kind |
|---|---|---|
| 2.1 | `questions.subject_id` — FK, backfilled | Additive column |
| 2.2 | `roadmaps.subject_id` — FK, backfilled | Additive column |
| 2.3 | `app_settings.review_daily_cap` | Additive column |
| 2.4 | `learning_attempts` — new table | New table |

Deliberately **not** in Phase 2: `topic_contents` and `topic_demonstrations`.
Designing those without the `guide` and `topic-demonstrate` screens' real
requirements would be speculative. They belong to Phase 5, alongside the screens
that define their shape.

---

## 2.1 `questions.subject_id`

### Why the change is needed — with proof

Plan §2 requires complete preparation isolation; §8 forbids "AWS selected + PSM
question set"; §24 requires an automated E2E proving no leakage.

Today a question is resolved to a preparation by **fuzzy string matching**.
`ExamEngine.create_exam` (`exam_engine.py:76-93`) builds an `OR` of:

```python
Question.certification == cert_val
Question.certification.ilike(f"%{cert_val}%")
Question.domain.ilike(f"%{cert_val}%")          # domain, not certification
for t in tokens:                                 # split on space/hyphen/colon/parens
    Question.certification.ilike(f"%{t}%")
    Question.domain.ilike(f"%{t}%")
```

For `"PSM I - Professional Scrum Master"` the tokens are `PSM`, `Professional`,
`Scrum`, `Master`. So **any question in any preparation whose certification *or
domain* contains the word "Professional" or "Master" is a candidate for a PSM I
mock.**

This is not hypothetical. `backend/tests/test_preparation_isolation.py` was
written to demonstrate it and does:

```
AssertionError: A PSM I mock drew questions from another preparation:
['Databricks Certified Data Engineer Professional', 'PSM I - Professional Scrum Master']
```

The existing suite does not catch this because
`test_product_invariants.py::_cert()` deliberately returns a collision-proof
random token, and says so:

> *"One unbroken token, so another test's certification cannot match it through a
> shared word — create_exam splits on punctuation and ILIKEs every piece."*

That is a sound way to keep those tests independent, but it means the whole suite
runs on names that cannot collide, so the matching rule that real certification
names hit is never exercised.

**A second leak, same cause:** a *skill* subject has `certification = None`
(`seed_subjects.py` — Databricks and System Design both). With no certification
string, `certification_conditions` stays `None`, no question filter is applied,
and a drill on a skill subject draws from **every question in the database**. The
prototype's own fixture says Databricks has `questions: 0`; the production
behaviour is that it silently has all of them.

### Existing structure

```python
class Question(Base):
    __tablename__ = "questions"
    domain        = Column(String(150), index=True, nullable=False, default="General")
    topic         = Column(String(150), index=True, nullable=False, default="General")
    certification = Column(String(150), index=True, nullable=False, default="General Prep")
```

`Subject.certification` is `String(150)`, nullable, indexed, with the comment:
*"Matches `Question.certification` for a certification subject, so existing
questions can be resolved to a subject without a data migration."*

### Gap

There is no foreign key from a question to the preparation that owns it. Ownership
is inferred from English words.

### Proposed structure

```python
subject_id = Column(
    Integer,
    ForeignKey("subjects.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
)
```

`SET NULL`, not `CASCADE`: deleting a preparation must not destroy the learner's
question bank. This matches the precedent already set by
`exam_sessions.subject_id`.

**Nullable on purpose.** A question that belongs to no preparation (e.g. the
default `certification="General Prep"`) is a real state, and inventing an owner
for it would be exactly the kind of silent guess this change exists to remove.

### Migration strategy

A new numbered step in `apply_lightweight_migrations()`:

1. `PRAGMA table_info(questions)` — skip if `subject_id` is present
2. `ALTER TABLE questions ADD COLUMN subject_id INTEGER REFERENCES subjects(id)`
3. `CREATE INDEX IF NOT EXISTS ix_questions_subject_id ON questions(subject_id)`
4. Backfill (below)

Additive and idempotent. No existing step is edited.

> SQLite cannot add a column *and* an `ON DELETE` action to an existing table in
> one statement; the FK clause in `ADD COLUMN` records the reference, and the
> `SET NULL` behaviour applies to rows inserted after. This asymmetry between a
> fresh `create_all` database and a migrated one must be tested for, and is —
> see Test impact.

### Backfill strategy

**Exact match only.** For each subject with a non-null `certification`:

```sql
UPDATE questions SET subject_id = :sid
 WHERE subject_id IS NULL AND certification = :cert
```

Exact equality is the *safe half* of the current matching rule — it is what the
`seed_subjects.py` comment relies on when it says "700-odd existing questions
resolve to this subject". The fuzzy half is the leak, so it takes no part in the
backfill.

**Anything unmatched stays NULL and is reported, never guessed.** The migration
logs a count of questions left unowned, grouped by `certification`, so the
operator can see exactly what did not resolve rather than discovering it later as
a missing question bank.

### Rollback strategy

Revert the code. The column becomes inert; no query reads it, and `create_all`
leaves it in place harmlessly. No data is lost because nothing is overwritten —
the `certification` string column is untouched and still authoritative for the
legacy path. **This is the property that makes the change safe without a
down-migration** (RISK-01).

### API impact

| Endpoint | Change | Compatibility |
|---|---|---|
| `POST /exams` | When `subject_id` is supplied, candidates are filtered by `Question.subject_id == subject.id` instead of by fuzzy string | **Behaviour change, intended.** The frontend sends only `subject_id` (`ExamSetupPage.tsx:118,132`) — verified — so this is the live path |
| `POST /exams` with `certification` string and no `subject_id` | **Unchanged.** Keeps the lenient fuzzy match | No production caller uses it; `test_product_invariants.py` does |
| `GET /questions` | New **optional** `subject_id` query param. Default unfiltered | Additive |
| `POST`/`PUT /questions` | Accept optional `subject_id` | Additive |
| Question responses | Gain a `subject_id` field | Additive; frontend tolerates extra fields |

Per the api-audit's rule: **no existing endpoint's default response set changes.**
The new scoping arrives as an optional parameter.

> The two paths are deliberately asymmetric and that asymmetry must be
> documented in the code: **`subject_id` is precise and authoritative; the
> `certification` string is lenient and legacy.** A caller that wants isolation
> sends a subject.

### Query impact

`find_for_exam` gains an optional `subject_id` filter. When it is used, the `OR`
of up to 11 `ILIKE` predicates is replaced by one indexed integer equality —
**strictly cheaper**, and it removes a full-table scan driven by leading-wildcard
`LIKE` patterns, which SQLite cannot index.

### Performance / index impact

One new index on `questions(subject_id)`. Justified by the query above being on
the exam-creation hot path, not added speculatively.

### Test impact

| Test | Effect |
|---|---|
| `test_preparation_isolation.py` (new, 3 tests) | **Currently red; must go green** |
| `test_product_invariants.py::test_a_mock_takes_its_scope_from_the_subject_alone` | Must stay green. Uses `subject_id`, so it moves onto the FK path — needs its questions bound to the subject |
| `test_product_invariants.py` string-path tests | Must stay green, unchanged |
| `test_questions.py`, `test_e2e_*` | Must stay green |
| New | Migration idempotency (run twice), fresh-`create_all` parity, backfill correctness, unmatched-report presence |

---

## 2.2 `roadmaps.subject_id`

### Why

Plan §2 requires a preparation-owned roadmap. The prototype admits the gap in
`setContext()`: *"roadmaps are standalone in the schema, so they are scoped by
roadmap, not preparation."* `RoadmapListPage` shows every roadmap regardless of
the selected preparation.

### Existing structure / gap

`roadmaps` has `title`, `description`, `source_filename`, `start_date`,
`weekly_hours_budget`, `is_archived`. **No link to a subject.**

### Proposed structure

```python
subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"),
                    nullable=True, index=True)
```

### Backfill strategy

**No heuristic.** Unlike questions, there is no existing column that encodes
which preparation a roadmap belongs to — matching on title words would be the
same class of guess this phase is removing. All existing roadmaps therefore keep
`subject_id = NULL`, and:

- A NULL-subject roadmap is treated as **unassigned**, shown in a clearly labelled
  "Not linked to a preparation" group rather than hidden
- `PUT /roadmaps/{id}` accepts `subject_id`, so a learner assigns it in one click
- `POST /roadmaps` and roadmap import accept `subject_id`

Hiding them would lose the user's imported roadmaps from view, which is worse than
an explicit unassigned state.

### API impact

| Endpoint | Change |
|---|---|
| `GET /roadmaps` | New **optional** `subject_id` param; default returns all, as now |
| `POST /roadmaps`, `PUT /roadmaps/{id}` | Accept optional `subject_id` |
| `POST /roadmaps/import/confirm` | ~~Accepts optional `subject_id`~~ **Not implemented — correction.** The import endpoint was left unchanged. The Roadmaps screen links an imported roadmap to the current preparation straight after import with `PUT /roadmaps/{id}`, and reports it if that step fails (Phase 3). |
| Roadmap responses | Gain `subject_id` |

`test_roadmaps.py` is 662 lines and must stay green — which the optional-param
approach guarantees.

### Rollback

Revert the code; the column goes inert. No data loss (nothing was backfilled).

---

## 2.3 `app_settings.review_daily_cap` — DEFERRED to Phase 4

> **Outcome: not implemented in Phase 2.** Two corrections to this section came
> out of building it, and together they moved the change to Phase 4.
>
> **Correction 1 — the default.** This section claimed 40 "matches the prototype's
> default and the existing `DAILY_REVIEW_CAP` constant in `api/v1/review.py`". The
> constant is **20**, not 40, and it carries a reason the prototype's fixture does
> not: *"Twenty wrong answers, read properly, is a real evening; it is also the
> point past which people stop reading and start clicking."* The reasoned value
> wins over a number in a fixture.
>
> **Correction 2 — and the reason for deferring.** Nothing in Phase 2 would
> actually *read* the column. Home's daily goal is Phase 4 and Review is Phase 7.
> Adding a column now would mean shipping the exact thing the guard test below
> exists to prevent, with a code comment promising a future reader. The six dead
> columns were dropped *because nothing read them*; a seventh added on a promise
> is the same mistake with better intentions.
>
> `app_settings` therefore gained nothing in Phase 2, and the model carries a
> comment recording where the column belongs and why it is not there yet. The
> analysis below stands as written and is the plan for Phase 4.
>
> One extra finding for Phase 4: `GET /review/queue` bounds `limit` **at the
> route** (`Query(DAILY_REVIEW_CAP, ge=1, le=DAILY_REVIEW_CAP)`), and
> `test_review_experience.py::test_the_cap_cannot_be_argued_upwards_by_the_caller`
> asserts those exact bounds by inspecting the signature — *"a default is a
> suggestion … the first thing anyone builds on top of a review API is a 'show
> all'."* A learner-editable cap cannot be a static `le=`, so Phase 4 must keep a
> static absolute ceiling **and** clamp to the stored cap in the handler, then
> update that test to assert both halves. The clamp is strictly stronger than the
> static bound, because the stored cap can be lower.

### Why

The prototype's certification daily goal is
`min(dailyCap, due + reviewedToday)`, and `dailyCap` is learner-editable on
`settings-practice`. Decision recorded: the prototype's daily goals are adopted.

### The history that must not be repeated

`app_settings` **used to have `daily_practice_goal`** and it was deliberately
dropped. The model records why:

> *"Six columns stood here and every one of them was a control whose only effect
> was to be saved … `daily_practice_goal` went with the streak and the goal ring."*

Two guard tests enforce that disposition:

- `test_the_dead_settings_columns_are_gone_from_the_table` asserts the **exact**
  column set is `{id, theme, timer_sound_enabled, initial_seed_completed,
  default_target_role}`
- `test_nothing_in_the_application_reads_a_dead_settings_column` greps the whole
  `app/` tree for the six dead names

Both will need updating, and **that is the guard working as designed, not an
obstacle.** The distinction that justifies the update:

> `daily_practice_goal` was dropped because **nothing read it**.
> `review_daily_cap` will be read by `HomeService` on every Home request and will
> change what the learner is shown.

A control whose only effect is to be saved is furniture. This one has an effect.

**The old name is not resurrected.** `review_daily_cap` is a new name,
deliberately, so the dead-name grep stays meaningful and the history stays
legible.

### Proposed structure

```python
review_daily_cap = Column(Integer, nullable=False, default=40, server_default="40")
```

40 matches the prototype's default and the existing `DAILY_REVIEW_CAP` constant
in `api/v1/review.py`, which already caps `GET /review/queue`. **The constant and
the column must not disagree** — the column becomes the source and the endpoint
reads it.

### Migration / backfill / rollback

Additive column with a server default, so existing rows get 40 without an
`UPDATE`. Rollback is a code revert; the column goes inert.

### API impact

- `GET /settings` and `PUT /settings` gain `review_daily_cap`. This breaks
  `test_the_settings_api_exposes_only_the_settings_that_do_something`, which
  asserts an exact body set — update it deliberately.
- `GET /review/queue`'s `limit` ceiling becomes the stored cap rather than a
  module constant.
- `GET /home` gains the daily-goal group (see §2.5).

### Test impact

Update the two guard tests and the settings API test. Add: cap is respected by
`/review/queue`, cap bounds are validated (1–200, matching the prototype's clamp),
and the daily goal reflects a changed cap.

---

## 2.4 `learning_attempts` — new table

### Why

Plan §6: *"Do not rely on browser `localStorage` as the system of record for
production data."* `frontend/src/services/learning/attempts.ts` does exactly that
under key `prepbench.learning.attempts.v1`, and it is the evidence substrate for
mastery, placement, recommendations and the entire 932-line `ChartSandboxPage`.

The file's own comment anticipates this change:

> *"the storage boundary is deliberately thin so a later move to the backend
> touches this file and nothing else."*

### Proposed structure

Mirrors `frontend/src/types/learning.ts::Attempt` field for field, so the client
change is a swap of two functions rather than a reshape:

```python
class LearningAttempt(Base):
    __tablename__ = "learning_attempts"

    id                     = Integer PK
    attempt_uid            = String(64), unique, indexed   # client-generated uuid
    subject_id             = FK subjects.id, SET NULL, nullable, indexed
    challenge_id           = String(100), indexed
    concept_id             = String(100), indexed
    scenario_fingerprint   = String(200)
    mode                   = String(20)                    # guided | ...
    started_at             = DateTime, not null
    committed_at           = DateTime, nullable
    completed_at           = DateTime, nullable
    prediction             = String(100), nullable
    explanation_mechanisms = JSON, default list
    selected_alternatives  = JSON, default list
    rubric_coverage        = JSON, default dict
    correct                = Boolean, nullable
    transfer               = Boolean, nullable
    hint_count             = Integer, default 0
    duration_ms            = Integer, nullable
    created_at             = DateTime
```

Notes on shape:

- `attempt_uid` carries the client's UUID so an offline-created attempt keeps its
  identity when it reaches the server — and makes the write **idempotent**, which
  plan §8 requires.
- `correct` and `transfer` are **nullable on purpose.** An uncommitted attempt has
  nothing to be right or wrong about, and `completeAttempt()` already refuses to
  score one. NULL is the honest representation; a default of `false` would invent
  a wrong answer.
- **Mastery, placement and recommendations are still derived on read and never
  stored.** That is the existing design and it is correct — the rules can be
  revised without migrating anyone's history.

### Migration / rollback

New table, so `create_all` covers a fresh database and a `CREATE TABLE IF NOT
EXISTS`-guarded step covers an existing one — the same pattern as the existing
`review_checks` and `system_design_drafts` steps. Rollback: revert the code; the
table is orphaned but harmless.

### API impact — new endpoints

| Endpoint | Purpose |
|---|---|
| `POST /learning/attempts` | Create or upsert by `attempt_uid` (idempotent) |
| `PATCH /learning/attempts/{uid}` | Commit / complete transitions |
| `GET /learning/attempts` | List for mastery derivation; optional `subject_id`, `concept_id` |

A new router is justified here rather than an extension: no existing router owns
the learning domain, and folding it into `/roadmaps` or `/questions` would put an
unrelated concern behind an existing resource.

### The rule that must survive the move

`services/learning/integrity.test.ts` (494 lines) and
`services/metrics/invariants.test.ts` (547 lines) guard the honesty of this model —
above all that **a prediction cannot be amended after the outcome is visible**:

> *"an amended prediction after seeing the outcome is hindsight wearing a
> prediction's clothes, and it would quietly turn every accuracy number in the
> product into a measure of nothing."*

`commitPrediction()` enforces it client-side. **The server must enforce it too**:
`PATCH` must refuse to change `prediction` or `committed_at` once set. A rule
enforced only on the client is not enforced. Both test files must pass unchanged
against the new backing, and a server-side test must cover the refusal.

---

## 2.5 Daily goals — no schema beyond 2.3

Recorded here because plan §10 asks for a persistence model and the answer is
"derive it".

| Value | Source |
|---|---|
| `due` | `spaced_repetition.next_review_date <= now` + unreviewed `exam_answers` |
| `reviewedToday` | `COUNT(review_checks WHERE created_at >= local_day_start)` |
| `interviewToday` | `COUNT(practice_recordings WHERE created_at >= local_day_start)` |
| `dailyCap` | `app_settings.review_daily_cap` (§2.3) |
| interview target | flat 1, a constant in code |

**Use `timeutils.local_day_start_as_naive_utc()`.** Columns store naive UTC but
"today" is the learner's local calendar day. Commit `38a6348` ("Use local calendar
dates for roadmap scheduling") shows this trap has already been hit once. Never
write `date(created_at)` in SQL.

Deriving rather than storing means progress is recomputed from the evidence that
caused it and cannot drift from the rows it summarises — strictly more trustworthy
than a counter, and it satisfies §10 honestly.

---

## Summary

| Change | Tables | Reversible without down-migration? | Status |
|---|---|---|---|
| 2.1 `questions.subject_id` | 1 col + 1 index | Yes — revert code, column inert | **Done.** Fixed 2 proven leaks |
| 2.2 `roadmaps.subject_id` | 1 col + 1 index | Yes | **Done** |
| 2.3 `review_daily_cap` | 1 col | Yes | **Deferred to Phase 4** — no reader yet |
| 2.4 `learning_attempts` | 1 table | Yes — table orphaned | **Done** (backend; client swap is Phase 12) |

No column is dropped. No column is renamed. No type changes. No existing
migration step is edited. No existing endpoint's default response changes.

---

## Unplanned changes this phase made, and why

Two things came out of implementation that this report did not anticipate. Both
are recorded here rather than left to be found in a diff.

### The exam-profile check moved earlier

`ExamEngine` refused a mock on a subject with no exam profile *after* selecting
questions, with a comment explaining that the ordering let a too-small bank fail
there too. That reasoning applies to the **length** check, which needs the
selection; it does not apply to the **profile** check, which is a fact about the
subject.

The ordering stopped being harmless the moment a named subject scoped by
`subject_id`: a skill subject owns no questions, so *"No questions match those
filters — widen the selection"* fired first and sent the learner off to change a
filter when the real answer was that a skill has no pass mark. Same refusal, same
status code, wrong reason. The two checks are now split —
`_refuse_mock_without_a_profile` runs before the bank is touched, the length check
stays after selection.

Caught by `test_product_invariants.py::test_a_mock_without_an_exam_profile_is_refused`,
which asserts on the message and not merely the status.

### Two message improvements that the scoping change made necessary

1. **The no-match refusal now names the preparation, not its certification
   string.** `_describe_filters` was given `subject.certification`; with a subject
   scope there is no certification to pass, and quoting one at the learner was
   never right anyway — they chose a preparation from a picker and have very
   likely never seen that text.

2. **A preparation with no question bank gets its own refusal.** *"Widen the
   selection"* is not advice anyone can act on when there is no filter to loosen.
   `QuestionRepository.count_for_subject` distinguishes the two cases, and the
   message says to import a bank. This is the normal state of a newly added
   preparation, so it is the first thing many people will see.

### One small refactor

`QuestionRepository.get_all` and `.count` each carried their own copy of the
listing filters. Adding `subject_id` would have made a third copy of a set that
must agree between a page and its total — the failure mode being "1 of 340
questions" over a table of twelve, with nothing obviously wrong in either
function. Extracted to `_apply_filters`.
