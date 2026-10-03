"""Grounded answering around retrieval: access filter, abstention, citations and a crude faithfulness check.

The 'model' here is extractive (it quotes the best-matching sentence), so it cannot invent anything. That keeps
the pipeline testable without a key. `unsupported_numbers` is the kind of cheap guard you add around a real LLM.
"""
import re

from retrieve import Index, search, terms

ABSTAIN = "Not in the documents."


def best_sentence(question, body, idf):
    """Pick the sentence sharing the most (rarity-weighted) terms with the question. `body` excludes the title prefix."""
    q = set(terms(question))
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", body) if s]
    return max(sentences, key=lambda s: sum(idf.get(w, 0) for w in q & set(terms(s))))


def answer(index: Index, question, groups=(), threshold=4.5):
    """Return {'answer', 'citations'}. Chunks the caller may not see are filtered BEFORE ranking."""
    visible = lambda i: index.chunks[i]["acl"] in ("all", *groups)
    scores = index.bm25(question)
    top = search(index, question, "hybrid", top=3, allowed=visible)
    if not top or max(scores[i] for i in top) < threshold:
        return {"answer": ABSTAIN, "citations": []}
    best = index.chunks[top[0]]
    cites = [{"chunk": index.chunks[i]["id"], "title": index.chunks[i]["title"], "updated": index.chunks[i]["updated"]} for i in top[:1]]
    return {"answer": f"{best_sentence(question, best.get('body', best['text']), index.idf)} [{best['id']}]", "citations": cites}


def unsupported_numbers(answer_text, source_texts):
    """Numbers in the answer that appear in none of the sources: a cheap check for an invented figure."""
    source_numbers = set(re.findall(r"\d+(?:\.\d+)?", " ".join(source_texts)))
    return sorted(set(re.findall(r"\d+(?:\.\d+)?", re.sub(r"\[[^\]]*\]", "", answer_text))) - source_numbers)
