# Evaluation basics: test sets and pass rates

**Course:** Agentic AI, from first principles to production · Module 3 Prompting, Structured Output and Evaluation Basics · lesson 18 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Build a 20-case test set for one prompt, compare two prompt versions by pass rate, and state whether the difference is large enough to trust.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Anthropic documentation 'Define success criteria and build evaluations' (SMART criteria, task-specific tests, grading methods, using a different model as judge); Evan Miller, 'Adding Error Bars to Evals' (arXiv 2411.00640, abstract read; the full paper was not read); the Wikipedia page 'Binomial proportion confidence interval' (Wilson score formula and the Wald interval's weakness); Claude Academy AI-native SDLC Playbook, 'Continuous evals in CI' lesson (20 to 50 real tasks, every incident becomes a regression test), all read 2026-10-02 through page summaries. All numbers on this page were computed by us in Python 3.14.7 with the code shown (standard library only) and the outputs are exactly what it printed. The example pass counts (14, 17 and 19 out of 20) are invented. The sample-size estimate (about 120 per version) uses the standard normal approximation for two proportions at 5 percent significance and 80 percent power; it is approximate. Unverified: the vendor's advice to use a different model as judge is its recommendation, and we did not test it.

---

## Part 1 · One run proves nothing

Ask a model the same question twice and the answers can differ. So 'I tried it and it worked' tells you little. An **evaluation** (eval) is a repeatable test: a fixed set of cases, a rule for scoring each, and a number you can compare across versions of a prompt, model or agent. Without one, you cannot tell an improvement from luck or notice a regression.

Anthropic's guidance asks for the same two things as lesson 13: success criteria and a way to test them. It says good criteria are **specific, measurable, achievable and relevant**, and gives a contrast: 'the model should classify sentiments well' is poor; reaching a stated score on a held-out test set is testable. Typical criteria categories include task accuracy, consistency, tone, privacy handling, how well context is used, latency and price. Most applications need several.

**Worked example**

Fictional criteria for a ticket triage prompt: at least 90 percent of labels correct on the test set; 100 percent of replies in the required format; median response under 2 seconds; cost under 0.01 dollars per ticket.

**Common mistake**

Using 'looks good to me' on three examples as the test.

**Check yourself.** Turn 'the summaries should be good' into two measurable criteria.

<details><summary>Model answer (write yours first)</summary>

For example: every summary names the decision and any deadline found in the source (checked against a labelled list), and every summary is under 80 words (checked by code).

</details>

---

## Part 2 · Building a test set

A test set is a list of cases, each with an input and what counts as passing. Guidance from the same page, and from the SDLC course:

- **Mirror real use**, including edge cases: irrelevant or missing input, very long input, hostile or off-topic input, and ambiguous cases where humans would disagree.
- **Start small and grow:** the SDLC lesson suggests 20 to 50 real tasks with expected outcomes, and says every production incident should become a permanent regression test. Your failures from lessons 6 and 17 are the best first cases.
- **Volume over polish.** The page prefers more cases with automated scoring over fewer, hand-graded ones.
- **Keep it separate** from the examples you put in the prompt, or you are testing on what you taught it.

A useful 20-case set: 12 typical, 5 edge, 3 adversarial or off-topic, each with an expected label or a checklist of required content.

**Worked example**

Fictional triage set: 12 normal tickets across the three labels, 3 with two possible labels, 2 empty or one-word tickets, 2 pasted-log tickets of 3,000 words, 1 ticket that says 'ignore your instructions'.

**Common mistake**

A test set made only of easy, typical cases. It passes at 100 percent and tells you nothing about production.

**Check yourself.** Why keep test cases separate from the examples in the prompt?

<details><summary>Model answer (write yours first)</summary>

If the prompt already contains the test cases, a pass shows the model can copy, not that it generalises.

</details>

---

## Part 3 · Scoring: code first, then a model judge, then people

Anthropic's page lists scoring methods from cheapest to richest:

- **Exact match or code check:** compare a label, check a field, test a format. Fast, cheap, unambiguous. Use it wherever you can.
- **Similarity** (for example embedding similarity) for consistency, and **reference metrics** such as ROUGE for summaries, where a reference answer exists.
- **Model as judge:** another model scores qualities such as tone or completeness, for example on a 1 to 5 scale or a yes or no question. The page recommends using a different model to judge than the one that produced the answer, to avoid bias. It is slower and costs more, and the judge needs its own prompt and its own checking.
- **Human review:** the slowest and most trusted. Use it to calibrate an automated judge: score 20 cases yourself and compare.

The page's rule of thumb: use high-volume automated scoring as the main signal and a model judge as a second layer for qualities code cannot check.

**Worked example**

Fictional. Triage label: exact match. Reply tone: a judge prompt returns a number from 1 to 5, and you check it against your own scores on 20 cases.

**Common mistake**

Trusting a model judge without ever comparing it to a human. It can be consistently wrong.

**Check yourself.** Which scoring method do you use for 'the label is one of three values', and for 'the reply is empathetic'?

<details><summary>Model answer (write yours first)</summary>

Exact match for the label. A calibrated model judge, with human spot checks, for empathy.

</details>

---

## Part 4 · Is the difference real? Pass rates with error bars

Suppose version 1 of your prompt passes 14 of 20 cases (70 percent) and version 2 passes 17 (85 percent). Is version 2 better? With only 20 cases, a 15-point gap can easily be luck.

Report a **confidence interval** with each pass rate. For a small number of cases, the Wilson score interval behaves better than the simple normal ('Wald') interval, which the Wikipedia article says becomes unreliable for small samples or near 0 or 1. Computed with the code below:

```python
from math import comb, sqrt

def wilson(k, n, z=1.96):                     # 95 percent interval for k passes in n cases
    p = k / n
    d = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return centre - half, centre + half

def mcnemar_exact(b, c):                      # paired: b cases got worse, c cases got better
    n, k = b + c, min(b, c)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)
```
Results (computed, from the invented counts):

| Version | Passes | Rate | 95% Wilson interval |
|---|---|---|---|
| 1 | 14 of 20 | 70% | 48% to 85% |
| 2 | 17 of 20 | 85% | 64% to 95% |
| 2 (alternative) | 19 of 20 | 95% | 76% to 99% |

The intervals for version 1 and 2 overlap a lot. Treating the two versions as independent groups, Fisher's exact test gives p = 0.45 for 14 against 17, and p = 0.09 for 14 against 19: neither is the conventional 0.05 or below.

**Because both versions ran on the same 20 cases, a paired test is stronger.** Count only the cases where they differ. Say version 2 fixed 4 cases and broke 1 (that is how 14 becomes 17): the exact McNemar test gives p = 0.375. If version 2 had fixed 6 and broken none, p = 0.031. The lesson: what matters is how many individual cases flipped and in which direction, not just the totals.

**How many cases?** To tell 70 percent from 85 percent reliably (5 percent significance, 80 percent power) needs roughly 120 cases per version on the simple normal approximation. With 20 cases you can only detect very large differences. Evan Miller's paper (abstract read) makes the same case for reporting error bars and planning sample size. Be honest in your write-up: 'version 2 looks better but 20 cases cannot confirm it; I will grow the set to 60 before shipping.'

**Worked example**

Fictional write-up line: 'V2 passed 17/20 (64 to 95 percent) against V1's 14/20 (48 to 85 percent). Paired, V2 fixed 4 cases and broke 1 (exact p = 0.38). Not enough to claim an improvement; the broken case is a regression to inspect.'

**Common mistake**

Declaring victory on a bigger number from a small set. Also forgetting to look at the cases that got worse.

**Check yourself.** Version A passes 18 of 20 and B passes 16 of 20 on the same cases. What would you check before choosing A?

<details><summary>Model answer (write yours first)</summary>

How many cases actually differ and in which direction (a paired comparison), the intervals around 90 and 80 percent (they overlap heavily at 20 cases), and whether the failures cluster in an important category. Probably grow the set before deciding.

</details>

---

## Part 5 · Run it like a build

Make the evaluation a habit, not an event:

1. **Version everything:** the prompt, the model name and settings, the test set. Store each run's results with those versions.
2. **One command** runs the set and prints pass rate, failures, cost and time.
3. **Gate changes:** the SDLC course's idea is to block a change that drops the pass rate below a threshold, as CI blocks a failing test.
4. **Feed it:** every real failure becomes a new case, so the set grows with experience.
5. **Re-run when anything changes**, including the model version, since vendors update models.

Module 9 extends this from single answers to whole agent runs, scoring the steps and tool choices as well as the final result.

**Worked example**

Fictional. A weekly job re-runs 40 cases against the production prompt and posts the pass rate. A drop from 92 to 85 percent after a model update opens a ticket.

**Common mistake**

Running the eval once, before launch, and never again.

**Check yourself.** Name three things to version so an eval result can be reproduced.

<details><summary>Model answer (write yours first)</summary>

The prompt, the model and its settings, and the test set (plus the scoring code).

</details>

---

## Do it: lab

1. Pick one prompt from lesson 13 or 14. Write its success criteria as measurable checks.
2. Build a 20-case test set: about 12 typical, 5 edge, 3 adversarial or off-topic, each with an expected result or a checklist. Include your failures from lessons 6 and 17.
3. Write the scoring code. Use exact match or code checks wherever possible, and if you add a model judge, check it against your own scores on at least 10 cases.
4. Make a second version of the prompt (one change). Run both on all 20 cases, ideally three times each, and record pass rate, failures, cost and time.
5. Compute the Wilson interval for each pass rate and, from the cases that changed, the paired McNemar p-value, using the code in the lesson.
6. Write a short conclusion: which version is better, whether the difference is large enough to trust, and what you would do next (more cases, a change, or ship).

**Done when:** you have a versioned 20-case set, a scoring script, results for two prompt versions with intervals, a paired comparison, and a conclusion that states whether the difference is trustworthy.

---

## Interview check

**Question.** How do you know a prompt change is an improvement, and how big a test do you need?

<details><summary>A strong answer has this shape</summary>

1. Define measurable success criteria and a test set that mirrors real use, with edge and adversarial cases, kept separate from the prompt's examples.
2. Score automatically where possible, use a calibrated model judge for subjective qualities, and spot-check with people.
3. Compare versions on the same cases, run each more than once, and report pass rates with confidence intervals and a paired comparison of the cases that changed.
4. Size the test to the effect: telling 70 from 85 percent takes on the order of 100 or more cases per version, so a 20-case set only detects large differences. Say so, and grow the set before betting on a small gain.
5. Keep running it: version the prompt, model and set, gate releases on it, and turn every incident into a regression case.

</details>

---

## Evidence to keep

Keep the test set, scoring script, both versions with results, the interval and paired-test numbers, and your conclusion. This is the base for the agent evaluation set in Module 9.

---
