# CLAUDE.md — PrepBench

Local-first exam, interview, and system-design prep app. React 19 + TypeScript frontend,
FastAPI + SQLAlchemy + SQLite backend. No account, no telemetry; a network call happens
only if the user configures a cloud AI provider.

## Status

The UI has been rebuilt to match `PrepBench_Unified_Prototype.html` (kept outside the
repo — ask the user for it if you need it) across every screen, verified by rendering the
prototype and the app side by side, not by a registry field or a past claim. A full
accessibility pass (axe, light and dark) and a full 390px layout pass have been run across
every screen and are clean. This work is merged into `main` (PRs #25, #26, #27).

The unified-prototype integration (Phases 1-4, the Phase 4 hardening, the 2026-10-07
stabilization and the Phase 5 contract) is on `feat/prepbench-phase1-4-production-integration`
and is **merged into `main` as PR #75** (merge commit a399f29, 2026-10-07; includes the review fix
f77eabc). Phase 5 (ADF Behaviour Lab) and the learning-attempt scope hardening are merged (PRs #76,
#77; `main` @ 19c335d). Phase 6 (Workspace + Evidence) is merged (PR #78, `main` @ f972878).
Phase 7 (Curriculum & Knowledge Layer) is merged (PR #79, `main` @ 40e9319). Phase 8 (production
readiness and full-system validation) is merged (PR #80, `main` @ f7426d2). The original
foundation roadmap (Phases 1-8) is complete; further work is normal product evolution.

**After Phase 8 (2026-10-09 to 2026-10-10), all merged:** #81 archived-roadmap restore and the
"no guide sections" wording; #82 interview questions scoped to the asking preparation (id routes
take `subject_id`; another preparation's question is a 404, like an unknown id); #83 capabilities
matched by slug, the Interview hub's tracks linked by live slug, and interview-session reads scoped
(a session holding a preparation's question is reachable only as that preparation; shared-only
sessions read anywhere; others get the unknown-session 404, on read, report, finish and take upload);
#84 and #87 `docs/implementation/lakehouse-p1-handoff.md` (briefs, safeguards, a "Common mistakes"
list from real reviews); #85 Station D (Reconciliation Detective, P1-2); #86 interview questions from
lab results (P1-1); #88 AI feedback on acceptance criteria (P1-6, new `LLMTask`, advice only, never
`correct`, nothing stored); #89 Station I (identity and governance, P1-5). **Lakehouse Lab Phase 4 is
complete** (P1-4 was delivered by the role diagnostic). Station I's facts come only from
`docs/research/lakehouse-p1-5-identity-governance-research.md` (revision 2: every fact checked against
an official page on 2026-10-10), held to it by `identityModel.test.ts`; a new fact goes through the
research file first.

**Usage phase (from 2026-10-10).** The prototype is complete; the learner is now using PrepBench.
Fix what real use exposes; new features wait unless asked for (Windows and iOS apps come later). The
learner is learning these subjects through the app, so never ask them to fact-check technical content:
verify claims against official sources, enforce sourcing with tests, leave out what can't be confirmed.
Open, not urgent: the recordings list is unscoped (any preparation lists every take, and a take's title
holds the start of its question's text: a product decision). (Station D's Evidence wording and the
Certification hub's id links were fixed in #90.) Full Playwright runs here use
`PREPBENCH_E2E_WORKERS=3`; close the learner's app first, and run one suite at a time.

**The learning journey (roadmap → topic → guide → practice → demonstration), 2026-10-28.** One rule names
the next topic everywhere -- Home (skill tracks), the roadmap panel and phase rows, a finished topic's
"Next:", the Study Library and the chapter's topic strip: `services/roadmapNext.ts` (in progress first,
else the first open topic after the most recent completion, wrapping; never a copy of the rule). A skill
track's Home is led by its roadmap, never by mocks (rule 12). Finished practice (scenario checks, lab
stages; evidence items carry `correct`) changes a topic's recommended next step and names each miss, but
never its status: only a demonstration completes a topic. A finished ADF lab run's explanation is
read-only. Topic prerequisites are not recorded anywhere, so none are shown -- adding them is a data decision.

**The Apache Kafka study guide (pack `kafka`, v1, 2026-10-28).** 21 chapters covering all 45 topics of the
learner's Apache Kafka Mastery Roadmap (every topic Full), with hands-on steps for the learner's own Kafka 4.3 KRaft
install on Windows, written against the 4.3 docs. Every fact traces to `docs/research/kafka-documentation-notes.md`
(Apache Kafka 4.3 and named Confluent pages, plus the 4.3 source where the docs are silent); §20 there records where the
learner's ChatGPT-era notes and images disagree with the docs, and the guide follows the docs. Chapters are written
as Markdown in `backend/app/content/packs/kafka/src/` and built into the newest `v<N>.json` by
`backend/scripts/build_content_pack.py`; edit the sources and rebuild, never the JSON (`tests/test_kafka_pack.py` fails if they differ, a table isn't last in
its section, a section is cited that the notes lack, or a 4.3-deprecated tool option appears). Packs attach only to
skills (the settled D1; the learner chose to keep it), so the guide is for a **separate "Kafka" skill**: CCDAK stays
the certification. Moving the Kafka roadmap from CCDAK to that skill is a learner action (Roadmaps: unlink, then
assign), never done from code. **v2 (2026-10-28) adds 18 written scenarios** in four levels, in ADF's format (check,
case, debrief, a lens and a Say-it question per role), one JSON file each under `src/scenarios/`; chapters' practice
links are built from the scenarios, and scenario facts trace to the same notes. **v1 (the guide alone, PR #109) is
published and never changes** (pinned by fingerprint); the learner upgrades to v2 in the app.
**The CCDAK question bank (2026-10-29)** is `backend/app/content/question_banks/ccdak/`: a JSON file the learner imports on
the Question Bank screen (`certification: "CCDAK"`, matched exactly), built from one source file per exam section by
`backend/scripts/build_question_bank.py`; edit the sources and rebuild, never the JSON. It follows Confluent's April 2025
exam guide: six sections by weight, 300 questions (69 / 84 / 36 / 45 / 24 / 42): Fundamentals and Application Development
in #113, Streams, Connect, Testing and Observability in the second PR, with `ccdak_question_bank_sections-3-6.json` (a
`parts` entry in `src/bank.json`) for a learner who imported the first 153, since the import warns about duplicates but
adds them. Every question cites `docs/research/ccdak-exam-research.md` (sections 9-16, Streams to metrics, were read from the
4.3 docs' own source files in apache/kafka, after a page summary got a default wrong) or the Kafka notes, and
`tests/test_ccdak_question_bank.py` holds it to the import validator (no errors or warnings), four or more options, its
sources, the section counts, the part files, an even spread of right-answer positions, the right answer the longest option
in at most 30% overall and 40% of any section, and no out-of-scope topic (ksqlDB, RBAC, CFK, ZooKeeper). Confluent
publishes no question count or pass mark; the bank never claims one. Importing it is the learner's action; nothing is loaded from code.
**Known gap (open, a product decision):** the exam guide names four item formats (multiple-choice, multiple-response,
matching, build list), but PrepBench presents every question as options to pick (`QuestionType` lists `drag_and_drop`,
yet nothing renders or grades a match or an order), so the bank tests matching and ordering skills as multiple-response
questions. Supporting the real formats means a new question type in the exam
runner, review and import; until then, never claim the bank reproduces the exam's formats.
**The Kafka Lab (2026-10-28)** is `docs/implementation/KAFKA-LAB-CONTRACT.md`: six beginner experiments at `/lab/kafka`
(log, keys, groups, commits, replication, failures with modes poison and retries) on the ADF lab's runner, made
lab-neutral by a `LabSpec` (`services/adfLab/lab.ts`; Kafka's in `services/kafkaLab/lab.ts`). Its attempts are `kb:` /
`kafka.lab.` / `kafka-lab=`; **the ADF lab's ids, routes and titles are unchanged** (pinned in `kafkaLab/lab.test.ts`).
Any preparation with the `kafka` pack gets `learningLab` from the registry's status. Models are pure, graded only from
their own runs, and draw a picture of the cluster (`LabPicture`); every `fact` coupling names its guide chapter and every
Retrieve quote is checked word for word against the pack. Evidence and Workspace show its runs as lab runs with
`ref.lab = "kafka"`; ADF items are unchanged. Scope is six; changing it is a product decision.

**Databricks (research only, 2026-10-29).** `docs/research/databricks-documentation-notes.md` is the source of fact for
all Databricks material, as the Kafka notes are for Kafka: docs.databricks.com, Azure Databricks on Microsoft Learn, the
Delta protocol and Apache Spark 4.2 pages, read as page text (not summaries), plus both exam guides read in full (Data
Engineer Associate, guide of 6 Aug 2026; Professional, guide of 9 Oct 2026). Neither exam publishes a pass mark; never
state one. §19 there lists what the docs don't confirm (no `DENY` statement in Unity Catalog SQL despite the Associate
guide; "standard connectors"; the Professional page/guide mismatch); a new fact goes into the notes first.
`docs/implementation/DATABRICKS-GAP-REPORT.md` is the proposal (roadmap, guide, scenarios, a 300-question Associate
bank, six lab experiments, interview material). **Nothing is built until the learner approves it**: which certification,
whether it becomes its own preparation, and the build order are their decisions.

**Settled decisions, don't reopen these:**
- The header Settings button stays, even though it isn't in the prototype — kept for
  quick access, at the user's request.
- Profile's roadmap-hours figure is labelled "planned hours completed" (it sums the
  roadmap's *estimated* hours for completed topics, not time actually spent).
- Chart text (SVG labels on Home's score chart) scales with the Large-text setting via
  `textScale = theme.typography.fontSize / 14`. Apply the same pattern to any new SVG
  text.
- **Subject Capability Truth & Invariant Scoping (Phase 1)**: Capabilities reflect genuine
  production data, not `subject.kind` or aspirational plans. Centralized in
  `frontend/src/types/capabilities.ts` and `frontend/src/services/capabilities.ts`, and
  exposed through `usePreparation().capabilities`. Missing subject context (`subjectId = null`)
  strictly evaluates to `UNASSIGNED_CAPABILITIES` (all capability flags false, safe unassigned
  scratchpad defaults `workspace: true`, `evidence: true`), and **never** defaults to ADF or
  PSM I. ADF is strictly a Skill (no certification mocks); Kafka CCDAK is registered as a
  Certification but currently has 0 questions loaded in database (`questionAvailability: false`,
  mock assembly disabled). PSM I (1) and System Design (3) each have a roadmap row linked
  (`roadmap: true`) -- but see the data note under Phase 4 stabilization: both are the same
  off-topic "Storage FileSystems" roadmap.
  - **Capabilities come from the live record, not only the static table (stabilization,
    2026-10-07; slug-only since PR #83, 2026-10-09)**: `getSubjectCapabilities(subject)` applies the
    six-subject table when the record's slug matches an entry **exactly** -- never by id, so a recreated
    System Design at id 33 keeps its rounds and another preparation holding id 3 gets nothing of System
    Design's (a bare numeric id still reads the table: avoid passing one); a derived profile gets
    `interview` from the ADF pack or any attached pack with written scenarios (their Say-it questions; Kafka v2, 2026-10-28) or from `lab_interview_question_count > 0`
    (P1-1, PR #86 -- never a hand-set flag); question counts always come from the record (so Kafka
    unlocks the moment a bank is really imported); a preparation the table does not describe (every
    learner-created one) gets a profile derived from its own `kind`, `question_count` and
    `content_packs` -- never `UNASSIGNED`, which used to disable Practice/Exam/Question Bank for a
    learner's own certification. Always pass the Subject record, not `subject.id`.
- **Shell, Branding & Dynamic Navigation (Phase 2)**:
  - Official commercial brand is **PrepBench** with official tagline **"Technical Capability, Proven."**
  - Authoritative 3D isometric faceted mark (`BrandMarkIcon` with 7 precision facets and monochrome mode) and full wordmark implemented in `frontend/src/components/common/BrandLogo.tsx`.
  - PWA and document metadata updated in `frontend/index.html` (title: "PrepBench — Technical Capability, Proven.", favicon, Apple touch icon, manifest in `frontend/public/assets/brand/`).
  - Focus layout header (`FocusLayout` / `Navbar minimal`) renders `<BrandLogo variant="full" size={28} />` without navigation links (`to`) to protect in-progress exam attempts and recording sessions from accidental navigation loss.
  - Sidebar rail is capability-aware: items unsupported by the active subject render as non-clickable disabled buttons (`disabled`, `aria-disabled="true"`, `opacity: 0.35`, `cursor: not-allowed`, tooltip explaining `${item.label} (Not configured for ${subjectName})` or `Integration pending`) via `isNavKeySupported()`.
  - Responsive navigation: 238px desktop rail, 76px icon rail below 1080px with centered icons and tooltip labels. Active subject context card rendered at sidebar footer.
  - Large-text accessibility compliance: all typography adheres strictly to `(theme) => theme.typography.pxToRem(...)` as guarded by `src/theme/fontSizes.test.ts`.
- **Unified Home & Learning Lab Availability Invariant (Phase 3)**:
  - Grounded in the Five Connected Capabilities and the 5 decisive architectural questions:
    1. What am I preparing for?
    2. Am I ready? (Formal verification verdict from production readiness API separated from coaching interpretation)
    3. What should I learn next?
    4. What can I practice?
    5. What can I experiment with? (Learning Lab understanding engine)
  - **Target Architecture vs Current Production Availability**: Capability profiles support `learningLabStatus: 'AVAILABLE' | 'INTEGRATION_PENDING' | 'UNAVAILABLE'`.
    - Databricks Lakehouse Lab: `AVAILABLE` (live in current production).
    - ADF Behaviour Lab: `AVAILABLE` since Phase 5 (2026-10-07) -- derived, not hand-set: `adfLabStatus()` in `services/adfLab/experiments.ts` gives `INTEGRATION_PENDING` the moment any of the five experiments is marked not built, and Home falls back to its pending cards (`Pill tone="warning"`, disabled `Behaviour Lab (Integration Pending)`), still covered by tests that hold the pending profile explicitly.
    - Forward-compatible auto-enablement: Transitioning `learningLabStatus` to `'AVAILABLE'` in Phase 5 immediately activates all CTAs and experiment links without redesigning Home.
- **Certification & Interview Integration (Phase 4)**:
  - **Terminology Discipline**: Databricks Data Platform is exclusively termed **"Lakehouse Lab" / "Open Lakehouse Lab"** (never "Behaviour Lab"). ADF retains "Behaviour Lab (Integration Pending — Phase 5)".
  - **Single Source of Truth**: Reused the production certification engine (`/exams`, `ExamRunner`, `ExamReview`, `ExamSetupPage`, `getMockHistory`, `getReviewCounts`), interview engine (`getSystemDesignPrompts`, `getDesignReviews`, `getInterviewQuestions`, `getRecordings`), and readiness engine. Did NOT create second certification, interview, or readiness calculators.
  - **Capability-Aware Certification Hub (`/certification`)**: Answers the 5 core certification questions: (1) Target credential profile, (2) Authoritative production readiness verdict (`READY`, `NOT READY`, `NOT MEASURED YET`, `DATA NOT AVAILABLE`) read from `readiness.state` exactly as Home reads it -- the hub must never compute its own verdict (it used to, from streak + recency alone, ignoring domain floors), (3) Qualifying evidence (streak, recency, domain breakdown, all driven by `readiness.rules`), (4) Practice recommendations (targeted drills, spaced repetition queue, question bank), (5) Direct mock start with active sittings or honest disabled lock (`0 Questions Loaded` for Kafka). Non-certification tracks (ADF, Databricks, System Design) render `CapabilityUnavailablePage` without silent switching.
  - **Capability-Aware Interview Hub (`/interview`)**: Answers the 5 core interview questions: (1) Rehearsal formats (System Design Prompts, Design Reviews, Verbal Rounds, AI Rubric), (2) Technical competency evaluated (Distributed Architecture vs Pipeline Reliability), (3) Live production modes, (4) Historical recording & studio attempt ledger, (5) Next unattempted challenge recommendation. Non-interview tracks (PSM I) render `CapabilityUnavailablePage` without silent switching.
  - **No Silent Fallbacks**: Direct navigation to `/certification` or `/interview` without subject context renders transparent track pickers rather than defaulting to PSM I or System Design. Direct navigation on unsupported subjects renders `CapabilityUnavailablePage` explaining the credential/skill distinction and offering one-click transitions to capable tracks.
  - **Question-Count Invariants**: `ExamSetupPage` and `HubPages` (`PracticeHubPage`) block mock exam assembly and drill launching when `question_count === 0` (e.g. Kafka CCDAK) with explicit warnings, preventing runtime failures while preserving question bank inspection.
- **Subject Isolation Hardening (Phase 4 hardening — do not reopen)**:
  - Subject scope is enforced exclusively via `Question.subject_id` (FK, indexed). Certification-string token matching was removed; it was the mechanism by which PSM I questions could leak into a Kafka session.
  - `ExamEngine._select()` resolves a subject from `req.subject_id` (direct FK lookup) or, for legacy `certification`-string-only callers, via `SubjectRepository.get_by_certification(cert.strip())` — never via token/ILIKE domain matching. The "no questions" refusal checks `QuestionRepository.count_for_subject(subject.id)` **before** the global `count() == 0` check, so Kafka (0 questions) returns a correct refusal even when PSM I questions exist globally.
  - `ReviewService.pick_check_question()` → inner `candidates()` filters by `Question.subject_id == missed.subject_id` (or `Question.certification == missed.certification` as a legacy fallback). A check question can never cross subject boundaries.
  - `QuestionBankPage` honours the `?subject=` URL query parameter (`effectiveSubjectId`) for direct links from `CertificationHubPage` (e.g. `/question-bank?subject=4`), computed immediately from the URL so the API call is scoped correctly before the preparations list has loaded. `ExamSetupPage` is the **opposite**: header context (`selectedId`) strictly wins over any `?subject=` URL param (tested and pinned by `'follows the preparation picked in the header, not the address'`).
  - Regression suites: `backend/tests/test_subject_isolation_hardening.py` (8 tests — Kafka refuses with 0 questions, no PSM→Kafka token overlap, Kafka mock/drill refused with 400, review queue subject boundary, PSM I positive control, certification-string-only refusal for Kafka, Kafka spaced-review deck/count/drill empty while PSM I cards are due) and `backend/tests/test_preparation_isolation.py` (17 tests). Both must pass green at all times. Frontend: `CertificationHubPage.test.tsx` subject-switch isolation test and `QuestionBankPage.test.tsx` `?subject=` URL param test also pin these invariants.
- **Phase 4 stabilization (2026-10-07 -- do not reopen)**:
  - **No silent PSM I default.** `PreparationProvider` resolves a missing, invalid or deleted
    stored choice to `null` (and clears the stale id); it never selects `list[0]`. ExamSetup,
    Practice, Insights and the Preparations "current" card no longer infer a subject either: with
    nothing chosen they say so. An explicit `?subject=` on ExamSetup still counts as a choice.
    E2E specs must `pickPreparation()` before anything preparation-scoped -- nothing is chosen for
    them.
  - **No fabricated figures.** The Interview hub holds each source as read-or-null and shows
    "… unavailable" on failure (it used to show "10 Tradeoff Reviews" whenever that list failed).
    No `?? 85` / `?? 80` / `?? 60` / `?? 75` stand-ins for a missing exam profile anywhere: say
    "No pass mark set" / "No exam format set". A certification with questions but no exam profile
    is told to add one, not "0 questions".
  - **ADF interview stays `true`, on evidence**: the pack ships a Say-it question for each of 4
    roles in all 18 scenarios (72), and ScenarioPage saves the learner's answer under the ADF
    preparation (`PUT /interview-questions/by-source`, unique on source_ref + subject_id). The
    shared, subject-less interview library (36 questions) is never presented as ADF's own; the ADF
    hub counts ADF's saved questions and leads to its scenarios. `capabilities.test.ts` ties the
    flag to the pack content.
  - **Headings**: in the Phase 1-4 screens a `Typography` with a heading variant
    (`h1`-`h6`, `subtitle1`, `subtitle2` -- MUI maps the subtitles to `<h6>` and the theme does
    not override it) must set `component`: a real heading at the right level, or `"p"`. Card
    backgrounds use `'pb.surface2'`, never `'action.hover'` (failed dark-mode contrast).
  - **Known data issues, not fixed (data/content task, Phase 7 or a dedicated remediation):**
    roadmaps 3 (PSM I) and 4 (System Design) are the identical "Storage FileSystems to Cloud
    Mastery Roadmap" (13 phases, 63 topics, 188h) -- off-topic for PSM I; all 36
    `interview_questions` have `subject_id` NULL; the real DB still holds old test rows from
    2026-08-10 (questions 501-503 `UnitTestCert-*`, exam sessions 8-10 with `source='test'`).
    Never "fix" these by editing the learner's database from code or tests.
  - **Learning attempts are scoped to a preparation (pre-Phase-6 hardening, 2026-10-08 -- do not
    reopen)**: every request that reaches one attempt by uid -- `GET`/`PATCH
    /learning/attempts/{uid}?subject_id=`, a retried `POST`, the Lakehouse op gate -- answers only
    for the attempt's own preparation. Another preparation's attempt gets the same 404 as an unknown
    uid; a `POST` of a uid another preparation holds is a 409 with none of its data; omitted
    `subject_id` means "no preparation" (the Chart Sandbox's attempts), never "any"; an attempt
    cannot be moved between preparations (PATCH `subject_id` change is a 400).
    `patchLearningAttempt(uid, body, subjectId | null)` makes the scope a required argument. SQLite
    reuses a deleted preparation's id and its attempts stay (subject NULL) under uids naming it, so
    every writer steps past a 409: Scenarios and the Lakehouse lab by uid generation (`~n`), the ADF
    lab to the next run (`openPredict`); Lakehouse finds its attempt with `findLabAttempt`, never by
    recomputing the uid. Pinned by `backend/tests/test_learning_attempt_isolation.py`. The list
    endpoint with no `subject_id` returns only attempts with no preparation (Phase 8; the Chart
    Sandbox, its only unscoped caller, keeps only its own anyway).
  - **Phase 6 -- Workspace and Evidence (2026-10-08, branch `feat/phase-6-workspace-evidence`, base
    `main` @ 19c335d) -- do not reopen**: `docs/implementation/PHASE-6-CONTRACT.md` is the record.
    Two **read models** over rows the features already keep -- no table, no browser store, nothing
    seeded, nothing written: `GET /workspace` and `GET /evidence` (`app/services/workspace_service.py`,
    `evidence_service.py`, shared `portfolio_sources.py`), pages `/workspace` and `/evidence`, one
    nav entry each (under the existing Workspace and Evidence groups). Scope is the learning-attempt
    rule: `subject_id` = that preparation's own rows only; omitted = work that belongs to no
    preparation, shown as its own labelled panel, never merged. Ownership: attempts by
    `subject_id`, roadmap work by `roadmaps.subject_id`, recordings by their question's
    `subject_id`, mocks by `session_belongs_to`; system design / design reviews have no owner, so
    they appear only with no preparation. Evidence levels: activity < completed < demonstrated
    (graded correct by model / answer key / mock pass mark) < evidenced (demonstrated + transfer or
    the learner's explanation). Self- and AI-assessed never above completed; mocks never above
    demonstrated and judged by the preparation's `pass_mark` (as readiness is); drills are not
    evidence; Evidence never states readiness. Lab work is titled from the frontend registries
    (`services/portfolio.ts`). Known gap: system design attempts have no `subject_id` (schema change
    deferred).
  - **Phase 7 -- Curriculum & Knowledge Layer (2026-10-08, branch `feat/phase-7-curriculum`) -- do not
    reopen**: `docs/implementation/PHASE-7-CONTRACT.md` section 10 is the record; D1-D6 settled there.
    Every curriculum data repair is a **learner action with a preview**, never automatic: ADF title repair
    (`/roadmaps/{id}/title-repair/preview|apply`, renames bare-number titles only, by phase + number, through
    the topic write path, rolls back if any other field moves), course-lesson relabel
    (`/roadmaps/{id}/guide/course-lessons/preview|apply`, exact six-field matches only), Roadmaps Unlink (with
    a confirmation), ADLS attach. `topic_guide_sections.source` is `learner | ai | course`; an edit keeps the
    source. Capabilities read the record: `roadmap` from `roadmap_count` (unarchived links), `studyGuide` /
    `scenarios` from the attached packs' `chapter_count` / `written_scenario_count`, `lakehouseLab` from the
    `databricks` slug. Roadmap -> pack link only through a pack attached to the roadmap's own preparation, at
    the pinned `linked_pack_version`; a topic maps to chapters by title or the number its title states,
    **never by position**. Topic links (chapters -> written scenarios -> ADF experiments) and topic Evidence
    are derived in `services/curriculumLinks.ts` / `hooks/useLinkedTopics.ts`, read-only; completion is still
    demonstration-only (D4). `GET /roadmaps?unassigned=true`; `getScopedRoadmaps(subjectId)` = own +
    unassigned, or unassigned only with no preparation. Nav: Roadmaps always reachable; Agile Metrics keeps its Scrum scope (PSM I or lab AVAILABLE, unchanged);
    Study Library when guide, roadmap, scenarios or certification.
  - **Phase 8 -- production readiness (2026-10-09, merged as PR #80) -- do not reopen**: `docs/implementation/PHASE-8-REPORT.md` is the record. Missing `subject_id` never means
    "all" on a preparation's screen: `GET /learning/attempts` and `GET /interview-questions` with none
    answer for no preparation (attempts with none; the shared library); Sidebar's review badge and
    `/review` make no request without a preparation; the interview library/practice show shared +
    the chosen preparation's own (`services/interviewLibrary.ts`). Kept unscoped by design, every caller
    scoped: `/review/*`, `/home/activity`, `/analytics/*`, `/questions` (catalogue), `/roadmaps`
    (catalogue), `/home` (all-preparations overview). `systemDesignStudio` capability (the
    `system-design` slug, as the backend's `_owns_system_design`) replaces `id === 3`; Home waits for a
    loading provider (`PreparationContextValue.provided`) instead of guessing PSM I. Cross-surface
    isolation matrix: `backend/tests/test_phase8_isolation_matrix.py`. The learner's own data had not
    been through the Phase 7 actions as of 2026-10-09 (PSM I still owns roadmap 3, ADF titles still
    bare numbers): only the learner runs them.
  - **Phase 5 -- the ADF Behaviour Lab -- is implemented and merged** (2026-10-07; PRs #76, #77): `docs/implementation/PHASE-5-CONTRACT.md` section 8 is the record. Five
    experiments at `/lab/adf/:slug` (watermark, triggers, concurrency, copy-perf, fault-tolerance with
    `?mode=dependency|bad-rows`), hub `/lab/adf`, one `ExperimentRunner` for the eight stages
    (Understand → Predict → Manipulate → Observe → Reason → Apply → Explain → Retrieve), definitions
    in `services/adfLab/`. Watermark and Triggers run the Lakehouse ADF model (`runPipeline`) over
    semiconductor-v1; Concurrency, Copy Performance and Fault Tolerance have their own pure models
    with typed coupling ledgers (kind `fact` = "From the ADF guide"). Persistence is learning_attempts
    only: a run is four rows (predict, reason, apply, retrieve) sharing
    `ab:<subject>:<track>:r<run>:` and one fingerprint; a finished run is never edited, "start
    again" is run n+1. Eligibility is the `adf` content pack on the chosen preparation, never id 6.
    Every screen says it is a teaching simulation, never Azure running. **Scope stays frozen at
    five**: Fault Tolerance is one experiment with two modes; retry is a lever; timeout, backfill
    and SM-2 scheduling are never simulated or claimed. Changing any of this is a product decision.

**Browser tests run in parallel, one app per worker** (`PREPBENCH_E2E_WORKERS`, default
2 -- 4 saturated this machine and kept surfacing new timing races): `e2e/fixtures.ts` gives worker *n* its own backend on 8100+*n* (its own
`e2e_exam_simulator_w<workerIndex>.db`, recordings and secrets, copied from a template
`e2e/global-setup.ts` builds once a run) and its own frontend on 5273+*n*; the template
backend briefly takes 8100+workers. Every spec imports `test`/`expect` from
`./fixtures`, never `@playwright/test`, and `db.ts` reads the calling worker's database.
The `chromium` project (every spec but the navigation crawl) runs against the production
build (`vite preview`, built once in global setup); `chromium-dev` runs only
`navigation.spec.ts` against the dev server, so React's development-only warnings
(missing keys, `validateDOMNesting`, StrictMode double effects) still reach its console
check. Run Playwright from PowerShell, not this session's Git Bash: its PATH has had
System32 in an unusable `/cygdrive/c/...` form, and without `taskkill` Playwright's
teardown hung for hours. `performance.spec.ts` runs in its own `performance`
project, after the other two finish, with the machine to itself; its budgets were measured
that way (2× the slower of two full-suite runs) — re-measure that way if you change them.
A failure elsewhere skips it; `--project=performance --no-deps` runs it alone. The navigation
crawl opens a fresh tab every 10 screens: one dev-server tab taking ~60 screens exhausted
this machine's commit memory and Chrome failed a module load (`ERR_INSUFFICIENT_RESOURCES`).

**Backlog -- low priority, pick up when there's free time** (assessed 2026-10-02: none is
urgent; the risky gaps were closed in #52-#57):
1. ~~Delete `seed_data.py`~~ -- done in #90.
2. ~~Literal response fields; contract check compares values~~ -- done in #90. Fourteen fields are
   Literal and `apiContract.check.ts` no longer widens unions. Two stay open on purpose (interview
   session `round_type`, AI-written key-point `status`): see the comment there. A new fixed-value
   field: make it Literal only after checking its producer and the stored data -- an out-of-set
   value in a response is a 500.
3. Unit tests for the least-covered pages: `TopicGuidePage` (46%), `TopicDemonstratePage`
   (58%), `RoadmapTopicPage` (64%), `AIProvidersSection` (66%). Best added alongside the
   next change to each page, not as a coverage exercise.
4. ~~Unmerged docs branches~~ -- deleted at the user's request (2026-10-10), locally and on GitHub,
   with `feat/phase-5-adf-learning-lab` (its work is in main). Tips, if ever needed:
   `docs/lakehouse-lab-spec` 550bd74, `docs/lakehouse-lab-spec-program-level` 68422f1.

**Known, understood, not a bug**: `frontend/e2e/navigation.spec.ts`'s per-route heading
check waits 15s (not the 5s default) because it runs against the dev server and this crawl
visits every screen exactly once, so Vite compiling a route on its first visit is the
common case here. If it's still
flaking after this, don't just raise the timeout further — check whether something else
(a leftover process from a prior run holding the test database file, e.g.) is genuinely
slowing things down first; that was the actual cause the one time this looked like it had
regressed.

## Tech stack

**Frontend** (`frontend/`): React 19, TypeScript 5.9, MUI v9, react-router-dom 7, Vite 8,
Vitest 4, Playwright 1.63, axe-core (accessibility), lucide-react (icons).

**Backend** (`backend/`): Python 3.14, FastAPI 0.141, SQLAlchemy 2.0, Pydantic 2.13,
pydantic-settings, uvicorn, pytest 9.1. SQLite, no Alembic — migrations are idempotent
`ALTER TABLE` steps in `app/core/database.py`, each wrapped so one failing step can't
crash startup.

**Environment**: `backend/.venv/Scripts/python.exe` for all Python — never a bare `python`
or `pip`. Node 22+. Git Bash / PowerShell on Windows.

## Design system — use it, don't restyle by hand

- **Tokens**: `frontend/src/theme/tokens.ts` — light/dark colour tokens. In `sx`, use
  `'pb.accent'`, `'pb.successSoft'`, `'pb.warning'`, `'pb.dangerSoft'`, etc. Outside `sx`,
  use `usePb()` from `theme/usePb.ts`. **Never hard-code a hex colour** — it breaks dark
  mode, and this has caused real review findings in this repo more than once.
- **Primitives**: `frontend/src/components/ui/primitives.tsx` — `PageHead`, `Panel`
  (`soft` variant), `PanelHead`, `Eyebrow`, `Pill` (tone), `MetricRow`/`Metric`,
  `BigFigure`, `Bar`, `Note`, `Good`, `Sub`, `Detail`, `Row`, `Grid`, `Section`, `Actions`.
  Build screens from these, not ad hoc `Paper`/`Card`/`Typography`.
- **Buttons**: `variant="contained" color="ink"` = the prototype's black primary button,
  one per page. `variant="contained"` = its blue button. `variant="outlined"` = normal.
  Sentence case labels.
- **Forms**: the theme already puts the label above each field (no floating labels,
  `notched: false`). Don't override this per-field.
- **Font sizes**: always `(t) => t.typography.pxToRem(px)` in `sx`, never a literal
  `'14px'`/`'0.875rem'`/a bare number, and the same for any SVG `fontSize`. A hard-coded
  size breaks the Large-text accessibility setting; `theme/fontSizes.test.ts` guards the
  `sx` case but not SVG attributes, so check those by eye.
- **Breakpoints**: phone is `NARROW_QUERY` (`@media (max-width:768px)`) from `tokens.ts`.
  Check every new screen at 390px and in dark mode before calling it done — see
  "Verifying a visual/accessibility change" under Testing below.
- **Empty table headers**: a header cell with nothing visible in it (an icon-only actions
  column, for instance) needs visually-hidden text inside it, not just an `aria-label` on
  the empty cell — axe's `empty-table-header` flags the latter. See the pattern in
  `QuestionTable.tsx` / `RoadmapTableView.tsx` (`VISUALLY_HIDDEN` constant).
- **Custom radio/checkbox styling**: cover the real input with
  `{ position: 'absolute', inset: 0, opacity: 0 }`, not `clip:` — the latter can't be
  clicked by Playwright's `.check()`.
- **Explanations** (question/interview text with Markdown): render with
  `components/common/Explanation.tsx`, never `dangerouslySetInnerHTML` or raw text.
- **Focus-mode screens** (`FocusLayout` in `App.tsx`, e.g. the exam runner, the interview
  studio, the system design answer page) deliberately have no sidebar — that's by design,
  not a layout bug, so a check that expects a nav landmark everywhere needs to exclude
  these routes explicitly.

## Hard rules — never violate these

1. **Never touch the learner's real data**: `backend/data/exam_simulator.db` (+ `-wal`/
   `-shm`), `backend/data/recordings/`, `backend/data/.llm_secrets.json`,
   `backend/data/.llm_secret_key`. Tests redirect to their own throwaway files —
   `backend/tests/conftest.py` does this before any `app.*` import, and
   `tests/test_real_database_isolation.py` pins the guarantee with a fingerprint check.
   The `-shm`-only failures that check used to report at the end of every run were not a
   filesystem quirk: the guard caused them itself. The real database usually has an
   un-checkpointed `-wal`, and then even a `mode=ro` connection maps the `-shm` and bumps its
   mtime. The guard now reads the schema from a temp copy of the `.db` + `-wal` and never
   opens the real file through SQLite. A failure from it now means something really did
   reach the file (a leak, or PrepBench running against it during the suite), so
   investigate; never "fix" it by checkpointing, deleting or opening the learner's files.
   On a fresh CI checkout the file doesn't exist, so this never fires there.
2. **Never fabricate a result.** No AI provider configured → the app shows "Not Graded"
   and says why, never a fake score or a silent `0%`. This applies to every AI-backed
   feature (system design grading, design review grading, recording analysis, question
   generation, the Ollama catalogue sync) and to sample/demo data — never invent example
   content, screenshots, or figures that look like the user's own.
3. **No frontend edits while Playwright is running.** Vite hot-reloads mid-run and fails
   tests for reasons that have nothing to do with the code.
4. **Don't import `app.main` outside pytest.** The one exception is
   `backend/scripts/export_openapi.py`, run with `SQLALCHEMY_DATABASE_URI`,
   `PREPBENCH_RECORDINGS_DIR`, and `PREPBENCH_SECRETS_DIR` redirected to a throwaway
   location first.
5. **Don't commit unless asked.** When committing or opening a PR, end the message with
   the attribution lines the harness gives you for that session — check the current
   system reminder for the exact model name, since it changes.
6. **Don't push directly to `main`.** Branch, push the branch, open a PR.
7. **Docs go through PRs like code.** `docs/wiki/*.md` is the source of truth for the
   GitHub wiki; `scripts/sync-wiki.sh` mirrors it. Sync only after the PR containing the
   doc change has merged to `main` — running it against unmerged content puts unreviewed
   text on the live wiki.
8. **A GitHub token without `workflow` scope can't push changes to
   `.github/workflows/*.yml`.** If a push is rejected for this, revert just that file to
   match the base branch in a follow-up commit so the rest can go through, and flag the
   workflow change for the user to push separately.
9. **After resolving a merge conflict**, run the tests for every file the conflict
   touched — not just a typecheck — before pushing. A clean textual merge can still drop
   half of what one side was doing (this happened once with `conftest.py`: the base's
   database-isolation guard and this branch's recordings/secrets redirect both had to
   survive the merge, and only running the isolation test caught that they had).
10. **Schema changes require OpenAPI and TypeScript regeneration**: Never commit changes to
    backend Pydantic schemas in `backend/app/schemas/` without exporting `docs/api/openapi.json`
    (`python scripts/export_openapi.py`) and updating frontend types (`npm --prefix frontend run types:api`).
    Always verify with `pytest tests/test_openapi_contract.py`.
11. **Do not append commits to closed or merged PR branches**: If a PR has already merged into
    `main`, pull/rebase onto latest `main` and create a fresh topic branch (`fix/...` or `feat/...`)
    before committing new work.
12. **Subject Context & Capability Truth**:
    - Never silently switch the learner to another subject when navigating.
    - Missing subject context strictly evaluates to `subjectId = null` / `UNASSIGNED_CAPABILITIES`.
      Never default to ADF (6) or PSM I (1) when subject context is absent.
    - ADF is strictly a SKILL, not a Certification. Never present ADF as a certification track or assemble certification mocks for it.
    - Kafka CCDAK is a registered Certification but currently has 0 loaded questions in the
      database (`questionAvailability: false`, `hasQuestionBank: false`); never present its mock exam as runnable until questions are genuinely loaded into the database.
    - System Design (3) has no certification mocks; it supports Technical Interview and Architecture Design Reviews.
    - Databricks (2) has no certification mocks; it supports the Lakehouse System Lab.
13. **Shell, Branding & Dynamic Navigation**:
    - Official product brand: **PrepBench** with official tagline **"Technical Capability, Proven."**
    - Authoritative `BrandLogo` component (`frontend/src/components/common/BrandLogo.tsx`) implements the 3D isometric faceted polygon 'P' mark with 7 precision facets, gradient/monochrome modes, and wordmark.
    - In focus modes (`FocusLayout` / `Navbar minimal`), the brand logo must NOT include a link (`to="/"`) that could take the learner out of an in-progress exam or recording session.
    - Sidebar and navigation rail dynamically enforce capabilities via `isNavKeySupported`: unsupported items render as disabled buttons (`disabled`, `aria-disabled="true"`, `opacity: 0.35`, cursor: `not-allowed`, tooltip explaining not configured for active subject) rather than silently disappearing or navigating.
    - Navigation rail is responsive: 238px expanded, 76px icon rail below 1080px or when collapsed. Active subject context card is rendered at the bottom of the sidebar.
14. **Unified Home & Certification Readiness Integration**:
    - The approved Home experience answers the 5 decisive architectural questions:
      1. What am I preparing for? (Subject card, Target Roles, Curriculum Baseline)
      2. Am I ready? (Formal verification verdict from production readiness API vs coaching note, `CurrentEvidence`, domain readiness breakdown with under floor indicators, `NextUsefulAction`)
      3. What should I learn next? (Production `FocusTopics` with mock counts, accuracy bars, drill links, Insights link)
      4. What can I practice? (In motion items, Question Bank, Mock Exam Simulator, Spaced Repetition Queue, Behaviour Lab, Incident Scenarios, System Design Studio, Verbal Interview Practice)
      5. What can I experiment with? (Learning Lab / Behaviour Lab / Sandboxes with informative status for subjects without labs)
    - Formal Certification verdict comes directly from the production readiness engine (`r.state`): `READY`, `NOT READY`, `NOT MEASURED YET` (when 0 mocks sat), or `DATA NOT AVAILABLE` (when 0 questions loaded).
    - Formal verdict is strictly separated from coaching interpretation (`Almost there`, `Developing`, etc.).
    - Skill tracks display `Status: SKILL COMPETENCY TRACKING` (never exam readiness verdicts).
    - When `selectedId === null` in loaded `PreparationProvider`, renders the dedicated `UnassignedHome` state (`Choose Your Focus Area`), never defaulting silently to PSM I or ADF.
    - All actions and CTAs are subject- and capability-aware.
    - Home alone still infers a subject when rendered outside a `PreparationProvider` (legacy unit tests only; every real screen is inside one). No other screen infers one -- see Phase 4 stabilization.
15. **CLAUDE.md is tracked in the repo (since 2026-10-11), and the repo is public.** Change it
    through a pull request like any other doc, never by committing to `main`. Keep it current: when
    a PR changes a rule, a status or a settled decision recorded here, update CLAUDE.md in that same
    PR. Never put secrets, API keys or tokens in it. Add new rules at the end, so the numbers other
    documents cite never move.

## Testing

```bash
# Backend — from backend/
.venv/Scripts/python.exe -m pytest -q

# Frontend — from frontend/
npm run typecheck        # tsc --noEmit && tsc --noEmit -p e2e
npm run lint              # eslint . --report-unused-disable-directives
npm test                  # vitest run
npx playwright test       # full browser suite, ~20-45 min
```

**Verifying a visual/accessibility change across every screen**: don't spot-check a
handful of routes and call it done. None of the tooling below is checked into the repo —
it's a disposable setup you build each time, never against the user's own running app or
the test suites' own ports:

1. Copy `backend/data/exam_simulator.db` to a scratch path (never open the real file
   directly). Point a second backend at it, on its own port, with recordings and secrets
   redirected to empty temp folders:
   ```
   SQLALCHEMY_DATABASE_URI=sqlite:///<scratch>/audit.db \
   PREPBENCH_RECORDINGS_DIR=<scratch>/recordings \
   PREPBENCH_SECRETS_DIR=<scratch>/secrets \
   backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --port 8210
   ```
2. Point a second Vite dev server at it, on its own port:
   ```
   PREPBENCH_API_TARGET=http://127.0.0.1:8210 npm --prefix frontend run dev -- --port 5383
   ```
3. Drive it with Playwright directly (not `npx playwright test` — a standalone script):
   `PUT /api/v1/settings {theme: 'light'|'dark'}` to switch themes, `page.goto` each route
   from the accessibility/responsive/navigation specs' `ROUTES` arrays (those are the
   canonical list), run `@axe-core/playwright`'s `AxeBuilder` with tags
   `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`, and separately check
   `document.documentElement.scrollWidth - clientWidth` at a 390×844 viewport.
4. Stop both servers when done.

**When a browser test fails**: re-run it alone before concluding anything. A test that
fails only inside a long full-suite run and passes alone is a load/timing issue, not a
bug — say so rather than guessing, and check for a leftover process (a prior run's backend
still holding the test database's file open on Windows is a real, seen cause) before
assuming the timeout itself needs raising again. Never loosen a test just to make it pass;
fix the app if the app is wrong, fix the test only if wording or structure changed.

**Before marking any feature complete**, check:
1. Does an existing test assert a count you just changed (nav links, screens, table
   rows)? Search for `toHaveLength`/`toHaveCount` across the codebase.
2. Any hard-coded colour or font size (including SVG `fontSize`) in the new code?
3. Is the new route in `responsive.spec.ts`, `accessibility.spec.ts`, and
   `navigation.spec.ts`?
4. Are heading levels correct (`h1` → `h2` sections → `h3` cards, no skips)? Run axe.
5. Could two of these arrive at once, or out of order? Every test layer here sends one
   request at a time, so overlap bugs pass them all (the exam answer-save 500, the
   Question Bank showing a late answer for the wrong preparation). Backend: a
   check-then-insert guarded by a unique constraint must handle the `IntegrityError`
   (roll back, update the row that won), with a test that makes the lookup see "no row"
   once -- see `test_two_first_saves_of_one_answer_end_as_one_row_not_a_failure`.
   Frontend: a screen that refetches when its scope changes (preparation, filters,
   search) must apply only the latest request's answer, with a test that releases an
   earlier request after a newer one -- see `QuestionBankPage.test.tsx`.
6. Run the *full* suite (`npm test -- --run`, `pytest -q`), not just the file you touched.

## Project structure

```
frontend/src/
  pages/                 one file per screen/route
  components/ui/         shared primitives — see Design system above
  components/<feature>/  feature-scoped components (exam/, interview/, question_bank/, sandbox/, roadmap/…)
  theme/                 tokens.ts, theme.ts, usePb.ts, fontSizes.test.ts
  context/               PreparationContext.tsx (provides selected preparation and capabilities), ThemeContext.tsx
  services/              API client, per-domain helpers (capabilities.ts, api.ts, lakehouse/, metrics/…)
  types/                 TS interfaces (capabilities.ts, subject.ts, exam.ts, lakehouse/…)
e2e/                     Playwright specs + helpers.ts + a throwaway-DB config

backend/app/
  api/v1/                one router file per resource
  models/                SQLAlchemy models
  schemas/               Pydantic request/response models
  services/              business logic; routers stay thin
  repositories/          query logic, kept separate from services where it recurs
  core/                  config, database (incl. migrations), exceptions
  llm/                   provider adapters, task routing, local-model setup, Ollama sync
backend/tests/           pytest, one file per feature/concern
backend/scripts/         perf_gate.py, export_openapi.py, upgrade_check.py, fresh_install_check.py

docs/
  wiki/                  source of truth for the GitHub wiki (see rule 7)
  implementation/        screen registry, parity report, phase/gate reports
  api/openapi.json       generated — regenerate after any schema change:
                         .venv/Scripts/python.exe scripts/export_openapi.py  (env-redirected, see rule 4)
                         npm --prefix frontend run types:api
                         .venv/Scripts/python.exe -m pytest -q tests/test_openapi_contract.py
                         npm --prefix frontend run typecheck
```

## Conventions worth knowing

- **Five Connected Capabilities Architecture & Subject Truth**:
  PrepBench is structured around Five Connected Capabilities (Certification, Interview,
  Learning Lab, Workspace, Evidence) underpinned by a Curriculum Layer (Roadmaps, Study Guides,
  Scenarios). Capabilities are heterogeneous and derive from authentic repository data:
  - *PSM I (id: 1)*: Certification (709 questions, 85% pass mark), Roadmap (id: 3: Storage FileSystems to Cloud Mastery Roadmap, 13 phases, 63 topics, 188h), Workspace, Evidence.
  - *Databricks (id: 2)*: Learning Lab (Lakehouse System Lab), Workspace, Evidence.
  - *System Design (id: 3)*: Interview (32 architecture prompts, 10 design reviews), Roadmap (id: 4: Storage FileSystems to Cloud Mastery Roadmap, 13 phases, 63 topics, 188h), Workspace, Evidence.
  - *Kafka CCDAK (id: 4)*: Certification (0 questions loaded in database, mock assembly disabled), Roadmap (id: 1), Workspace, Evidence.
  - *Agentic AI (id: 5)*: Roadmap (id: 5), Workspace, Evidence.
  - *ADF (id: 6)*: Interview (18 scenarios), Learning Lab (5 behaviour labs), Roadmap (61 topics), Study Guide (23 chapters), Scenarios (18), Workspace, Evidence. (**ADF is a Skill, not a Certification**).
  All frontend capability guards, sidebar entries, and routing MUST consume `usePreparation().capabilities` or `isCapabilityAvailable(subjectOrId, capability)` — never inspect `subject.kind === 'certification'` or hardcode per-page assumptions.
- **Readiness is computed from full mocks only.** A drill is never a readiness signal.
  Zero mocks reads "needs evaluation", never `0%`. See `docs/wiki/Readiness.md`.

- **AI task routing is per-task**, not global — `llm_task_binding` maps each of the nine
  `LLMTask`s (see `backend/app/llm/types.py` and `docs/wiki/AI-Providers.md`) to a provider
  independently.
- **Recordings/database/secrets in tests** are redirected via `PREPBENCH_RECORDINGS_DIR`,
  `PREPBENCH_SECRETS_DIR`, `SQLALCHEMY_DATABASE_URI` env vars, set in `conftest.py` before
  any app import — this is the mechanism, not a suggestion; new tests that open their own
  `SessionLocal()` bypass it and have caused real leaks before.
- **The Learning Lab** (`/lab`) is a hub for simulation sandboxes (predict → manipulate →
  observe → explain). Four are live: Agile Metrics, the ADF Behaviour Lab, the Kafka Lab and the Lakehouse Lab
  (see `docs/wiki/Learning-Lab.md`; the learner's guide is `docs/wiki/Learning-Lab-Guide.md`).
  Adding a new one means: a card in
  `LearningLabPage.tsx`, a `NavEntry` in `navigation.ts`, a route in `App.tsx`, and the
  page itself. See `add-learning-lab-sandbox` skill if available.
- **Interview sessions and exam-taking are "focus modes"**: `FocusLayout` in `App.tsx`
  drops the sidebar/picker so nothing on screen can navigate away mid-recording or
  mid-paper. The interview studio (`bare` prop) draws its own header bar entirely.
- **Interview questions can carry a prepared answer and key talking points**; a take is
  then graded against them (plan alignment score, per-point coverage) in addition to the
  normal content/delivery scoring. Optional per question — freeform questions score as
  before.
- **The Ollama catalogue sync** (`app/llm/ollama_catalogue_sync.py`) only ever runs from
  its own `POST /api/v1/llm/local/models/refresh` endpoint — never at startup, never on a
  schedule. Keep it that way; it's the offline guarantee. It's also offline-*safe*: a
  failed network call or an empty parse returns `ok=False` with a message and changes
  nothing, never raises.
- **ADF Roadmap ↔ Study Guide governance**:
  1. The ADF Roadmap (`docs/research/ADF_Master_Roadmap_Mapped.xlsx`) is the curriculum planning source.
  2. The ADF Study Guide (`backend/app/content/packs/adf/v<N>.json`) is the learner-facing implementation.
     It is published one file per version and a skill pins the version it attached. **`v1.json` is the
     original guide and never changes** (a test pins it by fingerprint); `v2.json` is the rewritten guide
     (23 chapters, from 2026-10-21), also pinned by fingerprint now that v3 exists; `v3.json` (2026-10-28) is v2
     with each scenario check's options reordered so the correct answers are spread over positions 0-2 (v2 had
     64 of 72 in the middle; `test_correct_answers_are_spread_over_the_option_positions` keeps any position
     under half). Check answers are stored per pack version, so a learner who upgrades answers v3's checks
     afresh. Edit the newest version, and add a new version file for any change a learner could
     notice. A chapter's `Roadmap alignment` block is shown in its own tab on the chapter page.
  3. Every roadmap topic must map to one or more Study Guide sections (see `docs/research/ADF_Study_Guide_Roadmap_Crosswalk.md`).
  4. Coverage must be labelled Full or Partial honestly; do not convert Partial to Full without dedicated content.
  5. Do not create duplicate chapters simply to satisfy roadmap numbering; The guide has 23 chapters since the 2026-10-21 rewrite (the fixed 21 was lifted by the user); keep every original chapter id and title, because the Behaviour Lab pins them. The roadmap is `docs/research/ADF_Master_Roadmap.xlsx` (61 topics, numbers 1-60 unchanged).
  6. When ADF Study Guide content changes, update the roadmap mapping.
  7. When roadmap topics change, review the Study Guide crosswalk.
  8. The existing technical accuracy and research discipline still applies (grounded claim-by-claim in Microsoft Learn).
  9. Microsoft facts and course recommendations must not be confused.
  10. Changes must preserve the existing Study Guide schema (`GuideBlock` extra="forbid") and pass content-pack tests.
  11. **Live Application Linking**: Roadmaps and built-in Content Packs (`backend/app/content/packs/`) are bidirectionally connected in the application. `ContentPackService` dynamically resolves mapped curriculum chapters (`MappedGuideChapter`) for roadmap topics (`TopicGuideResponse.mapped_chapters`, `RoadmapTopicResponse.mapped_chapters`).
  12. **UI Navigation & Empty States**: When curriculum chapters exist for a topic, `RoadmapTopicPage` must provide direct navigation to read the chapter (`/learn/guides/:packId/:chapterId`), and `TopicGuidePage` renders the "Built-in Study Guide" panel with chapter summaries, relevant sections, and learning evidence deliverables. Never display "No study guide yet" when curriculum material exists; distinguish personal/AI synthesis notes from authoritative course content.
  13. **Microsoft Cloud & ADF Technical Accuracy**:
      - *Pipeline Concurrency*: Controls the maximum concurrent runs of *that specific pipeline* (configured per pipeline, no factory-wide ceiling; runs queue when reached). Clearly distinguish from service/subscription-level concurrent pipeline run limits across the factory.
      - *Connection Models*: Treat $(runs) \times (batchCount) \times (parallelCopies)$ as a potential connection pressure / upper-bound planning model, not an exact runtime law (ADF dynamically determines effective copy parallelism and connector behavior varies by source/sink).
      - *Compute/DIU Scales*: Avoid universal range claims (e.g. teaching "2 to 256" or "4 to 256" as universal rules). State that available DIUs depend on the integration runtime and scenario, with Azure IR intelligent throughput optimization configurable from 4 to 256.

## Where to look next

- `docs/wiki/Home.md` — index of the wiki, four core rules, license
- `docs/wiki/Architecture.md` — backend layering, table inventory, why no Alembic
- `docs/wiki/AI-Providers.md` — provider routing, local model setup, the catalogue sync
- `docs/wiki/Development-Guide.md` — full setup, conventions, how to add an endpoint/chart
- `docs/implementation/PARITY-REPORT.md` — prototype-parity history and known deviations
- `docs/implementation/01-screen-registry.json` — per-screen route/component mapping
  (status field is not proof of parity on its own — see Status above)
