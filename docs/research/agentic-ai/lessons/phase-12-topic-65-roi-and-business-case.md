# ROI & business case

**Course:** Agentic AI, from first principles to production · Module 12 Product and Program Leadership · lesson 65 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** A one-page business case with costs (including run cost per task), benefits, assumptions and a sensitivity range.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): Microsoft Learn Cloud Adoption Framework 'Develop a cloud adoption strategy' (page dated 2026-05-14: connects executive intent to measurable outcomes; unify cross-functional leadership across business, IT, finance and security; strategy is iterative) and 'AI strategy' (2026-06-26: teams often experiment a great deal and see little return; decide in sequence); lesson 49 of this course (cost per successful task including people; the cost model and its break-even); lesson 60 (baselines and kill criteria). We read no source that supplies industry ROI benchmarks, so none is quoted. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module (the product folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; its 8 tests passed. All figures in it are FICTIONAL assumptions for the DataOps agent. Every input in the case below is a FICTIONAL assumption. The simulation (`roi.py`) uses triangular ranges and a fixed seed. Unverified: any real organisation's savings; whether saved time converts into cash savings or into capacity (see section 2).

---

## Part 1 · What a defensible business case contains

A business case is a decision document: it answers 'should we spend this money and effort, rather than something else?'. Microsoft's strategy guidance frames the purpose well: connect executive intent to **measurable outcomes**, and unify business, IT, finance and security around shared goals. For an AI agent, a defensible one-page case has:

1. **The problem and the baseline** (lesson 60): what it costs today, measured.
2. **The benefit, with its mechanism:** what changes (minutes saved per task, fewer escalations, faster recovery), for how many tasks, and who benefits.
3. **The full cost:** build, run, **and the people who take over when it fails** (lesson 49), not just model spend.
4. **The assumptions,** each with a low, likely and high value and where it came from (measured, estimated, guessed).
5. **A range, not a point:** the result under the assumptions' ranges, and which assumptions matter most.
6. **The decision rule:** what would make you proceed, wait or stop, and the evidence you will collect in the pilot to firm up the weakest assumptions.

Stakeholders, especially finance, want to see that the weak spots were found by you, not by them.

**Worked example**

Fictional. A one-line summary a CFO can challenge: 'At 6,000 tasks a month, 12 minutes saved per success, and a 90 percent success rate, the agent saves about $59,000 a month of engineer time and costs about $12,500 including failures taken over; the largest uncertainty is the 12 minutes, which the pilot will measure.'

**Common mistake**

Counting only model spend as cost. The model was about one percent of the real cost in lesson 49; the people and the build dominate.

**Check yourself.** Name the six parts of a defensible business case.

<details><summary>Model answer (write yours first)</summary>

Problem and baseline, benefit with its mechanism, full cost including failure takeovers, assumptions with ranges and sources, a range of outcomes with what matters most, and a decision rule with the pilot evidence to collect.

</details>

---

## Part 2 · Worked case: the DataOps agent

Our assumptions, in `roi.py` (low, most likely, high): 4,000, 6,000 or 8,000 tasks a month; 6, 12 or 18 minutes saved per successful task; $40, $55 or $75 loaded cost per hour; 80, 90 or 95 percent success; $0.008, $0.013 or $0.020 model cost per task (consistent with lesson 49); $8, $15 or $30 per failure a person takes over; $800, $1,500 or $3,000 a month of overhead (hosting, monitoring, evaluation runs, review time); $30,000, $45,000 or $80,000 to build, spread over 24 months.

The arithmetic for the most likely month, computed in code: benefit = 5,400 successes x 12 minutes / 60 x $55 = **$59,400**. Cost = 6,000 x $0.013 + 600 failures x $15 + $1,500 + $45,000 / 24 = $78 + $9,000 + $1,500 + $1,875 = **$12,453**. Net = **$46,947 a month**.

Over 20,000 simulated draws from the ranges:

| Result | Value |
|---|---|
| Net per month, 10th / 50th / 90th percentile | $22,604 / $42,120 / $66,435 |
| Chance a month is net positive | about 100 percent under these ranges |
| Median payback of the build | about 1.2 months |

And what moves the answer, from setting each input to its low then high with the others at their likely values:

| Input | Net at its low | Net at its high |
|---|---|---|
| Minutes saved per success | -$29,700 | +$29,700 |
| Loaded cost per hour | -$16,200 | +$21,600 |
| Tasks per month | -$16,774 | +$16,774 |
| Success rate | -$15,600 | +$7,800 |
| Takeover cost per failure | +$4,200 | -$9,000 |
| Monthly overhead | +$700 | -$1,500 |
| Build cost | +$625 | -$1,458 |
| Model cost per task | +$30 | -$42 |

Four readings:

1. **The benefit assumptions dominate.** Minutes saved, the hourly cost and the volume swing the result by tens of thousands; the model price moves it by about $40. Do not argue about token prices; argue about minutes saved.
2. **Success rate matters through the takeover cost** (lesson 49's finding again).
3. **'About 100 percent positive' is a statement about our ranges,** not about the world. If minutes saved is really 2, the case changes. The ranges themselves are assumptions, so the pilot's job is to replace the widest ones with measurements.
4. **Be honest about what 'saved time' is.** Engineer minutes saved are only cash if headcount or overtime falls. Otherwise they are **capacity**: time redeployed to other work, which is valuable but is a different claim. State which you are claiming.

**Worked example**

```text
Most likely month: benefit $59,400, cost $12,453, net $46,947
Net per month, 10th / 50th / 90th percentile: $22,604 / $42,120 / $66,435
Chance the month is net positive: 100%   median payback of the build: 1.2 months
```

**Common mistake**

Presenting the point estimate alone. The one number invites 'what if you are wrong by half?', and you should have answered before being asked.

**Check yourself.** In the tornado, which input matters most and which least, and what does that tell you about where to spend argument?

<details><summary>Model answer (write yours first)</summary>

Minutes saved per success matters most (about plus or minus $29,700) and model cost per task least (about $40). Spend the argument and the pilot measurement on the benefit assumptions, not on token prices.

</details>

---

## Part 3 · The one-page case and the questions you will be asked

Put it on one page:

| Section | Content |
|---|---|
| Decision requested | Approve a 6-week pilot costing $X, with a go or stop review on a date |
| Problem and baseline | 38 minutes median from ticket to cause, 212 tickets in 8 weeks, measured from the ticket system |
| Benefit | Minutes saved per success, tasks per month, hourly cost, and the stated conversion (cash or capacity) |
| Cost | Build; run (model, hosting, monitoring); people taking over failures; evaluation and review time |
| Result | Net per month with a range; payback; probability positive under the stated ranges |
| Sensitivity | The tornado: the three inputs that matter most and how the pilot will measure them |
| Risks | The two or three top risks from the register (lesson 67) and the guardrail metric |
| Decision rule | Proceed if the pilot shows at least N minutes saved and success at least P; stop otherwise |

Questions to prepare for:

- 'Where does the 12 minutes come from?' (the pilot, a stopwatch sample, ticket timestamps)
- 'Will headcount drop?' (be direct about capacity versus cash)
- 'What if the model price doubles or the model is retired?' (the tornado shows price barely matters; the exit plan in lesson 66 covers retirement)
- 'What if people do not use it?' (the adoption metrics and kill criterion)
- 'What is the downside?' (the failure takeover cost and the guardrail)

Update the case after the pilot with measured values, and keep the original: the gap between predicted and measured is how you earn trust for the next case.

**Worked example**

Fictional sentence to close: 'We are asking for six weeks and $18,000, with a stop rule. The result is dominated by one number we have not measured, so the pilot measures it first.'

**Common mistake**

Hiding the weakest assumption. Name it on the page; it builds credibility and tells the pilot what to measure.

**Check yourself.** Why keep the original business case after the pilot, and what do you do with the gap?

<details><summary>Model answer (write yours first)</summary>

The gap between predicted and measured values shows how good your estimates are; recording it earns credibility and improves the next case.

</details>

---

## Do it: lab

1. Choose one real agent idea. Write the problem and measure a baseline from real data.
2. Write the assumptions with a low, likely and high value for each, and for each say whether it is measured, estimated or guessed.
3. Compute the most likely month by hand, then adapt `roi.py` to your numbers and run the range and the tornado.
4. Write what 'saved time' means in your case: cash or capacity, and what would have to be true for it to be cash.
5. Write the one-page case with the decision requested, the range, the sensitivity, the top risks and a decision rule.
6. List the five questions you expect and your answers. Ask a colleague to ask the sixth.

**Done when:** you have a one-page business case with a measured baseline, assumptions with ranges and their sources, a range of net results, a sensitivity table showing which inputs matter most, a stated cash-versus-capacity claim, and a decision rule for the pilot.

---

## Interview check

**Question.** How would you build the business case for an AI agent?

<details><summary>A strong answer has this shape</summary>

1. A measured baseline of today's cost, then the benefit with its mechanism (minutes saved, tasks, hourly cost) and who gets the value.
2. The full cost: build, run, and the people who take over failures, not only model spend; in my model the model was about one percent of cost.
3. Every assumption as a range with its source, a simulated range of outcomes, and a sensitivity table showing which inputs matter, which are usually the benefit assumptions, not token prices.
4. A clear claim about whether time saved is cash or capacity, a decision rule, and a pilot designed to replace the widest ranges with measurements.
5. I keep the original case and compare it to the measured results afterwards.

</details>

---

## Evidence to keep

Keep the baseline, the assumptions table with sources, the simulation and tornado output, the one-page case and the questions list. They feed lessons 66 and 72.

---
