# Azure & Databricks platform interview drills

**Course:** Agentic AI, from first principles to production · Module 14 Interviews · lesson 75 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Answer 15 platform questions aloud, each naming the specific service and one tradeoff, with any uncertainty flagged rather than bluffed.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): The platform lessons of this course: 51 (identity), 56 to 59 (Azure and Databricks agent platforms) and the retrieval lessons 27 and 32, with the primary sources they cite (Microsoft Learn Foundry Agent Service overview read 2026-09-25 and 2026-10-03; Databricks documentation for Agent Bricks read 2026-09-30). Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The drill helpers (the question bank, the self-scoring functions and the story and case-study checks) were written by us and run on Python 3.14.7; their 9 tests passed. They check that evidence is present and count what you recorded; they do not judge the quality of an answer. Platform features change quickly. The questions point to lessons, and the lessons carry the dates of what we read. We ran no Azure or Databricks account, so every answer you give from this course is 'what I read and designed', not 'what I operated'. Unverified: any current feature, name or limit; check the vendor documentation before relying on an answer.

---

## Part 1 · How platform drills differ, and the rule about uncertainty

A platform question asks you to name a **specific service**, describe what it does, and give **one tradeoff**. The criterion adds a rule that matters: *any uncertainty is flagged rather than bluffed.* In a platform interview the interviewer usually knows the product better than you. Bluffing is detected in seconds and costs the whole interview; flagging is respected.

The 15 questions:

| ID | Question | Lesson that covers it |
|---|---|---|
| P01 | Which Azure service hosts a managed agent, and what is the tradeoff against hosting your own code? | 57 |
| P02 | How does an agent authenticate to an Azure resource without a stored secret? | 51 |
| P03 | What is the difference between delegated and application permissions? | 51 |
| P04 | Where do traces go on Azure and what would you look at first? | 47 |
| P05 | How does Azure AI Search help with access control in RAG? | 27 |
| P06 | What does a budget alert on Azure do and not do? | 56 |
| P07 | What is Unity Catalog's role for agent tools on Databricks? | 58 |
| P08 | What permission runs a Unity Catalog function as a tool? | 58 |
| P09 | What limit does a Databricks vector index have for per-user access? | 32 |
| P10 | How would you evaluate an agent on Databricks? | 58 |
| P11 | Delta Sync index: what does it need from the source table? | 32 |
| P12 | Service principal versus on-behalf-of: when each? | 58 |
| P13 | How do you keep an Azure or Databricks agent project from surprising you on cost? | 56 |
| P14 | Managed agent versus custom agent: how do you choose? | 59 |
| P15 | What would you not claim about a platform feature you only read about? | 57 |

**The shape of an answer.** Service, what it does, one tradeoff, one uncertainty:

> 'On Azure, a managed agent service would host the agent for me, which saves me running the runtime and gives me platform identity and tracing; the tradeoff is less control over the loop and some lock-in. I read about this in the vendor overview and have not operated it; I would confirm the current limits before committing.'

**What you can honestly claim.** You did not run these platforms in this course. You *read* the primary documentation (dated in the lessons) and *designed* with their concepts. Say that. It is a perfectly good position for a candidate who is strong in Java, Spark and ANTLR and moving into agentic AI, and it contrasts well with a candidate who claims experience they cannot back up.

**Worked example**

Fictional flagged uncertainty that sounds strong: 'I am sure that the vector index needs a source table with change data feed for a Delta Sync index; I am not sure of the current limit on filters, and I would look it up rather than guess.'

**Common mistake**

Answering with a product name and no tradeoff. 'Use Unity Catalog' is a label; 'Unity Catalog gives one governed place for tool permissions, at the cost of needing the data and functions registered there' is an answer.

**Check yourself.** What does a good platform answer contain, and what happens to uncertainty?

<details><summary>Model answer (write yours first)</summary>

The specific service, what it does and one tradeoff; any uncertainty is flagged explicitly rather than bluffed, with how you would confirm it.

</details>

---

## Part 2 · Running the drill and keeping the facts fresh

For each of the 15 questions:

1. **Open the lesson in the table** and re-read the section and its dated sources.
2. **Check that the lesson's source is still current.** Open the vendor page, compare the date you read it, and note any change. Product names and limits in this area move quickly; we flagged one unresolved naming issue in lesson 58 for exactly this reason.
3. **Answer aloud in 90 seconds**, in the service, does, tradeoff, uncertainty shape. Record it.
4. **Score:** did you name the service, give a tradeoff, and flag at least one thing you were unsure of? A 15-for-15 with no flagged uncertainty is suspicious; you are probably bluffing somewhere.

Make a **one-page crib** to refresh the day before an interview, organised as service, purpose, tradeoff and which source to check, plus a short list of facts that change: product names, the dates you verified, and a column 'confirm before saying'. Do not memorise limits; memorise where to look.

Note that P15 asks 'what would you not claim about a platform feature you only read about?'. A good answer: that it works at scale, that it integrates with their stack, that a limit has not changed, and any performance or cost figure. You would claim what the documentation says, with its date.

**Worked example**

Fictional crib row: 'Agent hosting service: name changes possible; read 2026-09-25; confirm current name and region availability.'

**Common mistake**

Learning the answer from this course's text without checking the vendor page, which may have changed since we read it.

**Check yourself.** Why is a perfect score with no flagged uncertainty suspicious?

<details><summary>Model answer (write yours first)</summary>

Platform features have details and limits no one knows perfectly; a candidate who flags nothing is probably bluffing somewhere.

</details>

---

## Do it: lab

1. Answer all 15 questions aloud, one at a time, in the service, does, tradeoff, uncertainty shape, recording each.
2. For each, open the lesson's source and check its date; note any change since our reading.
3. Score each for service named, tradeoff given and uncertainty flagged.
4. Write the one-page crib of facts that change, with what to confirm.
5. Do a second pass on the three weakest answers.

**Done when:** you have 15 recorded answers, each naming a service and a tradeoff with a flagged uncertainty, a checked-sources note, and a one-page crib of what to confirm.

---

## Interview check

**Question.** How would you secure and govern an agent on Azure or Databricks?

<details><summary>A strong answer has this shape</summary>

1. Identity first: a platform-managed identity with the least privilege, delegated permissions when acting for a user, no stored secrets.
2. On Databricks I would use Unity Catalog as the one governed place for tool and data permissions, with the tradeoff that everything must be registered there.
3. Tracing and evaluation on the platform, and a budget alert as a notification, not a stop.
4. I would say what I have read and designed versus operated, and name what I would confirm.

</details>

---

## Evidence to keep

Keep the recordings, the scores, the checked-sources note and the crib.

---
