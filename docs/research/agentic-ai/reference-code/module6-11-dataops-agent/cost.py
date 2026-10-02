"""Cost per successful task and median latency for two model-tier designs at 10,000 tasks a day, with uncertainty.

EVERY NUMBER BELOW IS AN ASSUMPTION except the two prices, which come from the Anthropic pricing page read on 2026-10-02
(Sonnet 5.5: $2 in / $10 out per million tokens; Haiku 4.5: $1 in / $5 out; a cache read costs 0.1x the input price; the page says Claude 4.7
and later models, which include Sonnet 5.5, use a tokenizer that produces about 30 percent more tokens for the same text than Haiku 4.5's).
Change the assumptions and the answer changes; the point is to see WHICH assumptions the answer is sensitive to.

Design A: Sonnet 5.5 for every model step.
Design B: Haiku 4.5 for tier-2 diagnoses (read-only), Sonnet 5.5 for tier-3 diagnose-and-propose.
"""
import random
import statistics

TASKS_PER_DAY = 10_000
PRICE = {"sonnet": (2.0, 10.0), "haiku": (1.0, 5.0)}                # USD per million tokens (input, output), read 2026-10-02
TOKENIZER = {"sonnet": 1.30, "haiku": 1.00}                         # tokens for the same text, relative to Haiku 4.5 (page: about 30% more)
CACHE_READ = 0.1                                                    # cache read price as a share of input price (page: 0.1x; assumes the prefix stays warm)


def tri(rng, lo, mode, hi):
    return rng.triangular(lo, hi, mode)


def one_day(rng, design):
    """Simulate one day's 10,000 tasks. Returns (model_cost, escalation_cost, successes, latencies)."""
    share_t3 = tri(rng, 0.20, 0.30, 0.40)                           # assumption: how many tasks reach tier 3
    prefix = 1_800                                                  # system prompt + tool definitions, tokens (cached)
    log_tokens, rb_tokens, ctx0 = tri(rng, 300, 600, 1200), 300, 150
    retry = tri(rng, 1.02, 1.06, 1.15)                              # extra calls from retries
    esc_cost = tri(rng, 8, 15, 30)                                  # USD per task a person must take over (about 10 to 30 minutes)
    p_sonnet = tri(rng, 0.88, 0.93, 0.97)                           # success rate of Sonnet on these tasks (assumption)
    p_haiku = tri(rng, 0.75, 0.85, 0.92)                            # success rate of Haiku on tier-2 diagnoses (assumption)
    model_cost = esc_total = 0.0
    successes, lats = 0, []
    for _ in range(TASKS_PER_DAY):
        t3 = rng.random() < share_t3
        steps = 4 if t3 else 3                                      # calls per task: log, runbook, (proposal,) answer
        m = "sonnet" if (t3 or design == "A") else "haiku"
        k = TOKENIZER[m]
        cost = lat = 0.0
        ctx = ctx0
        for s in range(steps):
            fresh = ctx * k
            out = 80 * k
            cost += (prefix * k * CACHE_READ * PRICE[m][0] + fresh * PRICE[m][0] + out * PRICE[m][1]) / 1e6
            lat += (0.5 + out * 0.012 + (prefix * k + fresh) * 0.0002) * (0.6 if m == "haiku" else 1.0) + 0.3
            ctx += (log_tokens if s == 0 else rb_tokens if s == 1 else 60)
        model_cost += cost * retry
        lats.append(lat * rng.uniform(0.9, 1.3))
        ok = rng.random() < (p_sonnet if m == "sonnet" else p_haiku)
        successes += ok
        if not ok:
            esc_total += esc_cost
    return model_cost, esc_total, successes, lats


def simulate(design, days=60, seed=11):
    rng = random.Random(f"{design}|{seed}")
    rows = [one_day(rng, design) for _ in range(days)]
    per_ok = sorted(m / s for m, _, s, _ in rows)
    all_in = sorted((m + e) / s for m, e, s, _ in rows)
    pct = lambda xs, q: xs[int(q * (len(xs) - 1))]
    lat = sorted(statistics.median(r[3]) for r in rows)
    return dict(model_per_success=(pct(per_ok, .1), pct(per_ok, .5), pct(per_ok, .9)),
                total_per_success=(pct(all_in, .1), pct(all_in, .5), pct(all_in, .9)),
                daily_model=(pct(sorted(r[0] for r in rows), .1), pct(sorted(r[0] for r in rows), .5), pct(sorted(r[0] for r in rows), .9)),
                success_rate=statistics.mean(r[2] for r in rows) / TASKS_PER_DAY,
                latency=(pct(lat, .1), pct(lat, .5), pct(lat, .9)))


def point_estimate(design, p_haiku, p_sonnet=0.93, share_t3=0.30, esc_cost=15.0, log_tokens=600, retry=1.06):
    """The same model with every uncertain input at its most likely value: used to find the break-even success rate for Haiku."""
    def task_cost(model, steps):
        k, ctx, cost = TOKENIZER[model], 150, 0.0
        for s in range(steps):
            cost += (1_800 * k * CACHE_READ * PRICE[model][0] + ctx * k * PRICE[model][0] + 80 * k * PRICE[model][1]) / 1e6
            ctx += (log_tokens if s == 0 else 300 if s == 1 else 60)
        return cost * retry
    m2 = "sonnet" if design == "A" else "haiku"
    p2 = p_sonnet if design == "A" else p_haiku
    model = TASKS_PER_DAY * ((1 - share_t3) * task_cost(m2, 3) + share_t3 * task_cost("sonnet", 4))
    ok = TASKS_PER_DAY * ((1 - share_t3) * p2 + share_t3 * p_sonnet)
    fails = TASKS_PER_DAY - ok
    return model, fails * esc_cost, ok


def break_even():
    a_model, a_esc, a_ok = point_estimate("A", 0)
    target = (a_model + a_esc) / a_ok
    lo, hi = 0.5, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        m, e, ok = point_estimate("B", mid)
        lo, hi = (mid, hi) if (m + e) / ok > target else (lo, mid)
    return target, lo


if __name__ == "__main__":
    for d in ("A", "B"):
        r = simulate(d)
        f = lambda t, fmt: " / ".join(fmt.format(x) for x in t)
        print(f"Design {d}: success {100 * r['success_rate']:.1f}%")
        print(f"   model cost per day (10/50/90th)            ${f(r['daily_model'], '{:,.0f}')}")
        print(f"   model cost per successful task              ${f(r['model_per_success'], '{:.4f}')}")
        print(f"   incl. people taking over failures, per success ${f(r['total_per_success'], '{:.3f}')}")
        print(f"   median task latency, seconds                {f(r['latency'], '{:.1f}')}")
    target, p = break_even()
    print(f"\nBreak-even at the most likely inputs: Design B matches Design A on total cost per success (${target:.3f}) only if Haiku succeeds on {100 * p:.1f}% of tier-2 tasks (Sonnet: 93%).")
