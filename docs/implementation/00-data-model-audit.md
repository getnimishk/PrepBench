# 00 — Data Model Audit

**Date:** 2026-09-12 · **Scope:** every table in `backend/app/models/`
**Purpose:** Answer plan §6's eight questions for each candidate entity *before*
any schema change. Nothing here proposes a migration; it establishes what exists.

---

## 1. Current schema — 24 tables

```
subjects                    the "preparation" entity
questions                   -> question_options
exam_sessions               -> exam_answers -> review_checks
spaced_repetition           SM-2 schedule, 1:1 with question
roadmaps                    -> roadmap_phases -> roadmap_topics
                            -> roadmap_resources
design_reviews              -> design_options
                            -> design_review_attempts
system_design_prompts       -> system_design_attempts
                            -> system_design_drafts
interview_questions         -> practice_recordings -> recording_analyses
llm_provider_config         -> llm_task_binding
app_settings                singleton, id=1
seeded_content              seed ledger, unique (namespace, content_key)
```

Foreign keys are enforced (`PRAGMA foreign_keys=ON`, applied to *any* engine via
`register_sqlite_pragmas`, including the test engine — a bug that was
specifically fixed and is worth not regressing).

---

## 2. "Preparation" is `subjects` — and its isolation is weaker than the plan assumes

The prototype's first-class **Preparation** is the existing `Subject` row.

```python
class Subject(Base):
    __tablename__ = "subjects"
    id, name (unique), slug (unique, indexed)
    kind          = Enum(SubjectKind)   # certification | skill
    certification = String(150), nullable, indexed
    pass_mark, exam_question_count, exam_minutes   # null for a skill
    display_order, created_at
```

`Subject.has_exam_profile` gates whether readiness is computable at all — a skill
has no pass mark and so *can never be "ready"*, only practised. That is a good
invariant and the plan's Phase 8 depends on it.

### The isolation problem — this is the crux of plan §2, §9, §24 and §32

Preparation scoping is **not uniformly enforced by foreign key**. Three different
mechanisms are in play:

| Entity | Scoped to preparation by | Strength |
|---|---|---|
| `exam_sessions` | `subject_id` FK (nullable, `ON DELETE SET NULL`) | **FK, but nullable** |
| `questions` | `Question.certification` **string match** to `Subject.certification` | **String** |
| `roadmaps` | *nothing* | **Unscoped** |
| `design_reviews` | `domain` string, resolved by `home_service._design_domain()` | **String** |
| `system_design_prompts` | `category` string | **String** |
| `interview_questions` | *nothing* — global pool | **Unscoped** |
| `practice_recordings` | via `interview_question_id` only | **Unscoped** |
| `spaced_repetition` | via `question_id` → question's certification | Inherited string |

`Subject.certification` carries an explicit comment explaining the string match:

> *"Matches `Question.certification` for a certification subject, so existing
> questions can be resolved to a subject without a data migration."*

That was a reasonable, documented trade. But plan §24 demands an automated E2E
proving **no leakage** across three preparations in scores, questions, roadmaps,
review, recommendations, practice history, analytics and evidence. A string match
cannot carry that guarantee: a renamed certification, a typo, or a question
carrying the default `certification="General Prep"` leaks silently and the test
would be asserting against the leak.

The prototype is candid that it inherited the same weakness, in a code comment on
`setContext()`:

> *"roadmaps are standalone in the schema, so they are scoped by roadmap, not
> preparation"*

**Conclusion:** preparation isolation is a **real schema gap**, not a UI gap. It
must be fixed in Phase 3 *before* Phases 4–13 build on top of it, or every
downstream isolation test is built on sand. The impact assessment for that change
is [02-preparation-isolation-impact.md](02-preparation-isolation-impact.md) —
**to be written as the first act of Phase 2, not now.**

---

## 3. Plan §6 candidate entities — existing / reusable / missing

Plan §6 lists ~50 conceptual entities and instructs: *"Do not automatically
create every entity."* Here is the verdict on each.

Legend: **EXISTS** (use as is) · **EXTEND** (reuse, add fields) · **DERIVE** (no
table needed — compute it) · **NEW** (genuinely missing) · **DECIDE** (needs a
product ruling first)

### Identity and preparation

| Plan entity | Verdict | Actual |
|---|---|---|
| `User` | **DECIDE** | No table. Single-user local app. See RISK-02 |
| `Preparation` | **EXTEND** | `subjects`. Needs create/update API (A-2) |
| `PreparationGoal` | **DERIVE** | `pass_mark` + `exam_*` columns already are the goal |
| `PreparationSettings` | **EXTEND** | `app_settings` is global; per-preparation settings would be new columns or a child table — defer until a real need appears |

### Roadmap and learning

| Plan entity | Verdict | Actual |
|---|---|---|
| `Roadmap` | **EXTEND** | `roadmaps`. **Missing `subject_id`** (A-3) |
| `RoadmapPhase` | **EXISTS** | `roadmap_phases` |
| `RoadmapTopic` | **EXISTS** | `roadmap_topics` — has `learning_objective`, `success_criteria`, `estimated_hours`, `status`, `progress_percentage`, `started_at`, `completed_at`, `evidence_notes` |
| `TopicResource` | **EXISTS** | `roadmap_resources` (roadmap-level table of columns/rows, not per-topic — check whether the prototype needs per-topic) |
| `TopicContent` | **NEW** | No structured study-guide entity. Only a Scrum-Guide RAG index (`backend/data/scrum_guide_index.json`) (A-5) |
| `TopicDemonstration` | **NEW** | No entity (A-6) |
| `TopicEvidence` | **EXTEND** | `roadmap_topics.evidence_notes` is free text. The prototype's evidence-gated completion needs a row per evidence event, not one text blob |

> **`roadmap_topics.status` already supports evidence-based completion** in shape:
> `PATCH /roadmaps/{id}/topics/{tid}` takes `status`, `progress_percentage` and
> `evidence_notes`, with `exclude_unset=True` semantics so a partial patch cannot
> clobber evidence. The plan's Phase 5 rule ("completion must not be a fake *Mark
> complete*") is a **service-layer rule to add**, not a new table: refuse the
> `completed` transition unless evidence exists.

### Questions

| Plan entity | Verdict | Actual |
|---|---|---|
| `Question` | **EXISTS** | `questions` |
| `QuestionOption` | **EXISTS** | `question_options` |
| `QuestionTag` | **EXISTS** | `questions.tags` JSON column. A separate table would be normalisation for its own sake at this scale |
| `QuestionSource` | **EXISTS** | `questions.source` String(200) |
| `QuestionVersion` | **DECIDE** | No versioning. Plan §12 lists `Version` under question CRUD. Cost is real (a history table + UI); value at single-user scale is unproven. Recommend **deferring** and recording as an explicit non-goal |

### Practice, review, exam

| Plan entity | Verdict | Actual |
|---|---|---|
| `PracticeSession` | **EXISTS** | `exam_sessions` with `session_kind` ('drill'/'mock') and `source` ('learner'/...). **Do not add a second session table** — this is exactly the duplicate the plan forbids |
| `PracticeAttempt` / `PracticeAnswer` | **EXISTS** | `exam_answers` (unique on `session_id, question_id`) |
| `ReviewItem` | **DERIVE** | `GET /review/queue` derives it from unreviewed `exam_answers`. No table needed |
| `ReviewSchedule` | **EXISTS** | `spaced_repetition` (SM-2: `repetition`, `interval_days`, `ease_factor`, `next_review_date` indexed) |
| `VerificationAttempt` | **EXISTS** | `review_checks` — `answer_id`, `question_id`, `selected_option_ids`, `passed`, `confidence_level`, `created_at` |
| `Exam` / `ExamAttempt` / `ExamAnswer` / `ExamResult` | **EXISTS** | `exam_sessions` + `exam_answers`; result fields live on the session (`score_percentage`, `is_passed`, `correct_count`) |

> The exam/practice/review triangle is **complete and 465-test covered**. Phases
> 7 and 8 are predominantly UI work plus the isolation fix.

### Interview

| Plan entity | Verdict | Actual |
|---|---|---|
| `InterviewRound` | **EXISTS** | `interview_questions.round_type` Enum |
| `InterviewQuestion` | **EXISTS** | `interview_questions` |
| `InterviewAttempt` | **EXISTS** | `practice_recordings` is the attempt |
| `Recording` | **EXISTS** | `practice_recordings` — `file_path` (relative), `mime_type`, `duration_seconds`, `file_size_bytes`. **Binary on disk, metadata in DB** — exactly what plan §15 asks for |
| `Transcript` | **EXISTS** | `recording_analyses.transcript` |
| `InterviewFeedback` | **EXISTS** | `recording_analyses` — `communication_scores` + `content_scores` JSON, `filler_word_count`, `summary`, `content_summary`, `analysis_status` |

### System design and design review

| Plan entity | Verdict | Actual |
|---|---|---|
| `SystemDesignPrompt` | **EXISTS** | `system_design_prompts` |
| `SystemDesignAttempt` / `Answer` / `Result` | **EXISTS** | `system_design_attempts` — one table holds answer + `category_scores` + `strengths` + `improvements` + `grading_status` |
| `SystemDesignRubric` | **EXISTS (in code)** | Rubric categories live in `system_design_service.py`, not a table. Fine — a rubric is code, not learner data |
| `SystemDesignDraft` | **EXISTS** | `system_design_drafts`, unique per prompt. **Autosave is already real** (plan §16 satisfied) |
| `DesignReview` / `DesignReviewAttempt` / `DesignReviewDecision` | **EXISTS** | `design_reviews` + `design_options` + `design_review_attempts` (`choice`, `justification`, `axis_verdict`, `feedback`, `grading_status`) |

> Plan §17's requirement — *"the deciding axis must be derived from the actual
> selected choice and submitted reasoning"* — **is already implemented.**
> `design_review_service._grade()` sends the learner's own choice and
> justification to the LLM, never tells the grader an option is "correct", and
> returns `not_graded` on every failure path.

### Sandbox

| Plan entity | Verdict | Actual |
|---|---|---|
| `SandboxExperiment` | **NEW** | Only in `localStorage` (A-1) |
| `SandboxAttempt` | **NEW** | Only in `localStorage` (A-1) |

The client-side shape already exists and is well factored
(`frontend/src/types/learning.ts`, `services/learning/attempts.ts`): `attemptId`,
`challengeId`, `conceptId`, `scenarioFingerprint`, `mode`, `startedAt`,
`prediction`, `committedAt`, `completedAt`, `correct`, `transfer`, `durationMs`,
`hintCount`, rubric coverage. **A backend table should mirror this shape**, so
the client change is a swap of the storage function, not a rewrite.

### Insight, recommendation, goals, notifications

| Plan entity | Verdict | Actual |
|---|---|---|
| `Insight` | **DERIVE** | `analytics_service` + `analytics_repository` compute from evidence. Plan §19 explicitly wants derivation, not storage. **Correct as is** |
| `Recommendation` | **DERIVE** | Same. `home_service` + `services/learning/recommendations.ts` derive on read |
| `DailyGoal` | **DERIVE + 1 column** | See §4 below |
| `DailyGoalProgress` | **DERIVE** | See §4 below |
| `Notification` | **NEW** | No entity. Prototype has a `notifications` screen (A-8) |
| `UserPreference` | **EXISTS** | `app_settings` |
| `AIProviderConfig` | **EXISTS** | `llm_provider_config` + `llm_task_binding` |
| `ImportJob` / `ImportRow` / `ImportError` | **DERIVE** | Import is synchronous: `validate` returns a structured report, `confirm` writes transactionally. No job table needed unless import becomes async. **Do not add one** |

---

## 4. Daily goals — derive, do not build a table

Plan §10 demands two standing daily goals with "their own persistence model if
the existing system does not already provide one". It does, almost entirely.

The prototype's own arithmetic (`todayStrip()`, lines 2756-2785):

```js
due   = QB.filter(qDue).length
goal  = Math.min(dailyCap, due + reviewedToday)
done  = Math.min(reviewedToday, goal)
iGoal = 1                       // flat interview target
iDone = Math.min(interviewToday, iGoal)
```

Mapped to production sources:

| Prototype value | Production source | Status |
|---|---|---|
| `due` | `GET /review/queue` → `total_unreviewed`, and `spaced_repetition.next_review_date <= now` | **EXISTS** |
| `reviewedToday` | `COUNT(review_checks WHERE created_at >= local_day_start)` | **DERIVE** |
| `interviewToday` | `COUNT(practice_recordings WHERE created_at >= local_day_start)` | **DERIVE** |
| `dailyCap` | — | **NEW: one column on `app_settings`** |
| `iGoal` | flat 1 | constant in code |

`backend/app/core/timeutils.py` **already provides exactly the helper needed**:

```python
utc_now_naive()                       # matches how columns are stored
to_local_date(naive_utc)
local_today()
local_day_start_as_naive_utc(day)     # <-- the daily-goal boundary
```

This matters: columns store **naive UTC**, but "today" must be the learner's
local calendar day. Commit `38a6348` ("Use local calendar dates for roadmap
scheduling") shows this trap has already been hit once. Use the helper; do not
write `date(created_at)` in SQL.

**Verdict: no `daily_goals` table, no `daily_goal_progress` table.** One additive
column (`app_settings.review_daily_cap`, default 40) plus two derived counts in
`home_service`. This satisfies plan §10's "own persistence model" honestly —
progress is recomputed from the evidence that caused it, which is strictly more
trustworthy than a counter that can drift from the rows it summarises.

The prototype's own caveat should be carried into the UI copy verbatim, because
it is true of the production implementation too:

> *"A flat daily target — there is no decay model yet, so nothing here can tell
> you which round has gone stale."*

---

## 5. Genuinely new tables — the complete list

Only these are missing, and each needs a §7 impact report before it is created:

| Table | For | Phase | Notes |
|---|---|---|---|
| `learning_attempts` | Sandbox + learning evidence | 5, 12 | Mirror `types/learning.ts`. Replaces `localStorage` |
| `topic_contents` | Study-guide sections | 5 | Sections, understanding checks, examples, common mistakes |
| `topic_demonstrations` | Demonstration + grading | 5 | Criterion, response, verdict, evidence link |
| `notifications` | Notifications screen | 14 | Lowest value; consider deferring |

Plus additive columns:

| Column | Table | Phase |
|---|---|---|
| `subject_id` FK | `roadmaps` | 3 |
| `review_daily_cap` | `app_settings` | 4 |
| `subject_id` FK (backfill from `certification`) | `questions` | 3 (see RISK-04) |

**Everything else in plan §6 already exists or should be derived.** That is 4 new
tables and 3 columns, against a list of ~50 candidate entities.

---

## 6. Indexes present

Already indexed: `questions.domain`, `.topic`, `.subtopic`, `.certification`;
`subjects.slug`, `.certification`; `exam_sessions.subject_id`, `.session_kind`,
`.source`; `exam_answers.first_answered_at` + unique `(session_id, question_id)`;
`spaced_repetition.next_review_date` (unique `question_id`);
`roadmap_topics.roadmap_id`, `.phase_id`; `design_reviews.domain`, `.axis_label`;
`recording_analyses.recording_id` (unique); `seeded_content.namespace`.

Per plan §33: **add no index without a query plan showing the need.** The
existing set covers the hot paths visible in the repositories.

---

## 7. Integrity behaviour worth preserving

- `exam_answers` unique `(session_id, question_id)` — prevents double-answer rows
- `ON DELETE CASCADE` throughout child tables, with FKs actually enforced in
  tests (see `test_database_pragmas.py`)
- `exam_sessions.subject_id` uses `SET NULL`, not `CASCADE` — deleting a
  preparation does **not** destroy its exam history. Deliberate; keep it
- `seeded_content` unique `(namespace, content_key)` — idempotent seeding
- `system_design_drafts` unique per prompt — one live draft, not a pile
