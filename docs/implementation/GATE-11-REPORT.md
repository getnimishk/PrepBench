# Phase 11 Gate Report — Design Reviews

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

---

## Audit first

The plan's chain is scenario → options → choice → justification → commit → reveal deciding axis → compare reasoning → feedback → next exercise. Most of it was already real:

- options with *holds when / breaks when / rough cost*;
- "ask first" as a genuine third answer;
- a required justification (and for "ask first", it must name the question);
- the commit is saved before the reveal.

**The deciding-axis verdict** (named / partly / missed) is produced by AI from **your actual choice and reasoning**. Nothing static stands in for it: without a provider there is no verdict. The reveal text (the axis, what separates the options, what the strongest answer asks) belongs to the scenario and shows either way.

## Implemented (the gaps)

- **Grade again.** A commit made with no AI provider (or a failed grading) showed only "Not graded". It now explains that and offers *Settings* and **Grade again**. Grading again seeks a verdict for the same choice and reasoning without changing them. An attempt that already has a verdict keeps it (409).
- **Compare your reasoning.** What you said (your choice and justification) now sits side by side with what the strongest answer asks.
- **Next review** goes straight to the next scenario you haven't attempted, then simply the next one along, instead of back to the list. *Try again* and *All reviews* remain.

### Bug found and fixed

"Next review" at first opened on the **previous review's result**. The page stays mounted when only the review number in the address changes, so the old attempt stayed on screen and there was nothing to commit. The browser test caught it. The page now resets when the review changes, and the unit test now checks for the commit button too.

## Files changed

**Backend** — `services/design_review_service.py` (`regrade_attempt`), `api/v1/design_review.py`

**Frontend** — `pages/DesignReviewPage.tsx`, `services/api.ts`

## API changes (additive)

`POST /design-reviews/attempts/{id}/grade` — **new**. Grades an ungraded attempt; 409 once graded; 404 unknown.

## DB changes

None.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 629 | **630** (+1: grade again without a provider invents nothing; with one, the verdict arrives, choice and reasoning unchanged; 409 once graded; 404) |
| Frontend unit | 543 | **546** (+3: side-by-side comparison; grade again shows the verdict and removes the button; next review opens an unattempted scenario **with nothing committed**) |
| E2E | 26 | **27** (+1: commit, reveal, "Not graded" with no verdict shown, compare, the commit recorded on the server, next review opens a different scenario ready to answer) |

Typecheck and lint clean.

## Known limitations

- **The verdict needs an AI provider.** Without one, commits are saved and the reveal is shown, but there is no verdict until graded again.
- **No prototype-style "Optimal" badge for "ask first".** The prototype marks "ask first" optimal by choice alone. Here the verdict comes from reasoning, so choosing "ask first" without naming the question isn't rewarded.

## Gate decision

**PASS.** Phase 11 is complete. Next: Phase 12, Chart Sandbox evidence stored in the database.
