# Agentic AI · Phase 1 "Foundations: How Language Models Work" — source notes

**Read:** 2026-09-29 · **Purpose:** ground the Phase 1 study guides of the *Agentic AI Mastery Roadmap* in primary sources
before any lesson is written · **Status:** pilot. Covers topics 1-6 of the roadmap. Nothing here is from memory: every claim
carries the page it came from. Claims I could not verify are listed in §8 and are **left out of the lessons**.

Written in my own words. Where a source gives a number, it is quoted as that source states it and dated, because vendor
pages in this field change every few months. **Re-verify anything with a number before relying on it.**

---

## 1. What AI, ML and LLMs are (roadmap topic 1)

Source: Google, *Machine Learning: What is ML?* — https://developers.google.com/machine-learning/intro-to-ml/what-is-ml

- ML is the process of training a piece of software, called a **model**, to make useful predictions or generate content
  (text, images, audio, video) from data.
- The contrast with ordinary programming: instead of writing the rules (for example physics equations for rainfall), you
  let the system learn the relationship from data.
- The page names four families: **supervised** (labelled examples; regression and classification), **unsupervised**
  (find structure in unlabelled data, e.g. clustering), **reinforcement** (learn from rewards and penalties) and
  **generative AI** (create new content by learning to mimic the data it was trained on).
- An LLM belongs to the *generative* family. The page does not define "LLM" itself; the lesson defines it from §2.

## 2. How LLMs work, no math (topic 2)

Sources:
- Vaswani et al., *Attention Is All You Need*, arXiv 1706.03762 (submitted 12 Jun 2017, latest revision 2 Aug 2023).
- Hugging Face LLM Course, ch. 1 "How do Transformers work?" — https://huggingface.co/learn/llm-course/chapter1/4
- Kalai, Nachum, Vempala, Zhang, *Why Language Models Hallucinate*, arXiv 2509.04664 (4 Sep 2025).

Facts:
- The transformer is "based solely on attention mechanisms", dropping recurrence and convolution. Compared with those
  older designs it was **more parallelisable** and needed **significantly less time to train**. It reached 28.4 BLEU
  (English-German) and 41.8 BLEU (English-French) after 3.5 days on eight GPUs. *(This answers the roadmap's success
  criterion "why transformers replaced RNNs".)*
- **Attention layers** let the model focus on specific earlier words when processing text. The HF page's example: in
  translation, "You" changes how "like" must be conjugated in French, so the model must look at "You".
- **Causal language modelling** = predict the next word from the previous words. The decoder may only look at past words,
  not future ones, so it cannot cheat. Decoder-only models are the text-generation kind.
- **Pretraining** = train from scratch on a very large dataset. **Fine-tuning** = adapt a pretrained model to a task.
  Transfer learning needs far less task-specific data and compute than starting over.
- **Hallucination (paper's argument):** errors arise as ordinary mistakes when the model cannot tell correct from
  incorrect statements in its training data, so it guesses; and benchmarks reward guessing over saying "I don't know",
  which trains models to be good test-takers. The authors propose changing how existing benchmarks are scored.
  *This is one research group's account, not a settled consensus. The lesson presents it as such.*

## 3. Tokens and cost (topic 3)

Sources:
- HF LLM Course, ch. 2 "Tokenizers" — https://huggingface.co/learn/llm-course/chapter2/4
- Anthropic docs, *Token counting* — https://platform.claude.com/docs/en/build-with-claude/token-counting
- Anthropic docs, *Models overview* — https://platform.claude.com/docs/en/models/overview (pricing table, read 2026-09-29)

Facts:
- Models only process numbers, so a **tokenizer** turns text into pieces (tokens) and a vocabulary maps each piece to an
  ID. Word-level splitting gives huge vocabularies and treats "dog" and "dogs" as unrelated; character-level gives
  10+ tokens per word and little meaning per piece; **subword** splitting keeps common words whole and breaks rare ones
  into meaningful parts ("tokenization" → "token" + "ization").
- Anthropic: token counts from the counting endpoint are an **estimate** and can differ slightly from what is billed;
  system-added tokens are not billed. Counting is free but rate-limited.
- **The same text costs a different number of tokens on different models.** Anthropic states that models from Claude Opus 4.7
  onward use a newer tokenizer producing **about 30 percent more tokens** for the same text, depending on content, and
  says to recount against the model you will use. Its 1M-token window is "roughly 555k words on the current tokenizer;
  models before it fit about 750k words".
- **Billing is per million tokens (MTok), with different input and output prices.** Anthropic's table (2026-09-29):
  Fable 5.1 $10 in / $50 out; Opus 5.5 $4 / $20; Sonnet 5.5 $2 / $10; Haiku 4.5 $1 / $5. Batch requests are 50% off;
  prompt-cache reads cost 10% of the base input price (2.5% on Fable 5.1, 5% on Opus 5.5).
- **Corrected 2026-09-29 after an external review, then verified on Anthropic's *Pricing* and *Prompt caching* pages:**
  cache **writes** cost 1.25x the base input price for the 5-minute cache and 2x for the 1-hour cache; a 5-minute cache
  pays for itself after one read. Long-context requests are billed at standard pricing on models with the 1M window.
  Tool use adds a fixed system-prompt cost (286 tokens on Sonnet 5.5) plus tool definitions and results as input tokens;
  web search is $10 per 1,000 searches on top of tokens.
- **Minimum cacheable prompt, by model (Prompt caching page):** 512 tokens (Fable 5.1, Opus 5.5, Sonnet 5.5),
  1,024 (Sonnet 5, Sonnet 4.6), 2,048 (Opus 4.7), 4,096 (Haiku 4.5, Opus 4.6/4.5). Shorter prompts are not cached and no
  error is returned. The cache prefix is built in the order tools, system, messages; the default lifetime is 5 minutes.
  Automatic caching exists (one top-level `cache_control`).
- These are one vendor's prices. OpenAI's and Google's price pages were not read (gap, §8).

## 4. Embeddings and similarity (topic 4)

Source: OpenAI docs, *Vector embeddings* — https://developers.openai.com/api/docs/guides/embeddings

- An embedding is a **vector (list) of floating-point numbers** that represents text so that meaning can be compared
  numerically.
- Similarity is measured with **cosine similarity**. OpenAI's vectors are normalised to length 1, so cosine gives the
  same ranking as Euclidean distance.
- Uses named by the page: search, clustering, recommendations, anomaly detection, diversity measurement, classification.
- Models named by the page: `text-embedding-3-small` (1,536 dimensions by default, 62.3% on MTEB, 8,192 max input
  tokens) and `text-embedding-3-large` (3,072 dimensions, 64.6%, 8,192). Both accept a `dimensions` parameter to shorten
  vectors. *(Numbers as stated on the page on 2026-09-29; the page may be outdated relative to newer embedding models.)*
- The page does not explain "why car and automobile match". That is the lesson's own worked example and is labelled as
  an illustration, not a quote.

## 5. Context window and memory limits (topic 5)

Source: Anthropic docs, *Context windows* — https://platform.claude.com/docs/en/build-with-claude/context-windows

- The context window is **all the text the model can reference when generating a response, including the response
  itself**: a "working memory", different from the training corpus.
- **Everything in the request counts:** system prompt, every message, tool results, images and documents, tool
  definitions, and the output including any "thinking".
- **More context is not automatically better.** As token count grows, accuracy and recall degrade; Anthropic calls this
  **context rot**, so curating what is in context matters as much as its size.
- On the API each turn's history accumulates; when the input alone exceeds the window, the request fails with a
  "prompt is too long" error. Chat products may instead drop old messages on a rolling basis.
- Sizes as of 2026-09-29: 1M tokens for the current large models (Fable 5.1, Opus 5.5, Sonnet 5.5) and 200K for Haiku
  4.5; max output 128K (64K for Haiku 4.5). Managing long runs: server-side **compaction** (beta), and **context
  editing** to clear old tool results.

## 6. Model landscape and selection (topic 6)

Sources:
- Anthropic, *Models overview* (above).
- Microsoft Learn, *Microsoft Foundry Models overview* (classic) — https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/foundry-models-overview (page dated 2026-07-28)
- Databricks docs, *Foundation Model APIs* — https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/

Facts:
- Model **tiers trade capability against speed and cost.** Anthropic's own table ranks latency Fable 5.1 slowest, then
  Opus 5.5, Sonnet 5.5, Haiku 4.5 fastest, with price rising the other way. The page tells you to start with Opus 5.5 for most
  workloads and go up a tier only when your own evals at higher effort still fall short. *(A vendor's advice about its own
  line-up; other vendors have their own tier ladders.)*
- **Same model, several places to run it.** The Anthropic page lists the same models on Bedrock, Google Cloud, Microsoft
  Foundry and Claude Platform on AWS, each with its own ID and its own lifecycle dates for some of them.
- Foundry: a catalogue of over 10,000 models, about 50 added each month, split into "sold by Azure" (Microsoft support and
  SLAs) and "partners and community" (supported by the provider). Two ways to run: **managed compute** (billed by VM
  hours) or **serverless** (billed per token, pay-per-token or provisioned).
- Databricks Foundation Model APIs: open models behind a serving endpoint; **pay-per-token** for getting started, or
  **provisioned throughput** (on demand or reserved 1 or 3 months) for production performance guarantees; **AI
  Functions** for batch. The overview page does not list which model families are hosted.
- **Models get retired.** Both Anthropic and Microsoft publish deprecation schedules; a design that hard-codes one model
  ID will break. (Anthropic shows Haiku 4.5 "not sooner than October 15, 2026".)
- "Open-weight" as a category is used by the lesson from general knowledge and is **not sourced here** (§8).

## 7. Suggested guide shape for this phase

Six topics, each with sections that map to the app's `TopicGuideSection` fields (title, body, worked example, common
mistake, check question, model answer). The pilot lesson is *Tokens & Cost* (topic 3):
`docs/research/agentic-ai/lessons/phase-1-topic-03-tokens-and-cost.md`, with its in-app version in
`phase-1-topic-03-tokens-and-cost.guide.json`.

## 8. Gaps and unverified items — deliberately left out of the lessons

- No OpenAI or Google pricing, model or context-window pages were read; all price and window figures are Anthropic's.
- ~~Anthropic's *Pricing* page was not read.~~ Now read (2026-09-29); see §3. Per-platform prices (Bedrock, Vertex,
  Foundry marketplace billing) are only summarised there: Foundry and AWS bill Claude in "Claude Consumption Units"
  at $0.01 each, with a 1.1x multiplier for US-only inference.
- Nothing was read on **reasoning models**, **RLHF / instruction tuning**, or **open-weight licensing**. The lessons
  mention them only as "covered later" and do not explain how they work.
- The Databricks page did not name hosted models; the Foundry page's "10,000 models" figure is the page's own claim.
- All sources are vendor docs or one preprint; none is an independent review. Where a source is a vendor describing
  its own product, the lesson says so.
- Fetches summarise pages through a small model, so exact wording and figures should be checked against the page before
  they go into anything you would quote in an interview.

## Coverage log

| Roadmap topic | Sources used | Confidence |
|---|---|---|
| 1 What AI, ML, LLMs are | Google ML intro | good for ML; LLM definition built from §2 |
| 2 How LLMs work | arXiv 1706.03762, HF ch.1, arXiv 2509.04664 | good; hallucination is one paper's view |
| 3 Tokens & cost | HF ch.2, Anthropic token counting, models overview | good for concepts; prices vendor-specific |
| 4 Embeddings | OpenAI embeddings guide | good; model list may be dated |
| 5 Context window | Anthropic context windows | good |
| 6 Model landscape | Anthropic overview, Foundry, Databricks | thin on non-Anthropic model detail |

---

## 9. Addendum · facts checked after an external review (2026-09-29)

An outside reviewer's claims about fast-moving products were each checked against the vendor's own page before use.
Confirmed items are recorded here for the roadmap's framework tab and later phases; they are **not** Phase 1 lesson content.

| Claim | Result | Source |
|---|---|---|
| Microsoft Agent Framework is the direct successor to Semantic Kernel and AutoGen | **Confirmed.** Docs call it "the next generation of both". | https://learn.microsoft.com/en-us/agent-framework/overview/ (page dated 2026-07-29) |
| Agent Framework languages | **.NET, Python and Go (Go in public preview).** Not Java. My earlier row said "Python, C#, Java", which mixed in Semantic Kernel. | same |
| Databricks Supervisor API | **Deprecated, end of life 30 Sep 2026**; replacement named as custom agents on Databricks Apps. Agent Bricks types named on the page: Supervisor Agent, Knowledge Assistant. | https://docs.databricks.com/aws/en/agents/agent-bricks/supervisor-api |
| MCP 2026-07-28 specification | **Confirmed:** stateless core (no initialize handshake or session IDs), header-based routing, cacheable list results, hardened authorization (RFC 9207 issuer validation; Dynamic Client Registration deprecated in favour of Client ID Metadata Documents); Roots, Sampling and Logging deprecated with a twelve-month window. | https://blog.modelcontextprotocol.io/posts/2026-07-28/ |
| A2A specification | **Version 1.0.0**; the site says A2A joins the Agentic AI Foundation. | https://a2a-protocol.org/dev/specification/ |
| Prompt-cache write costs and minimum sizes | **Confirmed** (see §3). | Anthropic Pricing and Prompt caching pages |

**Not verified by me** (reviewer's claims, taken as leads only): MLflow 3 evaluation and monitoring as the Databricks agent
lifecycle, OpenAI Agents SDK feature list, Foundry Agent Service managed vs hosted agents, Spring AI and LangChain4j agent
support and its "experimental" label.

**Wording corrections applied to Phase 1 material:** tokens described as reusable pieces rather than "meaningful parts";
"forgets" replaced by "cannot condition on content outside the context"; latency described as several added parts; the
1.3x tokenizer figure is an average, not a conversion factor; the ~555k-words-per-1M-tokens ratio is labelled
Anthropic-specific; the hallucination one-liner in the Mental Model tab was too simple and is to be replaced with a list of
failure modes (missing knowledge, retrieval failure, reasoning error, instruction conflict, unsupported generation).

---

## 10. Addendum · extra sources read for topic 6 and topic 5 examples (2026-09-29)

Fetches summarise each page through a small model, so treat exact figures as "as the page states, via a summary" and confirm
before quoting.

- **OpenAI, *Models*** — https://developers.openai.com/api/docs/models. Three flagship tiers: GPT-6 Astra ("most capable",
  $10 in / $50 out per MTok), GPT-6 Sol (coding and agentic work, $2 / $10) and GPT-6 Luna (most efficient, high volume,
  $0.1 / $0.5). All three list a 1.05M-token context window and knowledge cutoffs between April and May 2026. Specialised
  models exist for realtime voice, image, transcription and other uses.
- **Google, *Gemini models*** — https://ai.google.dev/gemini-api/docs/models (page dated 2026-09-24). Tiers named: Gemini
  3.8 Flash (described for long-horizon software engineering and autonomous agents) and Flash-Lite variants (fastest, most
  cost-effective), plus text-to-speech, live voice and image models. The page as summarised does **not** give context sizes,
  token limits or prices, so none are used in the lessons.
- **Hugging Face, *The Model Hub*** — https://huggingface.co/docs/hub/en/models-the-hub. A place where the community hosts model
  checkpoints; models can be downloaded with client libraries or used through Inference Providers and Inference Endpoints.
  It does not define "open-weight" or discuss licences on that page.
- **Ollama, *Model library*** — https://ollama.com/library. Lists open-weight families (for example Llama, Qwen, Mistral,
  Gemma, and reasoning and embedding models) that can be pulled and run on local hardware, in sizes from 0.5B to 671B
  parameters (summary's figures).
- **Anthropic pricing page** (already in §3): long-context requests on 1M-window models are billed at standard rates; batch
  and caching discounts apply across the full window. Used for the full-context vs retrieval cost example in topic 5.

Still unread: OpenAI and Google **price pages and licence texts** for open models. The lessons use "open-weight" as: the
trained weights can be downloaded and run by you, subject to a licence you must read. That plain definition is background
knowledge, not something a source above states.

---

## 11. Addendum · sources added for wave 1 of the course (2026-09-30)

Abstracts read through a summarising tool; only the abstract was read, not the full paper.

- **Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*** (arXiv 2307.03172, July 2023, revised Nov 2023):
  performance is often highest when the relevant information is at the beginning or end of the input and significantly worse when
  it is in the middle, even for models built for long contexts. **The abstract gives no percentage.** The Claude Academy course quotes
  "over 30 percent"; that figure is not supported by the abstract and is **not used** in our lessons.
- **Sharma et al., *Towards Understanding Sycophancy in Language Models*** (arXiv 2310.13548, Oct 2023, revised May 2025): five
  leading assistants tended to agree with a user's stated views; human raters sometimes preferred a convincingly written agreeable
  answer to a correct one; human preference judgments are named as a probable driver.
- **Ouyang et al., *Training language models to follow instructions with human feedback*** (arXiv 2203.02155, Mar 2022): models
  fine-tuned on human feedback were preferred by human evaluators; a 1.3B-parameter InstructGPT was preferred over the 175B GPT-3, with
  improvements in truthfulness and fewer toxic outputs.
- **Claude Academy**, *AI Capabilities and Limitations* and *AI Fluency*: see `courses/claude-academy-notes.md`. Used for the four-properties
  model, the four knowledge failure modes, the 4Ds and the three modes. Only the sycophancy finding of the four "fingerprints" (agreeable, wordy,
  over-cautious, confidence not tracking accuracy) is checked against a paper; the other three are the course's description.
