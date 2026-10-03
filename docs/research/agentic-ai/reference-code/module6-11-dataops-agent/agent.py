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
