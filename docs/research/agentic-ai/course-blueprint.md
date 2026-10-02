# Agentic AI course · review and blueprint

**Written:** 2026-09-30 · **Status:** proposal for the user to approve. Nothing here has been imported into PrepBench.
**Inputs:** the imported roadmap (`Agentic_AI_Mastery_Roadmap.xlsx`, 14 phases, 70 topics, 323 hours), the Phase 1 lessons already
written, the ChatGPT review, and the Claude Academy notes (`courses/claude-academy-notes.md`).

---

## 1. Review of the plan

**What is sound**
- Every topic has an objective and a checkable success criterion. The 29 topics of the original roadmap all have a home.
- Evaluation basics arrive early (Phase 3), before the first RAG and agent builds.
- Python is treated as a real skill, and the portfolio is now data-platform shaped.

**Problems found**

| # | Finding | Why it matters | Fix |
|---|---|---|---|
| P1 | **A forward dependency.** The DataOps agent build (topic 32, 16 h, Phase 6) requires human approval, an audit log and idempotent actions. Identity, permissions and human oversight only arrive in Phase 10 (topics 46 to 49). | The learner has to build the hard part before being taught it | Add a short "safe actions" topic in Phase 4 (read-only first, least privilege, approval gates); Phase 10 then deepens it |
| P2 | **Interview practice sits at the end** (Phase 14, 38 h). | Interview skill is learned late and all at once | Keep Phase 14, but end every lesson with an interview check (the Chapter 1 format already does) |
| P3 | **Failure diagnosis is thin.** Hallucination classification exists (topic 49) but there is no general method for *why* a model failed. | Debugging an agent is mostly diagnosis | Add a diagnosis topic (see section 3) |
| P4 | **Model knowledge is under-taught.** Cutoff dates, uneven coverage, inherited bias and not knowing where a fact came from are not named anywhere. | It is the reason RAG exists | Add "Knowledge and its limits" to Phase 1 |
| P5 | **Delivery-side agent governance is missing.** Approval gates, separation of duties, tiered autonomy, evals as merge gates and leading/lagging measures are not in Phase 10 or 12. | These are exactly what program and delivery roles are asked about | Add two topics (see section 3) |
| P6 | **MCP scope may be behind the spec.** The MCP 2026-07-28 specification deprecates Roots, Sampling and Logging, and hardens authorization. | We must not spend hours on deprecated features | Base topics 33 to 35 on the current spec; treat the Advanced MCP course as background only |
| P7 | Hours are per topic, not per activity. 2 h for "What AI, ML and LLMs are" hides reading, drawing and recording time. | Underestimates for a beginner | Keep as is for now; re-estimate after the Phase 1 pilot with real timings |

## 2. Review of the courses we fetched

| Course | Read | Fit | Verdict |
|---|---|---|---|
| AI Capabilities and Limitations (3.6 h) | all lessons except three "try it" pages | **High** for Phases 1, 3, 9 | Adds the four-properties model and failure-diagnosis method. Use as a second source and a self-check |
| AI Fluency: Framework and Foundations (about 5 h) | all 14 pages | Medium | Adds automation/augmentation/agency vocabulary and the 4D review. Human-side, not builder-side |
| AI-native SDLC Playbook (1 h) | all 14 pages | **High** for Phases 9, 10, 12 | Governance of agent work: gates, tiered autonomy, evals in CI, metrics. Claude Code specific, aimed at experienced leads |
| Intro to MCP, MCP Advanced, Subagents, Agent Skills | outlines only | Medium | Read the lessons before deciding. Parts of MCP Advanced cover deprecated features |
| Building with the Claude API (9 h, 67 lessons) | not read | Probably high for Phases 2 to 4 | Read the outline first |
| Human-Agent Teams, Enterprise deployment, Bedrock, Vertex | not read | Unknown | Decide after the outlines |

**How we use them:** as a *second source* for our own lessons (cited, dated), as optional external reading per topic, and as
self-check quizzes. We do not copy their lessons, and every vendor claim in our lessons stays labelled as vendor-specific.

## 3. Proposed changes to the roadmap (roadmap v8)

**Recommended additions, 14 hours:**

| New topic | Phase | Hours | Source it draws on |
|---|---|---|---|
| Knowledge and Its Limits (cutoff, four failure modes, what fixes them) | 1 | 2 | Capabilities course lesson 6 |
| Diagnosing Model Failures (name the two properties that collided) | 3 | 3 | Capabilities course lessons 4, 6, 8, 10, 12 |
| Safe Actions: Read-Only First, Least Privilege, Approval Gates | 4 | 3 | SDLC lessons 8, 11, 12; our own governance notes |
| Governing Agent Actions: Gates, Separation of Duties, Tiered Autonomy | 10 | 3 | SDLC lessons 5 to 12 |
| Agentic Delivery for Program Leaders: Intent, Spec, Plan, Review, Metrics | 12 | 3 | SDLC lessons 2 to 4, 10, 13; AI Fluency Delegation |

That takes the roadmap from 323 h to **337 h** (about 42 weeks at 8 h a week).

**Optional additions, 5 hours:** "Working with AI on purpose: the 4Ds" (2 h, Phase 1); "Reusable instructions and skills" (2 h,
Phase 6, vendor-specific idea); one extra hour on Agent Evaluation for evals in CI and turning incidents into regression tests.

**Changes to existing topics (no extra hours):**
- How LLMs Work: add how fine-tuning shapes behaviour (agreeableness, wordiness, over-caution, confidence that does not track accuracy).
- Prompting, Structured Outputs, Reasoning Models: add reasoning drift and "letter over spirit" failures, and the fix of stating the goal.
- Workflows vs Agents: add automation, augmentation and agency as the three modes.
- Agent Evaluation: score the process (steps and tool choices), not only the product.
- DataOps agent build: use the SDLC Stage 6 pattern (deterministic detection, then tiered responses at 1, 2 and 3 sigma).
- Every build: finish with the 4D review (Delegation, Description, Discernment, Diligence) as the evidence page.

## 4. The course

**Working title:** *Agentic AI, from first principles to production: for product, program and platform leaders.*

**Shape:** 14 modules (the phases), about 75 lessons after the additions, plus a capstone (the two portfolio builds and the case studies).

**Every lesson is a chapter with the same parts** (this is the Chapter 1 format, which the user liked):
1. Why this matters (one paragraph, plain words)
2. Core ideas, each tied to a cited, dated source
3. Figures (Mermaid for flows, SVG for anything else)
4. A worked example (fictional, labelled)
5. What people get wrong
6. Do it: a lab with a checkable finish line
7. Check yourself: questions with model answers
8. Interview check: one question and a model answer
9. Evidence to keep (for the case studies)
10. For builds: the 4D review
11. Sources, with the date read and anything unverified

**Where it lives:** files in `docs/research/agentic-ai/` (reviewed through pull requests) and the same text in PrepBench's topic guides,
loaded through the existing API once figure support is merged (PR #45).

**Quality gates for every wave:** sources read and dated; claims traced; anything unverified left out or labelled; vendor-specific facts
marked; arithmetic computed in code; diagrams validated by the real renderer; an outside review (ChatGPT or Gemini) of the wave; the user
reads a sample before the next wave starts.

## 5. Source map (what we will read for each module)

| Module | Already have | Still to read |
|---|---|---|
| 1 Foundations | Google ML intro, arXiv 1706.03762, Hugging Face ch. 1 and 2, Anthropic context, tokens and models pages, OpenAI embeddings, Foundry and Databricks model pages; Capabilities course; AI Fluency lessons 4 and 5 | fine-tuning behaviour (a primary source), knowledge-cutoff primary docs, the "lost in the middle" paper behind the 30% figure |
| 2 Toolkit | none | Python tutorial, packaging docs, Pydantic, pytest, asyncio and httpx docs, provider quickstart |
| 3 Prompting and evals | AI Fluency lessons 8 to 11; Capabilities lessons 10 and 12 | provider prompting and structured-output docs, reasoning-model docs, an evaluation source |
| 4 Agent core | AI Fluency lessons 2, 3, 6, 7; SDLC lessons 8, 11 | "Building effective agents", tool-use docs, Microsoft Agent Framework "agent vs workflow" |
| 5 RAG | notes on embeddings; Capabilities lesson 6 | RAG docs, Azure AI Search, Databricks Vector Search |
| 6 Real agents | SDLC lessons 5 to 7; Subagents and Skills outlines | LangGraph persistence, Microsoft Agent Framework sessions, memory docs |
| 7 MCP and A2A | MCP 2026-07-28 blog, A2A 1.0.0 page, MCP course outlines | the MCP specification itself, the A2A specification, MCP authorization |
| 8 Multi-agent | Subagents outline; SDLC lesson 7 | orchestration patterns sources |
| 9 Evaluation and production | SDLC lessons 8 to 9; Capabilities lesson 12 | Foundry agent evaluators, MLflow evaluation, prompt-injection sources (OWASP), tracing docs |
| 10 Security and governance | SDLC lessons 5 to 12; AI Fluency lesson 12 | Azure identity and RBAC, Unity Catalog permissions, OAuth, EU AI Act and DPDP Act texts |
| 11 Azure and Databricks | Foundry and Databricks overview pages; Supervisor API deprecation | Agent Service docs, Agent Bricks docs, Unity Catalog and Vector Search docs |
| 12 Product and program | SDLC lessons 2 to 4, 13; AI Fluency lessons 6 and 12 | product discovery and program management sources (to choose) |
| 13 and 14 | our own builds | interview banks (to choose) |

## 6. Delivery in waves

| Wave | Content | Output |
|---|---|---|
| 1 | Module 1 (7 lessons, one new) revised with the courses | chapter-format lessons, figures, notes, loaded into the app |
| 2 | Modules 2 to 4 (about 15 lessons) | Python, prompting and evaluation, agent core, safe actions |
| 3 | Modules 5 to 8 (RAG, real agents, MCP and A2A, multi-agent) | |
| 4 | Modules 9 to 11 (evaluation, governance, Azure and Databricks) | |
| 5 | Modules 12 to 14 (product and program, portfolio, interviews) | |

Each wave is a pull request of files, then an in-app load after the user's review. About 15 to 20 lessons per wave is realistic
because each needs primary sources read, not remembered.

## 7. Decisions needed

1. Approve the five recommended additions (section 3)? Optional ones?
2. Keep the current roadmap in the app and add the new lessons as guides only, or re-import a v8 roadmap?
3. Should wave 1 be Module 1 only, as proposed?

---

## 8. Status (2026-09-30)

**Decisions taken by the user:** all eight additions (the five recommended plus the three optional, +19 h); re-import a v8 roadmap;
wave 1 is Module 1 only.

**Done**
- **Roadmap v8 built:** `Agentic_AI_Mastery_Roadmap_v8.xlsx` in Downloads. 77 topics, 342 hours (about 43 weeks at 8 h a week), a new
  "Suggested Courses" table, nine new glossary terms, and edits to eight existing topics. **Not yet imported.**
- **Wave 1 written:** eight Module 1 lessons (20 h, matching v8) in `lessons/`, each as a Markdown file and a `.guide.json` for the app, in
  the full chapter format (concept parts, lab, interview check, evidence to keep, sources). Two are new (Knowledge and its limits; Working
  with AI on purpose). Six were upgraded with the course material and three new papers.
- **Checked:** every Mermaid diagram (5 in total) parses in the real Mermaid library and has a title and description; every bundled image
  exists and has alt text; no unbalanced code fences; all arithmetic computed in code.

**Not done**
- The lessons have not been **rendered in the app** in this session: the shared checkout was on another session's branch with unfinished
  Playwright changes, so no browser run was started. The same components rendered flowcharts, sequence and state diagrams correctly earlier.
- Nothing is **loaded into PrepBench**; that waits for the v8 import.
- Nothing is **committed**. Wave 1 should go in as a documentation pull request from a clean worktree of `origin/main`.
- Lessons were **not yet reviewed by an outside model** or by the user.

## 9. Outside review of wave 1 (ChatGPT, 2026-10-02) and what was done

The reviewer had no web access and flagged vendor facts as unverified. Findings were checked against the sources before any change.

**Applied** (about 30 edits across lessons 1, 2, 4, 5, 6, 7, 8, in both the Markdown and the guide JSON):
- Absolute statements softened: the LLM core is next-token prediction (applications add more); "most widely used", not "almost every", LLM is a transformer; sycophancy is linked to, not proven caused by, human feedback; a model generally cannot reliably give provenance; self-hosting does not by itself give privacy; the price ladder is a common pattern, not a law.
- Vendor-specific behaviour labelled as such (Anthropic's context overflow behaviour, claude.ai window handling, server-side compaction, the Foundry model count).
- The embeddings lab now gives one concrete path (request shape, where the vector is, key handling, a free local option). The position test is repeated three times. "Invented" is replaced by "unsupported" with a source-first rule. Lesson 8 has a strong/middle/weak rule of thumb and "process" now means observable steps, not hidden reasoning.
- Interview checks for lessons 4, 5, 6 and 7 gained delivery-side follow-ups: measurement, access control, cost and latency limits, authoritative source, service levels, lock-in, data residency and migration. The ML-families grouping is labelled as Google's practical map.

**Not applied, with reasons**
- Blockers F-01 and F-02 (model names and prices unverifiable): these were read from the vendors' own pages on 2026-09-29 and are dated in the lesson; the reviewer simply did not know the models. The lesson already says names and prices will have moved. A separate dated snapshot appendix is a reasonable later change.
- F-34 (vendor advice prominent), F-36 to F-40 (framework attribution): the lessons already attribute these to the course ("the course says", "the course calls").
- T-05 (drop the BLEU figures) and F-23 and F-24 (arithmetic, confirmed correct): kept.
- C-01, C-02, C-05 to C-09 and the remaining interview-fit suggestions: small or later-wave items, not needed now.

## 10. Wave 2 status (2026-10-02)

Seventeen lessons written for Modules 2 to 4 (topics 9 to 25, 58 hours), in files and as in-app guide JSON, with the reference code they quote in `reference-code/` and the source notes in `phase-2-4-notes.md`. Code was run, statistics computed, diagrams parsed. Not yet done: in-app load, rendering check, outside review, owner review. Module 1 lesson headers now say "of 77" to match.

## 11. Waves 3 and 4 status (2026-10-03)

Thirty-four lessons written for Modules 5 to 11 (topics 26 to 59, 175 hours): RAG and data (27 h), real agents (29 h), MCP and A2A (18 h), multi-agent (17 h), evaluation and production (24 h), security and governance (20 h), Azure and Databricks (20 h). Files and in-app guide JSON, with reference code in `reference-code/` and sources, run and not-run lists in `phase-5-11-notes.md`. Code was run and tested (RAG 8, DataOps agent 58, MCP 4, A2A 7, multi-agent 12 tests); all 14 new diagrams parse. Lessons 56 to 59 are guidance (no cloud accounts were available). Not done: outside review, owner review, in-app load and render check. Wave 5 (Modules 12 to 14) is not started.
