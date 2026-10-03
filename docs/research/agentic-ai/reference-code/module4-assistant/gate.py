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
