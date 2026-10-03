"""Tracing for the agent loop: one span per agent run, per model call and per tool call, with OpenTelemetry-style attribute names.

The attribute names (gen_ai.operation.name, gen_ai.usage.input_tokens, ...) follow the OpenTelemetry GenAI conventions, which are marked
'Development' (not yet stable). We write the spans as plain JSON lines so no exporter is needed to learn from them.
Content (arguments, results, prompts) is NOT stored by default: the conventions flag it as potentially sensitive. Sizes and a short hash are.

Time is simulated so a run is repeatable: a model call takes 0.6 s + 0.4 ms per input token + 10 ms per output token,
a tool call 0.2 s + 1 s per 20,000 characters returned. These constants are assumptions for the exercise, not measurements.
"""
import hashlib
import json
import math

from agentkit import block_dict, run_tool


def est_tokens(obj) -> int:
    return math.ceil(len(json.dumps(obj, default=str)) / 4)       # 4 characters per token, a rough guide


class Tracer:
    def __init__(self, capture_content=False):
        self.spans, self.now, self.capture, self._n = [], 0.0, capture_content, 0

    def start(self, name, parent=None, **attrs):
        self._n += 1
        span = {"span_id": f"s{self._n}", "parent": parent["span_id"] if parent else None, "name": name, "start": round(self.now, 3), "attrs": attrs}
        self.spans.append(span)
        return span

    def end(self, span, advance=0.0, **attrs):
        self.now += advance
        span["end"] = round(self.now, 3)
        span["attrs"].update(attrs)

    def jsonl(self):
        return "\n".join(json.dumps(s) for s in self.spans)


def traced_run(client, system, registry, user_text, tracer: Tracer, *, gate=None, max_turns=8, model="stand-in"):
    tools = [t.spec() for t in registry.values()]
    messages = [{"role": "user", "content": user_text}]
    root = tracer.start("invoke_agent dataops", **{"gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "dataops"})
    for turn in range(max_turns):
        n_in = est_tokens(system) + est_tokens(tools) + est_tokens(messages)
        chat = tracer.start(f"chat {model}", root, **{"gen_ai.operation.name": "chat", "gen_ai.request.model": model, "gen_ai.usage.input_tokens": n_in})
        resp = client.messages.create(model=model, max_tokens=1024, system=system, tools=tools, messages=messages)
        content = [block_dict(b) for b in resp.content]
        n_out = est_tokens(content)
        tracer.end(chat, 0.6 + 0.0004 * n_in + 0.01 * n_out, **{"gen_ai.usage.output_tokens": n_out})
        messages.append({"role": "assistant", "content": content})
        if resp.stop_reason != "tool_use":
            tracer.end(root)
            return content[0]["text"], messages
        results = []
        for b in content:
            if b["type"] != "tool_use":
                continue
            span = tracer.start(f"execute_tool {b['name']}", root, **{"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": b["name"], "gen_ai.tool.call.id": b["id"],
                                "app.args_hash": hashlib.sha1(json.dumps(b["input"], sort_keys=True).encode()).hexdigest()[:8]})
            r = run_tool(b, registry, gate)
            size = len(r["content"])
            tracer.end(span, 0.2 + size / 20000, **{"app.result_chars": size, "app.is_error": bool(r.get("is_error"))})
            if tracer.capture:
                span["attrs"]["gen_ai.tool.call.arguments"] = b["input"]
            results.append(r)
        messages.append({"role": "user", "content": results})
    tracer.end(root)
    raise RuntimeError("no final answer")


def diagnose(spans):
    """What a person looks for in a trace: the slowest span, the biggest jump in input tokens, and repeated identical tool calls."""
    dur = lambda s: s["end"] - s["start"]
    slowest = max((s for s in spans if s["parent"]), key=dur)
    chats = [s for s in spans if s["attrs"].get("gen_ai.operation.name") == "chat"]
    jumps = [(b["attrs"]["gen_ai.usage.input_tokens"] - a["attrs"]["gen_ai.usage.input_tokens"], b) for a, b in zip(chats, chats[1:])]
    jump = max(jumps, key=lambda x: x[0]) if jumps else (0, None)
    tools = [(s["attrs"]["gen_ai.tool.name"], s["attrs"]["app.args_hash"]) for s in spans if s["attrs"].get("gen_ai.operation.name") == "execute_tool"]
    repeats = sorted({t for t in tools if tools.count(t) > 1})
    return {
        "total_seconds": round(max(s["end"] for s in spans), 2),
        "model_calls": len(chats),
        "input_tokens_total": sum(s["attrs"]["gen_ai.usage.input_tokens"] for s in chats),
        "slowest_span": f"{slowest['name']} ({dur(slowest):.2f} s)",
        "biggest_token_jump": f"+{jump[0]} input tokens before {jump[1]['span_id']}" if jump[1] else "none",
        "repeated_tool_calls": repeats,
    }
