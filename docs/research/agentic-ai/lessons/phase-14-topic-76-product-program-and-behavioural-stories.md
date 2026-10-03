# Product, program & behavioural stories

**Course:** Agentic AI, from first principles to production · Module 14 Interviews · lesson 76 of 77 · **about 6 hours** · paper draft for review.  
**Success criterion:** Six stories in the situation, action, result format with numbers, covering a delivery, a stakeholder conflict, an incident, a cost decision, a stopped project and a build-vs-buy call.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): The STAR structure (situation, task, action, result) is a widely used interview convention; this course uses a three-part form, situation, action, result, as the criterion states. Lessons 60 to 68 supply the leadership vocabulary (baselines, ranges, rollout, incidents, vendor decisions); Google SRE book on blameless postmortems (framing an incident story). Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The drill helpers (the question bank, the self-scoring functions and the story and case-study checks) were written by us and run on Python 3.14.7; their 8 tests passed. They check that evidence is present and count what you recorded; they do not judge the quality of an answer. THIS LESSON CANNOT SUPPLY YOUR STORIES. They must be your own real experiences. The course contains no invented stories for you to adopt, and any example below is labelled as fictional and is there to show structure only. Unverified: how any particular interviewer will score a story.

---

## Part 1 · Six stories, from your real work

A behavioural question ('tell me about a time when...') tests what you actually did, how you think and what you learned. The only stories that survive follow-up questions are **true ones**. The criterion needs six, in **situation, action, result** form with numbers, covering these kinds:

| Kind | A question it answers | Where to look in your career |
|---|---|---|
| **Delivery** | Tell me about a project you delivered under pressure | A release, a migration, a launch |
| **Stakeholder conflict** | Tell me about disagreeing with someone senior | A scope dispute, a priority clash |
| **Incident** | Tell me about something that went wrong in production | An outage, a bad deploy, a data error |
| **Cost decision** | Tell me about a time you made a cost trade-off | A tool choice, a scope cut, a cloud bill |
| **Stopped project** | Tell me about stopping something | A project you ended, descoped or declined |
| **Build vs buy** | Tell me about choosing between building and buying | A vendor evaluation, a platform choice |

You come from years of Java, Spark and ANTLR work, so you probably have most of these already, **from engineering and delivery, not from AI**. That is fine and often stronger: an incident you actually handled is better than an agent incident you simulated. Use AI stories (your agent's incident drill, your build-versus-buy scorecard) only where you can say clearly that they were a course exercise and not production, and keep real ones as the main set.

**Fictional example, to show the structure only.** *Situation:* a nightly pipeline missed its deadline for the third time in a month and finance reports were late. *Action:* I traced the delay to one join that scaled badly with a new customer, proposed a partitioning change, tested it on last month's data, and agreed a rollback with the owner before shipping it. *Result:* the run time fell from 94 to 31 minutes and no report was late in the next 8 weeks. *My part:* diagnosis, the change and the rollback plan; the data engineer ran the backfill.

**Worked example**

Check each story before you rehearse it: situation, action and result at least about eight words each, a number in the result, and a clear statement of **my part**, not 'we'. `check_story()` finds those gaps; `stories_coverage()` finds missing kinds.

**Common mistake**

Using 'we' throughout. Interviewers want to know what **you** did; say 'the team did X, I did Y'.

**Check yourself.** Which six kinds are required, and what must the result contain?

<details><summary>Model answer (write yours first)</summary>

Delivery, stakeholder conflict, incident, cost decision, stopped project and build vs buy. The result must contain a number such as time, money, count or percentage.

</details>

---

## Part 2 · Making them numbers-first and honest

The result is where stories are weakest. 'It went well' persuades no one. Find the number: **time saved, money saved or lost, count of incidents, percentage change, people affected, dates met or missed.** If you do not have a number, estimate it honestly and say it is an estimate ('about a third faster').

Four rules for the telling:

1. **Keep it under two minutes.** Situation in two sentences, action in four, result in two.
2. **Include the hard part.** What was difficult, what you got wrong. A story with no friction sounds rehearsed.
3. **Own the failures.** For the incident and stopped-project stories, say what you would do differently, and frame it blamelessly: how the system allowed it, not who slipped (the SRE book's postmortem principle).
4. **End on the result and a lesson,** not on a summary of what you just said.

**Check for honesty and for confidentiality.** Do not reveal a former employer's confidential data or names; anonymise (a 'financial services client'). Do not inflate your role or the outcome. If a number is a guess, say so. A story that survives the question 'how do you know that?' is the one to keep.

For product, program and delivery roles, borrow vocabulary from lessons 60 to 68 where it is true to what you did: a baseline you measured, a range you gave, a rollout you phased, a decision rule you wrote. If you did not do those things, do not claim the vocabulary; claim the things you did.

**Each story should answer two follow-ups in advance:** 'what would you do differently?' and 'what did you learn that you used later?'. Write both answers.

**Worked example**

Fictional 'what I would do differently' for an incident: 'I would have written the rollback step in the deployment checklist before shipping, not after the outage; I did that on the next release.'

**Common mistake**

Choosing a story because it is impressive, not because you can defend every detail.

**Check yourself.** Why include the hard part of a story and how do you frame an incident story?

<details><summary>Model answer (write yours first)</summary>

Friction makes it credible. Frame incidents blamelessly: how the system allowed it, what you changed, and not who slipped.

</details>

---

## Part 3 · Building the bank and using it

Write each story in a small structured record so you can check and sort them (the checker expects `kind`, `situation`, `action`, `result` and `my_part`). Keep them in a private file.

Then build a **map from questions to stories**, because one story answers many questions. A good incident story also answers 'tell me about a failure', 'tell me about working under pressure' and 'tell me about learning from a mistake'. Six stories mapped to twenty or so common questions is a working bank.

Practise by **speaking** them (lesson 73's method), then ask a friend to interrupt with 'why?' three times. The interruptions reveal where you are vague.

A final caution about AI help: it is reasonable to ask an assistant to tighten your wording or ask you hard follow-ups. It is **not** reasonable to ask it to invent a story, and an interviewer who spots one will end the interview. Disclose nothing false; this course's 4D idea (Diligence) applies to you as well: you are responsible for every claim in the stories.

**Worked example**

Fictional mapping: Incident story answers 'a failure', 'under pressure', 'a time you were wrong'. Build-vs-buy story answers 'a decision with incomplete information', 'a technical judgement call'.

**Common mistake**

Writing the stories once and never speaking them aloud.

**Check yourself.** Why map stories to questions, and what must you never ask an AI assistant to do with them?

<details><summary>Model answer (write yours first)</summary>

One story can answer many questions, so six cover a lot. Never ask an assistant to invent a story; it must be your own true experience.

</details>

---

## Do it: lab

1. List candidate real experiences for each of the six kinds from your own career; pick the strongest for each.
2. Write each as a record with kind, situation, action, result, and my_part; the result must have a number.
3. Run `check_story()` and `stories_coverage()` and fix what they report.
4. Add 'what I would do differently' and 'what I learned' to each.
5. Speak each in under two minutes and have someone interrupt with 'why?' three times; note where you were vague.
6. Map the six stories to at least 15 common behavioural questions.

**Done when:** you have six true stories in the required form with numbers and your own part stated, passing the checker, with reflections, a question map, and notes from a spoken rehearsal.

---

## Interview check

**Question.** Tell me about a time something went wrong in production.

<details><summary>A strong answer has this shape</summary>

1. Situation in two sentences with the stakes. Action in four: how I contained it first, then diagnosed.
2. Result with numbers: the duration, the impact and what changed after.
3. My own part, stated plainly, and what I would do differently, framed blamelessly.
4. What I learned and used later, for example putting rollback in the checklist.

</details>

---

## Evidence to keep

Keep the six stories (private), the checker output and the question map.

---
