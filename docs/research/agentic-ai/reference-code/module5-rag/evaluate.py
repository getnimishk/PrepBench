"""Retrieval metrics over the question set. 'hit@k': did any of the top k chunks come from the gold document?"""
from corpus import DOCS, QUESTIONS
from chunk import chunk_all, fixed_chunks, heading_chunks
from retrieve import Index, search


def run(chunker, mode, top=3, **kw):
    index = Index(chunk_all(DOCS, chunker, **kw))
    answerable = [(q, g) for q, g, _ in QUESTIONS if g]
    hits, top1, rr, misses = 0, 0, 0.0, []
    for q, gold in answerable:
        found = search(index, q, mode, top=top)
        docs = [index.chunks[i]["doc"] for i in found]
        if gold in docs:
            hits += 1
            top1 += docs[0] == gold
            rr += 1.0 / (docs.index(gold) + 1)
        else:
            misses.append((q, docs))
    n = len(answerable)
    return dict(chunks=len(index.chunks), hit=hits / n, hit1=top1 / n, mrr=rr / n, misses=misses, n=n)


if __name__ == "__main__":
    print(f"{'chunker':30} {'mode':8} chunks  hit@1  hit@3   MRR")
    for name, ch, kw in [("fixed 40 words, 10 overlap", fixed_chunks, {}),
                         ("fixed 25 words, 5 overlap", fixed_chunks, dict(size=25, overlap=5)),
                         ("heading + title context", heading_chunks, {})]:
        for mode in ("bm25", "tfidf", "trigram", "hybrid"):
            r = run(ch, mode, **kw)
            print(f"{name:30} {mode:8} {r['chunks']:5}  {r['hit1']:.2f}   {r['hit']:.2f}   {r['mrr']:.2f}")
