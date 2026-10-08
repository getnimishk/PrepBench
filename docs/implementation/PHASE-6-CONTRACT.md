# Phase 6 contract: Workspace and Evidence

**Status: implemented 2026-10-08 on `feat/phase-6-workspace-evidence` (base `main` @ 19c335d, which
holds Phase 5, PR #76 and PR #77).**

Two product surfaces, kept distinct:

| Surface | Question it answers | Route | API |
|---|---|---|---|
| **Workspace** | Where is the work I created, investigated and kept? | `/workspace` | `GET /api/v1/workspace?subject_id=` |
| **Evidence** | What proves what I have actually demonstrated? | `/evidence` | `GET /api/v1/evidence?subject_id=` |

Both are **read models**. Neither stores anything. Every item is read from a row that already
exists, written by the feature that owns it, and links back to where it was made. Evidence is not a
ninth stage of the learning loop, and it is not readiness: "Am I ready to pass?" stays on
Certification, decided from full mocks only.

---

## 1. Audit: what already existed

| Area | Production state | Use in Phase 6 |
|---|---|---|
| Learning Lab outputs | `learning_attempts`: ADF lab runs (`ab:` uids, `adf.lab.*`), Lakehouse challenges (`lakehouse.*`), Chart Sandbox (no preparation) | Workspace (lab notebooks) and Evidence (graded stages) |
| Scenario outputs | `learning_attempts`: checks (`<pack>/<scenario>/check/<n>`, graded against the answer key) and lenses (`.../lens/<role>`, case notes + Say-it answer, not graded) | Workspace (case notes), Evidence (checks; lenses as completed) |
| Roadmap outputs | `topic_demonstrations` (written, **self-graded**), `topic_guide_sections` (`source` learner/ai), `roadmap_topics.evidence_notes`; owned through `roadmaps.subject_id` | Workspace (guides, notes), Evidence (demonstrations, as self-assessed) |
| Interview outputs | `interview_questions.prepared_answer` / `key_talking_points` (owned by `subject_id`, nullable), `practice_recordings` (owned only through their question), `recording_analyses` (AI) | Workspace (answers, recordings), Evidence (recordings, as completed) |
| Certification outputs | `exam_sessions` (`session_belongs_to`), readiness engine | Evidence: completed full mocks only. Drills are practice, never readiness, and are left out |
| System design / design reviews | `system_design_attempts`, `system_design_drafts`, `design_review_attempts`: **no `subject_id`** | No-preparation scope only (see 3) |
| Lakehouse journal | `lab_journal_entries`: no `subject_id`, stores engine ops | Not used: it is an engine log, not learner work |
| Navigation | Groups "Evidence" (Insights) and "Workspace" (My Preparations, Settings) already existed; `capabilities.workspace` / `.evidence` flags existed | One entry added to each group |
| Prototype | `workspaceStore.ts` / `evidenceStore.ts`: `localStorage`, `isSeed: true` | **Not used.** No seed, no browser store |

Reused as-is: `learning_attempts` + LearningService scope rule, roadmap/interview/exam tables,
`session_belongs_to`, `ContentPackService` pack store (scenario titles), PreparationContext,
capability profile, UI primitives. Small extension: `LearningAttemptRepository.list_in_scope`.
New: two read services, two GET endpoints, two pages, two nav entries. **No schema change, no new
table, no migration.**

## 2. Source of truth

- No second learning state. Workspace and Evidence never write. There is no workspace or evidence
  table, no browser store, nothing seeded.
- An item's level is computed from the row on every read, so it can never disagree with the feature
  that owns the row.
- Titles: scenario titles come from the content pack, topic titles from the roadmap, question text
  from the interview question. Lab experiment and Lakehouse challenge titles come from the
  frontend registries that already name them (`ADF_LAB_EXPERIMENTS`, Station C/F).

## 3. Scope (preparation isolation)

One rule, the same as `learning_attempts` (pre-Phase-6 hardening):

- `?subject_id=N` returns only what preparation N owns. N must exist (404 otherwise, like Home's
  endpoints).
- Omitted `subject_id` is **no preparation**: only work that belongs to none. Never "any
  preparation", never a fallback to PSM I or ADF.

What "owns" means, per source:

| Source | Owned by preparation N when |
|---|---|
| learning attempt | `learning_attempts.subject_id = N` |
| topic demonstration / guide section / topic note | its roadmap's `subject_id = N` |
| interview prepared answer | `interview_questions.subject_id = N` |
| recording | its interview question's `subject_id = N` |
| mock exam | `session_belongs_to(N)` (the Certification hub's definition) |
| system design, design review | never: they have no owner, so they appear only with no preparation |

A deleted preparation's rows are set to NULL by their foreign keys, so its work moves to the
no-preparation scope and never shows under a new preparation that reuses its id. Exam sessions are
deleted with their preparation and are never in the no-preparation scope.

## 4. Workspace

Learner-made work, newest first, each with a link to continue it where it lives:

| Kind | From |
|---|---|
| `lab_run` | ADF lab: one item per run (prediction, lever changes, observation, explanation) |
| `lakehouse_challenge` | Lakehouse: one item per challenge attempt with a committed prediction |
| `scenario_notes` | Scenario lens: case notes and Say-it answer |
| `interview_answer` | An interview question with a prepared answer |
| `recording` | A practice recording |
| `topic_guide` | One item per roadmap topic with guide sections (learner-written and AI drafts counted apart) |
| `topic_note` | `roadmap_topics.evidence_notes` |
| `system_design_answer` | System design attempt or saved draft (no preparation only) |
| `design_review_call` | Design review choice and justification (no preparation only) |
| `sandbox_run` | Chart Sandbox attempt with a committed prediction (no preparation only) |

Nothing is listed only because a page was visited: a lab attempt needs at least a committed
prediction.

## 5. Evidence

### 5.1 Levels

| Level | Meaning | Rule |
|---|---|---|
| `activity` | The learner started something | Attempt opened or prediction committed, not finished |
| `completed` | A defined activity was finished | Finished, but not graded correct (wrong, not graded, self-graded, AI-graded) |
| `demonstrated` | A graded outcome was correct | `correct = true` against the model or answer key; a full mock at or above its pass mark |
| `evidenced` | Demonstrated, and a persisted artifact supports it | Demonstrated **and** (`transfer = true` **or** the learner's own explanation is recorded) |

`assessed_by` says who judged it: `model` (lab simulation or engine), `answer_key` (scenario check),
`exam` (mock), `self` (topic demonstration), `ai` (recording or system design analysis),
`not_assessed`. Self- and AI-assessed work is never above `completed`: it is not validated. A mock
is never above `demonstrated`, and Evidence never states a readiness verdict.

### 5.2 Sources

- Learning attempts (ADF lab stages, Lakehouse, scenario checks and lenses, Chart Sandbox): by 5.1.
- Topic demonstrations: `completed`, self-assessed, with the grade named.
- Full mocks (completed, learner): `demonstrated` at or above the preparation's pass mark,
  `completed` below it or with no pass mark (said so). The preparation's `pass_mark` is the one the
  readiness engine judges every mock by, not the mark a session stored when it was sat. Evidence
  never calls a mock passed that Certification calls failed, or the other way round.
- Recordings: `completed`; AI analysis status is named, not counted as proof.
- System design attempts and design review calls (no preparation only): `completed`; their grading
  status is named.
- Drills, question-bank browsing, page visits: not evidence, not listed.

## 6. UI

- Both pages read the selected preparation from PreparationContext and request that scope. A second
  panel, "Not tied to a preparation", requests the no-preparation scope separately and is labelled
  as such. It is never merged into the preparation's own list.
- No preparation chosen: the pages say so and show only the no-preparation panel.
- Capability: the routes honour `capabilities.workspace` / `capabilities.evidence` (the sidebar
  already does). Empty states name real actions, offered only when the preparation has the
  capability.

## 7. Known limitations

- System design attempts, drafts and design review attempts have no `subject_id`, so they cannot
  be shown under the System Design preparation. Giving them an owner is a schema change and was not
  made in this phase.
- Practice recordings of library questions (no `subject_id`) are in the no-preparation scope.
- Lakehouse journal entries are not shown (engine log, no owner).
- Topic demonstrations are self-graded, so they never count above `completed`.
