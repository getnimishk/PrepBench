# Safe actions: read-only first, least privilege, approval gates

**Course:** Agentic AI, from first principles to production · Module 4 Agent Core · lesson 23 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Classify 8 tools as read-only, reversible write or irreversible write. For a ticket agent design the permission for each and mark which need approval, then implement one approval gate that blocks an action until a person approves it and logs the decision.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): OWASP Gen AI Security Project, 'LLM06:2025 Excessive Agency' (the definition, the three root causes, the prevention measures); Claude Academy AI-native SDLC Playbook, lessons on plan mode, hooks as approval gates and CI/CD integration (read-only first, advisory versus enforced controls, the agent cannot approve its own work, tiered autonomy, short-lived credentials); Anthropic 'Prompting best practices' ('Balancing autonomy and safety'), read 2026-10-02 through page summaries. The reference code on this page was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1 against a scripted stand-in for the model (11 tests passed). It uses the same message shapes as Anthropic's documented Messages API, but it has not been run against the real API, because that needs a key and spends money. The eight-tool exercise, the permission table and the answer key are ours and fictional. The SDLC course is written for Claude Code users and for large organisations; its statements are the course's prescriptions, not measurements. Unverified: that a gate stops all misuse. It stops the actions it covers; it cannot cover actions nobody thought to classify.

---

## Part 1 · Why read-only comes first

A model that can only read can be wrong, but it cannot break anything. A model that can write can be wrong and act on it. So build in order: give an agent read-only tools first, prove it on real tasks, then add writes one at a time, each with a control. The SDLC course makes the same point for coding agents: start in read-only planning, approve a plan, and only then allow changes.

OWASP names the risk 'Excessive Agency': a system takes damaging actions in response to unexpected, ambiguous or manipulated model output. Its three root causes are:

1. **Excessive functionality:** the agent has tools it does not need.
2. **Excessive permissions:** its tools have wider access than the task needs.
3. **Excessive autonomy:** it can act without a check or a person.

The model can be wrong through hallucination, a badly written prompt, or an injected instruction, so the controls must not depend on the model behaving.

**Worked example**

Fictional. A ticket assistant needs to read tickets and add comments. Giving it a general database connection 'for convenience' means one confused or manipulated reply could delete rows.

**Common mistake**

Giving an agent the same access as its developer because it is easier to set up.

**Check yourself.** Name OWASP's three root causes of excessive agency.

<details><summary>Model answer (write yours first)</summary>

Excessive functionality (too many tools), excessive permissions (too much access per tool) and excessive autonomy (acting without a check).

</details>

---

## Part 2 · Classify every tool: three classes

Before an agent gets a tool, put it in one of three classes. The class decides the control:

| Class | What it does | Default control |
|---|---|---|
| **Read-only** | Looks, changes nothing | Allowed, with least-privilege access, logged |
| **Reversible write** | Changes data, but the change can be undone cheaply (an added comment, a draft) | Approval at first; automatic later only if measured safe, with an undo path |
| **Irreversible write** | Cannot be undone, or affects others (sending money or email, deleting, deploying) | A person approves every time; consider not giving it to the agent at all |

Design each tool's permission as narrowly as possible: a tool that updates one field of one record type is safer than a generic 'run SQL' tool. OWASP's measures say the same: minimise the number of tools, minimise what each can do, avoid open-ended tools such as a raw shell or free URL fetch, minimise permissions, run actions in the user's own context with minimal OAuth scopes, require human approval for high-impact actions, validate every downstream request against policy, and sanitise inputs and outputs.

**Worked example**

Fictional. 'search_kb' is read-only. 'add_comment' is a reversible write. 'refund_customer' is an irreversible write and needs approval every time, with a limit on the amount.

**Common mistake**

Treating 'reversible' as 'safe'. A comment that emails a customer cannot be unsent.

**Check yourself.** Which class is 'send an email to a customer', and what control applies?

<details><summary>Model answer (write yours first)</summary>

Irreversible write: it cannot be unsent and affects someone outside. Require a person's approval every time.

</details>

---

## Part 3 · Approval gates in code, not in the prompt

You can write 'ask before doing anything destructive' in the prompt. Anthropic's prompting guide even gives a sample paragraph asking the model to confirm risky actions. That is **advisory**: the model usually follows it, but it can be talked around, forgotten in a long chat, or overridden by an injected instruction. The SDLC course makes this distinction central: back any must-comply rule with a deterministic check that runs in code. A gate is code that sits between the model's request and the action and blocks it until a person says yes. It also follows the rule that an agent cannot approve its own work.

```python
"""An approval gate: a write runs only if a person says yes, and every decision is logged."""
import json
import time


class ApprovalGate:
    def __init__(self, ask, log_path=None):
        self.ask = ask                      # a function (tool_name, args) -> bool, answered by a person
        self.log_path = log_path
        self.decisions = []

    def approve(self, tool_name: str, args: dict) -> bool:
        ok = bool(self.ask(tool_name, args))
        entry = {"time": time.strftime("%Y-%m-%dT%H:%M:%S"), "tool": tool_name, "args": args,
                 "decision": "approved" if ok else "denied"}
        self.decisions.append(entry)
        if self.log_path:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        return ok
```
In the reference loop, `execute` calls `gate.approve(...)` for every tool marked `writes=True`. If the gate says no, or there is no gate, the tool is not run and the model is told why. The `ask` function is where a person answers: a command-line prompt, a chat message, a ticket. Every decision is logged with time, tool, arguments and outcome.

These tests passed, using a scripted model (11 tests in all for the assistant): a write is blocked without a gate; a write runs only after approval and the decision is logged; a denied write does not run and the denial is logged. Our run of the second scenario printed `decision log: add_comment approved`.

**Worked example**

Fictional approval message a person sees: 'Add comment to ticket 101: "Called the user". Effect: visible to the customer. Reversible: you can delete it. Approve or deny?'

**Common mistake**

Putting the only safeguard in the prompt. Prompts are advice; gates are enforcement.

**Check yourself.** What is the difference between an advisory control and an enforced control?

<details><summary>Model answer (write yours first)</summary>

Advisory: an instruction the model may not follow. Enforced: code that blocks the action regardless of what the model says.

</details>

---

## Part 4 · What a good approval request shows, and tiers of autonomy

A person can only approve well if they see the action clearly. An approval request should show: **what** will happen (tool and exact arguments), **to what** (which record, which customer), **the effect** (who can see it, what it changes), **whether it can be undone**, and **why** the agent wants it. Approving without seeing these is rubber-stamping, which is not control.

The SDLC course adds tiered autonomy by environment: an agent may do more where mistakes are cheap (a test environment) and less where they are costly (production), with short-lived credentials and no standing production access: it can act up to the production gate and cannot pass it. Start with approval for every write, record how often people approve unchanged, and relax a gate only for a class of actions that has proved safe over a defined number of cases, with monitoring.

**Worked example**

Fictional. After 200 approved comments with zero reversals, the team lets the agent add internal-only comments without approval, but customer-visible comments still need it.

**Common mistake**

Relaxing a gate because people are tired of approving, without data on how often the agent was right.

**Check yourself.** Name three things an approval request should show.

<details><summary>Model answer (write yours first)</summary>

The exact action and arguments, the record it affects, and its effect and reversibility (also the agent's reason). Answer key for the eight-tool exercise: (1) read-only; (2) read-only, but personal data, so limit fields and log access; (3) reversible write, approval at first; (4) reversible write, approval at first; (5) irreversible, because the customer is notified: approval every time; (6) irreversible: approval every time with an amount limit, or keep it out of the agent; (7) irreversible: do not give it to the agent; (8) an open-ended tool, so not as written: replace it with narrow, parameterised read-only queries.

</details>

---

## Do it: lab

1. Classify these eight tools as read-only, reversible write or irreversible write, for a ticket-handling agent: (1) search tickets by keyword; (2) read a customer's profile; (3) add an internal note to a ticket; (4) change a ticket's priority; (5) close a ticket and notify the customer; (6) issue a refund; (7) delete a ticket; (8) run a SQL query chosen by the model. Say which you would not give the agent at all.
2. For each tool, write its permission: what data it may touch, with what scope, and whether it needs approval.
3. Implement an approval gate for one write tool, using the reference `ApprovalGate` or your own. A person (you, at the keyboard) must answer yes or no.
4. Show a run in which the write is blocked until you approve, and a run in which you deny and the write does not happen.
5. Show the decision log with time, tool, arguments and decision.
6. Write one test for each: blocked without a gate, runs after approval, does not run after denial.

**Done when:** eight tools are classified with permissions, a gate blocks a write until a person approves, both approve and deny paths are demonstrated and tested, and the decision log shows each decision.

---

## Interview check

**Question.** How do you stop an AI agent doing something harmful with the tools you gave it?

<details><summary>A strong answer has this shape</summary>

1. Give it the fewest tools and narrowest permissions it needs (OWASP's least-privilege measures), read-only first.
2. Classify tools as read-only, reversible or irreversible, and require a person's approval for writes, always for irreversible ones.
3. Enforce gates in code, not in the prompt, since a prompt can be overridden by injected text or long-chat drift. The agent must not be able to approve its own actions.
4. Run actions in the user's own authority with short-lived credentials, not a broad service account.
5. Log every request and decision, monitor, and test the gates, including attempts to get around them.
6. Business view: define who may approve what, the limits (for example amounts), and the incident process.

</details>

---

## Evidence to keep

Keep the eight classifications, the permission table, the gate code, the tests and a decision log. They are part of the governance page of your case study.

---
