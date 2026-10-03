"""Trace one agent run, find a real problem in the trace, fix it, and trace again.

The planted problem (a stand-in for something real traces often show): get_run_log returns the WHOLE log, which is large.
The trace shows it twice: one very slow tool span, and a jump in input tokens on the next model call.
The fix: return only the last lines of the log. Same tickets, same script, same tools otherwise.
"""
import json

from agentkit import Tool
from checkpoint import RunStore
from scripted import ScriptedModel, call, text
from tools import LOGS, RunLog, make_registry
from trace import Tracer, diagnose, traced_run

BIG = "\n".join(f"2026-09-30 02:{i % 60:02d} step {i} ok rows={1000 + i}" for i in range(2000))     # ~2,000 lines of routine output
FULL_LOG = {**LOGS, "customers": BIG + "\n" + LOGS["customers"]}


def registry(tail):
    reg = make_registry("T-7", RunStore(), {"reruns": [], "quarantined": []})
    def read(a, k):
        text_ = FULL_LOG[a.pipeline]
        return "\n".join(text_.splitlines()[-3:]) if tail else text_
    reg["get_run_log"] = Tool("get_run_log", "Return the latest run log for one pipeline. Read-only.", RunLog, read)
    return reg


TURNS = [[call("a", "get_run_log", pipeline="customers")], [call("b", "search_runbook", error_code="ERR-5102")],
         [text("Late file (ERR-5102). The runbook says rerun once the file lands; a person must approve it.")]]

def run(tail):
    tr = Tracer()
    traced_run(ScriptedModel(TURNS), "You are a DataOps triage assistant.", registry(tail), "Ticket T-7: customers table is stale", tr)
    return tr, diagnose(tr.spans)


if __name__ == "__main__":
    for label, tail in (("before", False), ("after", True)):
        tr, d = run(tail)
        print(f"--- {label} the fix ({'tail 3 lines' if tail else 'whole log'})")
        for k, v in d.items():
            print(f"  {k:22} {v}")
        if not tail:
            print("  one span as stored:", json.dumps(next(s for s in tr.spans if s["name"].startswith("execute_tool get_run_log"))))
