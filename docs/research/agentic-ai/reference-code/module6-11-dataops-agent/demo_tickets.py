"""Five tickets through the DataOps agent with a scripted model. Shows the tiers, the approval gate and the audit log."""
from agent import handle_ticket
from agentkit import ApprovalGate
from checkpoint import RunStore
from detect import make_series
from scripted import ScriptedModel, call, text

baseline = make_series()
store, world = RunStore(), {"reruns": [], "quarantined": []}


def person(tool, args):                       # stands in for the human: approves reruns, refuses everything else
    return (tool == "rerun_job", "sam.reviewer")


gate = ApprovalGate(person)

READ_ONLY_PATH = lambda p, code: [[call("a", "get_run_log", pipeline=p)], [call("b", "search_runbook", error_code=code)]]

CASES = [
    # (ticket, today's row count, scripted model turns)
    ({"id": "T-1", "pipeline": "orders", "text": "orders row count looks slightly low"}, 1_175_000, None),
    ({"id": "T-2", "pipeline": "refunds", "text": "refunds nightly load failed, can you look?"}, 1_150_000,
     READ_ONLY_PATH("refunds", "ERR-6001") + [[text("Refunds failed with ERR-6001, warehouse quota exceeded. The runbook has no automatic fix: page the platform on-call.")]]),
    ({"id": "T-3", "pipeline": "payments", "text": "payments has no data since last night"}, 800_000,
     READ_ONLY_PATH("payments", "ERR-4417") + [[call("c", "quarantine_files", pipeline="payments", reason="schema drift ERR-4417, hold new files")],
                                              [text("Payments failed with ERR-4417 (schema drift). I asked to hold new files; a person declined, so nothing was changed. The data owner must approve a schema update.")]]),
    ({"id": "T-4", "pipeline": "customers", "text": "customers table is stale"}, 800_000,
     READ_ONLY_PATH("customers", "ERR-5102") + [[call("d", "rerun_job", pipeline="customers")],
                                               [text("Customers failed with ERR-5102 (late file). The rerun was approved and scheduled.")]]),
    ({"id": "T-5", "pipeline": "orders", "text": "orders looks fine but please double check"}, 1_200_000, None),
]

for ticket, value, turns in CASES:
    print(f"\n== {ticket['id']}: {ticket['text']}")
    model = ScriptedModel(turns) if turns else None
    rec = handle_ticket(ticket, baseline, value, model, store, gate, world)
    print(f"   z={rec['z']}  tier {rec['tier']} ({rec['response']})  tools={rec['tools']}")
    print(f"   final: {rec['final']}")

print("\nworld after the run:", world)
print("audit log (who approved what):")
for e in gate.audit:
    print(f"  {e['ticket']} {e['tool']} {e['args']} -> {e['decision']} by {e['by']}")
