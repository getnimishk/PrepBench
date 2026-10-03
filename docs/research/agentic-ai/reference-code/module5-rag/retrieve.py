"""Three retrievers and a fusion step, written with the standard library only so every number can be reproduced.

bm25     keyword scoring (the same family Azure AI Search and Databricks use for the keyword half of hybrid search)
tfidf    cosine similarity of TF-IDF vectors: a sparse 'vector' search. It is NOT a semantic embedding.
trigram  cosine similarity of character 3-gram counts: tolerant of typos and word endings, still not semantic.
Replace tfidf/trigram with a real embedding model in the lab to see what dense vectors add.
"""
import math
import re
from collections import Counter

STOP = set("a an the of to in on for is are be by do does can we i my what how who which when it and or at as with from this that".split())


def tokens(text):
    return [w for w in re.findall(r"[a-z0-9\-]+", text.lower()) if w not in STOP]


def stem(w):
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def terms(text):
    return [stem(w) for w in tokens(text)]


class Index:
    def __init__(self, chunks):
        self.chunks = chunks
        self.tf = [Counter(terms(c["text"])) for c in chunks]
        self.len = [sum(t.values()) for t in self.tf]
        self.avg = sum(self.len) / len(self.len)
        df = Counter(w for t in self.tf for w in t)
        n = len(chunks)
        self.idf = {w: math.log(1 + (n - d + 0.5) / (d + 0.5)) for w, d in df.items()}
        self.tri = [Counter(self._tri(c["text"])) for c in chunks]

    @staticmethod
    def _tri(text):
        s = " " + re.sub(r"[^a-z0-9]+", " ", text.lower()) + " "
        return [s[i:i + 3] for i in range(len(s) - 2)]

    def bm25(self, q, k1=1.5, b=0.75):
        qt = terms(q)
        out = []
        for i, tf in enumerate(self.tf):
            s = 0.0
            for w in qt:
                if w in tf:
                    f = tf[w]
                    s += self.idf[w] * f * (k1 + 1) / (f + k1 * (1 - b + b * self.len[i] / self.avg))
            out.append(s)
        return out

    def tfidf(self, q):
        qv = Counter(terms(q))
        qn = math.sqrt(sum((c * self.idf.get(w, 0)) ** 2 for w, c in qv.items())) or 1
        out = []
        for tf in self.tf:
            dn = math.sqrt(sum((c * self.idf[w]) ** 2 for w, c in tf.items())) or 1
            dot = sum(c * self.idf.get(w, 0) * tf.get(w, 0) * self.idf.get(w, 0) for w, c in qv.items())
            out.append(dot / (qn * dn))
        return out

    def trigram(self, q):
        qv = Counter(self._tri(q))
        qn = math.sqrt(sum(c * c for c in qv.values())) or 1
        out = []
        for tv in self.tri:
            dn = math.sqrt(sum(c * c for c in tv.values())) or 1
            out.append(sum(c * tv.get(g, 0) for g, c in qv.items()) / (qn * dn))
        return out


def rank(scores, allowed=None):
    idx = [i for i in range(len(scores)) if scores[i] > 0 and (allowed is None or allowed(i))]
    return sorted(idx, key=lambda i: -scores[i])


def rrf(rankings, k=60):
    """Reciprocal Rank Fusion: score(d) = sum over lists of 1 / (k + rank). Rank starts at 1."""
    fused = Counter()
    for lst in rankings:
        for r, i in enumerate(lst, start=1):
            fused[i] += 1.0 / (k + r)
    return [i for i, _ in fused.most_common()]


def search(index, q, mode="hybrid", top=3, allowed=None):
    if mode == "bm25":
        order = rank(index.bm25(q), allowed)
    elif mode == "tfidf":
        order = rank(index.tfidf(q), allowed)
    elif mode == "trigram":
        order = rank(index.trigram(q), allowed)
    else:
        order = rrf([rank(index.bm25(q), allowed), rank(index.tfidf(q), allowed), rank(index.trigram(q), allowed)])
    return order[:top]
