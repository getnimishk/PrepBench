"""How chunk size changes retrieval and answer correctness on the 22 answerable questions (hybrid retrieval, overlap = 20 percent)."""
from answer import answer
from chunk import chunk_all, fixed_chunks, heading_chunks
from corpus import DOCS, QUESTIONS
from retrieve import Index


def score(chunker, **kw):
    index = Index(chunk_all(DOCS, chunker, **kw))
    right_doc = right_fact = 0
    wrong = []
    for q, gold, fact in QUESTIONS:
        if not gold:
            continue
        out = answer(index, q)
        cited = out["citations"][0]["chunk"].split("#")[0] if out["citations"] else None
        right_doc += cited == gold
        ok = fact.lower() in out["answer"].lower()
        right_fact += ok
        if not ok:
            wrong.append(q)
    return len(index.chunks), right_doc, right_fact, wrong


if __name__ == "__main__":
    print("chunker              chunks  right document  right fact (of 22)")
    for size in (8, 15, 25, 40, 80, 150):
        n, d, f, _ = score(fixed_chunks, size=size, overlap=max(1, size // 5))
        print(f"fixed {size:3} words      {n:5}   {d:8}        {f:8}")
    n, d, f, wrong = score(heading_chunks)
    print(f"by heading          {n:5}   {d:8}        {f:8}")
