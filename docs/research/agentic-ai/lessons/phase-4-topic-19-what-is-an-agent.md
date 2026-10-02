# What is an agent?

**Course:** Agentic AI, from first principles to production · Module 4 Agent Core · lesson 19 of 77 · **about 2 hours** · paper draft for review.  
**Success criterion:** Classify 6 examples as prompt, workflow or agent, and justify each in one sentence.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Anthropic Engineering, 'Building effective agents' (published 2024-12-19: the definitions of workflows and agents, the augmented LLM); Microsoft Learn 'Microsoft Agent Framework overview' (when to use an agent or a workflow; page dated 2026-07-29, updated 2026-08-25); Anthropic documentation 'How tool use works' (the model never executes anything itself); Claude Academy AI Fluency lessons 2 and 3 (automation, augmentation, agency), all read 2026-10-02 through page summaries. Definitions of 'agent' differ between authors; we use Anthropic's and mark where Microsoft's differs. The six classification examples and their answers are ours and fictional. Unverified: how a given vendor's marketing uses the word.

---

## Part 1 · Prompt, workflow, agent: who decides the next step?

The word 'agent' is used for almost anything with a model in it, so start with a definition you can test. Anthropic's article separates two kinds of 'agentic system' by a single question: who decides the path?

- **A prompt** (one model call): you send text, you get text back. There is no path.
- **A workflow:** the article calls these systems where models and tools are orchestrated through predefined code paths. Your code decides the steps. A model may do the work inside a step, but the order is fixed.
- **An agent:** systems where the model dynamically directs its own process and tool use, keeping control over how it accomplishes the task. The model decides which tool to call next, looks at the result, and decides again until it judges the job done.

Building block under all of them: an **augmented LLM**, a model that can be given retrieval, tools and memory. In an agent, the model chooses among them; in a workflow, your code does.

**Worked example**

Fictional. 'Classify this ticket' is a prompt. 'Extract fields, validate them, then write them to the database, always in that order' is a workflow. 'Find out why this customer's invoices are wrong, using whatever tools you need' is an agent.

**Common mistake**

Calling a fixed pipeline an agent because it contains a model. If your code decides every step, it is a workflow.

**Check yourself.** One question separates a workflow from an agent. What is it?

<details><summary>Model answer (write yours first)</summary>

Who decides the next step: predefined code (workflow) or the model at run time (agent).

</details>

---

## Part 2 · What an agent is made of

An agent in the practical sense used in this course has four parts:

1. **A model** that decides.
2. **Tools** it can ask for (search, a database query, an API call). The model never runs them; it emits a structured request and your code runs it (lesson 22).
3. **A loop** that feeds each result back to the model until it stops (lesson 21).
4. **State and limits:** the conversation so far, a budget, and the rules for what it may do (lessons 23 and 25).

Microsoft's overview draws the same boundary in its guidance on when to use an agent: when the task is open-ended or conversational and needs autonomous tool use and planning. It uses a workflow when the process has well-defined steps and you need explicit control over order. Its blunt advice is that if you can write a function to handle the task, you should do that instead of using an AI agent.

**Worked example**

Fictional. A 'travel agent' that takes a request, searches flights with a tool, reads results, decides to search again with a different date, and finally proposes an itinerary has all four parts.

**Common mistake**

Believing the model 'runs' the tools. It only requests them. Your code decides whether to run each request.

**Check yourself.** Which part of an agent actually executes a tool?

<details><summary>Model answer (write yours first)</summary>

Your code (or, for server-side tools, the vendor's servers). The model only emits a structured request.

</details>

---

## Part 3 · Two different axes: architecture and mode

Do not mix up two separate ideas that the course materials use.

- **Architecture** (this lesson): prompt, workflow or agent. It describes how the system is built.
- **Mode of working** (AI Fluency): **automation** (the AI runs a defined task), **augmentation** (you and the AI work as partners) and **agency** (you set the rules and the AI works autonomously). It describes how a person relates to the AI.

They often line up (an agent usually means agency), but not always: a workflow can be automation, and an agent can run in augmentation mode with a person reviewing each step. Lesson 20 asks you to name both for your own process.

**Worked example**

Fictional. A nightly job that summarises tickets and emails them is a workflow in automation mode. A coding helper that proposes and the developer accepts each edit is an agent in augmentation mode.

**Common mistake**

Assuming 'agent' always means 'no human involved'. How much a person is involved is a design choice (lesson 23).

**Check yourself.** Can a system be an agent and still have a person approve each action? Which axis is each answer on?

<details><summary>Model answer (write yours first)</summary>

Yes. 'Agent' is the architecture (the model chooses steps); the person approving is the mode or control design (augmentation with approval gates).

</details>

---

## Part 4 · A three-question test

To classify a system, ask:

1. **Who decides the next step?** Code, or the model.
2. **What ends it?** A fixed last step, or the model's judgement that it is finished.
3. **Can the same input take different routes?** If the route can differ run to run because the model chose, it is an agent.

A router that classifies an email and sends it to one of three fixed prompts is a workflow (Anthropic's 'routing' pattern): the model picks a label, but code runs a fixed branch. The model has not chosen its own tools and steps.

**Worked example**

Fictional. A 'research bot' that always runs search, then summarise, then email is a workflow. The same bot given a search tool and a 'done' signal, which may search three times or ten, is an agent.

**Common mistake**

Calling a system an agent for marketing reasons. Choose the label by the test, because the label sets how much testing and governance it needs.

**Check yourself.** A router picks one of three fixed prompts. Workflow or agent, and why?

<details><summary>Model answer (write yours first)</summary>

A worked answer key for the six lab examples, in order. (a) Prompt: one call, no path; automation. (b) Workflow: code fixes the order; automation. (c) Agent: the model chooses tools and when to stop; agency. (d) Workflow (routing): the model picks a label but code runs a fixed branch; automation. (e) Workflow with a human step: fixed order, a manager approves; augmentation. (f) Agent: open-ended, the model decides steps and stopping; agency. For the check question: a router picking one of three fixed prompts is a workflow, because the model selects a label but code runs a predefined branch.

</details>

---

## Do it: lab

1. Classify each as prompt, workflow or agent, and write one sentence of justification using the three-question test: (a) a function that sends a customer email to a model and returns a sentiment label; (b) a pipeline that extracts invoice fields, validates them against a schema, then writes them to a database, always in that order; (c) an assistant given a search tool and a calculator that decides for itself which to use and when it has enough to answer; (d) a classifier that sends each support email to one of three fixed prompt templates; (e) a nightly job that summarises the day's tickets and posts the summary for a manager to approve; (f) a research assistant that browses, reads, takes notes and decides when to stop.
2. For each, also name the mode (automation, augmentation or agency) in a few words.
3. Write one example from your own work for each of the three categories.
4. Compare with a classmate or with the answer key under the check question below, and write down any disagreement.

**Done when:** all six examples have a category with a one-sentence reason using the test, and you have written one example of each kind from your own work.

---

## Interview check

**Question.** Our vendor says their product is an 'AI agent'. How do you evaluate that claim?

<details><summary>A strong answer has this shape</summary>

1. Ask who decides the next step. If the vendor's code does, it is a workflow with a model inside, which may be exactly what you need and is easier to test and govern.
2. Ask what tools it can call, who runs them, what it can change, and what stops it (limits, approvals, audit).
3. Ask how it is evaluated: tests on whole runs, not just demos.
4. Match the architecture to your need: well-defined, repeatable steps favour a workflow; open-ended tasks justify an agent and its extra cost and risk.
5. Judge by controls and evidence, not by the label.

</details>

---

## Evidence to keep

Keep the six classifications and your three examples. You use the same test to choose an architecture for your own process in lesson 20.

---
