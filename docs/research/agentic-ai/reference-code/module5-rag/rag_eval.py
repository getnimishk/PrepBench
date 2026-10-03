"""Evaluate the pipeline stage by stage and name the weakest link, with uncertainty.

Per question we record three things separately:
  retrieved : the right document was the top citation
  answered  : the answer contains the right fact
  abstained : (unanswerable questions only) the system said 'Not in the documents.'
Then the 'link' with the largest loss is the one to fix first.
"""
import math

from answer import ABSTAIN, answer
from chunk import chunk_all, heading_chunks
from corpus import DOCS, QUESTIONS
from retrieve import Index


def wilson(k, n, z=1.96):
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return round(100 * (centre - half)), round(100 * (centre + half))


def kappa(a, b):
    """Cohen's kappa: agreement between two yes/no labellers, corrected for the agreement you would get by chance."""
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    return (po - pe) / (1 - pe) if pe != 1 else 1.0


def evaluate(index):
    rows = []
    for q, gold, fact in QUESTIONS:
        out = answer(index, q)
        if gold is None:
            rows.append(dict(q=q, kind="unanswerable", abstained=out["answer"] == ABSTAIN))
            continue
        cited = out["citations"][0]["chunk"].split("#")[0] if out["citations"] else None
        rows.append(dict(q=q, kind="answerable", retrieved=cited == gold, answered=fact.lower() in out["answer"].lower()))
    return rows


if __name__ == "__main__":
    rows = evaluate(Index(chunk_all(DOCS, heading_chunks)))
    ans = [r for r in rows if r["kind"] == "answerable"]
    un = [r for r in rows if r["kind"] == "unanswerable"]
    stages = [("retrieval hit (right document cited)", sum(r["retrieved"] for r in ans), len(ans)),
              ("answer correct (right fact present)", sum(r["answered"] for r in ans), len(ans)),
              ("abstention (unanswerable questions)", sum(r["abstained"] for r in un), len(un))]
    for name, k, n in stages:
        lo, hi = wilson(k, n)
        print(f"{name:38} {k:2}/{n}  {100 * k / n:3.0f}%  (95% interval {lo}-{hi}%)")
    ok_given_retrieved = sum(r["answered"] for r in ans if r["retrieved"])
    n_ret = sum(r["retrieved"] for r in ans)
    print(f"answer correct, given the right document was retrieved: {ok_given_retrieved}/{n_ret}")
    print("\nlargest loss:", "answer step" if (n_ret - ok_given_retrieved) > (len(ans) - n_ret) else "retrieval",
          f"(retrieval lost {len(ans) - n_ret}, the answer step lost {n_ret - ok_given_retrieved})")
    # judge calibration: a person and an automatic judge both mark 20 answers 'faithful' yes/no (fictional labels)
    human = [1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1]
    judge = [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1]
    agree = sum(h == j for h, j in zip(human, judge))
    print(f"\njudge calibration (fictional labels): agree on {agree}/20 = {100 * agree / 20:.0f}%, kappa = {kappa(human, judge):.2f}")
