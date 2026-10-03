# AI product discovery & problem validation

**Course:** Agentic AI, from first principles to production · Module 12 Product and Program Leadership · lesson 60 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** For one real problem, write a validation plan with 5 user questions, a baseline measure and a kill criterion.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): Google PAIR, 'People + AI Guidebook', chapter 'User needs + defining success' (read 2026-10-03 through a page summary: reframe from 'can we use AI for X' to 'how might we solve this problem, and can AI solve it in a unique way'; where AI adds value; automate versus augment; 'often a rule or heuristic-based solution will work just as well, if not better'; when not to use AI; weigh false positives against false negatives; imagine negative consequences before launch); Microsoft Learn Cloud Adoption Framework 'AI strategy' (page dated 2026-06-26, updated 2026-10-01: start from business problems, translate them into use cases, classify as individual work or business automation, consider generative against non-generative AI); Claude Academy AI Fluency lesson 2 (automation, augmentation, agency) and lessons 19 and 20 of this course (the ladder from plain code to an agent). Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module (the product folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; its 8 tests passed. All figures in it are FICTIONAL assumptions for the DataOps agent. Unverified: any claim about how often AI projects fail or succeed (we read no source for it and make none); the interview question wording in section 3 is our practice.

---

## Part 1 · Start from the problem, then climb the ladder

Product discovery for an AI feature begins with the same discipline as any product: a real problem for a real person. Google's People + AI Guidebook says to reframe the question from 'can we use AI for X?' to 'how might we solve this problem, and can AI solve it in a unique way?' Microsoft's AI strategy guidance sequences it the same way: start with business problems (where results miss expectations, where people spend time on repetitive tasks), turn each into a short use case that names the activity and the expected result, and only then consider the technology.

The Guidebook gives the honest caution that matters most to a product owner: **often a rule or heuristic-based solution will work just as well, if not better.** It lists where AI tends to add value (personalised recommendations, predicting events, language tasks, recognising classes of things, detecting patterns that evolve, generating content) and when to avoid it: when predictability is critical, the information is static, the cost of errors is prohibitive, complete transparency is required, or speed to market outweighs what AI would add.

Combine that with lesson 20's ladder and you have a discovery tool. For each candidate use case, climb only as high as the evidence forces you:

1. **Plain code or a rule.** Would a rule do? (Quota error: page on-call.)
2. **One model call.** Is it a single judgement on text (classify, summarise)?
3. **A workflow** of fixed steps with a model in some.
4. **An agent** that chooses its own steps, which is justified only when the steps cannot be known in advance and the risk is acceptable.

Microsoft's guidance adds a second axis: classify the use case as **individual work** (improving how people work inside existing tools, such as writing help) or **business automation** (changing how the organisation operates, such as routing or forecasting, usually needing integration), and consider whether it needs **generative** AI (outputs vary, inputs are unstructured) or **non-generative** AI (consistent, repeatable, structured inputs, good for prediction and anomaly detection). Our DataOps agent mixes both: plain-code anomaly detection (non-generative, deterministic) decides *whether* something is wrong, and a model explains and proposes (lesson 37).

**Worked example**

Fictional discovery note. Problem: 'platform engineers spend about 40 minutes per failed-load ticket finding the cause'. Candidate solutions up the ladder: (1) a rule for the three most common codes handles 55 percent of tickets with no model; (2) one model call to summarise the log handles another 20 percent; (3) a workflow adds the runbook lookup; (4) an agent is considered only for the remaining 25 percent where the cause is not in the runbook. The rule and the call ship first.

**Common mistake**

Starting from 'we need an agent'. That fixes the answer before the problem is understood. Start from the person's task and let the ladder decide.

**Check yourself.** What does the People + AI Guidebook say about rules versus AI, and what is the ladder you apply because of it?

<details><summary>Model answer (write yours first)</summary>

Often a rule or heuristic will work as well or better, so check that first. The ladder is: plain code or rule, one model call, a workflow, then an agent only when the steps cannot be known in advance.

</details>

---

## Part 2 · A validation plan: five questions, a baseline, a kill criterion

Your criterion asks for a validation plan for one real problem with five user questions, a baseline measure and a kill criterion. A plan is a set of decisions made **before** you build, so that evidence can change your mind.

**1. Five questions for the people who have the problem.** (This is our practice, not a sourced method.) Ask about what they **did**, not what they would like. Questions about the past are checkable; opinions about the future are cheap. A set that works for the DataOps problem:

1. Tell me about the last failed load you handled: what happened, in order?
2. Where did the time go? Which step took longest?
3. What did you check first, and where did you look it up?
4. When did you last get it wrong or hand it on, and what did that cost?
5. What do you do today when the runbook does not cover it?

Listen for specifics (tools, minutes, names of systems). Avoid leading questions ('would an AI assistant help?'), and do not pitch.

**2. A baseline you can measure now.** Without it, 'faster' means nothing later. Choose one or two numbers from data you already have: median minutes from ticket created to cause identified, and the share of tickets handed to a second person. Pull them from the ticket system for the last 8 weeks and record the date, the query and the sample size. If you cannot measure the baseline, measuring it is the first task.

**3. A kill criterion.** The point at which you stop, written in advance, with a date and an owner. For example: *'After a 6-week pilot with 8 engineers, if fewer than 50 percent of diagnoses are accepted without edit, or the median time to diagnosis is not at least 30 percent better than the 38-minute baseline, we stop and write up what we learned. The product owner decides on the review date; the data comes from the audit log and ticket history.'* A kill criterion is not pessimism. It is what lets the team and the sponsor commit, because the cost of being wrong is bounded.

The PAIR guidance on evaluating a need fits here too: weigh false positives against false negatives for this task (a wrong diagnosis that is accepted costs more than a missed one that a person catches), look at who is affected and whether anyone is excluded, and **imagine the negative consequences before launch**.

**Worked example**

```text
Validation plan: DataOps triage agent
Problem: median 38 minutes from ticket to identified cause (ticket system, 8 weeks, 212 tickets, queried 2026-10-03).
Questions: the five above, asked of 6 engineers, in person, past tense.
Pilot: 8 engineers, 6 weeks, read-only diagnosis only.
Kill: accepted-without-edit below 50 percent, or median time not 30 percent better than 38 minutes -> stop and write up. Decider: product owner, review date 2026-12-01.
Negative consequences imagined: a wrong diagnosis accepted by a junior engineer; mitigation: cite the log line and runbook entry in every diagnosis.
```

**Common mistake**

Writing the kill criterion after the pilot. A threshold chosen after seeing the result is a justification, not a test.

**Check yourself.** What three things must a validation plan fix before any build, and why must the kill criterion be written first?

<details><summary>Model answer (write yours first)</summary>

The questions you will ask and of whom, a measurable baseline, and a kill criterion with a date and a decider. Writing it first prevents choosing a threshold to fit the result.

</details>

---

## Part 3 · What counts as evidence, and the decision record

Not all evidence is equal, and a product owner should know which is which.

| Evidence | Strength | Weakness |
|---|---|---|
| Logs and system data (tickets, timestamps) | Objective, large, already exists | Shows what happened, not why |
| Observation (watching someone do the task) | Shows real behaviour and workarounds | Small samples; people act differently when watched |
| Interviews about past events | Explains why; surfaces unknown steps | Memory is imperfect; a few people may not represent everyone |
| Opinions about a proposed solution | Cheap to gather | The weakest: people are poor at predicting what they will use |
| A cheap prototype in real use | Tests the real behaviour | Costs effort; may bias the sample if only enthusiasts volunteer |

Combine at least two kinds: use logs to find where the pain is and interviews to learn why. Be explicit about **sample size**: six interviews can reveal a problem, not prove its size. State both, and size the problem from the logs.

End discovery with a **decision record** of one page: the problem and who has it; the baseline; the options considered up the ladder, with the one chosen and why; the riskiest assumption (for the DataOps agent: 'engineers will trust and use a diagnosis'); how the pilot tests it; the kill criterion; and the date to decide. That page is what you take to a sponsor, and what you read again at the review date to see whether you did what you said.

**Worked example**

Fictional riskiest-assumption statement: 'Engineers will accept the agent's diagnosis if it cites the log line and the runbook entry.' The pilot tests it directly through the accepted-without-edit rate, and the kill criterion says what rate means we were wrong.

**Common mistake**

Treating enthusiasm in interviews as demand. People say a tool sounds useful and then do not open it. Measure use, not praise.

**Check yourself.** Why combine logs and interviews, and what does a small interview sample not tell you?

<details><summary>Model answer (write yours first)</summary>

Logs show what happened and how big the problem is; interviews explain why. A few interviews can reveal a problem but cannot prove how common it is.

</details>

---

## Do it: lab

1. Choose one real problem from your work where someone proposes AI. Write it as a problem for a named group of people, with the evidence that it exists.
2. Climb the ladder: write what a rule, one model call, a workflow and an agent would each do for it, and which you would ship first and why.
3. Write five past-tense questions for the people who have the problem. Ask two of them in person if you can, and write what you heard (specifics, not opinions).
4. Measure a baseline from data you already have. Record the query, the period, the sample size and the date.
5. Write the kill criterion with a threshold, a date and a named decider. Write the riskiest assumption and the negative consequences you can imagine.
6. Put it on one page as a decision record and ask one colleague to challenge it. Record what changed.

**Done when:** you have a validation plan for one real problem with five questions, a measured baseline, a kill criterion fixed in advance with a date and decider, a riskiest assumption, and a one-page decision record that someone has challenged.

---

## Interview check

**Question.** How do you decide whether an AI feature is worth building?

<details><summary>A strong answer has this shape</summary>

1. I start from the person's problem and the evidence it exists, not from the technology, and I climb the ladder: a rule, one model call, a workflow, and an agent only if the steps cannot be known in advance.
2. I check the cases where AI is a poor fit: predictability needed, static information, a high cost of error, a need for full transparency.
3. I fix a baseline I can measure and a kill criterion with a date before building, so the pilot can change my mind.
4. I name the riskiest assumption and design the pilot to test it, and combine logs, interviews and a small real-use prototype.
5. I record the decision on one page and revisit it on the review date.

</details>

---

## Evidence to keep

Keep the problem statement, the ladder analysis, the five questions with what you heard, the baseline and its query, the kill criterion and the decision record.

---
