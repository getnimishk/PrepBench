# Portfolio Build 1: Governed Enterprise RAG

**Course:** Agentic AI, from first principles to production · Module 13 Portfolio · lesson 69 of 77 · **about 10 hours** · paper draft for review.  
**Success criterion:** A documented app where a user without access to a document cannot retrieve it, answers cite sources, and a report shows evaluation results, traces and cost per query. Finish with a one-page 4D review: what you delegated, how you described it, how you checked the result, and what you recorded and disclosed.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): This is a build, not a reading topic: it combines lessons 27 to 31 (RAG), 46 (evaluation), 47 (tracing), 49 (cost), 51 to 53 (access, approval, audit) and 65 (business case). Roadmap portfolio-project criteria (the course's own tab for this topic); Anthropic AI Fluency framework (4D). Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module was written by us and run on Python 3.14.7: the product, migration, drills and deploy folders have 8, 6, 8 and 6 passing tests, and the RAG evidence report generator runs on the lesson 27 to 31 build. Nothing here ran against a real embedding model, a real LLM, a real legacy database or a cloud account. The report's figures describe the pipeline and harness on a toy corpus and a modelled price, not a production system. Unverified: any claim of accuracy on real documents; restricted text can still reach logs, caches or traces that the report does not inspect.

---

## Part 1 · What this build proves, and what it must not claim

You built the pieces earlier: a retrieval pipeline (lessons 27 to 31), an evaluation harness (lesson 46), tracing (lesson 47), a cost model (lesson 49) and access control (lessons 51 to 53). This topic **assembles them into one documented app** that you can show to a hiring manager or sponsor and defend line by line. The criterion has four demonstrable claims:

1. **A user without access to a document cannot retrieve it.** Proved by a test, not by a promise.
2. **Answers cite their sources.** Proved by the evaluation, which checks the right document is cited.
3. **A report shows evaluation results, traces and cost per query.** Generated, not hand-written.
4. **A one-page 4D review** of how you used AI to build it.

And it has one rule: **the report states what it does not show.** Ours says plainly that no real embedding model or LLM was used, that the numbers describe the pipeline and harness, and that restricted text could still land in logs, caches or traces that the report does not inspect. A portfolio piece that overstates is worse than none; one that is precise about its limits is a strong signal of seniority.

**Worked example**

Interviewers often ask 'what would break first at 10 times the size?'. The honest answer comes from the 'what this report does not show' section you wrote yourself.

**Common mistake**

Describing a toy demo as 'enterprise grade'. Say what it is: a governed pipeline tested on a small corpus with measured results.

**Check yourself.** What are the four demonstrable claims, and what rule applies to the report?

<details><summary>Model answer (write yours first)</summary>

No-access users cannot retrieve restricted documents, answers cite sources, a generated report shows evaluation, traces and cost, and there is a 4D review. The report must state what it does not show.

</details>

---

## Part 2 · The ten-hour plan

The build is mostly assembly, so most of the hours go into **proof**, not code. A plan that keeps you honest:

| Hours | Task | Output |
|---|---|---|
| 1 | Choose the corpus: 20 to 30 short documents you are allowed to use, three of them restricted to a group (for example finance). Record the source and licence of each | `corpus/` and a sources table |
| 2 | Wire access control: groups on each document, a filter **before ranking**, callers carry groups | Retrieval that takes a caller |
| 2 | Citations and abstention: the answer must name the document and refuse when evidence is absent | Answer function with sources |
| 2 | Evaluation set: 25 questions (22 answerable, 3 unanswerable), each with the expected document and fact | `eval25.json` |
| 1 | Tracing and cost: log sizes and hashes of each step, not content; model cost from tokens and a stated price | Trace log and cost function |
| 1 | Generate the report with `rag_report.py` and read it critically | `REPORT.md` |
| 1 | README, architecture diagram, 4D review | Docs |

**Three tests you must have, in this order:**

1. A caller with no groups asks the restricted question. The restricted document must not appear in the retrieved set, the answer must not use it, and the answer should abstain.
2. A caller in the finance group asks the same question and gets the answer with the citation.
3. A restricted phrase must not appear in the trace log.

The first two are the proof of the criterion. The third is the one people forget: **access control that filters retrieval but writes restricted text to logs has simply moved the leak.**

**Worked example**

```text
A caller with no groups asked the restricted finance question: restricted document visible = False; answer: `Not in the documents.`
A caller in the finance group: restricted document visible = True
```

**Common mistake**

Filtering after ranking or after generation. Filter first, so the model never sees what the caller may not.

**Check yourself.** Which test do people forget, and why does it matter?

<details><summary>Model answer (write yours first)</summary>

Checking that restricted text is absent from logs and traces. Filtering retrieval but logging restricted content just moves the leak.

</details>

---

## Part 3 · The evidence report: read it like a sceptic

`rag_report.py` generates the report from the code and the evaluation set, so it cannot drift from the system. Ours, run on the lesson build (toy corpus, deterministic stand-ins):

```text
Evaluation by stage (25 questions: 22 answerable, 3 unanswerable)
- Right document cited: 19 of 22 (95% interval 67 to 95%)
- Right fact in the answer: 15 of 22 (95% interval 47 to 84%)
- Correct abstentions: 3 of 3

Cost per query (modelled)
- Median prompt tokens: 309; median cost per query: $0.00122; per 1,000 queries: $1.22
- Retrieval time in this toy index: 1.97 ms per query (not a benchmark)
```

How to read this, as the skeptical reviewer you want to be before someone else is:

1. **Stage by stage.** Retrieval found the right document in 19 of 22; the fact was in the answer in 15 of 22. So four answers lost the fact **after** retrieval, in the generation step, and three retrieval misses are upstream. The two stages need different fixes (lesson 31).
2. **The intervals are wide.** With 22 questions the 95 percent interval on 15 of 22 runs from about 47 to 84 percent. Say so; do not quote 68 percent as a precise figure.
3. **Abstentions 3 of 3 is only three cases.** It shows the mechanism works, not that it is reliable.
4. **Cost is modelled.** It comes from token counts and a stated price, which you should date. It is labelled modelled in the report.
5. **The latency figure is not a benchmark.** A 2 ms retrieval on a toy index says nothing about a real index.

A report that carries these caveats **with** the numbers is the evidence that you understand them. Add one failure case: pick a question the system got wrong, show the trace, and explain which stage failed. That feeds the case study in lesson 72.

**Worked example**

Fictional close for the README: 'On 25 questions the pipeline cites the right document 19 of 22 times and includes the right fact 15 of 22 times; I would not claim more than "works on the common cases" from this sample.'

**Common mistake**

Quoting a single accuracy number. Show the stages, the intervals and the sample size.

**Check yourself.** Why report retrieval and answer correctness separately?

<details><summary>Model answer (write yours first)</summary>

They fail for different reasons and need different fixes: a miss at retrieval versus losing the fact during generation.

</details>

---

## Part 4 · The 4D review and what to publish

Finish with the one-page **4D review** (lesson 66 introduced the structure): what you delegated to an AI, how you described the task, how you checked the result, and what you recorded and disclosed. For this build the honest answers are usually specific: which code an assistant drafted, which test you wrote yourself, which of its suggestions you rejected and why, and what you disclose in the README (for example, 'the evaluation questions were written by me; the first draft of the retrieval code was assisted').

What goes in the repository: the README with the architecture diagram and the three tests, the corpus sources table, the evaluation set and the generated report, the trace policy, the cost assumptions with their date, and the 4D page. What does not: real secrets, real customer data, or documents you do not have the right to share. If your corpus is synthetic, say so on the first line.

**Worked example**

Fictional Delegation line: 'Asked an assistant to draft the access filter; I wrote the two-user test first and it failed on the first draft because the filter ran after ranking. That is how I know the test works.'

**Common mistake**

A 4D page that praises the process. Write at least one thing you rejected or got wrong.

**Check yourself.** What goes in the repository, and what stays out?

<details><summary>Model answer (write yours first)</summary>

README with diagram and tests, corpus sources, evaluation set, generated report, trace policy, cost assumptions and the 4D review; no secrets, real customer data or documents you cannot share.

</details>

---

## Do it: lab

1. Choose a corpus of 20 to 30 documents you may use, mark three as restricted to a group and record each source.
2. Implement or reuse the access filter before ranking and write the two-user test and the log-leak test.
3. Write 25 evaluation questions (22 answerable, 3 not) with expected document and fact.
4. Generate the report with `rag_report.py` and write one paragraph reading each number sceptically, including the intervals.
5. Pick one wrong answer, trace which stage failed and write it up as a failure case.
6. Write the README with an architecture diagram and the 4D review, including one thing you rejected.

**Done when:** you have a documented app where a no-access caller cannot retrieve a restricted document, answers cite sources, a generated report with evaluation, traces and cost per query and its limits, one failure case, and a one-page 4D review.

---

## Interview check

**Question.** Tell me about a RAG system you built and how you know it is safe and works.

<details><summary>A strong answer has this shape</summary>

1. I filter by access before ranking and prove it with a two-caller test, plus a check that restricted text is absent from logs.
2. I report stage by stage: right document cited 19 of 22, right fact in the answer 15 of 22, abstentions 3 of 3, and I say the intervals are wide on 25 questions.
3. Cost per query is modelled from tokens and a dated price, and the report says what it does not show.
4. I can describe a failure case and which stage failed, and how I used AI to build it, including what I rejected.

</details>

---

## Evidence to keep

Keep the repository, the report, the failure case and the 4D page. This is case study material for lesson 72.

---
