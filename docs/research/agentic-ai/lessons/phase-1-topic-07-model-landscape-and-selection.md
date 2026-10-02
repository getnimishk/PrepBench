# Model landscape and selection

**Course:** Agentic AI, from first principles to production · Module 1 Foundations · lesson 7 of 8 · **about 3 hours** · paper draft for review.  
**Success criterion:** Given 3 scenarios, choose a model type and hosting option for each and justify it on cost, quality, privacy, latency and lifecycle (models get retired).

> Sources (read 2026-09-29 and 2026-09-30; details and gaps in docs/research/agentic-ai): Anthropic 'Models overview'; OpenAI 'Models'; Google 'Gemini models'; Microsoft Learn 'Foundry Models overview'; Databricks 'Foundation Model APIs'; Hugging Face 'The Model Hub'; Ollama library. Read 2026-09-29; model names and prices change every few months.

---

## Part 1 · Every vendor sells a ladder

The big providers each offer a ladder of models: a top model for the hardest work, a middle one for most work, and a small fast one for high volume. As of the pages read on 2026-09-29:

Anthropic: Fable 5.1 (demanding reasoning and long-horizon agent work, $10 in / $50 out per million tokens), Opus 5.5 ($4 / $20), Sonnet 5.5 ($2 / $10, 'best combination of speed and intelligence'), Haiku 4.5 (fastest, $1 / $5).
OpenAI: GPT-6 Astra ($10 / $50, most capable), GPT-6 Sol ($2 / $10, coding and agentic work), GPT-6 Luna ($0.1 / $0.5, most efficient, high volume). All three list a 1.05M-token window.
Google: Gemini 3.8 Flash (aimed at software engineering and autonomous agents) and Flash-Lite variants (fastest and most cost-effective). The page read gave no prices or window sizes, so none are quoted here.

Use these as an illustration of the pattern, not as a buying guide. Names and prices will have moved by the time you read this. A common pattern is that capability, latency and price rise together as you go up the ladder, though specialised models break it.

**Worked example**

Fictional. Tagging 1 million support tickets by topic is simple and high volume, so the small tier is the natural start. Reviewing a complex contract for risky clauses is rare and hard, so the top tier is worth its price for that task.

**Common mistake**

Picking one model for everything. Different steps of one product can use different tiers.

**Check yourself.** Why does a product often use two different model tiers?

<details><summary>Model answer (write yours first)</summary>

Because easy, high-volume steps can run on a cheaper, faster tier, while rare hard steps justify a more capable and expensive one. Using the top tier everywhere wastes money.

</details>

---

## Part 2 · Kinds of models

Frontier (large) models sit at the top of each ladder. Small models trade some capability for speed and cost. Reasoning models spend extra effort thinking before they answer, which helps hard problems and adds cost and delay. Anthropic's table shows adaptive thinking on its current models, and OpenAI lists reasoning levels from low to max on Astra. Roadmap topic 'Reasoning Models and When to Use Them' covers this properly.

Open-weight models are ones whose trained weights you can download and run yourself, under a licence you must read. (That plain definition is background knowledge, not a quote.) The Hugging Face Hub hosts model checkpoints for the community, and Ollama's library lists open-weight families that can be pulled and run on local hardware in a wide range of sizes. Running a model yourself gives you more control over where data goes. Privacy still depends on the whole setup (logs, access, network), and it costs you the hardware and the work of running it.

There are also specialised models for voice, images, embeddings and code.

**Worked example**

A field-service app must work with no internet and never send customer photos out. A small open-weight model on the device fits, even though it is less capable than a frontier model in the cloud.

**Common mistake**

Assuming 'open' means free to use for anything. The licence decides what you may do, so read it before building on a model.

**Check yourself.** What do you gain and what do you take on by running an open-weight model yourself?

<details><summary>Model answer (write yours first)</summary>

You gain control over data and cost structure and the ability to run offline. You take on the hardware, the setup and updates, the quality gap versus frontier models for hard tasks, and the licence terms.

</details>

---

## Part 3 · Where a model runs

The same model can often be reached in several ways. Anthropic's page lists its models on its own API and on Amazon Bedrock, Google Cloud and Microsoft Foundry, with separate IDs, and some lifecycle dates are set by the cloud provider. On the Anthropic API a US-only inference option carries a 1.1 times price multiplier, and marketplace billing through Foundry or AWS is metered in 'Claude Consumption Units' at $0.01 each.

Microsoft Foundry's catalogue lists over 10,000 models (the vendor's own figure when read) and separates 'sold by Azure' (Microsoft support and SLAs) from 'partners and community' (supported by the provider). Two ways to run them: managed compute, where the weights run on your dedicated virtual machines and you pay for VM hours, and serverless, where Microsoft hosts them and you pay per token.

Databricks' Foundation Model APIs serve open models behind an endpoint: pay-per-token to get started, provisioned throughput (on demand, or reserved for 1 or 3 months) for production performance guarantees, and AI Functions for batch work.

The trade-offs you weigh are cost model (per token, per hour, reserved), privacy and data residency, latency, contractual support and which models are available.

**Worked example**

Fictional. A bank already runs everything on Azure and needs data to stay in a region. It picks a model deployed through Foundry with a regional deployment type. An analytics team on Databricks instead may use the platform's hosted endpoint, keeping the model call close to its governed data, and still checks where the endpoint runs and what it logs.

**Common mistake**

Comparing prices across platforms without checking what is included: regional multipliers, marketplace billing, provisioned capacity and support terms all change the real cost.

**Check yourself.** Name two hosting options for the same model family and one trade-off between them.

<details><summary>Model answer (write yours first)</summary>

The vendor's own API and a cloud platform such as Foundry. The cloud platform can fit existing security, billing and residency needs but may add its own pricing, multipliers or lifecycle dates. Serverless per-token versus managed compute (billed by VM hours) is another pair.

</details>

---

## Part 4 · Choosing, and planning for retirement

A workable habit: state the task, the volume and the constraints (privacy, latency, budget), start with a mid-tier model, and measure it on your own test cases. Anthropic's own advice is to start with Opus 5.5 for most workloads and go up a tier only when your evaluations at higher effort still fall short. That is one vendor's advice about its own line-up, so treat it as a starting point for testing, not a rule.

Models are retired. Anthropic publishes retirement commitments (for example, Haiku 4.5 is listed as not retiring sooner than 15 October 2026) and Microsoft publishes deprecation and retirement schedules for Foundry models. A design that hard-codes one model name will break on a date you do not control. So keep the model name in configuration, keep a test set that can score a replacement, and put retirement dates in the risk register.

**Worked example**

Three fictional scenarios with reasoned (not sourced) picks. (1) Tag 1 million tickets a month: a small tier via a serverless API, because volume is high and the task is simple. (2) Summarise confidential board papers for a regulated firm already on Azure: a mid or top tier through the firm's cloud platform with regional deployment, because privacy and contract terms dominate. (3) An offline field app: a small open-weight model run locally, because there is no network and data must not leave the device.

**Common mistake**

Choosing a model from a leaderboard or a vendor page alone. Only your own test cases tell you whether it is good enough for your task.

**Check yourself.** What three things protect you from a model being retired?

<details><summary>Model answer (write yours first)</summary>

The model name lives in configuration, you have a test set that can score a replacement quickly, and the retirement date is tracked as a risk with an owner.

</details>

---

## Do it: lab

1. Write three scenarios of your own (one high-volume simple task, one private and regulated task, one offline or constrained task).
2. For each pick a model type (small, mid, top, reasoning, open-weight) and a hosting option, using only pages you have read yourself. Note the price or limit you relied on and its date.
3. Justify each pick on cost, quality, privacy, latency and lifecycle in two lines each.
4. Look up the retirement or deprecation date of your picked model and say what you would do when it arrives.

**Done when:** each of your three picks has a justification on all five dimensions, cites a dated source for any price or limit, and includes a retirement plan.

---

## Interview check

**Question.** How would you choose a model for a new product? (Also prepare for follow-ups on service levels, vendor lock-in, data residency, security review and how you would migrate if the model were retired.)

<details><summary>A strong answer has this shape</summary>

1. State the task, the volume and the constraints: quality bar, privacy, latency, budget.
2. Shortlist across the tiers and the hosting options (the vendor's API, a cloud platform, a self-hosted open-weight model).
3. Test on your own cases, not on a leaderboard, and compute cost per successful task.
4. Plan for retirement: keep the model name in configuration and keep a test set that can score a replacement.
5. Revisit the choice when models or prices change.

</details>

---

## Evidence to keep

Keep your three scenarios with their dated sources and retirement plans. You will reuse them in the Azure and Databricks module.

---
