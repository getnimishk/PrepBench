# Build vs buy & vendor management

**Course:** Agentic AI, from first principles to production · Module 12 Product and Program Leadership · lesson 66 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** A weighted scorecard for one real need with a recommendation and the exit plan if the vendor fails or a model is retired. Finish with a one-page 4D review: what you delegated, how you described it, how you checked the result, and what you recorded and disclosed.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): Microsoft Learn Cloud Adoption Framework 'AI strategy' (2026-06-26: choose among adoption approaches by weighing your needs and capabilities; decide in sequence; AI adoption approaches differ in how much control and responsibility you keep); Anthropic AI Fluency framework, the 4D model of Delegation, Description, Discernment and Diligence (named in the roadmap criterion for this topic; we use it as a review structure); lessons 46, 53 and 65. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module (the product folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; its 8 tests passed. All figures in it are FICTIONAL assumptions for the DataOps agent. The need, the options, the scores and the weights are fictional. The three options are generic types, not named products, because we evaluated no vendor. The weight-stability test is ours. Unverified: any vendor's real price, terms or roadmap.

---

## Part 1 · Build, extend or buy: the decision and its criteria

There are not two options but three, and the middle one is often the right one.

| Option | What it means | You keep | You give up |
|---|---|---|---|
| **Buy** | A ready-made agent product for the job | Little operating work | Control over behaviour, data handling and roadmap |
| **Extend a managed platform** | Build your agent on a hosted service (prompts, tools, hosted agent runtime) | The behaviour and evaluation | Some portability; the platform's limits |
| **Build on your own stack** | Your framework, your tools, your hosting | Everything | Time, and the work of running it |

The Cloud Adoption Framework's AI strategy guidance has the same shape: you choose how much to take from a provider and how much to own, based on your needs and capabilities, and it is a sequence of decisions, not a single moment. We turn it into a **weighted scorecard** with criteria written before anyone has a favourite option:

| Criterion | Weight | Why it is here |
|---|---|---|
| Fit to the need | 25 | If it does not do the job, nothing else matters |
| Data and security fit | 20 | Where data goes and who can see it |
| Time to first value | 15 | A pilot that takes a year is a different decision |
| Total cost over 3 years | 15 | Licence, build, run and people |
| Exit and lock-in | 15 | Cost and time to leave |
| Team skills to run it | 10 | Can we operate what we choose |

Write the weights **first**, and write the evidence behind every score in a column next to it, because a score with no evidence is an opinion with a number on it.

**Worked example**

Fictional. The need: a ticket-triage assistant for platform operations. Scores (1 to 5) in the order of the criteria above: Buy 3, 5, 3, 3, 2, 5; Extend 4, 4, 4, 4, 3, 3; Build 5, 2, 5, 2, 5, 2.

**Common mistake**

Choosing the option first and then picking weights that make it win. Fix the criteria and weights before you look at any option.

**Check yourself.** What are the three options, and why write the weights before scoring?

<details><summary>Model answer (write yours first)</summary>

Buy, extend a managed platform, or build on your own stack. Weights come first so they cannot be tuned afterwards to favour a chosen option.

</details>

---

## Part 2 · Totals, and whether the winner depends on the weights

Weighted totals from `scorecard.py` (each weight times each score, divided by the sum of weights):

```text
Weighted totals:  Buy 3.35   Extend 3.75   Build 3.80
Winner share when the weights vary by +/-40% (10,000 runs):
   Build  62.1%    Extend  37.9%    Buy  0.0%
```

The totals say Build and Extend are close and Buy is clearly behind **on these criteria**. The stability test is the part that matters: when we redraw the weights within 40 percent either way, Buy never wins, Build wins about 62 percent of the time and Extend about 38 percent. So the real decision is between Build and Extend, and **it turns on how you weigh control against time and skills**. That is a conversation to have with the people who set the weights (the sponsor, security, the team who will run it), not something the arithmetic can settle.

How to use this honestly:

1. **Show the scores and the evidence,** not only the total.
2. **Say which criteria drive the gap.** Here Build wins on fit and security; Extend wins on time and skills.
3. **Name the cheapest way to settle it:** a two-week spike of the Extend option against the hardest 10 cases from your evaluation set. Evidence beats debate.
4. **Record the decision, who made it and when it should be revisited** (for example when the model landscape or your team changes).

**Worked example**

```python
def totals(weights=None):
    w = list(weights or CRITERIA.values())
    s = sum(w)
    return {o: round(sum(wi * si for wi, si in zip(w, sc)) / s, 2) for o, sc in OPTIONS.items()}
```

**Common mistake**

Reading a 3.80 versus 3.75 as a win. The difference is inside the noise of the scores; the stability test is what shows it.

**Check yourself.** What does it mean that Buy never wins in the stability test while Build and Extend split the wins?

<details><summary>Model answer (write yours first)</summary>

Buy is dominated on these criteria however you weight them within the range. The real decision is Build versus Extend and depends on how control is weighed against time and skills.

</details>

---

## Part 3 · Managing a vendor, and the exit plan

Choosing is the start; you then **manage** the choice. A short vendor-management checklist, as our practice (the framework guidance does not give this list):

- **Contract and data:** where data is processed and stored, whether it is used for training, retention, and what you can export.
- **Model changes:** how you are told about version changes and retirements, and how long you get. Our evaluation set (lesson 46) is how you find out the effect.
- **Service level:** availability, support response, and what happens on an outage. Your own fallback (lesson 49) covers the rest.
- **Cost control:** rate limits, usage reports, budget alerts, and a notification at 50, 80 and 100 percent of budget.
- **Review cadence:** a quarterly look at usage, incidents, cost against plan, and the vendor's roadmap against yours.

The criterion also requires an **exit plan** covering two events: **the vendor fails** (outage, price change, acquisition, shut-down) and **a model is retired**. Our `check_recommendation()` refuses a recommendation without both. It is a lint: it checks that the required fields exist and that both phrases appear, not that the plan is adequate. A reviewer must judge the detection method, replacement path, owner, timing and data. A good exit plan states, for each event:

| Item | Vendor fails | Model retired |
|---|---|---|
| Detection | Health check, breaker opens, notice | Deprecation notice, or evaluation drop after an unannounced change |
| Immediate step | Degrade to log-only, then to a person (lesson 49) | Pin the old version while available; start the evaluation on the replacement |
| Replacement path | Second provider behind the same client interface, tested quarterly | Run the evaluation set on the candidate; accept if it passes the gate |
| Data | Export of prompts, runbooks, evaluation cases and logs kept in our storage | Same, plus a prompt-differences review |
| Time and cost to switch | Estimated in days and money, rechecked each quarter | Same |
| Owner | Engineering manager | Engineering manager |

An exit plan you have never exercised is a hope. **Rehearse it once:** run the evaluation set on a second model and write what broke.

**Worked example**

```python
def check_recommendation(rec: dict) -> list[str]:
    problems = [f"missing {k}" for k in EVIDENCE_REQUIRED if not rec.get(k)]
    if rec.get("exit plan") and not all(x in rec["exit plan"].lower() for x in ("vendor fails", "model retired")):
        problems.append("exit plan must cover both a vendor failing and a model being retired")
    return problems
```

**Common mistake**

Writing an exit plan as 'we will switch provider'. Name the replacement, the time, the data you hold, and the evaluation that tells you it works.

**Check yourself.** Which two events must the exit plan cover, and what makes it more than a hope?

<details><summary>Model answer (write yours first)</summary>

The vendor failing and a model being retired. It becomes real when you name the replacement, hold the data and evaluation set, estimate the switch, and rehearse it once.

</details>

---

## Part 4 · The one-page 4D review

The criterion ends with a one-page review using the **4D** structure from Anthropic's AI Fluency framework: **Delegation, Description, Discernment, Diligence**. Anthropic's framework describes Diligence broadly, as interacting with AI responsibly; recording and disclosing what you did is **our operationalisation** of it, not Anthropic's wording. We use the four Ds as a review of how **you** used AI while producing the scorecard, which is a fair test of the habits this course teaches:

| D | The question | An example answer for this lesson (fictional) |
|---|---|---|
| **Delegation** | What did you hand to an AI, and what did you keep? | Asked an assistant to draft criteria and a first set of scores; kept the weights, the evidence and the decision |
| **Description** | How did you describe the task? | Gave the need, the three options, the scale and the rule that every score needs evidence; asked it to list assumptions |
| **Discernment** | How did you check the result? | Compared its scores with vendor documents I read myself; removed two scores I could not support; ran the weight-stability test |
| **Diligence** | What did you record and disclose? | Noted which parts were AI-drafted in the document; kept the prompts; named the owner and a revisit date |

Write it in your own words and keep it to one page. The point is not to prove you used AI carefully; it is to **find where you did not**, and to be able to say so in an interview.

**Worked example**

Fictional line of Discernment: 'The assistant gave Build a 5 for security with no source; I changed it to 4 until I had read our data-handling policy.'

**Common mistake**

Describing the review as 'I checked it'. Say what you compared it with and what you changed.

**Check yourself.** Name the four Ds and say which one is about recording and disclosing.

<details><summary>Model answer (write yours first)</summary>

Delegation, Description, Discernment, Diligence; Diligence covers what you record and disclose.

</details>

---

## Do it: lab

1. Choose one real need (yours or a work scenario) and write it in two sentences.
2. Write six criteria with weights that sum to 100 before looking at any option.
3. Score three options (buy, extend, build) from 1 to 5 and write the evidence next to each score, with a source or a test. Mark any score you cannot support.
4. Run the totals and the weight-stability test (`scorecard.py`). Write which criteria drive the gap and what decides between the top two.
5. Write the exit plan for the vendor failing and for a model being retired. Run `check_recommendation()` on your recommendation.
6. Rehearse one exit: run your evaluation (lesson 46) on a second model and note what broke.
7. Write the one-page 4D review of how you used AI for this work.

**Done when:** you have a weighted scorecard with evidence for each score, a stability result, a recommendation that passes the check, an exit plan covering vendor failure and model retirement, one rehearsed exit, and a one-page 4D review.

---

## Interview check

**Question.** How do you decide whether to build or buy an AI capability?

<details><summary>A strong answer has this shape</summary>

1. Three options, not two: buy, extend a managed platform, or build. I write criteria and weights first (fit, data and security, time, cost over three years, exit, skills) and put the evidence next to each score.
2. I test whether the winner depends on the weights. In my example Buy never won and the real choice was Build versus Extend, which depends on how control is weighed against time and skills, so I settle it with a short spike on the hardest evaluation cases.
3. I manage the vendor after choosing: data terms, model-change notice, service level, budget alerts and a quarterly review.
4. Every recommendation carries an exit plan for vendor failure and for a model being retired, and I rehearse it once.
5. I review my own AI use with the 4D structure: delegation, description, discernment, diligence.

</details>

---

## Evidence to keep

Keep the scorecard with evidence, the stability result, the exit plan with the rehearsal notes and the 4D page.

---
