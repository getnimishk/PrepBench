# 00 — Test Audit

**Date:** 2026-09-12 · **Both suites run at audit time, both green.**

---

## 1. Baseline — measured, not assumed

| Suite | Command | Result | Duration |
|---|---|---|---|
| Backend | `cd backend && ./.venv/Scripts/python.exe -m pytest -q` | **465 passed**, 6 warnings | 103s |
| Backend coverage | `… --cov --cov-report=term` | **82%** (6,895 statements, 1,208 missed) | ~110s |
| Frontend | `cd frontend && npm test` | **471 passed**, 45 files | 145s |

**Total: 936 passing tests.** This baseline must not regress. Any phase gate that
reports fewer than 465 backend / 471 frontend passing tests without a documented
deletion has failed.

Warnings present at baseline (pre-existing, not introduced by this programme):
Starlette `httpx` deprecation, Pydantic class-based `Config` deprecation, and
three `HTTP_413`/`HTTP_422` status-constant renames. Worth a separate cleanup;
out of scope here.

---

## 2. Backend test suite — 38 files

### Strong coverage already exists for the plan's hardest rules

`test_product_invariants.py` (454 lines) is the standout. It already enforces
several rules the plan treats as new requirements:

| Test | Plan rule it enforces |
|---|---|
| `test_a_filter_that_matches_nothing_fails_instead_of_widening` | Rule 8 — no silent fallback to a wider set |
| `test_weak_topic_focus_with_no_weak_topics_fails_instead_of_widening` | Rule 8 |
| `test_review_focus_with_nothing_due_fails_instead_of_widening` | Rule 8 |
| `test_a_mock_takes_its_scope_from_the_subject_alone` | §9 / §24 — preparation isolation |
| `test_a_mock_without_an_exam_profile_is_refused` | §8 — no cross-preparation exam |
| `test_a_short_session_cannot_be_recorded_as_a_mock` | §37 — no fixture-grade evidence |
| `test_a_client_cannot_declare_its_own_provenance` | §34 — client cannot forge `source` |
| `test_quarantined_evidence_does_not_reach_readiness` | §19 — insights derive from valid evidence only |
| `test_quarantined_evidence_does_not_reach_the_activity_timeline` | §19 |
| `test_a_subject_with_no_mocks_reports_needs_evaluation_not_zero` | §22 / §37 — no invented zero |

`test_schema_and_ownership.py` (270 lines) covers preparation ownership directly:

- `test_the_mapped_subjects_get_their_own_reviews`
- `test_a_subject_that_owns_no_reviews_gets_none_rather_than_a_sentinel`
- `test_an_unmapped_subject_reports_no_reviews_even_when_reviews_exist`
- **`test_ownership_cannot_be_claimed_by_a_lookalike_slug`** — this is the
  string-match isolation weakness from the data-model audit, *already under test*
- `test_system_design_prompts_belong_to_exactly_one_subject`
- `test_the_dead_settings_columns_are_gone_from_the_table` +
  `test_nothing_in_the_application_reads_a_dead_settings_column` — a schema-hygiene
  guard worth keeping green when `review_daily_cap` is added

**Consequence for Phase 3:** the preparation-isolation work has a test foundation
already. Extend these two files rather than starting an isolation suite from
scratch.

### Coverage by area

| Area | Files | Notable |
|---|---|---|
| Exam / practice | `test_exam_engine.py`, `test_questions.py`, `test_product_invariants.py` | Engine rules well covered |
| Review / SM-2 | `test_review_check.py` (416), `test_review_experience.py` (483), `test_review_fixes.py`, `test_sm2_service.py` | Strongest area |
| Roadmaps | `test_roadmaps.py` (662) | Largest single file; import paths well covered |
| Design reviews | `test_design_reviews.py` (495) | Grading + axis verdict |
| System design | `test_system_design.py` (440) | Drafts, attempts, rubric |
| Interview / recordings | `test_interview_questions.py`, `test_recordings.py`, `test_recording_analytics.py` | Upload limits, analysis status |
| LLM layer | `test_llm_layer.py`, `test_llm_config_api.py`, `test_llm_config_and_routing.py`, `test_llm_secrets.py` (258), `test_local_setup.py` | Secret handling tested |
| Home / readiness | `test_home.py` (339), `test_readiness.py`, `test_weak_topics.py` | |
| Explanations | `test_explanation_surfaces.py` (589) | Second-largest file |
| Schema / seed | `test_schema_and_ownership.py`, `test_seed_ledger.py`, `test_database_pragmas.py`, `test_settings_reset.py` | |
| API-level "E2E" | `test_e2e_full_suite.py` (313), `test_e2e_regression.py` (486) | See §4 |

### Weakest coverage — where a change is riskiest

| Module | Coverage | Risk for this programme |
|---|---|---|
| `services/integrity_check_service.py` | **0%** | Untested; avoid touching without adding tests first |
| `utils/build_scrum_guide_index.py` | **0%** | Network + AI; relevant if study-guide content reuses it (A-5) |
| `utils/seed_data.py` | **0%** | Relevant to any seeding change |
| `utils/verify_question_bank.py` | **0%** | |
| `services/content_validator.py` | **30%** | **Directly on the Phase 6 import path** |
| `services/import_service.py` | **60%** | **Directly on the Phase 6 import path** |
| `repositories/question_repository.py` | **62%** | **Directly on the Phase 3 isolation path** |
| `services/recording_analysis_providers.py` | 64% | Phase 9 |
| `services/analytics_service.py` | 72% | Phase 13 |
| `repositories/analytics_repository.py` | 75% | Phase 13 |

> **Three of the four phases with the largest gaps (3, 6, 13) touch the
> least-covered modules.** Raise coverage on `question_repository`,
> `import_service` and `content_validator` *as part of* those phases, not after.

---

## 3. Frontend test suite — 45 files, 471 tests

Co-located `*.test.tsx` beside each page/component. Notably present:

- Page tests for every major page: `HomePage.test.tsx` (527),
  `ChartSandboxPage.test.tsx` (691), `QuestionBankPage.test.tsx` (375),
  `RoadmapDetailPage.test.tsx` (299), `ExamReviewPage.test.tsx` (277),
  `ReviewPage.test.tsx` (271), `DesignReviewPage.test.tsx` (265)
- Pure-logic tests for the metrics engine: `invariants.test.ts` (547),
  `integrity.test.ts` (494), `progress.test.ts` (303), `params.test.ts` (243),
  `workflow.test.ts` (251), `charts.test.ts`, `chartData.test.ts`
- Component tests: `LearningPanel.test.tsx`, `AIProvidersSection.test.tsx`,
  `LocalSetupWizard.test.tsx`

`services/metrics/invariants.test.ts` and `services/learning/integrity.test.ts`
(1,041 lines together) are the frontend counterpart of
`test_product_invariants.py` — they guard the sandbox/learning model's honesty
(e.g. a prediction cannot be amended after the outcome is visible). **These are
the tests that must keep passing when `attempts.ts` moves to the backend (A-1).**

`vite.config.ts` raises `testTimeout` to 20s with a documented reason (MUI dialog
round-trips in jsdom measure ~7s). Do not lower it; do not add retries.

### Gaps

- **No coverage measurement at all.** No `--coverage` in `npm test`, no threshold
  in CI. Backend has 82% measured; frontend has an unknown number.
- **No accessibility assertions.** No `jest-axe`/`vitest-axe`. Plan §21 requires
  keyboard navigation, focus management, modal focus trap, screen-reader
  semantics, reduced-motion. None of that is currently asserted anywhere.
- **No responsive assertions.** Plan §21 requires 1280/1024/768/430/390. jsdom can
  test breakpoint logic but not layout; real viewport testing needs a browser.
- **No dark-mode assertions** beyond `ThemeContext` unit behaviour.

---

## 4. E2E — the largest testing gap

**There is no browser E2E framework.** No Playwright, no Cypress, no Puppeteer, no
Selenium — verified across `frontend/package.json`, `backend/requirements*.txt`
and `.github/workflows/`.

The two files named `test_e2e_*.py` are **API-level integration tests** driven by
FastAPI's `TestClient`. They are good tests — `test_e2e_full_suite.py` walks
upload → validate → import → exam → answer → finish → analytics — but they never
render a component, never click, never reload a page, and never exercise routing.

### What the plan requires that this cannot do

| Plan section | Requirement | Needs a real browser? |
|---|---|---|
| §9 | Preparation switch E2E | Yes |
| §14 | `reload → resume` mid-exam | **Yes** — reload is the assertion |
| §23 | 17-step certification journey | Yes |
| §24 | Three-preparation isolation journey | Partly — DB assertions could be API-level |
| §25 | Interview record → playback → compare | **Yes** — `getUserMedia`/`MediaRecorder` |
| §30 | "survives navigation, hard reload, browser restart" | **Yes** |
| §36 | Visual regression vs the prototype | **Yes** |
| §21 | Responsive at 5 widths, dark mode, focus | **Yes** |

**Six of the plan's eight E2E journeys and its entire persistence/reload,
accessibility, responsive and visual-regression gates require a browser harness
that does not exist.**

### Recommendation

Add **Playwright** in Phase 3, before feature work, because:

- It is the only way to satisfy §30 (hard reload), §14 (resume), §21 (viewports,
  dark mode, focus) and §36 (screenshots)
- It handles `getUserMedia` via `--use-fake-device-for-media-stream`, which is
  required for §25 and cannot be faked in jsdom
- It can assert database state by calling the API in the same test, satisfying
  §23's *"must assert database state, not just visible text"*
- One new devDependency + one CI job. This is **not** speculative architecture
  under Rule 3 — the audit proves the necessity (plan §23/§25/§30 are
  unsatisfiable without it)

Deferring it means every phase gate from 3 onward reports "E2E: not run", which
makes the gates meaningless.

---

## 5. CI

`.github/workflows/ci.yml`, on every push and PR, with `cancel-in-progress`:

- **backend**: Python 3.14, `pip install -r requirements.lock` (the lock, not
  `requirements.txt` — pins transitives), `pytest -q --cov --cov-report=term-missing`
- **frontend**: Node 22, `npm ci`, then `lint` → `typecheck` → `test` in that
  order, deliberately: *"both fail in seconds and catch a whole class of breakage
  the test suite would take three minutes to reach."*

The workflow header records why it exists: *"There was no CI at all. 340-odd tests
existed and nothing ran them but a person remembering to, which is how a reset
endpoint kept eleven tables for months without anyone noticing."*

### Missing CI jobs

| Job | Needed by | Priority |
|---|---|---|
| E2E (Playwright) | §9, §14, §23–30 | **High** |
| Frontend coverage + threshold | §35 | Medium |
| Visual regression | §36 | Medium |
| Accessibility (axe) | §21 | Medium |
| Performance smoke | §33 | Low |
| Backend coverage threshold (currently measured, not enforced) | §35 | Low |

---

## 6. Test rules to carry through every phase

1. **936 is the floor.** Every gate report states both numbers.
2. Extend `test_product_invariants.py` and `test_schema_and_ownership.py` for
   isolation work; do not start parallel suites.
3. Extend `services/metrics/invariants.test.ts` and
   `services/learning/integrity.test.ts` when the learning store moves server-side
   — those tests are the honesty guarantee and must pass against the new backing.
4. Every migration step gets two tests: run-twice (idempotent) and
   against-`create_all` (fresh DB).
5. `unauthorized`/`forbidden` cases from plan §8 are **not applicable** — do not
   write tests asserting a 401 the app cannot produce.
6. Raise coverage on the module you are changing, in the same phase.
