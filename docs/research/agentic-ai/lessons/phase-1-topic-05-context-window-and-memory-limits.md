# Context window and memory limits

**Course:** Agentic AI, from first principles to production · Module 1 Foundations · lesson 5 of 8 · **about 2 hours** · paper draft for review.  
**Success criterion:** Given a 200-page support corpus, design two approaches (full-context and retrieval) and compare token cost, retrieval quality, latency and failure modes; state when each is preferable, and test on your own document whether a fact placed in the middle is used as reliably as one at the start or end.

> Sources (read 2026-09-29 and 2026-09-30; details and gaps in docs/research/agentic-ai): Anthropic docs 'Context windows', 'Pricing' and 'Models overview'. Sizes and prices are Anthropic's on 2026-09-29; the corpus example is fictional. Added on 2026-09-30: Liu et al., 'Lost in the Middle: How Language Models Use Long Contexts' (arXiv 2307.03172; abstract read: better at the edges, significantly worse in the middle, no percentage given); Claude Academy 'AI Capabilities and Limitations', lessons 8 and 9 (abrupt failure, no learning between sessions). The course's 'over 30 percent' figure is not used because the paper's abstract does not support it.

---

## Part 1 · The desk, not the memory

The context window is all the text the model can use when it produces a response, including the response itself. Anthropic calls it a working memory, and separates it from the large body of data the model was trained on.

Analogy (mine): a desk. Only what is on the desk right now can be used. The model does not 'forget' the rest, because it was never on the desk. It cannot condition on anything outside the window. If you want it to use something, you put it there.

Everything in the request takes space on the desk: the system prompt, every message, tool results, images and documents, and the definitions of any tools. The reply counts too, including any 'thinking' the model does. This is about space on the desk, which is not exactly the same as what you are billed for (billing is covered in Tokens and cost).

**Worked example**

A support chat has a 1,000-token system prompt, 20 earlier messages of 150 tokens each (3,000), a pasted 4,000-token policy, and the model writes a 500-token reply. That is about 8,500 tokens on the desk for this turn, and next turn the reply and the new message are added again.

**Common mistake**

Believing the model remembers earlier chats. Unless the application puts that history back into the request, it does not exist for the model.

**Check yourself.** Why is 'the model forgot what I said earlier' usually the wrong description, and what is the right one?

<details><summary>Model answer (write yours first)</summary>

Because the model does not store the conversation. The application sends history with each request. If the earlier message is not in the request, or was trimmed, the model cannot use it. The right description is that it was not in the context window.

</details>

---

## Part 2 · Bigger is not automatically better

As of 2026-09-29 Anthropic lists a 1M-token window for its current large models (Fable 5.1, Opus 5.5, Sonnet 5.5) and 200K for Haiku 4.5, with maximum output of 128K and 64K tokens. On its current tokenizer 1M tokens is roughly 555 thousand words. Other vendors differ: OpenAI's page lists 1.05M for its three flagship models. The numbers change often, so check the vendor page.

The important warning from Anthropic is that more context is not automatically better. As the token count grows, accuracy and recall degrade, a phenomenon Anthropic calls context rot, so curating what is in context matters as much as how much fits. Long requests are also billed for every token: on the 1M-window models Anthropic bills long context at standard rates, so a 900K-token request costs the same per token as a 9K one, which makes a big window a way to spend a lot quickly.

If the input alone exceeds the window, the request is rejected ('prompt is too long'). On newer models, if input plus the maximum output would exceed the window, the API accepts the request and stops generation when the window is full, reporting a specific stop reason.

**Worked example**

Fictional. A 200-page support manual at about 500 words a page is 100,000 words. At Anthropic's ~555K-words-per-million ratio that is about 180,000 tokens. Sending it whole with every question costs about 180,180 x $2/MTok = $0.36 of input on Sonnet 5.5 per question, or $3,604 a day at 10,000 questions. Retrieving just the 3,000 most relevant tokens costs about $0.006 per question ($60 a day). Caching the manual would cut the full-context cost, and the next section names when that is enough.

**Common mistake**

Choosing the model with the biggest window and pasting everything in. It is expensive, slower, and can make answers worse.

**Check yourself.** Give two reasons not to always paste the whole manual into every request, even when it fits.

<details><summary>Model answer (write yours first)</summary>

Cost (you pay for every token on every call, here about $0.36 versus $0.006), and quality (accuracy and recall can degrade as context grows, which Anthropic calls context rot). Latency is a third reason.

</details>

---

## Part 3 · Lost in the middle, and the cliff

Where a fact sits in a long input matters. Liu et al. (2023) found that model performance is often highest when the relevant information is at the beginning or the end of the input and significantly worse when it is in the middle, even for models built for long contexts.

The Claude Academy Capabilities course adds two points. First, the limit tends to fail abruptly rather than gradually: things work until they do not, and the failure can be silent. Second, the model does not learn between sessions: a correction you make in one conversation is not remembered in the next unless the application puts it back in the request. The course also quotes a drop in accuracy of over 30 percent for a fact placed in the middle. The paper's abstract gives no such number, so we do not use it.

What to do: put the most important instructions and facts at the start and the end, restate them, and trim what the model does not need. You will test this yourself in the lab.

**Worked example**

Fictional. A 20-paragraph prompt contains one rule: 'never quote a price'. Placed in the middle, the model sometimes quotes a price. Moved to the first line and repeated at the end, it holds far more often. Measure it on your own text before believing it.

**Common mistake**

Adding more context to be safe. More material can bury the one thing that matters.

**Check yourself.** You have one critical instruction and a very long document. Where do you put the instruction, and why?

<details><summary>Model answer (write yours first)</summary>

At the start and again at the end. Models tend to use information at the edges of a long input more reliably than information in the middle, so repeating the key instruction at both edges is safer, and trimming the document helps too.

</details>

---

## Part 4 · Keeping a growing conversation inside the window

Chat products such as claude.ai can manage the window on a rolling first-in, first-out basis. Through the API, history simply accumulates until you manage it.

Anthropic describes three tools. Token counting lets you measure a request before you send it. Server-side compaction (in beta for recent models) summarises earlier parts of a long conversation on the server so it can continue past the limit. Context editing offers more targeted strategies, such as clearing old tool results in agent workflows.

Cached prefixes still occupy the window: caching changes what you pay for those tokens, not whether they count.

**Worked example**

An agent has made 40 tool calls and each result is 2,000 tokens, so 80,000 tokens of old results sit on the desk. Clearing results it no longer needs, or summarising them, frees the space without losing the task.

**Common mistake**

Assuming caching makes the window bigger. It only makes repeated tokens cheaper.

**Check yourself.** Name two ways to keep a long agent run inside the window and one downside of each.

<details><summary>Model answer (write yours first)</summary>

Compaction (downside: the summary can drop a detail you later need) and clearing old tool results (downside: the agent can no longer refer to them). Trimming or retrieving instead of pasting is another, with the risk of retrieving the wrong pieces.

</details>

---

## Part 5 · Full context or retrieval: how to decide

This is the design question behind the success criterion. The two approaches trade cost, quality, speed and failure modes. The comparison below is my reasoning built on the facts above, so test it on your own data.

Full context (paste the material in): simplest to build, and the model can use anything in it. But cost and latency scale with the size, quality may degrade on long inputs, and it fails when the material outgrows the window. It suits a small, stable document set or a one-off analysis of a single large file.

Retrieval (fetch only the relevant pieces): cheap and fast per question, scales far beyond any window, and lets you control who can see what. But it adds moving parts, and its main failure mode is silent: if retrieval misses the right passage, the model cannot use it and may still answer confidently. It suits large or changing collections, high query volumes and anything with access rules.

A middle path: cache a stable prefix and put only the changing parts in each request.

**Worked example**

For the 200-page manual at 10,000 questions a day: retrieval is roughly 60 times cheaper in input tokens. Full context might still win for a one-time review by a lawyer of a 60-page contract, where accuracy over the whole text matters and volume is one.

**Common mistake**

Treating retrieval as always better. It adds a new way to fail, and you must measure it.

**Check yourself.** State one situation where you would choose full context and one where you would choose retrieval, with the reason.

<details><summary>Model answer (write yours first)</summary>

Full context: a single 60-page contract analysed once, where volume is tiny and completeness matters. Retrieval: a 200-page manual queried 10,000 times a day, where cost, speed and scale matter.

</details>

---

## Do it: lab

1. Write down a made-up 200-page corpus (about 500 words a page) for a support team, and a typical question.
2. Estimate tokens for the whole corpus (use a counter on a sample page and scale up) and for a retrieved 3,000-token slice.
3. Compute cost per question and per day for both, using a real price page and its date.
4. Fill a 4-row table (cost, retrieval quality, latency, failure mode) for full-context and for retrieval, and end with a one-line recommendation and the condition that would change it.
5. Position test: put one required fact in the first line, the middle and the last line of a long prompt built from your own document. Ask the same question each time and record whether the model uses the fact.

**Done when:** your table has numbers for cost and reasoned entries for the other three rows, and your recommendation states what evidence would change it.

---

## Interview check

**Question.** Should we paste our whole knowledge base into every prompt?

<details><summary>A strong answer has this shape</summary>

1. Cost: every token is paid for on every call, so a large paste multiplies the bill.
2. Quality: more context is not better context. Accuracy can fall as it grows, and a fact in the middle is used less reliably than one at the edges.
3. Limits: the window is fixed, and hitting it can fail abruptly.
4. Alternatives: retrieve only the relevant passages, or cache a stable prefix and send only what changes.
5. Decide by measuring on your own data. Full context suits a small, stable set or a one-off analysis of one file.

</details>

---

## Evidence to keep

Keep your cost table, your position-test results and your recommendation with the condition that would change it.

---
