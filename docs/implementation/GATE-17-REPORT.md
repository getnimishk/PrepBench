# Phase 17 Gate Report — Full Certification Journey and Release Gate

**Date:** 2026-09-16 · **Format:** plan §40, with the release checklist from §44 · **Gate decision: PASS**

---

## Audit first

Phase 17 is the release gate, so it began by running the product rather than reading it: the plan's journeys end to end, every screen opened and every link followed, the API timed against a database the size of a heavy install, the security boundaries probed, and the upgrade path run against a copy of the real database. Everything below was found that way.

| Where | What the gate found |
|---|---|
| Roadmaps, any preparation | The API never returned which preparation a roadmap belonged to, though the column was stored and the response declared it. Every roadmap read as "not linked": another preparation's roadmaps were listed on yours, your own was absent from its group, and the Link button appeared to do nothing. |
| Roadmaps, Design Reviews, Question Bank, local AI models | Items could only be opened with a mouse. The cards and rows carried the click; nothing in them was focusable. |
| Any unknown address | A blank page. No heading, no message, no way back. |
| Exam review, preparation, roadmap, edit preparation, System Design results | No level-one heading (five screens the Phase 15 audit had not visited). |
| Roadmap topic marked complete in an imported file | Shown exactly like one the learner demonstrated, with no way to tell them apart. |
| Review, for a preparation with no mocks | "Nothing to review. Every wrong answer from your mocks has been read." — a claim about reading that never happened. |
| Topic, study guide, demonstrate, edit preparation | Failed with "Could not load…", no reason and no retry (routes the Phase 16 sweep did not reach). |
| The test suites | Every backend run imported the app with its default database, so the app's own startup migrations, seeding and evidence reconciliation ran against the **learner's real database**. Provider tests wrote their fake API keys into the real `.llm_secrets.json`. |
| Starting an 80-question mock, 5,000-question bank | 6.3 s |
| Review queue | 3.0 s |
| Storage report | 5.7 s |
| Checking a 2,000-row import | 57 s |
| Saving a 2,000-row import | 45 s (12,082 SQL statements) |
| Recordings list | One query per recording |
| Any API response over ~300 KB | Stalled in the Vite proxy that serves the app, tens of kilobytes short of the end, until the connection reset. Importing a mid-sized bank hung with no error. |
| Upgrading an existing install | Six indexes that a fresh install has were never created, including `exam_sessions.subject_id` — the column every preparation-scoped query filters on. |

## The journey (§23)

`e2e/certification-journey.spec.ts` runs the plan's flow in one test, in the browser, on the seeded PSM I preparation, with an 80-question bank and one earlier mock behind it:

> select PSM I → Home names the weak area → Insights opens it → Learn → the study plan → its topic → write and read the study guide → demonstrate the topic → practise the area → answer one wrong → the mistake is recorded → open the question → its correct answer and explanation → verify with a different question on the same idea → pass → the schedule moves → new evidence → Insights → a full 80-question mock → the exam review → readiness updated

Every step that changes anything is checked in the database, not in the page: the drill's answer row (`is_correct = 0`), the demonstration and the topic's completion, the guide section's `read_at`, the review check row and the answer's `reviewed_at`, the spaced-repetition rows for both questions, the two mock sessions with their scores, and the domain's 25 answers. The page's own words are checked too, but never instead.

## What the gate found, and what was done

**Isolation.** The roadmap API now returns the preparation each roadmap belongs to. `e2e/isolation.spec.ts` gained the plan's §24 journey: three preparations — two certifications and a skill — each with its own questions, mock or drill, roadmap and evidence, visited in turn and the first revisited, checking questions, roadmaps, review, recommendations, practice history, analytics, scores and evidence, in the browser and in the database.

**Nothing opens by mouse alone.** The roadmap and design review cards carry a real link; a Question Bank row's question text is a button that opens the same detail; a local model card is a button. A browser test opens one of each with the keyboard.

**Nothing leads nowhere.** An unknown address gets a page that says so and offers the way back. `e2e/navigation.spec.ts` opens 44 screens with real data behind them, follows every link each one offers, and fails on any console error or any page without a heading.

**Nothing claims what it did not check.** A topic completed in an imported file says so and offers to be demonstrated. Review says a preparation has no mocks rather than crediting reading. The four remaining screens that failed silently now say what failed, why, and offer Retry.

**The tests keep to their own data.** `tests/conftest.py` points the app's own engine at the test database and the secret store at a temporary folder *before* the app is imported, and refuses to run if the app is not on the test database. A full backend run leaves the real database byte-for-byte identical, verified by hash.

**Performance** (below) and **the upgrade path** (below).

## Performance (§33)

`backend/scripts/perf_gate.py` builds a throwaway database the size of a heavy install — 5,000 questions with 20,000 options, 400 finished sessions with 20,000 answers, 3,000 scheduled questions, a 400-topic roadmap, 500 analysed recordings with 20,000-character transcripts — then times every endpoint a learner waits on and counts the SQL each one issues.

| Endpoint | Before | After |
|---|---|---|
| Start an 80-question mock | 6,338 ms | **152 ms** |
| Review queue | 2,987 ms | **62 ms** |
| Storage report | 5,668 ms | **22 ms** |
| Check a 2,000-row import | 57,483 ms | **684 ms** |
| Save a 2,000-row import | 44,869 ms (12,082 statements) | **1,364 ms (42 statements)** |
| Question listing, 200 per page | 235 ms | **38 ms** |
| Recordings list, 50 rows | 51 queries | **2 queries** |
| Home | 69 ms | 68 ms |

What was wrong, and what it cost:

- **Two foreign keys SQLite never indexed.** `exam_answers.question_id` and `question_options.question_id`. Every "has this been answered" join and every question fetch (options are joined on every one) scanned a whole table per row. Found by query plan — `SCAN` where a `SEARCH` belonged — and fixed in the models and the migration.
- **The near-duplicate check re-normalised the whole bank for every imported row:** ten million regex passes for a 2,000-row file against a 5,000-question bank. The bank is now normalised once and indexed by length; a test compares the new results against the old implementation's, row for row.
- **The recordings list loaded each recording's analysis on its own.** One query now, without the transcripts the list never shows.
- **Imports were written a row at a time** with a savepoint and a verification query each. A chunk is now written in two statements and verified in one; if a chunk fails it is redone row by row, so a bad row is still named and skipped.

**The frontend**, measured on the production build against the same data: app shell visible 0.66 s, route change 0.13 s, Question Bank over 2,000 questions 1.1 s, a 300-topic roadmap 2.0 s, Insights 0.44 s. Bundle: 1.48 MB, 432 KB gzipped, one chunk. `e2e/performance.spec.ts` repeats the large-data screens against the development server on every run, with budgets sized for it.

**A bug this found that no test was looking for:** any API response over roughly 300 KB stalled in the Vite proxy that serves the app — the browser waited for bytes that never came, the proxy reset the connection after a minute, and the screen sat on its loading state with no error. Importing a mid-sized bank was unusable. Large bodies are now sent in 64 KB pieces (`app/core/chunked_body.py`), which the proxy forwards without stalling: the 1.9 MB import report went from a minute-long hang to 0.54 s.

> **Correction, 2026-09-17.** The pieces made the stall rarer, not gone: a 76 KB response hung in a later browser run. The cause was the proxy asking the backend to close every connection, which on Windows can strand the end of a response closed while its reader is paused. The fix is a kept-alive proxy connection. Measurements and the change are in [PARITY-REPORT.md](PARITY-REPORT.md#what-the-regression-found-and-what-was-done).

## Security (§34)

PrepBench is a single-user local application, by decision recorded in Phase 0: no login, bound to localhost. The items below are audited on that basis, and `backend/tests/test_security_boundaries.py` holds the ones that are testable.

| Item | Finding |
|---|---|
| Authentication | None, deliberately. Single user, local machine, no network listener beyond localhost. |
| Authorization / object-level authorization | Not applicable: one user owns everything. What does apply is preparation isolation, proven in `tests/test_preparation_isolation.py` and `e2e/isolation.spec.ts`. |
| Input validation | Pydantic schemas on every endpoint; no route takes a raw dict. Unknown values are refused with 422 rather than coerced. |
| File upload validation | Imports: 10 MB limit, extension allowlist, unsupported types refused with their name. Recordings: 100 MB limit, MIME allowlist (audio only), empty uploads refused. |
| Filename and path handling | An uploaded recording is stored under a server-generated name (uuid4 + `.webm`); the client's filename is never used. Reading, deleting and analysing a recording now resolve the stored path and refuse anything outside the recordings folder. |
| MIME validation | The stored type is constrained to audio and echoed back on download, so a file cannot be served from this origin under a chosen type. |
| XSS | No `dangerouslySetInnerHTML` anywhere in the frontend. Markup in a question is stored and returned as text, in JSON, and React escapes it when rendering. |
| SQL injection | No string-built SQL over user input: every query is ORM or bound parameters. The interpolated `text()` calls are migrations over fixed table and column names. Injection-shaped values in the keyword, domain and certification filters match nothing and change nothing. |
| Prompt injection | Every prompt that embeds submitted text now fences it and tells the model that instructions inside it are not instructions — six builders: system design grading, design review grading, imported-question judging, interview question generation, recording analysis, study guide drafting. The stake here is the learner's own evidence: a score that can be talked up from inside the answer is worth nothing. |
| Secret handling | The database holds a reference, never a key: the OS keyring where available, otherwise an obfuscated local file, documented in the UI as obfuscation rather than encryption. The API returns `has_api_key` and a hint, never the value. Test runs no longer write into the real store. |
| Recording and transcript access | Local files, single user; served only through the recording's own row, with the path guard above. |

## Database integrity (§32)

`backend/scripts/upgrade_check.py` copies the real database read-only (SQLite's backup API), upgrades the copy exactly as a start would — `create_all`, the migrations, the seeders, the evidence reconciliation — and then checks it. On the current install:

- **Rows:** 4,544 before, 4,544 after. Nothing lost.
- **Schema:** 28 tables, **0 differences** from a database created fresh today (it was six missing indexes before the fix).
- **`PRAGMA integrity_check`:** ok. **`PRAGMA foreign_key_check`:** no problems.
- **Orphans:** none — answers without a session or question, options without a question, topics without a roadmap, schedule rows without a question.
- **Serving:** preparations, Home, questions, review queue, insights and storage all answer 200 against the upgraded copy.
- **The original:** byte-for-byte unchanged, verified by hash.

Migrations remain forward-only and idempotent (`tests/test_phase2_migrations.py`, 18 tests), and now create every non-unique index the models declare, so an index added to a model in future reaches existing installs without anyone remembering to write a migration.

## Tests

| Suite | Before Phase 17 | After |
|---|---|---|
| Backend | 674 | **694** (+20) |
| Frontend unit | 663 | **670** (+7) |
| E2E | 53 | **65** (+12) |

Three things the full runs caught, all of them this phase's own work and all fixed: the Question Bank row button added for keyboard access was 20 px tall, under the 24 px a finger needs on a phone; the backup-download test, which by then copies everything every earlier spec created, needed more room than the default timeout; the journey's setup made 160 sequential API calls, which ran out of budget on a loaded machine -- its bank is now imported in one batch, and the journey runs in 2.1 minutes; and the accessibility audit's own budget, which on a fourth consecutive full run was tight enough to time out and leave the dark theme set for the test after it. That test now sets the theme it starts from rather than inheriting one.

New browser tests: the certification journey; three-preparation isolation; navigation and console sweep; persistence of a question edit, a design review decision and topic progress; keyboard opening of three lists; question import in JSON and Markdown with duplicates and Cancel; roadmap import in Markdown and JSON with a refused CSV; large-data performance.

New backend tests: query budgets and the near-duplicate equivalence; chunked import writes with the row-by-row fallback; security boundaries; chunked response bodies; the roadmap's preparation in its API responses; every declared index after an upgrade; a fresh database's foreign-key indexes.

## Files changed

**Backend:** `app/core/database.py`, `app/core/config.py`, `app/core/chunked_body.py` (new), `app/main.py`, `app/llm/prompts.py` (new), `app/llm/secrets.py`, `app/models/exam_answer.py`, `app/models/option.py`, `app/repositories/question_repository.py`, `app/repositories/recording_repository.py`, `app/services/import_service.py`, `app/services/question_validator.py`, `app/services/roadmap_service.py`, `app/services/system_design_service.py`, `app/services/design_review_service.py`, `app/services/content_validator.py`, `app/services/interview_question_service.py`, `app/services/recording_analysis_providers.py`, `app/services/recording_analysis_service.py`, `app/api/v1/recordings.py`, `scripts/perf_gate.py` (new), `scripts/upgrade_check.py` (new), `tests/conftest.py` and seven test files.

**Frontend:** `src/App.tsx`, `src/pages/NotFoundPage.tsx` (new), `RoadmapListPage`, `DesignReviewListPage`, `ExamReviewPage`, `SubjectPage`, `SystemDesignResultsPage`, `PreparationEditPage`, `RoadmapTopicPage`, `TopicGuidePage`, `TopicDemonstratePage`, `ReviewPage`, `components/question_bank/QuestionTable.tsx`, `components/question_bank/ImportModal.tsx`, `components/settings/LocalSetupWizard.tsx`, `vite.config.ts`; `e2e/db.ts`, `e2e/node-sqlite.d.ts`, four new specs and three extended ones.

## API / DB changes

- **No new endpoints, and no changed request or response shapes.** One response *value* was fixed: a roadmap now reports the `subject_id` its schema always declared.
- **Database:** two new indexes (`exam_answers.question_id`, `question_options.question_id`) on the models and in the migration, plus a migration step that creates every non-unique index the models declare. No tables, columns or data changed. Additive and idempotent; verified on a copy of the real database.

## Known limitations

- **The app is served by the Vite development server**, which is also how the release measurements had to be taken for the in-app screens. The production build is faster by roughly four times on render-heavy screens; the numbers above give both.
- **One JavaScript bundle** (432 KB gzipped). Route-level code splitting would cut the first load; at 0.66 s to a usable shell on this machine it was not worth the risk during a release gate.
- **Submitting a mock issues one schedule update per question** (354 statements for an 80-question paper, 612 ms). Correct and within budget, but it is the one write path that still scales with the paper.
- **Prompt injection is mitigated, not solved.** A fenced prompt is the strongest defence available to a client of someone else's model; a determined instruction inside an answer may still influence a weak model. The feedback says so when it notices.
- **The obfuscated key file is not encryption**, and says so in the product. A key in the OS keyring is only as strong as the account.
- **No visual regression suite** (§36). The prototype was the reference throughout, and deviations were recorded in earlier gate reports; nothing compares screenshots automatically.
- **Your real `.llm_secrets.json` holds entries earlier test runs wrote.** They are inert leftovers, and no new ones can appear. Remove them by deleting the file and re-entering the key in Settings → AI providers, if you want it clean.

## Release checklist (§44)

| Item | Result |
|---|---|
| Every prototype screen implemented | PASS — 59 screens; the registry records each one |
| Every primary CTA implemented | PASS |
| Every form persisted | PASS — reload tests per form |
| Every relevant API audited | PASS — §8 protocol per phase; OpenAPI snapshot under test |
| Every relevant DB change audited | PASS — §7 protocol per phase |
| All required migrations created | PASS — forward-only, idempotent, verified on a copy of the real database |
| No accidental breaking API changes | PASS — snapshot test; one value corrected to match its own schema |
| Preparation isolation verified | PASS — backend, browser, three preparations |
| No production dependency on fixture metrics | PASS — Phase 12/13 fixture audit; nothing renders a number without a source |
| Question CRUD, question import, roadmap import | PASS |
| Learning, practice, review, mock exam | PASS |
| Interview recording flow | PASS |
| System design, design reviews, sandbox | PASS |
| Insights and recommendations from evidence | PASS |
| Settings, onboarding | PASS |
| Loading, empty, error, offline states | PASS — Phase 16 |
| Accessibility gate | PASS — Phase 15, plus the keyboard and heading gaps this phase found |
| Responsive gate, dark mode | PASS — Phase 15 |
| Unit, integration, E2E tests pass | PASS |
| Full regression passes | PASS — backend 694, unit 670, browser 65/65 green in one run |
| Clean DB migration, upgrade migration | PASS |
| Security checks | PASS, on the single-user basis recorded above |
| Performance checks | PASS |
| No console errors | PASS — 44 screens and every link |
| No dead navigation | PASS — unknown addresses answered; every link followed |
| No fake save/complete/import/schedule | PASS — Phases 5, 10, 12, 16 |
| Final gate report says PASS | PASS |

## The last run

Backend 694 passed. Frontend unit 670 passed, 62 files. Browser 65 passed, 21.7 minutes, no failures and no flakes. Typecheck clean; lint 0 errors and the same 16 warnings this repository started the phase with. The performance gate passes with every endpoint inside its budget and no query count that grows with the rows. The upgrade check passes against a copy of the real database. The real database's hash is identical before and after the whole run.

## Gate decision

**PASS.** Phase 17 is complete, and with it the 17-phase plan.
