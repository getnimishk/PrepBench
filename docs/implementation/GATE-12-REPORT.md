# Phase 12 Gate Report — Chart Sandbox

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

---

## Audit first

The plan's loop is predict → commit → manipulate → observe → explain → compare → store, with the prediction, the change, the result and the explanation all kept, and the comparison built from real values.

What was already real: the model and its charts, one-click write-once predictions, hints, the explanation reveal, and (since Phase 2) a `learning_attempts` table with server-side rules.

What was not:

1. **The evidence lived in the browser.** Attempts went to `localStorage`. The server table had 0 rows; the client never called it.
2. **Nothing could have been saved anyway.** The client names a scenario with ~480 characters; the API allowed 200, so every save would have failed with 422.
3. **Only the prediction was stored.** Nothing recorded what was changed, what the model showed, or the learner's own explanation.
4. **The answer was on screen while predicting.** For prediction questions, the changed model was applied *before* the learner answered, so the charts below already showed the result.

## Implemented

- **Attempts saved on the server.** Each answer is saved with its prediction, result, times and hints. A progress count only goes up once the server has the answer. If saving fails, the result says *"Your answer was not saved, so it does not count yet"* with **Try again**.
- **Predict first, then run.** Prediction questions now keep the sandbox at the baseline until you commit, then run the change. Reading, recognition and diagnosis questions still show their scenario on arrival (you need the chart to answer them).
- **What actually happened** is built from the model's own numbers at that moment: what was changed (e.g. *WIP limit 4 → 8 items*) and each headline figure that moved (e.g. *Cycle time rose from 4.0 to 8.0 days*). Figures that did not move are named once, not listed. Nothing changed → one line saying so.
- **Your explanation.** A text box under the result, saved with the attempt, and rewordable. It says **Not scored**; nothing grades it.
- **Your recent experiments** (under *How you are getting on*): the last five answers with what you said, what moved and your explanation. It is read from the server, so it survives a reload.
- **Moving old browser history.** On opening the sandbox, any answers saved in this browser are sent to the server with their original ids and times, then removed from the browser. Any that fail stay in the browser and are retried next time, with a warning. Only one import runs at a time (React mounts the page twice in development, which caused a real race; fixed).
- **Loading and error states.** Questions wait for your history to load (so a returning learner isn't sent back to the start). If loading fails, questions pause with the reason and **Try again**; the charts still work.
- **Accessibility.** The answer options are a named group (*Your prediction*); the result is a named region; the concept map's *Start/Practise* buttons now say which concept they open.

### Server rules added

- What was changed and what was observed can only be recorded **after** a prediction, and only once (the same value again is a retry; a different value is refused).
- An explanation needs a committed prediction.
- Supplied times (for moved history) cannot be in the future (a client clock up to 2 minutes ahead is taken as now) or before the attempt started. Offsets are stored as UTC.
- The **same** prediction arriving twice is a retry (two saves crossing), not an amendment. A **different** prediction is still refused.

## Files changed

**Backend** — `models/learning_attempt.py`, `core/database.py` (migration), `schemas/learning.py`, `services/learning_service.py`

**Frontend** — `services/learning/attempts.ts` (server store + import), `services/learning/experiment.ts` (new), `services/api.ts`, `types/learning.ts`, `components/learning/LearningPanel.tsx`, `components/learning/RecentExperiments.tsx` (new), `components/learning/ConceptMap.tsx`, `pages/ChartSandboxPage.tsx`

**Docs** — `12-chart-sandbox-evidence-impact-report.md`, `docs/api/openapi.json` (regenerated, 107 paths)

## API changes (additive)

`PATCH /learning/attempts/{uid}` accepts `manipulation`, `observed`, `explanation_text`, `committed_at`, `completed_at`. Responses include `manipulation`, `observed`, `explanation_text`. `scenario_fingerprint` limit 200 → 1000. An identical repeated prediction now returns 200 instead of 400.

## DB changes

Three nullable columns on `learning_attempts` (`manipulation`, `observed`, `explanation_text`); fingerprint length widened. See the impact report. The real database had 0 rows in this table.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 630 | **640** (+10: experiment recorded only after a prediction and only once; explanation kept and rewordable; moved history keeps its times within bounds; clock skew; offset start time; a real 480-char fingerprint; identical prediction is a retry; migration adds the columns) |
| Frontend unit | 546 | **571** (+25: server store — what is sent, retries never resend a prediction, naive times read as UTC, import keeps only what failed, one import at a time; experiment record and wording; panel — predict-first order, observed read at commit, one-line "nothing moved", explanation saved unscored, unsaved answer with retry; page — loads history, pauses on failure and retries, saves prediction + observed + explanation, prediction question stays at baseline until committed; recent experiments) |
| E2E | 27 | **29** (+2: answer, see what happened, save explanation, check the server, reload and find it; old browser history moved once with its own times) |

Typecheck clean. Lint 0 errors (17 existing warnings).

## Known limitations

- **Sandbox attempts are not tied to a preparation.** They record your understanding of the metrics model, which isn't specific to one certification. `subject_id` stays empty.
- **Explanations are not graded.** Grading free text needs an AI provider and a rubric; it is labelled *Not scored* rather than given a fake score.
- **Only the last five experiments are listed.** All are kept on the server.

## Gate decision

**PASS.** Phase 12 is complete. Next: Phase 13, Insights and explainable recommendations.
