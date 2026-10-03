# Launch metrics & adoption

**Course:** Agentic AI, from first principles to production · Module 12 Product and Program Leadership · lesson 64 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Define 3 launch metrics and 1 guardrail metric, each with formula, data source, baseline, target, review cadence and the decision it triggers.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): Rodden, Hutchinson and Fu, 'Measuring the User Experience on a Large Scale: User-Centered Metrics for Web Applications' (CHI 2010; read 2026-10-03 through a page summary: the HEART framework of Happiness, Engagement, Adoption, Retention and Task success, and a process for mapping goals to signals to metrics); Anthropic Engineering 'Demystifying evals for AI agents' (2026-01-09; lesson 46: evaluations are not the same as product outcomes); Google PAIR (success definitions and long-term effects; lesson 60); lessons 46, 47, 49 and 61. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module (the product folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; its 8 tests passed. All figures in it are FICTIONAL assumptions for the DataOps agent. The four metrics, their baselines and targets are fictional. We use no external benchmark for adoption or satisfaction because we read none. Unverified: that HEART suits every AI product; it was written for web applications.

---

## Part 1 · Product metrics are not model accuracy

A model can score well on your evaluation and the product can still fail, because nobody uses it, or they use it and it does not help, or it helps and causes harm somewhere you did not look. So an AI launch needs **product-level metrics** alongside the quality evaluation (lesson 46) and the operational metrics (lessons 47 and 49). Keep the three layers apart:

| Layer | Question | Example | Owner |
|---|---|---|---|
| **Quality** | Is the agent right and safe on known cases? | pass^5 on the evaluation set; must-pass failures | Engineering |
| **Operations** | Is it running well and affordably? | p95 latency, cost per successful task, breaker trips | Platform |
| **Product** | Is it used, and does it help people do their job? | weekly active users, diagnoses accepted without edit, time to diagnosis | Product owner |

The framework we **adapt** for the product layer is Google's **HEART**, from a 2010 paper on measuring user experience at scale for web applications (its authors note that not every dimension suits every product; applying it to AI products is our adaptation, not theirs): **H**appiness (satisfaction), **E**ngagement (depth of use), **A**doption (new users), **R**etention (do they come back), **T**ask success (can they do what they came to do). The paper's other contribution is a process, **goals, signals, metrics**: write the goal, name the user behaviour that signals it, then choose the number that measures that signal. That order stops you picking a number just because it is easy to count.

Not every dimension needs a metric. Pick the ones that match your goal and say why you left the others out.

**Worked example**

Goal: platform engineers rely on the agent for first-line diagnosis. Signal: they start triage with it and keep its diagnosis. Metrics: weekly active users over the on-call roster (adoption), and diagnoses kept unchanged over diagnoses shown (task success). Happiness and retention are left for a later survey and a retention cohort once there is a user base to ask.

**Common mistake**

Reporting the quality evaluation as the launch result. A 96 percent pass rate on your cases says nothing about whether anyone uses the product.

**Check yourself.** Name the five HEART dimensions and the three steps of goals-signals-metrics.

<details><summary>Model answer (write yours first)</summary>

Happiness, Engagement, Adoption, Retention, Task success; and goal, then the user-behaviour signal, then the metric that measures the signal.

</details>

---

## Part 2 · Three launch metrics and one guardrail, fully specified

Your criterion: three launch metrics and one guardrail metric, each with a formula, data source, baseline, target, review cadence and the decision it triggers. The last column is the one teams skip, and it is the one that makes a metric useful: **a metric with no decision attached is a number on a wall.**

Here are ours for the DataOps agent, as validated data (`metrics_spec.py`). The validator rejects a metric if the target equals the baseline, if a launch target is not an improvement, if the decision states no threshold, if the formula is not computable, or if a launch metric has no HEART mapping:

| Metric | Kind / HEART | Formula | Source | Baseline | Target | Cadence | Decision |
|---|---|---|---|---|---|---|---|
| Weekly active users | launch / adoption | distinct users with at least 1 agent session in the week / engineers on the on-call roster | audit log joined to roster | 0 | 0.6 | weekly | Below 0.3 after week 4: stop feature work and interview non-users. At least 0.6 for 3 weeks: expand to the next team |
| Diagnoses accepted without edit | launch / task success | diagnoses kept unchanged / diagnoses shown | ticket revision history | 0 | 0.7 | weekly | Below 0.5 for two weeks: review the 20 most-edited diagnoses and add them to the evaluation set |
| Median minutes ticket to diagnosis | launch / engagement | median(minutes from ticket created to diagnosis accepted) | ticket timestamps | 38 | 15 | weekly | Above 25 after week 6: check whether the agent or the queue is the delay before changing anything |
| **Unsafe attempts reaching the gate** | **guardrail** | count of denied or blocked write requests / write requests | approval gate audit log | 0 | 0.02 or lower | daily | Above 0.05 on any day: pause write proposals and open an incident (lesson 67) |

The **guardrail** is a metric you do not want to get worse while you improve the others: it stops you winning adoption by loosening control. Choose one that reflects the harm you worried about in your risk work (lesson 67).

Note what the third metric's decision says: *check whether the agent or the queue is the delay before changing anything.* Metrics trigger investigation as often as action. Decide in advance which it is.

**Worked example**

```python
class Metric(BaseModel):
    name: str
    kind: Literal['launch', 'guardrail']
    heart: Literal['happiness', 'engagement', 'adoption', 'retention', 'task_success', 'none'] = 'none'
    goal: str
    signal: str
    formula: str
    data_source: str
    baseline: float
    target: float
    higher_is_better: bool = True
    cadence: Literal['daily', 'weekly', 'monthly']
    decision: str      # what we do when the target is met or missed, with a threshold
```

**Common mistake**

Choosing vanity metrics (total sessions, messages sent) because they go up. Pick signals that show the person got their job done.

**Check yourself.** Why must every metric carry a decision with a threshold, and what is a guardrail metric for?

<details><summary>Model answer (write yours first)</summary>

Without a decision and threshold a metric changes nothing. A guardrail is a metric that must not get worse while you improve the others, such as unsafe attempts reaching the approval gate.

</details>

---

## Part 3 · Measuring adoption honestly

Adoption is where AI products quietly fail: a launch, a spike of curiosity, then silence. Four habits help.

1. **Use a funnel, not one number.** Aware, tried, used twice, used weekly. Each step loses people for a different reason, and the fix differs (awareness, first experience, trust, habit).
2. **Look at cohorts.** Compare the people who started in week 1 with those who started in week 4; averages hide whether the product is improving or only recruiting.
3. **Pair numbers with a reason.** When adoption stalls, interview a few non-users and a few drop-outs (lesson 60's questions again). The number says how many; the conversation says why.
4. **Beware measuring effort as success.** If using the agent is mandatory, usage is not adoption. Measure whether people would choose it, for example by watching the share who use it when they could do the task another way.

And keep the three layers connected. When the product metric moves, check quality and operations: accepted-without-edit falling might be a quality regression (check the evaluation), a latency problem (check the traces), or a change in who is using it. Add a **review cadence** with an owner: a short weekly review of the four metrics, a monthly look at trends and the evaluation set, and a stated rule for who may change a target (and a record of why).

**Worked example**

Fictional. Accepted-without-edit drops from 0.72 to 0.55 in a week. The weekly review checks the evaluation (no change), traces (a new runbook format makes citations empty), and the user mix (the second team joined). Cause: the runbook change. Fix: update the retrieval and add a case.

**Common mistake**

Measuring only what is easy. If the data source for a metric does not exist yet, building it is part of the launch, not an afterthought.

**Check yourself.** What is the difference between mandatory usage and adoption, and how do you check?

<details><summary>Model answer (write yours first)</summary>

Mandatory usage counts people who had no choice. Adoption is people choosing it when alternatives exist; look at the share who use it when they could do the task another way, plus interviews.

</details>

---

## Do it: lab

1. Choose one agent (yours or the DataOps agent) and write the goal, the user behaviour that signals it, and the HEART dimensions it touches.
2. Define three launch metrics and one guardrail metric, each with formula, data source, baseline, target, review cadence and the decision it triggers with a threshold. Use `metrics_spec.py` to validate them.
3. Measure at least one baseline from real data. Record the query, the period and the sample size.
4. Write the adoption funnel for your product and the first question you would ask at each drop.
5. Write the weekly review: who attends, what they look at, and who may change a target.
6. Check that every metric can be computed from a data source that exists today; list any that need building.

**Done when:** you have three launch metrics and one guardrail, each fully specified and passing the validator, at least one measured baseline, an adoption funnel, a review cadence with an owner, and a list of data sources that still need building.

---

## Interview check

**Question.** What metrics would you track when launching an AI agent?

<details><summary>A strong answer has this shape</summary>

1. Three layers kept apart: quality (evaluation pass^k and must-pass), operations (latency, cost per successful task), and product (adoption, task success, time saved).
2. For product I use goals, signals and metrics, mapped to HEART dimensions, with a formula, data source, baseline, target, cadence and a decision with a threshold for each.
3. One guardrail that must not worsen, for example unsafe attempts reaching the approval gate, so we do not buy adoption by loosening control.
4. Adoption measured as a funnel and by cohort, with interviews to explain drops, and I check whether usage is chosen or mandatory.
5. A weekly review that connects product metrics back to the evaluation and the traces.

</details>

---

## Evidence to keep

Keep the goal-signal-metric table, the validated metric definitions, the baseline query, the funnel and the review cadence.

---
