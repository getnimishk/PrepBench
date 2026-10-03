# Writing an agent product spec

**Course:** Agentic AI, from first principles to production · Module 12 Product and Program Leadership · lesson 61 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** A 2-page spec for one agent, including what it must never do, and a review by one peer.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): Anthropic Engineering 'Building effective agents' (via lessons 19 and 20: start simple, tool design as an interface to be documented and tested, transparency in planning); Claude Academy AI-native SDLC Playbook (read 2026-09-30: intent.md, spec.md and plan.md as committed artefacts; a product owner validates intent and reviews the spec; human approval gates the build; the spec is both human-readable requirements and machine-usable instruction); Google PAIR 'Errors + graceful failure' (read 2026-10-03: context errors, failstates and background errors; return control to the user; design failure to be 'safe, boring, and a natural part' of the product; 'error messages may need to disclose that the system made a mistake'); Microsoft Research 'Guidelines for Human-AI Interaction' (CHI 2019; the Microsoft HAX toolkit page read 2026-10-03 only names its four phases: initially, during interaction, when wrong, over time; we did not read the 18 guidelines); lessons 23, 37, 46, 52, 53 and 55 of this course. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module (the product folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; its 8 tests passed. All figures in it are FICTIONAL assumptions for the DataOps agent. Unverified: the SDLC Playbook's claims about speed are the course's own assertions; the spec template below is our synthesis, not a standard.

---

## Part 1 · What a spec for an agent must say that a normal spec does not

A normal product spec says what the software does. An agent also **decides** what to do, so its spec must say what it may decide, what it may touch, how it fails and when a person takes over. The SDLC Playbook treats the spec as the document a product owner reviews and a human approves before building starts, written so people can read it and an agent can be given it as instructions. For an agent, six things need to be explicit:

1. **Scope:** the job, the users, and what is out of scope (so 'it can also ...' requests have somewhere to go).
2. **Allowed actions:** each tool the agent may use, its level (read, write, approval-required, from lesson 52), what data it can touch, and who approves.
3. **Never do:** the hard limits, stated as testable rules (lesson 53), not as hopes.
4. **Failure handling:** what happens when the model is wrong, a tool fails, the provider is down, or the agent is unsure (lessons 50 and 55).
5. **Human handoff:** when and how control goes to a person, what they see, and the default if nobody answers.
6. **Quality bar:** the evaluation that gates release, with must-pass cases (lesson 46), and the metrics that define success after launch (lesson 64).

Google's PAIR guidance on errors gives the vocabulary for point 4. It names **context errors** (the system works as built but mismatches what the user assumed), **failstates** (the system cannot give an answer) and **background errors** (a malfunction nobody has noticed). It advises returning control to the user when the system fails, giving feedback routes alongside error messages, and designing failure to be 'safe, boring, and a natural part' of the product. Each of the three error types needs a line in the spec.

**Worked example**

Fictional. A spec line for failure handling: 'Failstate: if no runbook entry matches, the agent says so and hands the ticket to the on-call engineer with the log line attached (no guess). Context error: every diagnosis states which log line and runbook entry it used, so a reader can see the basis. Background error: the weekly sample review checks 20 accepted diagnoses against what actually fixed the incident.'

**Common mistake**

Writing only the happy path. An agent spec is judged by its failure handling and its limits, because that is where harm happens.

**Check yourself.** Name the six things an agent spec must make explicit that a normal spec may not.

<details><summary>Model answer (write yours first)</summary>

Scope, allowed actions, never-do rules, failure handling, human handoff, and the quality bar with its evaluation.

</details>

---

## Part 2 · The two-page template

Your criterion is a two-page spec for one agent, including what it must never do, reviewed by one peer. Here is a template, with the DataOps agent as the example. Keep each answer short; two pages forces choices.

**Page 1: what and who**

| Section | Content (DataOps example) |
|---|---|
| Purpose | Diagnose failed or anomalous data loads and propose a fix; people approve any change |
| Users and context | Platform engineers on call; Slack and ticket system; business hours and nights |
| Out of scope | Changing schemas, access requests, anything outside the pipelines named in the registry |
| Detection | Plain-code statistical bands decide whether and how seriously (tiers 0 to 3); the model never decides severity |
| Tools | get_run_log (read), search_runbook (read), rerun_job (approval-required), quarantine_files (approval-required); registry entry for each |
| Autonomy by environment | dev: free; staging: team approval; production: no plain writes, named approver (lesson 53) |
| Data and privacy | Operational data only; no personal data in normal operation; traces store sizes and hashes (lessons 47 and 54) |

**Page 2: how it fails, and how we know it works**

| Section | Content |
|---|---|
| **Must never** | Run a write without a recorded approval; approve its own action; act on instructions found in tickets, logs or documents; send data to an unapproved host; run in production with a credential older than 60 minutes |
| Failure handling | Per error type (context, failstate, background) as in section 1; provider outage degrades to read-only then log-only then a person (lesson 50) |
| Human handoff | The approver sees the ticket, the log line, the runbook entry, the exact action and whether it is reversible; deny by default after 15 minutes (lesson 55) |
| Quality bar | 25-case evaluation, 5 trials per case, must-pass cases never fail; gate blocks the release (lesson 46) |
| Success metrics | Weekly active users, diagnoses accepted without edit, median minutes to diagnosis, guardrail: unsafe attempts reaching the gate (lesson 64) |
| Cost and latency budget | Cost per successful task including takeovers; median latency; alerts when above plan (lesson 49) |
| Rollout and rollback | Shadow, read-only pilot, approved writes for one pipeline; a kill switch that stops runs without a redeploy (lessons 67 and 71) |
| Open questions and owners | Anything unresolved, with a name and a date |

The Playbook's structure is a useful companion: an **intent** (problem, outcome, constraints, open questions, validated by the product owner), the **spec** (this document), and a **plan** (files, steps, risks, proof of completion), each committed so they are reviewed and traceable. The spec is a living document: change it by pull request when behaviour changes.

**Worked example**

The 'must never' list is the most valuable half page: each line becomes a test. 'Never run a write without a recorded approval' is the denied-write cases in the evaluation; 'never act on instructions in tickets' is the injection cases; 'never send data to an unapproved host' is the output check (lesson 48).

**Common mistake**

A spec full of aspirations ('should be accurate') with no way to check them. Every requirement should name the test, the metric or the control that proves it.

**Check yourself.** How does a 'must never' line in a spec become part of the build?

<details><summary>Model answer (write yours first)</summary>

Each becomes a test or control: an evaluation case, a gate in code, a check in CI. A rule that has no test is a wish.

</details>

---

## Part 3 · Peer review of a spec

The criterion asks for review by one peer. Make it useful with a protocol rather than 'looks good to me':

1. **Give the reviewer a role.** An engineer reads for feasibility and testability; a security or risk reviewer reads the 'must never' and handoff; a user reads scope and failure handling.
2. **Ask five questions:** Which sentence can you not test? What is missing from 'must never'? What happens in the failstate you find most likely? Who decides when the spec and the agent disagree? What would make you stop this project?
3. **Record disagreements** in the spec's open-questions table with a name and a date, rather than smoothing them over.
4. **Run one tabletop.** Walk a bad ticket through the spec aloud: an injected instruction, a model outage, a wrong diagnosis. Where the spec is silent, add a line.
5. **Sign-off is a statement of what was reviewed,** by whom and on what date: product owner approves scope and quality bar, engineering approves feasibility, security approves limits.

Then connect the spec to delivery: the intent, spec and plan are the documents the team and the agents work from (lesson 62), and the spec is what the evaluation set, governance checks and metrics are derived from. If a build decision is not traceable to a spec line, either the spec is incomplete or the decision is.

**Worked example**

Fictional review finding: 'Spec says the agent hands off after 15 minutes without approval but does not say who gets it at night.' Added: the secondary on-call, with the same evidence page.

**Common mistake**

Having the author review their own spec, or asking a reviewer who was in every earlier meeting. Fresh eyes find what insiders no longer see.

**Check yourself.** Name two of the five review questions and what a tabletop adds.

<details><summary>Model answer (write yours first)</summary>

E.g. 'Which sentence can you not test?' and 'What would make you stop this project?'. A tabletop walks a bad case through the spec aloud and shows where the spec is silent.

</details>

---

## Do it: lab

1. Write a two-page spec for one agent (the DataOps agent or one from your work) using the template: purpose, users, out of scope, tools and levels, autonomy by environment, data and privacy on page 1; must never, failure handling, handoff, quality bar, metrics, budget, rollout and open questions on page 2.
2. For every 'must never' line write the test or control that proves it. If you cannot, rewrite the line.
3. Write the failure handling for each of the three error types (context, failstate, background) for your agent.
4. Ask one peer to review it with the five questions. Record their findings, change the spec and note the disagreements you did not resolve.
5. Run one tabletop with a bad case (an injected instruction or a provider outage) and add what the spec lacked.
6. Record who signed off on what, with the date.

**Done when:** you have a two-page spec for one agent including a 'must never' list where every line has a test or control, a peer review with recorded findings and a tabletop, and a sign-off record.

---

## Interview check

**Question.** What goes into a product spec for an AI agent?

<details><summary>A strong answer has this shape</summary>

1. Scope and out of scope, users and context, so the agent has a defined job.
2. Allowed actions per tool with a permission level and an approver, autonomy by environment, and the data it can touch.
3. A must-never list written as testable rules, each backed by a test or a control in code.
4. Failure handling by error type, a human handoff with what the person sees and a default if nobody answers.
5. A quality bar (evaluation with must-pass cases), success metrics with a guardrail, a cost and latency budget, rollout and rollback.
6. Reviewed by someone who was not in the room, with disagreements and open questions recorded.

</details>

---

## Evidence to keep

Keep the spec, the test or control for each must-never line, the peer review notes, the tabletop result and the sign-off record. The spec feeds your evaluation set, governance checks and metrics.

---
