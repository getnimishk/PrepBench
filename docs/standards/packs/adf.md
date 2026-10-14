# ADF pack annex: Azure Data Factory

| | |
|---|---|
| **Pack** | `adf` v1, "Azure Data Factory" ([`v1.json`](../../../backend/app/content/packs/adf/v1.json)) |
| **Applies** | [PrepBench Instructional Standard](../PrepBench_Instructional_Standard.md) v1.3 (approved 2026-10-13), section 14 |
| **Annex status** | **Draft for review. Not approved.** Until it is approved, CLAUDE.md rule 17 treats the ADF pack as having no approved annex. |
| **Annex version** | 0.5 (2026-10-14), maintainer decisions U18, U24 to U29 and F6 applied |
| **Evidence base** | Repository at `main` @ `0653167`: the pack, the [60-topic roadmap workbook](../../research/ADF_Master_Roadmap_Mapped.xlsx), the [study-guide crosswalk](../../research/ADF_Study_Guide_Roadmap_Crosswalk.md), the [alignment blocks](../../research/ADF_Study_Guide_Roadmap_Alignment_Blocks.md), the [scenario crosswalk](../../research/ADF_Scenario_Roadmap_Crosswalk.md), the [Microsoft source enrichment audit](../../research/ADF_Microsoft_Source_Enrichment_Audit.md), the [documentation notes](../../research/adf-documentation-notes.md) and the [ADF Behaviour Lab registry](../../../frontend/src/services/adfLab/experiments.ts) |

This annex says how the standard applies to ADF. It adds ADF-specific detail and cannot waive anything in the standard (standard section 14). It records what the repository shows. It does not rewrite, and does not certify, any study-guide content, and it corrects no other file: where another file needs correcting, section 11 records a follow-up.

## 0. How to read this annex

**Status words.** Every claim about the state of the pack uses one of these:

| Word | Meaning |
|---|---|
| **Established** | Read directly from a repository file named alongside it, or recalculated from it. |
| **Proposed** | Written by this annex's author as a decision for the reviewer. Not recorded anywhere else in the repository. |
| **Pending** | Work the standard requires that has not been done. Nothing marked pending is claimed. |
| **Not verified** | Nobody has checked it against the standard. Absence of a known problem is not a pass. |

**Name collisions to avoid.** The roadmap workbook labels all 60 topics with priority "Core" and labels coverage "Full". Those are roadmap vocabulary. "Core instructional unit", "Full instructional unit" and "Reference companion" in section 7 are the standard's classes (section 13). A topic marked "Full" coverage says nothing about the standard's classification.

**Identifier key.** Three kinds of number appear in the sources, and they are different things:

- **T#** is a roadmap topic number, 1 to 60, as defined by the workbook's "ADF Master Roadmap" sheet.
- **Scenario ID** is the pack's scenario `id` (a string). It appears in the address of a scenario page (`/scenarios/adf/<id>`) and in the crosswalk's "Scenario ID" column.
- **Scenario number** is the pack's `number`, 1 to 18, shown in the page title ("5 · Green runs that failed") and used as the crosswalk's "#" column and in its "Scenario N" headings.

For scenarios 1 to 8 the ID equals the number. For the others they differ:

| Scenario ID (pack `id`, used in the address) | Number shown in the app (pack `number`, = crosswalk "#") | Title | Pack chapter |
|---|---|---|---|
| 1 | 1 | The missing lots | `incremental` |
| 2 | 2 | The first pipeline | `building-blocks` |
| 3 | 3 | The server nobody owned | `integration-runtimes` |
| 4 | 4 | The hour that never loaded | `triggers` |
| 5 | 5 | Green runs that failed | `monitoring` |
| 6 | 6 | The skipped rows nobody read | `bad-rows` |
| 7 | 7 | The rename that re-read everything | `cdc` |
| 8 | 8 | The new column | `transform` |
| 17 | 9 | The balances that matched | `reconciliation` |
| 9 | 10 | The audit question | `monitoring` |
| 10 | 11 | The bill that doubled | `performance-cost` |
| 11 | 12 | The password in the pipeline | `security` |
| 18 | 13 | Card numbers in the error log | `sensitive-data` |
| 12 | 14 | The urgent fix | `cicd` |
| 13 | 15 | The 1,000 tables that vanished | `migration` |
| 14 | 16 | Cutover in three weeks | `migration` |
| 15 | 17 | The count Databricks sent back | `pipelines` |
| 16 | 18 | ADF or Fabric? | `fabric` |

In this annex "scenario 17" means ID 17 unless it says "no." (number). The earlier wording discrepancies for "scenarios 1, 10 and 15" are scenario IDs 1, 10 and 15 (shown as numbers 1, 11 and 17).

**The unit is currently the chapter.** The pack has 21 chapters and no smaller addressable unit. The standard (section 5) asks for units with distinct outcomes and checkpoints. This annex registers the 21 chapters as they exist and records where a split is recommended. It does not split anything.

## 1. Learner profile and prerequisites

**Intended audience** (roadmap workbook, sheet "ADF Master Roadmap"): a Product Owner, Program or Delivery Manager, or Cloud-Engineering Manager who needs to reason about ADF architecture, orchestration, data movement, networking, security, operations, cost, Databricks integration and interview scenarios. Topic 4 states the goal as explaining a design "without pretending to be an ADF developer".

**ADF beginner profile.** Written for the standard's default learner (standard section 2), narrowed for ADF:

- Has general data concepts: what a database, a table, a file and a schedule are, and the idea of moving data from one system to another (ETL or ELT).
- Has **no hands-on experience with ADF** and may never have opened the Azure portal. May have seen Azure or Databricks named in conversation.
- May be strong in another area, such as software or Spark. That is not treated as ADF knowledge. Never assume familiarity with ADF-specific terms (pipeline, activity, linked service, dataset, integration runtime, trigger, DIU) just because they appear in the roadmap.
- Needs no Azure account, subscription or credentials to use this pack (see section 4).

**Prerequisites.** The pack states none: the chapter schema has no prerequisites field and no chapter states prior knowledge. The word "prerequisite" appears in the body text of Chapters 5, 10, 14 and 18; those occurrences were reviewed and use it in technical senses only (section 7.5), not as instructional prerequisites. The roadmap workbook has no prerequisite column. The per-topic prerequisites in section 6 are therefore **proposed**: the annex author derived them from the topic's content and the roadmap's phase order, and they must be validated in the independent review (section 8, follow-up F6). Chapter-level prerequisites are the union of the topic-level ones for that chapter's depth topics.

**Baseline setup knowledge required of the learner:** reading JSON and simple expressions (the guide shows ADF JSON and expression snippets). Nothing else is required to read, and no setup is required for the lab.

## 2. Authoritative-source hierarchy

### 2.1 Which file answers which question

No single file is authoritative for every question. Each kind of information has its own source. Where files disagree, this annex records the disagreement. It does not treat a disagreement as resolved.

| Information type | Source used | Role and limits | What was checked |
|---|---|---|---|
| Required curriculum scope and intended outcomes | The roadmap workbook, sheet "ADF Master Roadmap" | Defines topic IDs, topic meanings, objectives, success criteria and required scope. CLAUDE.md names the roadmap as the curriculum planning source (ADF governance item 1). It says nothing about what the guide contains or what learners can do. | 60 of 60 titles in the Markdown crosswalk and in the lab registry equal the workbook's. The scenario crosswalk's do not (appendix B). |
| Actual learner-facing content and application behaviour | The content pack [`v1.json`](../../../backend/app/content/packs/adf/v1.json) for what the guide contains; the implementation for how the application behaves (`content_pack_service.py`, `curriculumLinks.ts`, the lab registry `experiments.ts`) | The pack's alignment blocks are what the application uses to link topics to chapters (CLAUDE.md ADF governance item 11). From chapters the application derives scenarios (the scenario's `chapter` field) and experiments (the registry's topic numbers). None of this shows that a learner achieves an outcome. | Read directly. |
| Recorded guide-topic mappings | The Markdown study-guide crosswalk, the chapter alignment blocks and the alignment-blocks document | Mapping and audit artifacts. They are reconciled against the roadmap and the pack, not assumed to agree. This annex's "pack location" column follows the pack's alignment blocks because the application uses them. That is a reading choice. It does not resolve the differences. | The alignment-blocks document equals the pack block by block (0 differences). The crosswalk and the audit differ from the pack for some topics (appendix A). |
| Scenario-topic associations | The scenario crosswalk | A research association. It is not an application-enforced topic link: no application code, test or script references it, and the pack links scenarios to chapters only. Discrepancies and uncertain mappings are preserved (appendix B). | 11 of 54 references conflict with the workbook. |
| Technical factual claims | The relevant Microsoft Learn page or other official technical source for the claim, connector, feature, behaviour or limit being taught (2.2) | Unresolved conflicts between Microsoft pages are stated, not settled silently. | Not re-fetched in this annex. |

Two files are **historical records**, not current sources, wherever they disagree with the above: the workbook's "Study Guide Crosswalk" sheet (committed once, with the Markdown crosswalk, and not updated afterwards) and the documentation notes' dated statements (section 11). Their history is kept, not deleted. A source is never preferred because it reports more complete coverage.

### 2.2 Authority for technical claims

| Claim type | Primary source | Notes |
|---|---|---|
| What an ADF feature is, how it behaves, documented defaults and limits | The Microsoft Learn page for that specific feature (`learn.microsoft.com/azure/data-factory/...`) | The audit records the page and the claim for each of the 60 topics. |
| Subscription and service limits | Microsoft Learn "Azure subscription and service limits" (ADF section) | Quote the number as the page states it. |
| Fabric Data Factory and ADF positioning | Microsoft Learn Fabric pages (comparison and migration-planning pages) | Time-sensitive; see re-verification below. |
| Reliability, regions and zones | Microsoft Learn Azure reliability page for Data Factory | |
| Prices | The Azure pricing page. The documentation notes record that prices live there, not in the docs. | The guide teaches cost *drivers* (meters), not prices. |
| White-paper-derived claims | Only where a current Microsoft Learn page supports them. The notes classify each (notes section 31.3). | The white papers are not cited as authority for a limit. |

**Never confused with Microsoft facts** (CLAUDE.md, ADF governance item 9): PrepBench examples, interpretations, recommendations, architectural opinions and course recommendations. Each is labelled as PrepBench's own. Chapter 1 has a section titled "How to read the labels in this guide"; whether it, or any chapter, consistently marks PrepBench's own material apart from Microsoft's is **not verified**.

**Conflict rules.**

1. A page about the specific feature outranks an overview page.
2. A page describing the *modern* behaviour outranks one describing a legacy behaviour that the modern page lists as affected (example: trusted service, Legacy vs Modern).
3. Where two current Microsoft pages disagree and the question cannot be settled from the pages, the guide states the disagreement and tells the learner to check the current documentation. It does not pick a winner silently. The six open Microsoft inconsistencies recorded in the notes (section 30.3: CDC checkpoint key, SHIR node limit, trusted service and SHIR, "SHIR needs no VPN", automated publish and trigger handling, managed virtual network outbound control) remain open and stay governed by this rule.
4. A figure that has changed between Microsoft pages gets the number the page states, with the page named. A universal range is never invented (CLAUDE.md, ADF governance item 13).
5. A tool, platform or AI summary of a page is never a source. The notes record that two web-fetch summaries were wrong; every figure is checked against the page text.

**Re-verification of time-sensitive claims.** Re-verify, and date, any claim that can change: limits and defaults, supported-connector lists and counts, DIU ranges, trigger limits, Fabric positioning and migration paths, GA dates, prices, package names and API versions. Record the check date beside the claim, in the form the pack already uses ("Microsoft Learn (2026-10-12)" in each chapter's `sources` field). The cadence is a proposal, in section 10.

**Binding technical conventions** already recorded in CLAUDE.md under ADF governance item 13 (pipeline concurrency versus subscription limits; connection models as upper-bound planning; DIU ranges; staged-copy configuration hierarchy; SHIR networking and port 8060; CDC checkpoints). That item is the binding record. This annex does not restate its text, to avoid two versions drifting apart.

**Source record for the content as it stands (Established).** The audit table accounts for all 60 topics once each. Counted from its rows, the decisions are IMPLEMENT 36, LINK ONLY 17, ALREADY ADEQUATE 5 and NO SUITABLE RESOURCE FOUND 2. The audit's own summary table states different numbers (section 11).

## 3. Terminology policy

| Topic | Policy |
|---|---|
| Product names | Write "Azure Data Factory (ADF)" on first use in a unit, then "ADF". Write "Fabric Data Factory" (the pack's established short form, 23 uses) or "Data Factory in Microsoft Fabric" for the Fabric service, and never "ADF" for it. Where a Microsoft page covers both ADF and Azure Synapse pipelines, say so rather than implying ADF only. |
| Core objects | Use Microsoft's terms: pipeline, activity, dataset, linked service, integration runtime (IR), trigger, pipeline run, activity run, data flow ("mapping data flow"). Define each before it is relied on (standard section 2). Do not use the deprecated "wrangling data flow" or "Power Query" names as current features. |
| Integration runtime | Spell out the three families the pack teaches (Azure, self-hosted, Azure-SSIS). Write "self-hosted IR (SHIR)" on first use. |
| Acronyms | Expand on first use in each unit, with a plain-English reason it matters: DIU (Data Integration Unit), CDC (change data capture), CMK (customer-managed key), IaC (infrastructure as code), ARM (Azure Resource Manager), VNet (virtual network). |
| Spelling | Guide prose follows Microsoft's US spelling, which is the pack's majority usage (for example "parameterize" 16 times, "parameteris" 4). Roadmap topic titles and the lab name "ADF Behaviour Lab" keep their established spelling. Quoted Microsoft text and configuration keys are reproduced exactly. Mixed spelling is a known inconsistency, to be fixed in units when they are next touched, not in bulk. |
| Lab names | The ADF lab is the **ADF Behaviour Lab**. The Databricks lab is the **Lakehouse Lab** and is never called a Behaviour Lab (CLAUDE.md, Phase 4 terminology discipline). |
| Simulation wording | Simulated results are described with "the model shows", "in the simulation" or "teaching constant". They are never described with "ADF ran", "Azure executed" or "the pipeline succeeded" (section 4). |
| Cross-product differences | Where a term means different things in different products (for example "trigger", "pipeline" in ADF, Synapse and Fabric; "private endpoint" versus "managed private endpoint"), explain the difference and cross-link, as the standard's section 10 requires. |
| First use and glossary | Every unit explains an unfamiliar term at its first use (standard section 2). A glossary is a reference companion that supplements this and never replaces it. **No glossary exists in the pack** (the word appears only as a deliverable name, "four-term networking glossary"). The location is a recommendation in section 10. |

## 4. Lab environment and safeguards

**What the ADF Behaviour Lab is (Established).** The ADF Behaviour Lab (`/lab/adf`) has five experiments (watermark, triggers, concurrency, copy-perf, fault-tolerance with two modes), each run through eight stages: Understand, Predict, Manipulate, Observe, Reason, Apply, Explain, Retrieve. It is a **teaching simulation**. It **does not execute pipelines, does not connect to any Azure subscription and does not run Azure Data Factory.** Every screen says so, and results carry a "Simulation" label ([Learning Lab Guide](../../wiki/Learning-Lab-Guide.md); [Phase 5 contract](../../implementation/PHASE-5-CONTRACT.md); [`experiments.ts`](../../../frontend/src/services/adfLab/experiments.ts)).

**Rules that follow from that, for any unit, tutorial or label:**

1. Never write that a lab result is something Azure or ADF did. Describe it as the model's result.
2. Never present a teaching constant (a number chosen to make an effect visible) as a measured or documented Azure value. Numbers that come from the ADF guide are labelled as such (kind `fact`, "From the ADF guide"); everything else is a model assumption.
3. Two experiments (Watermark, Triggers) run the Lakehouse Lab's ADF model; three have their own models. Watermark and Triggers run over the fictional `semiconductor-v1` data; the other three run their own pure models. No real data is used.
4. Do not extend the lab's claims. The scope is frozen at five experiments, retry is a lever, and timeout, backfill and SM-2 scheduling are never simulated or claimed (CLAUDE.md, Phase 5). Changing that is a product decision.

**What the lab registry does and does not establish.** The registry names the roadmap topics each experiment is for, and the chapters it draws on. Its graded stages (Reason, Apply, Retrieve) carry a source chapter, not a topic number. Whether every named topic is actually practised in depth is **not verified**, and for at least one it is thin (T45 is touched by one coupling-ledger line and one recall question).

**Environment and safeguards for the simulation.**

| Item | Position |
|---|---|
| Accounts, subscription, permissions | None required. |
| Software and runtime | The PrepBench app only. It runs locally; a network call happens only if the learner configures a cloud AI provider. |
| Data | Fictional sample data. Attempts are stored locally in `learning_attempts`, under the learner's chosen preparation. |
| Cost | None. |
| Cleanup | None needed. A finished run is never edited; "start again" creates run n+1. |
| Privacy and security | No credentials are entered. No real data is used. No telemetry. |

**Live Azure.** The pack contains no live-Azure hands-on exercise. **Pending, not required now:** if one is ever added, its unit must first list the subscription and role needed, an estimated cost, resource cleanup, security and privacy handling, and the supported ADF and tool versions (standard section 8, items 2 and 7, and the section 14 field), and must be a Full instructional unit. The crosswalk records that a Bicep outline in Chapter 18 was validated with the Azure Bicep compiler v0.47.16. This annex did not check that claim. Whether any other sample in the guide was ever run against a live subscription is **not established**.

## 5. Pack Overview Visual specification

**Status: PENDING. The visual has not been created. Nothing below is a claim that it exists.**

**What exists today (Established).** Chapter 1 contains one image, `adf-architecture-overview.svg`, a Microsoft Learn diagram mirrored into the repository. The audit records it as CC BY 4.0, unmodified, with attribution. This annex did not re-verify those reuse terms. It is a third-party diagram of the ADF lifecycle. It is **not** the original Pack Overview Visual the standard requires (standard section 6), and it does not replace it. Whether it is kept beside the new visual is a recommendation in section 10.

**Specification (Proposed, for the reviewer).**

| Field | Specification |
|---|---|
| Learning role | A pre-read and post-review anchor: the learner sees how ADF's parts and one end-to-end story fit before studying components, and returns to it as each component is taught and again to consolidate. It is subordinate to the lessons. It does not replace them. |
| Planned asset location | `frontend/public/assets/content/packs/adf/adf-pack-overview.svg` (main overview), with a detail companion `adf-pack-overview-detail.svg` in the same folder. Vector format so it stays sharp at any size. Not created. |
| Placement | Early in Chapter 1, after a short orientation sentence saying what the learner is looking at and why. Chapter 1 now opens with the maintainer-facing "Roadmap alignment" block, which the standard (sections 6 and 10) would place below the learner-facing orientation; that is a decision for the Chapter 1 rework step (U14). |
| Anchor scenario | One end-to-end story, as the standard's section 6 gives it: a file arrives, a trigger starts a pipeline, data is ingested, transformation or external compute runs, output is published, and the run is monitored. |
| Coverage (standard section 6 list) | **Why it exists:** moving and orchestrating data across systems on a schedule. **Where it fits:** ADF as orchestrator, not the main compute engine (Chapter 1, topic 1), and its boundaries against Databricks, Synapse and Fabric Data Factory. **Core blocks:** data sources and destinations, linked services, datasets, pipelines and activities, integration runtimes, triggers. **End-to-end flow:** input, trigger, pipeline, copy and transformation, output, consumer. **Execution and integration:** where each step runs (Azure IR, self-hosted IR, managed VNet) and which external compute or services participate (mapping data flows, Databricks, Azure Functions, SQL). **Cross-cutting:** monitoring and alerts, security (managed identity, Key Vault, private networking), Git and CI/CD. **Outcome and value:** a governed, observable, repeatable data movement. It shows relationships and the story. It does not list every property, connector or limit. |
| Original work | Built by PrepBench from verified facts. Microsoft's ADF Visual Guide is an instructional reference only: its artwork and layout are not copied, traced or adapted. Every fact drawn must be checked against the pages in section 2.2 before the figure is accepted. |
| Third-party marks and icons | Do not use Microsoft or Azure icon sets, logos or artwork unless the specific asset's terms have been checked and recorded. Use plain shapes and text labels by default. Product names appear for identification only (the audit's trademark note applies). |
| Alternative text | A one-sentence alt text naming the diagram and its purpose, plus a long description in the surrounding text that walks the flow step by step in order, so a reader who cannot see the image gets the same story. The long description is part of the lesson text, not hidden. |
| Caption | States scope (what is and is not shown), how to read it (start at the anchor scenario's first step, follow the arrows), and that it is a PrepBench summary rather than a Microsoft diagram. |
| Attribution and rights | Original PrepBench artwork, no third-party material. Metadata recommendation (section 10): identify the asset as PrepBench's own and never assign Microsoft's licence to it. |
| Legibility, zoom and detail | The main overview must stay legible at the guide's normal display width (the renderer sets `maxWidth: 780`). If a part cannot, move it to the detail companion rather than shrinking it. The guide renderer has **no zoom or full-size control** (checked in `GuideChapterPage.tsx`); adding one is a product follow-up (F10), not an existing capability. |
| Style | Labelled components, arrows with meaning, restrained colour that works in light and dark mode, a legend if needed. Colours come from the theme tokens where the figure is built in the app, per the design system. |
| Acceptance | Technical accuracy and source check, accessibility check (alt text, contrast in both themes, 390px width), and the independent comprehension pass (section 8). All three are pending. |

## 6. Curriculum mapping

**Sources of the mapping.** For each of the 60 roadmap topics: the topic, objective, success criterion and deliverable come from the roadmap workbook (the authority for scope and outcomes, section 2.1); the chapters and relevant sections come from the pack's own "Roadmap alignment" block at the top of each chapter; the Microsoft pages come from the audit. Where the pack, the crosswalk and the audit disagree on chapters, the pack is followed and the others are marked (appendix A).

**Reading the topic tables.**
- **Pack location:** the **depth unit** is in bold, followed by other chapters that also teach the topic. The depth unit is the first chapter in the crosswalk's list that the pack's alignment block also lists. A double dagger marks chapters cited only by the crosswalk or the audit, not by the pack.
- **Intended outcome:** the roadmap's objective and success criterion, verbatim. The pack's chapters do not state objectives (section 1).
- **Roadmap deliverable:** the artefact the roadmap suggests as evidence. It is a prompt to the learner, not proof that anyone produced it, and the pack does not specify it as an exercise except where section 7 says so.
- **Prereqs (proposed):** roadmap topic numbers, proposed and not established.
- **Sources:** the Microsoft Learn page(s) the audit records for the topic, and the audit's decision.
- **Advanced and reference material:** the pack marks none as advanced or as a reference companion. The other chapters in the location column are the closest evidence of further depth or cross-links.

### 6.1 What the counts mean

| Measure | Count | Exact meaning |
|---|---:|---|
| Roadmap topics mapped to a depth unit | 60 | Every topic in the workbook appears in at least one pack alignment block. |
| Topics also taught in a second chapter | 26 | The pack lists the topic in more than one chapter's alignment block. |
| Topics named by a Behaviour Lab experiment | 16 | The lab registry lists the topic number for an experiment. It is a registry statement; how deeply each topic is practised is not verified. |
| Topics with a scenario linked at chapter level | 54 | At least one of the topic's chapters has a scenario whose `chapter` field names it. It does not mean the scenario tests that topic. |
| Topics with a diagnostic question linked at chapter level | 28 | Same, for the 10 diagnostic questions. |
| Topics whose chapter sets differ between pack, crosswalk and audit | 12 | Appendix A. |

### 6.2 Evidence of practice or assessment, by status

A mapping from topic to chapter is **not** evidence that the topic is practised or assessed.

**What the sources carry natively, and what the application enforces:**

| Link | Carried by | Granularity | Used by the application? |
|---|---|---|---|
| Topic to chapters | The pack's alignment blocks | Topic | Yes. The server resolves them (CLAUDE.md ADF governance item 11). |
| Chapter to scenarios | Each scenario's `chapter` field | Chapter | Yes, derived: `curriculumLinks.ts` lists a topic's scenarios through its chapters. This is navigation, not a statement that the scenario tests the topic. |
| Topic to lab experiments | The lab registry's `topics` numbers | Whole experiment | Yes: the application links an experiment to a topic by those numbers. They do not mark any individual question or stage as testing the topic. |
| Scenario check, diagnostic question or lab stage item to topic | Nothing. Items carry at most a chapter. | None | No topic ID exists on any item. |
| Scenario to topic (research) | The scenario crosswalk | Topic number | No. No application code reads it (appendix B). |
| Roadmap deliverable to learner work | Nothing verified | None | No. The deliverable text is displayed. The Demonstrate page records a free-text explanation with a self-grade against the topic's success criterion. |

**Evidence status labels**, used in the matrix in 6.4 and in the counts below. Each topic carries the highest status it has:

| Label | Meaning |
|---|---|
| direct topic-level practice — annex-mapped; not application-enforced at item level | An exercise or lab is tied to this topic by the lab registry (an experiment-level declaration) or by chapter text that says the exercise satisfies "Roadmap Topic N" (found for T53, T54, T60 only; self-directed and ungraded). The mapping was read from the sources by this annex. No lab stage or exercise item carries the topic. How deeply the topic is practised is not verified. |
| direct topic-level assessment — verified | An assessment item that carries this topic and tests its intended outcome, verified from the sources. **None established.** |
| chapter-level related practice | A scenario, diagnostic, lab (through its chapter list) or sandbox practice link is attached to a chapter that also teaches the topic, but not to the topic. It does not prove the topic is practised or assessed. |
| research-only association | The scenario crosswalk names the topic for a scenario. A planning artifact, not an application link; 11 of its 54 references conflict with the workbook. |
| no evidence established | None of the above. |

**Counts (recalculated from the matrix in 6.4; each topic counted once, at its highest status):**

| Highest evidence status | Topics |
|---|---:|
| direct topic-level practice — annex-mapped; not application-enforced at item level | 18 |
| direct topic-level assessment — verified | 0 |
| chapter-level related practice | 40 |
| research-only association | 1 |
| no evidence established | 1 |

**What these figures prove, and what they do not:**

- The 18 direct-practice topics are derived by this annex from the sources. 16 come from the lab registry, whose topic numbers are native to the registry and used by the application to link experiments to topics, but only at experiment level. 2 more (T54, T60) come from chapter prose. (T53 is in both.) None is a topic ID carried by a scenario, a lab stage or an exercise item. The application enforces the experiment-to-topic link. It does not enforce that the topic's outcome is practised.
- **Zero direct assessment** means no assessment of a topic's specified outcome or roadmap deliverable has been established from the sources inspected. It does not mean the application has no questions or learner interactions: the pack has 72 scenario checks, 10 diagnostic questions and the lab's graded stages, and the Demonstrate page exists. They attach to chapters or to a whole experiment, not to a topic's deliverable.
- **Self-graded demonstrations** (the Demonstrate page) are a learner's own judgement against the success criterion. They are not objectively verified evidence of completing a roadmap deliverable, and whether any learner used them is not in the repository.
- **Chapter-level related practice** does not prove that every topic taught in that chapter is practised or assessed. The application lists such scenarios beside a topic, and shows Evidence items from them read-only without changing the topic's status (`curriculumLinks.ts`); that is navigation, not proof.
- The roadmap deliverables are displayed text. Nothing in the application verifies that one was produced (U7).

### 6.3 Topic mapping tables

### Phase 1. ADF Foundations

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 1 | What Azure Data Factory Is | **Ch 1** `what-it-is` (What ADF is; The documentation's own example; The four stages the documentation describes; The typical journey of one row) | **Objective:** Understand ADF as a managed cloud data-integration and orchestration service; distinguish orchestration, movement and transformation.<br>**Success:** Explain what ADF does, where it fits in an Azure data platform, and why it is not the primary compute engine for heavy transformation. | Write a one-minute ADF explanation for a Product/Program interview. | None (general data concepts only) | [introduction](https://learn.microsoft.com/en-us/azure/data-factory/introduction) (audit: IMPLEMENT) |
| 2 | ADF vs Databricks vs Synapse vs Fabric Data Factory | **Ch 1** `what-it-is` (ADF vs Databricks vs Synapse vs Fabric: architecture selection framework; Where it is heading; Ch 20 (ADF and Fabric Data Factory)); Ch 20 `fabric` ((Intro); Not in Fabric yet; Three ways to move; Ch 1 (What ADF is, and what it isn't)) | **Objective:** Understand where ADF, Databricks, Synapse and Fabric Data Factory overlap and where they serve different architectural roles.<br>**Success:** Choose the right service for orchestration, transformation, lakehouse processing and integrated analytics, with explicit trade-offs. | Create a service-selection matrix for 4 common enterprise scenarios. | 1 | [introduction](https://learn.microsoft.com/en-us/azure/data-factory/introduction); [fabric/data-factory/compare-fabric-copy-data-tool-to-adf-copy-data-tool](https://learn.microsoft.com/en-us/fabric/data-factory/compare-fabric-copy-data-tool-to-adf-copy-data-tool) (audit: LINK ONLY) |
| 3 | ADF Resource Model | **Ch 2** `building-blocks` (The building blocks table; How they connect: the documentation's example; Ch 3 (Pipelines, activities and control flow)) ‡ also cited elsewhere: Ch 3 | **Objective:** Learn factory, pipeline, activity, dataset, linked service, trigger and pipeline run relationships.<br>**Success:** Draw the object model without mixing connection metadata, data metadata and execution state. | Produce an ADF object relationship diagram. | 1 | [concepts-pipelines-activities](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities) (audit: IMPLEMENT) |
| 4 | ADF Mental Model for Managers | **Ch 1** `what-it-is` (What ADF is; How to read the labels in this guide; Ch 21 (Pitfalls)); Ch 21 `pitfalls` (Why it matters to you; Ch 1 (What ADF is, and what it isn't)) | **Objective:** Translate ADF concepts into ownership, risk, SLA, dependency, cost and operational language.<br>**Success:** Explain an ADF design to PO/PM/EM stakeholders without pretending to be an ADF developer. | Create a one-page manager mental model. | 1 | [introduction](https://learn.microsoft.com/en-us/azure/data-factory/introduction) (audit: LINK ONLY) |

### Phase 2. Core ADF Construction

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 5 | Linked Services | **Ch 2** `building-blocks` (The building blocks table (Linked service); How they connect; Things worth knowing) | **Objective:** Understand connection information, authentication, connectVia and target-system permissions.<br>**Success:** Explain how credentials and connectivity are separated from pipeline logic. | Build a linked-service decision checklist. | 3 | [concepts-linked-services](https://learn.microsoft.com/en-us/azure/data-factory/concepts-linked-services) (audit: IMPLEMENT) |
| 6 | Datasets and Parameterisation | **Ch 2** `building-blocks` (The building blocks table (Dataset); Things worth knowing; Ch 3 (Pipelines)) ‡ also cited elsewhere: Ch 3 | **Objective:** Understand datasets as reusable views of data and parameterise paths, tables and filenames.<br>**Success:** Explain pipeline → dataset parameter flow and avoid hard-coded source/sink definitions. | Create a parameterised dataset pattern for table/date. | 3, 5 | [concepts-datasets-linked-services](https://learn.microsoft.com/en-us/azure/data-factory/concepts-datasets-linked-services) (audit: IMPLEMENT) |
| 7 | Pipeline Parameters, Variables and Expressions | **Ch 3** `pipelines` (Defaults that surprise people) | **Objective:** Understand read-only parameters, mutable variables, expression evaluation and dynamic content.<br>**Success:** Correctly choose between parameter, variable and expression and explain parallel-loop variable risk. | Create a reusable pipeline parameter model. | 3, 6 | [concepts-pipelines-activities](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities) (audit: IMPLEMENT) |
| 8 | Global Parameters and Reusable Configuration | **Ch 2** `building-blocks` (Things worth knowing; Ch 18 (From Dev to Prod)) ‡ also cited elsewhere: Ch 18 | **Objective:** Understand factory-wide configuration and environment-specific values.<br>**Success:** Explain when a value belongs at pipeline, dataset, linked-service or factory scope. | Design Dev/Test/Prod configuration boundaries. | 3, 7 | [author-global-parameters](https://learn.microsoft.com/en-us/azure/data-factory/author-global-parameters) (audit: IMPLEMENT) |
| 9 | Activity Types and Execution Semantics | **Ch 3** `pipelines` (Three kinds of activity) | **Objective:** Understand data movement, transformation and control-flow activities and their execution model.<br>**Success:** Classify an activity correctly and explain what executes in ADF versus a downstream compute service. | Map 15 common activities to their category and execution location. | 3 | [concepts-pipelines-activities#activity-types](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities#activity-types) (audit: LINK ONLY) |

### Phase 3. Control Flow & Orchestration

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 10 | Dependencies: Success, Failure, Completion and Skip | **Ch 3** `pipelines` (How one step leads to the next; Ch 12 (Monitoring, failures and reruns)); Ch 12 `monitoring` (A green run can hide a failure; Ch 3 (Pipelines)) | **Objective:** Understand dependency conditions and how activity graphs determine pipeline outcomes.<br>**Success:** Design a failure notification and cleanup flow without accidentally masking failures. | Build a Try/Catch-style control-flow design on paper. | 9 | [concepts-pipelines-activities#dependency-conditions](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities#dependency-conditions) (audit: LINK ONLY) |
| 11 | Lookup and Get Metadata | **Ch 3** `pipelines` (Two activities with hard limits) | **Objective:** Understand metadata discovery, output limits and common control-table patterns.<br>**Success:** Know when Lookup is appropriate and when its output constraints require a different pattern. | Design a control-table discovery flow. | 7, 9 | [control-flow-get-metadata-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-get-metadata-activity); [control-flow-lookup-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-lookup-activity) (audit: IMPLEMENT) |
| 12 | ForEach, Batch Count and Parallelism | **Ch 3** `pipelines` (Defaults that surprise people) | **Objective:** Understand iteration, parallel execution, batchCount and nesting restrictions.<br>**Success:** Explain why parallel loops can create race conditions and source/sink pressure. | Design a 1,000-table metadata-driven loop safely. | 7, 9, 11 | [control-flow-for-each-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-for-each-activity) (audit: LINK ONLY) |
| 13 | If Condition, Switch, Until and Wait | **Ch 3** `pipelines` (Three kinds of activity; How much of this to memorise) | **Objective:** Understand branching, polling and controlled repetition.<br>**Success:** Choose the correct control construct instead of overusing nested pipelines. | Map 5 workflow requirements to the correct activity. | 7, 9, 10 | [control-flow-until-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-until-activity) (audit: IMPLEMENT) |
| 14 | Execute Pipeline and Reusable Child Pipelines | **Ch 3** `pipelines` (Three kinds of activity; Defaults that surprise people) | **Objective:** Understand parent/child composition and reusable orchestration units.<br>**Success:** Explain how child pipelines reduce duplication while keeping ownership and observability clear. | Design a parent pipeline + reusable child pipeline architecture. | 7, 9 | [control-flow-execute-pipeline-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-execute-pipeline-activity) (audit: LINK ONLY) |
| 15 | Web, Function, Script and Stored Procedure Integration | **Ch 3** `pipelines` (External service integration: Web, Azure Function, Script, and Stored Procedure; Three kinds of activity) | **Objective:** Understand when ADF calls external services versus executes database-side logic.<br>**Success:** Choose the right integration mechanism and identify security, timeout and retry implications. | Create a decision table for Web/Function/Script/Stored Procedure. | 5, 9 | [control-flow-web-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-web-activity); [control-flow-azure-function-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-azure-function-activity) (audit: IMPLEMENT) |

### Phase 4. Triggers & Time

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 16 | Schedule Triggers | **Ch 5** `triggers` (Triggers table (Schedule trigger); (Intro)) | **Objective:** Understand wall-clock execution, trigger-run relationships and operational implications.<br>**Success:** Explain why a schedule trigger does not inherently model data completeness for a time window. | Design a daily 05:15 ingestion schedule. | 3, 7 | [concepts-pipeline-execution-triggers](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipeline-execution-triggers) (audit: LINK ONLY) |
| 17 | Tumbling Window Triggers | **Ch 5** `triggers` (Triggers table (Tumbling window trigger); Why the tumbling window matters) | **Objective:** Understand stateful windows, backfill, retry, delay, concurrency and dependencies.<br>**Success:** Choose tumbling windows when the processing unit is a time window and missed windows matter. | Design an hourly load with backfill and late-data delay. | 16 | [how-to-create-tumbling-window-trigger](https://learn.microsoft.com/en-us/azure/data-factory/how-to-create-tumbling-window-trigger) (audit: IMPLEMENT) |
| 18 | Event and Custom Event Triggers | **Ch 5** `triggers` (Triggers table (Storage event trigger); (Intro)) | **Objective:** Understand storage events and custom Event Grid events.<br>**Success:** Select event triggering when data arrival, not wall-clock time, is the true trigger condition. | Design a file-arrival ingestion trigger with safe filtering. | 16 | [how-to-create-event-trigger](https://learn.microsoft.com/en-us/azure/data-factory/how-to-create-event-trigger) (audit: IMPLEMENT) |
| 19 | Time Zones and Window Semantics | **Ch 5** `triggers` (Time zones) | **Objective:** Understand UTC, daylight-saving behavior and window boundaries.<br>**Success:** Explain how time-zone choices affect schedules, partitions and reconciliation. | Create a UTC-based scheduling standard. | 16, 17 | [concepts-pipeline-execution-triggers](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipeline-execution-triggers) (audit: LINK ONLY) |

### Phase 5. Integration Runtime & Networking

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 20 | Integration Runtime Fundamentals | **Ch 4** `integration-runtimes` (The three IR families table; The simple rule, and the nuance behind it; Choosing between them) | **Objective:** Understand Azure IR, Self-hosted IR and Azure-SSIS IR as the three main IR families.<br>**Success:** Select the appropriate runtime based on connectivity, execution type and operational ownership. | Create an IR decision tree. | 3 | [concepts-integration-runtime](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime) (audit: IMPLEMENT) |
| 21 | Self-hosted IR Architecture and Operations | **Ch 4** `integration-runtimes` (The self-hosted IR, in practice; Where the work happens; Scenario 3) | **Objective:** Understand SHIR installation, network reachability, scale-out/HA, patching, proxies and ownership.<br>**Success:** Explain why SHIR is production infrastructure and what the support model must contain. | Write a SHIR production handover checklist. | 5, 20 | [create-self-hosted-integration-runtime](https://learn.microsoft.com/en-us/azure/data-factory/create-self-hosted-integration-runtime); [data-movement-security-considerations](https://learn.microsoft.com/en-us/azure/data-factory/data-movement-security-considerations) (audit: IMPLEMENT) |
| 22 | Managed VNet and Managed Private Endpoints | **Ch 4** `integration-runtimes` (Choosing between them; Where the work happens; Ch 14 (Security and networking)); Ch 14 `security` (Four network terms that get mixed up; (Intro block 3); Ch 4 (Integration runtimes)) | **Objective:** Understand Managed VNet as an Azure IR configuration and how managed private endpoints provide private connectivity.<br>**Success:** Distinguish Managed VNet, managed private endpoint and a private endpoint for the Data Factory service. | Draw a private ADF network topology. | 20 | [managed-virtual-network-private-endpoint](https://learn.microsoft.com/en-us/azure/data-factory/managed-virtual-network-private-endpoint) (audit: IMPLEMENT) |
| 23 | On-premises Connectivity and Network Paths | **Ch 4** `integration-runtimes` (The simple rule, and the nuance behind it; The self-hosted IR, in practice) | **Objective:** Understand SHIR, ExpressRoute, VPN, Private Link and firewall constraints.<br>**Success:** Explain the network path instead of saying 'SHIR removes networking'. | Compare three on-premises connectivity topologies. | 21, 22 | [concepts-integration-runtime#self-hosted-integration-runtime](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime#self-hosted-integration-runtime) (audit: ALREADY ADEQUATE) |
| 24 | Private Endpoint vs Managed Private Endpoint | **Ch 4** `integration-runtimes` (Choosing between them; Ch 14 (Security and networking)); Ch 14 `security` (Four network terms that get mixed up; Ch 4 (Integration runtimes)) | **Objective:** Understand the separate purposes of private access to the factory service versus target data stores.<br>**Success:** Avoid conflating authoring/control traffic with data-plane connectivity. | Create a four-term networking glossary. | 22 | [managed-virtual-network-private-endpoint](https://learn.microsoft.com/en-us/azure/data-factory/managed-virtual-network-private-endpoint) (audit: ALREADY ADEQUATE) |

### Phase 6. Copy & Data Movement

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 25 | Copy Activity Fundamentals | **Ch 6** `copy` ((Intro); Settings that matter) | **Objective:** Understand source → read/serialize → map/convert → write/sink flow.<br>**Success:** Explain where Copy runs and what it does itself versus what downstream engines do. | Design one cloud-to-cloud and one hybrid copy pipeline. | 3, 5, 6, 20 | [copy-activity-overview](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-overview) (audit: IMPLEMENT) |
| 26 | Connectors, Formats and Capability Matrix | **Ch 6** `copy` (Connectors) | **Objective:** Understand that connector capability is connector/version-specific and should be verified against current Microsoft documentation.<br>**Success:** Avoid memorising stale source-only/sink-only lists; verify capability when designing. | Build a connector capability checklist for SQL, Oracle, S3, ADLS and REST. | 25 | [connector-overview](https://learn.microsoft.com/en-us/azure/data-factory/connector-overview) (audit: IMPLEMENT) |
| 27 | Schema Mapping and Type Conversion | **Ch 7** `bad-rows` (Values cut off without an error; Column mapping; Ch 6 (The Copy activity)); Ch 6 `copy` (Settings that matter; Ch 7 (Bad rows, cut-off values and "verified" copies)) | **Objective:** Understand column mapping, type conversion, truncation and explicit mapping.<br>**Success:** Identify precision-loss and schema-mismatch risks before production. | Create a type-conversion risk checklist. | 25 | [copy-activity-schema-and-type-mapping](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-schema-and-type-mapping) (audit: IMPLEMENT) |
| 28 | Fault Tolerance and Skipped Rows | **Ch 7** `bad-rows` (Bad rows; Ch 15 (Sensitive data in regulated industries)); Ch 15 `sensitive-data` (Five places sensitive values leak; Ch 7 (Bad rows)) | **Objective:** Understand incompatible-row behavior, skipped rows and session logs.<br>**Success:** Decide when to fail a load versus quarantine bad records and who owns the resulting data-quality workflow. | Design a bad-row quarantine operating model. | 25, 27 | [copy-activity-fault-tolerance](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-fault-tolerance) (audit: IMPLEMENT) |
| 29 | Data Consistency Verification | **Ch 7** `bad-rows` (What "verified" means; Ch 8 (Proving the migration is complete)); Ch 8 `reconciliation` ((Intro); Five levels of proof; Ch 7 (Bad rows)) | **Objective:** Understand what ADF can verify automatically and what it cannot prove.<br>**Success:** Explain why 'verified' does not equal business-level correctness. | Define a migration acceptance criterion beyond Copy success. | 25, 28 | [copy-activity-data-consistency](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-data-consistency) (audit: IMPLEMENT) |
| 30 | Staged Copy, Resume and Large File Handling | **Ch 6** `copy` (When a failed copy can resume; Ch 13 (Recovering from failures)); Ch 13 `recovery` (Rerun only what failed; Ch 6 (The Copy activity)) | **Objective:** Understand staged copy, file hierarchy requirements and supported resume scenarios.<br>**Success:** Design recovery around what ADF actually resumes instead of assuming all copies checkpoint. | Create a copy-recovery decision tree. | 20, 25 | [copy-activity-performance-features#staged-copy](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance-features#staged-copy) (audit: IMPLEMENT) |

### Phase 7. Incremental Loading & Metadata

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 31 | Full Load vs Incremental Load | **Ch 9** `incremental` ((Intro); Three patterns, depending on the table) | **Objective:** Understand initial snapshot, delta loads and when full reload remains appropriate.<br>**Success:** Choose a loading strategy based on source capabilities, volume and recovery needs. | Create a load-strategy decision table. | 25 | [tutorial-incremental-copy-overview](https://learn.microsoft.com/en-us/azure/data-factory/tutorial-incremental-copy-overview) (audit: LINK ONLY) |
| 32 | Watermark Patterns | **Ch 9** `incremental` (The watermark, step by step; Duplicates: the other failure; What a watermark can't do) | **Objective:** Understand monotonic IDs, last-modified timestamps, high-water marks and delete limitations.<br>**Success:** Design a watermark safely and explain failure cases such as late updates and clock problems. | Build a watermark control-table design. | 11, 31 | [tutorial-incremental-copy-overview](https://learn.microsoft.com/en-us/azure/data-factory/tutorial-incremental-copy-overview) (audit: IMPLEMENT) |
| 33 | Change Tracking and CDC | **Ch 9** `incremental` (Three patterns, depending on the table; Ch 10 (Change data capture)); Ch 10 `cdc` ((Intro); Ch 9 (Loading only new data)) | **Objective:** Understand Change Tracking vs CDC and their source-system prerequisites.<br>**Success:** Explain when a watermark is insufficient because updates/deletes must be observed. | Compare watermark, Change Tracking and CDC for three databases. | 31 | [concepts-change-data-capture](https://learn.microsoft.com/en-us/azure/data-factory/concepts-change-data-capture) (audit: IMPLEMENT) |
| 34 | CDC Checkpoints and Rename Risk | **Ch 10** `cdc` (The checkpoint, and the rename trap) ‡ also cited elsewhere: Ch 13, Ch 21 | **Objective:** Understand checkpoint identity, current Microsoft documentation differences and explicit-key practices.<br>**Success:** Explain the current uncertainty accurately instead of giving a universal rename rule. | Write a CDC rename/change-management runbook. | 33 | [concepts-change-data-capture](https://learn.microsoft.com/en-us/azure/data-factory/concepts-change-data-capture); [control-flow-execute-data-flow-activity](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-execute-data-flow-activity) (audit: IMPLEMENT) |
| 35 | Metadata-Driven Pipelines | **Ch 9** `incremental` (Designing an end-to-end metadata-driven pipeline framework; The watermark, step by step; Ch 19 (Migrating with ADF)); Ch 19 `migration` (The control table is the plan; Lessons the documentation draws; Ch 9 (Loading only new data)) ‡ also cited elsewhere: Ch 2, Ch 3 | **Objective:** Understand control tables, reusable pipelines, parameterised datasets and dynamic execution.<br>**Success:** Design one pipeline serving many tables without turning the metadata layer into an ungoverned framework. | Design a metadata-driven ingestion framework. | 6, 7, 11, 12, 32 | [solution-template-bulk-copy-from-files-to-database](https://learn.microsoft.com/en-us/azure/data-factory/solution-template-bulk-copy-from-files-to-database) (audit: LINK ONLY) |

### Phase 8. Data Flows & Reconciliation

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 36 | Mapping Data Flows | **Ch 11** `transform` (Mapping data flows; Writing Delta tables) | **Objective:** Understand visual transformations running on ADF-managed Spark.<br>**Success:** Know when Mapping Data Flow is appropriate versus Databricks or SQL. | Create a transformation-selection matrix. | 20, 25 | [concepts-data-flow-overview](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-overview) (audit: IMPLEMENT) |
| 37 | Schema Drift and Data Flow Design | **Ch 11** `transform` (When the source changes shape; Landing files in the lake) | **Objective:** Understand schema drift and how it affects resilient ingestion.<br>**Success:** Make schema evolution a deliberate design decision rather than an accidental behavior. | Define schema-evolution rules for a lake ingestion domain. | 36 | [concepts-data-flow-schema-drift](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-schema-drift) (audit: IMPLEMENT) |
| 38 | Reconciliation: Counts, Profiles and Row Fingerprints | **Ch 8** `reconciliation` (Five levels of proof; Why totals aren't enough; Where the checks run) | **Objective:** Understand multi-level validation: counts, aggregates, distributions, row hashes and business rules.<br>**Success:** Design reconciliation that can detect offsetting errors, not just matched totals. | Create a five-level migration reconciliation plan. | 29, 36 | [data-flow-aggregate-function](https://learn.microsoft.com/en-us/azure/data-factory/data-flow-aggregate-function) (audit: LINK ONLY) |
| 39 | Assert, Error Rows and Business Rules | **Ch 8** `reconciliation` (Five levels of proof (Level 5); Ch 11 (Transforming data: data flows, schema drift and Delta)); Ch 11 `transform` (Mapping data flows; Ch 8 (Proving the migration is complete)) | **Objective:** Understand data-quality assertions and error handling in Data Flows.<br>**Success:** Turn business rules into explicit acceptance criteria and failure paths. | Implement a logical data-quality gate design. | 36, 38 | [data-flow-assert](https://learn.microsoft.com/en-us/azure/data-factory/data-flow-assert) (audit: LINK ONLY) |
| 40 | Data Flow Performance Fundamentals | **Ch 17** `fine-tuning` (The data flow knobs; Known slow spots; Ch 11 (Transforming data)); Ch 11 `transform` (Mapping data flows; Ch 17 (Fine-tuning copies and data flows)) | **Objective:** Understand cluster startup, TTL, partitioning, skew and shuffle-related tuning.<br>**Success:** Diagnose the actual bottleneck before changing cluster size or partition settings. | Create a Data Flow performance troubleshooting checklist. | 20, 36 | [concepts-data-flow-performance](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-performance) (audit: ALREADY ADEQUATE) |

### Phase 9. Security, Governance & Monitoring

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 41 | Managed Identity, Key Vault and Authentication | **Ch 14** `security` ((Intro); How many factories?); Ch 15 `sensitive-data` (Controls the documentation provides; Ch 14 (Security and networking)) | **Objective:** Understand identity choices, secrets management and connector-specific authentication.<br>**Success:** Design credential handling without hard-coding secrets and explain authentication trade-offs. | Create an enterprise credential-management pattern. | 5, 20 | [data-factory-service-identity](https://learn.microsoft.com/en-us/azure/data-factory/data-factory-service-identity) (audit: IMPLEMENT) |
| 42 | CMK and Factory Encryption | **Ch 14** `security` ((Intro); How many factories?); Ch 15 `sensitive-data` (Controls the documentation provides; Ch 14 (Security and networking)) | **Objective:** Understand CMK setup paths, prerequisites, immutability and key-management consequences.<br>**Success:** Explain when encryption choices must be made early in the factory lifecycle. | Create a CMK decision checklist. | 41 | [enable-customer-managed-key](https://learn.microsoft.com/en-us/azure/data-factory/enable-customer-managed-key) (audit: IMPLEMENT) |
| 43 | Trusted Service: Legacy vs Modern | **Ch 14** `security` (Trusted service: Legacy and Modern); Ch 15 `sensitive-data` (Controls the documentation provides; Ch 14 (Security and networking)) | **Objective:** Understand Legacy/Modern trusted-service modes and the enterprise migration implication.<br>**Success:** Explain the current recommended direction and avoid assuming firewall bypass is timeless. | Create a legacy-to-modern migration watch item. | 22, 41 | [managed-trusted-service-identity](https://learn.microsoft.com/en-us/azure/data-factory/managed-trusted-service-identity) (audit: ALREADY ADEQUATE) |
| 44 | Monitoring, Alerts and Run History | **Ch 12** `monitoring` ((Intro); Reruns; History and alerts) | **Objective:** Understand pipeline runs, activity runs, diagnostics, alerts and retention.<br>**Success:** Define what operations should monitor beyond a green pipeline status. | Create a production monitoring checklist and alert matrix. | 3, 10 | [monitor-visually](https://learn.microsoft.com/en-us/azure/data-factory/monitor-visually); [monitor-using-azure-monitor](https://learn.microsoft.com/en-us/azure/data-factory/monitor-using-azure-monitor) (audit: IMPLEMENT) |
| 45 | Operational Logging and Sensitive Data | **Ch 14** `security` ((Intro); Ch 15 (Sensitive data)); Ch 15 `sensitive-data` (Controls the documentation provides; Five places sensitive values leak; Compliance; Why it matters to you) | **Objective:** Understand secureInput/secureOutput, monitoring exposure and the risks of session logs/data preview.<br>**Success:** Design logging that supports operations without unnecessarily exposing sensitive data. | Design a regulated-data monitoring policy. | 41, 44 | [data-movement-security-considerations](https://learn.microsoft.com/en-us/azure/data-factory/data-movement-security-considerations) (audit: IMPLEMENT) |

### Phase 10. CI/CD, IaC & Reliability

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 46 | Git Integration and Collaboration | **Ch 18** `cicd` ((Intro)) | **Objective:** Understand source control, collaboration, pull requests and environment separation.<br>**Success:** Explain why Git is the source of truth without claiming it is a universal ADF product requirement. | Create an ADF branch/PR strategy. | 3 | [source-control](https://learn.microsoft.com/en-us/azure/data-factory/source-control) (audit: LINK ONLY) |
| 47 | ARM Templates and Automated Publishing | **Ch 18** `cicd` ((Intro)) | **Objective:** Understand `adf_publish`, automated validation/export and deployment artifacts.<br>**Success:** Explain both supported template-generation approaches and their operational trade-offs. | Design a Dev→Test→Prod deployment flow. | 46 | [continuous-integration-delivery](https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery) (audit: IMPLEMENT) |
| 48 | Bicep and Infrastructure as Code | **Ch 18** `cicd` (Infrastructure as Code: provisioning ADF with Bicep; (Intro block 2); Ch 14 (Security and networking)); Ch 14 `security` ((Intro block 3); Ch 18 (From Dev to Prod)) | **Objective:** Understand where Bicep complements ADF resource deployment and environment provisioning.<br>**Success:** Explain what belongs in infrastructure-as-code versus factory content deployment. | Draft an ADF environment provisioning outline in Bicep. | 41, 47 | [quickstart-create-data-factory-bicep](https://learn.microsoft.com/en-us/azure/data-factory/quickstart-create-data-factory-bicep) (audit: LINK ONLY) |
| 49 | Deployment Parameters, Global Parameters and Trigger Handling | **Ch 18** `cicd` ((Intro); Things that catch teams out); Ch 12 `monitoring` (History and alerts; Ch 18 (From Dev to Prod)) | **Objective:** Understand parameterisation across environments and the operational implications of active triggers.<br>**Success:** Build a release checklist that separates product changes from environment configuration. | Create a deployment readiness checklist. | 8, 16, 47 | [continuous-integration-delivery#best-practices-for-cicd](https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery#best-practices-for-cicd) (audit: IMPLEMENT) |
| 50 | Reliability, Idempotency and Recovery | **Ch 13** `recovery` ((Intro); Rerun only what failed; Make every rerun safe; When a zone or a region fails; The backup is Git); Ch 18 `cicd` (Things that catch teams out; Ch 13 (Recovering from failures)) | **Objective:** Understand transient failures, retries, duplicate risk, reruns and regional/zone recovery concepts.<br>**Success:** Design reruns that are safe and explain reliability as a shared responsibility. | Write an incident-recovery runbook for a failed nightly load. | 10, 30, 44 | [concepts-pipeline-execution-triggers#recovery-and-restart](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipeline-execution-triggers#recovery-and-restart) (audit: IMPLEMENT) |

### Phase 11. Performance, Cost & Architecture

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 51 | Copy Performance: DIUs, Parallel Copies and Bottlenecks | **Ch 17** `fine-tuning` (Step 1: find the bottleneck; The copy knobs; Known slow spots; Why it matters to you); Ch 16 `performance-cost` (How long a copy takes; Tuning, in order; Ch 17 (Fine-tuning copies and data flows)) | **Objective:** Understand DIUs, parallel copies, queueing, source latency and sink throttling.<br>**Success:** Diagnose the slowest stage before scaling compute and articulate the cost/speed trade-off. | Create a Copy performance diagnosis decision tree. | 20, 25, 30 | [copy-activity-performance](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance) (audit: IMPLEMENT) |
| 52 | ADF Cost Model and FinOps | **Ch 16** `performance-cost` (What you pay for; (Intro block 3)) | **Objective:** Understand orchestration runs, DIU-hours, vCore-hours, SSIS and other operation costs.<br>**Success:** Estimate cost from workload behavior and identify levers that reduce spend without breaking SLA. | Build a simple ADF cost-driver model. | 20, 51 | [pricing-concepts](https://learn.microsoft.com/en-us/azure/data-factory/pricing-concepts) (audit: LINK ONLY) |
| 53 | Scale and Concurrency Trade-offs | **Ch 17** `fine-tuning` (Scale and concurrency architecture: designing an enterprise concurrency budget; The copy knobs; Ch 3 (Pipelines); Ch 21 (Pitfalls)); Ch 3 `pipelines` (Defaults that surprise people; Ch 17 (Fine-tuning); Ch 21 (Pitfalls)); Ch 21 `pitfalls` (Running it; Ch 17 (Fine-tuning)) | **Objective:** Understand pipeline concurrency, ForEach concurrency, source pressure and destination limits.<br>**Success:** Balance throughput, recovery, fairness and source-system safety. | Design a concurrency budget for a multi-source platform. | 12, 51 | [copy-activity-performance-troubleshooting](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance-troubleshooting) (audit: IMPLEMENT) |
| 54 | Architecture Trade-offs: ADF vs Databricks vs Synapse | **Ch 11** `transform` (Architecture trade-offs: ADF Mapping Data Flows vs Azure Databricks vs Azure Synapse Analytics; Mapping data flows; Ch 1, Ch 20, Ch 21); Ch 20 `fabric` ((Intro); Ch 1, Ch 11, Ch 21); Ch 21 `pitfalls` (Loading data; Ch 1, Ch 11, Ch 20) ‡ also cited elsewhere: Ch 1 | **Objective:** Reason about orchestration vs transformation vs SQL analytics and platform ownership.<br>**Success:** Defend architecture choices with performance, cost, operational and team-skill trade-offs. | Present an architecture choice for a lakehouse ingestion platform. | 2, 36 | [concepts-data-flow-overview](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-overview) (audit: ALREADY ADEQUATE) |

### Phase 12. Platform Integration & Interview Readiness

| T# | Topic | Pack location: chapter (relevant sections) | Intended outcome (roadmap): objective, then success criterion | Roadmap deliverable (not evidence of completion) | Prereqs (proposed) | Sources (audit) |
|---:|---|---|---|---|---|---|
| 55 | ADF + Azure Databricks | **Ch 3** `pipelines` (Handing work to Databricks; Ch 13 (Recovering from failures)) ‡ also cited elsewhere: Ch 13 | **Objective:** Understand notebook activity, parameter passing, outputs, orchestration boundaries and failure handling.<br>**Success:** Explain where ADF stops and Databricks starts in a production data platform. | Design an ADF→Databricks→validation workflow. | 2, 3 | [transform-data-using-databricks-notebook](https://learn.microsoft.com/en-us/azure/data-factory/transform-data-using-databricks-notebook) (audit: IMPLEMENT) |
| 56 | ADF + Azure Synapse | **Ch 3** `pipelines` (ADF and Azure Synapse Analytics: batch architecture and integration patterns; Three kinds of activity; Ch 11 (Transforming data)); Ch 11 `transform` (Mapping data flows; Ch 3 (Pipelines, activities and control flow)) | **Objective:** Understand common orchestration patterns, notebook/SQL integration and sink choices.<br>**Success:** Explain when Synapse-native capabilities change the ADF architecture. | Design an ADF + Synapse batch architecture. | 2, 3 | [transform-data-using-synapse-analytics](https://learn.microsoft.com/en-us/azure/data-factory/transform-data-using-synapse-analytics) (audit: LINK ONLY) |
| 57 | ADF vs Fabric Data Factory in 2026 | **Ch 20** `fabric` ((Intro); Not in Fabric yet; Three ways to move) ‡ also cited elsewhere: Ch 1 | **Objective:** Understand Microsoft's current Fabric positioning, migration considerations and capability differences.<br>**Success:** Answer 'Would you build new pipelines in ADF or Fabric?' with current, nuanced reasoning. | Prepare a 3-minute ADF vs Fabric executive answer. | 2 | [fabric/data-factory/compare-fabric-copy-data-tool-to-adf-copy-data-tool](https://learn.microsoft.com/en-us/fabric/data-factory/compare-fabric-copy-data-tool-to-adf-copy-data-tool) (audit: IMPLEMENT) |
| 58 | Enterprise Migration Architecture | **Ch 19** `migration` (End-to-end enterprise migration architecture case: 100–500 tables to Azure; (Intro); Online or offline; Hadoop to ADLS Gen2; The control table is the plan; Lessons the documentation draws); Ch 8 `reconciliation` (Five levels of proof; Why it matters to you; Ch 19 (Migrating with ADF)); Ch 13 `recovery` (Why it matters to you; Ch 19 (Migrating with ADF)); Ch 21 `pitfalls` (Loading data; Failures that look like success; Releases, security and recovery; Ch 8, Ch 9, Ch 19) ‡ also cited elsewhere: Ch 9, Ch 14, Ch 18 | **Objective:** Combine connectivity, control tables, incremental loads, reconciliation, security, CI/CD, monitoring and cutover.<br>**Success:** Design a migration plan that an EM/Program Manager can challenge on risk, ownership, throughput and recovery. | Complete an end-to-end 100–500 table Azure migration architecture case. | 21, 32, 38, 47 | [solution-template-bulk-copy-from-files-to-database](https://learn.microsoft.com/en-us/azure/data-factory/solution-template-bulk-copy-from-files-to-database) (audit: LINK ONLY) |
| 59 | ADF Interview Scenario Drills | **Ch 21** `pitfalls` (All pitfall sections; Why it matters to you; Scenario set (18 scenarios); 10 diagnostic questions); Ch 12 `monitoring` (A green run can hide a failure; Ch 21 (Pitfalls); Scenario set) | **Objective:** Practice failure, cost, security, migration, reliability and architecture scenarios using the course's scenarios.<br>**Success:** Answer with facts, trade-offs, assumptions, operational consequences and measurable acceptance criteria. | Record or write answers to 10 ADF interview scenarios. | Topics 1-58, chosen to match the scenario drilled | No suitable Microsoft Learn source (audit: NO SUITABLE RESOURCE FOUND; the audit lists only the generic ADF documentation home page, which is not offered as a source for this topic) |
| 60 | ADF Architecture Review Capstone | **Ch 21** `pitfalls` (ADF Architecture Review Capstone: end-to-end enterprise design review; Pitfalls review; Scenario set (18 scenarios); 10 diagnostic questions) | **Objective:** Conduct a structured review of an ADF design from user requirement through production operations.<br>**Success:** Defend architecture, security, networking, recovery, cost and delivery decisions under interview pressure. | Produce an architecture-review document plus 2-minute executive summary. | Topics 1-59 | No suitable Microsoft Learn source (audit: NO SUITABLE RESOURCE FOUND; the audit lists only the generic ADF documentation home page, which is not offered as a source for this topic) |


### 6.4 Evidence matrix (all 60 topics)

Scenario references are scenario IDs ("S3" is ID 3). "Reworded" and "conflicting" describe the crosswalk reference against the workbook (appendix B).

| T# | Topic | Direct topic-level practice (annex-mapped) | Direct topic-level assessment | Chapter-level related practice or assessment | Research-only association (scenario crosswalk, as written) | Highest evidence status |
|---:|---|---|---|---|---|---|
| 1 | What Azure Data Factory Is | None | None established (no item carries a topic ID) | None | None | no evidence established |
| 2 | ADF vs Databricks vs Synapse vs Fabric Data Factory | None | None established (no item carries a topic ID) | Scenarios 16<br>Diagnostics `fabric` | S16 (primary) | chapter-level related practice |
| 3 | ADF Resource Model | None | None established (no item carries a topic ID) | Scenarios 2 | None | chapter-level related practice |
| 4 | ADF Mental Model for Managers | None | None established (no item carries a topic ID) | None | S16 (secondary) | research-only association |
| 5 | Linked Services | None | None established (no item carries a topic ID) | Scenarios 2 | S2 (secondary)<br>S11 (secondary) | chapter-level related practice |
| 6 | Datasets and Parameterisation | None | None established (no item carries a topic ID) | Scenarios 2 | S2 (secondary, reworded) | chapter-level related practice |
| 7 | Pipeline Parameters, Variables and Expressions | None | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | S2 (primary) | chapter-level related practice |
| 8 | Global Parameters and Reusable Configuration | None | None established (no item carries a topic ID) | Scenarios 2 | None | chapter-level related practice |
| 9 | Activity Types and Execution Semantics | None | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | None | chapter-level related practice |
| 10 | Dependencies: Success, Failure, Completion and Skip | Lab: Fault Tolerance | None established (no item carries a topic ID) | Scenarios 5, 9, 15<br>Diagnostics `monitoring`<br>Lab via chapter: Concurrency Budget | None | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 11 | Lookup and Get Metadata | None | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | S13 (secondary, conflicting) | chapter-level related practice |
| 12 | ForEach, Batch Count and Parallelism | Lab: Concurrency Budget | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Fault Tolerance | S5 (primary, conflicting) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 13 | If Condition, Switch, Until and Wait | None | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | S17 (secondary, conflicting)<br>S13 (secondary, conflicting) | chapter-level related practice |
| 14 | Execute Pipeline and Reusable Child Pipelines | None | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | None | chapter-level related practice |
| 15 | Web, Function, Script and Stored Procedure Integration | None | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | S15 (secondary) | chapter-level related practice |
| 16 | Schedule Triggers | Lab: Trigger Behaviour | None established (no item carries a topic ID) | Scenarios 4 | S4 (secondary) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 17 | Tumbling Window Triggers | Lab: Trigger Behaviour | None established (no item carries a topic ID) | Scenarios 4 | S4 (primary) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 18 | Event and Custom Event Triggers | Lab: Trigger Behaviour | None established (no item carries a topic ID) | Scenarios 4 | S4 (secondary, reworded) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 19 | Time Zones and Window Semantics | Lab: Trigger Behaviour | None established (no item carries a topic ID) | Scenarios 4 | None | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 20 | Integration Runtime Fundamentals | None | None established (no item carries a topic ID) | Scenarios 3 | S3 (secondary)<br>S10 (secondary) | chapter-level related practice |
| 21 | Self-hosted IR Architecture and Operations | None | None established (no item carries a topic ID) | Scenarios 3 | None | chapter-level related practice |
| 22 | Managed VNet and Managed Private Endpoints | None | None established (no item carries a topic ID) | Scenarios 3, 11 | S3 (primary, conflicting)<br>S14 (secondary, conflicting) | chapter-level related practice |
| 23 | On-premises Connectivity and Network Paths | None | None established (no item carries a topic ID) | Scenarios 3 | None | chapter-level related practice |
| 24 | Private Endpoint vs Managed Private Endpoint | None | None established (no item carries a topic ID) | Scenarios 3, 11 | None | chapter-level related practice |
| 25 | Copy Activity Fundamentals | Lab: Copy Performance | None established (no item carries a topic ID) | None | S6 (secondary) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 26 | Connectors, Formats and Capability Matrix | None | None established (no item carries a topic ID) | Lab via chapter: Copy Performance | S1 (secondary, conflicting) | chapter-level related practice |
| 27 | Schema Mapping and Type Conversion | Lab: Fault Tolerance | None established (no item carries a topic ID) | Scenarios 6<br>Lab via chapter: Copy Performance | S6 (primary, conflicting)<br>S18 (secondary, conflicting) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 28 | Fault Tolerance and Skipped Rows | Lab: Fault Tolerance | None established (no item carries a topic ID) | Scenarios 6, 18<br>Diagnostics `sensitive-data` | S18 (secondary, conflicting) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 29 | Data Consistency Verification | None | None established (no item carries a topic ID) | Scenarios 6, 17<br>Diagnostics `reconciliation`<br>Lab via chapter: Fault Tolerance | None | chapter-level related practice |
| 30 | Staged Copy, Resume and Large File Handling | None | None established (no item carries a topic ID) | Diagnostics `recovery`<br>Lab via chapter: Watermark & Transient Failure, Copy Performance, Fault Tolerance<br>Sandbox practice links to scenarios 1, 4 | None | chapter-level related practice |
| 31 | Full Load vs Incremental Load | None | None established (no item carries a topic ID) | Scenarios 1<br>Lab via chapter: Watermark & Transient Failure | None | chapter-level related practice |
| 32 | Watermark Patterns | Lab: Watermark & Transient Failure | None established (no item carries a topic ID) | Scenarios 1 | S1 (primary, reworded)<br>S14 (secondary, reworded) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 33 | Change Tracking and CDC | None | None established (no item carries a topic ID) | Scenarios 1, 7<br>Diagnostics `cdc`<br>Lab via chapter: Watermark & Transient Failure | S1 (secondary)<br>S7 (secondary) | chapter-level related practice |
| 34 | CDC Checkpoints and Rename Risk | None | None established (no item carries a topic ID) | Scenarios 7<br>Diagnostics `cdc` | S7 (primary) | chapter-level related practice |
| 35 | Metadata-Driven Pipelines | None | None established (no item carries a topic ID) | Scenarios 1, 13, 14<br>Diagnostics `migration-plan`<br>Lab via chapter: Watermark & Transient Failure | S7 (secondary)<br>S13 (primary) | chapter-level related practice |
| 36 | Mapping Data Flows | None | None established (no item carries a topic ID) | Scenarios 8 | S8 (secondary) | chapter-level related practice |
| 37 | Schema Drift and Data Flow Design | None | None established (no item carries a topic ID) | Scenarios 8 | S8 (primary) | chapter-level related practice |
| 38 | Reconciliation: Counts, Profiles and Row Fingerprints | None | None established (no item carries a topic ID) | Scenarios 17<br>Diagnostics `reconciliation` | S6 (secondary)<br>S17 (primary) | chapter-level related practice |
| 39 | Assert, Error Rows and Business Rules | None | None established (no item carries a topic ID) | Scenarios 8, 17<br>Diagnostics `reconciliation` | S8 (secondary)<br>S17 (secondary) | chapter-level related practice |
| 40 | Data Flow Performance Fundamentals | None | None established (no item carries a topic ID) | Scenarios 8<br>Diagnostics `fine-tuning`<br>Lab via chapter: Concurrency Budget, Copy Performance | None | chapter-level related practice |
| 41 | Managed Identity, Key Vault and Authentication | None | None established (no item carries a topic ID) | Scenarios 11, 18<br>Diagnostics `sensitive-data`<br>Lab via chapter: Fault Tolerance | S9 (secondary)<br>S11 (primary) | chapter-level related practice |
| 42 | CMK and Factory Encryption | None | None established (no item carries a topic ID) | Scenarios 11, 18<br>Diagnostics `sensitive-data`<br>Lab via chapter: Fault Tolerance | None | chapter-level related practice |
| 43 | Trusted Service: Legacy vs Modern | None | None established (no item carries a topic ID) | Scenarios 11, 18<br>Diagnostics `sensitive-data`<br>Lab via chapter: Fault Tolerance | None | chapter-level related practice |
| 44 | Monitoring, Alerts and Run History | Lab: Fault Tolerance | None established (no item carries a topic ID) | Scenarios 5, 9<br>Diagnostics `monitoring` | S5 (secondary)<br>S9 (primary) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 45 | Operational Logging and Sensitive Data | Lab: Fault Tolerance | None established (no item carries a topic ID) | Scenarios 11, 18<br>Diagnostics `sensitive-data` | S9 (secondary)<br>S18 (primary) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 46 | Git Integration and Collaboration | None | None established (no item carries a topic ID) | Scenarios 12<br>Diagnostics `cicd` | S11 (secondary)<br>S12 (primary) | chapter-level related practice |
| 47 | ARM Templates and Automated Publishing | None | None established (no item carries a topic ID) | Scenarios 12<br>Diagnostics `cicd` | S12 (secondary, reworded) | chapter-level related practice |
| 48 | Bicep and Infrastructure as Code | None | None established (no item carries a topic ID) | Scenarios 11, 12<br>Diagnostics `cicd` | None | chapter-level related practice |
| 49 | Deployment Parameters, Global Parameters and Trigger Handling | None | None established (no item carries a topic ID) | Scenarios 5, 9, 12<br>Diagnostics `cicd`, `monitoring`<br>Lab via chapter: Fault Tolerance | S12 (secondary, conflicting) | chapter-level related practice |
| 50 | Reliability, Idempotency and Recovery | Lab: Watermark & Transient Failure<br>Lab: Fault Tolerance | None established (no item carries a topic ID) | Scenarios 12<br>Diagnostics `cicd`, `recovery`<br>Sandbox practice links to scenarios 1, 4 | S5 (secondary, reworded) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 51 | Copy Performance: DIUs, Parallel Copies and Bottlenecks | Lab: Copy Performance | None established (no item carries a topic ID) | Scenarios 10<br>Diagnostics `cost`, `fine-tuning`<br>Lab via chapter: Concurrency Budget | None | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 52 | ADF Cost Model and FinOps | Lab: Copy Performance | None established (no item carries a topic ID) | Scenarios 10<br>Diagnostics `cost` | S10 (primary, reworded) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 53 | Scale and Concurrency Trade-offs | Lab: Concurrency Budget<br>Ch 17 practical deliverable (text says it satisfies the topic) | None established (no item carries a topic ID) | Scenarios 15<br>Diagnostics `fine-tuning`<br>Lab via chapter: Copy Performance, Fault Tolerance | S3 (secondary)<br>S10 (secondary) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 54 | Architecture Trade-offs: ADF vs Databricks vs Synapse | Ch 11 practical deliverable (text says it satisfies the topic) | None established (no item carries a topic ID) | Scenarios 8, 16<br>Diagnostics `fabric` | S15 (secondary, reworded) | direct topic-level practice — annex-mapped; not application-enforced at item level |
| 55 | ADF + Azure Databricks | None | None established (no item carries a topic ID) | Scenarios 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | S15 (primary, reworded) | chapter-level related practice |
| 56 | ADF + Azure Synapse | None | None established (no item carries a topic ID) | Scenarios 8, 15<br>Lab via chapter: Concurrency Budget, Fault Tolerance | None | chapter-level related practice |
| 57 | ADF vs Fabric Data Factory in 2026 | None | None established (no item carries a topic ID) | Scenarios 16<br>Diagnostics `fabric` | S16 (secondary, reworded) | chapter-level related practice |
| 58 | Enterprise Migration Architecture | None | None established (no item carries a topic ID) | Scenarios 13, 14, 17<br>Diagnostics `migration-plan`, `reconciliation`, `recovery`<br>Lab via chapter: Watermark & Transient Failure, Fault Tolerance<br>Sandbox practice links to scenarios 1, 4 | S14 (primary) | chapter-level related practice |
| 59 | ADF Interview Scenario Drills | None | None established (no item carries a topic ID) | Scenarios 5, 9<br>Diagnostics `monitoring`<br>Lab via chapter: Fault Tolerance | None | chapter-level related practice |
| 60 | ADF Architecture Review Capstone | Ch 21 capstone deliverables (text says it completes the topic) | None established (no item carries a topic ID) | None | None | direct topic-level practice — annex-mapped; not application-enforced at item level |

## 7. Conformance register

**Four questions, answered separately for every unit and never merged.**

1. **Required instructional level.** The minimum level the roadmap's intended outcomes imply, using the standard's definitions (section 13): a **Core instructional unit** primarily teaches understanding; a **Full instructional unit** claims independent application, configuration, building, operation, troubleshooting, diagnosis, optimization, significant trade-off evaluation or design, or contains a lab, practical exercise or graded practical assessment; a **Reference companion** is lookup material that teaches no complete outcome by itself.
2. **Current content level.** What the existing pack teaches and demonstrates today. "Some Full-level evidence" means *matching* evidence (the grades below) for at least one required Full-level outcome: today, a lab stage whose task is that outcome and which meets the four conditions below. Scenario checks (single-answer, three options, with an explanation) are recognition-level evidence and do not by themselves show that a learner can design or build.
3. **Evidence-screening result** (the rule formerly called "conformance status"). `Gap found`: a gap in practice or assessment evidence is visible from the sources without a review. `No gap found`: the screen found none, which is **not** a finding of conformance. **The rule:** a unit has an evidence gap if (a) at least one of its required Full-level outcomes lacks *matching* evidence (an outcome with only partial or recognition-level evidence, or none, counts as lacking), or (b) it is a Core unit with no understanding check. The screen tests these two evidence conditions only. It is a tool for deciding where to add practice and assessment. It is not the conformance test, and it is the author's reading of the sources, not a review finding.
4. **Overall conformance result.** Tested against the standard's mandatory requirements for the unit's class: the section 4 elements, sections 8 and 9 for practical work and assessment, the section 12 quality gate, and section 13. Three values. `Not conformant`: at least one mandatory requirement is **confirmed** missing, from the schema and the content, not from a heading scan. `Not verified`: no confirmed failure, and at least one requirement is unreviewed. `Conformant`: only after the independent review of that unit, which has not happened for any unit, so **no unit is marked Conformant**. A confirmed failure is a conformance gap even where the remediation is tracked separately (section 11); the remediation list never softens the status. The test is in 7.5.

**Evidence grades for a required Full-level outcome.** *Matching*: a lab stage or other practice that meets all four conditions of the maintainer's rule (U28): (1) it is on the learner's path, (2) its task is aligned with the outcome, or a clear instance of it, (3) its success criteria are observable, and (4) it gives appropriate feedback. A chapter link, a registry entry or a related scenario never counts by itself. Matching is the only grade that counts as Full-level evidence. *Partial or recognition-level only*: related scenario checks (single-answer, three options), a lab's recall question or ledger line, or practice on an adjacent aspect; not counted. *None*. Matching means practice exists. All the labs' Apply stages are fixed-choice tasks graded by a model in a simulation, so matching evidence does not show that a learner can do the task independently. The in-chapter exercises (T53, T54, T60) are self-directed and give no feedback, so they are practice and do not count as matching evidence.

**A required level never moves down because the pack lacks evidence.** The gap goes in the remediation field. The roadmap, not the current guide, sets the level.

**How the required level is read.** From the roadmap success criteria of the unit's depth topics. A criterion is Full-level if it asks the learner to design, build, diagnose, estimate, balance or define something, to decide with stated consequences, or to defend or choose "with trade-offs". It is Core-level if it asks the learner to explain, distinguish, classify, draw, know when, avoid, or select by stated criteria. Maintainer decision (U24): T15 is Full-level, because its criterion requires identifying the security, timeout and retry implications of a choice (a section 9 Compare). T57 stays Core, because its criterion does not explicitly require a justified choice using meaningful trade-offs. T13, T20 and T31 are unchanged, because there is no separate evidence to move them. The independent reviewer has not confirmed these decisions. A chapter that is the depth chapter for no topic takes its required level from its own outcome, and the outcomes of its secondary references stay with their depth chapters.

**Result.** 22 units (the 21 chapters, with Chapter 1 recorded as two units, 1a and 1b). Required level: 15 Full and 7 Core; no Reference companion at chapter level. **Overall conformance: Not conformant for all 22 units**, because prerequisites are confirmed missing from every one (7.5). That is separate from the evidence screen, whose results are in 7.0. Section 7.0 says exactly what each count means and which units are in each. These numbers are results of the rubric, not targets, and the reviewer may move any unit. Every unit's comprehension gate is **provisional: comprehension not yet validated**. The decisions in section 9 (U24 to U28) are the maintainer's, applied in this draft; the independent reviewer has not confirmed them.

### 7.0 What the counts mean

**Some of these counts overlap. Do not add them across categories.** The table gives each category, its definition and its exact members.

| Category | Units | Count |
|---|---|---:|
| **A.** Required Full, with matching evidence for at least one required Full-level outcome | 3, 7, 9, 13, 16, 17 | 6 |
| **B.** Required Full, with no matching evidence for any of its required Full-level outcomes | 1b, 6, 8, 11, 12, 14, 18, 19, 21 | 9 |
| **C.** At least one required Full-level outcome without matching evidence (partial, recognition-level only, or none) | 1b, 3, 6, 8, 9, 11, 12, 14, 17, 18, 19, 21 | 12 |
| **D.** Evidence screen: gap found (the rule: a unit is in C, or is a Core unit with no understanding check) | 1a, 1b, 3, 6, 8, 9, 11, 12, 14, 17, 18, 19, 21 | 13 |
| **E.** Evidence screen: no gap found (not in D; not a finding of conformance; some carry other known gaps) | 2, 4, 5, 7, 10, 13, 15, 16, 20 | 9 |
| **F.** Overall conformance: Not conformant (prerequisites confirmed missing, 7.5) | all units | 22 |
| **G.** Overall conformance: Not verified, or Conformant | none | 0 |
| **H.** Not independently reviewed (no review has happened for any unit) | all units | 22 |
| **I.** Comprehension gate provisional | all units | 22 |

- **Mutually exclusive pairs.** A and B split the 15 required-Full units (6 + 9 = 15). D and E split all 22 units (13 + 9 = 22). F and G split all 22 units (22 + 0).
- **Overlaps.** C cuts across A and B. In A and C: 3, 9, 17. In A and not C: 7, 13, 16. In B (all of B is in C): 1b, 6, 8, 11, 12, 14, 18, 19, 21. D is C plus 1a, the Core unit with no understanding check, by the rule above. In A and D: 3, 9, 17. In A and not D: 7, 13, 16. H and I contain every unit, and F is also every unit, so they overlap with everything. "No gap found" in E means the unit passes the screen. It does not mean the unit conforms, was reviewed, or is free of other gaps.
- **What "Full-level evidence" means here.** *Matching* evidence as defined above. It is evidence that practice exists for that outcome. It does not show the outcome is achieved, and it says nothing about the unit's other outcomes. A unit with evidence for some required outcomes does not conform to all of them. Of 23 required Full-level outcomes in the register: 7 have matching evidence (T10, T28, T32, T50, T51, T52, T53), 14 have partial or recognition-level evidence only (T2, T15, T35, T37, T38, T39, T41, T44, T45, T49, T54, T58, T59, T60), and 2 have none (T30, T40).
- **Alternative not chosen: Chapter 1 as one unit (U18).** The register keeps 1a and 1b (maintainer decision, U18). If it were one unit there would be 21 units: 15 required Full and 6 required Core. The evidence screen would find a gap in 12 (D) and none in 9 (E); A would be 6, B 9 and C 12. The overall conformance result is unchanged: Not conformant for every unit. The outcome grades do not change.
- **Matrix versus this test.** The evidence matrix in 6.4 records "direct topic-level practice" for any topic a lab registry entry or chapter text names, so T44, T45, T54 and T60 appear there. This test is stricter. It looks at what the lab stage does and at whether the practice gives feedback. T44 and T45 are named by the lab but are partial here, and T54 and T60 are named by chapter text but are partial because their exercises give no feedback. The two measures answer different questions and are not meant to agree.

**Verification of the partial-evidence treatment.** Each grade was checked against the lab definitions (`faultTolerance.ts`, `watermark.ts`, `concurrency.ts`, `copyPerf.ts`) and the scenario content. The same rule is applied to every outcome: a related scenario or recall item is never matching, however closely it is related.

| Required Full-level outcome | Unit | Roadmap success criterion | Grade | Basis (verified against the lab definitions and scenario content) |
|---|---|---|---|---|
| T2 ADF vs Databricks vs Synapse vs Fabric Data Factory | 1b | Choose the right service for orchestration, transformation, lakehouse processing and integrated analytics, with explicit trade-offs. | Partial or recognition-level only | Nothing in Chapter 1 practises or assesses T2. Scenario 16 ("ADF or Fabric?", Chapter 20, which also lists T2) has four single-answer checks on ADF versus Fabric (billing, when ADF remains the better fit, preserving existing ADF investment, Microsoft's stated direction): related recognition. |
| T10 Dependencies: Success, Failure, Completion and Skip | 3 | Design a failure notification and cleanup flow without accidentally masking failures. | Matching | Fault Tolerance lab, dependency mode: Predict, Manipulate and Apply. The learner picks the error-handling wiring so the failure shows as a failed run and the on-failure step still runs; graded by the model. Four fixed options; simulation. |
| T15 Web, Function, Script and Stored Procedure Integration | 3 | Choose the right integration mechanism and identify security, timeout and retry implications. | Partial or recognition-level only | Chapter 3's "Practical Exercise: Architectural Defense" is an explain-why task (Web or Webhook against a Script activity: decoupling, managed-identity authentication, no database ports) whose answer is printed with it. No lab or scenario targets T15; scenario 15 concerns a Databricks notebook. |
| T28 Fault Tolerance and Skipped Rows | 7 | Decide when to fail a load versus quarantine bad records and who owns the resulting data-quality workflow. | Matching | Fault Tolerance lab, bad-rows mode: Apply picks fail, skip, or skip with a protected session log under audit requirements; graded by the model. Covers the decision; the ownership workflow is not practised. |
| T30 Staged Copy, Resume and Large File Handling | 6 | Design recovery around what ADF actually resumes instead of assuming all copies checkpoint. | None | No item concerns what a copy can resume. The labs name T25, T50 and others, not T30; the sandbox practice links are about watermarks and triggers. |
| T32 Watermark Patterns | 9 | Design a watermark safely and explain failure cases such as late updates and clock problems. | Matching | Watermark lab: Apply picks a retry and sink change so every row lands exactly once when the watermark placement cannot change; the Explain stage asks for the learner's own words. Fixed options; simulation. |
| T35 Metadata-Driven Pipelines | 9 | Design one pipeline serving many tables without turning the metadata layer into an ungoverned framework. | Partial or recognition-level only | A worked design walk-through in Chapter 9 (no exercise). Scenario 13 (Chapter 19, which also lists T35) has single-answer checks on a control table that outgrows the Lookup limit: related recognition. |
| T37 Schema Drift and Data Flow Design | 11 | Make schema evolution a deliberate design decision rather than an accidental behavior. | Partial or recognition-level only | Scenario 8: four single-answer checks (checked against an answer key) plus case-study notes the learner commits, which the Evidence service records as not assessed (the debrief compares them with an expert view and is not graded). No exercise or lab. |
| T38 Reconciliation: Counts, Profiles and Row Fingerprints | 8 | Design reconciliation that can detect offsetting errors, not just matched totals. | Partial or recognition-level only | Scenario 17 (four single-answer checks) and diagnostic `reconciliation` (free response, grading not established). No design exercise. |
| T39 Assert, Error Rows and Business Rules | 8 | Turn business rules into explicit acceptance criteria and failure paths. | Partial or recognition-level only | Scenario 17's last check asks what mechanism to put in place before decommissioning a source; it does not ask the learner to turn business rules into criteria. |
| T40 Data Flow Performance Fundamentals | 17 | Diagnose the actual bottleneck before changing cluster size or partition settings. | None | No item concerns data flow performance. The labs and scenarios concern copy performance and concurrency. |
| T41 Managed Identity, Key Vault and Authentication | 14 | Design credential handling without hard-coding secrets and explain authentication trade-offs. | Partial or recognition-level only | Scenario 11: four single-answer checks on managed identity, Key Vault and RBAC. No design exercise. |
| T44 Monitoring, Alerts and Run History | 12 | Define what operations should monitor beyond a green pipeline status. | Partial or recognition-level only | Fault Tolerance lab, dependency mode: Apply has the learner make a failure show as a failed run so a failed-run alert fires. That is adjacent: no stage has the learner define what operations should monitor. Scenarios 5 and 9 are recognition checks. |
| T45 Operational Logging and Sensitive Data | 14 | Design logging that supports operations without unnecessarily exposing sensitive data. | Partial or recognition-level only | The Fault Tolerance lab registry names T45, but its related content is one coupling-ledger line and one recall question (`faultTolerance.ts`). Scenarios 11 and 18 are recognition checks. |
| T49 Deployment Parameters, Global Parameters and Trigger Handling | 18 | Build a release checklist that separates product changes from environment configuration. | Partial or recognition-level only | Scenario 12: four single-answer checks on hotfixes, trigger handling and a package name. No exercise on building a release checklist. |
| T50 Reliability, Idempotency and Recovery | 13 | Design reruns that are safe and explain reliability as a shared responsibility. | Matching | Watermark lab (retry and upsert choices that make a rerun safe) and Fault Tolerance lab (retries), both graded by the model; two sandbox practice links in Chapter 13. The shared-responsibility reasoning is not assessed. |
| T51 Copy Performance: DIUs, Parallel Copies and Bottlenecks | 17 | Diagnose the slowest stage before scaling compute and articulate the cost/speed trade-off. | Matching | Copy Performance lab: Predict and Reason on why doubling the DIUs did what it did, and Apply to size the copy; graded by the model. |
| T52 ADF Cost Model and FinOps | 16 | Estimate cost from workload behavior and identify levers that reduce spend without breaking SLA. | Matching | Copy Performance lab: Apply picks DIUs and parallel copies to meet a deadline with as few DIU-hours as possible; graded by the model. A relative cost estimate in DIU-hours; no price, no money. |
| T53 Scale and Concurrency Trade-offs | 17 | Balance throughput, recovery, fairness and source-system safety. | Matching | Concurrency Budget lab: Apply picks batch count and parallel copies within a source's connection limit; graded by the model. Chapter 17 also specifies a multi-source concurrency-budget deliverable (ungraded). |
| T54 Architecture Trade-offs: ADF vs Databricks vs Synapse | 11 | Defend architecture choices with performance, cost, operational and team-skill trade-offs. | Partial or recognition-level only | Chapter 11 specifies a five-slide architecture-choice presentation and says it satisfies T54. The task is aligned and has a defined structure, but there is no rubric, model answer or feedback (confirmed: none of those words appears in the block), so under the four conditions it is practice, not matching evidence. |
| T58 Enterprise Migration Architecture | 19 | Design a migration plan that an EM/Program Manager can challenge on risk, ownership, throughput and recovery. | Partial or recognition-level only | Scenarios 13 and 14 (eight single-answer checks) and diagnostic `migration-plan`. No design exercise. |
| T59 ADF Interview Scenario Drills | 21 | Answer with facts, trade-offs, assumptions, operational consequences and measurable acceptance criteria. | Partial or recognition-level only | The 10 diagnostic questions are free-response interview drills (grading not established), and scenarios 5 and 9 are in Chapter 12, which also lists T59. None is linked to Chapter 21. |
| T60 ADF Architecture Review Capstone | 21 | Defend architecture, security, networking, recovery, cost and delivery decisions under interview pressure. | Partial or recognition-level only | Chapter 21 specifies a capstone with three deliverables and says it completes T60. The task is aligned, but there is no feedback (confirmed: no rubric, model answer or feedback in the block), and the specification of Deliverable 2 states the hardened values. Practice, not matching evidence. |

**Full-level evidence, unit by unit.** The Full-level topic IDs are the depth topics whose roadmap success criterion is Full-level (the rubric above). "Other topics with practical evidence" are depth topics whose own criterion is Core-level but which a lab names. Chapter 3 keeps its finding: matching Full-level evidence only for T10, and practical evidence for T12 (whose own criterion is Core-level).

| Unit | Required level | Required Full-level outcomes (depth topics) | Matching evidence for | Partial or recognition-level only | No evidence | Other topics with practical evidence (their own criteria are Core-level) | Some matching evidence | Evidence screen | Overall conformance | Comprehension gate |
|---|---|---|---|---|---|---|---|---|---|---|
| 1a | Core | none | n/a | n/a | n/a | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 1b | Full | T2 | none | T2 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 2 | Core | none | n/a | n/a | n/a | none | no | No gap found | Not conformant (prerequisites missing) | provisional |
| 3 | Full | T10, T15 | T10 | T15 | none | T12 | yes | Gap found | Not conformant (prerequisites missing) | provisional |
| 4 | Core | none | n/a | n/a | n/a | none | no | No gap found | Not conformant (prerequisites missing) | provisional |
| 5 | Core | none | n/a | n/a | n/a | T16, T17, T18, T19 | no | No gap found | Not conformant (prerequisites missing) | provisional |
| 6 | Full | T30 | none | none | T30 | T25 | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 7 | Full | T28 | T28 | none | none | T27 | yes | No gap found | Not conformant (prerequisites missing) | provisional |
| 8 | Full | T38, T39 | none | T38, T39 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 9 | Full | T32, T35 | T32 | T35 | none | none | yes | Gap found | Not conformant (prerequisites missing) | provisional |
| 10 | Core | none | n/a | n/a | n/a | none | no | No gap found | Not conformant (prerequisites missing) | provisional |
| 11 | Full | T37, T54 | none | T37, T54 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 12 | Full | T44 | none | T44 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 13 | Full | T50 | T50 | none | none | none | yes | No gap found | Not conformant (prerequisites missing) | provisional |
| 14 | Full | T41, T45 | none | T41, T45 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 15 | Core | none | n/a | n/a | n/a | none | no | No gap found | Not conformant (prerequisites missing) | provisional |
| 16 | Full | T52 | T52 | none | none | none | yes | No gap found | Not conformant (prerequisites missing) | provisional |
| 17 | Full | T40, T51, T53 | T51, T53 | none | T40 | none | yes | Gap found | Not conformant (prerequisites missing) | provisional |
| 18 | Full | T49 | none | T49 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 19 | Full | T58 | none | T58 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |
| 20 | Core | none | n/a | n/a | n/a | none | no | No gap found | Not conformant (prerequisites missing) | provisional |
| 21 | Full | T59, T60 | none | T59, T60 | none | none | no | Gap found | Not conformant (prerequisites missing) | provisional |

| Ch / unit | Title | Required instructional level | Current content level | Evidence screen | Overall conformance | Comprehension gate |
|---|---|---|---|---|---|---|
| 1a | What ADF is, and what it isn't: orientation (everything before the selection section) | Core | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 1b | What ADF is, and what it isn't: service selection (the final section, "ADF vs Databricks vs Synapse vs Fabric: architecture selection framework") | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 2 | The building blocks | Core | Core-level | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 3 | Pipelines, activities and control flow | Full | Mixed | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 4 | Integration runtimes: where the work runs | Core | Core-level | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 5 | Triggers: when pipelines run | Core | Core-level | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 6 | The Copy activity | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 7 | Bad rows, cut-off values and "verified" copies | Full | Some Full-level evidence | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 8 | Proving the migration is complete | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 9 | Loading only new data | Full | Some Full-level evidence | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 10 | Change data capture | Core | Core-level | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 11 | Transforming data: data flows, schema drift and Delta | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 12 | Monitoring, failures and reruns | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 13 | Recovering from failures | Full | Some Full-level evidence | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 14 | Security and networking | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 15 | Sensitive data in regulated industries | Core | Core-level | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 16 | Performance and cost | Full | Some Full-level evidence | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 17 | Fine-tuning copies and data flows | Full | Some Full-level evidence | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 18 | From Dev to Prod | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 19 | Migrating with ADF | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 20 | ADF and Fabric Data Factory | Core | Core-level | No gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |
| 21 | Pitfalls: every trap in one place | Full | Core-level | Gap found | Not conformant (prerequisites missing) | Provisional: comprehension not yet validated |

### 7.1 Chapter records

### Ch 1: `what-it-is` — What ADF is, and what it isn't

| Field | Record |
|---|---|
| 1. Chapter ID and title | `what-it-is`, "What ADF is, and what it isn't (recorded as two units, 1a and 1b, below)" |
| 2. Required instructional level, from the roadmap outcomes | **1a**: **Core.** T1 and T4 ask the learner to explain (what ADF does and why it is not the compute engine; a design in manager language).<br>**1b**: **Full.** T2: "choose the right service ... with explicit trade-offs" requires a reasoned architecture selection, which section 13 puts at Full.<br>Intended outcomes (roadmap success criteria of the depth topics): T1: Explain what ADF does, where it fits in an Azure data platform, and why it is not the primary compute engine for heavy transformation.<br>T2: Choose the right service for orchestration, transformation, lakehouse processing and integrated analytics, with explicit trade-offs.<br>T4: Explain an ADF design to PO/PM/EM stakeholders without pretending to be an ADF developer. |
| 3. Current content level (what the pack teaches and demonstrates today) | **1a**: Core-level: explanation, the documentation's own example, the four stages and the journey of one row, with a Microsoft lifecycle diagram. No understanding check is linked.<br>**1b**: Core-level: an exposition (the crosswalk describes a decision matrix and three enterprise examples in it; the chapter has no table block, so the form was not checked here). Nothing in Chapter 1 practises or assesses T2; scenario 16 ("ADF or Fabric?", in Chapter 20, which also lists T2) is chapter-level related recognition. |
| 4. Evidence available | 1212 words of prose; 0 table(s); 1 image block(s); 0 code block(s)<br>Contains Microsoft's lifecycle diagram (third-party, per the audit) and a section "How to read the labels in this guide". No exercise, lab, scenario or diagnostic is linked to this chapter. Recommended split (not applied): one cut, before the final section; "Where it is heading" is left to the rework. |
| 5. Evidence screen and overall conformance | **1a**: Evidence screen: gap found (no understanding check linked to the unit)<br>**1b**: Evidence screen: gap found (no matching practical or assessment evidence for T2)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | **1a**: Add an explain-back understanding check with feedback (orchestration versus movement versus transformation; why ADF is not the compute engine). Add a labelled objective and summary when the unit is reworked.<br>**1b**: Add a scenario or exercise that supplies workload facts and requires a service choice with stated trade-offs, with feedback that explains the reasoning (standard sections 8 and 9). Until then the T2 outcome is required but not evidenced. |

### Ch 2: `building-blocks` — The building blocks

| Field | Record |
|---|---|
| 1. Chapter ID and title | `building-blocks`, "The building blocks" |
| 2. Required instructional level, from the roadmap outcomes | **Core.** Every depth-topic criterion is explanatory (draw the object model, explain how credentials, parameters and scope are separated).<br>Intended outcomes (roadmap success criteria of the depth topics): T3: Draw the object model without mixing connection metadata, data metadata and execution state.<br>T5: Explain how credentials and connectivity are separated from pipeline logic.<br>T6: Explain pipeline → dataset parameter flow and avoid hard-coded source/sink definitions.<br>T8: Explain when a value belongs at pipeline, dataset, linked-service or factory scope. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: explanation, JSON examples and a relationship diagram, with a scenario-based recognition check. |
| 4. Evidence available | 1229 words of prose; 1 table(s); 1 image block(s); 2 code block(s)<br>Scenarios (ID, no.): 2 (2), each a case study with a four-question single-answer check and feedback<br>Two code blocks (JSON examples), one table, one relationship diagram (Microsoft, per the audit). Scenario 2's four checks cover linked service, what moves data, the default retry behaviour and the pattern for 40 tables; they do not test scope (T8) or the object model (T3). |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add checks for scope (T8) and the object model (T3). Confirm the JSON examples against Microsoft's pages (not done here). |

### Ch 3: `pipelines` — Pipelines, activities and control flow

| Field | Record |
|---|---|
| 1. Chapter ID and title | `pipelines`, "Pipelines, activities and control flow" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T10: "design a failure notification and cleanup flow without accidentally masking failures" and T15: "choose the right integration mechanism and identify security, timeout and retry implications" are Full-level (maintainer decision, U24). The chapter's other depth topics are Core-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T7: Correctly choose between parameter, variable and expression and explain parallel-loop variable risk.<br>T9: Classify an activity correctly and explain what executes in ADF versus a downstream compute service.<br>T10: Design a failure notification and cleanup flow without accidentally masking failures.<br>T11: Know when Lookup is appropriate and when its output constraints require a different pattern.<br>T12: Explain why parallel loops can create race conditions and source/sink pressure.<br>T13: Choose the correct control construct instead of overusing nested pipelines.<br>T14: Explain how child pipelines reduce duplication while keeping ownership and observability clear.<br>T15: Choose the right integration mechanism and identify security, timeout and retry implications.<br>T55: Explain where ADF stops and Databricks starts in a production data platform.<br>T56: Explain when Synapse-native capabilities change the ADF architecture. |
| 3. Current content level (what the pack teaches and demonstrates today) | Mixed. Matching Full-level evidence exists for T10 only (the Fault Tolerance lab, whose dependency-failure mode models the exit-path patterns), and practical evidence for T12 (Concurrency Budget, whose own criterion is Core-level). T15 has partial evidence only: the labelled "Practical Exercise" is one explain-why task, on the T15 subject, whose answer is printed with it. The other depth topics are Core-level (explanation, tables) with no topic-level check. |
| 4. Evidence available | 2290 words of prose; 1 table(s); 1 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 15 (17), each a case study with a four-question single-answer check and feedback<br>Lab (simulation): Concurrency Budget, whose registry entry names depth topic(s) T12<br>Lab (simulation): Fault Tolerance, whose registry entry names depth topic(s) T10<br>Fourteen content blocks including external-service integration and Synapse and Databricks architecture sections. Scenario 15 (Databricks notebook return value) is linked at chapter level and relates to T55 only. |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found; known gaps (no topic-level practice for T7, T9, T11, T13, T14, T15, T55, T56; the exercise gives its own answer)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Consider a content split later (F9; U18 keeps Chapter 3 whole in the register). Add checks or exercises for the Core-level topics, and a real exercise with feedback for T15 and the choice outcomes (T7, T13). Verify the lab's per-topic depth. |

### Ch 4: `integration-runtimes` — Integration runtimes: where the work runs

| Field | Record |
|---|---|
| 1. Chapter ID and title | `integration-runtimes`, "Integration runtimes: where the work runs" |
| 2. Required instructional level, from the roadmap outcomes | **Core.** Criteria are explain, distinguish or select by stated criteria (T20 selects a runtime against connectivity, execution type and ownership).<br>Intended outcomes (roadmap success criteria of the depth topics): T20: Select the appropriate runtime based on connectivity, execution type and operational ownership.<br>T21: Explain why SHIR is production infrastructure and what the support model must contain.<br>T22: Distinguish Managed VNet, managed private endpoint and a private endpoint for the Data Factory service.<br>T23: Explain the network path instead of saying 'SHIR removes networking'.<br>T24: Avoid conflating authoring/control traffic with data-plane connectivity. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: explanation, the three IR families table, a network diagram, and a scenario-based recognition check. |
| 4. Evidence available | 1334 words of prose; 2 table(s); 1 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 3 (3), each a case study with a four-question single-answer check and feedback<br>Two tables and one network diagram (Microsoft, per the audit). Scenario 3's checks cover when a SHIR is needed, the firewall rule, high availability and where a copy runs; the support-model outcome (T21) and the private-networking distinctions (T22, T24) are not tested here. The scenario crosswalk gives scenario 3 the wrong topic number (appendix B). |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add checks for T21 (support model) and T22/T24 (private-networking terms). Correct the crosswalk reference (F1). |

### Ch 5: `triggers` — Triggers: when pipelines run

| Field | Record |
|---|---|
| 1. Chapter ID and title | `triggers`, "Triggers: when pipelines run" |
| 2. Required instructional level, from the roadmap outcomes | **Core.** Criteria are explain or select by stated criteria (why a schedule trigger does not model completeness, when tumbling windows or events fit, how time zones affect partitions).<br>Intended outcomes (roadmap success criteria of the depth topics): T16: Explain why a schedule trigger does not inherently model data completeness for a time window.<br>T17: Choose tumbling windows when the processing unit is a time window and missed windows matter.<br>T18: Select event triggering when data arrival, not wall-clock time, is the true trigger condition.<br>T19: Explain how time-zone choices affect schedules, partitions and reconciliation. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level, with a practical simulation beside it: the Trigger Behaviour lab (a separate Full unit) names T16 to T19. |
| 4. Evidence available | 1027 words of prose; 1 table(s); 0 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 4 (4), each a case study with a four-question single-answer check and feedback<br>Lab (simulation): Trigger Behaviour, whose registry entry names depth topic(s) T16, T17, T18, T19<br>One table. Scenario 4 (four checks). The Trigger Behaviour lab names T16 to T19. |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Verify the lab's per-topic depth. No chapter change is required by the roadmap outcomes. |

### Ch 6: `copy` — The Copy activity

| Field | Record |
|---|---|
| 1. Chapter ID and title | `copy`, "The Copy activity" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T30: "design recovery around what ADF actually resumes" is Full-level. T25 and T26 are explanatory and reference-style.<br>Intended outcomes (roadmap success criteria of the depth topics): T25: Explain where Copy runs and what it does itself versus what downstream engines do.<br>T26: Avoid memorising stale source-only/sink-only lists; verify capability when designing.<br>T30: Design recovery around what ADF actually resumes instead of assuming all copies checkpoint. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: explanation, a staged-copy diagram, a "When a failed copy can resume" section and a "Connectors" section. The Copy Performance lab names T25 only. No scenario is linked. Nothing practises T30. |
| 4. Evidence available | 995 words of prose; 0 table(s); 2 image block(s); 0 code block(s)<br>Lab (simulation): Copy Performance, whose registry entry names depth topic(s) T25<br>Two diagrams (copy engine, staged copy; Microsoft, per the audit). The "Connectors" section is a candidate Reference companion and should point to Microsoft's live connector overview rather than state counts. |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (no practice or assessment evidence for T30; no understanding check linked apart from the lab)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add a recovery-decision exercise or scenario with feedback for T30, and an understanding check on what Copy does itself (T25). Staged-copy configuration is bound by CLAUDE.md ADF governance item 13. |

### Ch 7: `bad-rows` — Bad rows, cut-off values and "verified" copies

| Field | Record |
|---|---|
| 1. Chapter ID and title | `bad-rows`, "Bad rows, cut-off values and "verified" copies" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T28: "decide when to fail a load versus quarantine bad records and who owns the workflow" is Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T27: Identify precision-loss and schema-mismatch risks before production.<br>T28: Decide when to fail a load versus quarantine bad records and who owns the resulting data-quality workflow.<br>T29: Explain why 'verified' does not equal business-level correctness. |
| 3. Current content level (what the pack teaches and demonstrates today) | Some Full-level evidence: the Fault Tolerance lab names T27 and T28 and its bad-rows mode models skipping and logging; scenario 6 is a case study with a four-question check. T29 is Core-level with no practice. |
| 4. Evidence available | 798 words of prose; 0 table(s); 0 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 6 (6), each a case study with a four-question single-answer check and feedback<br>Lab (simulation): Fault Tolerance, whose registry entry names depth topic(s) T27, T28<br>Scenario 6 (four checks). Fault Tolerance lab (bad-rows mode). |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found; known gaps (T29 not practised; the ownership and quarantine workflow is decided but not exercised)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add practice for T29 and for the quarantine ownership workflow. Verify the lab's per-topic depth. |

### Ch 8: `reconciliation` — Proving the migration is complete

| Field | Record |
|---|---|
| 1. Chapter ID and title | `reconciliation`, "Proving the migration is complete" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T38: "design reconciliation that can detect offsetting errors" and T39: "turn business rules into explicit acceptance criteria" are Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T38: Design reconciliation that can detect offsetting errors, not just matched totals.<br>T39: Turn business rules into explicit acceptance criteria and failure paths. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: the five-level model and the "why totals aren't enough" explanation, with scenario-based recognition (one check recalls the third level). No exercise, lab or design assessment. |
| 4. Evidence available | 663 words of prose; 1 table(s); 0 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 17 (9), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `reconciliation` (grading not established)<br>One table (the five levels). Scenario 17 (four checks). Diagnostic `reconciliation` (a free-response prompt; grading not established). |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T38 and T39 have recognition-level evidence only)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add a design exercise with feedback: given a migration, produce a reconciliation plan that would catch offsetting errors, and a business-rule acceptance exercise for T39. Settle how the diagnostic is graded (F8). |

### Ch 9: `incremental` — Loading only new data

| Field | Record |
|---|---|
| 1. Chapter ID and title | `incremental`, "Loading only new data" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T32: "design a watermark safely and explain failure cases" and T35: "design one pipeline serving many tables" are Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T31: Choose a loading strategy based on source capabilities, volume and recovery needs.<br>T32: Design a watermark safely and explain failure cases such as late updates and clock problems.<br>T33: Explain when a watermark is insufficient because updates/deletes must be observed.<br>T35: Design one pipeline serving many tables without turning the metadata layer into an ungoverned framework. |
| 3. Current content level (what the pack teaches and demonstrates today) | Some Full-level evidence for T32: the Watermark & Transient Failure lab, plus scenario 1. T35 is a worked design walk-through (an exposition) with no exercise; scenario 13 (in Chapter 19, which also lists T35) is related recognition only. T31 and T33 are Core-level. |
| 4. Evidence available | 986 words of prose; 1 table(s); 1 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 1 (1), each a case study with a four-question single-answer check and feedback<br>Lab (simulation): Watermark & Transient Failure, whose registry entry names depth topic(s) T32<br>Scenario 1 (four checks). Watermark & Transient Failure lab. A watermark workflow diagram (Microsoft, per the audit) and the section "Designing an end-to-end metadata-driven pipeline". |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T35 has recognition-level evidence only)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add an exercise for T35 with feedback. Verify the lab's per-topic depth. |

### Ch 10: `cdc` — Change data capture

| Field | Record |
|---|---|
| 1. Chapter ID and title | `cdc`, "Change data capture" |
| 2. Required instructional level, from the roadmap outcomes | **Core.** T34: "explain the current uncertainty accurately instead of giving a universal rename rule" is explanatory. Microsoft's pages disagree on the checkpoint key (notes section 30.3).<br>Intended outcomes (roadmap success criteria of the depth topics): T34: Explain the current uncertainty accurately instead of giving a universal rename rule. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: explanation of the checkpoint and the rename trap, with a scenario-based recognition check (two of four checks are recall). |
| 4. Evidence available | 1419 words of prose; 1 table(s); 0 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 7 (7), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `cdc` (grading not established)<br>One table. Scenario 7 (four checks). Diagnostic `cdc` (grading not established). |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Check that the scenario's answers stay consistent with the unresolved Microsoft discrepancy (not done here). |

### Ch 11: `transform` — Transforming data: data flows, schema drift and Delta

| Field | Record |
|---|---|
| 1. Chapter ID and title | `transform`, "Transforming data: data flows, schema drift and Delta" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T54: "defend architecture choices with performance, cost, operational and team-skill trade-offs" and T37: "make schema evolution a deliberate design decision" are Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T36: Know when Mapping Data Flow is appropriate versus Databricks or SQL.<br>T37: Make schema evolution a deliberate design decision rather than an accidental behavior.<br>T54: Defend architecture choices with performance, cost, operational and team-skill trade-offs. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level with a specified exercise: an in-chapter practical deliverable for T54 (a five-slide architecture-choice presentation) has a defined structure but no rubric, model answer or feedback, so it is practice and not matching evidence (U28); scenario 8 gives recognition-level evidence for T37. T36 is Core-level with no check. No lab. |
| 4. Evidence available | 1237 words of prose; 0 table(s); 0 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 8 (8), each a case study with a four-question single-answer check and feedback<br>In-chapter practical deliverable for T54, whose text says it satisfies the topic. Scenario 8 (four checks). |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T37 has recognition-level evidence only; the T54 deliverable has no rubric or model answer; T36 has no check)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add success criteria and feedback to the deliverable, and a check for T36. |

### Ch 12: `monitoring` — Monitoring, failures and reruns

| Field | Record |
|---|---|
| 1. Chapter ID and title | `monitoring`, "Monitoring, failures and reruns" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T44: "define what operations should monitor beyond a green pipeline status" is Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T44: Define what operations should monitor beyond a green pipeline status. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level with adjacent practice: the Fault Tolerance lab (dependency mode) names T44 and has the learner make a failure show as a failed run so a failed-run alert fires, but no stage has the learner define what to monitor; scenarios 5 and 9 are case studies with recognition checks. |
| 4. Evidence available | 654 words of prose; 1 table(s); 0 image block(s); 2 code block(s)<br>Scenarios (ID, no.): 5 (5), 9 (10), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `monitoring` (grading not established)<br>Lab (simulation): Fault Tolerance, whose registry entry names depth topic(s) T44<br>Scenarios 5 and 9 (eight checks, several recall). Fault Tolerance lab. Diagnostic `monitoring` (grading not established). Two code blocks. |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T44 has partial evidence only: adjacent lab practice and recognition checks; the learner is never asked to define what to monitor; scenario 9 recalls time-sensitive retention and table-name facts)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add an exercise that has the learner define what to monitor. Re-verify the time-sensitive facts (F12). |

### Ch 13: `recovery` — Recovering from failures

| Field | Record |
|---|---|
| 1. Chapter ID and title | `recovery`, "Recovering from failures" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T50: "design reruns that are safe and explain reliability as a shared responsibility" is Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T50: Design reruns that are safe and explain reliability as a shared responsibility. |
| 3. Current content level (what the pack teaches and demonstrates today) | Some Full-level evidence: the Watermark and Fault Tolerance labs name T50, and the chapter links two sandbox scenarios. The shared-responsibility reasoning is not assessed. |
| 4. Evidence available | 854 words of prose; 2 table(s); 0 image block(s); 0 code block(s)<br>Diagnostic free-response: `recovery` (grading not established)<br>Lab (simulation): Watermark & Transient Failure, whose registry entry names depth topic(s) T50<br>Lab (simulation): Fault Tolerance, whose registry entry names depth topic(s) T50<br>Sandbox practice links to pack scenarios 1, 4<br>Two sandbox practice links (pack scenarios 1 and 4, whose own chapters are `incremental` and `triggers`). Diagnostic `recovery`. Two tables. |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found; known gap (shared-responsibility reasoning not assessed)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add an assessment for the shared-responsibility outcome. Verify the labs' per-topic depth. |

### Ch 14: `security` — Security and networking

| Field | Record |
|---|---|
| 1. Chapter ID and title | `security`, "Security and networking" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T41: "design credential handling without hard-coding secrets" and T45: "design logging that supports operations without exposing sensitive data" are Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T41: Design credential handling without hard-coding secrets and explain authentication trade-offs.<br>T42: Explain when encryption choices must be made early in the factory lifecycle.<br>T43: Explain the current recommended direction and avoid assuming firewall bypass is timeless.<br>T45: Design logging that supports operations without unnecessarily exposing sensitive data. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: the four-network-terms table, Legacy versus Modern trusted-service guidance, a CMK diagram and a scenario-based recognition check (one check recalls an RBAC role name). The Fault Tolerance lab touches T45 with one coupling-ledger line and one recall question, not a design exercise. |
| 4. Evidence available | 1177 words of prose; 1 table(s); 2 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 11 (12), each a case study with a four-question single-answer check and feedback<br>One table and a CMK diagram (Microsoft, per the audit). Scenario 11 (four checks). |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T41 and T45 have partial or recognition-level evidence only)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add design exercises with feedback for T41 and T45. Re-verify the Legacy versus Modern guidance and the RBAC role (F12). |

### Ch 15: `sensitive-data` — Sensitive data in regulated industries

| Field | Record |
|---|---|
| 1. Chapter ID and title | `sensitive-data`, "Sensitive data in regulated industries" |
| 2. Required instructional level, from the roadmap outcomes | **Core.** Not the primary/depth chapter for any roadmap topic; related coverage and secondary references remain documented (the pack's alignment block lists T28, T41, T42, T43 and T45 here, but their depth chapters are 7 and 14, which own their Full-level outcomes). Its own outcome is understanding and recognizing where sensitive values may be exposed.<br>Intended outcomes (roadmap success criteria of the depth topics): None as depth topic (see basis). Secondary references: T28, T41, T42, T43, T45 |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level, and the source content supports that: it names five places sensitive values leak (the skipped-rows session log holds actual values, activity outputs, debug previews, the masking template calling an external service, a key decision made too late), the controls Microsoft documents, what Purview adds, and what the compliance list does and does not state. It does not teach or assess configuring or designing anything. |
| 4. Evidence available | 860 words of prose; 1 table(s); 1 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 18 (13), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `sensitive-data` (grading not established)<br>Lab (simulation): Fault Tolerance, linked through this chapter only<br>Scenario 18's checks cover the function of Secure Input and Secure Output, what the session log contains, the PCI-DSS consequence, and whether Secure Input hides rejected-row values. The Fault Tolerance lab (bad-rows mode) has one ledger line on the session log's values and one Retrieve question sourced to this chapter (recall). One table and one SHIR channels diagram (Microsoft, per the audit). |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found; known gap (the Full-level outcomes it supports, T41 and T45, are not evidenced in Chapter 14 either)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Keep it as a separate Core unit (U25) and add a cross-link to Chapter 14 (F16); today it refers only to chapter 8. If a design outcome is wanted here, add a design exercise with feedback. Re-verify the compliance and key-lifecycle statements (F12). |

### Ch 16: `performance-cost` — Performance and cost

| Field | Record |
|---|---|
| 1. Chapter ID and title | `performance-cost`, "Performance and cost" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T52: "estimate cost from workload behaviour and identify levers that reduce spend without breaking SLA" is Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T52: Estimate cost from workload behavior and identify levers that reduce spend without breaking SLA. |
| 3. Current content level (what the pack teaches and demonstrates today) | Some Full-level evidence: the Copy Performance lab names T52 and counts cost in DIU-hours with no price assumed; scenario 10 is a case study. The estimate is relative, not money. |
| 4. Evidence available | 473 words of prose; 2 table(s); 1 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 10 (11), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `cost` (grading not established)<br>Lab (simulation): Copy Performance, whose registry entry names depth topic(s) T52<br>Scenario 10 (four checks). Copy Performance lab. A scalability diagram (Microsoft, per the audit) and two tables. Shortest chapter in the pack (473 words). |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found; known gap (no exercise estimates money or builds a cost-driver model)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add a cost-driver modelling exercise with feedback. Prices come from the Azure pricing page and must be re-verified (F12). |

### Ch 17: `fine-tuning` — Fine-tuning copies and data flows

| Field | Record |
|---|---|
| 1. Chapter ID and title | `fine-tuning`, "Fine-tuning copies and data flows" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T40 and T51: "diagnose the slowest stage before scaling" and T53: "balance throughput, recovery, fairness and source safety" are Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T40: Diagnose the actual bottleneck before changing cluster size or partition settings.<br>T51: Diagnose the slowest stage before scaling compute and articulate the cost/speed trade-off.<br>T53: Balance throughput, recovery, fairness and source-system safety. |
| 3. Current content level (what the pack teaches and demonstrates today) | Some Full-level evidence: the Copy Performance and Concurrency Budget labs name T51 and T53, and the chapter contains a specified in-chapter practical deliverable for T53 (self-directed, ungraded). T40 has no practice. |
| 4. Evidence available | 1303 words of prose; 3 table(s); 0 image block(s); 1 code block(s)<br>Diagnostic free-response: `fine-tuning` (grading not established)<br>Lab (simulation): Concurrency Budget, whose registry entry names depth topic(s) T53<br>Lab (simulation): Copy Performance, whose registry entry names depth topic(s) T51<br>In-chapter practical deliverable for T53 (a multi-source concurrency budget). Diagnostic `fine-tuning`. Three tables and one code block. |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T40 has no evidence; the deliverable has no rubric or model answer)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add practice for T40 and success criteria with feedback for the deliverable. Concurrency, DIU and connection statements are bound by CLAUDE.md ADF governance item 13. |

### Ch 18: `cicd` — From Dev to Prod

| Field | Record |
|---|---|
| 1. Chapter ID and title | `cicd`, "From Dev to Prod" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T49: "build a release checklist that separates product changes from environment configuration" is Full-level. T46 to T48 are explanatory.<br>Intended outcomes (roadmap success criteria of the depth topics): T46: Explain why Git is the source of truth without claiming it is a universal ADF product requirement.<br>T47: Explain both supported template-generation approaches and their operational trade-offs.<br>T48: Explain what belongs in infrastructure-as-code versus factory content deployment.<br>T49: Build a release checklist that separates product changes from environment configuration. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: explanation, a Bicep outline (a worked example, not an exercise) and a CI/CD lifecycle diagram, with a scenario-based recognition check (one check recalls an npm package name). Nothing practises T49. |
| 4. Evidence available | 1161 words of prose; 0 table(s); 1 image block(s); 1 code block(s)<br>Scenarios (ID, no.): 12 (14), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `cicd` (grading not established)<br>One lifecycle diagram (Microsoft, per the audit), one code block, scenario 12 (four checks), diagnostic `cicd`. The crosswalk says the Bicep outline was compiled; that was not repeated here. |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T49 has recognition-level evidence only)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add an exercise with feedback: produce a release checklist from a described change set. Re-verify package names, trigger handling and automated-publish behaviour (F12). |

### Ch 19: `migration` — Migrating with ADF

| Field | Record |
|---|---|
| 1. Chapter ID and title | `migration`, "Migrating with ADF" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T58: "design a migration plan that an engineering manager can challenge on risk, ownership, throughput and recovery" is Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T58: Design a migration plan that an EM/Program Manager can challenge on risk, ownership, throughput and recovery. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: an end-to-end architecture case as exposition, plus scenario-based recognition (scenarios 13 and 14 mix recall of limits with numeric reasoning). No exercise or design assessment. |
| 4. Evidence available | 1011 words of prose; 0 table(s); 0 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 13 (15), 14 (16), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `migration-plan` (grading not established)<br>Scenarios 13 and 14 (eight checks). Diagnostic `migration-plan`. A worked end-to-end case. |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T58 has recognition-level evidence only)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add a design exercise with feedback (produce a plan for a stated estate and constraints). The Chapter 21 capstone audits a finished platform and does not ask for a migration plan. Re-verify throughput figures and limits (F12). |

### Ch 20: `fabric` — ADF and Fabric Data Factory

| Field | Record |
|---|---|
| 1. Chapter ID and title | `fabric`, "ADF and Fabric Data Factory" |
| 2. Required instructional level, from the roadmap outcomes | **Core.** T57: "answer ... with current, nuanced reasoning" is explain-and-justify. Maintainer decision (U24): the criterion does not explicitly require a justified choice using meaningful trade-offs, so T57 and Chapter 20 stay Core.<br>Intended outcomes (roadmap success criteria of the depth topics): T57: Answer 'Would you build new pipelines in ADF or Fabric?' with current, nuanced reasoning. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level: the Fabric positioning explanation and a comparison table, with a scenario-based recognition check. The section labelled "Deliverable" is a model three-minute script supplied in full. Confirmed a worked example, not a learner task: the block contains no instruction to the learner, unlike Chapters 11, 17 and 21, which say "the learner must". |
| 4. Evidence available | 666 words of prose; 1 table(s); 0 image block(s); 0 code block(s)<br>Scenarios (ID, no.): 16 (18), each a case study with a four-question single-answer check and feedback<br>Diagnostic free-response: `fabric` (grading not established)<br>Scenario 16 (four checks). Diagnostic `fabric` (free response, grading not established). One comparison table and the model script. |
| 5. Evidence screen and overall conformance | Evidence screen: no gap found; known gaps (the section labelled "Deliverable" is a worked example and should be labelled as one; none of the time-sensitive Fabric claims was re-verified)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Relabel the section "Worked example" (U28), so it is not read as a learner task. If a learner task is wanted, add a separate exercise with success criteria and feedback. Re-verify Fabric positioning, migration paths and billing (F12). |

### Ch 21: `pitfalls` — Pitfalls: every trap in one place

| Field | Record |
|---|---|
| 1. Chapter ID and title | `pitfalls`, "Pitfalls: every trap in one place" |
| 2. Required instructional level, from the roadmap outcomes | **Full.** T60: "defend architecture, security, networking, recovery, cost and delivery decisions under interview pressure" and T59 (answer with facts, trade-offs and acceptance criteria) are Full-level.<br>Intended outcomes (roadmap success criteria of the depth topics): T59: Answer with facts, trade-offs, assumptions, operational consequences and measurable acceptance criteria.<br>T60: Defend architecture, security, networking, recovery, cost and delivery decisions under interview pressure. |
| 3. Current content level (what the pack teaches and demonstrates today) | Core-level with a specified exercise: the capstone (three deliverables built on a flawed retail-platform case with six flaws) is aligned with T60 but gives no feedback, and its specification of Deliverable 2 states the hardened values, so it reads partly as a worked solution. It is practice, not matching evidence (U28). |
| 4. Evidence available | 1186 words of prose; 4 table(s); 0 image block(s); 0 code block(s)<br>Four tables. No scenario, lab or diagnostic is linked to this chapter. T59's drills (the 18 scenarios and 10 diagnostics) belong to other chapters. |
| 5. Evidence screen and overall conformance | Evidence screen: gap found (T59 has partial evidence only; no understanding check; no feedback; the exercise reveals its solution)<br>Overall conformance: **Not conformant** (prerequisites confirmed missing; 7.5). Comprehension gate: **provisional: comprehension not yet validated** |
| 6. Required remediation | Add success criteria, feedback and an understanding check for the pitfalls summary, and make the exercise independent of its own answer. |


### 7.2 Chapter 1: separation recorded in the register

The register records Chapter 1 as two units. The chapter's content is unchanged and `v1.json` is not touched.

- **1a, orientation** (everything before the final section): required **Core**, from T1 and T4 (explain). Currently Core-level. It has no understanding check, so it is not conformant.
- **1b, service selection** (the final section, "ADF vs Databricks vs Synapse vs Fabric: architecture selection framework"): required **Full**, from T2 ("choose ... with explicit trade-offs"), a reasoned architecture selection. Currently an exposition with a decision matrix, so Core-level. **The missing evidence is explicit:** nothing in Chapter 1 practises or assesses T2. The only related item is scenario 16 ("ADF or Fabric?", Chapter 20, which also lists T2), a recognition-level check, graded partial. It is not conformant.

The smallest separation is one cut, before the final section. "Where it is heading" could belong to either side and is left to the Chapter 1 rework. Maintainer decision (U18): the register keeps 1a and 1b, and no content is split. A content split is a later task (F9). Awaiting reviewer confirmation.

### 7.3 Section-level Reference-companion candidates (not registered)

They cannot be registered until chapters are split into units. Candidates seen in the headings: the hard-limits material and "How much of this to memorise" in Chapter 3, and "Connectors" in Chapter 6. Reference companions must still be accurate, sourced, accessible and cross-linked to the unit that teaches the concept.

### 7.4 Units outside the 21 chapters (proposed classes)

The standard classifies every instructional unit (section 13). The pack also contains these, not registered chapter by chapter here. All proposals, all not verified:

| Unit type | Count | Proposed class | Basis |
|---|---:|---|---|
| Behaviour Lab experiments | 5 | Full instructional unit | Practical simulation with predict, manipulate and graded reasoning stages (teaching simulation, section 4). |
| Scenarios | 18 | Core instructional unit | Case study, four-question check with feedback, debrief and takeaways: situational understanding. No construction of a design. |
| Diagnostic questions | 10 | Core instructional unit | Free-response explain-back prompts with expected key points. Grading is not established (F8). |

### 7.5 Overall conformance against the standard's mandatory requirements

The overall result tests each unit against the requirements the standard makes mandatory for it: section 4 (the elements each substantive unit must define, in its content or its instructional metadata), sections 8 and 9 (practical work and assessment), section 12 (the quality gate) and section 13 (the class's requirements). It was checked against the pack schema, the pack content and the application code, not against headings alone.

| Requirement | What was inspected | Result |
|---|---|---|
| Learning objective (section 4, 13) | The roadmap workbook holds an objective and success criterion per topic, and the roadmap topic page and the topic guide page show them to a learner who has the ADF roadmap. The chapter page shows only the chapter's one-line `summary`. | Not verified: present as metadata, but not on the chapter page. |
| **Prerequisites** (section 4, 13) | The chapter schema (`Chapter` in `backend/app/content/packs.py`) has no prerequisites field (`id`, `title`, `summary`, `sources`, `blocks`, `practice_links` only; `extra="forbid"`). The workbook has no prerequisite column. A text scan of every chapter found the word only in technical senses (Event Grid registration, customer-managed-key and CDC prerequisites, trigger deployment), and no statement of prior knowledge or that none is required. | **Confirmed missing for every unit.** |
| Context, concept explanation, worked example (section 4) | Present in varying degrees. | Not verified. |
| Application (section 4) | Worked examples in some chapters; labs and exercises for some outcomes (7.0). | Not verified. |
| Understanding check with explanatory feedback (section 4, 9, 13) | None inside a chapter. Scenarios whose `chapter` field names the chapter are listed on the chapter page ("Practise it in the Learning Lab") and link back; each check has an answer key and a `why`. | Not verified: counts toward the check only for the outcomes the scenario addresses (U28). 1a has none: screen gap. |
| Summary and next step (section 4) | Every chapter has a one-line `summary` shown as its subtitle, 14 chapters have a takeaway or a 'Why it matters to you' block, and each page has Previous and Next buttons. | Not verified: a one-line summary may not consolidate the principal takeaways. |
| Sources (section 4, 7) | A `sources` field per chapter and inline Microsoft links; the audit records the pages. | Present; accuracy not re-verified here. |
| Observable success criteria and feedback for Full units (section 13, 8, 9) | Lab Apply stages have a model-graded outcome and right or wrong messages. The in-chapter exercises (T53, T54, T60) have no rubric, model answer or feedback. | Confirmed missing for the exercises in Chapters 11, 17 and 21; section 8 says exercises "should" specify how to verify success, so this is recorded as a gap in practice, not a failed "must". |
| Independent comprehension review (section 12) | No review or pilot has happened. | Not done for any unit: no unit can be Conformant. |

**Result.** Prerequisites are confirmed missing from all 22 units, so the overall result is **Not conformant for all 22 units**. That follows from the schema and the content, not from a heading scan. The remediation is tracked separately (F6) and does not change the status. Every other requirement is Not verified or not yet reviewed. No unit is Conformant, because none has had the independent review.

Maintainer decision (F6), awaiting reviewer confirmation: prerequisites will be a per-chapter text block stating the essential prior knowledge or that none is required. The status stays Not conformant until each unit has one, validated by the independent reviewer. Adding a schema field is a pack schema change under CLAUDE.md rule 10; a text block in a chapter needs no schema change.

## 8. Review plan

**Owner.** The pack owner is the repository maintainer. The owner is not the reviewer of units the owner authored.

**Independent reviewer (standard section 12).** A reviewer who did not author the unit checks it against the learner profile in section 1 and the 13-item publish checklist, and records the result. The recommendation on AI-assisted review is in section 10. In no case does an AI review replace the independent reviewer or the learner pilot below.

**Beginner-comprehension pilot: PENDING. It has not been conducted.**

| Field | Plan |
|---|---|
| Unit | Chapter 1, `what-it-is`, as the reference chapter (standard section 15, steps 3 and 4), after its rework. |
| Learners | At least two human learners, unfamiliar with ADF, who know general data concepts. They must not have helped write or review the chapter. |
| Materials | The chapter as shipped, with its stated prerequisites and any provided materials only. No outside reading. |
| Method | Each learner works through the chapter and explains it back. The observer notes where the learner hesitates, misreads a term, cannot explain a relationship, or reaches for outside material. This is a formative usability check, not representative research (standard section 12). |
| What is recorded | Per observation: anonymised learner id (never a name, since this repository is public), date, section, what happened, category (term, relationship, prerequisite gap, navigation, other), severity, resolution and whether a re-test is needed. |
| Significant issue | One where the learner could not explain why the concept matters or how the components fit, or needed outside material to understand the basic lesson. All significant issues are resolved, and re-observed, before the chapter is accepted. |
| Findings file | `docs/standards/packs/adf-pilot-findings.md`, to be created when the pilot runs. It does not exist and holds no results. |
| Observed confusion to date | **None recorded: no learner has attempted the chapter.** No participants, observations, findings or results exist. |
| Pack-level exit | Chapter 1 and this annex are approved only after the pilot's significant issues are resolved. Until then Chapter 1 stays provisional, and so does every other chapter. |

**For every later unit.** The independent reviewer performs a beginner-comprehension pass. Practical or high-risk units get learner testing when they introduce a new instructional pattern, when recurring assessment failures suggest confusion, or when the reviewer finds unresolved risk. A unit that should have had a pilot and has not is marked "provisional: comprehension not yet validated" and is never described as having passed.

**Triggers for re-review.** A change to any Microsoft page the unit cites; any change to a limit, default, connector claim or Fabric positioning in it; a change to a lab experiment, its model or its constants; a change to the standard's version; a recurring wrong answer on a scenario check or diagnostic (the standard's evidence loop; whether the product captures those results by unit has not been checked); and the cadence in section 10.

**Quality gate (standard section 12).** Technical accuracy, source integrity, curriculum coverage and the applicable comprehension review are mandatory; a good checklist score cannot offset a failure in any of them.

## 9. Open items, evidence gaps and decisions needed

Nothing here is resolved by this annex. "Decision" items need the reviewer, and section 10 gives a recommendation for each. "Gap" items are facts the repository does not establish.

| # | Type | Item |
|---|---|---|
| U1 | Pending | The original Pack Overview Visual does not exist (section 5). |
| U2 | Pending | The beginner-comprehension pilot has not run (section 8). The app has no "provisional: comprehension not yet validated" marker (F13). |
| U3 | Gap | Overall conformance of every unit against standard sections 4, 8, 9, 12 and 13. No unit has been reviewed. Prerequisites are confirmed missing from all 22 units, so the overall result is Not conformant for all of them (7.5). The evidence screen finds a gap in 13 units (7.0). |
| U4 | Gap | Prerequisites are recorded nowhere in the repository. Section 6's are proposed (F6). |
| U5 | Gap | Learning objectives and success criteria exist only in the roadmap workbook, not in the chapters. Whether to show them in each unit is a decision. |
| U6 | Gap | No understanding check inside a chapter; one-line summary plus a takeaway or 'Why it matters to you' block in 14 chapters; adequacy not verified. Checks exist only in the 18 scenarios, the 10 diagnostics and the lab. |
| U7 | Gap | The roadmap deliverables are displayed but nothing in the application verifies them (section 6.2). Only a learner's self-graded explanation per topic is recorded. |
| U8 | Gap | 11 of 54 scenario crosswalk topic references conflict with the workbook (appendix B). Scenario to topic links are chapter-level only (F1). |
| U9 | Gap | The pack, crosswalk and audit disagree on the chapter set for 12 topics (appendix A; F5). |
| U10 | Gap | The audit's summary counts do not match its rows (section 11; F3). |
| U11 | Gap | The workbook's "Study Guide Crosswalk" sheet shows 9 topics as Partial and 51 as Full; the Markdown crosswalk says 60 Full (section 11; F2). |
| U12 | Gap | The documentation notes call scenarios 5 to 18 stubs; the pack has full content. Whether the finished scenarios were audited against Microsoft sources is not established (F4). |
| U13 | Decision | Keep or replace the Microsoft diagram in Chapter 1 (section 10). |
| U14 | Decision | Chapter 1 opens with the maintainer-facing alignment block, ahead of learner orientation (Chapter 1 rework). |
| U15 | Decision | Provenance metadata for an original visual, and the zoom behaviour (section 10; F10). |
| U16 | Decision | Where the glossary lives (section 10; F11). |
| U17 | Decision | Role of AI-assisted review (section 10). |
| U18 | Decided (maintainer), awaiting reviewer confirmation | Chapter 1 stays recorded as two units (1a, 1b) in the register so the gaps stay visible, and Chapter 3 stays whole. No content is restructured or split here; a content split of Chapter 1, Chapter 3 or the section-level Reference candidates is a later task (F9). Chapter 15 is not part of this decision (U25). The counts in 7.0 are for the split register. |
| U19 | Decision | Re-verification cadence and review triggers (section 10). |
| U20 | Gap | A register of time-sensitive claims with check dates has not been compiled (F12). |
| U21 | Gap | No assessment item carries a topic number; direct topic-level assessment is not established for any topic (F7). |
| U22 | Gap | How diagnostic free responses are graded is not established (F8). |
| U23 | Gap | Per-topic depth of the Behaviour Lab's practice is not verified; at least T45 is thin (section 4). |
| U24 | Decided (maintainer), awaiting reviewer confirmation | T15 is Full-level (its criterion requires identifying the security, timeout and retry implications of a choice). T57 stays Core (its criterion does not explicitly require a justified choice using meaningful trade-offs). T13, T20 and T31 are unchanged: there is no separate evidence to move them. The rest of the verb reading is unchanged. Chapter 3 now has a second required Full-level outcome (T15, partial). Chapter 20 stays Core. Open to revisit only on separate evidence, for example T57 and T31. |
| U25 | Decided (maintainer), awaiting reviewer confirmation | Chapter 15 stays a separate Core instructional unit and is not a Reference companion: it teaches recognition (where sensitive values leak, what Secure Input and Output do, what the compliance list says) with a scenario check, and it is not only lookup material. It is not merged or restructured. A cross-link to Chapter 14 is follow-up F16; today the chapter refers only to chapter 8. |
| U26 | Decided (maintainer), awaiting reviewer confirmation | The two-condition rule is renamed the evidence-screening rule, and a separate overall conformance result is added, tested against the standard's mandatory requirements (7.5). No unit is Conformant before independent review. |
| U27 | Decided (maintainer), awaiting reviewer confirmation | The missing-prerequisite finding was verified against the schema and the content (7.5): the chapter schema has no prerequisites field, and no chapter states prior knowledge. The overall status is Not conformant for each unit (all 22). The objective and the summary are present as metadata and are Not verified, not failed. Remediation is tracked separately (F6) and does not soften the status. Where prerequisites live is decided: a per-chapter text block (F6). |
| U28 | Decided (maintainer), awaiting reviewer confirmation | Practice counts as matching evidence only if it is on the learner's path, aligned with the outcome, has observable success criteria and gives appropriate feedback. A chapter link, a registry entry or a related scenario never counts alone. Checked against the content: the in-chapter exercises for T54 (Chapter 11) and T60 (Chapter 21) have no rubric, model answer or feedback, so both are partial (T53's lab stays matching). Chapter 20's "Deliverable" is confirmed a worked example, to be relabelled "Worked example"; Chapter 20 stays Core while T57 is Core. |
| U29 | Decided (maintainer), awaiting reviewer confirmation | Chapter-to-lab navigation is a separate progression gap (standard section 10: "clear progression to the next unit, relevant practice, and subsequent learning stage"), tracked as F17. It does not exclude lab evidence that otherwise qualifies. A lab counts when its stage task matches the outcome and it has observable success criteria and feedback, and it is reachable from the Learning Lab and the roadmap topic page; a registry link to a chapter never counts alone. The standard has no requirement that evidence be linked from the chapter page. No grade or count changes. |

## 10. Recommendations on outstanding design decisions

Recommendations for the reviewer. None is implemented or approved.

**D1. Keep the Microsoft diagram next to the original visual?** Recommend: keep it, after the original overview and its walkthrough, captioned as Microsoft's lifecycle diagram and credited as the audit records, and re-verify its reuse terms for that asset before keeping it. Rationale: it shows a different thing (Microsoft's four-stage lifecycle) that learners will meet in Microsoft's own pages; the original overview covers the PrepBench anchor scenario. It must never appear to be PrepBench's own. If the comprehension pilot shows the two diagrams confuse learners, remove it.

**D2. Metadata for an original visual.** Recommend: set `source_attribution` to say it is PrepBench original artwork, and leave `license`, `license_url` and `modification_status` unset, because the schema added them for third-party assets (CLAUDE.md rule 16) and "Unmodified" or CC BY 4.0 would be false for original work. Never assign Microsoft's licence. State the reuse terms for original artwork once, in the repository's licence documents, as a maintainer decision. If a clear provenance field is wanted in the schema (for example a field distinguishing original from third-party), that is a schema change under CLAUDE.md rule 10 and a separate task.

**D3. Where the glossary lives.** Recommend: terms are explained at first use in every unit (mandatory, section 3), and a glossary is added as a Reference companion inside the pack, so it ships with the guide and can be linked from units; the pack's chapter structure is preserved by CLAUDE.md ADF governance item 5 to stop duplicate chapters made to satisfy roadmap numbering, so the maintainer should confirm that a reference unit is allowed. The roadmap workbook's "Mental Model" sheet is not learner-facing and was not reviewed. Do not put the glossary only in the wiki, where a learner in the guide would not find it.

**D4. AI-assisted versus human review.** Recommend: an AI-assisted review is a useful pre-check (terminology gaps, source mismatches, conformance to the checklist) and is recorded as such. It does not satisfy the independent reviewer pass, which is a human who did not author the unit. A session that authored or helped author a unit does not review it. The two-learner reference-chapter pilot is human learners and nothing replaces it.

**D5. Re-verification cadence.** Recommend: six months as the baseline for volatile claims (limits and defaults, connector lists, DIU ranges, Fabric positioning, GA dates, prices), plus event-driven checks when Microsoft documentation, a service limit, connector behaviour or a relevant API or package version changes, and before any release that touches the claim. Drive both from the claims register (F12). Six months is a starting point to be tuned once the register shows how often claims change.

**D6. Image zoom.** Recommend: record it as a product and UX follow-up (F10): the guide renderer has no zoom or full-size view, so a detailed overview cannot be read in place. It is not a capability today and must not be described as one. An accessible zoom or full-size view (keyboard operable, with the long description kept in the text) should be designed before the detail companion in section 5 is relied on.

## 11. Source reconciliation and follow-up register

### 11.1 Reconciliation

Counts below were recalculated from the files, not copied. Historical figures are kept and not edited.

| Source | Reported value | Verified value (recalculated from the files) | Decision | Follow-up |
|---|---|---|---|---|
| Audit summary table, decision counts | IMPLEMENT 34, LINK ONLY 18, ALREADY ADEQUATE 6, NO SUITABLE RESOURCE FOUND 2 (sum 60) | Counted from the 60 table rows: 36, 17, 5, 2 (sum 60). Both sum to 60. | Use the row counts: each row is a per-topic decision, the summary is an aggregate. The summary is historical and not edited here. | F3 |
| Roadmap workbook, sheet "Study Guide Crosswalk" | 51 Full, 9 Partial | Recounted from the sheet: 51 Full, 9 Partial. The Partial topics are T2, T15, T35, T48, T53, T54, T56, T58, T60. | Historical. The sheet was created in the same commit as the Markdown crosswalk (5e34b5c, 2026-10-04) and was not updated when the Markdown crosswalk and the pack alignment blocks recorded those topics as Full. All nine are topics for which the Markdown crosswalk describes a dedicated section added to a chapter (it describes a tenth, T57, as well). The annex does not treat Full as independently verified (see below). | F2 |
| Study Guide to Roadmap crosswalk (Markdown) | 60 Full | 60 rows marked Full; matches the pack alignment blocks (60 of 60 topics have every alignment entry marked Full). | Consistent with the pack. "Full" is a coverage label asserted by authors. It is not evidence of competence and is not re-verified here. | none |
| Alignment blocks document | 60 topics across 21 chapters | Compared block by block with the pack: 0 differences. | Treated as a faithful record of the pack. | none |
| Crosswalk titles versus workbook titles | 60 topics | 60 of 60 titles identical to the workbook's "ADF Master Roadmap" sheet. | The Markdown crosswalk is keyed to the same 60 topics as the workbook. | none |
| Documentation notes, sections 31.1 and 31.6 | Scenarios 5 to 18 "exist only as title-and-outcome stubs" (2026-10-04) | The pack now has full content for all 18 scenarios (each with a case study, a four-question check, a debrief and takeaways; roughly 1,371 to 1,962 words of content by a rough count). | Historical and superseded by the current pack. Not deleted. Whether the finished scenarios were audited against Microsoft sources is not established. | F4 |
| Chapter sets per topic: pack, crosswalk, audit | Sources agree | 12 topics differ (appendix A) | The pack's alignment blocks decide, because the application resolves topic to chapter links from them (CLAUDE.md, ADF governance item 11). | F5 |
| Scenario crosswalk topic references | 18 scenarios mapped to roadmap topics | Of 54 references: 33 match the workbook title, 10 are reworded, 11 conflict (appendix B). | The workbook decides the meaning of a topic number. | F1 |

### 11.2 Follow-up register

Each item needs a change to a file this annex did not edit. None is started.

| ID | Item | Source and impact | Proposed owner / workstream | Next action |
|---|---|---|---|---|
| F1 | Re-key the scenario crosswalk | [`ADF_Scenario_Roadmap_Crosswalk.md`](../../research/ADF_Scenario_Roadmap_Crosswalk.md): 11 of 54 topic references conflict with the workbook and 10 are reworded; scenario to topic links cannot be relied on (appendix B). | ADF content maintenance (research documents) | Correct the references, or drop the numbers and key by title; re-run the comparison in appendix B. Separate task. |
| F2 | Update the workbook's crosswalk sheet | [`ADF_Master_Roadmap_Mapped.xlsx`](../../research/ADF_Master_Roadmap_Mapped.xlsx), sheet "Study Guide Crosswalk": 9 topics still read Partial. Violates CLAUDE.md ADF governance items 6 and 7. | ADF curriculum workstream | Decide per topic whether Full is justified by content (not by score), then update the sheet. Separate task. |
| F3 | Correct the audit's summary table | [`ADF_Microsoft_Source_Enrichment_Audit.md`](../../research/ADF_Microsoft_Source_Enrichment_Audit.md): summary counts differ from its rows. | ADF content maintenance | Replace the summary counts with the row counts, with a dated note. Separate task. |
| F4 | Mark the scenario-stub statements as superseded | [`adf-documentation-notes.md`](../../research/adf-documentation-notes.md) sections 31.1 and 31.6. | ADF content maintenance | Add a dated supersession note; keep the history. Separate task. |
| F5 | Align the chapter sets | Pack, crosswalk and audit disagree for 12 topics (appendix A). | ADF curriculum workstream | Decide the intended chapter set per topic; update the crosswalk and audit to match the pack, or the pack to match a decision. Separate task. |
| F6 | Record prerequisites | Confirmed missing from every unit: the chapter schema has no prerequisites field (`extra="forbid"`) and no chapter states prior knowledge (7.5, U27). Maintainer decision, awaiting reviewer confirmation: a per-chapter text block (prior knowledge, or an explicit "none"). It meets the per-unit requirement of standard section 4 ("in its content"), needs no schema change, and changes pack content, which CLAUDE.md rule 17 does not allow before the annex is approved. | Curriculum design, with the independent reviewer | Validate the proposed prerequisites (section 6), then add the block to each chapter once the annex is approved. Every unit stays Not conformant until then. Not started. |
| F7 | Enforce scenario and assessment links at topic level | The pack links scenarios, diagnostics and lab questions to chapters, not topics; the lab registry links experiments to topics. | Product and content | Decide whether items should carry topic ids; a pack schema change would follow CLAUDE.md rule 10. Not started. |
| F8 | Clarify how diagnostic free responses are graded | [`v1.json`](../../../backend/app/content/packs/adf/v1.json) `diagnostic_questions`; grading depends on a configured AI provider (CLAUDE.md rule 2). | Product | Confirm and document the behaviour before relying on these as assessments. |
| F9 | Split Chapter 1 and the other mixed chapters | Section 7 (Chapters 1 and 3 and the section-level Reference candidates). U18 keeps the register split for Chapter 1 and Chapter 3 whole; the content is unchanged. | ADF curriculum workstream | Design and decide any content split. Separate from this annex and from the Chapter 1 rework. |
| F10 | Image zoom and detail view in the Study Guide renderer | `GuideChapterPage.tsx` renders images with a fixed maximum width and no zoom (section 10). | Frontend / UX | Design and build an accessible zoom or full-size view. Product follow-up; not a completed capability. |
| F11 | Glossary unit | Section 10. | ADF curriculum workstream | Decide the location and build it as a Reference companion. |
| F12 | Register of time-sensitive claims with check dates | Section 2. | ADF content maintenance | Build the claims register; drive the six-month and event-driven checks from it. |
| F13 | Show the provisional comprehension marker in the app | Section 8; the app has none. | Product | Decide whether and how the marker is displayed. Not started. |
| F14 | Create the original Pack Overview Visual | Section 5. Pending. | ADF curriculum workstream, with design review | Build to the specification; check accuracy, accessibility and comprehension. |
| F15 | Run the two-learner beginner pilot | Section 8. Pending. | Pack owner, with recruited learners | Run the protocol after the Chapter 1 rework; record findings in the findings file. |
| F16 | Cross-link Chapter 15 to Chapter 14 | Follow-up to U25, a maintainer decision awaiting reviewer confirmation. Chapter 15 refers only to chapter 8. A cross-link is a pack content change (a text block), made through the content process; no merge or restructure. | ADF curriculum workstream | Add the cross-link in Chapter 15 (and, if wanted, back from Chapter 14). Separate task. |
| F17 | Link labs from chapter pages (progression gap, U29) | Follow-up to U29, a maintainer decision awaiting reviewer confirmation. `GuideChapterPage.tsx` lists scenarios but not labs; the lab page links chapters. Standard section 10 asks for clear progression to relevant practice. | Frontend / UX, with ADF curriculum workstream | Decide whether chapters should link their labs, and build it if so. Product follow-up; not started. |

## Appendix A. Where the pack, the crosswalk and the audit disagree on chapters

**Method.** For each of the 60 topics, the set of chapter numbers was compared across (a) the pack's alignment blocks, (b) the crosswalk row's "Ch N" list and (c) the audit row's chapter column ("Ch N" references parsed from free text). Order and the text after "Ch N" are ignored. A topic is counted when the three sets are not all equal. **Result: 12 topics** (the pack differs from the crosswalk for 10, the pack differs from the audit for 9, the crosswalk differs from the audit for 7; these overlap, so they do not sum to 12). The audit's chapter column is free text, so a chapter written in another form could be missed; 12 is the result of this method, not a verified lower or upper bound.

Section 6 follows the pack's alignment blocks for the location column, as a reading choice (section 2.1). Nothing here is corrected, because correcting a source is outside this task.

| T# | Topic | Pack alignment blocks | Crosswalk | Audit | Note |
|---:|---|---|---|---|---|
| 3 | ADF Resource Model | Ch 2 | Ch 2, Ch 3 | Ch 2 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 6 | Datasets and Parameterisation | Ch 2 | Ch 2, Ch 3 | Ch 2, Ch 3 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 8 | Global Parameters and Reusable Configuration | Ch 2 | Ch 2, Ch 18 | Ch 2, Ch 18 | Crosswalk lists Ch 18 first, but the pack's Chapter 18 alignment block does not list this topic; this annex uses Ch 2 as the depth unit. |
| 27 | Schema Mapping and Type Conversion | Ch 6, Ch 7 | Ch 7 | Ch 6, Ch 7 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 34 | CDC Checkpoints and Rename Risk | Ch 10 | Ch 10 | Ch 10, Ch 13, Ch 21 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 35 | Metadata-Driven Pipelines | Ch 9, Ch 19 | Ch 2, Ch 3, Ch 9, Ch 19 | Ch 2, Ch 9, Ch 19 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 50 | Reliability, Idempotency and Recovery | Ch 13, Ch 18 | Ch 13, Ch 18 | Ch 13 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 54 | Architecture Trade-offs: ADF vs Databricks vs Synapse | Ch 11, Ch 20, Ch 21 | Ch 1, Ch 11, Ch 20, Ch 21 | Ch 1, Ch 11, Ch 20, Ch 21 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 55 | ADF + Azure Databricks | Ch 3 | Ch 3, Ch 13 | Ch 3, Ch 13 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 57 | ADF vs Fabric Data Factory in 2026 | Ch 20 | Ch 1, Ch 20 | Ch 20 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 58 | Enterprise Migration Architecture | Ch 8, Ch 13, Ch 19, Ch 21 | Ch 8, Ch 9, Ch 14, Ch 18, Ch 19, Ch 21 | Ch 19 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |
| 59 | ADF Interview Scenario Drills | Ch 12, Ch 21 | Ch 21 | Ch 21 | Chapter sets differ; the pack is followed and the others are marked with a double dagger. |

## Appendix B. Scenario crosswalk discrepancies

**What the source says.** [`ADF_Scenario_Roadmap_Crosswalk.md`](../../research/ADF_Scenario_Roadmap_Crosswalk.md) maps each of the 18 scenarios to one primary and two secondary roadmap topics, by number, with a name in the summary table and in the secondary lists.

**What the check found.** Each reference was compared with the workbook's title for that number. Of 54 references: 33 match, 10 use different wording for the same concept, and 11 conflict (the number belongs to a different topic in the workbook). Primary references: 3 conflict and 3 are reworded. Secondary references: 8 conflict and 7 are reworded. The comparison of wording against meaning is the reviewer's judgement, recorded in the table, not a mechanical match.

**Which source decides.** The workbook defines what a topic number means, for the reasons in section 2.1: it is the curriculum planning source, and the pack, the Markdown crosswalk, the audit and the lab registry all use its numbering. The scenario crosswalk is a derived planning artifact: no application code, test or script references it (searched `backend`, `frontend/src`, `frontend/e2e`, `scripts` and `.github`), and the pack links scenarios to chapters, not topics. Where they disagree, the crosswalk's number is wrong or stale by this rule, and the topic named in the crosswalk text is the better guide to what was meant.

**Why it may have happened (hypothesis, not proof).** The crosswalk's phase labels differ from the workbook's phase numbers for 5 of the 18 primary references (table below), and the crosswalk's first commit (`7a68efb`, 2026-10-04) is not an ancestor of the commit that created the workbook (`5e34b5c`, 2026-10-04); its later edits (to 2026-10-05) did not re-key the topic numbers. That is consistent with the scenarios being mapped against an earlier outline of the roadmap. It does not prove it.

**Annex-level clarification versus correction to the research file.** This annex only clarifies: it reads scenario to topic links as chapter-level, and it records the likely intended topics below. It does not edit the crosswalk or the workbook. The corrections belong to the research file (F1).

| Scenario ID (shown as no.) | Title | Pack chapter | Role | Crosswalk says | Roadmap workbook says at that topic number | Type | Likely intended topic | Evidence for the likely mapping |
|---|---|---|---|---|---|---|---|---|
| 1 (1) | The missing lots | `incremental` | primary | T32 "Watermark-Based Incremental Loading" | T32 "Watermark Patterns" | variant | T32 (same concept, different wording) | The wording differs; the concept is the same as roadmap T32, so this is an annex-level clarification only. |
| 1 (1) | The missing lots | `incremental` | secondary | T26 "Copy Activity Performance & Tuning" | T26 "Connectors, Formats and Capability Matrix" | conflict | T51 Copy Performance: DIUs, Parallel Copies and Bottlenecks | Moderate: the name "Copy Activity Performance & Tuning" matches T51 and not T26 (Connectors, Formats and Capability Matrix). |
| 2 (2) | The first pipeline | `building-blocks` | secondary | T6 "Datasets" | T6 "Datasets and Parameterisation" | variant | T6 (same concept, different wording) | The wording differs; the concept is the same as roadmap T6, so this is an annex-level clarification only. |
| 3 (3) | The server nobody owned | `integration-runtimes` | primary | T22 "Self-Hosted Integration Runtime (SHIR)" | T22 "Managed VNet and Managed Private Endpoints" | conflict | T21 Self-hosted IR Architecture and Operations | Strong: the crosswalk's own summary names the topic "Self-Hosted Integration Runtime (SHIR)"; roadmap T21 is that topic, and its success criterion (SHIR as production infrastructure with a support model) matches the scenario outcome (a machine nobody owned). |
| 4 (4) | The hour that never loaded | `triggers` | secondary | T18 "Storage Event Triggers" | T18 "Event and Custom Event Triggers" | variant | T18 (same concept, different wording) | The wording differs; the concept is the same as roadmap T18, so this is an annex-level clarification only. |
| 5 (5) | Green runs that failed | `monitoring` | primary | T12 "Error Handling and Conditional Routing" | T12 "ForEach, Batch Count and Parallelism" | conflict | T10 Dependencies: Success, Failure, Completion and Skip (with T44, T50 already listed as secondary) | Moderate to strong: the crosswalk names the topic "Error Handling and Conditional Routing"; no roadmap title matches; T10's success criterion (a failure notification flow that does not mask failures) matches the scenario outcome (a handler turns a failed load green). Not established as the author's intent. |
| 5 (5) | Green runs that failed | `monitoring` | secondary | T50 "Pipeline Recovery and Re-run Patterns" | T50 "Reliability, Idempotency and Recovery" | variant | T50 (same concept, different wording) | The wording differs; the concept is the same as roadmap T50, so this is an annex-level clarification only. |
| 6 (6) | The skipped rows nobody read | `bad-rows` | primary | T27 "Fault Tolerance and Binary Copy" | T27 "Schema Mapping and Type Conversion" | conflict | T28 Fault Tolerance and Skipped Rows | Strong: the name "Fault Tolerance and Binary Copy" is close to T28's title, and T28's success criterion (decide fail versus quarantine, and who owns the workflow) matches the scenario outcome (skipped rows in a log no one owns). |
| 17 (9) | The balances that matched | `reconciliation` | secondary | T13 "Lookup and GetMetadata" | T13 "If Condition, Switch, Until and Wait" | conflict | T11 Lookup and Get Metadata | Strong: the name "Lookup and GetMetadata" matches T11; T13 is If Condition, Switch, Until and Wait. |
| 10 (11) | The bill that doubled | `performance-cost` | primary | T52 "Cost Modeling, DIU Allocation and Estimation" | T52 "ADF Cost Model and FinOps" | variant | T52 (same concept, different wording) | The wording differs; the concept is the same as roadmap T52, so this is an annex-level clarification only. |
| 18 (13) | Card numbers in the error log | `sensitive-data` | secondary | T28 "Regulated Data and Encryption in Transit" | T28 "Fault Tolerance and Skipped Rows" | conflict | Unresolved | The name "Regulated Data and Encryption in Transit" matches no current roadmap title. Candidates are T42 (CMK and Factory Encryption) and T45 (Operational Logging and Sensitive Data). The evidence does not choose between them. |
| 18 (13) | Card numbers in the error log | `sensitive-data` | secondary | T27 "Fault Tolerance and Binary Copy" | T27 "Schema Mapping and Type Conversion" | conflict | T28 Fault Tolerance and Skipped Rows | Strong: the name "Fault Tolerance and Binary Copy" matches T28. |
| 12 (14) | The urgent fix | `cicd` | secondary | T47 "ARM Template Deployment" | T47 "ARM Templates and Automated Publishing" | variant | T47 (same concept, different wording) | The wording differs; the concept is the same as roadmap T47, so this is an annex-level clarification only. |
| 12 (14) | The urgent fix | `cicd` | secondary | T49 "Release Gates and Testing Strategies" | T49 "Deployment Parameters, Global Parameters and Trigger Handling" | conflict | Unresolved | The name "Release Gates and Testing Strategies" matches no current roadmap title. Nearby topics are T46, T47 and T49 (release and deployment), and the evidence does not choose between them. |
| 13 (15) | The 1,000 tables that vanished | `migration` | secondary | T13 "Lookup and GetMetadata" | T13 "If Condition, Switch, Until and Wait" | conflict | T11 Lookup and Get Metadata | Strong: same name as above. |
| 13 (15) | The 1,000 tables that vanished | `migration` | secondary | T11 "ForEach and Iteration Patterns" | T11 "Lookup and Get Metadata" | conflict | T12 ForEach, Batch Count and Parallelism | Strong: the name "ForEach and Iteration Patterns" matches T12; T11 is Lookup and Get Metadata. |
| 14 (16) | Cutover in three weeks | `migration` | secondary | T32 "Watermark-Based Incremental Loading" | T32 "Watermark Patterns" | variant | T32 (same concept, different wording) | The wording differs; the concept is the same as roadmap T32, so this is an annex-level clarification only. |
| 14 (16) | Cutover in three weeks | `migration` | secondary | T22 "Self-Hosted Integration Runtime" | T22 "Managed VNet and Managed Private Endpoints" | conflict | T21 Self-hosted IR Architecture and Operations | Strong: the name "Self-Hosted Integration Runtime" matches T21, not T22 (Managed VNet and Managed Private Endpoints). |
| 15 (17) | The count Databricks sent back | `pipelines` | primary | T55 "Databricks Integration and Lakehouse Orchestration" | T55 "ADF + Azure Databricks" | variant | T55 (same concept, different wording) | The wording differs; the concept is the same as roadmap T55, so this is an annex-level clarification only. |
| 15 (17) | The count Databricks sent back | `pipelines` | secondary | T54 "Architecture Trade-offs" | T54 "Architecture Trade-offs: ADF vs Databricks vs Synapse" | variant | T54 (same concept, different wording) | The wording differs; the concept is the same as roadmap T54, so this is an annex-level clarification only. |
| 16 (18) | ADF or Fabric? | `fabric` | secondary | T57 "Modernizing ADF to Fabric Data Factory" | T57 "ADF vs Fabric Data Factory in 2026" | variant | T57 (same concept, different wording) | The wording differs; the concept is the same as roadmap T57, so this is an annex-level clarification only. |

**Primary references with a different phase number:**

| Scenario ID (no.) | Primary topic | Crosswalk phase label | Workbook phase for that topic | Same phase number? |
|---|---|---|---|---|
| 3 (3) | T22 | 4. Integration Runtimes | 5. Integration Runtime & Networking | no |
| 4 (4) | T17 | 3. Control Flow & Orchestration | 4. Triggers & Time | no |
| 10 (11) | T52 | 10. CI/CD, IaC & Reliability | 11. Performance, Cost & Architecture | no |
| 14 (16) | T58 | 11. Enterprise Architecture & Strategy | 12. Platform Integration & Interview Readiness | no |
| 15 (17) | T55 | 11. Enterprise Architecture & Strategy | 12. Platform Integration & Interview Readiness | no |

The three conflicting primary references are scenario IDs 3, 5 and 6. Scenario 5's likely intended topic (T10) is a judgement from the topic's success criterion and the scenario outcome, not a documented author intent. The two unresolved secondary references (scenario IDs 18 and 12) have no unique candidate.
