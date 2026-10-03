"""The agent loop. It works with the real Anthropic client or any object with the same messages.create shape."""
import json

from pydantic import ValidationError


class AgentStopped(Exception):
    pass


def final_text(resp) -> str:
    return "".join(b.text for b in resp.content if b.type == "text")


def execute(block, registry, gate):
    """Run one tool_use block and return a tool_result block. Never raises: errors go back to the model."""
    def result(text, is_error=False):
        r = {"type": "tool_result", "tool_use_id": block.id, "content": text}
        if is_error:
            r["is_error"] = True
        return r

    tool = registry.get(block.name)
    if tool is None:
        return result(f"Unknown tool {block.name!r}. Available tools: {sorted(registry)}", True)
    try:
        args = tool.model.model_validate(block.input)
    except ValidationError as e:
        return result("Invalid input: " + "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors()), True)
    if tool.writes and not (gate and gate.approve(tool.name, args.model_dump())):
        return result("A person did not approve this action, so it was not run. Tell the user and stop.", True)
    try:
        return result(json.dumps(tool.fn(args, block.id)))
    except Exception as e:                  # the tool failed: tell the model what happened and what to try
        return result(f"{type(e).__name__}: {e}", True)


def run_agent(client, model, system, registry, user_text, *, gate=None, max_turns=8, max_total_tokens=20000,
              max_same_call=3, on_event=print):
    tools = [t.spec() for t in registry.values()]
    messages = [{"role": "user", "content": user_text}]
    spent, seen = 0, {}
    for turn in range(1, max_turns + 1):
        resp = client.messages.create(model=model, max_tokens=1024, system=system, tools=tools, messages=messages)
        spent += resp.usage.input_tokens + resp.usage.output_tokens
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason != "tool_use":
            return final_text(resp), messages
        if spent > max_total_tokens:
            raise AgentStopped(f"token budget exceeded: {spent} > {max_total_tokens}")
        results = []
        for b in resp.content:
            if b.type != "tool_use":
                continue
            sig = (b.name, json.dumps(b.input, sort_keys=True))
            seen[sig] = seen.get(sig, 0) + 1
            if seen[sig] >= max_same_call:
                raise AgentStopped(f"stuck: {b.name} called {seen[sig]} times with the same input")
            r = execute(b, registry, gate)
            on_event(f"turn {turn}: {b.name}({json.dumps(b.input)}) -> {'ERROR ' if r.get('is_error') else ''}{r['content'][:70]}")
            results.append(r)
        messages.append({"role": "user", "content": results})
    raise AgentStopped(f"no final answer after {max_turns} turns")
