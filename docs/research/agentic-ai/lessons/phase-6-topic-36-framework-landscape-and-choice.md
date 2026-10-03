# Framework landscape & choice

**Course:** Agentic AI, from first principles to production · Module 6 Real Agents · lesson 36 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Implement the same minimal tool-using agent in your chosen framework and compare it with two alternatives on state, tool calling, observability, deployment, testing and provider portability.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Vendor documentation read 2026-10-02 through page summaries: LangGraph 'Overview' (a low-level orchestration framework and runtime for long-running, stateful agents; durable execution, human-in-the-loop, memory; `pip install -U langgraph`) and 'Persistence'; Microsoft Learn 'Microsoft Agent Framework overview' (page dated 2026-07-29, updated 2026-08-25, read in wave 2) and 'Conversations & Memory' (2026-05-28); OpenAI Agents SDK documentation home page (agents, handoffs, guardrails, sessions, tracing; `pip install openai-agents`; Responses API by default); Claude Agent SDK overview (Python and TypeScript; built-in tools, hooks, subagents, MCP, permissions, sessions; a library that runs the Claude Code binary); the roadmap's own Framework Comparison tab (its verification column, dated 2026-09-29). We installed and ran LangGraph 1.2.12 (with langgraph-checkpoint-sqlite 3.1.1) for the comparison below; we also installed and ran langchain-core 1.6.6 and langchain 1.4.3 for the RAG comparison below (2026-10-03); we installed and ran no other framework. The reference code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1 against a scripted stand-in for the model; the folder's tests passed (58 in all, covering lessons 33 to 55; 16 of them cover the state, memory and skills code). It uses the same message shapes as Anthropic's documented Messages API but has not been run against a real model (no key). Unverified: every claim about popularity, job-market demand or production maturity (we removed them from the roadmap earlier and add none here); PydanticAI, CrewAI, Spring AI, LangChain4j and Databricks Agent Bricks were not read in this wave; the OpenAI Agents SDK page does not state exactly which non-OpenAI providers work.

---

## Part 1 · The landscape at a glance

There are many agent frameworks and they change fast. This table lists **what each is, in its own docs**, and what we verified. It is not a ranking.

| Framework | What its documentation says it is | Languages (per docs) | What we verified |
|---|---|---|---|
| **LangGraph** | A low-level orchestration framework and runtime for building, managing and deploying long-running, stateful agents; graph of nodes with checkpointing, human-in-the-loop and memory | Python (the roadmap notes JavaScript too) | Docs read; **installed and ran** 1.2.12: checkpoint, interrupt, resume |
| **Microsoft Agent Framework** | Open-source SDK for agents and workflows (graph-based orchestration, sessions, context providers); the Azure Architecture Center lists its built-in sequential, concurrent, group-chat, handoff and magentic orchestrations | .NET, Python and Go (Go in preview, per the roadmap tab) | Docs read (wave 2 and now); not run |
| **OpenAI Agents SDK** | Agents with instructions and tools in a built-in loop; handoffs; guardrails; sessions; tracing | Python (`openai-agents`) | Docs home read; not run. Uses OpenAI's Responses API by default; the page refers to non-OpenAI providers without listing them |
| **Claude Agent SDK** | Claude Code's agent loop, built-in tools and context management as a library; hooks, subagents, MCP, permissions, sessions | Python and TypeScript | Docs read; not run. It runs the Claude Code binary |
| **Databricks Agent Bricks** | Databricks' managed agent products (the roadmap notes a Supervisor API deprecation) | Python and notebooks | Roadmap tab only: partly verified |
| **PydanticAI, CrewAI** | Typed-output agents; role-based multi-agent crews | Python | Not read |
| **Spring AI, LangChain4j** | Java libraries for LLM calls, RAG and agents | Java | Not read |

There is also the option our own lessons used: **no framework**, a loop you write (lesson 21, about 60 lines) around a provider's SDK. It is a legitimate choice, and the baseline against which each framework should justify itself.

Be careful with the table's limits: vendor pages describe their own product in their own words, and 'verified' here means 'we read the page and, for LangGraph, ran a small program', not 'we evaluated it in production'. The roadmap's earlier popularity and job-market claims were removed because they could not be verified, and we do not restore them.

**Worked example**

Fictional. A team of Java engineers on Azure asks 'which framework?'. Reading the table, the questions that matter are: which languages does the team write, which cloud and model provider does it already use, how much control over flow does it need, and how will it test and deploy? The answers differ for each team, which is why the lab has you compare on criteria.

**Common mistake**

Choosing from a popularity list. Popularity tells you how many tutorials exist, not whether the framework fits your state, testing and deployment needs.

**Check yourself.** Which option in the table is not a framework at all, and why is it always worth considering?

<details><summary>Model answer (write yours first)</summary>

Writing the loop yourself around a provider SDK. It has no dependency risk and full control, so a framework has to show it saves more than it costs.

</details>

---

## Part 2 · Six criteria that matter

The lab compares the same minimal tool-using agent in different frameworks. Compare on these six, with the question to ask and what to look for.

| Criterion | Question | What to look for |
|---|---|---|
| **State** | Where does conversation and application state live, and can a run resume? | Built-in checkpointing with a durable store; how external side effects are handled on resume (we saw an interrupted LangGraph step run again from its start) |
| **Tool calling** | How are tools defined, validated and gated? | Schema validation, a place to put an approval gate, how errors return to the model |
| **Observability** | Can you see every step, tool call, token count and cost? | Built-in tracing, an export format you can send to your own tools |
| **Deployment** | How does it run in production (service, serverless, managed) and scale? | Matches your platform; state store you can operate |
| **Testing** | Can you run it without a model or a network? | A way to script or stub the model; deterministic parts you can unit test |
| **Provider portability** | What changes if you switch model provider or cloud? | A thin adapter, not a rewrite; check what the docs promise versus what they list |

Add two more for your own context: **team fit** (languages and skills, such as the Java background in your profile) and **exit cost** (how hard is it to leave?). A framework that is easy to enter and hard to leave carries a risk the demo will not show.

**Worked example**

Fictional scoring. For 'testing', a framework that lets you pass a scripted model into its loop scores well; one that only runs against live endpoints scores poorly, because every test costs money and is not repeatable. We found the first pattern essential in lessons 24 and 25.

**Common mistake**

Comparing frameworks on a demo that only does the happy path. Compare on the hard cases: a crash mid-run, a denied approval, a malformed tool call, a model that loops.

**Check yourself.** Name the six criteria and one test you would run for 'state'.

<details><summary>Model answer (write yours first)</summary>

State, tool calling, observability, deployment, testing, provider portability. For state: kill the agent mid-run and resume, and check completed steps and external writes are not repeated.

</details>

---

## Part 3 · One flow, two implementations

To make the comparison concrete we built the same small flow twice: read a log, read the runbook, ask a person to approve a rerun, then act.

**Our own loop** (lessons 21 to 25 and 33): a message list, a tool registry with validation, an approval gate, a SQLite checkpoint after each step, and idempotent actions keyed on the action. You write about 77 lines for the tools and gate (`agentkit.py`), 33 for the resumable loop and 32 for the store, plus tools. You control everything and must write and test everything, including the resume logic and the repeat-write protection.

**LangGraph** (about 77 lines including a demo `main`): the same four steps as nodes of a graph, a `SqliteSaver` checkpointer on the compiled graph, and the approval as an `interrupt(...)` inside a node. We ran it: the first run paused at the approval and reported `reruns: []`; after dropping the program and building a new graph on the same SQLite file, `get_state` showed the next step as `ask_person`, and `Command(resume=True)` finished the run with one rerun. Six checkpoints were stored. The framework gave us persistence, pause and resume with very little code. It did not make the action idempotent, and the paused step re-ran from its start on resume (a counter placed before the interrupt went from 1 to 2). So the framework solved the **mechanics** of state and left the **safety of side effects** to us.

```python
def ask_person(state):              # pauses the run; the state is saved at this point
    answer = interrupt({"question": "Rerun the customers job?", ...})
    return {"approved": bool(answer)}

# ... later, in a new process on the same SQLite file:
app.invoke(Command(resume=True), cfg)
```

The line counts are not a fair measure: the two programs do different things (ours validates inputs, bounds turns and logs approvals; the LangGraph demo has no model call). Do not conclude one is 'smaller'. The honest conclusion is the shape of the trade: a framework buys you the generic machinery and its conventions, and costs you a dependency, a learning curve and some control; writing it yourself costs time and tests and buys you control.

**Worked example**

```text
first process: paused with Rerun the customers job? | reruns: []
second process: saved state next step = ('ask_person',) | log = customers FAILED ERR-5102 ...
resumed: rerun scheduled | reruns: ['customers']
checkpoints stored: 6
```

**Common mistake**

Believing that adopting a framework removes the need for idempotent actions and approval tests. It supplies pause and resume; whether a repeated side effect is harmful is still your design.

**Check yourself.** What did LangGraph give you in the experiment and what did it leave to you?

<details><summary>Model answer (write yours first)</summary>

It gave persistence, pause at an approval and resume from a new process with little code. It left action idempotency and any side effects before the pause to you, since the interrupted step ran again from its start.

</details>

---

## Part 4 · The same RAG pipeline in LangChain

LangGraph is about control flow and state. **LangChain** (`langchain-core`) is about the building blocks: a common `Document` type, a `BaseRetriever` interface, a way to join steps with `|` into a pipeline of `Runnable` objects, and tools described by a schema. To compare honestly we rebuilt the lesson 27 to 31 pipeline on those blocks (`reference-code/module5-langchain/`, langchain-core 1.6.6 and langchain 1.4.3, installed and run 2026-10-03). **We kept our retrieval and answer code unchanged** and wrapped it:

| Piece | Ours | LangChain version |
|---|---|---|
| Search and ranking | `Index`, `search` (BM25, TF-IDF, trigram, rank fusion) | the same code, called inside a `BaseRetriever` subclass |
| Access filter | `visible` function in `answer.py`, applied before ranking | the same rule inside `_get_relevant_documents`; the groups are a field of the retriever, not part of the question |
| Result type | a dict of chunks | `Document(page_content, metadata)` |
| Pipeline | one function | a retriever and the question joined with the pipe operator to a `RunnableLambda` answer step |
| 'Model' | extractive best sentence | the same function as a `RunnableLambda`; no LLM is called |
| Tool | a registry entry with validation | `@tool` on a typed function made by a factory that binds the caller's groups, so the model cannot choose them; the schema comes from the signature and docstring |

What the five tests show: on our 25 fixed questions the LangChain wrapper returns **exactly the same answer and citation** as the plain pipeline (an adapter-preservation test, not evidence about LangChain's quality in general, because the retrieval and answer code underneath is deliberately unchanged); a caller without the group cannot retrieve the restricted chunk through the retriever, and a caller in the group can; an unanswerable question abstains; the tool rejects a missing `query` and an out-of-range `max_results`; and a tool built for the finance group returns the restricted chunk while one built with no groups does not. The demo prints the access behaviour: the finance question gets `Not in the documents.` with no groups and the sourced answer `[finance-bonus#0]` for the finance group.

What this tells you, for this experiment only. **The framework did not make the pipeline better; it gave it a standard shape.** The value is interchangeability (any retriever or model that fits the interface can be swapped in) and a shared vocabulary. The costs are a dependency and an extra layer between you and your own logic. And the safety rule still lives in **your** code: the access filter had to be written inside the retriever, and a retriever that forgot it would leak exactly as before. Note too that a LangChain pipeline is a chain of steps; the loops, pause and resume of lesson 33 are what LangGraph adds.

Not done: a real chat model, a real vector store or embedding model, LangChain's agent constructors, and the LangChain documentation itself (we ran the library but did not read its pages in this wave, so we make no claim about its recommended patterns).

**Worked example**

```python
class AclRetriever(BaseRetriever):
    index: Index
    groups: tuple = Field(default_factory=tuple)

    def _get_relevant_documents(self, query, *, run_manager=None):
        visible = lambda i: self.index.chunks[i]['acl'] in ('all', *self.groups)   # filter BEFORE ranking
        ...

chain = {'docs': AclRetriever(index=INDEX, groups=('finance',)), 'question': RunnablePassthrough()} | RunnableLambda(_answer_step)
```

**Common mistake**

Assuming a standard retriever interface includes access control. It is only a shape; whether a restricted chunk can come back is decided by the code you put inside it.

**Check yourself.** What did wrapping our RAG in LangChain change, and what stayed your responsibility?

<details><summary>Model answer (write yours first)</summary>

It gave the same behaviour a standard shape (Document, retriever, runnable pipeline, tool schema), so parts can be swapped. The access filter before ranking, the abstention rule and the evaluation remained your code and your tests.

</details>

---

## Part 5 · Choosing one to go deep on

You do not need to master every framework. Choose one to learn deeply and know the others at the level of this table.

A decision procedure that fits the roles in your profile:

1. **If your target roles are Azure-heavy**, Microsoft Agent Framework is the one to take seriously. It integrates with Azure and Foundry, offers .NET and Python, and its documentation includes the multi-agent orchestration patterns you study in Module 8. (The roadmap's own tab says this.)
2. **If you want to understand state and control flow most clearly**, LangGraph makes the graph and the checkpoint explicit, which is why the roadmap names it the default candidate for the deep dive. It is Python with a JavaScript option.
3. **If you mostly build on Claude and already use Claude Code**, the Claude Agent SDK is a light look: it hands you Claude Code's loop and tools, and its permissions, hooks and subagents map onto lessons 23 and 35.
4. **If you target Databricks**, study Agent Bricks at the concept and design level in Module 11, and note which products are managed and which you write.
5. **Whatever you choose, keep your own loop in your head.** If you understand the 60-line loop, every framework is a variation, and you can debug it when the abstraction leaks.

For a product or program owner the decision is less about syntax and more about risk: dependency health (maintenance, release cadence, licence), a clear way to test without live models, an exit path, and where state and logs live. Ask for a short written comparison on the six criteria, with a failing-case demo, before approving a framework.

**Worked example**

Fictional recommendation memo, three lines: 'We choose LangGraph for the DataOps agent because the approval pause and resume are first-class and we need Python on Databricks. We keep the tool layer and the approval gate as our own code so we can move frameworks. We tested crash-resume and denied-approval on both a prototype in LangGraph and our own loop; the memo and results are attached.'

**Common mistake**

Deciding on the framework before the architecture. First decide workflow versus agent (lesson 20), what must be gated (lesson 23) and how state is saved (lesson 33); then choose the tool that fits.

**Check yourself.** Why keep the tool layer and approval gate as your own code even when you adopt a framework?

<details><summary>Model answer (write yours first)</summary>

They carry your safety rules and domain logic. If they are your code, you can test them without the framework, move frameworks later, and be sure the control does not change with a framework upgrade.

</details>

---

## Do it: lab

1. Specify the minimal tool-using agent in one page: one read-only tool, one write tool with approval, a state that survives a crash, and a scripted-model test. This is your common spec.
2. Implement it in your chosen framework. If you chose LangGraph, start from the `langgraph_spike` example; if Microsoft Agent Framework or another, use its docs. Record the install step, versions, and the date.
3. Implement or reuse it in your own loop (the lesson 33 version), so you have a no-framework baseline.
4. Implement a thin version in one more framework, or complete a careful reading of its docs for the six criteria if you cannot install it (and mark which are read and which are run).
5. Score all three on the six criteria with evidence for each score: crash and resume, denied approval, malformed tool call, a model that loops, a test without a live model.
6. Write a one-page choice memo: the framework you will use for the DataOps build, what you keep as your own code, and the three risks of the choice.

**Done when:** you have the same minimal agent implemented in your chosen framework and in your own loop (and one more framework or a documented reading), scored on six criteria with evidence from failing-case tests, and a one-page choice memo with risks.

---

## Interview check

**Question.** How would you choose an agent framework for a new product?

<details><summary>A strong answer has this shape</summary>

1. Start from the architecture, not the framework: is it a workflow or an agent, what needs approval, how does state persist, where does it run.
2. Short-list two or three and implement the same small agent in each, including the hard cases: a crash mid-run, a denied approval, a malformed tool call, a looping model.
3. Compare on state, tool calling, observability, deployment, testing and provider portability, plus team fit and exit cost, with evidence rather than opinion.
4. Keep the safety-critical parts (approval gate, tool validation, idempotency) in our own code so a framework change or upgrade cannot weaken them.
5. Record the decision, the versions and the date, because this field changes quickly.

</details>

---

## Evidence to keep

Keep the common spec, the three implementations (or readings) with versions and dates, the scored comparison with the failing-case evidence, and the choice memo.

---
