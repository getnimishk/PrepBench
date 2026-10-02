# Context engineering

**Course:** Agentic AI, from first principles to production · Module 3 Prompting, Structured Output and Evaluation Basics · lesson 16 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Redesign the context for a support agent: list what goes in, what stays out, what is summarised and what is fetched on demand, with a reason for each.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Anthropic Engineering, 'Effective context engineering for AI agents' (published 2025-09-29): definition, attention budget and context rot, system prompt calibration, tool design, examples, just-in-time retrieval, and long-horizon techniques; Anthropic 'Prompting best practices' (long context, state management); Claude Academy AI-native SDLC Playbook, 'The CLAUDE.md' lesson, all read 2026-10-02 through page summaries. Module 1 lesson 5 supplies the context window background. The article's explanation of context rot (relationships between tokens grow with the square of length and models see few very long examples in training) is its own account; we did not test it. The support-agent example and the four-way table are ours and fictional. Unverified: how much a given model degrades at long lengths on your task; measure it.

---

## Part 1 · From prompts to everything the model can see

Anthropic's engineering article draws a line. Prompt engineering is writing good instructions. **Context engineering** is the broader job of choosing which tokens are in front of the model at each step: instructions, tools, examples, documents, memory and message history. For an agent that runs many steps, that set changes constantly, so it has to be managed.

The article's key claim is that context is a finite, costly resource. As the amount of context grows, the model's accuracy at recalling and using it tends to fall, which the article calls context rot, and it describes the model as having an 'attention budget' that each new token draws on. Its stated reasons: attention relates every token to every other, so the work grows quickly with length, and models are trained on fewer very long sequences. (That is the article's account; we have not tested it.) Module 1's 'desk' picture, and the 'lost in the middle' result, point the same way.

The goal, in the article's words in paraphrase: the smallest set of high-signal tokens that gives the model the best chance of the result you want.

**Worked example**

Fictional. A support agent starts each chat with the full 120-page handbook, 40 tool descriptions and the last 60 turns. By turn 20 it misses a rule on page 3. Cutting what it sees to the 5 relevant paragraphs and 6 tools fixes it.

**Common mistake**

Assuming more context is safer. Irrelevant tokens compete for the model's attention and cost money.

**Check yourself.** What is the difference between prompt engineering and context engineering?

<details><summary>Model answer (write yours first)</summary>

Prompt engineering is writing the instructions. Context engineering is curating everything the model sees at each step, including tools, documents, history and memory, under a limited attention budget.

</details>

---

## Part 2 · What belongs inside: instructions, tools and examples

The article gives practical guidance for the parts you always include:

- **System prompt at the right altitude.** Specific enough to guide behaviour, but not a brittle pile of if-then rules, and not so vague that it assumes shared understanding. Organise it in sections (background, instructions, tool guidance, output format).
- **Tools that are few, self-contained and non-overlapping.** If a human could not say which tool to use in a given situation, neither can the model. Bloated tool sets create ambiguity and spend tokens.
- **Canonical examples over exhaustive rules.** A few diverse, typical examples communicate expected behaviour better than a list of every edge case.

Match this with what you learned in lesson 13: the same clarity applies, but now you are also choosing which tool descriptions and examples are loaded at all.

**Worked example**

Fictional. Two tools, `search_tickets` and `find_tickets`, both do near the same thing. The agent picks inconsistently. Merging them into one with a clear description removes the ambiguity and saves tokens.

**Common mistake**

Adding a rule to the system prompt for every bug found. The prompt becomes long and contradictory, and the model follows it less well.

**Check yourself.** Why prefer a few canonical examples to a long list of edge-case rules?

<details><summary>Model answer (write yours first)</summary>

Examples show the pattern efficiently and generalise, while long rule lists spend the attention budget, can contradict each other, and still miss new cases.

</details>

---

## Part 3 · What you fetch on demand, and how long tasks stay in bounds

**Just-in-time retrieval.** Instead of loading all the data up front, the article describes agents that keep light references (file paths, ticket ids, links) and load the detail with a tool when needed, the way a person uses a file system instead of memorising it. This keeps the working context small, at the price of extra steps and a need for good tools.

**Long tasks** can outgrow the window. The article names three techniques:

1. **Compaction:** summarise the history and start a fresh window with the summary, keeping decisions and unresolved issues and dropping bulky tool output.
2. **Structured note-taking:** the agent writes progress to a file outside the window (a `NOTES.md`) and reads it back later.
3. **Sub-agents:** a focused agent works in its own clean context and returns only a short summary to the main agent.

The same idea appears in the SDLC course: a short, version-controlled `CLAUDE.md` of conventions, commands and 'things it gets wrong' is a small, durable piece of context that teams review by pull request.

**Worked example**

Fictional. A research agent writes 'decided: use vendor B; open: legal review pending' to `notes.md` every 10 steps. After a compaction it reads the file and carries on without re-reading 50 pages.

**Common mistake**

Compacting by summarising everything equally. Keep the decisions and open questions; discard bulky raw tool output.

**Check yourself.** Name the three long-horizon techniques and one risk of each.

<details><summary>Model answer (write yours first)</summary>

Compaction (risk: a summary drops a detail you need), note-taking (risk: stale or wrong notes get trusted), sub-agents (risk: the summary returned loses nuance and adds cost).

</details>

---

## Part 4 · The four-way decision: in, out, summarised, fetched

For every piece of information an agent might use, decide one of four things and write the reason:

| Decision | Use when | Example for a support agent (fictional) |
|---|---|---|
| **In** (always in context) | Needed on nearly every step and short | Role, tone rules, the refund limit, the list of 5 tools |
| **Out** (never included) | Irrelevant, risky or stale | Other customers' data, the 120-page handbook, old unrelated chats |
| **Summarised** | Needed for continuity but bulky | Earlier turns of this chat, results of past tool calls |
| **Fetched on demand** | Needed sometimes and large | The specific policy section, the customer's ticket history, a product spec |

Then count: add up the tokens of everything marked **In**, as you did in lesson 3, and compare it with the model's window and with your cost budget. If the always-in part is large, move things to **fetched**. This table, with a reason in every row, is the artefact the lab asks for.

**Worked example**

Fictional row: 'Customer's last 5 tickets: fetched on demand, because only 1 in 4 chats needs them and each ticket is about 600 tokens.'

**Common mistake**

Putting everything in 'in' because it is simplest. It works in a demo and fails at volume.

**Check yourself.** Where would you put a 90-page product manual that a support agent needs about one question in ten?

<details><summary>Model answer (write yours first)</summary>

Fetched on demand: keep an index or search tool in context, retrieve the relevant section when needed, and keep the rest out.

</details>

---

## Do it: lab

1. Choose or invent a support agent for something you know: an IT help desk, an HR query bot, an order assistant.
2. List every piece of information it might use (at least 12 items: instructions, tools, policies, history, customer data, documents).
3. Assign each item to in, out, summarised or fetched, with a one-line reason.
4. Estimate tokens for the 'in' items (use a token counter) and for one typical fetched item. Compare the always-in total with your model's window and with a cost budget per chat.
5. Write the plan for a 100-turn conversation: when you compact, what you keep, what you drop.
6. Name two things that could go wrong with your design and how you would detect each.

**Done when:** your table has every item assigned with a reason, the always-in token count is computed against the window, and the 100-turn plan says what is kept and what is dropped.

---

## Interview check

**Question.** Our agent works in demos but gets worse in long sessions. How do you fix it?

<details><summary>A strong answer has this shape</summary>

1. Suspect context growth: measure what is in the window at the failing step, and test accuracy at short and long lengths on the same task.
2. Trim the always-in set: shorter system prompt, fewer and clearer tools, canonical examples.
3. Move bulky, occasional data to on-demand retrieval, and summarise or clear old tool results.
4. For long runs, use compaction, a notes file or sub-agents, and keep decisions and open questions when summarising.
5. Add a long-session test to the evaluation set so a regression shows before release.

</details>

---

## Evidence to keep

Keep the table with reasons, the token counts and the 100-turn plan. You will implement part of it in Module 6 and use the numbers in the cost model in Module 9.

---
