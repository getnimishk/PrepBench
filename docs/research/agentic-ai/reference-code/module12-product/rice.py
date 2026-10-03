"""RICE prioritisation with a stability check. score = reach x impact x confidence / effort (Intercom's scales).

Impact: 3 massive, 2 high, 1 medium, 0.5 low, 0.25 minimal.  Confidence: 1.0 high, 0.8 medium, 0.5 low.  Effort: person-months.
The author's own caution is that a score is not a rule. The stability check shows how much of the ranking is the numbers and how much is noise:
each input is nudged within a plausible band, many times, and we count how often each item comes out first.
Fictional backlog for the DataOps agent.
"""
import random
from collections import Counter

IMPACT = [0.25, 0.5, 1, 2, 3]
CONF = [0.5, 0.8, 1.0]

BACKLOG = [   # name, reach (tickets a month), impact, confidence, effort (person-months)
    ("Auto-diagnose late-file failures", 400, 2, 0.8, 2),
    ("Runbook search over all pipelines", 900, 1, 0.8, 3),
    ("Approved reruns from chat", 150, 2, 0.5, 4),
    ("Weekly anomaly digest", 60, 1, 1.0, 1),
    ("Cost dashboard for the agent", 20, 0.5, 1.0, 1.5),
    ("Multi-agent triage", 900, 3, 0.5, 8),
]


def score(reach, impact, conf, effort):
    return reach * impact * conf / effort


def rank(items=BACKLOG):
    return sorted(((n, round(score(r, i, c, e), 1)) for n, r, i, c, e in items), key=lambda x: -x[1])


def step(levels, v, rng):
    """Move an ordinal value one step up or down, or leave it."""
    i = min(range(len(levels)), key=lambda k: abs(levels[k] - v))
    return levels[max(0, min(len(levels) - 1, i + rng.choice([-1, 0, 0, 1])))]


def stability(items=BACKLOG, runs=5000, seed=5):
    rng, firsts = random.Random(seed), Counter()
    for _ in range(runs):
        scored = []
        for n, r, i, c, e in items:
            scored.append((score(r * rng.uniform(0.7, 1.3), step(IMPACT, i, rng), step(CONF, c, rng), e * rng.uniform(0.8, 1.4)), n))
        firsts[max(scored)[1]] += 1
    return {n: round(100 * k / runs, 1) for n, k in firsts.most_common()}


if __name__ == "__main__":
    print("RICE ranking:")
    for n, s in rank():
        print(f"  {s:7.1f}  {n}")
    print("\nHow often each item ranks first when inputs are nudged (5000 runs):")
    for n, p in stability().items():
        print(f"  {p:5.1f}%  {n}")
