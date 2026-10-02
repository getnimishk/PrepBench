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
