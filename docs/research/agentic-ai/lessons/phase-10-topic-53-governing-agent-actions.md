# Governing agent actions: gates, separation of duties, tiered autonomy

**Course:** Agentic AI, from first principles to production · Module 10 Security and Governance · lesson 53 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Write a one-page governance plan for the DataOps agent: which actions are allowed in dev, staging and production, which need a named approver, what stops the agent approving its own work, how credentials are limited and what is logged. Then show one rule enforced by a check that blocks, not by instructions.

> Sources (read 2026-10-02 and 2026-10-03; details and gaps in docs/research/agentic-ai): Claude Academy AI-native SDLC Playbook (read 2026-09-30 through page summaries): 'Skills as institutional knowledge' (advisory, not enforcement: back any must-comply rule with a deterministic hook), 'Hooks as approval gates' (scripts that allow, block or ask; non-negotiable controls in administrator-managed settings that developers cannot change), 'CI/CD integration' (read-only judgement tasks first; sandboxed jobs with short-lived tokens and no standing production credentials; deployment exposed as scoped tools; tiered autonomy by environment; 'the agent may act up to the production gate and cannot pass it'; rehearse rollback), 'AI in the PR review loop' (the agent cannot approve its own work); OWASP 'LLM06:2025 Excessive Agency' (read in wave 2: excessive functionality, permissions and autonomy; limit and require approval); Microsoft Learn 'What are agent identities?' (activity of agent identities is logged as AI-agent activity), lessons 23, 37, 45, 48, 51 and 52 of this course. The code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; the folder's tests passed (58 in all, covering lessons 33 to 55). Permission names, policy values, owners and approvers in it are examples for the exercise, not recommendations for your organisation. The environment policy, the three-tier values, the named approvers, the 60-minute credential ceiling and the four governance rules are our design choices for the exercise, not a standard. Unverified: how any particular CI system or platform implements the checks; the SDLC Playbook is written for Claude Code users and its figures (such as time savings) are the course's own.

---

## Part 1 · Enforced gates versus advice

Lesson 35 introduced the key distinction: advice can be ignored, a gate cannot. The SDLC Playbook states it for skills ('advisory, not enforcement: back any rule that must be followed with a deterministic hook') and for settings: non-negotiable controls belong in administrator-managed configuration that developers cannot change. OWASP's Excessive Agency guidance gives the same advice from the risk side: limit the functionality, permissions and autonomy an agent has, and require a person to approve high-impact actions.

A useful test for any rule you write: **what happens if the model ignores this sentence?**

| Rule | As advice | As a gate |
|---|---|---|
| No production change without approval | A line in the prompt | The write tool is not offered in production, or the runner refuses it without a recorded approval |
| The agent may not approve its own work | A line in the prompt | The approval check compares identities and fails when approver equals requester or agent |
| Credentials are short-lived | A policy document | Credentials expire by themselves; a request for a longer lifetime is rejected |
| Every action is logged | A reminder | The action does not run if the audit record cannot be written |

Gates are cheap to write and expensive to omit. They also give you something advice never does: a **test**. You can assert that a request to break the rule fails.

**Worked example**

Fictional. A team writes 'never edit the production table without a ticket' into the agent's prompt. A model follows it 99 times and edits once. The same team makes the write tool available only through a runner that checks for a ticket id and an approval. Now the rule has a test, an audit trail and no exceptions.

**Common mistake**

Describing a control in a policy document and calling it implemented. If nothing in code would stop a violation, it is advice.

**Check yourself.** Apply the test 'what if the model ignores this sentence?' to 'only approved people may run production changes'. How do you turn it into a gate?

<details><summary>Model answer (write yours first)</summary>

Make the production write tool unavailable unless a named approver's decision is recorded for exactly that action, enforced by the runner, so ignoring the sentence still cannot run the change.

</details>

---

## Part 2 · Environments, tiers and separation of duties

**Tiered autonomy by environment** is the rule that an agent gets more freedom where the damage is small and less where it is large. The Playbook's phrase is that the agent may act up to the production gate and cannot pass it. Here is the policy for our DataOps agent as data (`policy.py`), with the values for each level of tool (lesson 52):

| Environment | read | write | approval_required |
|---|---|---|---|
| **dev** | allow | allow | allow (still logged) |
| **staging** | allow | needs approval | needs approval |
| **prod** | allow | **deny** | needs approval from a **named approver** |

Three separation-of-duties rules sit on top, all enforced by `decide(...)`:

1. **The agent cannot approve its own action.** The agent's identity is never an approver.
2. **The requester cannot approve their own request.** A second person decides.
3. **In production the approver must be on a named list,** reviewed like code. Anyone else's 'yes' is refused.

Add **credentials that expire**: each run gets a credential of at most 60 minutes (ours defaults to 15), tied to the agent's identity, and the policy refuses an expired one or one issued to a different identity. The Playbook's CI advice is the same: sandboxed jobs, short-lived tokens, **no standing production credentials**, and deployment exposed as scoped tools. Where you can, run the agent's experiments in a **sandbox** (a copy of the data, or a dry-run mode) before it touches anything real.

And log under the agent's **own identity**. Microsoft's agent-identity documentation says activity by agents appears in sign-in and audit logs as AI-agent activity. Your own audit record should name: the agent identity, the requester, the approver, the tool, the arguments, the policy decision and its reason, the time and the result, written before the action runs.

The policy function, so you can read how the rules are expressed:

```python
def decide(env, permission, *, requester, agent, approver=None, credential=None, now=None):
    if credential is None or not credential.valid(now) or credential.identity != agent:
        return False, "no valid credential for this agent identity"
    rule = POLICY[env][permission]
    if rule == "deny":
        return False, f"{permission} is not allowed in {env}"
    if rule == "allow":
        return True, "allowed"
    if approver is None:
        return False, "needs an approver"
    if approver == agent:
        return False, "the agent cannot approve its own action"
    if approver == requester:
        return False, "the requester cannot approve their own request"
    if env == "prod" and approver not in NAMED_APPROVERS:
        return False, f"{approver} is not a named production approver"
    return True, f"approved by {approver}"
```

**Worked example**

The test for the production rows: with a valid credential, a named approver (sam.reviewer) is allowed; an unnamed approver, the requester and the agent itself are each refused; a plain `write` in production is refused outright; an expired credential is refused; a 120-minute credential cannot even be issued.

**Common mistake**

Giving the agent a standing production credential 'so it is ready'. A credential that exists all the time is available to anyone who steals it at any time.

**Check yourself.** Name the three separation-of-duties rules in our policy and the credential limit.

<details><summary>Model answer (write yours first)</summary>

The agent cannot approve its own action; the requester cannot approve their own request; production approvers must be on a named list. Credentials are short-lived, with a 60-minute ceiling.

</details>

---

## Part 3 · One rule enforced by a check that blocks

The criterion asks you to show a rule enforced by a check that blocks, not by instructions. Ours is a script run in CI on every change to the tools, the registry or the policy. It exits with code 1 if any of five rules is broken:

| Rule | What it checks |
|---|---|
| **G1** | Every tool that changes data is `approval_required` in the registry |
| **G2** | Production does not allow writes, and requires approval for approval_required tools |
| **G3** | The agent's own identity is not a named production approver |
| **G4** | Credentials do not live longer than 60 minutes |
| **G5** | The registry passes its own checks (descriptions say when to use a tool, schemas forbid extra properties, owners present...) |

On the current design it passes with exit code 0. Then we made four bad changes, one at a time, and each was blocked (these are the actual findings from the tests):

```text
change: mark rerun_job as 'write' instead of 'approval_required'
  G1: rerun_job changes data but is marked 'write', not approval_required

change: set production write to 'allow'
  G2: production allows writes

change: add the agent's identity to the named approvers
  G3: the agent's own identity is a named production approver

change: allow 120-minute credentials
  G4: credentials may live longer than 60 minutes
```

The check and its tests are in the lab files. Wire it so that it **blocks the merge**: run it as a required step, and make the policy and registry files require a named human reviewer. Two cautions:

- **A check only protects what it checks.** If someone can edit the check or the policy without review, the control is as weak as the review. Protect those files the way you protect the gate itself.
- **Approvals can become theatre.** If a person approves 100 percent of requests in seconds, the gate is not a gate. Track approval rate and time to decide, and sample approved actions for review (lesson 55 covers designing the checkpoint so a person has what they need to decide).

**The one-page governance plan** for the DataOps agent, as the criterion asks:

| Question | Answer |
|---|---|
| Allowed in dev | Everything, in a sandbox; approval_required actions are logged |
| Allowed in staging | Reads freely; changes with approval from a team member |
| Allowed in production | Reads freely; **no plain writes**; approval_required actions only after a named approver (sam.reviewer, priya.owner) decides |
| Who may approve in production | The two named approvers, reviewed quarterly; never the requester, never the agent |
| What stops self-approval | `decide()` compares identities; the governance check fails if the agent is an approver |
| How credentials are limited | Per-run credentials, 15 minutes by default, 60 at most, tied to the agent identity; no standing production credentials |
| What is logged | Agent identity, requester, approver, tool, arguments, policy decision and reason, time, result; written before the action; retained per policy (lesson 54) |
| What blocks, not advises | The G1 to G5 check in CI; the policy function; the tier-limited tool set |

**Worked example**

```text
$ python check_governance.py
RESULT: pass            (exit 0)

(after a change that adds the agent to the named approvers)
BLOCKED: G3: the agent's own identity is a named production approver
RESULT: blocked         (exit 1)
```

**Common mistake**

Writing the plan as a statement of intent and stopping. The plan's last row must name what blocks, and you must have run it and seen it fail.

**Check yourself.** Which governance rule would catch a change that lets the agent approve its own actions, and how does it show up in CI?

<details><summary>Model answer (write yours first)</summary>

G3: the check fails with 'the agent's own identity is a named production approver' and exits with code 1, which blocks the merge.

</details>

---

## Do it: lab

1. Write the one-page governance plan for your DataOps agent: what is allowed in dev, staging and production; which actions need a named approver and who they are; what stops the agent approving its own work; how credentials are limited; what is logged and where.
2. Implement the policy as data and a `decide()` function (start from `policy.py`), with tests for the three separation-of-duties rules, expiring credentials and the production deny.
3. Write a check that BLOCKS (start from `check_governance.py`): at least three rules, run in CI, exiting nonzero on a violation.
4. Break each rule on purpose, one at a time, and save the output showing it blocked. Then fix each and show the pass.
5. Protect the policy, registry and check: say who must review a change to them and how that is enforced.
6. Add an approval-quality measure: approval rate and median time to decide, and how you will sample approved actions.

**Done when:** you have a one-page governance plan covering dev, staging and production, named approvers, no self-approval, limited credentials and logging; at least one rule enforced by a check that exits nonzero, shown failing on a bad change and passing after the fix.

---

## Interview check

**Question.** How do you stop an AI agent from doing something it should not in production?

<details><summary>A strong answer has this shape</summary>

1. Do not rely on instructions: put the limits in code. The agent is given only the tools its environment allows, and writes in production are denied or need a named human approver.
2. Separation of duties enforced by code: the agent cannot approve its own work, the requester cannot approve their own request, and approvers are a named, reviewed list.
3. Short-lived, scoped credentials with no standing production access, and an audit record under the agent's own identity written before each action.
4. Checks in CI that block a change that weakens any of this, with the policy and checks themselves under human review.
5. Monitoring the gate: approval rates and times, sampled reviews, and alerts on attempts to use tools that were not offered.

</details>

---

## Evidence to keep

Keep the governance plan, the policy code and tests, the blocking check, the saved failing and passing outputs for each rule, the protection note and the approval-quality measure.

---
