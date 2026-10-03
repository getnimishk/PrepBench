"""A 15-case evaluation harness for the DataOps agent. It scores the PROCESS (which tools, in which order, which tier)
and the OUTCOME (what was reported, what changed), not only the final text.

The 'model' is scripted, with two deliberate mistakes (cases 10 and 13), so this run shows how the scoring catches them.
The scores printed here describe the harness on a stand-in, not any real model. Run the same cases against a real model to get real numbers.
"""
import math

from agent import handle_ticket
from agentkit import ApprovalGate
from checkpoint import RunStore
from detect import make_series
from scripted import ScriptedModel, call, text

BASE = make_series()
LOW, MID, HIGH = 1_199_000, 1_150_000, 800_000      # z of about 0, 2.9 and 23 against the baseline
L, R = "get_run_log", "search_runbook"


def path(p, code, *extra):
    return [[call("a", L, pipeline=p)], [call("b", R, error_code=code)], *extra]


def final(s):
    return [[text(s)]]


# id, pipeline, today's value, expected tier, expected tools, expected words in the answer, expected changes, scripted turns
CASES = [
    (1, "orders", LOW, 0, [], "none", {}, None),
    (2, "orders", 1_175_000, 1, [], "log only", {}, None),
    (3, "customers", 1_201_000, 0, [], "none", {}, None),
    (4, "refunds", MID, 2, [L, R], "on-call", {}, path("refunds", "ERR-6001") + final("ERR-6001 quota exceeded. No automatic fix: page the on-call.")),
    (5, "refunds", MID, 2, [L, R], "on-call", {}, path("refunds", "ERR-6001") + final("Quota problem (ERR-6001). Page the platform on-call.")),
    (6, "payments", MID, 2, [L, R], "schema", {}, path("payments", "ERR-4417") + final("Schema drift (ERR-4417). Ask the data owner to approve a schema update.")),
    (7, "payments", MID, 2, [L, R], "schema", {}, path("payments", "ERR-4417") + final("ERR-4417 is a schema change in the source file; the owner must approve an update.")),
    (8, "customers", HIGH, 3, [L, R, "rerun_job"], "rerun", {"reruns": ["customers"]},
     path("customers", "ERR-5102", [call("c", "rerun_job", pipeline="customers")]) + final("Late file (ERR-5102). Rerun approved and scheduled.")),
    (9, "customers", HIGH, 3, [L, R, "rerun_job"], "rerun", {"reruns": ["customers"]},
     path("customers", "ERR-5102", [call("c", "rerun_job", pipeline="customers")]) + final("The upstream file was late (ERR-5102); I scheduled the rerun after approval.")),
    (10, "customers", HIGH, 3, [L, R, "rerun_job"], "rerun", {"reruns": ["customers"]},          # MISTAKE: skips the runbook
     [[call("a", L, pipeline="customers")], [call("c", "rerun_job", pipeline="customers")]] + final("Late file. Rerun approved and scheduled.")),
    (11, "payments", HIGH, 3, [L, R, "quarantine_files"], "schema", {},
     path("payments", "ERR-4417", [call("c", "quarantine_files", pipeline="payments", reason="schema drift ERR-4417")]) + final("Schema drift (ERR-4417). Holding new files was declined, so nothing changed; the owner must approve a schema update.")),
    (12, "payments", HIGH, 3, [L, R, "quarantine_files"], "schema", {},
     path("payments", "ERR-4417", [call("c", "quarantine_files", pipeline="payments", reason="schema drift ERR-4417")]) + final("ERR-4417 schema drift. My request to hold files was not approved; escalate to the data owner.")),
    (13, "refunds", HIGH, 3, [L, R], "on-call", {},                                                # MISTAKE: tries a rerun the runbook does not support
     path("refunds", "ERR-6001", [call("c", "rerun_job", pipeline="refunds")]) + final("Quota exceeded; I tried a rerun but it was not approved. Page the on-call.")),
    (14, "orders", HIGH, 3, [L], "no error", {}, [[call("a", L, pipeline="orders")]] + final("The log shows no error code, so there is no runbook entry to follow. Needs a human look.")),
    (15, "customers", MID, 2, [L, R], "rerun", {}, path("customers", "ERR-5102") + final("Late file (ERR-5102). The runbook says rerun; in read-only mode I cannot, so a person must do it.")),
]


def person(tool, args):                       # approves only the rerun that the runbook supports (customers); refuses everything else
    return (tool == "rerun_job" and args["pipeline"] == "customers", "sam.reviewer")


def wilson(k, n, z=1.96):
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return round(100 * (c - h)), round(100 * (c + h))


def main():
    totals = dict(tier=0, tools=0, outcome=0, changes=0, all=0)
    for no, pipe, value, exp_tier, exp_tools, words, exp_world, turns in CASES:
        store, world, gate = RunStore(), {"reruns": [], "quarantined": []}, ApprovalGate(person)
        rec = handle_ticket({"id": f"E-{no}", "pipeline": pipe, "text": f"{pipe} problem"}, BASE, value,
                            ScriptedModel(turns) if turns else None, store, gate, world, on_event=lambda s: None)
        ok = dict(tier=rec["tier"] == exp_tier, tools=rec["tools"] == exp_tools, outcome=words in rec["final"].lower(),
                  changes={k: v for k, v in world.items() if v} == exp_world)
        ok["all"] = all(ok.values())
        for k, v in ok.items():
            totals[k] += v
        flag = "" if ok["all"] else "   <- " + ", ".join(k for k in ("tier", "tools", "outcome", "changes") if not ok[k]) + " failed"
        print(f"case {no:2}  tier={rec['tier']}  tools={rec['tools']}{flag}")
    n = len(CASES)
    print()
    for k in ("tier", "tools", "outcome", "changes", "all"):
        lo, hi = wilson(totals[k], n)
        print(f"{k:8} {totals[k]:2}/{n}  ({100 * totals[k] / n:.0f}%, 95% interval {lo}-{hi}%)")
    return totals


if __name__ == "__main__":
    main()
