"""Run the pipeline over the question set. Two separate checks per question:
retrieval (did the cited chunk come from the right document?) and answer (does the answer contain the right fact?).
"""
from answer import ABSTAIN, answer, unsupported_numbers
from chunk import chunk_all, heading_chunks
from corpus import DOCS, QUESTIONS
from retrieve import Index

index = Index(chunk_all(DOCS, heading_chunks))

retrieved = answered = abstained = 0
for q, gold, fact in QUESTIONS:
    out = answer(index, q)
    cited = out["citations"][0]["chunk"].split("#")[0] if out["citations"] else None
    if gold is None:
        ok = out["answer"] == ABSTAIN
        abstained += ok
        print(f"{'OK ' if ok else 'BAD'} [abstain] {q} -> {out['answer'][:40]}")
        continue
    r_ok, a_ok = cited == gold, fact.lower() in out["answer"].lower()
    retrieved += r_ok
    answered += a_ok
    tag = "OK " if (r_ok and a_ok) else ("RETRIEVAL" if not r_ok else "ANSWER   ")
    print(f"{tag:9} {q}\n          -> {out['answer'][:100]}")

n = sum(1 for _, g, _ in QUESTIONS if g)
print(f"\nretrieval: right document cited for {retrieved} of {n}")
print(f"answer:    right fact in the answer for {answered} of {n}")
print(f"abstain:   correct 'not in the documents' for {abstained} of {len(QUESTIONS) - n}")

print("\nAccess control (same question, two callers):")
for groups in ((), ("finance",)):
    out = answer(index, "How big is the annual bonus pool for the finance team?", groups)
    print(f"  groups={groups or 'none'}: {out['answer'][:100]}")

print("\nFaithfulness guard on a made-up model reply:")
chunk = index.chunks[[c["id"] for c in index.chunks].index("log-retention#1")]["text"]
for reply in ("Pipeline run logs are kept for 90 days.", "Pipeline run logs are kept for 120 days."):
    print(f"  {reply!r} -> unsupported numbers: {unsupported_numbers(reply, [chunk])}")
