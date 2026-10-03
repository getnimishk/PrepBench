# Build: a Task/Ops agent (DataOps)

**Course:** Agentic AI, from first principles to production · Module 6 Real Agents · lesson 37 of 77 · **about 16 hours** · paper draft for review.  
**Success criterion:** Runs end to end on 5 different tickets; writes actions only after approval; every action is logged with who approved it; an evaluation set of 15 cases is scored. Detection is plain code, the AI only diagnoses, and responses are tiered: log only, read-only diagnosis, proposed fix. Finish with a one-page 4D review: what you delegated, how you described it, how you checked the result, and what you recorded and disclosed.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Claude Academy AI Fluency lesson 10 (Discernment: product, process, performance); Claude Academy AI-native SDLC Playbook, lesson 'Closing the loop on metrics' (deterministic detection with statistical bands at 1, 2 and 3 sigma, then tiered responses: log, read-only diagnosis, proposed fix; findings go through the same review gates), 'Hooks as approval gates' and 'CI/CD integration' (the agent may act up to the production gate and cannot pass it; tiered autonomy), read 2026-09-30 through page summaries; Anthropic Engineering 'Building effective agents' and Microsoft Azure Architecture Center 'AI agent orchestration patterns' (single agent with tools as the usual default; set iteration limits), read 2026-10-02; lessons 20 to 25 and 33 to 35 of this course. The reference code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1 against a scripted stand-in for the model; its 16 tests passed. It uses the same message shapes as Anthropic's documented Messages API but has not been run against a real model (no key). Everything in the 'results' below comes from the scripted stand-in: it shows that the harness catches two deliberately planted mistakes. It says nothing about how a real model would score. The detection thresholds, the tickets, the runbook entries and the numbers are fictional. Unverified: how a real model behaves on these tickets; that is the work of the build.

---

## Part 1 · What you are building

You are building an agent that completes a real operations workflow end to end: **ticket, classify, retrieve runbook, diagnose, propose action, approval, execute, audit.** It is the second portfolio project on the roadmap (DataOps Task/Ops Agent) and brings together everything in Modules 4 to 6: tools, gates, idempotency, state, memory, skills.

The design rule that organises it, taken from the course's lesson on closing the loop on metrics: **detection is plain code and the AI only diagnoses.** A statistical check decides *whether* something is wrong and *how serious*; the model is used only after that, to explain and propose. Responses are tiered by seriousness:

```mermaid
flowchart TD
  accTitle: DataOps agent tiers
  accDescr: A nightly metric is compared with a baseline by plain code. Within one sigma nothing happens. From one to two sigma the event is only logged. From two to three sigma the agent runs with read-only tools and writes a diagnosis. At three sigma or more the agent also proposes a fix, a person approves or denies it, and an approved action is executed and written to an audit log.
  M[Nightly metric] --> D{Plain code: how many sigma from baseline}
  D -->|under 1| N[Nothing]
  D -->|1 to 2| T1[Tier 1: log only, no model call]
  D -->|2 to 3| T2[Tier 2: agent with read-only tools writes a diagnosis]
  D -->|3 or more| T3[Tier 3: agent diagnoses and proposes a fix]
  T3 --> G{Person approves}
  G -->|yes| X[Execute with idempotency key]
  G -->|no| R[Report, change nothing]
  X --> A[Audit log: who approved what]
  R --> A
```

Three things this design buys you, each of which a program owner can point to: a cheap and predictable first stage (no model calls for the first two tiers), a hard limit on what the agent can do (tier 2 has no write tools, enforced in code), and a complete audit trail of every decision.

**Worked example**

Fictional. Tonight's `payments` load has 800,000 rows against a 28-night baseline of about 1.2 million with a standard deviation of about 17,000: more than 23 sigma away. Plain code puts it in tier 3 in microseconds; only then does the model read the log, find ERR-4417, find the runbook entry, and propose holding new files. A person decides.

**Common mistake**

Letting the model decide whether something is wrong. It makes the first stage expensive, slow and inconsistent. Use statistics or rules for detection and keep the model for explanation.

**Check yourself.** Which parts of the DataOps flow are plain code and which use the model?

<details><summary>Model answer (write yours first)</summary>

Detection and tiering, tool validation, the approval gate, idempotency, checkpointing and the audit log are code. The model reads the log and runbook, diagnoses and proposes, in tiers 2 and 3 only.

</details>

---

## Part 2 · A 16-hour plan

| Hours | Step | Output |
|---|---|---|
| 2 | Scope: pick 5 realistic ticket types and write the runbook entries (use your lesson 30 retrieval over them). Decide the tiers' meaning and the one action the agent may propose first | Ticket set, runbook, one-page scope |
| 2 | Detection and tiers: baseline window, bands at 1, 2 and 3 sigma, tests at the boundaries | `detect.py` with tests |
| 3 | Tools, gate, audit: read-only tools, write tools marked `writes=True`, approval gate with a who-approved log, idempotency on the action key | Tools and gate with tests, including 'tier 2 cannot write' |
| 3 | The agent: the system prompt, the loop with limits, the skill from lesson 35, retrieval for the runbook | Runs on 5 tickets with a real model |
| 2 | State: checkpoint after each step, resume, the dangerous-window test (lesson 33) | Kill-and-resume log |
| 2 | Evaluation: 15 cases scored on process and outcome, repeated runs for variability | Scored table with intervals |
| 2 | Review: fix the worst failure, retest, write the one-page 4D review | The review page |

The reference code in the `dataops` folder is a working skeleton with a scripted model: 16 tests pass. Replace the scripted model with a real client (the message shapes are the same as the Messages API) and your own tickets; keep the tests.

**Worked example**

Fictional scope: five tickets: a late file (rerun), a schema drift (hold files, ask the owner), a warehouse quota error (no automatic fix, page on-call), a healthy-but-noisy night (log only), and an unknown error (no runbook entry, escalate).

**Common mistake**

Starting with the agent prompt. Start with detection, tools and the gate; the model is the smallest part of the system.

**Check yourself.** Why is the evaluation planned before the agent prompt is tuned?

<details><summary>Model answer (write yours first)</summary>

So you tune against fixed, scored cases and can tell whether a change helped, instead of judging by whichever ticket you ran last.

</details>

---

## Part 3 · The core code, and what it shows on five tickets

Detection with tiers (plain code, no AI):

```python
"""Deterministic detection (plain code, no AI) and the tiered response it selects.

A statistical band from a baseline window: how many standard deviations is today's value from the baseline mean?
  below 1 sigma : nothing
  1 to 2 sigma  : tier 1, log only
  2 to 3 sigma  : tier 2, read-only diagnosis (the agent may look, not touch)
  3 sigma +     : tier 3, the agent may PROPOSE a fix; a person approves before anything changes
This is the pattern from the course's 'closing the loop on metrics' lesson, written fresh here.
"""
import random
import statistics


def make_series(seed=7, days=28, mean=1_200_000, sd=20_000):
    """Fictional nightly row counts for one pipeline, reproducible from the seed."""
    rng = random.Random(seed)
    return [round(rng.gauss(mean, sd)) for _ in range(days)]


def tier(baseline, value):
    mu, sd = statistics.mean(baseline), statistics.stdev(baseline)
    z = abs(value - mu) / sd
    if z < 1:
        return {"z": round(z, 2), "tier": 0, "response": "none"}
    if z < 2:
        return {"z": round(z, 2), "tier": 1, "response": "log only"}
    if z < 3:
        return {"z": round(z, 2), "tier": 2, "response": "read-only diagnosis"}
    return {"z": round(z, 2), "tier": 3, "response": "propose a fix (a person approves)"}
```

The tiered agent entry point. Look at how the tier limits what the model is given:

```python
"""Ticket -> detect (code) -> tiered response -> agent (diagnose, propose) -> approval -> execute -> audit.

The tier decides how much the agent is allowed to do. That limit is enforced by WHICH TOOLS the agent is given, in code,
not by asking the model to behave.
"""
from agentkit import ApprovalGate
from checkpoint import RunStore
from detect import tier as detect_tier
from resumable import run_resumable
from tools import make_registry

SYSTEM = ("You are a DataOps triage assistant. Use get_run_log for the named pipeline, then search_runbook for any ERR- code in the log. "
          "Report what you found and what the runbook recommends. Propose a write tool only if the runbook names that fix. "
          "If a person does not approve, report that and stop.")


def handle_ticket(ticket: dict, baseline, value, model, store: RunStore, gate: ApprovalGate, world: dict, *, crash_after_write=False, on_event=print):
    """ticket = {'id', 'pipeline', 'text'}. Returns a record of what happened (for the audit and the evaluation)."""
    d = detect_tier(baseline, value)
    record = {"ticket": ticket["id"], "z": d["z"], "tier": d["tier"], "response": d["response"], "tools": [], "final": None}
    if d["tier"] <= 1:                                  # tiers 0 and 1: no model call at all
        record["final"] = f"{d['response']} (z={d['z']})"
        return record
    full = make_registry(ticket["id"], store, world, crash_after_write)
    registry = full if d["tier"] == 3 else {n: t for n, t in full.items() if not t.writes}   # tier 2: read-only tools only
    events = []
    log = lambda s: (events.append(s), on_event(s))
    text, messages = run_resumable(model, f"run-{ticket['id']}", SYSTEM, registry, f"Ticket {ticket['id']}: {ticket['text']}",
                                   store, gate=gate, ticket=ticket["id"], on_event=log)
    record["final"] = text
    calls = [b for m in messages if m["role"] == "assistant" and isinstance(m["content"], list)
             for b in m["content"] if b.get("type") == "tool_use"]
    record["tools"] = [b["name"] for b in calls]
    record["calls"] = [(b["name"], b["input"]) for b in calls]          # the full trace of requests, with arguments
    return record
```

Running five tickets through it with a scripted model (`python demo_tickets.py`):

```text
== T-1: orders row count looks slightly low
   z=1.44  tier 1 (log only)  tools=[]
   final: log only (z=1.44)

== T-2: refunds nightly load failed, can you look?
   z=2.91  tier 2 (read-only diagnosis)  tools=['get_run_log', 'search_runbook']
   final: Refunds failed with ERR-6001 ... page the platform on-call.

== T-3: payments has no data since last night
   z=23.53  tier 3 ...  tools=['get_run_log', 'search_runbook', 'quarantine_files']
   step 3: quarantine_files(...) -> ERROR A person did not approve this action, so it was not run.
   final: ... a person declined, so nothing was changed.

== T-4: customers table is stale
   z=23.53  tier 3 ...  tools=['get_run_log', 'search_runbook', 'rerun_job']
   final: Customers failed with ERR-5102 (late file). The rerun was approved and scheduled.

== T-5: orders looks fine but please double check
   z=0.03  tier 0 (none)  tools=[]

world after the run: {'reruns': ['customers'], 'quarantined': []}
audit log (who approved what):
  T-3 quarantine_files {...} -> denied by sam.reviewer
  T-4 rerun_job {'pipeline': 'customers'} -> approved by sam.reviewer
```

Read the output against the criteria. Tickets 1 and 5 never reached a model. Ticket 2 had only read-only tools even though the problem was serious. Ticket 3's proposed write was **denied** and nothing changed. Ticket 4's rerun was approved and applied once. The audit log names who decided each one. (The numbers: the 28-night baseline has mean about 1,199,480 and standard deviation about 16,977, so 1,150,000 is 2.91 sigma, which is tier 2, and 800,000 is 23.5 sigma, tier 3.)

**Worked example**

Boundary tests matter because bands are where bugs live. The reference tests check one value in each band (z of 0.85 and 0.03 are tier 0, 1.44 is tier 1, 2.91 is tier 2, 23.5 is tier 3). Add values just either side of each threshold when you set your own.

**Common mistake**

Setting thresholds by looking at a few incidents and calling them statistics. Fix the baseline window and the bands before the incidents, record them, and review them when false alarms or misses show up.

**Check yourself.** In the five-ticket run, what stopped ticket 2 from changing anything even if the model asked to?

<details><summary>Model answer (write yours first)</summary>

Tier 2 builds the registry from read-only tools only, so a write tool is not offered; a request for one fails as an unknown tool and the approval gate is never reached.

</details>

---

## Part 4 · Evaluating the process, not only the result

The criterion asks for an evaluation set of 15 cases. The AI Fluency course's lesson 10 on Discernment (judge the product, the process and the performance) adds an important point: **score the process (tier, tools and their order, what changed) as well as the final text**, because an agent can reach a correct-looking answer by a wrong or unsafe route.

Our harness scores four things per case: the tier was right, the tool sequence was right, the answer contained the expected words, and the world changed exactly as expected (no more, no less). It plants two deliberate mistakes in the scripted model: case 10 skips the runbook before acting (right outcome, wrong process) and case 13 asks for a rerun the runbook does not support. Result of `python eval15.py`:

```text
case 10  tier=3  tools=['get_run_log', 'rerun_job']   <- tools failed
case 13  tier=3  tools=['get_run_log', 'search_runbook', 'rerun_job']   <- tools failed

tier     15/15  (100%, 95% interval 80-100%)
tools    13/15  (87%, 95% interval 62-96%)
outcome  15/15  (100%, 95% interval 80-100%)
changes  15/15  (100%, 95% interval 80-100%)
all      13/15  (87%, 95% interval 62-96%)
```

What this shows, and does not show:

- **An outcome-only score would have read 100 percent** and missed both mistakes. Case 10 got the right answer without consulting the runbook; case 13 tried an unsupported write. The process score caught both.
- **The gate held.** In case 13 the attempted rerun on `refunds` was denied by the approver, so `changes` stayed 15 of 15. The control worked even though the model's behaviour was wrong, which is the reason for gates.
- **It says nothing about a real model.** The scripted model does exactly what its script says. The harness is the thing being tested here. Your real runs will show different numbers, and with a real model you should **run each case several times**, because the same input can give different steps (non-determinism), and report how often each case passes.
- **15 cases is a small set.** 13 of 15 has an interval of about 62 to 96 percent. Use the set to find failures, not to rank two close versions.

A refinement you will meet in lesson 46: our harness compares the tool list exactly, which is acceptable here only because the stand-in's script is fixed. With a real model, exact-path grading is too strict. Anthropic's evaluation guide (2026-01-09) warns that agents find valid routes the designer did not imagine, so a rigid sequence check fails good runs. The fix is to grade **outcomes** and **invariants** (rules that must always hold, such as 'consult the runbook before any write') as pass or fail, and to track the exact path only as a diagnostic. Lesson 46 rebuilds this set that way, with 25 cases, repeated trials and a release gate.

Case design matters more than the count. Ours covers each tier, each runbook entry, an approved write, denied writes, an unsupported write, and a case where the log has no error code (the right behaviour is to say so and stop, not to guess).

**Worked example**

Fictional. A real-model run of case 9 gives the right tools in 4 of 5 repeats and, in the fifth, reads the log twice before the runbook. Decide in advance whether a repeated read counts as a failure. Writing that rule down is part of the evaluation design.

**Common mistake**

Scoring only the final message. The agent that guesses right for the wrong reasons will fail on the next ticket, and you will not know why.

**Check yourself.** Why can an agent score 100 percent on outcome and still fail the evaluation?

<details><summary>Model answer (write yours first)</summary>

Because the route matters: it may have skipped a required step or tried an unsupported or unsafe action. Process scoring (tools, order, what changed) catches that; outcome-only scoring does not.

</details>

---

## Part 5 · The 4D review, and what to keep

Finish with the one-page 4D review:

- **Delegation:** what the agent does (reads, diagnoses, proposes) and what it never does (decide severity, write without approval). Name the tiers and who owns each decision.
- **Description:** how you described the job: the system prompt, the skill, the tool descriptions and their 'when to use' lines, the runbook format. Include the final prompt.
- **Discernment:** how you checked: the 15-case table with process and outcome scores, repeats for variability, the failures you found and fixed, the kill-and-resume log, the approval and denial tests.
- **Diligence:** what you recorded and disclosed: the audit log format, retention, who can read it, the baseline and thresholds with their date, what the agent cannot do, who is told when it escalates, and the limits of your evaluation (15 cases, one runbook, fictional data).

Present the build in this order to a hiring manager: the tier diagram, the five-ticket run with the denied write, the process-versus-outcome result, and the audit log. Those four artefacts make the case that you can build an agent that is useful **and** controlled.

**Worked example**

Fictional one-line summary for the portfolio page: 'DataOps agent: plain-code detection with three response tiers, a model that only diagnoses, writes only after a person approves, every action logged with the approver, 15-case evaluation scoring process and outcome, crash-safe with resume.'

**Common mistake**

Showing only a happy-path demo. The denied approval, the crash and resume, and the failing case are what show judgement.

**Check yourself.** Which four artefacts would you show first from this build, and why?

<details><summary>Model answer (write yours first)</summary>

The tier diagram (design), the five-ticket run including a denied write (control), the process-versus-outcome evaluation (rigour), and the audit log (accountability).

</details>

---

## Do it: lab

1. Write the scope: five realistic ticket types with their runbook entries, the tiers and thresholds (with the baseline window), and the first action the agent may propose. One page.
2. Implement `detect.py` for your own metric and baseline, with boundary tests at each band edge.
3. Implement the tools: two read-only, at least one write with `writes=True`, an idempotency key derived from the action, and the approval gate with an audit log of who approved what. Test that tier 2 cannot write even if asked.
4. Connect a real model: write the system prompt and tool descriptions, use your lesson 30 retrieval for the runbook, add the skill from lesson 35, and keep the loop's limits (turns, tokens, repeated call).
5. Add checkpointing and run the kill-and-resume test, including the write-then-crash window.
6. Run it end to end on 5 different tickets. Show at least one approved write and one denied write, and the audit log.
7. Write 15 evaluation cases and score tier, tools and order, outcome and changes. Run each case 3 to 5 times against the real model and report how often each passes. Fix the worst failure and rerun.
8. Write the one-page 4D review with the final prompt, the scored table and the limits of your evaluation.

**Done when:** the agent runs end to end on 5 tickets; writes happen only after approval and every action is logged with the approver; detection is plain code, the model only diagnoses, and responses are tiered (log only, read-only diagnosis, proposed fix); the 15-case set is scored on process and outcome; and the 4D review page exists.

---

## Interview check

**Question.** Describe an AI operations agent you built and how you kept it safe.

<details><summary>A strong answer has this shape</summary>

1. The workflow and the split: plain-code detection with statistical bands decides whether and how seriously; the model only diagnoses and proposes.
2. Tiered autonomy enforced in code: log only, read-only tools for diagnosis, and a proposed fix that needs a person's approval. A lower tier is not given write tools, so it cannot act even if the model asks.
3. Controls: validated tool inputs, an approval gate that logs who decided, idempotent writes keyed on the action, checkpointed state with a tested crash-and-resume.
4. Evaluation: 15 cases scored on process and outcome, repeated runs because of non-determinism, with intervals; what failed and what I changed.
5. What I would not claim: a small, fictional set and one runbook; production needs a larger set, monitoring, on-call ownership and a review cadence.

</details>

---

## Evidence to keep

Keep the scope, detection code and tests, the five-ticket run with its audit log, the kill-and-resume log, the scored evaluation table with repeats, the final prompt and the 4D review page. This is portfolio project 2 on the roadmap.

---
