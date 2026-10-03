"""Generate the evidence report for the governed RAG build: access test, evaluation by stage, a trace-like step list, and cost per query.

Cost is MODELLED: the toy answer step makes no model call, so we price the tokens a real call would send (estimated at 4 characters per token)
at the Sonnet 5.5 prices read on 2026-10-02 ($2 input, $10 output per million tokens). Replace the estimate with real usage numbers from your traces.
"""
import math
import statistics
import time

from answer import answer
from chunk import chunk_all, heading_chunks
from corpus import DOCS, QUESTIONS
from rag_eval import evaluate, wilson
from retrieve import Index, search

IN_PRICE, OUT_PRICE = 2.0, 10.0          # USD per million tokens
SYSTEM_TOKENS, OUT_TOKENS = 150, 60


def est(text):
    return math.ceil(len(text) / 4)


def cost_per_query(index, question, groups=()):
    visible = lambda i: index.chunks[i]["acl"] in ("all", *groups)
    top = search(index, question, "hybrid", top=3, allowed=visible)
    prompt = SYSTEM_TOKENS + est(question) + sum(est(index.chunks[i]["text"]) for i in top)
    return prompt, (prompt * IN_PRICE + OUT_TOKENS * OUT_PRICE) / 1e6


def access_test(index):
    q = "How big is the annual bonus pool for the finance team?"
    outside, inside = answer(index, q), answer(index, q, groups=("finance",))
    return {"outside_sees_restricted": "finance-bonus" in str(outside), "finance_sees_it": "finance-bonus" in str(inside), "outside_answer": outside["answer"]}


def report():
    index = Index(chunk_all(DOCS, heading_chunks))
    rows = evaluate(index)
    ans = [r for r in rows if r["kind"] == "answerable"]
    ret, ok = sum(r["retrieved"] for r in ans), sum(r["answered"] for r in ans)
    t0 = time.perf_counter()
    costs = [cost_per_query(index, q) for q, _, _ in QUESTIONS]
    ms = (time.perf_counter() - t0) * 1000 / len(QUESTIONS)
    a = access_test(index)
    lines = ["# Governed RAG evidence report (generated)", "",
             "## Access control", f"- A caller with no groups asked the restricted finance question: restricted document visible = **{a['outside_sees_restricted']}**; answer: `{a['outside_answer']}`",
             f"- A caller in the finance group: restricted document visible = **{a['finance_sees_it']}**", "",
             "## Evaluation by stage (25 questions: 22 answerable, 3 unanswerable)",
             f"- Right document cited: {ret} of {len(ans)} (95% interval {wilson(ret, len(ans))[0]} to {wilson(ret, len(ans))[1]}%)",
             f"- Right fact in the answer: {ok} of {len(ans)} (95% interval {wilson(ok, len(ans))[0]} to {wilson(ok, len(ans))[1]}%)",
             f"- Correct abstentions: {sum(r['abstained'] for r in rows if r['kind'] == 'unanswerable')} of 3", "",
             "## Cost per query (modelled, see the file header)",
             f"- Median prompt tokens: {statistics.median(c[0] for c in costs):.0f}; median cost per query: ${statistics.median(c[1] for c in costs):.5f}; per 1,000 queries: ${1000 * statistics.median(c[1] for c in costs):.2f}",
             f"- Retrieval time in this toy index: {ms:.2f} ms per query (not a benchmark)", "",
             "## What this report does not show",
             "- No real embedding model or LLM was used; the numbers describe the pipeline and the harness.",
             "- Restricted text could still land in logs, caches or traces that this report does not inspect."]
    return "\n".join(lines)


if __name__ == "__main__":
    print(report())
