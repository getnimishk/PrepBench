# RAG evaluation

**Course:** Agentic AI, from first principles to production · Module 5 RAG and Data · lesson 31 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Run a 20-question test, report retrieval hit rate and faithfulness pass rate, and name the weakest link with evidence.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Ragas documentation, 'Available metrics' (faithfulness, context precision, context recall, response relevancy and others; most are LLM-judged; some need a reference answer), read 2026-10-02; Anthropic, 'Introducing Contextual Retrieval' (2024-09-19: the retrieval failure rates and the advice to evaluate retrieval separately); Anthropic Engineering, 'How we built our multi-agent research system' (2025-06-13: start evaluating with about 20 queries; LLM-as-judge for free-form output, with human review for what it misses); lesson 18 of this course (test sets, Wilson intervals, paired comparison). Read through page summaries. The numbers in this lesson (19 of 22, 15 of 22, 3 of 3, intervals, the judge calibration) come from running `rag_eval.py`; the judge labels in that calibration are fictional and only show the arithmetic. The reference code on this page was written by us and run on Python 3.14.7 (standard library only for the retrieval code; pytest for the 8 tests, which passed). It uses a small fictional document set (18 documents, about 1,100 tokens by a 4-characters-per-token estimate). It has not been run with a real embedding model or a real LLM. Unverified: how accurate any real LLM judge is on your documents; the lab measures it.

---

## Part 1 · Measure each link separately

A RAG answer is the product of several steps, so one overall 'accuracy' hides where it breaks. Evaluate at least four links, each with its own count:

| Link | Question it answers | Metric | Needs |
|---|---|---|---|
| **Retrieval** | Did the right text reach the prompt? | **Hit rate at k**: the share of questions whose right source is in the top k. Optionally **MRR** (average of 1 / rank of the first right source) | The right source for each question |
| **Faithfulness** | Does the answer say only what the sources say? | Share of answers fully supported by the retrieved text | A checker: a person, or a model as judge |
| **Answer correctness** | Is the answer right? | Share containing the required fact | The right fact for each question |
| **Abstention** | Does it refuse when the documents do not contain the answer? | Share of unanswerable questions correctly refused | Unanswerable questions |

Ragas names the same ideas: **faithfulness** (the response stays true to the retrieved context), **context precision** (how relevant the retrieved chunks are), **context recall** (how much of the needed information was retrieved; it needs a reference answer) and **response relevancy** (the answer addresses the question). Most of them are computed by asking an LLM, which is convenient and comes with a catch you will see below.

Here are our reference run's numbers, from `rag_eval.py`:

```text
retrieval hit (right document cited)   19/22   86%  (95% interval 67-95%)
answer correct (right fact present)    15/22   68%  (95% interval 47-84%)
abstention (unanswerable questions)     3/3  100%  (95% interval 44-100%)
answer correct, given the right document was retrieved: 15/19

largest loss: answer step (retrieval lost 3, the answer step lost 4)
```

The weakest link in our demo is the **answer step**: it lost 4 questions after retrieval had succeeded, against 3 lost by retrieval itself. That is a statement of evidence (the counts), and the next sentence is the cautious one: 4 against 3 is not a clear difference, so you would not rebuild the answer step on this alone. You would add questions.

**Worked example**

Fictional. A team reports '72 percent accuracy' for its RAG assistant. Ask: of what, over how many questions, and where are the misses? If 12 of the 28 misses are retrieval and 16 are the answer step, the first fix is the answer step, and you can only know that if the links were measured separately.

**Common mistake**

Reporting one end-to-end number. It cannot tell the retrieval team and the prompt owner which of them has work to do.

**Check yourself.** Which metric tells you whether the right text reached the prompt, and which tells you whether the answer stuck to it?

<details><summary>Model answer (write yours first)</summary>

Retrieval hit rate at k (and MRR) for the first; faithfulness for the second.

</details>

---

## Part 2 · Building a 20-question test that finds problems

The criterion asks for a 20-question test. Twenty is enough to find gross problems and far too few to rank two close designs, so build it to expose failures, not to flatter the system. A useful mix:

| Kind | How many | What it tests |
|---|---|---|
| Direct, wording close to the document | 6 | The baseline: if these fail, something is broken |
| Paraphrase, no shared key words | 4 | Whether retrieval finds meaning, not just words (hybrid and embeddings) |
| Exact identifiers (error codes, names, dates) | 3 | Keyword matching |
| Answer spread over two chunks | 2 | Chunking and assembly |
| Unanswerable | 3 | Abstention |
| Superseded or conflicting source | 1 | Freshness and version preference |
| Restricted document, run as two users | 1 | Security trimming |

For each, write the right source and the exact fact **before** you run anything. Keep the set fixed, version it, and add a new question every time production shows a failure (lesson 18's regression rule). Keep a separate small set for choosing thresholds, so you do not tune on the questions you report.

Two warnings about the numbers. First, **20 questions is small.** A pass rate of 17 of 20 has a 95 percent interval of about 64 to 95 percent. A result of 3 of 3 abstentions has an interval of about 44 to 100 percent: it is encouraging and tells you very little. Second, **a difference between two designs of one or two questions is not evidence.** To compare two versions on the same questions, use a paired comparison (lesson 18's McNemar test), count the questions where they differ, and only believe a clear majority of the differences.

**Worked example**

Fictional. Version A gets 14 of 20, version B gets 17 of 20. The intervals overlap heavily (about 48 to 85 percent against 64 to 95 percent). Looking at the 20 pairs: B fixes 4 questions A got wrong and breaks 1 that A got right. An exact paired test gives p = 0.375, so you cannot call B better yet: gather more questions.

**Common mistake**

Writing 20 easy questions, getting 20 of 20, and concluding the system is ready. Include the awkward kinds, and expect to find failures.

**Check yourself.** Why is 3 of 3 correct abstentions weak evidence, and what do you do about it?

<details><summary>Model answer (write yours first)</summary>

With only 3 cases the plausible range is about 44 to 100 percent, so a real refusal rate of 50 percent would often still give 3 of 3. Add more unanswerable questions and keep adding the ones you meet in use.

</details>

---

## Part 3 · LLM judges: useful, and they must be checked

Reading 20 answers by eye is fine. Reading 2,000 after every change is not, so teams use a model to judge: 'is this answer supported by these sources, yes or no'. Anthropic's multi-agent research write-up describes LLM-as-judge with a rubric as an effective way to score free-form output, and also says human review catches what the judge misses. Treat a judge as an instrument that needs calibrating, in three steps:

1. **Label a sample by hand.** Take 20 to 50 answers and mark each faithful or not yourself.
2. **Run the judge on the same answers** and compare. Report raw agreement **and Cohen's kappa**, which corrects for the agreement you would get by guessing.
3. **Read every disagreement.** They show whether the judge is too strict, too lenient or confused by your documents, and you can fix the judge prompt.

Here is why kappa matters, computed in code on a fictional 20-answer calibration: the person and the judge agree on 17 of 20 answers, which is 85 percent and sounds good. But most answers are faithful, so two labellers who both say 'faithful' most of the time agree a lot by chance. Kappa for these labels is **0.48**, conventionally 'moderate' agreement: the judge is much less trustworthy than 85 percent suggests. Look at the cases that matter: the person marked 4 answers unfaithful and the judge caught only 2 of them. Missing unfaithful answers is exactly the error you cannot afford in a faithfulness check, and a high overall agreement hides it.

```python
def kappa(a, b):
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n          # raw agreement
    pa, pb = sum(a) / n, sum(b) / n
    pe = pa * pb + (1 - pa) * (1 - pb)                  # agreement expected by chance
    return (po - pe) / (1 - pe)
```

Other judge hazards to know: judges can favour longer answers, can be fooled by confident wording, and can be less strict than a person on fine details. Keep a human spot-check going after the judge is deployed.

**Worked example**

```text
judge calibration (fictional labels): agree on 17/20 = 85%, kappa = 0.48
```

**Common mistake**

Trusting a judge because it agrees 85 percent of the time. When most answers are good, agreement by chance is already high; kappa, or looking at the unfaithful cases specifically, tells you more.

**Check yourself.** Why can 85 percent agreement between a judge and a person still mean a weak judge?

<details><summary>Model answer (write yours first)</summary>

If most answers are faithful, two labellers who mostly say 'faithful' agree often by chance. Kappa removes that chance agreement (here 0.48), and the cases that matter, unfaithful answers, may be exactly where the judge is lenient.

</details>

---

## Part 4 · Reading the results and deciding what to fix

Turn the numbers into a decision with four steps:

1. **Write the table by link** (retrieval, answer, abstention, faithfulness) with counts and intervals, as in section 1.
2. **Find the largest loss.** Which link lost the most questions after the previous link succeeded? In our demo that was the answer step.
3. **Read every failed question** and label its cause. In ours: one superseded document won retrieval (a metadata fix: prefer the newest version), one paraphrase had no shared words (needs embeddings), one nearby topic took the top slot, and four right chunks produced the wrong sentence. Causes often point to different fixes.
4. **Change one thing, rerun the same set, report the pair counts.** If you changed two things you cannot tell which helped.

Then decide what is good enough. That is a product and risk decision, not a statistical one: an internal FAQ may tolerate 85 percent with a link to the source, while a system that quotes policy to customers may need a human check on every answer. The test gives you the evidence; the owner sets the bar and the stop rules.

The evaluation code, so you can read how the links are separated:

```python
"""Evaluate the pipeline stage by stage and name the weakest link, with uncertainty.

Per question we record three things separately:
  retrieved : the right document was the top citation
  answered  : the answer contains the right fact
  abstained : (unanswerable questions only) the system said 'Not in the documents.'
Then the 'link' with the largest loss is the one to fix first.
"""
import math

from answer import ABSTAIN, answer
from chunk import chunk_all, heading_chunks
from corpus import DOCS, QUESTIONS
from retrieve import Index


def wilson(k, n, z=1.96):
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return round(100 * (centre - half)), round(100 * (centre + half))


def kappa(a, b):
    """Cohen's kappa: agreement between two yes/no labellers, corrected for the agreement you would get by chance."""
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    return (po - pe) / (1 - pe) if pe != 1 else 1.0


def evaluate(index):
    rows = []
    for q, gold, fact in QUESTIONS:
        out = answer(index, q)
        if gold is None:
            rows.append(dict(q=q, kind="unanswerable", abstained=out["answer"] == ABSTAIN))
            continue
        cited = out["citations"][0]["chunk"].split("#")[0] if out["citations"] else None
        rows.append(dict(q=q, kind="answerable", retrieved=cited == gold, answered=fact.lower() in out["answer"].lower()))
    return rows


if __name__ == "__main__":
    rows = evaluate(Index(chunk_all(DOCS, heading_chunks)))
    ans = [r for r in rows if r["kind"] == "answerable"]
    un = [r for r in rows if r["kind"] == "unanswerable"]
    stages = [("retrieval hit (right document cited)", sum(r["retrieved"] for r in ans), len(ans)),
              ("answer correct (right fact present)", sum(r["answered"] for r in ans), len(ans)),
              ("abstention (unanswerable questions)", sum(r["abstained"] for r in un), len(un))]
    for name, k, n in stages:
        lo, hi = wilson(k, n)
        print(f"{name:38} {k:2}/{n}  {100 * k / n:3.0f}%  (95% interval {lo}-{hi}%)")
    ok_given_retrieved = sum(r["answered"] for r in ans if r["retrieved"])
    n_ret = sum(r["retrieved"] for r in ans)
    print(f"answer correct, given the right document was retrieved: {ok_given_retrieved}/{n_ret}")
    print("\nlargest loss:", "answer step" if (n_ret - ok_given_retrieved) > (len(ans) - n_ret) else "retrieval",
          f"(retrieval lost {len(ans) - n_ret}, the answer step lost {n_ret - ok_given_retrieved})")
    # judge calibration: a person and an automatic judge both mark 20 answers 'faithful' yes/no (fictional labels)
    human = [1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1]
    judge = [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1]
    agree = sum(h == j for h, j in zip(human, judge))
    print(f"\njudge calibration (fictional labels): agree on {agree}/20 = {100 * agree / 20:.0f}%, kappa = {kappa(human, judge):.2f}")
```

**Worked example**

Fictional. After a change, retrieval goes from 19 to 20 of 22 and answer correctness from 15 to 17 of 22. Report both as counts, say it is two questions on 22, and run the paired comparison before telling anyone the system improved.

**Common mistake**

Changing the chunker, the prompt and the retriever together between two runs and attributing the improvement to the one you like best.

**Check yourself.** You changed the prompt and the number of retrieved chunks and the score improved. What is wrong with the claim 'the new prompt helped'?

<details><summary>Model answer (write yours first)</summary>

Two changes were made at once, so the improvement cannot be attributed to the prompt. Change one thing, rerun the same set, and compare the pair counts.

</details>

---

## Do it: lab

1. Build a 20-question set for your lesson 30 app using the mix in section 2. Write the right source and exact fact for each before running. Version the file.
2. Run it and report each link separately with counts and Wilson intervals: retrieval hit rate in the top 3, answer correctness, abstention, and faithfulness (by your own reading).
3. Name the weakest link with evidence: which link lost the most questions after the previous one succeeded? Label the cause of every failed question.
4. Build a judge prompt for faithfulness and run it on 20 answers you also labelled by hand. Report raw agreement and kappa, and read every disagreement.
5. Make one change aimed at the weakest link, rerun the same set, and report the pair counts (fixed, broken, unchanged).

**Done when:** you have the 20-question set, a by-link results table with intervals, a named weakest link with the failed questions labelled by cause, a judge calibration with kappa, and a before-and-after pair count for one change.

---

## Interview check

**Question.** Your RAG system scores 80 percent. How do you decide whether that is good enough?

<details><summary>A strong answer has this shape</summary>

1. I ask what the 80 percent is: which questions, how many, which link. One number across the pipeline hides where it fails.
2. I split it into retrieval hit rate, faithfulness, correctness and abstention, with counts and intervals, and read the failures.
3. I check the set is realistic: awkward questions, unanswerable ones, restricted documents, not just easy direct ones.
4. If an automatic judge produced it, I want its calibration against human labels, with kappa.
5. Good enough is the owner's call about harm: for a low-stakes FAQ with citations 80 percent may do; for customer-facing policy answers I would want a higher bar plus a human check, and a plan to monitor and grow the set.

</details>

---

## Evidence to keep

Keep the question set, the by-link table, the failure labels, the judge calibration and the before-and-after pair counts. They feed the evaluation module (Module 9).

---
