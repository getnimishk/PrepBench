# State & checkpointing

**Course:** Agentic AI, from first principles to production · Module 6 Real Agents · lesson 33 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Add checkpointing to an agent, kill it mid-run, and show that it resumes from the saved state without repeating completed steps.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): LangGraph documentation 'Persistence' (threads, checkpoints and checkpointers: InMemorySaver, SqliteSaver, PostgresSaver; human-in-the-loop, time travel, fault tolerance; stores for long-term memory) and 'Overview' (durable execution; a low-level orchestration framework; `pip install -U langgraph`); Microsoft Learn 'Conversations & Memory overview in Agent Framework' (page dated 2026-05-28, updated 2026-08-25: AgentSession, serialisation, service-managed session ids scoped to an API key or project, verify the user before resuming); Microsoft Azure Architecture Center 'AI agent orchestration patterns' (page dated 2026-02-12: persist shared state externally, checkpoint features, human-in-the-loop gates need persisted state); Anthropic Engineering 'How we built our multi-agent research system' (2025-06-13: agents are stateful, errors compound, resumable checkpoints); lesson 25 of this course (idempotency keys). Read 2026-10-02 through page summaries. The reference code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1 against a scripted stand-in for the model; the folder's tests passed (58 in all, covering lessons 33 to 55; 16 of them cover the state, memory and skills code). It uses the same message shapes as Anthropic's documented Messages API but has not been run against a real model (no key). We also ran a small LangGraph 1.2.12 program (langgraph-checkpoint-sqlite 3.1.1) that pauses at an interrupt, is rebuilt in a 'new process' on the same SQLite file, and resumes; its output is quoted below. Unverified: how any other framework behaves on resume; the LangGraph behaviour we quote (an interrupted step runs again from its start) is what we observed in this version.

---

## Part 1 · Three kinds of state

'State' is three different things, and mixing them up is how resumed agents repeat actions.

| Kind | Examples | Where it lives | Saved by a checkpoint? |
|---|---|---|---|
| **Conversation state** | The messages so far: the task, the model's replies, each tool call and its result | In your program's memory unless you save it | Yes, this is the core of a checkpoint |
| **Application state** | The ticket id, a plan, flags such as 'approved', counters for budgets and retries | In your program's variables | Yes, if you put it in the saved state |
| **External state** | The database row, the scheduled job, the email already sent | In other systems | **No.** A checkpoint saves your program's view of the world, not the world |

The third row is the trap. If a run dies after changing a system and before saving its progress, the checkpoint says 'not done yet' while the world says 'done'. Resuming then does the action again. Everything in this lesson is about that gap, and the answer is the one you met in lesson 25: **idempotent actions** that can safely be repeated.

A **checkpoint** is a saved snapshot of the first two kinds taken at a defined point, usually after every completed step. **Resuming** means loading the latest snapshot and carrying on from it. LangGraph describes exactly this: a checkpointer persists a thread's state as a checkpoint at each step, which gives thread-scoped short-term memory, and enables human-in-the-loop pauses, replay from an earlier checkpoint ('time travel') and recovery from failures. Microsoft Agent Framework's `AgentSession` plays the same role: you create a session, pass it to each run, and can serialise it to restore later.

**Worked example**

Fictional. A run has read the log and the runbook (two steps) and is about to reschedule a job. State saved after step 2: messages so far, ticket id T-9, 'approved' unset. External state: the job has not been rescheduled yet, so resuming from step 2 is safe. If it died one line later, after the reschedule but before the save, the snapshot would be the same and the world would be different.

**Common mistake**

Believing a checkpoint makes a run safe to restart. It only restores what your program remembered; it cannot undo or detect what the run already did to other systems.

**Check yourself.** Name the three kinds of state and say which one a checkpoint does not capture.

<details><summary>Model answer (write yours first)</summary>

Conversation state, application state and external state. A checkpoint does not capture external state: the changes already made in other systems.

</details>

---

## Part 2 · A checkpoint around the loop

Here is the whole mechanism for our hand-written agent loop. The store is a SQLite table with one row per run, replaced after every completed step; a second table records the actions already applied.

```python
"""Save an agent run after every step so it can resume. SQLite, one row per run, replaced after each step.

What is saved: the conversation so far (as JSON) and the idempotency keys of writes already applied. The second part
matters: a crash can happen AFTER a write ran but BEFORE the checkpoint was saved. On resume the model re-asks for that
write; the stored key makes the tool return the earlier result instead of applying it twice.
"""
import json
import sqlite3


class RunStore:
    def __init__(self, path=":memory:"):
        self.db = sqlite3.connect(path)
        self.db.execute("create table if not exists runs (run_id text primary key, step integer, messages text, status text)")
        self.db.execute("create table if not exists applied (key text primary key, result text)")
        self.db.commit()

    def save(self, run_id, step, messages, status="running"):
        self.db.execute("insert or replace into runs values (?,?,?,?)", (run_id, step, json.dumps(messages), status))
        self.db.commit()

    def load(self, run_id):
        row = self.db.execute("select step, messages, status from runs where run_id=?", (run_id,)).fetchone()
        return None if row is None else {"step": row[0], "messages": json.loads(row[1]), "status": row[2]}

    def applied(self, key):
        row = self.db.execute("select result from applied where key=?", (key,)).fetchone()
        return None if row is None else json.loads(row[0])

    def record_applied(self, key, result):
        self.db.execute("insert or ignore into applied values (?,?)", (key, json.dumps(result)))
        self.db.commit()
```

And the loop itself with one save per step. The three marked lines are the whole idea:

```python
"""The agent loop with a checkpoint after every step, so a killed run can resume where it stopped."""
import json

from agentkit import AgentStopped, block_dict, run_tool
from checkpoint import RunStore


def run_resumable(client, run_id, system, registry, user_text, store: RunStore, *, gate=None, ticket="",
                  max_turns=8, on_event=print):
    state = store.load(run_id)
    if state and state["status"] == "done":
        return state["messages"][-1]["content"][0]["text"], state["messages"]
    messages = state["messages"] if state else [{"role": "user", "content": user_text}]
    if state:
        on_event(f"resuming run {run_id} from step {state['step']} with {len(messages)} messages")
    tools = [t.spec() for t in registry.values()]
    for turn in range(state["step"] if state else 0, max_turns):
        resp = client.messages.create(model="m", max_tokens=1024, system=system, tools=tools, messages=messages)
        content = [block_dict(b) for b in resp.content]
        messages.append({"role": "assistant", "content": content})
        if resp.stop_reason != "tool_use":
            store.save(run_id, turn + 1, messages, status="done")
            return content[0]["text"], messages
        results = []
        for b in content:
            if b["type"] != "tool_use":
                continue
            r = run_tool(b, registry, gate, ticket)
            on_event(f"  step {turn + 1}: {b['name']}({json.dumps(b['input'])}) -> {'ERROR ' if r.get('is_error') else ''}{r['content'][:80]}")
            results.append(r)
        messages.append({"role": "user", "content": results})
        store.save(run_id, turn + 1, messages)            # the checkpoint: one per completed step
    raise AgentStopped(f"no final answer after {max_turns} steps")
```

Read it for three properties:

1. **Resume asks the model for the next turn, not the first.** The loop starts at the saved step (`for turn in range(state['step'], ...)`) with the saved messages. Completed steps are not replayed and their tool results are not re-fetched.
2. **Messages are plain dicts**, not library objects, so they can be written as JSON and read back in a new process.
3. **The save happens after each completed step**, with the tool results in it. A save before the tool ran would record a call with no result.

Because the tests use a scripted model, they can count what a resume costs. Killed after step 2 of a 4-step run, the resume made **2 model calls, where starting over would need 4**, and the write ran once.

**Worked example**

```text
--- Scenario A: killed AFTER step 2 was saved, BEFORE the write
  step 1: get_run_log(...) -> FAILED ERR-5102 ...
  step 2: search_runbook(...) -> Late arrival: ...
  process stopped: no final answer after 2 steps
  saved: 2 steps; reruns so far: []
resuming run run-T-9 from step 2 with 5 messages
  step 3: rerun_job({"pipeline": "customers"}) -> {"ok": true, ...}
  resumed run finished: Late file (ERR-5102). Rerun approved and scheduled.
  reruns: ['customers'] | model calls after resume: 2 (a full re-run would need 4)
```

**Common mistake**

Saving only the final answer. If you save at the end, a crash at step 9 of 10 loses everything.

**Check yourself.** Killed after step 2 of a 4-step run, how many model calls does the resume need and why?

<details><summary>Model answer (write yours first)</summary>

Two (steps 3 and 4). It loads the 5 saved messages and asks the model for the next turn, instead of repeating steps 1 and 2.

</details>

---

## Part 3 · The dangerous window: the write ran, the checkpoint did not

Now the scenario that checkpoints alone do not solve. The process dies **after** the write is applied and **before** the step is saved. We simulate it by raising an exit right after the rerun is scheduled:

```text
--- Scenario B: killed AFTER the write ran, BEFORE its checkpoint was saved
  process died: simulated crash: the write is done, the checkpoint is not saved
  reruns at the moment of the crash: ['customers'] | checkpoint saved up to step 2
resuming run run-T-9 from step 2 with 5 messages
  step 3: rerun_job(...) -> {"ok": true, ..., "note": "already applied, not repeated"}
  reruns after resume: ['customers'] (the write was NOT repeated)
  approvals recorded: 1 (the person was not asked a second time)
```

The resumed model asked for the rerun again, because the checkpoint did not know it had happened. Two design choices stopped the duplicate:

1. **The idempotency key is derived from the action, not from the model's call id.** Our tools key the write on the ticket, the tool name and the arguments (a hash of them). A real model that is asked again will usually give the same call a *new* `tool_use` id, so a key based on that id would not match, and the write would run twice. A key based on 'ticket T-9, rerun_job, customers' matches however the model words it. (Lesson 25 used the call id because it dealt with a retry inside one turn; resuming after a crash needs the stronger form.)
2. **The approval is remembered, durably.** The gate reloads its decision log from its file when it is built, then looks for an identical approved action in it before asking again, so the person is not interrupted twice for one decision. Both stores must be files for this to hold across a real restart: `RunStore()` defaults to an in-memory database (fine for unit tests, lost when the process dies), so the lab uses `RunStore('runs.db')` and `ApprovalGate(ask, log_path='audit.jsonl')`. The test `test_approval_and_progress_survive_a_real_restart_with_file_backed_state` rebuilds every object from the files alone after the crash and shows the person is not asked again and the write is not repeated.

The same hazard exists in frameworks. We built the same flow in LangGraph with a SQLite checkpointer and a person-approval step (`interrupt`). Rebuilding the graph on the same file after a 'crash' resumed correctly and the write ran once. But when we put a counter before the interrupt in that step, it ran **twice**: the paused step starts from its beginning when it resumes. So any side effect placed before the pause in the same step repeats. The rule: **keep the code before a pause free of side effects, or make those effects idempotent.**

**Worked example**

```text
first process: paused with Rerun the customers job? | reruns: []
second process: saved state next step = ('ask_person',) | log = customers FAILED ERR-5102 ...
resumed: rerun scheduled | reruns: ['customers']

counter before interrupt() in the same step: 1 call at the pause, 2 calls after resume
```

**Common mistake**

Using the model's tool call id as the idempotency key for a write that must survive a restart. After a resume the id is not guaranteed to be the same.

**Check yourself.** The process dies after a write succeeds and before the checkpoint is saved. What stops the resumed run from repeating the write?

<details><summary>Model answer (write yours first)</summary>

An idempotency key derived from the action itself (ticket, tool, arguments), stored with the write, so the repeated request returns the earlier result instead of applying again. The approval should be remembered too.

</details>

---

## Part 4 · What checkpoints do not give you

A checkpoint is a recovery tool, not a guarantee. Be clear about its limits when you promise 'the agent resumes where it left off'.

- **The resumed model may not take the same path.** It sees the saved messages, but language models are not deterministic; the next step can differ from what an uninterrupted run would have done. Your tests should pass on either path.
- **Saved tool results can be stale.** A log line read an hour ago may no longer be true. For decisions that depend on fresh data, re-read it after a resume, and record when each result was fetched.
- **Checkpoints hold sensitive data.** They contain the full conversation and tool outputs. Apply the same access, retention and deletion rules as to the data itself, and keep them out of logs that more people can read.
- **Whose checkpoint is it?** Microsoft's documentation warns that service-managed session ids may be scoped only to an API key or project; if one key serves many users, store the ids server-side and verify the authenticated user or tenant before resuming. A resumed run must belong to the person resuming it.
- **Size.** A checkpoint per step of a long conversation grows quickly. Plan retention and, where the framework offers it, compaction (lesson 16).
- **In-memory is not durable.** LangGraph's `InMemorySaver` is lost when the process ends; use SQLite for development and a database such as Postgres for production.
- **Long runs and deployments.** Anthropic's multi-agent write-up says agents are stateful, errors compound, and a code deployment mid-run needs care; its answer was resumable checkpoints plus deployment practices that do not interrupt running agents.

For the program owner the useful questions are: where is the state stored, how long is it kept, who can read it, what happens to a run that is in flight during a release, and how do we know a resumed run did not repeat an action?

**Worked example**

Fictional. A run is paused for approval overnight. By morning the log it read has changed because the job was rerun by a person. The agent proposes a rerun based on a stale log. The fix: after resuming from a pause longer than a set age, re-read the evidence before acting.

**Common mistake**

Promising 'it picks up exactly where it stopped' to stakeholders. It picks up from the last saved step, with possibly stale data, and may choose differently.

**Check yourself.** Give two risks that remain after you add checkpointing.

<details><summary>Model answer (write yours first)</summary>

Any two of: a different path on resume, stale saved tool results, sensitive data in checkpoints, a resumed run belonging to the wrong user, unbounded checkpoint growth, a repeated external action if actions are not idempotent.

</details>

---

## Do it: lab

1. Add checkpointing to your lesson 24 assistant (or the reference `dataops` agent): save the messages after every completed step in SQLite, and add a `resume(run_id)` that continues from the saved step.
2. Write the test: run the agent with a scripted model, stop it after step 2 with an exception, resume it, and assert that (a) steps 1 and 2 were not repeated, (b) the model was asked for only the remaining turns, and (c) the final answer is the same.
3. Write the dangerous-window test: make a write succeed, then crash before the checkpoint. Resume and assert the write happened once and the approval was recorded once.
4. Change your write's idempotency key from the model's call id to a key derived from the action. Show the test that fails with the call id when the resumed model uses a different id, and passes with the action key.
5. Write a short note on what your checkpoint stores, who can read it, how long you keep it, and how a resumed run is tied to the person who started it.

**Done when:** you can kill the agent mid-run and show it resumes from the saved state without repeating completed steps, the dangerous-window test passes with the action-derived key, and your note names storage, retention, access and ownership.

---

## Interview check

**Question.** An agent was updating 50 records and crashed after 20. What do you want to be true when it restarts?

<details><summary>A strong answer has this shape</summary>

1. It resumes from its last saved step, not from the beginning, and does not redo the 20 completed updates.
2. Every update is idempotent with a key derived from the action, so even the one in flight at the crash cannot be applied twice.
3. The state it saved includes what was done and when, so a person can audit it, and stale readings are refreshed before it decides anything.
4. Approvals already given are remembered so the person is not asked again for the same action, and approvals are not reused for different actions.
5. The checkpoint is access-controlled and expires, and the run belongs to the user who started it.
6. We tested the crash on purpose, including the window between the write and the save.

</details>

---

## Evidence to keep

Keep the kill-and-resume log, both crash tests, the key-derivation change with its failing and passing runs, and the state-handling note. They feed the DataOps build in lesson 37.

---
