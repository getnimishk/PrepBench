"""Deterministic detection (plain code, no AI) and the tiered response it selects.

A statistical band from a baseline window: how many standard deviations is today's value from the baseline mean?
  below 1 sigma : nothing
  1 to 2 sigma  : tier 1, log only
  2 to 3 sigma  : tier 2, read-only diagnosis (the agent may look, not touch)
  3 sigma +     : tier 3, the agent may PROPOSE a fix; a person approves before anything changes
This is the pattern from the course's 'closing the loop on metrics' lesson, written fresh here.
"""
import random
import statistics


def make_series(seed=7, days=28, mean=1_200_000, sd=20_000):
    """Fictional nightly row counts for one pipeline, reproducible from the seed."""
    rng = random.Random(seed)
    return [round(rng.gauss(mean, sd)) for _ in range(days)]


def tier(baseline, value):
    mu, sd = statistics.mean(baseline), statistics.stdev(baseline)
    z = abs(value - mu) / sd
    if z < 1:
        return {"z": round(z, 2), "tier": 0, "response": "none"}
    if z < 2:
        return {"z": round(z, 2), "tier": 1, "response": "log only"}
    if z < 3:
        return {"z": round(z, 2), "tier": 2, "response": "read-only diagnosis"}
    return {"z": round(z, 2), "tier": 3, "response": "propose a fix (a person approves)"}
