# Azure: Foundry, AI Search & identity

**Course:** Agentic AI, from first principles to production · Module 11 Azure and Databricks · lesson 57 of 77 · **about 6 hours** · paper draft for review.  
**Success criterion:** Deploy a model and a simple agent in Foundry, and explain how identity, RBAC and tracing apply to it. Mark what you verified in the docs.

> Sources (read 2026-10-02 and 2026-10-03; details and gaps in docs/research/agentic-ai): Microsoft Learn 'What is Microsoft Foundry Agent Service?' (dated and updated 2026-09-25, read 2026-10-03: components; prompt, voice-based prompt and hosted agents; the Responses API for ephemeral agents; toolboxes behind a managed MCP-compatible endpoint; tool authentication options; the development lifecycle; agent identity, private networking, RBAC, content safety; publishing and the A2A protocol, v1.0 generally available and v0.3 in preview; the agent optimizer in preview); Microsoft Learn 'RAG and generative AI - Azure AI Search' (2026-08-04, updated 2026-09-17; lesson 27) and the Foundry 'Agent evaluators' page (2026-09-25; lesson 46); 'Managed identities for Azure resources', the Graph permissions page and 'What are agent identities?' (lesson 51); the Azure Architecture Center agent orchestration patterns page (lesson 43). NOTHING IN THIS LESSON WAS RUN ON AZURE OR DATABRICKS BY US: we have no accounts there and creating one is a step you must do yourself. Every platform statement is from the vendor page named, as read on the date given, and these products and their limits change quickly. Unverified: how any of it behaves in your tenant, region or quota; the exact RBAC role names and what each grants (the overview page links to them but we did not read them); preview features may change or be removed.

---

## Part 1 · The Azure agent stack at a glance

Microsoft's overview presents **Foundry Agent Service** as a managed platform for building, deploying and scaling agents, with a single entry point for model inference and tools. Its components, in the page's own list, and where each appears in this course:

| Component | What it does (per the page) | Course link |
|---|---|---|
| **Agent Runtime** | Hosts and scales prompt and hosted agents; manages conversations, tool calls and lifecycle | Lessons 21, 33 |
| **Toolboxes** | Curate tools once (web search, file search, code interpreter, MCP servers, custom functions) and expose them through one managed MCP-compatible endpoint with central authentication, governance and versioning | Lessons 38 to 40, 52 |
| **Models** | Many models from the Foundry catalog; swap without changing agent code | Lessons 7, 49 |
| **Observability** | Tracing, metrics, evaluations and Application Insights integration | Lessons 46, 47 |
| **Optimization** | An agent optimizer (preview) that proposes better instructions, tool descriptions and model choices | Lesson 46 (note: automatic changes still need your evaluation gate) |
| **Identity and security** | Microsoft Entra identity, RBAC, content filters, virtual-network isolation | Lessons 48, 51, 53 |
| **Publishing** | Versioning, stable endpoints, sharing through Teams, Copilot and the Entra Agent Registry | Lesson 53 |

Three ways to build, on a spectrum from declarative to full code:

- **Prompt agents:** you configure instructions, a model and tools; Foundry runs it. No code or infrastructure to manage. The page says this is the fastest path and suits internal tools and production agents that do not need custom orchestration.
- **Hosted agents:** you bring code (the page lists Agent Framework, LangGraph, the OpenAI Agents SDK, the Anthropic SDK and others, as a container image or a zip file) and Foundry runs it with a managed endpoint, scaling, a dedicated Entra identity, session state and observability.
- **The Responses API from your own code:** an 'ephemeral agent' whose definition lives in your app; you still use Foundry models, platform tools, project-scoped data, on-behalf-of authentication and project-level governance.

(Voice-based prompt agents also exist; the page marks voice and related monitoring features as preview.) The choice maps to lesson 36's question: how much do you want to own? A prompt agent owns the least and gives the least control; a hosted agent gives control and keeps your testing and safety logic in your code.

**Worked example**

Fictional. The DataOps agent has its own approval gate and tier logic (lessons 37 and 53). A prompt agent could not express them, so the team builds a hosted agent (their own loop, in a container) and uses Foundry for identity, scaling, tracing and the model, keeping the controls in their own code.

**Common mistake**

Choosing a prompt agent because it is easiest and then trying to bolt on approval logic with instructions. If the controls are in code, host the code.

**Check yourself.** Which agent type fits an agent that needs custom approval logic in code, and why not a prompt agent?

<details><summary>Model answer (write yours first)</summary>

A hosted agent (or the Responses API from your own code): your code runs the approval logic. A prompt agent is configuration only, so controls would be advice.

</details>

---

## Part 2 · Identity, RBAC, tools and tracing on Azure

The overview ties Foundry to the identity ideas of lesson 51:

- **Agent identity:** each agent can have a dedicated Microsoft Entra identity for scoped access to resources and APIs without sharing credentials. A hosted agent gets a dedicated identity automatically; the page says it can authenticate to external MCP servers and supports OAuth on-behalf-of passthrough when configured.
- **Tool authentication options** listed for MCP servers and other tool connections: key-based access, Entra using the agent's or the project's managed identity, OAuth identity passthrough (on-behalf-of), and unauthenticated access where appropriate. By lesson 40's reasoning, prefer the managed identity or on-behalf-of options and avoid shared keys.
- **RBAC:** fine-grained permissions through Entra and Azure RBAC control who can create, invoke and manage agents. The page links to the role details; read them before assigning anything, and give people the narrowest role (lesson 56).
- **Network isolation:** private networking for prompt agents, and bring-your-own virtual network for hosted agents, where each session runs in an isolated sandbox. This addresses data-residency and compliance needs (lesson 54).
- **Content safety:** integrated content filters and guardrails that, per the page, help mitigate prompt injection including cross-prompt injection. Treat these as one layer of lesson 48's defence, not the whole of it.
- **Tracing and evaluation:** end-to-end tracing of every model call and tool invocation, Application Insights integration, and built-in evaluators (lesson 46's Foundry page: system and process evaluators, with some in preview).
- **Versioning and publishing:** versions are snapshotted automatically, you can roll back, and published agents get a stable endpoint. The page also says Foundry supports the **A2A protocol** (v1.0 generally available, v0.3 in preview): the standard of lessons 41 and 42.

**AI Search** is the retrieval half (lesson 27): classic RAG with hybrid search and semantic ranking, or agentic retrieval, with document-level security trimming using Entra permission metadata for some sources (lessons 27 and 32). The Foundry page lists 'bring your own resources' (storage, Azure AI Search, Cosmos DB for conversation state) for compliance and operational needs.

**Worked example**

Fictional design sentence for the criterion: 'The hosted DataOps agent runs under its own Entra identity with Reader on the log store and write only to the queue; tools come from a toolbox behind an MCP endpoint using managed-identity auth; every call is traced to Application Insights; production writes need the approval gate in our code; we tested prompt-injection cases in CI.'

**Common mistake**

Assuming platform content filters replace your own controls. They help with some attacks; the approval gate, schemas and least privilege remain yours.

**Check yourself.** Give two tool-authentication options Foundry lists, and which you would prefer for an internal MCP tool and why.

<details><summary>Model answer (write yours first)</summary>

Key-based, Entra with managed identity, OAuth on-behalf-of, unauthenticated. For an internal tool prefer the managed identity or on-behalf-of: no shared key to leak, and access is tied to an identity you can audit and revoke.

</details>

---

## Part 3 · Your deploy exercise and what to mark as verified

The criterion: deploy a model and a simple agent in Foundry, explain how identity, RBAC and tracing apply, and mark what you verified in the docs. Because you will do the deployment yourself, here is a plan and an evidence template.

**Plan (budget and teardown from lesson 56 first):**

1. In the Foundry portal create a project in your course resource group.
2. Deploy the smallest suitable model from the catalog. Record the model, version, region and the date.
3. Create a **prompt agent** with instructions, that model and one tool. Chat with it in the playground. Then do the same through the SDK or REST API so the definition is in code.
4. Open its **trace** for one conversation: find the model call, the tool call and the token counts (lesson 47's questions).
5. Find the **identity** the agent uses and the **role assignments** on the project. Write down who can create, invoke and manage the agent.
6. Run two or three of your lesson 46 cases against it, including one injection case. Record the results.
7. Delete everything and check the cost next day.

**Evidence template, with a 'verified' column.** For every claim in your write-up give: the claim; the page and date; and one of **read** (you read it in the docs), **ran** (you observed it in your own tenant), or **not verified** (you could not check). Typical rows: 'agents can have a dedicated Entra identity' (read; ran if you saw it in the portal); 'content filters mitigate cross-prompt injection' (read; **not verified**: you would have to test it); 'A2A v1.0 is generally available' (read). The point of the column is that a design review can trust what you ran, and re-check what you only read.

**Worked example**

Fictional rows: 'Prompt agents need no code or infrastructure | overview page 2026-09-25 | read, then ran (created in portal, 12 minutes)'. 'Hosted agents get a dedicated identity automatically | same page | read only; not tested'. 'Tracing shows token counts | trace view | ran'.

**Common mistake**

Writing 'Foundry supports X' without saying whether you saw it. A reader cannot tell a verified fact from a brochure.

**Check yourself.** What are the three values for the 'verified' column and when do you use each?

<details><summary>Model answer (write yours first)</summary>

Read (in the documentation only), ran (observed in your own tenant) and not verified (could not check). It tells a reviewer what to trust and what to re-test.

</details>

---

## Do it: lab

1. Complete the lesson 56 budget and teardown steps before you start.
2. Deploy the smallest suitable model in Foundry in your course resource group. Record model, version, region and date, and the cost after one request.
3. Create a prompt agent in the portal, then define the same agent through the SDK or REST API. Add one tool.
4. Open a trace of one conversation and annotate the model call, tool call and token counts. Find the agent's identity and the role assignments on the project.
5. Write the explanation of how identity, RBAC and tracing apply to this agent (one page), with a verified column (read, ran, not verified) and the page and date for each claim.
6. Run three of your evaluation cases, including one injection case, and report results. Delete everything and check the cost next day.

**Done when:** you have deployed a model and a simple agent in Foundry, annotated a trace, identified the agent's identity and role assignments, written the one-page explanation with every claim marked read, ran or not verified, and torn the resources down.

---

## Interview check

**Question.** How are agents built and governed on Azure?

<details><summary>A strong answer has this shape</summary>

1. Foundry Agent Service as the managed runtime: prompt agents for configuration-only needs, hosted agents when we need our own code and controls, or the Responses API from our app, with models from the catalog and tools through toolboxes.
2. Identity: a dedicated Entra identity per agent, scoped RBAC, managed identity or on-behalf-of for tool access, no shared keys.
3. Retrieval through AI Search with security trimming from Entra permission metadata where supported.
4. Safety and operations: content filters as one layer, our own approval gates and schemas, private networking where needed, tracing and evaluators in CI.
5. I would state which of these I verified in our tenant and which I only read, because preview features and limits change.

</details>

---

## Evidence to keep

Keep the deployment record, the annotated trace, the identity and role notes, the evaluation results, the verified-column write-up and the cost evidence.

---
