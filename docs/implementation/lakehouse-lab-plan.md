# Lakehouse Lab — Phase-Gated Implementation Plan

**Date:** 2026-09-25 · **Owner:** Nimish Kanungo · **Route:** `/databricks-sandbox`
**Sources of truth:** [PRD](../specs/lakehouse-lab.md) · [System design](../specs/lakehouse-lab-design.md) · `CLAUDE.md` (repo root, not tracked; read it first)

> **Read first (added 2026-09-27):**
> - **The skills plan runs before this one** (its D10). This plan continues after its Phase 4. **The skills plan is
>   complete (2026-09-28); its §9 lists what this plan inherits.**
> - **The lab belongs to the seeded `databricks` skill** (skills plan D11): its pages and learning attempts use that
>   subject's id, and its interview questions use `interview_questions.subject_id` / `source_ref` from skills plan
>   Phase 3.

This plan is written to be picked up **cold, in a new session**. Each phase is self-contained: it has entry criteria, tasks with file paths, tests, exit criteria, and the gate evidence to produce. Don't start a phase until the previous gate has passed.

---

## 0. Starting a session on this plan

1. Read `CLAUDE.md`, then this file's **Status** table (§1), then the phase you're on. The PRD and design are the detail; this plan is the order.
2. Check what changed since the last session. The author also works with Gemini between sessions (see memory):
   ```bash
   git fetch origin && git log --oneline -10 origin/main
   ```
3. Check that every PR the phase depends on (§1) has merged. **Don't build on an unmerged spec.**
4. Branch from `main` as `feat/lakehouse-lab-phase-<n>`. **One PR per phase** (for Phase 1, one per sub-phase). Never push to `main`.
5. Before stopping, update the Status table and write the **session handoff** (§9) at the bottom of the phase's gate report. If the gate hasn't been reached, put the handoff in the PR description.

**Hard rules that bite in this feature in particular** (from `CLAUDE.md`):
- Lab files never sit beside `backend/data/exam_simulator.db`. `PREPBENCH_LAB_DIR` is redirected in `conftest.py` **before** any `app.*` import.
- Never show simulated output as a real run. With the engine missing, the run panel says so. It never displays a stand-in.
- No frontend edits while Playwright is running.
- `backend/.venv/Scripts/python.exe` only. Don't install `deltalake` into `backend/.venv` casually. Use it only when running the engine tests, and **run the default suite without it too**.
- Workflow files (`.github/workflows/*.yml`) are pushed by the author, not by the agent (hard rule 8).
- Don't import `app.main` outside pytest, except in `scripts/export_openapi.py` with the env vars redirected.

## 1. Status

| Phase | Scope | Depends on | Status | Gate report |
|---|---|---|---|---|
| 0 | Engine spike + scenario inconsistencies | — | **Gate passed.** Engine spike ✅ 2026-09-24; open question 9 ✅ resolved by the author 2026-09-28 (§3) | design §10; PR description |
| 1A | Backend foundation + Station C engine API | PR #32 merged, Phase 0 gate | **Merged** (PR #42); the CI lab job is in (PR #57) | `GATE-LL-1A-REPORT.md` |
| 1B | Page shell + Station C UI + journal | 1A gate | **Merged** (PR #60). Open: the author runs the notebook on Free Edition | `GATE-LL-1B-REPORT.md` |
| 2 | Station F: Migration Factory | 1B gate | **Merged** (PR #62) | `GATE-LL-2-REPORT.md` |
| 3 | Stations A and B + downstream flow | 2 gate | **Merged** (PR #66) | `GATE-LL-3-REPORT.md` |
| 4 | Interview-ready (P1-1 to P1-6) | 3 gate | In progress, one PR per item. **P1-3 merged** (PR #68). **P1-4 delivered** by the skills plan's Phase 4 (role diagnostic, checked 2026-10-09). **P1-2 merged** (PR #85, `GATE-LL-P1-2-REPORT.md`). **P1-1 merged** (PR #86, `GATE-LL-P1-1-REPORT.md`). **P1-6 merged** (PR #88, `GATE-LL-P1-6-REPORT.md`). **P1-5 built** (Station I, identity and governance; research register `docs/research/lakehouse-p1-5-identity-governance-research.md`, `GATE-LL-P1-5-REPORT.md`; PR pending). With P1-5, every Phase 4 item is done | `GATE-LL-P1-3-REPORT.md` (P1-3), `GATE-LL-P1-2-REPORT.md` (P1-2), `GATE-LL-P1-1-REPORT.md` (P1-1), `GATE-LL-P1-6-REPORT.md` (P1-6), `GATE-LL-P1-5-REPORT.md` (P1-5) |
| Later | P2 items | — | Not planned | — |

PR #31 (interview importer keeps prepared answers and talking points, Phase 4's P1-1) and PR #32 (spec, design and
spike results, Phase 1A) are both merged to `main`.

Gate reports go in `docs/implementation/`, next to the existing `GATE-*.md` files, using the same format: audit first, then what the gate found, then what was done, then the decision.

## 2. The gate protocol (applies to every phase)

A phase **passes** only when every box below is ticked **with evidence in the gate report**. "I believe it works" doesn't count as evidence.

- [ ] **Exit criteria:** every item in the phase's exit list is met, and the report shows how (a test name, a command output, or a screenshot).
- [ ] **Backend default suite**, *without* `deltalake`: `backend/.venv/Scripts/python.exe -m pytest -q` is green, with no exceptions. The real-database guard no longer trips on its own read (it reads the schema from a copy), so a failure from it is a real finding -- stop any PrepBench running against that file and investigate before going on.
- [ ] **Backend engine suite**, *with* `deltalake`: `pytest -q -m lab` is green. Run it in a scratch venv made from `requirements.txt` + `requirements-lab.txt`, or in the CI lab job once the author has pushed it.
- [ ] **Frontend:**
  ```bash
  npm run typecheck
  npm run lint
  npm test
  ```
  All three must be green.
- [ ] **Browser:** `npx playwright test` for the specs this phase touched, then the full suite before the phase PR merges. If a test fails, re-run it alone before concluding anything (CLAUDE.md, "When a browser test fails").
- [ ] **Visual and accessibility pass** at `/databricks-sandbox`: axe clean in light and dark, no horizontal scroll at 390 × 844. Use the disposable second-server setup in CLAUDE.md, "Verifying a visual/accessibility change", never the author's running app.
- [ ] **Pre-completion checklist** (the skill): count assertions, hard-coded colours or font sizes (including SVG `fontSize`), route in all three e2e specs, heading levels.
- [ ] **OpenAPI:** if a schema changed, regenerate with `scripts/export_openapi.py` (env-redirected), then run `tests/test_openapi_contract.py`.
- [ ] **Honesty review:** every number on screen is either real (from the engine or the database) or labelled a *teaching constant*. Every journal entry's `source` is correct.
- [ ] **Gate report** written, the Status table updated, and the PR opened.

**A failed gate** means fixing and re-running the gate. Don't carry a known failure into the next phase "to fix later".

---

## 3. Phase 0: finish the spike and settle the scenario

**Engine spike: done.** The results and the four design changes are in design §10. Nothing more to do there.

**Open question 9: resolved by the author 2026-09-28.** The answers go into the pack's content, not into code. The
author chose the suggested default in all three rows below (recorded in the PRD, open question 9):

| # | Contradiction in the source scenario | Decision needed | Suggested default |
|---|---|---|---|
| 1 | Job-cluster vs all-purpose DBU ratio: "roughly a third" (Part 6) vs "2–3x-plus" (Part 7.3) | One figure for the Factory's cost lever | Use a teaching constant of **0.5×**, labelled "illustrative; check the current rate card", and never quote a ratio as fact |
| 2 | Waves 9–11: "Finance" (Part 4.2) vs "high-risk" (Part 5) | One wave numbering | Renumber to follow Part 4.2: waves 1–2 pilot, 3–6 supply chain, 7–9 finance, 10–11 yield, 12 telemetry. Part 5's phases then map to 1–2, 3–9, 10–11, 12 |
| 3 | Budget line items sum to ~$10.5M low end, stated "~$11M" | Consistent totals | State the range as **~$10.5M–$13M**, or drop the budget from the pack. The Factory only needs relative costs |

**Exit criteria:**
- [x] The three decisions are recorded in the PRD (open question 9 → resolved), 2026-09-28.
- [x] PR #32 is merged.

---

## 4. Phase 1A: backend foundation and Station C engine API

**Goal:** everything the server owns, working and tested, with **no UI yet**. PRD P0-1, P0-2, P0-3, P0-4, P0-10 (server side) and P0-11. Design §4.1–4.6, §4.9 and §4.10.

**Entry criteria:** Phase 0 gate passed. `main` contains the spec and design.

### Tasks

**Configuration and isolation (P0-3)**
- [ ] `backend/app/core/config.py`: add `LAB_DIR` from `PREPBENCH_LAB_DIR` (default `DATA_DIR / "lab"`), and a `lab_path(pack_id, table)` that refuses paths outside it. Mirror `recording_file()`.
- [ ] `backend/tests/conftest.py`: add `os.environ.setdefault("PREPBENCH_LAB_DIR", tempfile.mkdtemp(prefix="prepbench-test-lab-"))` next to the recordings and secrets redirects, **above** the first `app.*` import.

**Optional dependency (P0-2)**
- [ ] `backend/requirements-lab.txt`: `-r requirements.txt`, `deltalake==1.6.5`, `tzdata`. Add a header comment explaining it's optional, with the `uv pip install --system-certs` line.
- [ ] `backend/pytest.ini`: register the `lab` marker.
- [ ] `docs/wiki/Development-Guide.md`: a short "Optional: Lakehouse Lab engine" section. Wiki changes go through the PR; don't sync the wiki until it has merged.

**Packs (P0-1, design §4.1)**
- [ ] `backend/app/data/lab_packs/semiconductor-v1/`: `manifest.json` (`fictional: true`, `seed`, `version`, `notebook_verified_on: null`), `scenario.md`, `dataset.json`, `factory.json` (a stub is fine until Phase 2).
- [ ] `backend/app/schemas/lab.py`: Pydantic models for the pack, the operation request union (discriminated on `op`), operation results, engine status, and journal entries.
- [ ] `backend/app/services/lab/pack_service.py`: loads and validates packs, and skips an invalid pack with a logged reason. It never raises at startup.

**Dataset (P0-1, design §4.2)**
- [ ] `backend/app/services/lab/dataset_service.py`: uses `random.Random(f"{seed}:{table}")`, with no global RNG and no wall-clock time. Emits a clean copy, a `legacy` copy, and a manifest of planted defects.
- [ ] **Typed columns through a SQL cast** (spike finding 3): write raw values to `_staging`, then run a server-written `SELECT CAST(… AS DECIMAL(p,s))`, `to_timestamp_micros(…)` and `arrow_cast(…, 'Timestamp(Microsecond, Some("UTC"))')` into the target.

**Engine and operations (P0-4, design §4.3–4.4)**
- [ ] `backend/app/services/lab/engine.py`: the **only** module that imports `deltalake`, and only lazily. `status()` never raises.
- [ ] `backend/app/services/lab/operations.py`: the 10 operations are `create_table`, `append_batch`, `merge_cdc`, `history`, `read_version`, `restore`, `compact`, `vacuum` and `compare_tables`, plus the replay used by `append_batch`. They follow design §4.4 exactly, and in particular:
  - **every count or read goes through `QueryBuilder`, never `DeltaTable.count()`** (spike finding 1)
  - **`compare_tables` does both aggregates and a join on the business key, with a tolerance** (spike finding 2)
  - `ORDER BY` in every multi-row query
  - a per-table `threading.Lock`
  - an expected failure returns `200 {ok:false, error}`, misuse returns `400`, and a missing engine returns `503`
- [ ] An operation carrying `attempt_uid` requires that attempt's prediction to be committed already (checked via the existing `learning_attempts` service).

**Journal (P0-10, design §4.6)**
- [ ] `backend/app/models/lab_journal_entry.py`, with a table-creation step and an idempotent `ALTER`-style step in `apply_lightweight_migrations()`, wrapped like the others.
- [ ] `backend/app/services/lab/journal_service.py`: real-engine entries are written **only** inside the operation handlers. The public `POST` forces `source='simulation'` and refuses `real_engine`.

**Notebook export (P0-11, design §4.9)**
- [ ] `backend/app/services/lab/notebook_service.py`: Databricks source format, with an "Unverified" header until `notebook_verified_on` is set.

**API (design §4.10)**
- [ ] `backend/app/api/v1/lab_lakehouse.py` (thin), included in `router.py`. Regenerate OpenAPI.

### Tests (all in `backend/tests/test_lab_*.py`)

| Without the engine (default suite) | With the engine (`@pytest.mark.lab`, `importorskip`) |
|---|---|
| `"deltalake" not in sys.modules` after importing the app | Each row of the design §10 spike table, re-asserted |
| `GET /engine` → `available: false` and the install command | A replayed append makes duplicates, and MERGE on the key doesn't |
| Every operation → `503` | Schema enforcement's error text comes back verbatim |
| Pack loads; a broken pack is skipped, not fatal | After vacuum, `read_version` of the vacuumed version **fails**, even though `count()` would still answer |
| Dataset is byte-identical across two runs | `compare_tables` finds **exactly** the manifest's defects, including drift that aggregates alone miss |
| `lab_path` refuses `..`, absolute paths and other drives | Compaction reduces the file count |
| Journal: no PUT or PATCH route; `POST` with `real_engine` → 400 | Lab folder paths with spaces work; reset deletes the folder on Windows |
| An operation with an uncommitted `attempt_uid` → 400 | |
| Real-database isolation test still passes (hash check) | |

### Exit criteria
- [ ] Both suites are green, as described in §2.
- [ ] `curl` or TestClient transcript in the gate report: engine status, one of each operation, a journal export.
- [ ] OpenAPI is regenerated and the contract test passes.
- [ ] The CI lab job's YAML is written and **handed to the author** to push (hard rule 8).

---

## 5. Phase 1B: page shell, Station C UI, journal

**Goal:** a learner can do Station C end to end in the browser, with and without the engine. PRD P0-4, P0-9, P0-10, P0-11 and P0-12. Design §2 and §4.8. **UI per Appendix A**, mockups A1–A6.

**Entry criteria:** Phase 1A gate passed.

### Tasks

**Wiring** (the `add-learning-lab-sandbox` skill, all seven steps)
- [ ] `frontend/src/components/common/navigation.ts`: `NavKey 'databricks-sandbox'`, a `NavEntry` in the Learning Lab group, and a `SECTION_RULES` entry.
- [ ] `frontend/src/pages/LearningLabPage.tsx`: set the `databricks` card to `live: true`, and **rewrite its copy**. It still describes cluster sizing and query concurrency; see mockup A1.
- [ ] `frontend/src/App.tsx`: the `/databricks-sandbox` route inside `AppLayout`. It isn't a focus mode.
- [ ] `frontend/e2e/{accessibility,responsive,navigation}.spec.ts`: add the route to each `ROUTES` array.
- [ ] Unit tests: bump the link count in `Sidebar.test.tsx` (16 → 17), add a row to `navigation.test.ts`, and update `LearningLabPage.test.tsx`.

**Page and components**
- [ ] `frontend/src/types/lakehouse.ts`: mirrors `schemas/lab.py`.
- [ ] `frontend/src/services/api.ts`: lab client functions.
- [ ] `frontend/src/pages/DatabricksSandboxPage.tsx`: `PageHead`, the station rail, and a `?station=` URL parameter (default `c` in Phase 1B).
- [ ] `frontend/src/components/lakehouse/StationShell.tsx`: Predict → Manipulate → Observe → Explain, built on the existing learning-attempt client (the prediction is write-once).
- [ ] `frontend/src/components/lakehouse/StationC.tsx` and `EnginePanel.tsx`: the real result, or "Real engine not installed" (mockups A3 and A4).
- [ ] `frontend/src/components/lakehouse/CompareResult.tsx` (mockup A5).
- [ ] `frontend/src/components/lakehouse/JournalDrawer.tsx`: a **Real engine** or **Simulation** pill on every entry, Markdown export, and delete (mockup A6).
- [ ] `frontend/src/services/lakehouse/acChecks.ts`: the four structure checks, as a pure function.
- [ ] `frontend/src/services/learning/challenges.ts` and `concepts.ts`: register `lakehouse.c.*` challenges and concepts.
- [ ] Notebook download button, with an **Unverified** pill while `notebook_verified_on` is null.

**Design-system rules** (CLAUDE.md): primitives only; `pb.*` tokens (no hex); `pxToRem` for every font size; one `color="ink"` primary button per page; custom radios use the `inset: 0; opacity: 0` pattern; heading levels go h1 → h2 → h3; a visually hidden header on any icon-only table column.

### Tests
- [ ] Vitest: `acChecks`, `StationShell` (prediction locked after commit), `EnginePanel` (both states), `JournalDrawer` (the source pill is always shown).
- [ ] `frontend/e2e/databricks-sandbox.spec.ts`: the full Station C flow **with the engine absent** (the CI default). Check that the fallback text appears and that no numeric result is shown.
- [ ] A manual run with the engine installed, on the disposable second server: a screenshot of each mockup state for the gate report.

### Exit criteria
- [ ] The station works end to end in both engine states. Screenshots of A1–A6 at desktop, 390 px, and in dark mode.
- [ ] axe is clean in light and dark, with no horizontal scroll at 390 px.
- [ ] The full frontend and backend suites are green.
- [ ] The notebook is exported, and **the author runs it on Databricks Free Edition**. If it works, set `notebook_verified_on`. Until then it stays marked **Unverified**, and the gate records that honestly.

---

## 6. Phase 2: Station F, the Migration Factory

**Goal:** the program level. PRD P0-8. Design §4.7. Mockups A7–A8.

**Entry criteria:** Phase 1B gate passed. Open question 9's decisions are in the pack.

### Tasks
- [ ] `backend/app/data/lab_packs/semiconductor-v1/factory.json`: the job inventory sample, tier rules, domains, the **fixed** event schedule, and cost teaching constants taken from the Phase 0 decisions.
- [ ] `frontend/src/services/lakehouse/factoryModel.ts`: pure and deterministic. It runs a plan by job count and a plan weighted by complexity side by side; applies the reality events (hidden inventory growth, pilot velocity, change freeze, a cutover without a consumer map); applies the cluster-cost lever; and blocks decommission until all consumers are confirmed.
- [ ] `frontend/src/services/lakehouse/couplings.ts`: the ledger for Station F, typed `arithmetic | assumption | convention`. Add the completeness test and the composition-count test, as in `services/metrics/couplings.test.ts`.
- [ ] `frontend/src/components/lakehouse/StationF.tsx`: the tiering exercise, the wave planner, and a timeline with events (mockups A7 and A8).
- [ ] **The link to Station C:** at a yield wave's Validate step, emit `{link:'station-c', compare:[legacy, silver]}` and route to Station C with a `compare_tables` preset.
- [ ] Journal entries from F are `source='simulation'`.

### Tests
- [ ] Vitest: model determinism; the count-based plan is always worse than the weighted plan on the reference inventory; each event fires at its scheduled point; decommission is blocked; the ledger is complete.
- [ ] E2E: plan the waves, run them, cut over without a consumer map, and see the broken-report incident. Then follow the yield-wave link and land on Station C with the compare preset.

### Exit criteria
- [ ] The PRD's Phase 2 exit: the count-based plan visibly fails where the weighted one holds, and a cutover without a consumer map breaks a report.
- [ ] Every cost figure on screen carries the *teaching constant* label (honesty review).
- [ ] The standard gate (§2).

---

## 7. Phase 3: Stations A and B, and the downstream flow

**Goal:** the pipeline level becomes one connected flow. PRD P0-5, P0-6, P0-7. Mockups A9–A10.

**Entry criteria:** Phase 2 gate passed.

### Tasks
- [ ] `GET /api/v1/lab/lakehouse/packs/{id}/source-index`: returns `{id, modified_at, deleted}` per row.
- [ ] `frontend/src/services/lakehouse/adfModel.ts`: builds a `BatchManifest`. The levers are:
  - full vs incremental load
  - watermark updated before vs after the copy, with an injected failure
  - which orchestrator owns each trigger
  - schedule vs tumbling-window vs event trigger, run against late and out-of-order files
  - retry count
  - soft deletes
- [ ] `frontend/src/services/lakehouse/adlsModel.ts`: hierarchical namespace on or off (atomic rename vs a copy per blob), landing layout (copied from HDFS vs redesigned), the access puzzle (RBAC scope vs a directory ACL plus execute on the parent folders), and access tier with a lifecycle rule. **No landing files** (design §4.5).
- [ ] Ledger entries for A and B, with the completeness test extended.
- [ ] `append_batch` accepts a manifest reference. The server materialises **exactly** those rows.
- [ ] `frontend/src/components/lakehouse/StationA.tsx` and `StationB.tsx` (mockups A9 and A10). A default upstream state is stated on screen ("using default upstream: …").

### Tests
- [ ] Vitest: the manifest's ids are always a subset of the source index; watermark-before-copy with a failure always loses rows, and watermark-after-copy always duplicates them; ADLS effective permissions for each puzzle case.
- [ ] Engine suite: a manifest with missing ids gives exactly that many missing rows in `bronze.*` (real count through `QueryBuilder`).
- [ ] E2E: a mistake in A appears in C's compare.

### Exit criteria
- [ ] The PRD's Phase 3 exit: a watermark mistake in A shows as real rows in C, and the ledger completeness test passes.
- [ ] The standard gate (§2).

---

## 8. Phase 4: interview-ready (P1)

**Entry criteria:** Phase 3 gate passed. **PR #31 merged** (the importer keeps prepared answers and talking points).

| Item | What | Key point |
|---|---|---|
| P1-1 | Station results → an interview question with `key_talking_points` | Talking points come from **this learner's observed results only**. Round type (open question 4) is **decided: `technical`** (skills plan D14, confirmed 2026-09-27), built in skills plan Phase 3. Save through `PUT /interview-questions/by-source`; a question is unique per (`source_ref`, `subject_id`) |
| P1-2 | Station D: Reconciliation Detective | The score is defects found vs the manifest. It reuses `compare_tables` |
| P1-3 | JD-PO-005 pack | Content only, **no code**. This proves Goal 5. **Now content for the role flow built in skills plan Phase 4** (roles from a job description); check what that phase already covers before starting |
| P1-4 | Diagnostic before/after view | ~~From the learner's own ratings~~ **Delivered by skills plan Phase 4** (the role diagnostic, self-rated, before/after). Nothing to build here |
| P1-5 | Station I: Identity and governance | A pure-TS `identityModel`, with its own ledger |
| P1-6 | AI feedback on acceptance criteria | A new `LLMTask` and routing entry. **"Not Graded"** with no provider (hard rule 2) |

Split Phase 4 into one PR per item. P1-3 is the cheapest and should go first, because it validates the pack boundary. The standard gate (§2) applies to each.

---

## 9. Session handoff template

Paste this at the end of the gate report, or in the PR description if the gate hasn't been reached:

```markdown
### Handoff — <date>
- Phase / branch / PR:
- Done this session (with evidence):
- Not done / in progress (exact file + function):
- Tests: backend default ☐ · backend lab ☐ · typecheck ☐ · lint ☐ · vitest ☐ · playwright (which) ☐
- Known failures and whether they reproduce alone:
- Decisions made (and where recorded):
- Next action (one concrete step):
```

---

## Appendix A: UI mockups

**About these mockups.** As of 2026-09-25, `PrepBench_Unified_Prototype.html` (kept outside the repo; ask the author for it) **includes the Lakehouse Lab** at `#/lakehouse`, under a new **Learning Lab** group in its sidebar. It's built from these wireframes using only the prototype's existing classes and colour tokens.
- **The prototype is the parity reference.** Phase 1B and later gates prove the match by rendering the prototype and `/databricks-sandbox` side by side (CLAUDE.md, Status). These drawings remain the annotated guide to which primitive, heading level and honesty rule each region uses.
- **The prototype's control labelled "Prototype: show without engine"** exists only to show both engine states. The app itself has no such control: its state comes from `GET /engine`.
- **One known difference in the prototype:** it has no Learning Lab hub page or Agile Metrics entry (the app's `/lab` and `/chart-sandbox`). That gap existed before this addition and is out of scope here.

**Legend:**
- `[ink]`: the one black primary button on the page
- `[blue]`: a contained button
- `[ ]`: outlined
- `(Pill:tone)`: `Pill` with a tone
- `‹h1›` `‹h2›` `‹h3›`: heading levels
- Colours are named by `pb.*` tokens only

### A1. Learning Lab hub card (`/lab`), updated copy

```
┌───────────────────────────────────────────────────────────────┐
│ ⬡  ‹h3› Lakehouse Lab                          (Pill:success) Live │
│    Data platform migration                                    │
│                                                               │
│    Move data from ADF to ADLS to Delta Lake and watch an       │
│    upstream choice become real rows in a real table. Then     │
│    plan a 3,000-job migration and see where estimates by      │
│    job count break.                                           │
│                                                               │
│    (Pill) Delta Lake · real engine  (Pill) ADF  (Pill) ADLS   │
│    (Pill) Migration waves  (Pill) Reconciliation              │
│                                                               │
│                                  [ Open the Lakehouse Lab → ] │
└───────────────────────────────────────────────────────────────┘
```

- Replace the placeholder's cluster-sizing description and `metricFamilies`.
- The label changes from "Databricks Architecture" to "Lakehouse Lab". The `navigation.ts` label changes to match. Check `Sidebar.test.tsx` and `navigation.test.ts` for the label string.

### A2. Page layout, desktop (`/databricks-sandbox?station=c`)

```
┌─ Sidebar ─┬───────────────────────────────────────────────────────────────────────────┐
│           │ Eyebrow: LEARNING LAB · FICTIONAL SCENARIO                                 │
│  …        │ ‹h1› Lakehouse Lab                                                         │
│  Learning │ Sub: A fictional semiconductor manufacturer moving from Hadoop to         │
│  Lab      │ Databricks. Predict, change one thing, see what really happens.           │
│   Agile   │                                                                           │
│  ▸Lakehouse│ ┌ Panel soft ─────────────────────────────────────────────────────────┐ │
│           │ │ Engine: (Pill:success) Real engine · deltalake 1.6.5    [ Journal (12) ]│ │
│           │ └─────────────────────────────────────────────────────────────────────┘ │
│           │                                                                           │
│           │ ┌ Station rail (tabs, ‹h2› per panel below) ───────────────────────────┐ │
│           │ │ PROGRAM    F  Migration Factory                                       │ │
│           │ │ PIPELINE   A  ADF + Lakeflow  →  B  ADLS  →  ●C  Delta Lake           │ │
│           │ └──────────────────────────────────────────────────────────────────────┘ │
│           │                                                                           │
│           │  ‹h2› Station C · Delta Lake: the load that went wrong                     │
│           │  Using default upstream: incremental, watermark after copy  [ Change ]     │
│           │                                                                           │
│           │  ┌ Stepper ───────────────────────────────────────────────────────────┐  │
│           │  │ ① Predict ─── ② Manipulate ─── ③ Observe ─── ④ Explain             │  │
│           │  └────────────────────────────────────────────────────────────────────┘  │
│           │  … step body (A3) …                                                       │
└───────────┴───────────────────────────────────────────────────────────────────────────┘
```

- Rail order puts the **program level above the pipeline**, matching the PRD picture.
- The station comes from `?station=`, so it survives a reload and is linkable. Station F links into Station C this way.
- The engine status lives in one soft `Panel`, and the journal opens as a drawer.

### A3. Station C, engine installed: predict, then observe

```
 ‹h3› ① Predict
 ┌ Panel ──────────────────────────────────────────────────────────────────────┐
 │ Batch 2 arrives with a new column, tool_id. Schema enforcement is on.         │
 │ What happens when it's appended to bronze.defects?                            │
 │  ( ) The rows are written, and tool_id is added                               │
 │  ( ) The rows are written, and tool_id is dropped                              │
 │  (•) The write is refused, and the table is unchanged                         │
 │                                                        [ink] Commit prediction │
 │ Note: Your prediction can't be changed once you commit it.                    │
 └──────────────────────────────────────────────────────────────────────────────┘

 ‹h3› ② Manipulate
 ┌ Panel ──────────────────────────────────────────────────────────────────────┐
 │ Operation   [ Append batch ▾ ]    Table  [ bronze.defects ▾ ]                  │
 │ Schema mode (•) Enforce   ( ) Evolve (merge)                                   │
 │                                                           [blue] Run on engine │
 └──────────────────────────────────────────────────────────────────────────────┘

 ‹h3› ③ Observe                                   (Pill:success) Real engine run
 ┌ Panel ──────────────────────────────────────────────────────────────────────┐
 │ (Pill:danger) Refused     Table stays at version 0 · 1,000 rows               │
 │ ┌ Detail (monospace) ─────────────────────────────────────────────────────┐   │
 │ │ SchemaMismatchError: Cannot cast schema, number of fields does not        │   │
 │ │ match: 4 vs 3                                                             │   │
 │ └───────────────────────────────────────────────────────────────────────────┘ │
 │ Good: Your prediction was right.                                              │
 │ Try it with Evolve next, then look at the table history.   [ Run with Evolve ] │
 └──────────────────────────────────────────────────────────────────────────────┘
```

- The error text is shown verbatim from the engine. It is never paraphrased into something friendlier.
- "Good" or "Note" compares the prediction to the result, using `Good` and `Note` from the primitives.

### A4. Station C, engine not installed

```
 ‹h3› ③ Observe
 ┌ Panel ──────────────────────────────────────────────────────────────────────┐
 │ (Pill:warning) Real engine not installed                                      │
 │                                                                               │
 │ This step runs on a real Delta Lake engine, which is optional and isn't       │
 │ installed. Nothing below is simulated in its place.                           │
 │                                                                               │
 │ ┌ Detail (monospace, copy button) ──────────────────────────────────────────┐ │
 │ │ uv pip install --system-certs -r backend/requirements-lab.txt             │ │
 │ └───────────────────────────────────────────────────────────────────────────┘ │
 │ Then restart PrepBench. Your prediction is saved and will be here.            │
 │                                                                               │
 │ You can still: read what the engine would check · write the acceptance       │
 │ criteria (step ④) · open Stations A, B and F, which don't need the engine.    │
 └──────────────────────────────────────────────────────────────────────────────┘
```

- **No numbers, no sample rows, no "expected" result.** This is hard rule 2, and the e2e spec asserts it.

### A5. Compare tables result (Station C, from Factory yield wave)

```
 ‹h3› Legacy vs migrated · yield_daily                    (Pill:success) Real engine run
 ┌ MetricRow ──────────────────────────────────────────────────────────────────┐
 │  Metric label="Rows"     Metric label="Row-level        Metric label="Largest  │
 │                                 mismatches"                    difference"    │
 │   value 500 = 500         value 300                      value 0.0033          │
 │   detail counts match     detail tolerance 0.0001        detail yield_pct      │
 └──────────────────────────────────────────────────────────────────────────────┘
 ┌ Table ─────────────────────────────────────────────────────────────────────┐
 │ Column      Legacy sum   Migrated sum   Nulls L / M   Status                  │
 │ yield_pct   45,750.00    45,750.00      0 / 0         (Pill:danger) 300 rows  │
 │ scrap_qty   1,470.00     1,470.00       10 / 0        (Pill:danger) nulls     │
 │ lot         —            —              0 / 0         (Pill:success) match    │
 └──────────────────────────────────────────────────────────────────────────────┘
 Note: The sums match. The drift only shows up when rows are compared by key.
       Row-count parity isn't enough.
```

- This is spike finding 2 turned into the lesson. The `Note` text comes from the pack, not from the component.

### A6. Journal drawer

```
                                   ┌ Drawer (right, 420px; full-width sheet < 768px) ┐
                                   │ ‹h2› Lab journal                     [ Export .md ] │
                                   │ Every entry says whether it really ran.           │
                                   │ ─────────────────────────────────────────────────  │
                                   │ (Pill:success) Real engine   25 Sep 14:02          │
                                   │ append_batch · bronze.defects                      │
                                   │ Refused: SchemaMismatchError … 4 vs 3       [ 🗑 ] │
                                   │ ─────────────────────────────────────────────────  │
                                   │ (Pill:success) Real engine   25 Sep 14:03          │
                                   │ append_batch (evolve) · v1 · 1,100 rows     [ 🗑 ] │
                                   │ ─────────────────────────────────────────────────  │
                                   │ (Pill:neutral) Simulation    25 Sep 14:10          │
                                   │ Factory · wave 10 cut over without consumer map    │
                                   └────────────────────────────────────────────────────┘
```

- **The source pill is always shown on every entry.** Entries can be deleted but never edited. The delete icon button has an `aria-label`.

### A7. Station F: tiering

```
 ‹h2› Station F · Migration Factory
 ‹h3› ① Predict: tier these 12 jobs
 ┌ Table ──────────────────────────────────────────────────────────────────────┐
 │ Job              Signals                                     Your tier        │
 │ yld_daily_agg    HiveQL · no UDFs · feeds yield report       [ 1 ][ 2 ][•3 ]  │
 │ inv_snapshot     SparkSQL · Oozie coordinator                [ 1 ][•2 ][ 3 ]  │
 │ eq_anomaly_rdd   RDD API · custom Java UDAF · realm B auth   [ 1 ][ 2 ][•3 ]  │
 │ …                                                                            │
 └──────────────────────────────────────────────────────────────────────────────┘
                                                          [ink] Commit tiering
```

- "Feeds yield report" makes a job Tier 3 regardless of how simple its code is. That's a rule from the pack, and the reveal explains it.

### A8. Station F: wave plan and timeline

```
 ‹h3› ② Plan the waves                ‹h3› ③ Run the programme
 ┌ Panel ─────────────────────┐       ┌ Panel ───────────────────────────────────────────┐
 │ Drag domains into waves     │       │ Month  1  3  5  7  9  11  13  15  17  19          │
 │ W1–2  [BI feeds        ≡]   │       │ Count  ████████████████▓▓▓▓▓▓░░░░░ ends M19 (late) │
 │ W3–6  [Supply chain    ≡]   │       │ Tiered ██████████████████████ ends M17 (on plan)   │
 │ W7–9  [Finance         ≡]   │       │   ▲M4 +15% jobs found (cron wrappers)             │
 │ W10–11[Yield           ≡]   │       │   ▲M11 change freeze (fab audit)                  │
 │ W12   [Telemetry       ≡]   │       │   ▲M13 W10 cut over, no consumer map →            │
 │                             │       │      (Pill:danger) Yield dashboard blank           │
 │ Cluster policy              │       │ ┌ MetricRow ──────────────────────────────────┐  │
 │ (•) Job clusters            │       │ │ Cost (teaching constant) · Incidents 1 ·     │  │
 │ ( ) All-purpose             │       │ │ Decommission: (Pill:warning) blocked, 3      │  │
 │ Sub: teaching constants,    │       │ │ consumers unconfirmed                       │  │
 │ not prices                  │       │ └──────────────────────────────────────────────┘  │
 │              [blue] Run plan│       │ W10 Validate → [ Compare in Station C → ]        │
 └─────────────────────────────┘       └───────────────────────────────────────────────────┘
```

- The timeline is SVG. Its text must use `textScale` (CLAUDE.md, Settled decisions), and its colours come from `usePb()`.
- The comparison between the two plans is the lesson, so both bars are always shown.
- **Every cost carries the "teaching constant" label** (`Sub` or a callout from the ledger).

### A9. Station A: ADF + Lakeflow step list

```
 ‹h2› Station A · ADF + Lakeflow Jobs
 ┌ Panel ──────────────────────────────────────────────────────────────────────┐
 │ 1 Lookup watermark        last = 2026-09-24 02:00                              │
 │ 2 Copy via self-hosted IR on-prem MES → landing          owner: (Pill) ADF      │
 │ 3 Run job   bronze → silver                             owner: (Pill) Lakeflow │
 │ 4 Update watermark        position: (•) after copy  ( ) before copy           │
 │                                                                               │
 │ Load  (•) Incremental ( ) Full     Trigger [ Tumbling window ▾ ]  Retries [2]   │
 │ Inject: [x] failure at 60% of copy   [x] late files   [ ] out-of-order files   │
 │                                                              [blue] Run pipeline│
 └──────────────────────────────────────────────────────────────────────────────┘
 ‹h3› Batch manifest              (Pill:neutral) Simulation → sends to Station C
 Batch 2: 2,850 of 3,110 rows · 260 missed (ids 3121–3380) · 0 duplicated
                                               [ Load this batch in Station C → ]
```

### A10. Station B: ADLS access puzzle

```
 ‹h2› Station B · ADLS
 ┌ Panel ─────────────────────────────┐ ┌ Panel ─────────────────────────────────┐
 │ Folder tree (hierarchical namespace│ │ Request: vendor-x needs write access to  │
 │ [on])                              │ │ bronze/vendor-x/ only                    │
 │ lake/                              │ │                                          │
 │  ├ bronze/                         │ │ Grant  (•) Directory ACL  ( ) RBAC        │
 │  │  ├ mes/2026/09/24/              │ │ On     [ bronze/vendor-x/ ▾ ]            │
 │  │  └ vendor-x/     ← target        │ │ Perms  [x] w  [x] x   [ ] r              │
 │  ├ silver/                         │ │ Parents execute: [ ] lake/ [ ] bronze/    │
 │  └ gold/                           │ │                         [blue] Test access│
 └────────────────────────────────────┘ └──────────────────────────────────────────┘
 Result: (Pill:danger) Denied. vendor-x can't traverse lake/ and bronze/ without
 execute (x) on each parent. Note: container-scope RBAC would have worked, but it
 also grants write access to silver/ and gold/.
```

### A11. Phone (390 px)

```
┌──────────────────────────────┐
│ ☰  Lakehouse Lab             │
│ LEARNING LAB · FICTIONAL     │
│ ‹h1› Lakehouse Lab           │
│ (Pill:success) Real engine   │
│ [ Journal (12) ]             │
│ Station [ C · Delta Lake ▾ ] │  ← the rail becomes a select
│ ‹h2› Station C · …           │
│ ① Predict ▸ ② ▸ ③ ▸ ④        │  ← compact stepper
│ ┌ Panel ───────────────────┐ │
│ │ options stack vertically │ │
│ │ [ink] Commit prediction  │ │  ← full-width button
│ └──────────────────────────┘ │
│ Tables scroll inside their  │
│ own container, never the page│
└──────────────────────────────┘
```

- `NARROW_QUERY` (`max-width:768px`) switches the rail to a select, and the journal drawer becomes a full-width sheet.
- The F timeline scrolls horizontally *inside* its panel. `scrollWidth − clientWidth` for the page must be 0.

### A12. Dark mode and large text

- Every surface uses `pb.*` tokens, so dark mode needs no per-component colours. The gate's axe run in dark mode checks this.
- The pill tones (`success`, `warning`, `danger`, `neutral`) come from the existing `Pill` so contrast is already handled. **Don't pick new colours for "real" vs "simulated".**
- Every SVG text element (the F timeline, and any chart) uses `textScale = theme.typography.fontSize / 14`. `fontSizes.test.ts` doesn't cover SVG attributes, so check them by eye at the Large-text setting.
