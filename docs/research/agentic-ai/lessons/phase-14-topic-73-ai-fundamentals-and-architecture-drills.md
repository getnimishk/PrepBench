# AI fundamentals & architecture drills

**Course:** Agentic AI, from first principles to production · Module 14 Interviews · lesson 73 of 77 · **about 6 hours** · paper draft for review.  
**Success criterion:** Answer 20 questions aloud (LLMs, tokens, embeddings, RAG vs fine-tuning, tool calling, agent vs workflow) within time limits, recorded and self-scored against a rubric.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): The course's own lessons are the question bank: each question below points to the lesson that answers it, so the sources are those lessons and their cited primary sources. Anthropic Engineering 'Building effective agents' and 'Demystifying evals for AI agents', and the OpenAI and Google material cited in those lessons, are where a questioner's expectations come from. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The drill helpers (the question bank, the self-scoring functions and the story and case-study checks) were written by us and run on Python 3.14.7; their 9 tests passed. They check that evidence is present and count what you recorded; they do not judge the quality of an answer. The key points are our reading of what a good short answer contains, not an official rubric. Unverified: that any interviewer will ask these exact questions.

---

## Part 1 · How the drill works

The criterion: answer 20 questions aloud, within time limits, recorded and self-scored against a rubric. The reason for speaking aloud is simple: **you do not know what you know until you hear yourself say it.** Reading your notes feels like knowing. Saying an answer to a recording exposes the gaps, the rambling, and the three words you cannot pronounce.

The 20 questions come from the lessons you have done. Each has a **time limit** (90 or 120 seconds) and a short list of **key points** a strong answer covers. They are set so that you cannot pass by reciting a definition: you need the point and the reason it matters.

| ID | Question | Lesson | Limit | Key points to hit |
|---|---|---|---|---|
| F01 | What does a large language model do, and what does it not do? | 1 | 90 s | predicts next token; not a database or search engine; can be wrong fluently |
| F02 | What is a token and why does it matter to a manager? | 3 | 90 s | piece of text; priced per token; limits context and latency |
| F03 | What is an embedding? | 4 | 90 s | list of numbers for meaning; similar meaning is close; used for search |
| F04 | What is a context window and what happens when you exceed it? | 5 | 90 s | max input plus output; truncation or error; quality drops in the middle |
| F05 | Prompting, RAG or fine-tuning: how do you choose? | 26 | 120 s | start with prompting; RAG for changing or private knowledge with citations; fine-tune for behaviour; measure first |
| F06 | What is the difference between a workflow and an agent? | 19 | 90 s | who decides the next step; code versus model; start simple |
| F07 | How does tool calling work? | 22 | 120 s | model requests, code runs; schema; validate and return errors |
| F08 | Why can an agent loop forever and how do you stop it? | 21 | 90 s | limits on turns tokens repeats; repeated call detection; escalate |
| F09 | How do you make a write safe to retry? | 25 | 90 s | idempotency key; stored first result; timeouts and bounded retries |
| F10 | What is structured output and why use it? | 14 | 90 s | schema-constrained; validate; handle refusal or truncation |
| F11 | How would you evaluate an agent before release? | 46 | 120 s | fixed cases from real failures; outcome and invariants; repeat trials; gate in CI |
| F12 | What is RAG and where does it fail? | 27 | 120 s | retrieve then generate with sources; failure points; access control before ranking |
| F13 | Why use hybrid search? | 29 | 90 s | meaning plus exact terms; rank fusion; test on your questions |
| F14 | What is prompt injection and how do you defend? | 48 | 120 s | untrusted text becomes instructions; controls in code; assume it can be fooled |
| F15 | Explain least privilege for an agent. | 51 | 90 s | minimum permissions; delegated over application; revocation |
| F16 | What is MCP and how is it different from A2A? | 41 | 120 s | tools and data versus agents; trust boundary; tasks and states in A2A |
| F17 | When would you use more than one agent? | 43 | 120 s | single agent first; security boundary or overload; cost and failure modes |
| F18 | How do you estimate cost for an agent? | 49 | 120 s | per successful task; people cost of failures; ranges and assumptions |
| F19 | What do you log and what do you not? | 47 | 90 s | steps tokens timings; audit separate from debug; content is sensitive |
| F20 | How do you handle a model provider outage? | 50 | 120 s | retry with backoff and breaker; queue and idempotency; degrade and stop writing |

**For product, program and delivery roles, also drill the leadership bank**: 14 questions from modules 12 and 13, which the 20 above do not test. Same method and rubric, 120-second limits:

| ID | Question | Lesson | Limit | Key points to hit |
|---|---|---|---|---|
| L01 | How do you decide whether a problem is worth an AI agent at all? | 60 | 120 s | measure the baseline first; rules or simpler options first; a kill criterion with a date |
| L02 | What goes in an agent product spec? | 61 | 120 s | what it does and must never do; who approves what; how success and failure are measured |
| L03 | How does delivering an agent differ from ordinary delivery? | 62 | 120 s | outcomes are rates, not yes or no; evaluation and governance take the time; approvals and artefacts per stage |
| L04 | How do you prioritise an AI backlog and define an MVP? | 63 | 120 s | a simple scoring model such as RICE; score is a start, say when you override; MVP tests the riskiest assumption |
| L05 | What metrics would you track at launch? | 64 | 120 s | quality, operations and product kept apart; each with a baseline, target and a decision; a guardrail that must not worsen |
| L06 | How would you build the business case? | 65 | 120 s | measured baseline and full cost including failures; ranges and sensitivity; cash versus capacity |
| L07 | Build, extend or buy: how do you decide? | 66 | 120 s | weights and criteria first, evidence for each score; test whether the winner depends on the weights; an exit plan for vendor failure and model retirement |
| L08 | How do you roll out an agent safely? | 67 | 120 s | phased with written widen and roll-back criteria; shadow or pilot first; a rollback lever that has been tried |
| L09 | What is in your agent risk register? | 67 | 120 s | agent-specific risks; owner and trigger for each; evidence the mitigation works |
| L10 | Walk me through your incident response for an agent. | 67 | 120 s | contain first; named roles and short updates; blameless review that changes the system |
| L11 | Two senior stakeholders disagree on speed versus control. What do you do? | 68 | 120 s | split the decision; put each concern in the other's terms; escalate to the decision-maker in writing if needed |
| L12 | You will miss a date. How do you handle it? | 68 | 120 s | tell early; bring options and a recommendation; estimate as a range and a date to narrow it |
| L13 | How do you show a deployed agent is under control? | 71 | 120 s | authentication and a cost cap checked before the run; logs without content; a kill switch and a timed rollback |
| L14 | Tell me about your governed RAG build and how you know it is safe. | 69 | 120 s | access filter before ranking, proven by a test; stage-by-stage results and intervals; what the report does not show |

**How to run it.**

1. Record yourself (a phone voice memo is enough). Read the question, pause two seconds, answer, stop.
2. Transcribe or listen back. For each question, tick which key points you hit and write the seconds.
3. Put the results in a CSV with columns `id, seconds, points_hit, points_total`. The helper `summarise_drill()` marks a question OK when you hit at least two thirds of the points **inside** the limit, and lists the ones that ran over time and the weak ones.
4. `coverage()` can scan a transcript for the words behind each key point. It is a **finder of words, not of understanding**: use it to spot a missed point, never to decide you passed. Mark each key point yourself (or have a peer mark it) before you record a pass: `points_hit` in the CSV must be your human judgement, not the word count.

**Worked example**

```text
id,seconds,points_hit,points_total
F01,78,3,3
F05,131,3,4
F11,95,2,4

(F05 is over its 120 s limit; F11 hit half its points. Those two go on tomorrow's list.)
```

**Common mistake**

Doing all 20 in one sitting and never listening back. The learning is in the listening.

**Check yourself.** Why answer aloud and record, and what does `coverage()` not tell you?

<details><summary>Model answer (write yours first)</summary>

Hearing yourself exposes gaps and rambling that reading notes hides. `coverage()` only finds key-point words in a transcript; it does not tell you the answer was understood or correct.

</details>

---

## Part 2 · What a strong short answer sounds like

A strong 90-second answer has a shape: **a one-sentence answer first, then the reason, then an example or a tradeoff.** Compare two answers to F05 (prompting, RAG or fine-tuning):

- *Weak:* 'Well, prompting is when you write a prompt, RAG is retrieval augmented generation, and fine-tuning is training the model more, and they are all useful in different situations.' (Defines the words, chooses nothing.)
- *Strong:* 'I start with prompting and measure it on a test set. If the problem is knowledge that is private or changes, I add retrieval and cite sources. I consider fine-tuning only for behaviour, such as a format or style, that prompting cannot fix, because it is slower to change and harder to audit.' (A choice, a reason, an order, and a measurement.)

The rubric in `selfscore.py` has five lines to score yourself on, each 0 to 2:

| Item | What it means |
|---|---|
| structure | clear opening, three points, a close |
| evidence | numbers or a demonstrated result for each claim |
| tradeoffs | alternative, cost, what would change your mind |
| honesty | says what was read versus run, and what is unknown |
| time | inside the limit |

Use the **evidence** line to push yourself toward your own numbers: 'in my evaluation, pass^5 was 88 percent' beats 'it depends'. And for **honesty**, practise the sentence 'I have not run that; I have read the documentation and I would test it by...'. It is a strong answer, not a weak one.

Two habits: **answer the question asked** (not the one you prepared), and **stop** when you are done. Silence after a good answer is fine.

**Worked example**

Fictional self-score for one answer: structure 2, evidence 1 (no number), tradeoffs 2, honesty 1, time 2. Total 8 of 10, weakest: evidence and honesty. Next attempt: add one number from your own build.

**Common mistake**

Starting with 'so basically'. Start with the answer.

**Check yourself.** What shape does a strong 90-second answer have?

<details><summary>Model answer (write yours first)</summary>

A one-sentence answer first, then the reason, then an example or tradeoff, and then stop.

</details>

---

## Part 3 · Running the weeks, and what to do with the weak ones

Spread the 20 questions over several days: **five a day, then a second pass**. On the second pass, repeat only the ones that were over time or weak. A question you pass twice, a few days apart, is one you probably know.

For each weak question, do the **repair loop**:

1. Open the lesson named in the table and re-read only its section on that point.
2. Write the three key points in your own words, one line each.
3. Answer aloud again.
4. If you are still stuck, the gap is in the lesson's lab: **run the lab** instead of re-reading. Understanding that came from running code survives interview pressure.

Keep a log of dates, scores and what you changed. The log is evidence for yourself that you improved, and you will use it for lesson 77.

A last point on what these 20 questions are: they are the **core**, not the whole. A real interviewer will wander. The aim is to be fluent in the foundations so that a surprise question can be reasoned from them, and to be comfortable saying 'I do not know that; here is how I would find out'.

**Worked example**

Fictional log line: '2026-10-12: F08 over time (118/90 s), hit 2 of 3. Re-read lesson 21 loop limits, wrote three points, redid at 74 s, hit 3 of 3.'

**Common mistake**

Re-reading the lesson instead of running the lab. Recognition is not recall.

**Check yourself.** What is the repair loop for a weak question?

<details><summary>Model answer (write yours first)</summary>

Re-read the relevant section, write the key points in your own words, answer aloud again, and if still stuck, run the lab.

</details>

---

## Do it: lab

1. Record yourself answering all 20 questions within their time limits, in at least two sittings.
2. Listen back and score each against its key points and the five-line rubric; log the seconds.
3. Run `summarise_drill()` on your CSV; list the over-time and weak questions.
4. Run the repair loop on every weak question and record a second attempt.
5. Do a second full pass a few days later and compare.
6. If you target product, program or delivery roles, answer the 14 leadership questions the same way and add them to the CSV.

**Done when:** you have 20 recorded answers, a CSV of results, a list of weak questions with repair notes, a second pass that shows improvement, and a dated log.

---

## Interview check

**Question.** Explain the difference between a workflow and an agent, and when you would use each.

<details><summary>A strong answer has this shape</summary>

1. The difference is who decides the next step: in a workflow, code; in an agent, the model.
2. I start with the simplest thing that works, a prompt or a workflow, and add an agent loop only when the path cannot be predicted.
3. An agent needs limits on turns and tokens, validated tools, and a gate for writes, and I measure it with repeated trials.
4. In my own build, a single agent with trimmed tool results did the work, and a split was not needed.

</details>

---

## Evidence to keep

Keep the recordings (private), the CSV, the weak list and the second-pass results.

---
