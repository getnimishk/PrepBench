# Agentic delivery for program leaders

**Course:** Agentic AI, from first principles to production · Module 12 Product and Program Leadership · lesson 62 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Draw the stages (plan, design, build, test, deploy, maintain) for one real team. For each stage say what an agent does, what a person approves, one leading and one lagging measure, and which written artefact (intent, spec, plan) records the decision.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): Claude Academy AI-native SDLC Playbook, all 14 lessons (read 2026-09-30 through page summaries and recorded in `courses/claude-academy-notes.md`): the six stages Plan, Design, Build, Test, Deploy and Maintain; each with a leading and a lagging measure and a named governance control; the artefacts intent.md, spec.md and plan.md; the argument that when agents write most of the code, review, testing and deployment become the bottleneck and approval gates 'still run at human speed'; evals in CI; approval gates and tiered autonomy; metrics bands and tiered responses. The notes record that the Playbook is written by Anthropic's applied AI team from customer work for engineering and platform leads using Claude Code, that its time-saving statements are the course's assertions and not measurements, and that several lessons are prescriptive rather than evidence. Lessons 46, 53, 61, 64 and 67 of this course. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module (the product folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; its 8 tests passed. All figures in it are FICTIONAL assumptions for the DataOps agent. Unverified: any claim that agent-assisted delivery is faster or cheaper in your organisation: measure it (lesson 64).

---

## Part 1 · What changes when agents do much of the work

The SDLC Playbook's central argument, which we treat as a hypothesis to test in your team and not as a measured fact, is that when agents write most of the code, **building stops being the slow part**. Review, testing and deployment become the bottleneck, because approval gates and reviews still run at human speed. The lifecycle then looks less like a line of hand-offs and more like a loop, with written artefacts (plain files in version control) that serve as both human-readable requirements and machine-usable instructions. Human accountability does not move; human attention does: away from typing the work and toward intent, risk and the flagged problems.

For a program leader the consequences are practical:

- **Plan the review capacity,** not just the build capacity. If an agent produces ten changes a day and one reviewer can approve three, the queue is your schedule risk.
- **Make the written artefacts the unit of control:** the intent (problem, outcome, constraints, open questions), the spec (lesson 61) and the plan (files, steps, risks, how completion will be proved). The Playbook has a person validate the intent, review the spec and approve the plan, and routine changes need an engineer while riskier ones need a tech lead or architect.
- **Keep what must stay human:** approving intent, accepting risk, passing the production gate. The Playbook's phrase is that the agent may act up to the production gate and cannot pass it.
- **Measure the loop,** with a leading and a lagging measure per stage, so you can tell whether it is working and where it is stuck.

**Worked example**

Fictional. A team adopts coding agents and doubles its pull requests. Cycle time does not fall because each pull request waits two days for a reviewer. The program lead adds a first-pass automated review against a written checklist, limits pull request size, and tracks time-in-review as the leading measure. The constraint moved; the plan moved with it.

**Common mistake**

Planning agent-assisted delivery as if only the 'build' box got faster. The next constraint appears at review, test and release, and your plan must resource it.

**Check yourself.** According to the Playbook's argument, what becomes the bottleneck when agents write most of the code, and what stays human?

<details><summary>Model answer (write yours first)</summary>

Review, testing and deployment (gates still run at human speed). Accountability, approving intent, accepting risk and passing the production gate stay human.

</details>

---

## Part 2 · Stages, approvals, measures and artefacts

Your criterion is a table for one real team: for each stage, what an agent does, what a person approves, one leading and one lagging measure, and which written artefact records the decision. Here is a worked version for a data platform team building the DataOps agent. It follows the Playbook's six stages and uses the artefacts and measures from this course.

| Stage | An agent does | A person approves | Leading measure | Lagging measure | Artefact that records the decision |
|---|---|---|---|---|---|
| **Plan** | Drafts an intent from a guided conversation: problem, outcome, systems, constraints, open questions | Product owner validates the intent and the kill criterion | Share of intents with a measured baseline | Initiatives stopped on evidence rather than by surprise | `intent.md` (lesson 60 decision record) |
| **Design** | Drafts the spec and flags conflicts with organisation policy | Product owner and tech lead approve the spec and the must-never list | Spec lines with a named test or control | Late-found spec gaps per release | `spec.md` (lesson 61) |
| **Build** | Proposes a plan, then writes code and tests in a read-only-first mode | Engineer (routine) or tech lead (risky) approves the plan and reviews the change | Time a change waits for review | Defects found after merge | `plan.md`, the pull request, the registry entries (lesson 52) |
| **Test** | Runs the evaluation set, tries adversarial cases, proposes new cases from incidents | Engineer approves changes to cases and baselines; security approves must-pass changes | Evaluation pass^k, must-pass failures | Escaped defects; incidents that were not an existing case | Evaluation results, the CI gate output (lesson 46) |
| **Deploy** | Prepares the release, runs the governance check, rehearses rollback | A named approver passes the production gate; the agent never does | Gate pass rate, time from approval to release | Rollbacks, change-failure rate | Release record, audit log (lesson 53) |
| **Maintain** | Watches metric bands, runs read-only diagnosis, proposes a fix | A person approves any change; findings enter the same gates through a new intent | Detection to diagnosis time | Recurring incidents, cost per successful task | Incident records, postmortems (lesson 67) |

Three points about reading such a table:

1. **Every approval column names a role, not 'the team'.** If you cannot name who approves, the control does not exist.
2. **Leading measures are what you can change this week** (time in review, spec lines with tests). Lagging measures tell you whether it worked (escaped defects, incidents). You need both.
3. **The artefact is the audit trail.** A decision that is not written down in a file under version control, with a reviewer, cannot be reconstructed later.

**Worked example**

Draw it for your own team: replace the DataOps row contents with your real stages, approvers and measures. A cell you cannot fill (no named approver, no measure) is a finding, not a blank to skip.

**Common mistake**

Copying the table without checking that each measure can actually be read from a system you have. A measure nobody can compute is decoration.

**Check yourself.** Why must each approval name a role, and what is the difference between a leading and a lagging measure?

<details><summary>Model answer (write yours first)</summary>

A named role makes the control real and auditable. A leading measure is something you can change now and that predicts results (time in review); a lagging measure shows the outcome later (escaped defects).

</details>

---

## Part 3 · Adopting it without hype

A sober adoption path for a program leader, in order:

1. **Start with read-only, judgement tasks.** The Playbook's CI advice is to begin with tasks that read and report (review, summarise, diagnose) before anything that writes, in sandboxed jobs with short-lived tokens and no standing production credentials.
2. **Write down the controls before the speed.** The spec, the must-never list, the evaluation gate and the governance check (lessons 46, 53 and 61) are what let you go faster safely.
3. **Measure before and after** on a team and a task: cycle time, time in review, defects, rework, and the cost per successful task (lesson 49). The Playbook's time claims are assertions; yours should be evidence.
4. **Watch for new failure modes:** review fatigue (approving without reading), over-trust, skills atrophy, and the hidden cost of reviewing agent output.
5. **Rehearse the unhappy path:** the agent proposes something wrong; the gate blocks it; the incident process runs (lesson 67).
6. **Report honestly:** what was faster, what was not, what the controls caught, and what you would change.

The Playbook's own suggested order for platform teams is org setup, managed settings, permissions and sandboxing, hooks and skills, enterprise deployment, then monitoring and compliance. Note what that order says: **controls come before scale.**

**Worked example**

Fictional one-paragraph status for a steering group: 'Agent-assisted changes are 38 percent of merged pull requests. Median time in review rose from 6 to 9 hours; the first-pass review checklist is cutting it back. The governance check blocked 2 unsafe changes. Cost per merged change is $4.20 including review time (range $3.10 to $6.00). Next: extend to the second repository after the evaluation gate has run clean for four weeks.'

**Common mistake**

Reporting activity ('agents wrote 1,200 changes') instead of outcomes and controls. Volume is not value.

**Check yourself.** In what order does the Playbook suggest platform teams introduce controls, and what does that order imply?

<details><summary>Model answer (write yours first)</summary>

Organisation setup, managed settings, permissions and sandboxing, hooks and skills, enterprise deployment, then monitoring and compliance. It implies controls come before scale.

</details>

---

## Do it: lab

1. Choose one real team (yours or one you know) and draw its delivery stages: plan, design, build, test, deploy, maintain.
2. For each stage fill the six columns: what an agent does, what a named role approves, one leading measure, one lagging measure, and the artefact that records the decision (intent, spec or plan).
3. Mark every cell you could not fill honestly (no named approver, no measurable indicator) as a finding with an owner.
4. Pick one stage where review capacity could become the bottleneck. Estimate the queue: changes per day versus reviews per day, and what you would do about it.
5. Write the one-paragraph steering-group status in the style of the example, using numbers you can actually obtain, with ranges where unsure.

**Done when:** you have a stage table for one real team with, for each stage, what an agent does, which role approves, a leading and a lagging measure and the recording artefact, plus a list of cells you could not fill and an estimate of the review bottleneck.

---

## Interview check

**Question.** How does delivery change when agents write much of the code, and what do you do as a program leader?

<details><summary>A strong answer has this shape</summary>

1. Building gets faster but review, testing and release do not, so I plan and measure review capacity and the queue, not just build speed.
2. I make written artefacts the unit of control: a validated intent, a reviewed spec with a must-never list, and an approved plan, all in version control.
3. I keep accountability human: named approvers at each gate, and the agent never passes the production gate.
4. I start with read-only, judgement tasks, put controls (evaluation gate, governance check) before scale, and measure before and after with leading and lagging measures.
5. I watch for review fatigue and over-trust, and report outcomes, not activity.

</details>

---

## Evidence to keep

Keep the stage table, the list of unfilled cells with owners, the bottleneck estimate and the status paragraph. They feed your rollout plan in lesson 67.

---
