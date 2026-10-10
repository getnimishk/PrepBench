# Lakehouse Lab Phase 4, P1-6 Gate Report: AI feedback on acceptance criteria

**Date:** 2026-10-10 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-p1-6-ac-feedback`

**Ruling:** When a learner writes acceptance criteria in the Lakehouse Lab, an optional "Get AI feedback" action provides actionable advice on the criteria. This **supplements** the existing deterministic structure checks (`acChecks.ts`) and does not replace them. Invariant checks are strictly upheld: advice only (no score, no percentage, no verdict, no `correct` field, no impact on evidence levels, no database writes, and graceful "Not Graded" fallback on any provider absence or error). **Gate decision: PASS.**

---

## Audit: what the work found

1. **Pure advice schema with zero scoring.**
   The Pydantic schema `CriteriaFeedbackResponse` in `backend/app/schemas/lab.py` and TypeScript type `CriteriaFeedbackResponse` in `frontend/src/types/lakehouse.ts` enforce:
   `status: Literal["feedback", "not_graded"]`, `points: list[str]`, `reason: Optional[str]`.
   There is no score, no 0/100, no percentage, no verdict, and no `correct` property.
2. **Deterministic and safe fallback.**
   Following the pattern of `design_review_service.py`, `backend/app/services/lab/criteria_feedback.py` catches:
   - No provider configured for task `LLMTask.ACCEPTANCE_CRITERIA_FEEDBACK`
   - Provider errors (network issues, 503s, invalid credentials)
   - Timeouts
   - Malformed or empty JSON responses
   All failure modes safely return `status="not_graded"` with a human-readable reason (e.g. `"No AI provider configured for acceptance criteria feedback."`). It never throws a 500 and never hallucinates grades or advice.
3. **Zero database writes.**
   Criteria feedback is ephemeral and advice-only. No table was added, no column was added, and no `learning_attempts` row is written or modified. An explicit test asserts that the database row count across all tables is unchanged after requesting feedback.
4. **UI feedback rendering and isolation.**
   In `frontend/src/components/lakehouse/AcExplain.tsx`, "Get AI feedback" sits alongside "Check structure". Feedback points are rendered cleanly with `components/common/Explanation.tsx` (never `dangerouslySetInnerHTML`). The feedback is explicitly labelled "AI feedback" with an "Advice only" pill (or "Not Graded" pill on unavailable provider), keeping it clearly distinct from deterministic structure checks.
5. **Race-condition and stale state protections.**
   - While a request is in flight, the button is disabled with text "Getting feedback…".
   - If the learner edits criteria after asking, old feedback is immediately cleared.
   - When requests overlap or resolve out of order, a request sequence ref ensures only the response from the latest criteria request can be displayed; stale responses are discarded.

---

## Implemented

| Item | Where |
|---|---|
| New task `ACCEPTANCE_CRITERIA_FEEDBACK` | `backend/app/llm/types.py` (`LLMTask`, `TASK_SPECS` with `TaskSpec(Capability.TEXT_JSON, 20.0, 180.0)`) |
| Task label and no-provider fallback message | `backend/app/services/llm_config_service.py` (`TASK_LABELS`, `TASK_FALLBACKS`) |
| Request/Response Pydantic schemas | `backend/app/schemas/lab.py` (`CriteriaFeedbackRequest`, `CriteriaFeedbackResponse`) |
| Feedback service with prompt & error handling | `backend/app/services/lab/criteria_feedback.py` (`generate_criteria_feedback`) |
| Lab router endpoint `POST /criteria/feedback` | `backend/app/api/v1/lab_lakehouse.py` (`get_criteria_feedback`) |
| Backend test suite (8 tests) | `backend/tests/test_lab_criteria_feedback.py` |
| OpenAPI contract & TypeScript types | `docs/api/openapi.json`, `frontend/src/types/generated/api.ts`, `frontend/src/types/lakehouse.ts`, `frontend/src/types/apiContract.check.ts` |
| Frontend API client method | `frontend/src/services/api.ts` (`getLakehouseCriteriaFeedback`) |
| AcExplain UI action & Explanation rendering | `frontend/src/components/lakehouse/AcExplain.tsx` |
| AcExplain component test suite (5 tests) | `frontend/src/components/lakehouse/AcExplain.test.tsx` |
| Documentation updates | `docs/wiki/AI-Providers.md`, `docs/implementation/lakehouse-lab-plan.md` |
| E2E test case for no-provider state | `frontend/e2e/databricks-sandbox.spec.ts` |

---

## Exit criteria

- [x] **No score or verdict field**: Schema uses `Literal["feedback", "not_graded"]`, points list, and reason. UI renders advice only with no numeric scores or verdicts.
- [x] **Editing criteria clears old feedback**: Tested in `AcExplain.test.tsx` and `e2e/databricks-sandbox.spec.ts`.
- [x] **Overlapping requests**: A race guard discards out-of-order or stale responses, showing only the latest requested feedback.
- [x] **No provider / provider failure**: Gracefully returns `not_graded` with informative reason, never a fabricated score, never a 500 error.
- [x] **Zero storage invariant**: Verified by test `test_feedback_does_not_write_to_database`. No DB mutations or `learning_attempts` updates occur.
- [x] **Offline guarantee**: No network calls occur unless the user explicitly configured and bound a cloud provider for this task.
- [x] **Full test verification**:
  - Backend targeted: 8 passed (`backend/tests/test_lab_criteria_feedback.py`).
  - OpenAPI contract: 2 passed (`backend/tests/test_openapi_contract.py`).
  - Backend full suite: 1177 passed, 3 skipped, 0 failures (`pytest -c backend/pytest.ini backend/tests -q`).
  - Frontend component tests: 5 passed (`AcExplain.test.tsx`), 69 passed across 4 Station test files.
  - Frontend typecheck: 0 errors (`tsc --noEmit && tsc --noEmit -p e2e`).
  - Frontend lint: 0 errors, 65 warnings (baseline was 65 warnings, 0 added).
  - Playwright E2E:
    - `e2e/databricks-sandbox.spec.ts`: 8 passed (1.1m)
    - `e2e/responsive.spec.ts`: 3 passed (2.1m)
    - `e2e/accessibility.spec.ts`: 6 passed (4.9m)

---

## Verification Summary

- `backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini backend/tests -q` -> 1177 passed, 3 skipped (0:04:53).
- `npm --prefix frontend test -- src/components/lakehouse/AcExplain.test.tsx --run` -> 5 passed (7.61s).
- `npm --prefix frontend test -- src/components/lakehouse/Station --run` -> 69 passed across 4 files (54.36s).
- `npm --prefix frontend run typecheck` -> Clean pass (0 errors).
- `npm --prefix frontend run lint` -> Clean pass (0 errors, 65 warnings matching main baseline).
- `npm --prefix frontend run test:e2e -- e2e/databricks-sandbox.spec.ts` -> 8 passed (1.1m).
- `npm --prefix frontend run test:e2e -- e2e/responsive.spec.ts` -> 3 passed (2.1m).
- `npm --prefix frontend run test:e2e -- e2e/accessibility.spec.ts` -> 6 passed (4.9m).

---

## Independent verification (2026-10-10)

Built in a separate tool, then reviewed against the handoff's P1-6 acceptance criteria and its common mistakes,
and re-run on this machine with nothing else running:

- Backend full suite: **1177 passed, 3 skipped** (9:58).
- Frontend full suite (`npx vitest run`): **132 files, 1583 tests passed**. The original session's full run
  showed failures in `DatabricksSandboxPage.test.tsx` and `RoadmapEditorPage.test.tsx` while the backend suite
  was running at the same time; both files passed on their own then, and the full suite passes here. The report
  above listed only the targeted files; this is the full-suite result.
- Typecheck clean; lint 0 errors, 65 warnings (the same as `main`).
- Review fix: an unexpected exception's raw text was shown to the learner as the not-graded reason. It now shows a
  plain message, and the detail goes to the log only (an exception can carry request details). New test `test_an_unexpected_exception_never_shows_its_text_to_the_learner` failed before the fix and passes after; `test_lab_criteria_feedback.py` is now 9 tests, and with the LLM layer and config tests 63 pass.
- Playwright (`databricks-sandbox` 8, `responsive` 3, `accessibility` 6, all passed in the original session) was not re-run: nothing on the frontend changed after those runs.

## Open items

- Station I (P1-5: identity and governance) remains the final P1 Lakehouse Lab item briefed in `docs/implementation/lakehouse-p1-handoff.md`.
