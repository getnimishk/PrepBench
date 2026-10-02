"""Kill the agent mid-run, twice, and resume. Shows (1) a clean resume and (2) the dangerous window: the write ran, the checkpoint did not."""
from agent import handle_ticket
from agentkit import ApprovalGate
from checkpoint import RunStore
from detect import make_series
from scripted import ScriptedModel, call, text

baseline = make_series()
ticket = {"id": "T-9", "pipeline": "customers", "text": "customers table is stale"}
TURNS = [[call("a", "get_run_log", pipeline="customers")], [call("b", "search_runbook", error_code="ERR-5102")],
         [call("c", "rerun_job", pipeline="customers")], [text("Late file (ERR-5102). Rerun approved and scheduled.")]]
gate = ApprovalGate(lambda tool, args: (True, "sam.reviewer"))

print("--- Scenario A: killed AFTER step 2 was saved, BEFORE the write")
store, world = RunStore(), {"reruns": [], "quarantined": []}
from resumable import run_resumable
from tools import make_registry

m1 = ScriptedModel(TURNS)
try:        # max_turns=2 stands in for the process being killed after the second step
    reg = make_registry("T-9", store, world)
    run_resumable(m1, "run-T-9", "sys", reg, "Ticket T-9", store, gate=gate, ticket="T-9", max_turns=2)
except Exception as e:
    print("  process stopped:", e)
print("  saved:", store.load("run-T-9")["step"], "steps; reruns so far:", world["reruns"])
m2 = ScriptedModel(TURNS)
rec = handle_ticket(ticket, baseline, 800_000, m2, store, gate, world)
print("  resumed run finished:", rec["final"])
print("  reruns:", world["reruns"], "| model calls after resume:", m2.calls, "(a full re-run would need 4)")

print("\n--- Scenario B: killed AFTER the write ran, BEFORE its checkpoint was saved")
store, world = RunStore(), {"reruns": [], "quarantined": []}
gate = ApprovalGate(lambda tool, args: (True, "sam.reviewer"))
m3 = ScriptedModel(TURNS)
try:
    handle_ticket(ticket, baseline, 800_000, m3, store, gate, world, crash_after_write=True)
except SystemExit as e:
    print("  process died:", e)
print("  reruns at the moment of the crash:", world["reruns"], "| checkpoint saved up to step", store.load("run-T-9")["step"])
m4 = ScriptedModel(TURNS)
rec = handle_ticket(ticket, baseline, 800_000, m4, store, gate, world)
print("  resumed run finished:", rec["final"])
print("  reruns after resume:", world["reruns"], "(the write was NOT repeated)")
print("  approvals recorded:", len(gate.audit), "(the person was not asked a second time)")
