# Lakehouse Lab Phase 4, P1-5 Gate Report: Station I, identity and governance

**Date:** 2026-10-10 · **Format:** lakehouse-lab-plan.md §2 · **Branch:** `feat/lakehouse-p1-5-station-i`

**Ruling:** Station I adds two puzzles over a fictional estate, as a pure simulation:
- **Identity at cutover:** which workload's cutover plan cannot authenticate to Azure Databricks.
- **A Ranger policy, redesigned:** which Unity Catalog redesign keeps the policy's purpose.

Every technical statement on screen is a claim from an approved register (24 facts, each linked to an official
page read on 2026-10-10, and 6 labelled simulation assumptions). Grading is deterministic. The learner's sign-off
criteria and rationale are their own explanation and are never scored. **Gate decision: PASS.**

## Audit: what the work found

1. **Research came first and was reviewed against its sources.** Revision 1 of the register (commit 0070562,
   drafted in a separate tool) was checked claim by claim against the cited pages and was not approved:
   - the identity puzzle had three correct answers: Databricks-managed service principals get their token from
     Databricks, not Entra ID;
   - its planted failure rested on two claims about group managed service accounts that neither cited page
     states;
   - a "requires an app registration" claim is contradicted by the managed-identity service principal type;
   - an on-premises claim, a "Generally Available" claim and an undocumented type-mismatch behaviour went beyond
     their sources.

   Revision 2 (commit bbe27ef) rebuilt the register from ten pages read on 2026-10-10. It lists what could not be
   confirmed, and those points are not used.
2. **The identity puzzle has exactly one answer, decided by cited facts.**
   - `svc-tool-feed` runs on an on-premises server and its plan gives it a system-assigned managed identity. A
     managed identity is assigned to Azure compute (F5), and a system-assigned one is usable only by its own
     resource (F7).
   - The distractor `svc-report-refresh` works with a Databricks-managed service principal whose token comes from
     Databricks (F11).
   - The model refuses to load if the estate ever has more or fewer than one failing plan.
3. **The governance puzzle compares each candidate with the legacy policy user by user.** The Ranger policy is
   read in item order, first match wins (F13), and an empty filter means no restriction (F14). The three wrong
   redesigns fail the way their facts say:
   - `is_member()` checks workspace groups only (F20), so no account group passes;
   - an ABAC DENY policy denies `MANAGE ACCESS CONTROL`, not rows (F23);
   - an `INT` parameter on a `STRING` column is cast to NULL with ANSI mode off (F19).

   How those play out on the sample rows is labelled as the model's reading (A6).
4. **No result before the prediction.** Showing the per-workload results first would give the answer away, so
   Manipulate and Observe stay locked until the prediction is committed.

## Implemented

| Item | Where |
|---|---|
| Claims register (revision 2) | `docs/research/lakehouse-p1-5-identity-governance-research.md` |
| Register as data: 10 sources, 24 facts, 6 assumptions, 2 conventions | `frontend/src/services/lakehouse/identitySources.ts` |
| Pure model: estate, plans, Ranger reading, four redesigns | `frontend/src/services/lakehouse/identityModel.ts` |
| Station I: two puzzles, each its own attempt; facts panel with source links; disclaimer | `frontend/src/components/lakehouse/StationI.tsx` |
| Rail: "I · Identity and governance", programme level, beside F | `frontend/src/pages/DatabricksSandboxPage.tsx` |
| Pack lists the station | `backend/app/data/lab_packs/semiconductor-v1/manifest.json` |
| Workspace and Evidence titles | `frontend/src/services/portfolio.ts` |
| Tests | `identityModel.test.ts` (15), `StationI.test.tsx` (8), `DatabricksSandboxPage.test.tsx` (+1), `portfolio.test.ts` (+2 assertions), `backend/tests/test_lab_packs.py` (+1), `e2e/databricks-sandbox.spec.ts` (+1), `?station=i` in the accessibility, responsive and navigation route lists |

Reused unchanged:
- `useLabAttempt`: write-once prediction, and a simulation outcome whose `correct` is set by the model only;
- `AcExplain`: the identity sign-off criteria, with P1-6's AI feedback, which never sets `correct`;
- `SaveAsInterviewQuestion` (P1-1), with `station="i"`;
- the lab journal, with station `i` and source `simulation`.

No backend schema, table or migration changed.

## Exit criteria

- [x] Every fact has a source on an allowed official host. The register in code matches the research file, ids
  and kinds alike. Every claim the model reasons with exists. Feature statuses carry their date, and nothing is
  called Generally Available. All of this is enforced by `identityModel.test.ts`.
- [x] Every fact and assumption a puzzle uses is shown on screen, each fact with a link to its source opening in
  a new tab (`rel="noopener noreferrer"`), each assumption labelled as one (`StationI.test.tsx`).
- [x] Exactly one failing plan; exactly one redesign keeps the purpose. Asserted in tests and at module load.
- [x] Deterministic grading: `correct` is the prediction against the model, recorded as a simulation. Criteria
  and rationale are saved as the attempt's explanation, never scored.
- [x] The station says it is a teaching simulation over a fictional estate. Names are on reserved `.example`
  domains, and the sample identity numbers start `000`.
- [x] Interview questions, Workspace and Evidence work with the new challenge ids.

## Verification

Commands were run one at a time, with nothing else running on the machine.
- `backend/.venv/Scripts/python.exe -m pytest -q`: **1179 passed, 3 skipped**.
- `npx vitest run`: **134 files, 1607 tests passed**.
- `npm run typecheck`: clean. `npm run lint`: **0 errors, 65 warnings**, the same as `main`.
- Written first and seen failing before the code existed:
  - `identityModel.test.ts`: the module was missing;
  - `DatabricksSandboxPage.test.tsx`, the Station I rail test: no such station;
  - `test_lab_packs.py`, the new manifest test: failed with the manifest change stashed, passed with it.
- Playwright, 3 workers, `databricks-sandbox`, `accessibility` and `responsive`: **17 passed, 1 failed**. The
  failure was the new Station I case looking for a code block's `aria-label` as visible text, which is a test
  mistake. Fixed to find the block by its accessible name and check its content; the sandbox spec re-run alone:
  **9 passed**.
- Playwright `navigation.spec.ts`, `chromium-dev`, 1 worker, alone: **1 passed** (6.1 min). Every screen opens with no console errors, Station I included.

## Open items

- How each wrong redesign plays out on the sample rows is the model's reading of a documented fact (A6), not a
  captured run on Databricks.
- Feature statuses (ABAC Beta parts, Runtime requirements) were checked on 2026-10-10 and will age; the register
  states the date.
- Not confirmed and not used: managed service account synchronisation, Kerberos-to-Entra token behaviour,
  managed identities outside Azure, and "Generally Available" for catalog- or schema-level ABAC. See section 4 of
  the research file.
- With P1-5, every Phase 4 item (P1-1 to P1-6) is done.
