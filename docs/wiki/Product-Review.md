# Product Review

**September 2026.** A hard end-to-end review of the product, UX, frontend and backend, and what happened when its claims were checked against the database rather than the source.

This page is a record, not a specification. It is kept because the reasoning is more reusable than the conclusions, and because two of the review's headline recommendations turned out to be wrong in a way worth remembering.

## The verdict under review

The review's thesis was that PrepBench has *partially lost its innocence* — not because the system became sophisticated, but because **the system's sophistication became visible**. It identified two competing personalities:

> **The product being built:** a quiet personal learning instrument that happens to be intelligent.
>
> **The product the UI communicates:** a configurable preparation platform with dashboards, taxonomies, provider routing, progress systems, analytics, content operations and learning theory visibly laid out.

It proposed a *product-surface reduction pass* rather than a feature pass, and ranked as its top priority the addition of a single evidence-backed next action on Home.

The diagnosis is largely right. The priority order was not.

## What the database said

The review was argued entirely from source. Nothing in it was checked against `backend/data/exam_simulator.db`, and the database contradicts its two highest-priority recommendations.

### Every session is a drill

All thirteen sessions in the database have `session_kind = 'drill'`. There has never been a mock.

| Session | Date | Status | Answered | Score |
|---|---|---|---|---|
| 4 | 2026-08-07 | completed | 80/80 | 83.8 |
| 5 | 2026-08-10 | completed | 80/80 | 71.2 |
| 7 | 2026-08-10 | completed | 80/80 | 70.0 |
| 11 | 2026-08-21 | completed | 80/80 | 82.5 |
| 12 | 2026-08-31 | completed | 80/80 | 87.5 |
| 13 | 2026-08-31 | completed | 80/80 | 92.5 |

Six full 80-question PSM I papers across 25 days, against an 85% pass mark, with the last two clearing it. That is a genuine improvement arc and the strongest signal in the product.

Because every one is a drill:

- `SubjectRepository.get_mock_results` returns empty, so `readiness.compute` reports `needs_evaluation`
- `mock_totals()` returns `mock_count: 0`, `mock_accuracy: null`, `subjects_ready: 0`
- `unreviewed_count()` filters on `session_kind == MOCK` and returns **0**, against **119** unreviewed wrong answers that actually exist

> [!IMPORTANT]
> Home currently renders zeros and nulls in every field, on a database holding 549 answered questions. The review examined that layout and concluded it had too many metric cards. The operative problem is that **every card is empty**.

The cause is documented in [Readiness](Readiness#mocks-and-drills) and pinned by `test_every_session_the_api_creates_is_a_drill` in `test_e2e_regression.py`. Commit `c0618b7` added `session_kind` and `subject_id` to `ExamCreateRequest`, but **no screen sends either**. The seam is fixed at the API and still open at the browser.

### Usage is concentrated in one surface

Row counts per feature, at the time of review:

| Surface | Evidence of use |
|---|---|
| PSM I drilling | 6 full runs across 25 days — **sustained** |
| System design | 4 attempts inside one 38-minute window on 2026-08-11 |
| Interview practice | 1 recording and 1 analysis, both 2026-08-15 |
| Design review | 10 reviews seeded, 1 attempt, 2026-09-02 |
| Spaced repetition | 369 rows generated, 315 overdue, 0 consumed |
| Notes · bookmarks · LLM task bindings | **0 rows each** |

Almost every feature was used approximately once, on the day it was built. One surface has repeat usage.

### The evidence stream is contaminated

Three of the thirteen sessions are named `Repro`, `Randomize Options Regression Test` and `Skipped Answer Regression Test`. Two more are abandoned *All Topics* runs scoring 36.2 and 5.0. The question bank holds three `UnitTestCert-*` rows alongside 709 real PSM I questions.

Development artefacts sit in the working database, indistinguishable from learning evidence, and are averaged into every headline number.

> [!NOTE]
> A product built on the principle that evidence must be honest has no mechanism for saying *"that was not me studying"*. See [Philosophy](Philosophy#the-rules), rule 6.

## Claims that held

Confirmed against source, all worth acting on:

| Claim | Confirmed |
|---|---|
| `/dashboard` duplicates Home | `App.tsx:96` still routes `DashboardPage` alongside `HomePage` at `/` |
| The permanent *"100% Offline"* badge is inaccurate | The product ships an optional cloud provider path |
| *"Shuffle Answer Options"* implies behaviour that does not happen | Setting exists; the engine avoids mutating the ORM collection |
| System Design answers can be lost | `SystemDesignAnswerPage.tsx` holds answer text in local React state with no persistence or unload guard |
| Question option recreation can orphan historical answers | Deleting and recreating options leaves `selected_option_ids` pointing at rows that no longer exist |
| Exam certification matching is too fuzzy | `exam_engine.py` builds tokenised `ilike` conditions and can widen scope silently |
| Interview *"Save to bank"* contradicts the generated-question flow | Generated questions with `id === 0` cannot be practised |
| Home aggregates several legacy reporting APIs | There is no canonical current-learning-state projection |

## Claims that did not survive contact with the database

### The top priority could not have worked

The review's P0 was a single evidence-backed next action on Home, with the worked example *"Review your 6 unreviewed misses from your last mock."*

That recommendation cannot fire. There are no mocks, and the unreviewed-misses query returns zero.

More importantly, the ordering was self-defeating: the review ranked the decision layer **above** fixing the subject and evidence models it would have to read from. A recommendation computed over incoherent evidence is a *wrong* recommendation, and a wrong recommendation from a quiet coach is more corrosive than silence. The review's own best principle — never claim more than the evidence supports — argues against its own headline fix.

> [!IMPORTANT]
> Evidence integrity first. Decision layer second. This is the main lesson of the review.

### Subject-as-anchor generalises a model with one instance

The review ranked *"make subject the primary conceptual anchor"* as very-high-impact IA work.

There are three subjects. 709 of 712 questions belong to PSM I. Databricks and System Design hold no questions at all. Restructuring the information architecture around subjects is high-effort work to generalise an abstraction with exactly one populated member.

Deferred until a second subject has real content. Design for PSM I alone until then.

### Zero-row features should be deleted, not hidden

The review devoted a section to per-task LLM provider binding as internal architecture leaking into settings, and recommended hiding it behind *Advanced*.

`llm_task_binding` has **0 rows**. So do `user_notes` and `bookmarks`. These are not confusing; they are unused. Hiding preserves the maintenance and test surface while removing the only feedback that might eventually justify them.

**Delete, do not demote.**

## What the review missed

Three things, all higher-value than the layout critique:

1. **Readiness is currently producing a false negative.** Six full papers, two above the pass mark, reported as *"needs evaluation"*. This became [rule 6](Philosophy#6-absence-must-be-honest-in-both-directions).
2. **The contaminated evidence stream**, above. No mechanism distinguishes a regression test from a study session.
3. **The spaced-repetition backlog is a guilt mechanic.** 315 of 369 items overdue. The review recommended renaming *"Spaced Repetition"* to *"Review due"*; renaming a number that reads 315 does not help. A queue that can never be cleared is precisely the nagging that rule 5 exists to prevent. Cap it, or do not count it.

## Reframing the diagnosis

*"Did PrepBench lose its innocence?"* is an unfalsifiable question, which makes every answer a matter of taste. The falsifiable version is the usage table above, and it says something different from the review.

The problem is not that sophistication became visible. It is that **surface was built faster than it earned usage**, and the UI is an accurate reflection of that — nine things at equal weight, one of which is actually done.

That reframe matters because it changes the remedy from a design pass to a subtraction decision.

## Resulting order of work

1. **Send `session_kind` from `ExamSetupPage`.** Until a screen sets it, no mock can be started through the browser and readiness cannot leave `needs_evaluation` through normal use. Small change, blocks everything else.
2. **Decide what the six historical 80-question PSM runs are.** They were sat as full papers. If they count, readiness has six data points and reports honestly tonight rather than after three further sittings.
3. **Quarantine development artefacts** from evidence queries — the three named test sessions, the two abandoned runs, the `UnitTestCert-*` questions.
4. **Then** revisit Home, with fields that finally hold numbers. Much of the layout complaint may not survive seeing it populated.
5. Delete `/dashboard`, the offline badge, the shuffle setting, and the zero-row features.
6. Defer the IA restructure until a second subject has content.

> [!NOTE]
> Steps 1–3 are roughly an hour of work and constitute the cheapest available test of the entire review: open Home populated and see whether what remains is a design problem or was a data problem all along.

## Open questions

- **Is PrepBench being used, or built?** The usage pattern reads as builder, not learner. If PSM I is a real near-term goal, the order above holds. If PrepBench is the project and PSM I the occasion, the honest move is to pick the one surface with sustained usage and let the others sit.
- **Should rule 5 permit a single guided sentence?** The distinction between guidance and task management is agreed. Whether Home should state one evidence-backed recommendation remains undecided, and is now blocked behind steps 1–3 regardless.
- **Which outcomes deserve modelling beyond certification readiness?** See [Philosophy](Philosophy#what-the-product-is-for).

## See also

- [Philosophy](Philosophy) — the principles this review tested, including the rule it produced
- [Readiness](Readiness) — the mock/drill split at the centre of the findings
- [Architecture](Architecture) — where the affected services and tables sit
