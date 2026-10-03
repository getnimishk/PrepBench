"""Shared pieces for the DataOps agent: tools, the approval gate with an audit log, a scripted model, and one tool call.

Same message shapes as Anthropic's Messages API (tool_use / tool_result blocks), kept as plain dicts so a run can be
saved to JSON and resumed. Nothing here calls a network; the model is scripted so every run is repeatable.
"""
import json
import time
from dataclasses import dataclass
from typing import Callable

from pydantic import BaseModel, ValidationError


class AgentStopped(Exception):
    pass


@dataclass
class Tool:
    name: str
    description: str
    model: type[BaseModel]
    fn: Callable                       # fn(args, idempotency_key) -> JSON-able result
    writes: bool = False

    def spec(self):
        return {"name": self.name, "description": self.description, "input_schema": self.model.model_json_schema()}


class ApprovalGate:
    """A write runs only if a person says yes. Every decision is appended to an audit list (and a JSONL file if given)."""

    def __init__(self, ask: Callable[[str, dict], tuple[bool, str]], log_path: str | None = None):
        self.ask, self.log_path, self.audit = ask, log_path, []

    def approve(self, tool: str, args: dict, ticket: str = "") -> bool:
        for e in self.audit:                       # the same action was already approved (a resumed run): do not ask twice
            if (e["ticket"], e["tool"], e["args"], e["decision"]) == (ticket, tool, args, "approved"):
                return True
        ok, who = self.ask(tool, args)
        entry = {"time": time.strftime("%Y-%m-%dT%H:%M:%S"), "ticket": ticket, "tool": tool, "args": args,
                 "decision": "approved" if ok else "denied", "by": who}
        self.audit.append(entry)
        if self.log_path:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        return ok


def block_dict(b):
    """Turn a scripted-model block into a plain dict that can be stored as JSON."""
    if isinstance(b, dict):
        return b
    return {"type": "text", "text": b.text} if b.type == "text" else {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}


def run_tool(block: dict, registry: dict, gate: ApprovalGate | None, ticket: str = "") -> dict:
    """Run one tool_use block. Never raises: every failure goes back to the model as an error result."""
    def result(text, is_error=False):
        r = {"type": "tool_result", "tool_use_id": block["id"], "content": text}
        if is_error:
            r["is_error"] = True
        return r

    tool = registry.get(block["name"])
    if tool is None:
        return result(f"Unknown tool {block['name']!r}. Available: {sorted(registry)}", True)
    try:
        args = tool.model.model_validate(block["input"])
    except ValidationError as e:
        return result("Invalid input: " + "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors()), True)
    if tool.writes and not (gate and gate.approve(tool.name, args.model_dump(), ticket)):
        return result("A person did not approve this action, so it was not run. Report that and stop.", True)
    try:
        return result(json.dumps(tool.fn(args, block["id"])))
    except Exception as e:
        return result(f"{type(e).__name__}: {e}", True)
