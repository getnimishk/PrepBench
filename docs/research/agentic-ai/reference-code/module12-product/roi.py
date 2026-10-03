"""A one-page business case as code: monthly net benefit and payback, with a range, and which input matters most.

Everything is a FICTIONAL assumption for the DataOps agent. Run cost per task comes from the cost model in lesson 49 (model spend plus people taking over failures).
benefit = successes x minutes saved per task x loaded hourly cost
cost    = tasks x model cost per task + failures x takeover cost + monthly run overhead + build cost / months
"""
import random
import statistics

# (low, most likely, high)
INPUTS = {
    "tasks_per_month": (4000, 6000, 8000),
    "minutes_saved_per_success": (6, 12, 18),
    "loaded_cost_per_hour": (40, 55, 75),
    "success_rate": (0.80, 0.90, 0.95),
    "model_cost_per_task": (0.008, 0.013, 0.020),
    "takeover_cost_per_failure": (8, 15, 30),
    "monthly_overhead": (800, 1500, 3000),        # hosting, monitoring, evaluation runs, review time
    "build_cost": (30000, 45000, 80000),          # one-off, spread over 24 months
}
AMORTISE_MONTHS = 24


def net(v):
    successes = v["tasks_per_month"] * v["success_rate"]
    failures = v["tasks_per_month"] - successes
    benefit = successes * v["minutes_saved_per_success"] / 60 * v["loaded_cost_per_hour"]
    cost = (v["tasks_per_month"] * v["model_cost_per_task"] + failures * v["takeover_cost_per_failure"]
            + v["monthly_overhead"] + v["build_cost"] / AMORTISE_MONTHS)
    return benefit - cost, benefit, cost


def likely():
    return {k: m for k, (lo, m, hi) in INPUTS.items()}


def simulate(runs=20000, seed=9):
    rng = random.Random(seed)
    nets, paybacks = [], []
    for _ in range(runs):
        v = {k: rng.triangular(lo, hi, m) for k, (lo, m, hi) in INPUTS.items()}
        n, _, _ = net({**v})
        nets.append(n)
        monthly_before_build = n + v["build_cost"] / AMORTISE_MONTHS
        paybacks.append(v["build_cost"] / monthly_before_build if monthly_before_build > 0 else float("inf"))
    nets.sort()
    p = lambda xs, q: xs[int(q * (len(xs) - 1))]
    finite = sorted(x for x in paybacks if x != float("inf"))
    return dict(net_10_50_90=(p(nets, .1), p(nets, .5), p(nets, .9)), prob_positive=sum(n > 0 for n in nets) / runs,
                payback_months_median=statistics.median(finite) if finite else None)


def tornado():
    base = net(likely())[0]
    rows = []
    for k, (lo, m, hi) in INPUTS.items():
        a = net({**likely(), k: lo})[0]
        b = net({**likely(), k: hi})[0]
        rows.append((k, a - base, b - base))
    return base, sorted(rows, key=lambda r: -abs(r[2] - r[1]))


if __name__ == "__main__":
    n, b, c = net(likely())
    print(f"Most likely month: benefit ${b:,.0f}, cost ${c:,.0f}, net ${n:,.0f}")
    s = simulate()
    print("Net per month, 10th / 50th / 90th percentile: " + " / ".join(f"${x:,.0f}" for x in s["net_10_50_90"]))
    print(f"Chance the month is net positive: {100 * s['prob_positive']:.0f}%   median payback of the build: {s['payback_months_median']:.1f} months")
    base, rows = tornado()
    print(f"\nWhat moves the answer (each input at its low then high, others likely; base net ${base:,.0f}):")
    for k, lo, hi in rows:
        print(f"  {k:28} {lo:+10,.0f}  {hi:+10,.0f}")
