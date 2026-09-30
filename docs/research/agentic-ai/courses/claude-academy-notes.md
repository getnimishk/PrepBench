# Claude Academy courses · notes for the Agentic AI roadmap

**Read:** 2026-09-30 · **Source:** https://academy.claude.com/courses (public catalogue; a login only saves progress) ·
**Purpose:** see what the courses could add to our own learning before deciding whether to use them · **Status:** notes only;
nothing here is in a lesson or the roadmap yet.

Everything below is paraphrased from each page. The pages were read through a summarising tool, so wording and small figures
should be checked against the page before quoting. These are **Anthropic's own courses**, so they are one vendor's view and use
Claude in the exercises (any model works). Video transcripts are not reproduced here.

---

## 1. AI Fluency: Framework and Foundations (14 lessons, about 5 h by the page timings)

Base URL: `/courses/ai-fluency-framework-foundations/`. All 14 pages were read. It is about **how people work with AI**, not how the
technology works or how to build with it.

| # | Lesson | Time | Main idea |
|---|---|---|---|
| 1 | Introduction to AI Fluency | 15 min | AI fluency = working with AI in ways that are effective, efficient, ethical and safe; the four skills ("4Ds") |
| 2 | Why do we need AI Fluency? | 27 min | Three modes: **automation** (AI runs a defined task), **augmentation** (human and AI as partners), **agency** (you set the rules and AI works autonomously) |
| 3 | The 4D Framework | 5 min | The 4Ds apply across all three modes |
| 4 | Generative AI fundamentals | 46 min | Transformers, pre-training, fine-tuning, context windows, emergent abilities |
| 5 | Capabilities and limitations | 59 min | Knowledge cutoff, hallucination, context limits, weak complex reasoning |
| 6 | A closer look at Delegation | 20 min | Problem awareness, platform awareness, task delegation |
| 7 | Project planning and Delegation | 3 min | Pick a real project, set goals, split tasks between you and the AI |
| 8 | A closer look at Description | 15 min | Product, process and performance description; "bad prompt makeover" exercise |
| 9 | Effective prompting techniques | 15 min | Six techniques: context, examples, constraints, step by step, room to think, role or tone |
| 10 | A closer look at Discernment | 20 min | Judge the product, the process and the performance |
| 11 | The Description-Discernment loop | 10 min | Describe, evaluate, refine, integrate your own expertise |
| 12 | A closer look at Diligence | 20 min | Creation, transparency and deployment diligence; write a diligence statement |
| 13 | Conclusion | 30 min | Skill comes from deliberate practice |
| 14 | Course quiz | about 8 min | 10 questions, 80% to pass, shareable completion badge |

**The 4Ds:** Delegation (what do I do, what does the AI do), Description (say clearly what I want), Discernment (judge what came back),
Diligence (own the outcome and be open about AI's part).

---

## 2. AI Capabilities and Limitations (13 lessons and a quiz, about 3.6 h)

Base URL: `/courses/ai-capabilities-and-limitations/`. All pages read. **Best fit for our engineering path**: it builds a mental model of
*why* an LLM fails, which is the skill agent debugging and evaluation rely on. It is the machine-side companion to the 4Ds.

**Its framework: four properties of generative AI**, each a continuum, not an on/off switch:
1. **Next-token prediction** (fluency, and also where fabrication comes from)
2. **Knowledge** (what training gave it, up to a hard cutoff)
3. **Working memory** (the context window)
4. **Steerability** (how well it follows instructions)

The course's claim is that these properties stay stable as models improve, even though the boundaries move.

| # | Lesson | Time | Main idea |
|---|---|---|---|
| 1 | Intro | 15 min | The four properties complement the 4Ds; inventory 4 to 6 of your own AI tasks |
| 2 | What we mean by AI | 15 min | Generative models create content; spam filters and recommenders classify or rank. "Calibrated trust": place each task on each property |
| 3 | How AI gets its character | 20 min | Two stages: pre-training (a text predictor) then fine-tuning (assistant behaviour). Human judgments leave "fingerprints": too agreeable, too wordy, over-cautious, confidence that does not track accuracy |
| 4 | Next-token prediction | 20 min | The same process gives fluency and hallucination. Risk concentrates in specifics: names, dates, statistics, URLs, quotes. Mitigations: citations, uncertainty signals, constrained generation, verification loops |
| 5 | Try it: next-token prediction | 5 min | **Page content did not load** (dynamic) |
| 6 | Knowledge | 25 min | Hard cutoff. Four failure modes: **staleness**, **uneven coverage**, **inherited bias**, **source amnesia**. Mitigations: web search, RAG, tools |
| 7 | Try it: knowledge | 5 min | **Page content did not load** |
| 8 | Working memory | 25 min | The context window is a fixed box; it fails abruptly, not gradually. **Lost in the middle**. No learning between sessions. Product fixes: memory, compaction, projects, bigger windows, multi-agent systems |
| 9 | Try it: working memory | 10 min | A recall game showing edge-of-list items are remembered best. The page states accuracy drops by over 30% when a key fact sits in the middle of a long context: **a course claim, to be checked against its source before we use the number** |
| 10 | Steerability | 25 min | Instruction-following is pattern matching. Tight for short, concrete, checkable instructions; loose for long reasoning. Failures: **reasoning drift** (an early error compounds) and **letter over spirit**. Fixes: system prompts, code execution, structured outputs, mid-process checkpoints, state the goal, not just the instruction |
| 11 | Try it: steerability | 5 min | **Page content did not load** |
| 12 | When properties collide | 20 min | Most real failures are **two properties meeting**. Next-token prediction plus knowledge gives fabricated specifics and citations; working memory plus steerability gives drift in long chats. Name the pair and it points at the fix |
| 13 | Next steps | 15 min | Build "a small, clear model of the machine"; match your verification to where the task sits on each property |
| 14 | Course quiz | 8 min | 1 quiz; the page did not give the question count or pass mark |

---

## 3. Other courses, outline only (lesson lists read; lesson content not read)

- **Introduction to MCP** (1 h, 10 lessons + quiz): builds MCP servers and clients with the Python SDK. Lessons: Introducing MCP;
  MCP clients; Defining tools; The server inspector; Implementing a client; Defining resources; Accessing resources; Defining prompts;
  Prompts in the client; final assessment and review.
- **MCP: Advanced Topics** (1.5 h, 11 lessons + quiz): for engineers building production servers. Sampling, log and progress
  notifications, roots (each with a walkthrough); JSON message types; the STDIO transport; the StreamableHTTP transport, in depth, and
  its state handling. *Note:* the MCP 2026-07-28 specification deprecates Roots, Sampling and Logging (see the phase-1 notes,
  section 9), so parts of this course may be behind the current spec. Check before relying on it.
- **Introduction to Subagents** (45 min, 4 lessons): what subagents are; creating one; designing effective ones with structured
  outputs; using them effectively and avoiding common pitfalls. Uses Claude Code's `/agents` command.
- **Introduction to Agent Skills** (1 h, 6 lessons): skills in Claude Code (reusable markdown instructions). What skills are; first
  skill; configuration and multi-file skills; skills vs other Claude Code features; sharing; troubleshooting. Claude Code specific.

**Not read at all:** Building with the Claude API (67 lessons), Building Effective Human-Agent Teams, Deploying Claude Enterprise
with Confidence, the Bedrock and Vertex courses, and every course's lesson content for the MCP, Subagents and Skills courses.

---

## 4. The AI-native SDLC Playbook (14 lessons, 1 h; all 14 pages read)

Base URL: `/courses/ai-native-sdlc-playbook/`. **Audience is not a beginner:** engineering, platform and security leads at large
enterprises using Claude Code, whose approval gates and reviews "still run at human speed". Prerequisites are comfort with Claude Code and
a Git repository with a CI pipeline you can change. It is Claude Code specific, and the lessons are short (2 to 45 minutes, most under 10).

**Core argument:** when agents write most of the code, building is no longer the slow part. Review, testing and deployment become the
bottleneck, so the lifecycle turns from linear hand-offs into a continuous loop, with committed markdown files as both human-readable
requirements and machine-usable instructions. Human accountability stays; human attention moves to flagged issues, intent and risk.

Six stages, each with a **leading** and a **lagging** measure and a named governance control:

| Stage | Lessons | What it says |
|---|---|---|
| Plan | Capture as `intent.md` (24 min) | Idea to proto-spec in hours through a guided conversation instead of backlog refinement: problem, outcome, affected systems, constraints, open questions. A product owner validates intent. Kept in Git for traceability |
| Design | Requirements and design (34 min) | Requirements and design compressed into one session; organisation-wide policy "skills" constrain the spec and flag conflicts early; product owner reviews `spec.md`; human approval gates the build |
| Build | Plan mode (45 min) | Start in read-only plan mode; commit the approved `plan.md` (files, steps, risks, proof of completion); routine changes need an engineer, riskier ones a tech lead or architect |
| Build | The CLAUDE.md (5 min) | A short, version-controlled file of conventions, commands, architecture and "things it gets wrong", changed by pull request |
| Build | Skills as institutional knowledge (4 min) | Versioned trigger-based policy files. **Advisory, not enforcement**: back any must-comply rule with a deterministic hook |
| Build | Parallel sessions and subagents (4 min) | Several sessions in separate Git worktrees; subagents are scoped helpers with their own context and tool limits |
| Test | Give Claude a feedback loop (4 min) | Always give the agent a way to verify its own work; a verifier subagent checks once in a fresh context; block agents from editing the tests during a fix |
| Test | Continuous evals in CI (9 min) | Evals as the AI-native equivalent of stage-gate QA: 20 to 50 real tasks with expected outcomes, gate config merges on pass rate, every production incident becomes a permanent regression test |
| Deploy | AI in the PR review loop (4 min) | First-pass review in minutes against a `REVIEW.md`; the agent cannot approve its own work; findings feed back into CLAUDE.md |
| Deploy | Hooks as approval gates (5 min) | Scripts that allow, block or ask for approval before an action; non-negotiable controls live in administrator-managed settings that developers cannot change |
| Deploy | CI/CD integration (4 min) | Read-only judgement tasks first; sandboxed jobs with short-lived tokens and no standing production credentials; deployment exposed as scoped tools; tiered autonomy by environment; "the agent may act up to the production gate and cannot pass it"; rehearse rollback |
| Maintain | Closing the loop on metrics (6 min) | Deterministic detection (statistical bands at 1, 2 and 3 sigma), then tiered responses: log, read-only diagnosis, proposed fix; findings enter the same review gates through an `intent.md` |
| Closing | Closing thoughts (2 min) | Suggested order for platform teams: org setup, managed settings, permissions and sandboxing, hooks and skills, enterprise deployment, monitoring and compliance |

Each lesson also gives a template (`intent.md`, `spec.md`, `plan.md`, a CLAUDE.md verification block, a skill file, `REVIEW.md`, a
CI workflow, a `bands.yaml`). Those are the course's own; ours would be written fresh.

**Caution on claims:** statements like "weeks to hours" are the course's own assertions, not measurements, and several are prescriptive
(what to do) rather than evidence (what was found). It is written by Anthropic's applied AI team from customer work.

---

## 5. Gaps in what I could read

- Lessons 5, 7 and 11 of the Capabilities course are "Try it out" pages whose content loads dynamically and was not returned.
- Transcripts exist for most lessons but were not requested; only Lesson 1 of AI Fluency has one (pasted by the user).
- Quiz question counts and pass marks are missing for the Capabilities course.
- All figures (durations, counts, the 30% claim) are the courses' own and unchecked.
