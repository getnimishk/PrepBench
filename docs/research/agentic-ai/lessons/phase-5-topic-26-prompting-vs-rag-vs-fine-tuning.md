# Prompting vs RAG vs fine-tuning

**Course:** Agentic AI, from first principles to production · Module 5 RAG and Data · lesson 26 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Pick the right approach for 3 product scenarios and defend each choice against the other two.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): OpenAI developer documentation 'Optimizing LLM accuracy' (the two axes, context optimisation and LLM optimisation; the 87 to 83 BLEU case study; undated page); Anthropic, 'Introducing Contextual Retrieval' (2024-09-19: the advice to put a knowledge base under about 200,000 tokens (about 500 pages) straight into the prompt with prompt caching); Microsoft Learn 'RAG and generative AI - Azure AI Search' (page dated 2026-08-04, updated 2026-09-17: the challenges of RAG); Lewis et al., 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks' (arXiv 2005.11401, 2020: parametric and non-parametric memory). Lessons 6 and 16 of this course supply the failure and context ideas. Read 2026-10-02 through page summaries. The decision table, the three scenarios and their answers are ours and fictional. Unverified: the vendors' advice is the vendors' own, and the BLEU case study is one example in one language; neither is a general result. Fine-tuning prices and limits change often and are not given here.

---

## Part 1 · Two different problems, three levers

When a model's answer is bad, the first question is which kind of problem it is. OpenAI's guide frames two axes, and the same split works for any provider:

- **A context problem:** the model does not have the information (a policy written last month, a customer record, a private document). The fix is to put that information in front of it.
- **A behaviour problem:** the model has what it needs but acts wrongly: the wrong format, the wrong tone, the wrong steps, inconsistent results. The fix is to change how it behaves.

Three levers map onto these:

| Lever | What it changes | Best at | Cost to change later |
|---|---|---|---|
| **Prompting** (instructions, examples, structure) | What the model is told for this one call | Format, tone, steps, small amounts of context. The guide calls it the starting point because it forces you to define what 'accurate' means | Minutes; you edit text |
| **RAG** (retrieval-augmented generation) | What information is put in the prompt, found at question time | Knowledge that is large, private, changing or needs a source | Hours to days; you re-index documents |
| **Fine-tuning** (more training on your examples) | The model's own weights | Consistent behaviour, format or style that prompting does not hold; smaller or faster models for a narrow task | Days to weeks; you re-train and re-test |

In the original RAG paper's terms, fine-tuning changes the model's **parametric memory** (knowledge stored in its weights) and RAG adds **non-parametric memory** (an external store it looks things up in). The practical difference is that a store can be updated, access-controlled and cited, and weights cannot.

The vendor guide also says the levers are additive, not exclusive: you can combine them. It adds a warning from its own case study: for a language-correction task, adding RAG to a fine-tuned model lowered the score from 87 to 83 on a BLEU-style metric, because the extra context added noise to a problem that was about behaviour. That is one vendor example, so read it as 'measure before you stack levers', not as a rule.

**Worked example**

Fictional. A support bot invents refund rules. Is it a context problem (it was never given the policy) or a behaviour problem (it has the policy but ignores it)? Paste the policy into the prompt and ask again. If it now answers correctly, it was context; if it still ignores the text, it is a behaviour or prompt problem and retrieving more documents will not help.

**Common mistake**

Reaching for the heaviest lever first because it sounds serious. Fine-tuning a model to 'know' your documents mixes a context problem with a behaviour tool.

**Check yourself.** A model answers in the wrong format every third time even though the facts are right. Context or behaviour problem, and which lever do you try first?

<details><summary>Model answer (write yours first)</summary>

A behaviour problem. Start with prompting (clearer instructions, examples, structured outputs from lesson 14). Consider fine-tuning only if prompting, measured on a test set, cannot hold the format.

</details>

---

## Part 2 · A decision table you can defend

Use the symptoms, not the technology, to choose. Read the table top to bottom and stop at the first row that fits:

| Symptom | Likely cause | Try first | Then |
|---|---|---|---|
| The answer needs a fact the model could not know (recent, private) | Missing context | Paste it in the prompt to confirm | RAG if the source is large or changes; otherwise keep it in the prompt |
| The answer is right but the shape is wrong (format, tone, length) | Instructions | Rewrite the prompt, add 2 or 3 examples, use structured outputs | Fine-tune only if a test set still shows failures |
| The answer must name its source | Needs provenance | RAG with citations | Check that citations really match the text |
| Different users may see different documents | Access control | RAG with filters applied before ranking (lesson 27) | Never rely on the prompt to hide text |
| A narrow task runs millions of times and is too slow or costly on a big model | Cost and latency | Prompt a smaller model | Fine-tune a small model on examples a big model produced and a person checked |
| The model gets the steps of a workflow wrong | Behaviour | A workflow in code with a model in each step (lesson 20) | Fine-tune last |

Two rules keep the table honest. First, **facts that change belong in a store, not in weights**: a retrained model is out of date the day it ships. Second, **prove the cheaper lever fails on a test set before you move to a dearer one**. Lesson 18 showed how to build that test set.

**Worked example**

Fictional. A bank wants answers about its 400 product documents, with the exact clause cited, and some documents are visible only to the compliance team. Missing context, provenance and access control all point to RAG with filters. None of them points to fine-tuning.

**Common mistake**

Fine-tuning to add facts and then wondering why new facts are missing. The model would need retraining for each document change, and it still could not cite or hide anything.

**Check yourself.** Why do facts that change often belong in a retrieval store and not in a fine-tuned model?

<details><summary>Model answer (write yours first)</summary>

A store can be updated, filtered by who may see what, and cited, immediately. Weights are retrained slowly, hold facts you cannot inspect, and cannot restrict or cite them.

</details>

---

## Part 3 · The fourth option: skip retrieval and put it all in the prompt

Before building a RAG system, check whether you need one. Anthropic's Contextual Retrieval post (2024-09-19) says that if your knowledge base is smaller than about 200,000 tokens (about 500 pages), you can include the whole thing in the prompt, and recommends using prompt caching so repeated calls are faster and cheaper. That advice is from one vendor and tied to a context window of that size; windows and prices move, so check the current numbers.

Our demo document set is about 1,100 tokens, roughly 180 times smaller than that limit. It does not need RAG at all. We use it because it is small enough to read and to measure, not because it needs a retrieval system.

Retrieval starts to earn its place when one or more of these is true: the material is much larger than a prompt, it changes faster than you want to resend it, different users may see different parts, you need a citation to a specific passage, or sending everything on every call costs too much or slows answers. Remember also the 'lost in the middle' result from lesson 5: a model can use information in the middle of a long input worse than information at the start or end, so a bigger prompt is not automatically a better one.

**Worked example**

Fictional. A 60-page onboarding handbook (about 24,000 tokens at 400 tokens a page, 12 percent of a 200,000 limit) for a 40-person team. Put the whole handbook in the system prompt with caching and test it on 20 questions. Build retrieval only if that test fails or the handbook grows.

**Common mistake**

Treating RAG as the default for any question-answering feature. It adds an ingestion pipeline, an index, access rules and new failure types (lesson 27) that a prompt does not have.

**Check yourself.** Your knowledge base is 40 pages and rarely changes. What do you try before building RAG?

<details><summary>Model answer (write yours first)</summary>

Put it all in the prompt (with prompt caching if the provider offers it) and measure on a test set. Build retrieval only if that fails, or if size, change rate, access control or citations demand it.

</details>

---

## Part 4 · Three scenarios, defended against the other two options

Here are three fictional product scenarios with the reasoning a reviewer should expect. Your lab asks you to defend choices against *both* alternatives, so practise the shape: say what the problem is, name the lever, and say why each other lever is worse here.

**A. HR policy assistant** (40 PDFs, updated monthly, answers must cite the page).
- Chosen: RAG. It is a context problem with a changing source and a citation requirement.
- Against prompting alone: 40 PDFs are probably too large to resend each time and, if the HR team uses access rules, cannot be filtered in a prompt. Test the whole-document prompt first if the total is under the size limit.
- Against fine-tuning: monthly updates would need monthly retraining and the model could not cite a page.

**B. Brand voice for support replies** (facts come from the ticket; the problem is tone and structure).
- Chosen: prompting with 3 to 5 example replies and a style guide.
- Against RAG: there is no knowledge gap; retrieving more text would add noise.
- Against fine-tuning: only if a test set shows the prompt cannot hold the tone, and then with at least a few dozen good examples (the OpenAI guide suggests starting with 50 or more).

**C. Ticket classifier** (12 categories, 5,000 labelled past tickets, answers must be strict JSON, 2 million tickets a month).
- Chosen: start with a prompted small model and structured outputs; fine-tune a small model if the pass rate on a held-out set is too low or the cost is too high.
- Against RAG: the categories are fixed; there is nothing to look up.
- Against fine-tuning first: it is a reasonable second step with this much labelled data, but only once the cheaper baseline is measured.

Notice that none of the three answers is 'use all three'. Each added lever has a cost, and the table's second rule applies: measure the cheaper lever first.

**Worked example**

For scenario C, a pass rate of 91 percent on a 200-ticket held-out set with the prompted small model, against a target of 95 percent, is the evidence that justifies a fine-tuning experiment. Without that number, the experiment is a guess.

**Common mistake**

Defending a choice only by what it does well. A defence names what the other two do badly for this case.

**Check yourself.** Scenario D: a legal team wants answers from 3 million words of case law, cited to the paragraph. Which lever, and what does each alternative fail at?

<details><summary>Model answer (write yours first)</summary>

RAG with paragraph-level chunks and citations. Prompting cannot hold 3 million words (about 4 million tokens) at once. Fine-tuning cannot cite a paragraph and cannot be updated when new cases arrive.

</details>

---

## Do it: lab

1. Take three real or realistic scenarios from your own work (a product, a program and a platform one is a good mix). Write each as two sentences: the problem and who suffers from it.
2. For each, classify the problem as context, behaviour, or both, and say how you would test that classification in under an hour (for example, paste the missing text into the prompt).
3. Choose a lever for each and write the defence in the shape: why this one, why not each of the other two. Use the table's two rules.
4. For one scenario, estimate the size of the knowledge in tokens (words times 1.3 is a rough guide) and say whether it fits in a prompt.
5. Write down the single measurement that would make you change your mind for each scenario.

**Done when:** you have three scenarios, each with a context-or-behaviour classification, a chosen lever, a defence against both alternatives, and one measurement that would change your mind.

---

## Interview check

**Question.** Our team wants to fine-tune a model on our policy documents so it 'knows' them. What do you ask before agreeing?

<details><summary>A strong answer has this shape</summary>

1. What is failing today: missing facts (context) or wrong behaviour? Show me three failing examples.
2. Have we tried the cheaper levers on a test set: the policy text in the prompt, then retrieval? What were the pass rates?
3. How often do the policies change, and who must be able to see which one? Weights cannot be updated daily, filtered by user or cited.
4. What would fine-tuning improve that retrieval cannot: format, tone, cost or latency on a narrow task? If nothing, do not fine-tune.
5. What is the cost, the owner and the plan to re-test after each retrain, and what is our rollback?

</details>

---

## Evidence to keep

Keep the three scenarios, the classification tests, the defences and the 'change my mind' measurements. The same table feeds the architecture choices in lessons 27 to 31.

---
