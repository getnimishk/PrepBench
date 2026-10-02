# Notes for modules 5 to 11 (waves 3 and 4)

Read and run 2026-10-02 to 2026-10-03. Companion to `phase-2-4-notes.md`. Most pages were read through page summaries; where we say "in full" the page text itself was read.

## Sources by module (all dated in the lessons)

- **5 RAG:** Anthropic Contextual Retrieval (2024-09-19); Microsoft Learn Azure AI Search RAG overview, chunking, hybrid search and RRF pages (2026); Databricks AI Search and index pages (2026-09-14); Lewis et al. arXiv 2005.11401; Liu et al. arXiv 2307.03172; Ragas metrics; OpenAI "Optimizing LLM accuracy".
- **6 Real agents:** LangGraph persistence and overview; Microsoft Agent Framework conversations; Anthropic memory tool and Agent Skills pages; OpenAI Agents SDK and Claude Agent SDK overviews; SDLC Playbook lessons.
- **7 MCP and A2A:** MCP specification 2026-07-28 (overview, tools, authorization and security best practices read in full); A2A 1.0.0 specification through summaries; MCP Python SDK 2.2.0 and a2a-sdk 1.2.1 installed and run.
- **8 Multi-agent:** Microsoft AI agent orchestration patterns (read in full); Anthropic multi-agent research system (2025-06-13).
- **9 Evaluation and production:** Anthropic "Demystifying evals for AI agents" (2026-01-09); Foundry agent evaluators (read in full); MLflow GenAI; OpenTelemetry GenAI registry; OWASP LLM01; Azure circuit breaker pattern (read in full); Anthropic pricing (read in full).
- **10 Security and governance:** Microsoft managed identities, Graph permissions and On-Behalf-Of (read in full), Entra agent identities; Databricks service principals and agent tools; MCP Registry; European Commission AI Act page (2026-08-03); PIB "DPDP Rules, 2025 Notified" (read in full); Anthropic "Reduce hallucinations".
- **11 Azure and Databricks:** Azure free account, Cost Management budgets (read in full), Foundry Agent Service overview (read in full), Databricks Free Edition, budgets, Agent Bricks, MLflow GenAI.

## Verified by running

- RAG: 8 tests; stage metrics (retrieval 19 of 22, answers 15 of 22, abstentions 3 of 3); chunk-size sweep; hybrid RRF arithmetic.
- DataOps agent folder: 58 tests. Checkpoint and resume including the write-then-crash window; tier limits; memory rules; skills linter; 25-case evaluation with seeded variation and a CI gate (exit codes 0 and 1); tracing (before 24.19 s and 42,898 input tokens, after 3.59 s and 1,495, with simulated time); injection demo with an obedient stand-in; cost model; outage simulation; identity linter; registry and governance checks.
- MCP server and client over stdio with the SDK, plus a captured wire log; a stray print on stdout reached the client as a parse error in its log while the SDK carried on.
- A2A: SDK server, httpx client, JSON checked against the SDK's protobuf types, version-header and error behaviour, 7 tests.
- LangGraph 1.2.12: checkpoint, interrupt and resume from a new process on the same SQLite file; an interrupted step runs again from its start.
- Multi-agent: handoff packet, loop guards, routing confusion, separation of duties with a digest, 12 tests.

## Not run

- Any real model call (no key). Every number from a scripted model describes the harness, not a model.
- Anything on Azure or Databricks (no accounts). Lessons 56 to 59 are reading and guidance, with a "read, ran, not verified" convention for your own work.
- MCP over HTTP (the server closed connections without replying in our Windows environment; not diagnosed).
- A2A streaming, push notifications, gRPC and REST bindings.

## Where a summary and a running system disagreed

- A page summary of the A2A specification suggested the SendMessage result was a bare Task; the SDK server wraps it as `{"task": ...}`. We use what ran.
- The Indian DPDP Rules: the PIB document says notified 14 November 2025; a secondary search result said 13 November and gave 13 May 2027 as the end of the phase. Check the Rules.

## Vendor facts that go stale

Prices and cache multipliers (pricing page, 2026-10-02); model names; Foundry preview evaluators and features; Agent Bricks Beta features and the Supervisor naming; OpenTelemetry attributes marked Development; the EU AI Act dates (amended in 2026); Entra Agent ID licensing; Databricks AI Search naming; the A2A and MCP versions.

## Claims to treat with care

- Anthropic's multi-agent figures (90.2 percent, about 15 times tokens) and contextual-retrieval percentages are their own, on their data.
- Our cost model and outage simulation are models with stated assumptions; the break-even (Haiku needing Sonnet's success rate) follows from assumed success rates and a $15 cost per escalated task.
- The evaluation intervals treat trials as independent; they are not (case difficulty is shared).
- The regulatory sections are not legal advice; rows marked LEGAL need a lawyer.

## Known gaps

No outside review of waves 2 to 4 yet, no owner review, and nothing rendered in the app or loaded into it. Waves 5 (modules 12 to 14) are not written. The MCP HTTP failure is undiagnosed. The Databricks budget feature in Free Edition is unconfirmed.
