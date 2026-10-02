# Build an A2A exchange

**Course:** Agentic AI, from first principles to production · Module 7 MCP and A2A · lesson 42 of 77 · **about 5 hours** · paper draft for review.  
**Success criterion:** Agent A delegates a task to Agent B over A2A and receives a result; show the messages and one failure (unreachable agent) handled. Finish with a one-page 4D review: what you delegated, how you described it, how you checked the result, and what you recorded and disclosed.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Agent2Agent (A2A) Protocol specification 1.0.0 (read through page summaries 2026-10-02) and the official a2a-sdk 1.2.1, used by installing and running it; the SDK's own protobuf types were used to check every JSON shape we wrote. The code on this page was written by us and run on Python 3.14.7 with the official a2a-sdk 1.2.1 (A2A protocol 1.0). Agent B is served with the SDK; Agent A is plain httpx. We checked our JSON against the SDK's own protobuf types, ran both agents against each other on localhost, and ran 7 tests, which passed. The exact JSON shapes below come from that running server, not from the specification text: a page summary of the specification suggested the SendMessage result was a bare Task, and the running server wrapped it as {"task": ...}. Where they differ, we trust the running server and say so. Unverified: streaming, push notifications and the gRPC and REST bindings (not run); how an agent hosted by another organisation behaves; authentication (our local demo has none: the Agent Card declares no security scheme); how the SDK behaves under load.

---

## Part 1 · Agent B: a small agent served with the SDK

Agent B is a runbook agent. It has no model inside, because the point is the protocol; in your build it can call one. The SDK provides the server, the task store and the JSON-RPC routes; you provide an **executor**: the code that does the work and reports progress through a `TaskUpdater`.

```python
"""Agent B: a tiny 'runbook' agent served over A2A with the official a2a-sdk (1.x). No model inside: the point is the protocol.

Run:  python agent_b.py            (serves on http://127.0.0.1:9101)
"""
import sys

import uvicorn
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import AgentCard, Part, Task, TaskState, TaskStatus
from google.protobuf.json_format import ParseDict
from starlette.applications import Starlette

PORT = 9101
RUNBOOK = {
    "ERR-4417": "Schema drift: the incoming file has a column the target table does not. Ask the data owner to approve a schema update.",
    "ERR-5102": "Late arrival: the upstream file came after the 06:00 UTC cutoff. Rerun the job once the file lands.",
}

CARD = ParseDict({
    "name": "Runbook agent",
    "description": "Looks up the runbook entry for a pipeline error code.",
    "version": "1.0.0",
    "supportedInterfaces": [{"url": f"http://127.0.0.1:{PORT}/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"}],
    "capabilities": {"streaming": False, "pushNotifications": False},
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/plain"],
    "skills": [{"id": "runbook-lookup", "name": "Runbook lookup", "tags": ["runbook", "pipeline"],
                "description": "Given text containing an error code such as ERR-4417, returns the runbook guidance."}],
}, AgentCard())


class RunbookExecutor(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        if context.current_task is None:   # the first event for a new task must be the Task itself
            await event_queue.enqueue_event(Task(id=context.task_id, context_id=context.context_id,
                                                 status=TaskStatus(state=TaskState.TASK_STATE_SUBMITTED)))
        updater = TaskUpdater(event_queue, context.task_id, context.context_id)
        await updater.start_work()
        text = context.get_user_input()
        code = next((c for c in RUNBOOK if c in text.upper()), None)
        if code is None:
            await updater.failed(updater.new_agent_message([_text("No runbook entry found for that request.")]))
            return
        await updater.add_artifact([_text(RUNBOOK[code])], name="runbook-entry")
        await updater.complete()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        await TaskUpdater(event_queue, context.task_id, context.context_id).cancel()


def _text(s):
    return Part(text=s)


def build_app():
    handler = DefaultRequestHandler(agent_executor=RunbookExecutor(), task_store=InMemoryTaskStore(), agent_card=CARD)
    routes = create_agent_card_routes(CARD) + create_jsonrpc_routes(handler, rpc_url="/a2a")
    return Starlette(routes=routes)


if __name__ == "__main__":
    uvicorn.run(build_app(), host="127.0.0.1", port=int(sys.argv[1]) if len(sys.argv) > 1 else PORT, log_level="warning")
```

Three points worth noticing:

1. **The first event for a new task must be the `Task` itself.** Our first attempt sent a status update first, and the server answered with an error 'Agent should enqueue Task before TaskStatusUpdateEvent event' (code -32006). The fix is the three lines at the top of `execute`.
2. **Progress and results go through the updater**: `start_work()` moves the task to working, `add_artifact(...)` attaches the output, `complete()` or `failed(...)` ends it. The server turns those into the task states you saw in lesson 41.
3. **The card is data you control.** It states the endpoint, the binding (`JSONRPC`), the version and the skills. The client reads it to know where to send the request, so a wrong URL here breaks every client.

**Worked example**

Run Agent B with `python agent_b.py`; it serves on http://127.0.0.1:9101 (a port chosen to stay away from PrepBench's own ports). `curl http://127.0.0.1:9101/.well-known/agent-card.json` returns the card.

**Common mistake**

Skipping the Task event and only sending status updates. The SDK enforces the order, and the error message is the clue.

**Check yourself.** What must be the first event an executor publishes for a new task, and what error do you see if it is not?

<details><summary>Model answer (write yours first)</summary>

The Task itself (with its id and a submitted state). Otherwise the server returns error -32006: 'Agent should enqueue Task before TaskStatusUpdateEvent event'.

</details>

---

## Part 2 · Agent A: delegating a task, and handling failure

Agent A is a client written with plain `httpx`, so you can see exactly what goes on the wire. It does five things: fetch the Agent Card, pick the JSON-RPC interface from `supportedInterfaces`, send a `SendMessage` request with the `A2A-Version` header, read the task state, and turn **every** failure into a result the caller can act on.

```python
"""Agent A: a small A2A client that delegates a task to another agent over JSON-RPC, using plain httpx.

It discovers the agent from its Agent Card, sends the A2A-Version header on every request, and turns every kind of
failure (unreachable, HTTP error, JSON-RPC error, failed task) into a result the caller can act on instead of an exception.
"""
import json
import uuid

import httpx

VERSION = "1.0"


def delegate(base_url: str, text: str, timeout: float = 5.0) -> dict:
    headers = {"A2A-Version": VERSION, "content-type": "application/json"}
    try:
        with httpx.Client(timeout=timeout) as http:
            card = http.get(f"{base_url}/.well-known/agent-card.json", headers={"A2A-Version": VERSION})
            card.raise_for_status()
            card = card.json()
            iface = next((i for i in card["supportedInterfaces"] if i["protocolBinding"] == "JSONRPC"), None)
            if iface is None:
                return {"ok": False, "reason": "no JSON-RPC interface in the Agent Card", "agent": card.get("name")}
            body = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": "SendMessage",
                    "params": {"message": {"messageId": str(uuid.uuid4()), "role": "ROLE_USER", "parts": [{"text": text}]}}}
            resp = http.post(iface["url"], headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
        return {"ok": False, "reason": f"agent unreachable: {type(e).__name__}", "retryable": True}
    except httpx.HTTPStatusError as e:
        return {"ok": False, "reason": f"HTTP {e.response.status_code}", "retryable": e.response.status_code >= 500}
    if "error" in data:
        return {"ok": False, "reason": f"JSON-RPC error {data['error']['code']}: {data['error']['message']}", "retryable": False}
    task = data["result"].get("task")
    if task is None:                      # the agent answered with a plain Message instead of a Task
        return {"ok": True, "agent": card["name"], "message": data["result"].get("message")}
    state = task["status"]["state"]
    if state == "TASK_STATE_COMPLETED":
        parts = [p.get("text", "") for a in task.get("artifacts", []) for p in a.get("parts", [])]
        return {"ok": True, "agent": card["name"], "task_id": task["id"], "state": state, "text": " ".join(parts)}
    note = (task["status"].get("message") or {}).get("parts", [{}])[0].get("text", "")
    return {"ok": False, "agent": card["name"], "task_id": task["id"], "state": state, "reason": note, "retryable": False}


if __name__ == "__main__":
    for label, url, q in [("answerable", "http://127.0.0.1:9101", "What does ERR-4417 mean?"),
                          ("no such entry", "http://127.0.0.1:9101", "What does ERR-9999 mean?"),
                          ("agent down", "http://127.0.0.1:9199", "What does ERR-4417 mean?")]:
        print(f"{label:14}", json.dumps(delegate(url, q), ensure_ascii=False))
```

Output of the real run (`python agent_a.py`, with Agent B running):

```text
answerable     {"ok": true, "agent": "Runbook agent", "task_id": "c668...", "state": "TASK_STATE_COMPLETED", "text": "Schema drift: the incoming file has a column the target table does not. Ask the data owner to approve a schema update."}
no such entry  {"ok": false, "agent": "Runbook agent", "task_id": "4017...", "state": "TASK_STATE_FAILED", "reason": "No runbook entry found for that request.", "retryable": false}
agent down     {"ok": false, "reason": "agent unreachable: ConnectError", "retryable": true}
```

The three results are the three outcomes your criterion asks you to show: **a result** (completed with an artifact), **a task-level failure** (the agent answered 'failed' with a reason, and Agent A passes it on as not retryable), and **an unreachable agent** (the connection was refused, handled as a result with `retryable: true`, not as an exception). Agent A decides what to do next: retry with backoff (lesson 25), try another agent, or escalate to a person. The decision belongs to the delegating agent and its designer, not to the protocol.

The request body on the wire, and the response that came back from the running server:

```json
// request
{"jsonrpc": "2.0", "id": "1", "method": "SendMessage",
 "params": {"message": {"messageId": "m-1", "role": "ROLE_USER", "parts": [{"text": "What does ERR-4417 mean?"}]}}}

// response
{"result": {"task": {"id": "dd00...", "contextId": "8291...", "status": {"state": "TASK_STATE_COMPLETED", "timestamp": "2026-10-02T17:46:32Z"},
  "artifacts": [{"artifactId": "d540...", "name": "runbook-entry", "parts": [{"text": "Schema drift: ..."}]}]}},
 "id": "1", "jsonrpc": "2.0"}
```

Note the `{"task": ...}` wrapper in the result. A summary of the specification page we read first suggested the result was a bare task, and the official SDK's protobuf types showed the wrapper, so our client reads `data['result']['task']`. When a summary and a running implementation disagree, run the implementation and cite what you saw.

**Worked example**

Two behaviours we observed on the wire: omitting the `A2A-Version` header made the server assume an older version and answer with error -32009 ('A2A version 0.3 is not supported ... Expected version 1.0'); a wrong header such as 9.9 got the same error. `GetTask` with an unknown id returned -32001 ('Task not found'). Handle these as protocol errors, distinct from a failed task.

**Common mistake**

Letting a connection error raise through the delegating agent's loop. An unreachable peer is a normal condition in distributed systems; return a structured result so the caller can choose to retry, reroute or escalate.

**Check yourself.** Agent A gets a connection refused from Agent B. What should it return, and who decides what happens next?

<details><summary>Model answer (write yours first)</summary>

A structured result saying the agent was unreachable and that retrying may help (`retryable: true`), not an exception. The delegating agent's logic (retry with backoff, another agent, or a person) decides next.

</details>

---

## Part 3 · Tests, trust and the 4D review

Seven tests pass. Six run Agent B in-process with no network (Starlette's test client), and one tries a closed port to test Agent A's failure handling:

| Test | What it proves |
|---|---|
| Agent Card served and valid | The card is reachable and the SDK's own `AgentCard` type accepts our field names |
| Message creates a completed task with an artifact | The wrapped result shape and the state |
| No entry ends in a failed task | The failure path |
| The request we send is a valid `SendMessageRequest` | Our client's JSON matches the SDK's type |
| Missing or wrong version header rejected (-32009) | Version handling |
| Unknown task is an error (-32001) | Error shape |
| Unreachable agent returns a handled result | Failure handling in Agent A |

**Trust.** Our demo has no authentication: the card declares no security scheme and Agent B answers anyone on localhost. That is acceptable only on one machine. Before agents talk across a network, decide: how does each side authenticate (the specification lists API key, HTTP, OAuth 2.0, OpenID Connect and mutual TLS, declared in the card), what may the caller ask for, and what does the callee log? Also treat everything that comes back, including artifacts, as **untrusted text** (lessons 38 to 40): another agent's output can contain instructions or false data, and you should not give it more authority than a tool result.

Finish with the one-page **4D review**: *Delegation* (what Agent A hands off and what it keeps: who may decide, who owns the result), *Description* (the card, skill descriptions and the message you send), *Discernment* (the tests, the three outcomes you showed, how A checks what B returns), *Diligence* (what you log, what you disclose about delegating to another agent, and the authentication and data-sharing limits).

**Worked example**

Fictional rule for the review: 'Agent A never lets Agent B's artifact trigger a write. A person approves any action based on B's output, and A records which agent supplied the evidence.'

**Common mistake**

Calling the exchange done because the happy path works. The failure paths (failed task, unreachable agent, version error) are the evidence of a robust build.

**Check yourself.** Name the three outcomes your demo must show, and one reason not to expose it beyond localhost as built.

<details><summary>Model answer (write yours first)</summary>

A completed task with an artifact, a failed task with a reason, and an unreachable agent handled as a result. It has no authentication, so on a network anyone could send it tasks.

</details>

---

## Do it: lab

1. Build Agent B (start from `agent_b.py`): one skill, an Agent Card with the correct endpoint, an executor that completes a task with an artifact and fails one with a reason. Install `a2a-sdk` first (record the version).
2. Build Agent A (start from `agent_a.py`): fetch the card, send a message with the version header, and turn every failure into a structured result.
3. Run the exchange and save the real messages: the request, the task response, the failed task and the unreachable-agent result (stop Agent B for the last one).
4. Add a retry with backoff for the unreachable case, bounded and logged, using what you built in lesson 25. Show it giving up after its limit and returning a result for a person.
5. Write the tests (card valid, completed task, failed task, version error, unknown task, unreachable). All must pass.
6. Write the one-page 4D review, including a sentence on authentication before this runs between machines.

**Done when:** Agent A delegates a task to Agent B over A2A and receives a result; the messages are saved; one failure (unreachable agent) is handled as a result; the tests pass; and the 4D review page exists.

---

## Interview check

**Question.** How would you make two independent agents work together reliably?

<details><summary>A strong answer has this shape</summary>

1. Define the contract first: an Agent Card that says what the callee does, the endpoint, the content types and how to authenticate, and the task states the caller must handle, including input-required and failed.
2. Make the caller defensive: timeouts, bounded retries with backoff for temporary failures, a structured result for unreachable or failed peers, and a path to a person when retries run out.
3. Treat the callee's output as untrusted text and do not let it trigger sensitive actions without a check or approval.
4. Authenticate both ways when crossing a network, log which agent supplied which evidence, and test the failure paths on purpose.

</details>

---

## Evidence to keep

Keep Agent A and B code, the saved messages for the three outcomes, the retry log, the tests and the 4D review page. This is a practice build, not a portfolio project.

---
