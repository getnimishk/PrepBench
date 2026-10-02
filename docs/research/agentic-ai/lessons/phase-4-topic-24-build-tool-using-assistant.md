# Build: a tool-using assistant

**Course:** Agentic AI, from first principles to production · Module 4 Agent Core · lesson 24 of 77 · **about 6 hours** · paper draft for review.  
**Success criterion:** Run it on 10 questions; show the tool calls it made, one case where it correctly declined to call a tool, and the tests that pass, and one write-style action that runs only after explicit approval. Finish with a one-page 4D review: what you delegated, how you described it, how you checked the result, and what you recorded and disclosed.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): This is a build lesson; it applies the sources of lessons 9 to 23 (Python docs, Pydantic, pytest, Anthropic's Messages API, tool use and error documentation, OWASP LLM06:2025, the SDLC Playbook, the AI Fluency 4Ds), all read 2026-10-02. The reference code on this page was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1 against a scripted stand-in for the model (11 tests passed). It uses the same message shapes as Anthropic's documented Messages API, but it has not been run against the real API, because that needs a key and spends money. The tools in the reference code use an in-memory dictionary so the code can run anywhere; the success criterion asks for two real tools, so you replace the data source with a real one (a database, a file, a public API). The ten-question set and the 4D review template are ours. Unverified: how a real model behaves on your questions; that is what you measure.

---

## Part 1 · What you are building and what 'done' means

A small assistant that answers questions by calling **two real tools**, with validated input, limits on its loop, and one write action that runs only after a person approves it. It is your first complete agent and your first evidence page.

Acceptance criteria, from the roadmap:

1. Two tools that touch real data (not hard-coded text): one read-only, one a reversible write.
2. Inputs validated by Pydantic; errors returned to the model as instructive `tool_result` errors.
3. A loop with a turn limit, a token budget and a repeated-call guard.
4. A run on **10 questions** with the tool calls shown for each.
5. At least one case where the assistant **correctly declines to call a tool**.
6. Passing tests, and one write that runs **only after explicit approval**, with the decision logged.
7. A one-page **4D review** (below).

**Worked example**

Fictional. Tool 1: `lookup_ticket` reads a small SQLite table of your own tickets. Tool 2: `add_comment` inserts a row in a comments table, after approval.

**Common mistake**

Starting with the model and the prompt. Start with the tools, validation and tests; the model plugs in last.

**Check yourself.** Which parts of the assistant should be tested without calling a real model?

<details><summary>Model answer (write yours first)</summary>

Everything except the model's own choices: tool validation, error handling, the gate, the guards and idempotency. Use a scripted stand-in for the model.

</details>

---

## Part 2 · Structure and a build plan

Reuse the reference files and replace the toy data:

```text
assistant/
  tools.py        tools with Pydantic models and descriptions (lesson 22)
  gate.py         the approval gate and decision log (lesson 23)
  loop.py         the agent loop with its guards (lessons 21, 22)
  fake_model.py   a scripted model for tests
  test_assistant.py
  run_questions.py   runs your 10 questions with the real model and prints the tool calls
  README.md       setup, run, test, limits
```
A plan for the 6 hours:

| Hours | Step | Check |
|---|---|---|
| 1 | Choose the data source; write the read-only tool and its Pydantic model | A unit test passes on real data |
| 1 | Write the write tool and the approval gate | Tests: blocked, approved, denied, logged |
| 1 | Wire the loop with guards; run with the scripted model | All tests pass |
| 1 | Swap in the real client; run 3 questions by hand | Tool calls make sense; usage printed |
| 1 | Write and run the 10-question set; save every output | Table of question, tools called, answer, pass or fail |
| 1 | Fix the worst failure; write the README and the 4D page | Fresh clone runs |

To use the real model, create the client from lesson 12 and pass it in: `run_agent(anthropic.Anthropic(), "<model id>", system_prompt, REGISTRY, question, gate=gate)`. The loop only needs `client.messages.create(...)` and reads `content`, `stop_reason` and `usage`, which are the documented response fields.

**Worked example**

Fictional. A system prompt: 'You help IT staff with tickets. Use lookup_ticket for any question about a specific ticket. Add comments only when asked. If a question needs no tool, answer directly. If a tool fails, tell the user what failed.'

**Common mistake**

Skipping the scripted-model tests and debugging everything through paid model calls.

**Check yourself.** Why swap in the real model only after the tests pass with a scripted one?

<details><summary>Model answer (write yours first)</summary>

So any failure with the real model is about the model's behaviour, not about your tools, validation or guards, and you do not pay to debug code.

</details>

---

## Part 3 · The ten questions and the tests

Write 10 questions that exercise the design, and decide the expected behaviour before you run:

| # | Kind | Expected behaviour |
|---|---|---|
| 1 to 3 | Needs the read-only tool once | Correct tool, correct argument, answer matches the data |
| 4 to 5 | Needs two calls or two records | Both calls made, answer combines them |
| 6 to 7 | Needs no tool (a general question) | **Declines to call a tool** and answers directly |
| 8 | Refers to something that does not exist | Tool error returned; the assistant says so and does not invent |
| 9 | Asks for a write | Gate asks a person; runs only after approval; logged |
| 10 | Tries to get the assistant to do something it should not (for example 'close all tickets') | Refuses or has no such tool |

Tests (the reference suite has these 11, all passing): answers from a tool result; declines when no tool is needed; bad input becomes an error; a missing record becomes an error with a hint; a write is blocked without a gate; a write runs after approval and is logged; a denied write does not run; the loop stops on repetition, on the turn limit and on the token budget; and a retried write is applied once. Add tests for your own tools in the same style.

**Worked example**

Fictional scoring row: 'Q4 asks for the status of tickets 101 and 102. Expected: two lookup calls. Result: one call, then a guess for 102. FAIL. Fix: description says each ticket needs its own lookup.'

**Common mistake**

Choosing questions that only test the happy path. Questions 6 to 10 are where the design is tested.

**Check yourself.** Which question types show the assistant is safe, not just capable?

<details><summary>Model answer (write yours first)</summary>

No-tool questions (it declines), a nonexistent record (it does not invent), a write (it waits for approval) and an out-of-scope request (it refuses).

</details>

---

## Part 4 · The 4D review: one page

Finish every build with the AI Fluency review. One page, four short sections, each with evidence from your run:

- **Delegation:** what you gave the assistant and what you kept (for example, it reads and drafts; a person approves writes). Why.
- **Description:** how you told it what to do: the system prompt, the tool descriptions, the examples. Which wording changes mattered.
- **Discernment:** how you checked the result: the 10-question table, the tests, the failures found, what you changed.
- **Diligence:** what you recorded and disclosed: the decision log, the limits, who owns it, what it must never do, and where AI helped you build it.

This page is the evidence for interviews: it shows judgement, not just code.

**Worked example**

Fictional Discernment line: 'Q4 failed twice because the model guessed ticket 102. I changed the tool description. Pass rate went from 7 to 9 of 10; I would grow the set before trusting that.'

**Common mistake**

Writing the review from memory afterwards. Take notes as you build.

**Check yourself.** Give one concrete piece of evidence for each of the 4Ds from this build.

<details><summary>Model answer (write yours first)</summary>

Delegation: which tools are read-only and which need approval. Description: the tool descriptions and system prompt. Discernment: the 10-question results and failures. Diligence: the approval log and the written limits.

</details>

---

## Do it: lab

1. Create the project from lesson 10's template. Copy the reference files and replace the toy data with a real source (a SQLite file of your own, a CSV, or a public API you may call).
2. Write the read-only tool and the reversible-write tool with Pydantic models and detailed descriptions.
3. Write the tests, including the gate and guard tests, and get them passing with the scripted model.
4. Run the loop with the real model on your 10 questions. Save the full output and tool calls for each.
5. Score each question. Fix the single worst failure and re-run, noting the before and after.
6. Run one write action end to end: the gate asks you, you approve, it runs, and the log records it.
7. Write the README and the one-page 4D review. Then clone your repository fresh and follow the README.

**Done when:** the assistant runs on 10 questions with tool calls shown, one correct decline is shown, tests pass, one write ran only after explicit approval, and the 4D review is written.

---

## Interview check

**Question.** Walk me through an agent you built: what it does, how it is controlled and how you know it works.

<details><summary>A strong answer has this shape</summary>

1. Purpose and tools: two tools, one read-only and one write, over real data, with validated input.
2. Control: loop limits (turns, tokens, repeats), a code-enforced approval gate for writes, a decision log.
3. Evidence: 11 tests with a scripted model, a 10-question set with expected behaviour including a decline, a missing record, a write and an out-of-scope request, with pass rate and failures.
4. What went wrong and what I changed (a concrete failure and its fix, with before and after).
5. Limits and next steps: a small test set, one model, no production data; I would grow the set and add monitoring.
6. The 4D review as the summary of judgement.

</details>

---

## Evidence to keep

Keep the repository, the 10-question results, the test run, the decision log and the 4D review. This is the first build for your case studies.

---
