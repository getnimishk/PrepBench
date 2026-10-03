"""A weighted build / extend / buy scorecard, with a check that the winner does not depend on the exact weights.

The need (fictional): a ticket-triage assistant for platform operations. Scores are 1 (poor) to 5 (strong), each with the evidence behind it.
The stability test redraws the weights around the stated ones many times and counts how often each option wins.
"""
import random

CRITERIA = {   # name: weight (sum 100)
    "fit to the need": 25, "time to first value": 15, "data and security fit": 20, "total cost over 3 years": 15,
    "exit and lock-in": 15, "team skills to run it": 10,
}
OPTIONS = {    # option: scores in the same order as CRITERIA
    "Buy a ready-made agent product": [3, 5, 3, 3, 2, 5],
    "Extend a managed platform (prompt/hosted agent)": [4, 4, 4, 4, 3, 3],
    "Build on our own framework and stack": [5, 2, 5, 2, 5, 2],
}
EVIDENCE_REQUIRED = ("evidence", "exit plan")


def totals(weights=None):
    w = list(weights or CRITERIA.values())
    s = sum(w)
    return {o: round(sum(wi * si for wi, si in zip(w, sc)) / s, 2) for o, sc in OPTIONS.items()}


def stability(runs=10000, seed=2, spread=0.4):
    rng, wins = random.Random(seed), {o: 0 for o in OPTIONS}
    base = list(CRITERIA.values())
    for _ in range(runs):
        w = [max(1, b * rng.uniform(1 - spread, 1 + spread)) for b in base]
        t = totals(w)
        wins[max(t, key=t.get)] += 1
    return {o: round(100 * n / runs, 1) for o, n in wins.items()}


def check_recommendation(rec: dict) -> list[str]:
    """A recommendation must carry its evidence and an exit plan, or it is only a score."""
    problems = [f"missing {k}" for k in EVIDENCE_REQUIRED if not rec.get(k)]
    if rec.get("exit plan") and not all(x in rec["exit plan"].lower() for x in ("vendor fails", "model retired")):
        problems.append("exit plan must cover both a vendor failing and a model being retired")
    return problems


if __name__ == "__main__":
    print("Weighted totals:", totals())
    print("Winner share when weights vary by +/-40%:", stability())
