# Lakehouse Lab Phase 4, P1-2 Gate Report: Station D, the Reconciliation Detective

**Date:** 2026-10-09 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-p1-2-station-d`

**Ruling:** the learner finds the pack's planted defects with real engine results, and the score is the
defects found against the defects the pack's own manifest plants. All eight defects can be shown with the
operations that already exist, so **no new operation, table, column or AI grading was added**.
Open items are at the end.

---

## Audit: what the work found

1. **The handoff said "eight planted defects" and the dataset plants eight.** `dataset.json` lists
   `precision`, `tz-shift`, `null-scrap`, `drift`, `cdc`, `replay`, `late` and `small-files`. The score
   never hard-codes 8: it is `found / planted` from the server's `defect_manifest`, and a test runs it
   against a pack that plants three.
2. **Every defect is reproducible from engine output.** `tests/test_lab_station_d.py` (marked `lab`) drives
   each one through the API and reads the fields the grader reads:
   - `precision`, `tz-shift`, `null-scrap`: `compare_tables` on `legacy.defects` vs `bronze.defects`,
     `mismatches[<column>]`, and every listed key is one the manifest planted.
   - `drift`: the append of batch 3 under `schema_mode=enforce`; the refusal carries `batch_columns`
     including `inspector_id`.
   - `cdc`: `merge_cdc`'s `batch` counts equal the manifest's inserts, updates and deletes.
   - `replay`: `duplicate_keys.right` from `compare_tables` after batch 2 is appended twice.
   - `late`: `only_in_left` from `compare_tables` on telemetry through batch 2.
   - `small-files`: batch 4 landed with `small_files`, `writes == 50`, or `compact`'s `files_before >= 50`.
   Row counts match on the full compare (5,000 and 5,000) while the values do not, which is the lesson.
3. **A bronze table is created with batch 1 already in it.** A first version of the test appended batch 1
   again and saw 2,000 duplicate keys. The tests (and the grader's bounds) account for that; the learner
   sees it as "Create table" loading batch 1.
4. **Grading is deterministic and local.** `services/lakehouse/stationD.ts::checkClaim` decides whether a
   cited result is one the claimed defect produces. A claim it rejects is never recorded: no attempt is
   opened, so nothing of the learner's is written for a wrong claim.
5. **The picker names a defect, never where it is.** Options are short names ("timezone shift"), not the
   manifest's `about` text, so the choice isn't a hint.

## Implemented

| Brief | Where |
|---|---|
| `d` in the pack's stations | `manifest.json`, `PackManifest` literal in `schemas/lab.py`, `LabStation` type |
| Station D inside the lab page | `components/lakehouse/StationD.tsx`, rail entry in `DatabricksSandboxPage.tsx` |
| Challenge ids `lakehouse.d.<defect>` | `defectChallenge()`; one attempt per defect, found = closed and `correct` |
| Deterministic grading against the manifest | `services/lakehouse/stationD.ts` |
| Stored under the Databricks preparation by slug, next generation on 409 | uses `openLabAttempt` / `findLabAttempt` unchanged; `completeLabClaim` added to `attempts.ts` |
| Titles in Workspace and Evidence | `defectTitle()` used by `portfolio.ts::titleOf` |
| Says it is a teaching simulation over a fictional pack | station header and test |

## Exit criteria

- [x] **Score is `found / planted` from the manifest**, never estimated (`scoreDefects` tests; a three-defect pack).
- [x] **A claim without a supporting result is not counted** (component test: no attempt opened, no patch).
- [x] **Attempts are the preparation's** (`getLearningAttempts({subject_id})`, scope passed to every patch).
- [x] **Teaching simulation / fictional** wording on the station.
- [x] **Evidence levels:** a found defect is `completed` + `correct`, so Evidence shows *demonstrated*; the
  learner's explanation (their words, not graded) makes it *evidenced*, by the existing `_level`. No backend
  change to Evidence.
- [x] No engine installed: Run and Claim are disabled, nothing stands in for a result (component and e2e tests).

## Verification

See the PR description for the exact commands and results. Backend `pytest -q` ran from a throwaway
worktree (the learner's PrepBench was running on 8000); the lab engine tests ran in a scratch venv.

## Open items

- `observed` on a Station D attempt records `source: "engine"` and `ok: true`, so Evidence's existing basis
  text reads "Prediction checked against what the real Delta engine did". It is a claim checked against the
  engine's result, not a prediction. Rewording that is an Evidence-service change and was left out of scope.
- A cited result lives in the page's memory for the session. After a reload the learner runs the operation
  again to claim; found defects are kept on the server.
- OpenAPI did not change: `stations` is a plain string list on the wire, and the Literal only validates pack
  files on disk.
