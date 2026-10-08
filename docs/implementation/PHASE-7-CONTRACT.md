# Phase 7 contract: the Curriculum & Knowledge Layer

**Status: audit and contract only (2026-10-08). Nothing is implemented.** Written from the repository
at `main` @ f972878 (Phases 1-6 merged, PR #78) and a read-only scratch copy of the learner's
database. Every figure below was read from code or from that copy, not from a plan or a prototype.

Phase 7 is the layer the prototype's review document puts under the five capabilities:
"Curriculum & Knowledge Layer: Roadmaps · Study Guides · Scenarios". The prototype marks the
missing piece as "Architecture Gap · Phase 7": a roadmap topic linked to its lab and scenario.
`CLAUDE.md` also files the known curriculum data issues (the off-topic PSM I roadmap) under Phase 7.

Phase 7 makes the curriculum **true and connected**:
- what each preparation's curriculum really is;
- one correct link from a topic to its guide chapters, scenarios, lab experiments and evidence;
- no curriculum claim that the data does not support.

It writes no new content and starts no new engine.

---

## 1. Data model (as it is)

| Store | Table / file | Owner (preparation) | Written by |
|---|---|---|---|
| Roadmap | `roadmaps` (`subject_id` FK, SET NULL), `roadmap_phases`, `roadmap_topics`, `roadmap_resources` (sheets: `purpose` plan/reference), `roadmaps.sheet_layout` | `roadmaps.subject_id` | Import (validate/confirm), editor, PATCH |
| Topic progress | `roadmap_topics.status` / `progress_percentage` / `started_at` / `completed_at` / `evidence_notes` | via roadmap | `RoadmapService._reconcile_topic_state` (single write path) |
| Topic demonstration | `topic_demonstrations` (response, **self_grade** `not_yet/partial/yes`, SM-2 recheck), CASCADE with topic | via roadmap | `POST …/topics/{id}/demonstrations` |
| Topic guide | `topic_guide_sections` (`source` **`learner` / `ai`** only, `generated_by`, `edited_at`, `read_at`) | via roadmap | Learner, or AI draft (`…/guide/draft`) |
| Study guide (authoritative) | Content packs, JSON, versioned, read-only: `backend/app/content/packs/{adf,adls}/v1.json`, `GuideBlock` extra=forbid | `subject_content_packs` (attach/upgrade/detach) | Repository (code review) |
| Scenarios | Inside a content pack: `scenario_levels[].scenarios[]` (`id`, `number`, `title`, `outcome`, `sources`, **`chapter`**, `content`: bookmark, check[], caseStudy, debrief, takeaway, honesty, lenses{po,pm,dm,em}) | via attached pack | Repository |
| Scenario attempts | `learning_attempts`: checks `<pack>/<scenario>/check/<n>` (graded against the answer key), lenses `<pack>/<scenario>/lens/<role>` (case notes + Say-it, not graded); uid `s<sid>:<pack>@<v>:<scenario>:<part>[~n]` | `learning_attempts.subject_id` | `services/scenarios/scenarioAttempts.ts` |
| Say-it answers | `interview_questions` (`source_ref`, unique with `subject_id`) | `subject_id` | `PUT /interview-questions/by-source` |
| Lab packs (Lakehouse) | `backend/app/data/lab_packs/{semiconductor-v1, jd-po-005-v1}` | none (global) | Repository |
| Lab attempts | `learning_attempts` (`adf.lab.*`, `lakehouse.*`, Chart Sandbox concepts) | `subject_id` (Chart Sandbox: none) | Lab services |
| Pack → topic map | "Roadmap alignment" blocks inside pack chapters, indexed by `get_pack_roadmap_alignments` (topic title **and** topic-number keys) | none | Repository |

## 2. Routes and APIs (as they are)

| Route | Page | Reads |
|---|---|---|
| `/roadmaps` | RoadmapListPage | `GET /roadmaps` (**unscoped**), filtered in the browser |
| `/roadmaps/:id` (+ `/edit`) | RoadmapDetailPage / Editor | `GET /roadmaps/{id}`, `/schedule`, `PUT /plan` |
| `/roadmaps/:id/topics/:tid` | RoadmapTopicPage | roadmap detail (`mapped_chapters`), demonstrations |
| `…/guide` | TopicGuidePage | `GET …/guide` (sections + `mapped_chapters`), AI draft, section CRUD, read marks |
| `…/demonstrate` | TopicDemonstratePage | demonstrations; "related questions" by keyword in the roadmap's preparation |
| `/learn` | StudyLibraryPage | `chooseRoadmap` (own, else unlinked), attached packs, reference sheets, practice, demonstrate |
| `/learn/guides/:pack[/:chapter]` | GuidePage / GuideChapterPage | `GET /content-packs/{id}`; chapter → its scenarios |
| `/scenarios`, `/scenarios/:pack/:id` | ScenarioSandboxPage / ScenarioPage | pack + `GET /learning/attempts?subject_id=` |
| `/lab/adf[/:slug]` | AdfLabPage / AdfExperimentPage | experiment registry names chapters (linked) and topics (**named, not linked**) |

Services: `RoadmapService`, `RoadmapImportService`, `TopicGuideService`, `ContentPackService` (+
`content/packs.py` store), `LearningService`, `InterviewQuestionService`, `RoleService` (uses pack
`diagnostic_questions`). There is no backend scenario service: scenarios render from pack JSON, and
their attempts go through LearningService.

## 3. Ownership, and how scenarios reach learning (as it is)

- **Ownership:**
  - roadmap work is owned through `roadmaps.subject_id`;
  - packs through `subject_content_packs`;
  - attempts through `learning_attempts.subject_id`.
  
  Deleting a preparation sets these to NULL, apart from packs.
- **Links that exist in the app:**
  - guide chapter ↔ scenario (both ways, through `scenario.chapter`);
  - roadmap topic → guide chapters (`mapped_chapters`, ADF only);
  - lab experiment → chapters (links);
  - scenario/lab attempt → Evidence (Phase 6).
- **Links that do not exist:**
  - roadmap topic → scenarios;
  - roadmap topic → lab experiments (only named, by number);
  - roadmap topic → its evidence;
  - scenario → roadmap topic.
  
  The topic ↔ scenario mapping exists only in research (`docs/research/ADF_Scenario_Roadmap_Crosswalk.md`).
- **Topic completion:** a topic reaches `completed` only through a self-graded "yes" demonstration
  (`record_demonstration`). No lab run, scenario check or mock ever moves a topic.

## 4. Each subject's curriculum in the data (scratch copy, 2026-10-08)

| Prep | Roadmap (id) | Topics / phases / h | Guide | Scenarios | Questions | Lab | Notes |
|---|---|---|---|---|---|---|---|
| PSM I (1) | 3 "Storage FileSystems to Cloud Mastery" | 63 / 13 / 188 | none | none | 709 (3 domains) | none | Roadmap is **off-topic** for Scrum |
| Databricks (2) | none | – | none (ADLS pack exists, unattached) | none | 0 | Lakehouse (lab packs) | |
| System Design (3) | 4, **identical copy** of 3 | 63 / 13 / 188 | none | none | 0 | none | 32 prompts / 19 categories, 10 design reviews, **no owner** |
| Kafka (4) | 1 "Apache Kafka Mastery" | 45 / 10 / 134 | none | none | 0 (pass mark 83) | none | Roadmap fits; no bank yet |
| Agentic AI (5) | 5 "Agentic AI Mastery" | 77 / 14 / 342 | 596 sections over all 77 topics, `source='learner'` | none | 0 | none | Sections are imported course lessons (`docs/research/agentic-ai/lessons/*.guide.json`, 77 files), not the learner's writing |
| ADF (6) | 6 "ADF Master" | 60 / **12** / 176 | `adf` pack, 21 chapters | 18 (4 levels) | 0 | ADF Behaviour Lab | **All 60 topic titles are numbers** |

## 5. Broken or misleading mappings (with evidence)

| # | Finding | Evidence | Effect |
|---|---|---|---|
| M1 | **ADF topic titles are numbers.** The importer maps the first header containing "topic" to the title, so "Topic #" wins over "Topic" | `roadmap_import_service.py` `_column_map`: `mapping.setdefault("topic", index)`; workbook row 5 `Phase, Topic #, Topic, …`; DB: 60/60 numeric titles on roadmap 6, 0 on the others | Every surface shows "1", "5", "10": roadmap, topic page, Phase 6 Workspace. The real names are lost. Any workbook with "Topic #" ahead of "Topic" will repeat it |
| M2 | **Imported course lessons labelled as the learner's own writing** | 596 sections, `source='learner'`, `generated_by` NULL, created 2026-10-01 to 03 in 3 days; `TopicGuidePage` labels non-AI sections "Written by you"; Workspace counts them "written by you" | A provenance claim the data cannot support. CLAUDE.md governance rule 12 requires telling course content from personal notes |
| M3 | **PSM I and System Design `roadmap: true` rests on an off-topic, duplicated roadmap** | Roadmaps 3 and 4 have 63 identical topics; profiles 1 and 3 in `capabilities.ts` are commented "Linked to Roadmap 3/4: Storage FileSystems…" | Roadmap, Study Library and Home present filesystem/ADLS topics as Scrum and System Design curriculum |
| M4 | **Home "Curriculum Baseline" is hard-coded per subject id, and wrong** | `HomePage.tsx` ~689-748: ADF "60 Topics across **13** Phases" (real: **12**); System Design "188h Roadmap" (the off-topic roadmap); Kafka "0 Exam Questions Loaded" (static); `targetRoles` / `roleFocus` strings keyed on ids 1-6 | Figures with no source in the data. Breaks the "no fabricated figures" rule |
| M5 | **Study Library offers exam practice to every preparation** | `StudyLibraryPage` `PracticeSection`: drill, spaced review, question bank and **`/exam-setup?kind=mock&subject=…`** for any selected preparation, with no capability check | Presents a mock for ADF, Databricks and Agentic AI, against hard rule 12 |
| M6 | **Roadmaps list with no preparation shows every preparation's roadmaps** | `RoadmapListPage`: `mine = preparation ? … : roadmaps`; `GET /roadmaps` omitted `subject_id` = all | Missing context becomes "any", unlike the rule `learning_attempts`, Workspace and Evidence follow |
| M7 | **Curriculum navigation keyed on subject ids** | `navigation.ts`: `system-design` = `id === 3`, `agile-sandbox` = `id === 1`, `databricks-sandbox` = `id === 2`; `HubPages` 2/6, `InterviewPracticeSetupPage` 3/6, `CertificationHubPage` `isPsm` | A learner-created preparation with the same content gets different navigation; CLAUDE.md says never hard-code per-page assumptions |
| M8 | **Roadmap → pack linking is heuristic** (latent: no current roadmap triggers it) | `get_linked_pack_for_roadmap`: substring `"adf"` / `"data lake"` in the title or filename, then the first 5 topic titles against any pack; `find_mapped_chapters_for_topic` falls back to **topic position** (`order_index + 1`) | A roadmap of another subject could show ADF/ADLS chapters by name or position. Today: only roadmap 6 links, 60/60, by exact key |
| M9 | **`studyGuide` flag means "a content pack is attached", not "has guides"** | Agentic AI: `studyGuide: false` with 77 topic guides; ADF: true by pack | Hides or shows the wrong guide affordances by flag |
| M10 | **Topic ↔ lab / scenario links are names, not links** | `ExperimentRunner`: "Roadmap topics: 32 Watermark Patterns; …" as text; Phase 5 known limitation | The prototype's "Explore in Lab / Open Scenario" from a topic does not exist |

## 6. Duplicate engines and state

| Area | Duplicates | Verdict for Phase 7 |
|---|---|---|
| Study material | Content packs (authoritative, versioned) vs `topic_guide_sections` (per topic, learner/AI) vs research lessons in `docs/` (imported into sections) | Keep both stores (by design per CLAUDE.md). Fix the **provenance** (M2), not the stores |
| Lab content | `content/packs` (ADF, ADLS) vs `data/lab_packs` (Lakehouse) | Different shapes for different engines. Leave as is; do not merge in Phase 7 |
| Progress | Topic status (self-graded demonstrations) vs `learning_attempts` (labs, scenarios) vs Evidence levels (Phase 6) vs the Chart Sandbox's own mastery engine (`services/learning/mastery.ts`, `recommendations.ts`) | Topic status stays the only topic-completion writer unless the owner decides otherwise (D4). Phase 7 **reads** attempts and Evidence for a topic; it adds no second progress store |
| Spaced recall | `sm2_service` shared by question review and topic rechecks (one engine); ADF Retrieve deliberately unscheduled | No change |
| Diagnostics | Pack `diagnostic_questions` (roles) vs the Chart Sandbox placement probe | Out of scope |
| Roadmap rows | Roadmaps 3 and 4 identical | A learner's data decision (D3); never edited by code |

## 7. Phase 7 work (proposed; each item needs its acceptance tests)

**Rules carried forward:**
- one source of truth;
- no new progress store;
- omitted `subject_id` = no preparation;
- never edit the learner's database from code or tests (every data repair is a learner action through an existing or new endpoint);
- no invented content or figures;
- capabilities from live data.

| WP | Change | Acceptance |
|---|---|---|
| **7.1 Importer column fix** (M1) | `_column_map`: a header that is a topic **number** ("Topic #", "No.", "#", "Topic number") never wins `topic`; the title column wins | Unit: the ADF workbook imports with 60 real titles; workbooks with only "Topic" are unchanged; the existing import tests stay green |
| **7.2 ADF title repair, learner-triggered** (M1) | A preview/apply action that reads the source workbook and renames topics **by number**, keeping ids, status, demonstrations, notes and guide sections. Writes go through the existing topic write path | Repairs roadmap 6 on a copy; no progress lost; never runs by itself; shows the before/after |
| **7.3 Guide provenance** (M2) | Distinguish imported course content from the learner's writing: a `source` value such as `course` (Literal + OpenAPI + types) and labels "Course lesson" vs "Written by you" vs "AI draft"; Workspace counts mine/course/AI apart. Existing rows are relabelled only by an explicit learner action (D2) | No section claims "written by you" unless it was; schema test; Workspace and TopicGuidePage tests |
| **7.4 Curriculum truth from live data** (M3, M4, M9) | Replace Home's hard-coded baseline, roles and focus strings with figures read from the preparation's own roadmap, attached packs and capability profile; a figure with no source is not shown | No string keyed on subject id in Home's curriculum card; ADF reads 12 phases; Kafka's count follows its bank |
| **7.5 Capability-gated Study Library** (M5) | Practice items only when `certification` and `questionAvailability`; skills get their real practice (scenarios when `scenarios`, the lab when `learningLabStatus === 'AVAILABLE'`) | ADF/Databricks/Agentic AI show no mock/drill/bank; PSM I unchanged; Kafka shows no mock while it has 0 questions |
| **7.6 Roadmaps scope** (M6) | With no preparation: only unassigned roadmaps, plus a prompt to choose one. Optionally `GET /roadmaps?subject_id` omitted = no preparation, behind a parameter so existing callers do not change | No preparation never lists another preparation's roadmaps; test |
| **7.7 Topic ↔ guide ↔ scenario ↔ lab links** (M10) | Derived, not stored: topic → mapped chapters (existing) → scenarios whose `chapter` is one of them; topic → ADF experiments whose `topics` include its number. "Read", "Practise", "Explore in lab" on RoadmapTopicPage, and the reverse on the scenario and experiment pages | ADF topic 32 shows its chapters, scenarios and the watermark experiment as links; topics with no mapping show nothing (no fallback by position) |
| **7.8 Topic evidence, read only** | RoadmapTopicPage lists the Phase 6 Evidence items for that topic's scenarios and experiments (same levels, same scope). Completion semantics unchanged unless D4 | A topic shows its evidence; topic status unchanged by reading it |
| **7.9 Mapping hardening** (M8) | `find_mapped_chapters_for_topic`: no position fallback; keyword linking only through an attached pack or the roadmap's preparation | A non-ADF roadmap never shows ADF/ADLS chapters; tests |
| **7.10 Navigation by capability** (M7, curriculum entries only) | `agile-sandbox`, `databricks-sandbox`, `system-design` support from capabilities/content, not subject ids | Learner-created preparations get the same entries as the seeded one with the same content |

**Non-goals:**
- authoring new curriculum (Kafka, Databricks, PSM I, System Design or Agentic AI content);
- new scenarios;
- a scenario or study engine;
- merging content packs and lab packs;
- a progress table;
- giving system design attempts an owner (a Phase 6 deferral, separate);
- Phase 8.

## 8. Decisions for the owner before implementation

| # | Decision | Options |
|---|---|---|
| D1 | ADF titles | (a) 7.2's learner-triggered repair by topic number (recommended: keeps progress); (b) re-import a new roadmap and archive 6 (loses the in-progress topic and note links) |
| D2 | Agentic AI lessons | (a) new `source='course'`, existing 596 rows relabelled by a learner action; (b) package the 77 lessons as an `agentic-ai` content pack (larger: a different block schema); (c) leave as is (keeps M2) |
| D3 | Roadmaps 3 and 4 | Unlink from PSM I and/or System Design, archive, or keep. Then PSM I / System Design `roadmap` follows the live link (no roadmap = `false`) |
| D4 | Topic completion | Stay demonstration-only (current), or also accept Evidence ≥ `demonstrated` from the topic's linked scenarios/experiments |
| D5 | ADLS pack | Attach to Databricks or ADF (learner action), or leave unattached |
| D6 | System design ownership | Schema change to give attempts and design reviews a `subject_id`, or keep them unowned (Phase 6 limitation) |

## 9. Verification required

- Full backend suite, full Vitest suite, typecheck, lint, and the full Playwright suite, including performance.
- Isolation tests per CLAUDE.md:
  - no preparation never lists another's roadmaps or links;
  - a topic's links and evidence stay inside its preparation;
  - same-pack preparations stay apart.
- A rendered check against a scratch copy of the real database for ADF, PSM I, Kafka and Agentic AI, in light and dark, at 390px. Never against the learner's own files.

## 10. Implementation record (2026-10-08, branch `feat/phase-7-curriculum`, base `main` @ f972878)

The owner settled D1–D6 before implementation:

| # | Decision taken |
|---|---|
| D1 | Importer fixed (7.1) and a learner-triggered title repair added (7.2). Never automatic; topic 278's progress and note are kept. |
| D2 | `source = 'learner' \| 'ai' \| 'course'`. The 581 exact matches are relabelled only by a learner action with a preview; the 15 unmatched stay "Written by you" unless confirmed one at a time. No Agentic AI content pack. |
| D3 | Roadmap 3 to Databricks and roadmap 4 unlinked/archived from System Design, by the learner through the Roadmaps page (Unlink, with a confirmation). Never automatic. The `roadmap` capability follows the live, unarchived link. |
| D4 | Completion stays demonstration-only. `record_demonstration` is the only writer of COMPLETED; Evidence is shown on a topic, read-only. |
| D5 | ADLS is attachable to Databricks by the learner, never ADF, never automatic. `studyGuide`/`scenarios` come from the attached packs' real contents. |
| D6 | System design artifacts stay unowned. No backfill, no schema change. |

### What was built

| WP | Implementation |
|---|---|
| 7.1 | `roadmap_import_service.py`: a number header (`Topic #`, `#`, `No.`, `Topic number`…) maps to `number`, never `topic`; a narrow title block above a wider header row no longer hides the real table (the ADF workbook imports 60 named topics in 12 phases). `numbered_topics()` reads (phase, number, title) for the repair. |
| 7.2 | `topic_title_repair_service.py`, `POST /roadmaps/{id}/title-repair/preview` and `/apply` (the workbook again + the previewed `topic_ids`). Only bare-number titles, matched by phase + number, renamed through `RoadmapService._apply_topic_update`; every other field is snapshotted and the transaction rolls back if any moved. Refuses ambiguity (duplicate rows or topics, a missing row, a numeric new name) and any confirmation that is not the previewed plan. Idempotent. UI: "Curriculum tools" on the roadmap page (`RoadmapCurriculumTools.tsx`), shown only when bare-number titles exist. |
| 7.3 | `GuideSectionSource` Literal; a write may set `learner` or `course` (never `ai`); an edit keeps the source and records `edited_at` only on a real content change; an AI draft cannot be relabelled. `POST /roadmaps/{id}/guide/course-lessons/preview` and `/apply`: exact six-field matches only, rechecked on apply, all-or-nothing. Labels "Course lesson" / "Course lesson, edited by you" / "Written by you" / "AI draft"; the editor's checkbox confirms one section at a time. Workspace counts the three apart. |
| 7.4 | Home's curriculum baseline is read from the linked roadmap (topics, phases, hours), the attached packs (chapters, written scenarios) and the question count; target roles are the learner's own roles whose requirements name the preparation; the skill competency bars (fixed 100/100/60) are replaced by the preparation's Evidence counts. `SubjectWithReadiness.roadmap_count` and `SubjectContentPackResponse.chapter_count` / `written_scenario_count` carry the facts; `getSubjectCapabilities` reads them over the static table. |
| 7.5 | Study Library practice: exam items only for a certification with questions; otherwise scenarios / labs when the capabilities say so; Kafka is told why. |
| 7.6 | `GET /roadmaps?unassigned=true` (400 with `subject_id`); `getScopedRoadmaps(subjectId)` = own + unassigned, or unassigned only with no preparation. The Roadmaps list, Study Library and Preparation overview use it; latest request wins on a preparation switch. |
| 7.7 | `services/curriculumLinks.ts` (derived, never stored): topic → `mapped_chapters` → written scenarios whose `chapter` is one of them (read from the pack at the pinned `linked_pack_version`) → ADF experiments whose registry `topics` include the mapped topic number (ADF pack only). RoadmapTopicPage lists Read / Practise / Explore in lab. `hooks/useLinkedTopics.ts` gives the reverse links on ScenarioPage and ExperimentRunner, from the preparation's own roadmaps only. |
| 7.8 | RoadmapTopicPage "Evidence for this topic": `getEvidence(roadmap.subject_id)` filtered to the linked scenarios and experiments; none read for a roadmap with no preparation; an honest failure state; never writes. |
| 7.9 | `linked_pack_for_roadmap`: only packs attached to the roadmap's own preparation, at the pinned version, that have alignments. Title/filename keywords and the first-five-topics probe removed. `chapters_for_topic_title`: by title, else by a number the title states; never by position. |
| 7.10 | `isNavKeySupported`: System Design / Design Reviews by `interview`, the Lakehouse Lab by `lakehouseLab` (the `databricks` slug the lab keeps its work under), Agile Metrics deliberately unchanged (PSM I, or a preparation whose Learning Lab is available -- its Scrum scope is a product decision, not a Phase 7 one); Roadmaps always reachable (a roadmap is linked there); the Study Library when the preparation has a guide, a linked roadmap, scenarios, or is a certification (its practice lives there) -- `roadmap` is the live link now, so it is no longer the only door. Home, Hub and Interview setup copy no longer keyed on subject ids for curriculum. |

**API changes** (OpenAPI regenerated, 148 paths; `apiContract.check.ts` covers the new types): the four repair endpoints above; `GET /roadmaps?unassigned`; `RoadmapSummaryResponse.linked_pack_version`; `SubjectWithReadiness.roadmap_count`; `SubjectContentPackResponse.chapter_count`, `written_scenario_count`; `TopicGuideSectionResponse.source` is a Literal including `course`; `TopicGuideSectionWrite.source`.

**Database:** no table, no column, no migration. `topic_guide_sections.source` is a string column; `course` is a new value. Nothing is written except by the learner's confirmed actions.

### Verification (2026-10-08, final, after the Agile Metrics revert)

All suites were run on the final code, after the last change (Agile Metrics restored to its pre-Phase-7 scope):

- Backend: `pytest -q` -- 1044 passed, 2 skipped, 0 failed (from a throwaway worktree holding the same changes: the learner's app was open and writes the real WAL, which trips the real-database guard).
- Frontend: Vitest -- 126 files, 1485 tests passed; `npm run typecheck` (including the new `apiContract.check.ts` lines) clean; `npm run lint` -- 0 errors, no new warnings.
- Playwright, full suite from a clean state (no leftover servers or processes, `test-results` cleared, default 2 workers, all three projects: `chromium`, `chromium-dev` navigation crawl, `performance`): **103 passed, 0 failed, 0 flaky, 0 skipped** (18.7 min). Includes the new `e2e/curriculum.spec.ts` (3 tests): topic links, back-links, topic evidence, refresh, back/forward, the no-preparation list, a confirmed unlink, axe light/dark at 390px.
- Fixed on the way: Study Library had become unreachable for a certification with no linked roadmap (now open for a guide, a linked roadmap, scenarios, or a certification); an earlier full run's crawl failure was a Chrome memory failure on this machine (`net::ERR_INSUFFICIENT_RESOURCES`), not the app, and did not recur.
- Real-data audit on a scratch copy (servers on 8210/5383, never the learner's files): every learner action run there -- 60 ADF titles repaired (ids unchanged, topic 278 still in progress with its 122-character note, a second preview changes nothing); 581 Agentic AI sections relabelled, 15 left "Written by you"; roadmap 3 to Databricks, roadmap 4 unlinked and archived; ADLS attached to Databricks (11 chapters, 0 scenarios). PSM I and System Design then list no roadmap; roadmap statuses unchanged. Rendered for ADF, PSM I, Kafka, Agentic AI, Databricks, System Design and no preparation, light and dark, 390px: 0 axe violations, no sideways scroll, no console errors -- after two fixes it found (a Study Library chapter card was an `h6` under an `h2`; the guide's "Check yourself" box was labelled only by its helper text).

**Scope note:** Agile Metrics keeps its pre-Phase-7 rule (PSM I, or a preparation whose Learning Lab is available). Phase 7 does not broaden it.

### Known limitations

- `InterviewPracticeSetupPage` still opens System Design's default tab by `selectedId === 3` (interview format, not curriculum; out of 7.10's scope).
- System design attempts and design reviews have no owner (D6).
- The real-data repairs (ADF titles, Agentic AI relabel, roadmaps 3/4, ADLS) are available as learner actions and were exercised only on a scratch copy; the learner's database is unchanged until they run them.
