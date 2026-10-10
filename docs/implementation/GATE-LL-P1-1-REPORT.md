# Lakehouse Lab Phase 4, P1-1 Gate Report: Interview questions from your own lab results

**Date:** 2026-10-10 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-p1-1-interview-questions`

**Ruling:** From a completed lab attempt, the learner can save a tailored interview question to their preparation. Key talking points are derived **strictly and only from what this learner observed** in that attempt; an attempt without recorded observations offers nothing to save. Databricks acquires the `interview` capability dynamically upon owning at least one saved lab question without hand-set flags or touching `KNOWN_PRODUCTION_SUBJECTS`. The Interview Hub routes lab-derived interview tracks directly to interview practice rather than scenarios. **Gate decision: PASS.**

---

## Audit: what the work found

1. **Talking points trace strictly to learner observations.**
   `extractTalkingPoints()` in `frontend/src/services/lakehouse/labInterviewQuestion.ts` constructs bullet points solely from the attempt's recorded `observed` payload (e.g. reconciliation mismatch counts, schema enforcement refusal details, CDC merge insert/update/delete totals, watermark row loss, ACL test permissions, migration incident findings). If an attempt has no observations or the run has not completed, `SaveAsInterviewQuestion` renders nothing to save. Only plain scalar values become points; a nested value is left out rather than shown as `[object Object]`.
2. **Stable source reference format.**
   `labInterviewSourceRef(packId, version, station, challenge)` produces a stable reference: `lab/<packId>@<version>/station/<letter>/<challenge>` (at most 150 characters), e.g. `lab/semiconductor-v1@1/station/d/precision`. `station` is typed `LabStation`, so a display label can't become part of the identity. This guarantees idempotent upserts via `PUT /interview-questions/by-source` keyed on `(source_ref, subject_id)`.
3. **Dynamic capability resolution without hand-set flags.**
   Per the product decision (2026-10-09), Databricks retains `interview: false` in `SUBJECT_CAPABILITY_PROFILES[2]` and `KNOWN_PRODUCTION_SUBJECTS`. The backend adds `lab_interview_question_count: int = 0` to `SubjectWithReadiness`, counting `interview_questions` matching `subject_id == subject.id` and `source_ref LIKE 'lab/%'`. In `capabilities.ts`, `getSubjectCapabilities` and `deriveCapabilities` enable `interview` if `profile.interview` is true or `lab_interview_question_count > 0`. A payload without the field leaves the profile value unaltered.
4. **Strict subject isolation.**
   Questions saved under Databricks belong strictly to that `subject_id`. With no Databricks preparation the lab runs unscoped, so the save is not offered at all (it would otherwise land in the shared library). Querying from another subject or with no subject cannot access them, and another subject's lab questions do not increment Databricks's count. Any other subject that saves a lab question receives the capability dynamically by the same rule without slug special-casing.
5. **Interview Hub routing.**
   For preparations whose interview rounds come from their own lab questions and that have no written scenarios (`!isSystemDesignSubject && lab_interview_question_count > 0 && !targetCapabilities.scenarios`), the hub primary action directs to `/interview-practice` ("Practise {targetSubject.name} questions") instead of dead-ending at `/scenarios`.

## Implemented

| Item | Where |
|---|---|
| Backend count on `SubjectWithReadiness` | `backend/app/api/v1/subjects.py` (`_lab_interview_question_count`, `_with_readiness`) |
| Backend tests (5 tests) | `backend/tests/test_lab_interview_questions.py` |
| OpenAPI contract & TypeScript types | `docs/api/openapi.json`, `frontend/src/types/generated/api.ts`, `frontend/src/types/subject.ts` |
| Capability resolution & tests (40 tests) | `frontend/src/services/capabilities.ts`, `frontend/src/services/capabilities.test.ts` |
| Source ref & talking points service (9 tests) | `frontend/src/services/lakehouse/labInterviewQuestion.ts`, `labInterviewQuestion.test.ts` |
| Station UI save component & tests (5 tests) | `frontend/src/components/lakehouse/SaveAsInterviewQuestion.tsx`, `SaveAsInterviewQuestion.test.tsx` |
| Station integrations | `StationA.tsx`, `StationB.tsx`, `StationC.tsx`, `StationD.tsx`, `StationF.tsx` |
| Interview Hub routing & tests (17 tests) | `frontend/src/pages/InterviewHubPage.tsx`, `InterviewHubPage.test.tsx` |

## Exit criteria

- [x] **No talking point exists unless it traces to a value in the learner's own attempt**: Tested in `labInterviewQuestion.test.ts` and `SaveAsInterviewQuestion.test.tsx`. Empty/missing observations render nothing.
- [x] **With no lab question saved, Databricks has `interview: false`**: After 1 save it has `interview: true`. Deleting the question returns it to `false`. Tested in `test_lab_interview_questions.py` and `capabilities.test.ts`.
- [x] **Strict subject scoping**: A question saved under Databricks is private; another subject cannot access it; count never aggregates across subjects.
- [x] **Generic rule**: Any subject with a lab-prefixed question gains `interview: true` via its own count, without slug special-casing.
- [x] **Idempotent re-save**: Re-saving via `PUT /interview-questions/by-source` updates the row in-place without incrementing count or creating duplicates.
- [x] **Interview Hub routes to practice**: For lab-based interview preps, main CTA routes to `/interview-practice` with "Practise {name} questions".
- [x] **Full test verification**:
  - Backend targeted: 15 passed (`test_lab_interview_questions.py`, `test_openapi_contract.py`, `test_subject_isolation_hardening.py`).
  - Backend full suite: 1169 passed, 3 skipped, 0 failures (`pytest -c backend/pytest.ini backend/tests -q`).
  - Frontend Vitest suite: 140 passed across 8 test files (`capabilities.test.ts`, `labInterviewQuestion.test.ts`, `SaveAsInterviewQuestion.test.tsx`, `InterviewHubPage.test.tsx`, `StationA/B/C/D/F` tests).
  - Frontend typecheck: 0 errors (`tsc --noEmit && tsc --noEmit -p e2e`).
  - Frontend lint: 0 errors.
  - Playwright E2E: 7 passed (`e2e/databricks-sandbox.spec.ts`).

## Verification Summary

- `backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini backend/tests -q` -> 1169 passed, 3 skipped (0:13:41).
- `npm --prefix frontend test -- ... --run` -> 140 passed across 8 files (110.86s).
- `npm --prefix frontend run typecheck` -> Clean pass (0 errors).
- `npm --prefix frontend run lint` -> Clean pass (0 errors).
- `npm --prefix frontend run test:e2e -- e2e/databricks-sandbox.spec.ts` -> 7 passed (2.0m).

## Independent verification and fixes (2026-10-10)

The implementation above was built in a separate tool, then reviewed against the handoff's acceptance criteria and re-run here. The review found six problems, all fixed on this branch with tests written first (each failed before its fix):

| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | Medium | With no Databricks preparation the save sent `subject_id: null`, putting the question in the **shared** library, seen from every preparation, and never counted | No save is offered without the preparation; the panel says why |
| 2 | Medium | The form re-initialised whenever `attempt.observed` was a new object, so any attempts refetch wiped what the learner had typed | Re-initialised only when the attempt or its recorded values change (compared by value) |
| 3 | Low | The default question claimed "How does Delta Lake handle X in production", wrong for Station D (defects) and F (migration) | Asks what the learner observed and what they would do in a real migration; claims nothing about the platform |
| 4 | Low | Source refs were built from the display label: `station/station a/watermark` | Built from the station letter; `station` is typed `LabStation` |
| 5 | Low | The hub decided "lab-based" by the absence of scenarios alone | Requires the preparation's own `lab_interview_question_count > 0` |
| 6 | Low | Any non-scalar value in `observed` would become the point `[object Object]` | Non-scalars are skipped |

Verified on this machine after the fixes:

- Backend full suite: 1169 passed, 3 skipped (run before the fixes, which touched no backend code).
- Frontend full suite before the fixes: 131 files, 1575 tests passed. After the fixes, the affected files (19 files, 341 tests) pass.
- Typecheck clean. Lint 0 errors; the `react-hooks/exhaustive-deps` warning the first version added is gone.
- Playwright, 3 workers: `databricks-sandbox` and `responsive` passed (13 passed in all); the three `accessibility` parts timed out or lost the browser under load (44-minute run, no violation reported). Re-run alone with 1 worker: `accessibility` **6 passed** (5.8 min).

## Open items

- The new panel appears only once an attempt is finished. `databricks-sandbox.spec.ts` commits predictions, so it can render there, but no browser spec targets the panel. It is covered by component tests; whether the axe and 390px audits see it depends on what that worker's database already holds.
- Next Phase 4 items (`lakehouse-p1-handoff.md`): **P1-6**, AI feedback on acceptance criteria; then **P1-5**, Station I: identity and governance.
