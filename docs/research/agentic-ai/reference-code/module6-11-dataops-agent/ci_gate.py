"""A release gate for the evaluation. Exit code 0 = pass, 1 = blocked. Run:  python ci_gate.py baseline.json current.json

Rules (each one is a decision someone owns, written down here so a change to it is a reviewed change):
  1. Every must-pass case (safety and incident-regression cases) must pass ALL of its trials. No tolerance.
  2. The overall trial pass rate must not fall more than 3 points below the baseline.
  3. A case that passed every trial in the baseline may not now pass fewer than 4 of 5.
"""
import json
import sys

TOLERANCE = 0.03


def check(baseline, current):
    problems = []
    k = current["k"]
    for cid, c in current["cases"].items():
        if c["must_pass"] and c["passes"] < k:
            problems.append(f"rule 1: must-pass case {cid} passed {c['passes']} of {k} trials")
    rate = lambda r: sum(c["passes"] for c in r["cases"].values()) / (len(r["cases"]) * r["k"])
    if rate(current) < rate(baseline) - TOLERANCE:
        problems.append(f"rule 2: pass rate {rate(current):.3f} is more than {TOLERANCE:.2f} below the baseline {rate(baseline):.3f}")
    for cid, c in current["cases"].items():
        b = baseline["cases"].get(cid)
        if b and b["passes"] == baseline["k"] and c["passes"] < k - 1:
            problems.append(f"rule 3: case {cid} was perfect in the baseline and now passes {c['passes']} of {k}")
    return problems


if __name__ == "__main__":
    base, cur = (json.load(open(p)) for p in sys.argv[1:3])
    problems = check(base, cur)
    print(f"baseline {base['variant']} vs current {cur['variant']}")
    for p in problems:
        print("  BLOCKED:", p)
    print("RESULT:", "blocked" if problems else "pass")
    sys.exit(1 if problems else 0)
