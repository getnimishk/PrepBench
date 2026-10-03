# Running an AI program: rollout, risks & incidents

**Course:** Agentic AI, from first principles to production · Module 12 Product and Program Leadership · lesson 67 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** A phased rollout plan, a risk register with 6 agent-specific risks and owners, and a one-page incident runbook.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): NIST AI Risk Management Framework 1.0 (NIST AI 100-1, January 2023: the four functions Govern, Map, Measure and Manage; the framework is voluntary and gives outcomes, not a checklist); Google 'Site Reliability Engineering' book, chapters on managing incidents and on postmortem culture (blameless postmortems; roles during an incident; read 2026-10-03 through page summaries); Microsoft Learn Cloud Adoption Framework 'AI strategy' (2026-06-26: iterate; govern); lessons 47, 49, 51 to 55 and 64. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module (the product folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; its 8 tests passed. All figures in it are FICTIONAL assumptions for the DataOps agent. The register's ratings, owners and evidence are fictional and are judgements, not measurements. The phased rollout and the runbook are our practice, informed by the sources but not prescribed by them. Unverified: that any particular rollout percentages suit your system.

---

## Part 1 · A phased rollout: widen only when evidence says so

A rollout is a series of **gates**, each with evidence and a way back. You never go from 'it works in testing' to 'everyone'. A phased plan for the DataOps agent:

| Phase | Who | What the agent may do | Enter when | Widen when | Roll back if |
|---|---|---|---|---|---|
| **0. Shadow** | No users; it runs beside real tickets | Diagnose silently, nobody sees it | Evaluation gate passes; governance check green | 2 weeks of shadow diagnoses compared with what engineers concluded; agreement at or above the target set beforehand | A must-pass case fails, or logs contain content they should not |
| **1. Pilot** | 8 engineers who volunteered | Read-only diagnosis in their ticket | Shadow results reviewed by product owner and engineering manager | Metrics from lesson 64 meet targets for 3 weeks | Guardrail metric breaches, or accepted-without-edit below 0.5 for two weeks |
| **2. One team** | The on-call rota | Diagnosis, plus proposals for one approved rerun | Approval gate and audit log verified (lessons 51 to 53); on-call trained | No incident above severity 3 for 4 weeks | Any write without approval (severity 1) |
| **3. Second team** | Another team's pipelines | Same | Evaluation extended to their pipelines; a second approver trained | Cost per successful task within plan | Cost above plan for a week, or approval fatigue signs (lesson 53) |

Three habits make the table real:

1. **Every phase has a rollback you have tried.** The kill switch in lesson 71 is the lever; test it before you need it.
2. **Write the widen and roll-back criteria before the phase starts.** After a good week everyone wants to widen; the criteria you wrote earlier are your protection against enthusiasm.
3. **Communicate to the people in each phase** what the agent does, what it does not, how to report a problem, and who to ask.

**Worked example**

Fictional. In the pilot, week 2 shows accepted-without-edit at 0.52. The criterion says 'below 0.5 for two weeks', so the plan continues, with a note to review the most-edited diagnoses. Without a written criterion this would have been an argument.

**Common mistake**

Widening on a feeling ('it is going well'). Widen on the numbers you chose in advance, and record the decision.

**Check yourself.** Why write the widen and roll-back criteria before each phase starts?

<details><summary>Model answer (write yours first)</summary>

So the decision is made against evidence you committed to in advance, not against enthusiasm or pressure after a good or bad week.

</details>

---

## Part 2 · A risk register with agent-specific risks and owners

The NIST AI Risk Management Framework organises risk work into four functions: **Govern** (policies, accountability, culture), **Map** (understand context and what can go wrong), **Measure** (assess and track) and **Manage** (prioritise and act). It is voluntary and describes outcomes, not a checklist. We use its shape for a working document: a **risk register**, where each risk has an owner, a trigger and a mitigation that exists in code or process, and a place you can point to as evidence. (The validator demands evidence only for open risks scoring 15 or more; make it a habit for the rest.) Your criterion asks for six agent-specific risks; `risk_register.py` validates that the register covers at least six different categories, that each has an owner and a trigger, and that a high-scoring open risk has evidence.

Ratings are likelihood times impact, each 1 to 5 (our scale, a judgement, re-rated after incidents and evaluations):

| ID | Risk | L x I | Score | Owner | Trigger | Mitigation in place | Evidence |
|---|---|---|---|---|---|---|---|
| R1 | Prompt injection steers an unauthorised action | 4 x 4 | **16** | Security lead | A run requests a tool it was not offered; an approval is denied | Tier-limited tools, strict schemas, approval gate | Evaluation cases C23 and C24; injection demo |
| R2 | A write tool is added or loosened without approval | 3 x 5 | **15** | Engineering manager | Governance check fails in CI | Registry permission levels, policy as data, check blocks the merge | The governance check and four blocked bad changes |
| R3 | Restricted text reaches someone who should not see it | 3 x 5 | **15** | Data owner | Two-user access test fails; content in traces | Filter before ranking; sizes-and-hashes tracing | Two-user test; trace policy |
| R4 | A confident wrong diagnosis is acted on | 4 x 3 | **12** | Product owner | Accepted-without-edit falls; must-pass fails | Citations, abstention, gate, approval for writes | 25-case evaluation, pass^5 |
| R5 | Provider outage during a failure window | 3 x 3 | **9** | Platform on-call | Breaker opens; queue age over 5 minutes | Queue, breaker, idempotency, degrade path | Outage simulation, runbook drill |
| R6 | Model version retired or behaviour changes | 4 x 3 | **12** | Engineering manager | Deprecation notice; evaluation drop | Evaluation gate, client abstraction, quarterly check | Evaluation rerun on a second model |
| R7 | Tokens per task grow and cost passes budget | 3 x 2 | **6** | Program manager | Cost per successful task above plan for a week | Turn and token limits, trace review, budget alerts | Trace before and after (lesson 47) |

How to keep it alive: review it **monthly and after every incident**, move risks between open, mitigated and accepted deliberately (accepting is a decision with a name on it), and add the risks that incidents reveal. A register that never changes is not being read.

**Worked example**

```python
def validate(risks):
    ...
    if r.score >= 15 and r.status == 'open' and not r.evidence:
        f.append(f'{r.id}: a high risk needs evidence that the mitigation works')
    if not r.trigger:
        f.append(f'{r.id}: say what you would observe if it were happening')
```

**Common mistake**

Listing generic risks ('data quality', 'budget') instead of agent-specific ones, and listing mitigations that are intentions, not controls you can demonstrate.

**Check yourself.** What are NIST AI RMF's four functions, and what three things must each risk in our register have beyond a description?

<details><summary>Model answer (write yours first)</summary>

Govern, Map, Measure, Manage. Each risk has an owner, an observable trigger, and a mitigation with evidence it works.

</details>

---

## Part 3 · Incidents: a one-page runbook and a blameless review

Things will go wrong. What distinguishes a well-run program is that the response was **decided in advance**. The SRE book's incident-management guidance stresses clear roles and a single place to coordinate, and its postmortem guidance stresses a **blameless** culture: focus on how the system allowed the failure, not on who made the mistake, so people report problems early. A one-page runbook for an agent incident (our practice):

| Step | What happens |
|---|---|
| **1. Detect** | Alert, a user report, or a metric trigger from the register. Anyone can declare an incident |
| **2. Classify** | Severity 1: an unapproved write, data exposure, or harm. Severity 2: wrong answers accepted at scale, or an outage of the service. Severity 3: degraded quality or cost overrun |
| **3. Contain first** | Flip the kill switch (stops runs without a deploy) or disable the write tool. Containment comes before diagnosis |
| **4. Roles** | An incident lead who decides; an operator who acts; a communicator who updates stakeholders. One person should not hold all three where you can avoid it (our practice; the SRE guidance supports clear roles, not this exact rule) |
| **5. Communicate** | A short message at each change: what we know, what we do not, what we did, next update time |
| **6. Diagnose** | Use the trace and audit log (lessons 47 and 53), which hold ids and sizes, not content |
| **7. Recover** | Fix, run the evaluation gate on the fix, widen again only with the rollout criteria |
| **8. Review** | A blameless review within 5 working days: timeline, what the controls did, what they missed, actions with owners and dates |

**Run a drill** of the runbook once before launch: someone injects a fake severity 1, and you time how long containment takes. You will find the phone number that is wrong and the person who does not know where the switch is.

In the review, ask what changes the **system** and not only what a person should do next time: a new case in the evaluation set, a new trigger in the register, a tightened control. Add the incident to the register, re-rate the risk, and tell the people in the rollout what changed.

**Worked example**

Fictional message at step 5: 'Severity 2. The agent is proposing reruns for the wrong pipeline after a registry change. We have disabled rerun proposals; read-only diagnosis continues. No data was changed. Next update 15:30.'

**Common mistake**

Diagnosing first and containing later. Stop the harm, then find out why.

**Check yourself.** What comes before diagnosis in the runbook and why, and what does a blameless review focus on?

<details><summary>Model answer (write yours first)</summary>

Containment, so harm stops while you investigate. A blameless review focuses on how the system allowed the failure and what to change in it, not on who erred.

</details>

---

## Do it: lab

1. Write a four-phase rollout plan for an agent you might launch, with who, what it may do, entry, widen and roll-back criteria for each phase.
2. Test your rollback lever (a kill switch or a disabled tool) and record how long it took.
3. Write a register of at least 7 agent-specific risks with likelihood, impact, an owner, a trigger, a mitigation and evidence. Run `risk_register.validate`.
4. Pick your two highest risks and write what would make you re-rate them.
5. Write the one-page incident runbook with severities, roles and the messages for severity 1 and 2.
6. Run a 20-minute drill of the runbook with one other person and write what was wrong.

**Done when:** you have a phased rollout with written widen and roll-back criteria, a tested rollback, a register of 7 risks that passes the validator, a one-page incident runbook, and notes from one drill.

---

## Interview check

**Question.** How would you run the rollout and risk management of an AI agent?

<details><summary>A strong answer has this shape</summary>

1. Phased: shadow, pilot, one team, second team, each with entry, widen and roll-back criteria written beforehand and a rollback lever I have tried.
2. A risk register using the NIST AI RMF shape, with agent-specific risks (injection, excessive agency, leakage, wrong answers, outages, model retirement, cost), each with an owner, a trigger, a mitigation and evidence.
3. A one-page runbook that contains first, then diagnoses, with named roles and short updates, and a blameless review that changes the system.
4. A drill before launch, and the register re-rated monthly and after every incident.

</details>

---

## Evidence to keep

Keep the rollout plan, the register, the runbook and the drill notes. They feed the case study in lesson 72.

---
