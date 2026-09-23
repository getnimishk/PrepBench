# Phase 10 Gate Report — System Design

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

---

## Implemented

The plan's chain is prompt → requirements → architecture → data model → failure handling → trade-offs → submit → rubric grading → result → improvement → retry. It now runs as a real flow.

### The answer, in sections, really autosaved

- The answer page has **five fields** in that order: *Requirements & scale assumptions*, *High-level architecture*, *Data model & storage*, *Failure handling*, *Trade-offs*. Before, there was a single box.
- **Every field is saved to the database as you type.** The page says when it last saved and "N of 5 sections written". Reopening restores every field. This was checked in a browser across a real reload.
- **"Revise your answer" starts from your last attempt's sections**, not blank boxes.
- An answer written before sections existed isn't lost: it's shown for reference above the fields.
- The grader still reads one answer. The server joins the sections under their headings, so the rubric sees the shape you wrote.

### Result → improvement → retry

- The result is **the submitted attempt's own**: its sections are shown, and empty ones say "Not written."
- **Improve next**: the grader's first improvement, the lowest-scored rubric category with its %, and *Revise your answer*.
- **Not graded** (no AI provider, or grading failed) shows *Settings* and **Grade again**. Grading again never changes the answer. An attempt that is already graded keeps its grade: a new grade needs a new attempt.
- The existing *Your attempts at this prompt* comparison stays. It shows change only between graded attempts.

## Files changed

**Backend** — new `services/system_design_sections.py` · `models/system_design_attempt.py`, `models/system_design_draft.py`, `core/database.py` (migration), `schemas/system_design.py`, `services/system_design_service.py` (grading moved into one `_apply_grading` used by submit and grade-again), `api/v1/system_design.py`

**Frontend** — new `services/systemDesignSections.ts` · `pages/SystemDesignAnswerPage.tsx` (rewritten), `pages/SystemDesignResultsPage.tsx`, `services/api.ts`, `types/systemDesign.ts`

## API changes (additive)

| Endpoint | Change |
|---|---|
| `PUT/GET /system-design/prompts/{id}/draft` | optional `sections` (unknown section names → 422); `answer_text` is built from them |
| `POST /system-design/attempts` | optional `sections`; `answer_text` no longer required when sections are sent; an empty answer → 400 "nothing to grade" (was 422) |
| `POST /system-design/attempts/{id}/grade` | **new** — grade an ungraded attempt; 409 once graded |
| attempt responses | add `sections` |

## DB changes

Nullable `sections` JSON column on `system_design_attempts` and `system_design_drafts`. Additive; old attempts keep their single `answer_text`. The migration is tested on a pre-Phase-10 database with an existing row, for idempotency, and for parity with a fresh database.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 620 | **629** (+9: sections saved and restored; unknown section refused; grader receives headed sections; empty answer refused; grade-again without a provider invents nothing, then grades, keeps the answer, 409 once graded; retry starts from the last attempt; old answers still whole; migration) |
| Frontend unit | 537 | **543** (+6: five sections in order; each saved and counted; old answer kept in view; answer shown by section; grade again then "Improve next" and revise link; failed grade-again reported without a score) |
| E2E | 25 | **26** (+1: write sections, wait for "Saved", **reload and see them restored**, submit, "Not graded", grade again (still no score), revise from the attempt, second attempt compared) |

Typecheck and lint clean.

## Failures during the phase

- A patch stopped partway on a comment line; the rest was applied and checked.
- A test-editing script turned two `\n` escapes into real line breaks; fixed.

## Known limitations

- **No diagram input.** The answer is text in five sections.
- **The rubric's six categories are the grader's**, not the five sections; they overlap but don't map one to one.
- **Graded answers need a provider.** The browser test covers the no-provider path; grading is covered by backend tests with a faked provider.

## Fixture audit

No placeholder numbers. The prototype's hard-coded "8.1 / 10" result is replaced by the attempt's real grade, or "Not graded".

## Security

Single-user by your decision. Section names are validated, and grading again can't overwrite a grade.

## Gate decision

**PASS.** Phase 10 is complete. Next: Phase 11, Design Reviews.
