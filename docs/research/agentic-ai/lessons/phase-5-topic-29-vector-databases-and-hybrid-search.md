# Vector databases & hybrid search

**Course:** Agentic AI, from first principles to production · Module 5 RAG and Data · lesson 29 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Choose a vector store for a stated scale and budget and state what you would test before committing.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Microsoft Learn 'Hybrid search overview - Azure AI Search' (page dated 2026-08-31: full-text and vector queries run in parallel and merged with Reciprocal Rank Fusion; keyword search for product codes, jargon, dates and names) and 'Hybrid search scoring (RRF)' (page dated 2026-06-08: score = 1 / (rank + k), k = 60 as an example; semantic ranking runs after merging; at most about 1/k per query); Databricks documentation 'AI Search' (page updated 2026-09-14: Delta Sync with managed or self-managed embeddings, direct vector access, hybrid search with RRF, HNSW and BM25, Unity Catalog governance, endpoint limits) and the 'Create and query an index' page (updated 2026-09-14: change data feed requirement, continuous and triggered sync, endpoint ACLs); Anthropic 'Introducing Contextual Retrieval' (BM25 plus embeddings, reranking). Read 2026-10-02 through page summaries. Our retrievers (BM25, TF-IDF cosine, character-trigram cosine) are standard-library code from this lesson's folder. The reference code on this page was written by us and run on Python 3.14.7 (standard library only for the retrieval code; pytest for the 8 tests, which passed). It uses a small fictional document set (18 documents, about 1,100 tokens by a 4-characters-per-token estimate). It has not been run with a real embedding model or a real LLM. Unverified: platform limits (vectors per endpoint, latency, dimensions) change and are not listed as facts here; Databricks' naming (Mosaic AI Vector Search, now shown as AI Search) was changing in the pages we read, so check the product name before you quote it.

---

## Part 1 · What a vector store does, and what it is not

A **vector store** (or vector database) keeps embeddings (lesson 4) next to the chunk text and metadata, and answers one question fast: *which stored vectors are nearest to this query vector?* Two ideas sit inside that:

- **Nearest neighbour search.** Exact search compares the query with every vector, which is slow at scale. **Approximate** methods such as HNSW (a layered graph that jumps toward closer vectors) trade a little recall for speed. Azure AI Search and Databricks both use HNSW for the vector side.
- **Metadata filters.** You almost never want 'nearest in the whole store'. You want 'nearest among documents this user may see, from this year, in this language'. A good store supports filters and, ideally, applies them as part of the search.

What it is not: it is not a place that understands meaning on its own. The meaning comes from the embedding model that produced the vectors; the store only finds close ones. A poor embedding model in a fast store gives fast wrong answers. It is also not the only choice. Many teams already run a search engine, a relational database with a vector extension, or a lakehouse feature, and for modest data these can be enough. The real decision is often about **operations**: how data gets in and stays fresh, who controls access, what it costs at your scale, and what you must be able to audit.

**Worked example**

Fictional. 40,000 chunks from HR documents, with one language and a few access groups. A managed search service or an extension on the database you already run would do. Choosing a specialised vector database for this size is a reason to ask what problem it solves that the existing platform does not.

**Common mistake**

Starting from 'which vector database' before knowing the scale, the freshness need and the access rules. The product is the last decision, not the first.

**Check yourself.** What are the two jobs of a vector store, and which part of the system provides the 'meaning'?

<details><summary>Model answer (write yours first)</summary>

Find nearest vectors quickly, and apply metadata filters. The meaning comes from the embedding model, not from the store.

</details>

---

## Part 2 · Why hybrid search: two kinds of match

Vector search matches **meaning**: 'time off' finds 'annual leave' even with no shared word. Keyword search (BM25, a standard word-frequency scoring method) matches **exact terms**: an error code, a product name, a date, a person's name. Each fails where the other works. Microsoft's hybrid search page says the exact-match cases (product codes, specialised jargon, dates, names) are where keyword search does better, and Anthropic's contextual retrieval post makes the same argument with error codes. **Hybrid search** runs both and merges the lists.

Merging uses **Reciprocal Rank Fusion (RRF)**, which ignores the raw scores (they are on different scales) and uses only the ranks. For each list, a document at rank r gets 1 / (r + k); the scores are added across lists, where k is a constant (the Microsoft page's example value is 60). Here is the arithmetic for three documents in two lists, computed in code:

| Document | Rank in keyword list | Rank in vector list | RRF score |
|---|---|---|---|
| A | 1 | 3 | 1/61 + 1/63 = 0.03227 |
| B | 2 | 1 | 1/62 + 1/61 = 0.03252 |
| C | 3 | not found | 1/63 = 0.01587 |

B wins although A was first in one list, because B is high in both. C, found by only one method, ranks last. The Microsoft page adds that with k = 60 each list contributes at most about 1/60 to a document, so a document found by more lists can reach a higher maximum. A **semantic ranker** (a reranking model) can then reorder the merged top results; in Azure AI Search it runs after RRF and reports its own score from 0 to 4.

Our reference code has all three pieces: `bm25`, a TF-IDF cosine retriever, a character-trigram retriever, and `rrf`:

```python
def rrf(rankings, k=60):
    """Reciprocal Rank Fusion: score(d) = sum over lists of 1 / (k + rank). Rank starts at 1."""
    fused = Counter()
    for lst in rankings:
        for r, i in enumerate(lst, start=1):
            fused[i] += 1.0 / (k + r)
    return [i for i, _ in fused.most_common()]
```

**Worked example**

Fictional. A user pastes ERR-4417. A vector search over meaning may return generic 'pipeline error' text; keyword search returns the chunk that contains the exact code. Hybrid puts that chunk first.

**Common mistake**

Averaging a keyword score and a vector score directly. They are on different scales, so one drowns the other. Fusing by rank avoids the problem.

**Check yourself.** Compute the RRF score (k = 60) of a document ranked 2nd in one list and 5th in another.

<details><summary>Model answer (write yours first)</summary>

1/(60+2) + 1/(60+5) = 0.016129 + 0.015385 = 0.031514.

</details>

---

## Part 3 · What our experiment shows, and what it cannot

We ran the four retrievers on the 22 answerable questions with heading chunks (24 chunks). The first number is how often the right document was the top hit; the second is how often it was in the top 3.

| Retriever | Right document first | In the top 3 |
|---|---|---|
| BM25 (keyword) | 18 of 22 | 22 of 22 |
| TF-IDF cosine (sparse vector) | 18 of 22 | 22 of 22 |
| Character trigrams | 17 of 22 | 22 of 22 |
| Hybrid (RRF of the three) | 19 of 22 | 22 of 22 |

Hybrid is one question better than the best single method: the sort of difference that **cannot be told apart from luck** on 22 questions. The honest reading is: all four find the right document in the top 3 every time on this tiny set (a ceiling effect: the set is too easy to separate them), and hybrid is at least not worse.

More important is what none of them fixes. The question 'Who signs off on structure changes to live tables?' fails for every retriever, because the document says 'approval from the data owner' about 'schema changes to a production table'. No word is shared, and our retrievers only compare words. A real **embedding model** is what would close that gap, and this is exactly the situation hybrid search is designed for: keyword for exact terms, vectors for paraphrase. The lab asks you to add one and rerun the comparison.

Note the limit: we call TF-IDF cosine a 'vector' search because it compares vectors, but they are sparse word-count vectors, not learned meaning. Do not read these results as evidence about dense embeddings.

**Worked example**

```text
retriever   right doc first   in top 3
bm25              18/22        22/22
tfidf             18/22        22/22
trigram           17/22        22/22
hybrid            19/22        22/22
failing for all: 'Who signs off on structure changes to live tables?' (no shared words)
```

**Common mistake**

Concluding 'hybrid wins' from a one-question difference on a small set. Ask for more questions, or at least say it is indistinguishable.

**Check yourself.** Why can't you conclude from 19 of 22 against 18 of 22 that hybrid is better?

<details><summary>Model answer (write yours first)</summary>

It is one question. With 22 questions the intervals overlap almost completely (about 67 to 95 percent against 61 to 93 percent), so luck explains it equally well. You need a larger set or a paired comparison.

</details>

---

## Part 4 · Choosing a store: scale, budget and what to test before you commit

The lesson's criterion asks you to choose a store for a stated scale and budget and name what you would test. Here is the checklist, with how two platforms we read answer parts of it.

| Question | Why it matters | Azure AI Search | Databricks AI Search |
|---|---|---|---|
| Hybrid and reranking? | Quality on codes and paraphrase | Hybrid with RRF, optional semantic ranker | Hybrid with RRF (HNSW plus BM25) |
| How does data get in and stay fresh? | Stale answers are a quality failure | Indexers and skillsets, or a push API; incremental indexing | Delta Sync from a Delta table, continuous (seconds of latency) or triggered; the table needs change data feed (or row tracking) |
| Who embeds? | Cost and control | Integrated vectorisation or your own vectors | Managed (Databricks calls a model) or self-managed embeddings |
| Access control? | Security trimming | Document-level security trimming through permission metadata or query filters | Unity Catalog governs the index; endpoint ACLs; the page says row-level and column-level permissions are not supported |
| Scale and limits? | Cost and design | Check current service limits | Page lists about 320 million vectors (768 dimensions) on standard endpoints and a 4,096 maximum embedding dimension; check current numbers |

Those limits are quoted from the pages we read on 2026-10-02 and **will move**. Before committing, test on your own data and questions:

1. **Quality:** run your labelled question set against two candidates (and your current search if you have one); compare hit rate in the top 3 and 5 with counts and a note on sample size.
2. **Freshness:** change a document and measure how long until a question about it returns the new text.
3. **Access:** the same question as two users; the restricted text must not appear for the wrong one.
4. **Latency and load:** time p50 and p95 under realistic concurrency, not one query.
5. **Cost:** embedding, storage, query and idle capacity for your scale for a month, from the vendor's current price page.
6. **Exit:** how would you move your vectors and metadata elsewhere? Embeddings are tied to the model that made them, so changing the embedding model means re-embedding everything.

**Worked example**

Fictional scale: 2 million chunks, 5 access groups, nightly updates, a budget that excludes a dedicated search team, and a data platform that already runs on Databricks. Candidate one: Databricks Delta Sync index over the existing governed table (fits the freshness and governance need; check the row-level limit against the five groups). Candidate two: Azure AI Search (strong hybrid and security trimming; needs a pipeline from the lake). Test both on 100 real questions, with the access and freshness tests, before choosing.

**Common mistake**

Choosing from a vendor comparison table and skipping your own test. The vendor's table cannot know your documents, your questions or your access rules.

**Check yourself.** Name three things you would test before committing to a vector store for 2 million chunks with 5 access groups.

<details><summary>Model answer (write yours first)</summary>

Retrieval quality on your own labelled questions (top 3 and 5 hit rate), access control (same question as two users), and freshness (time from a document change to the new answer). Also latency under load, monthly cost and exit cost.

</details>

---

## Do it: lab

1. Run `python evaluate.py` in the rag folder and record the table. Run `python -m pytest -q` and confirm all 8 tests pass.
2. Add a real embedding model to the retriever. Either `pip install sentence-transformers` and use a small model, or call an embeddings API from your provider; add a `dense` method beside `trigram` and include it in the hybrid fusion.
3. Rerun the comparison. Check the question 'Who signs off on structure changes to live tables?'. Did the dense retriever fix it? Did it break any question that BM25 got right?
4. Pick a stated scale and budget (write them down) and fill in the six-row checklist above for two candidate stores using each vendor's current documentation page. Record the date you read each page.
5. Write the test plan: the quality, freshness, access, latency, cost and exit tests, each with the number you would need to see to proceed.

**Done when:** you have a before-and-after table with a dense retriever included, a statement of which questions changed, a scale and budget with a filled checklist for two stores, and a dated test plan with pass numbers.

---

## Interview check

**Question.** Why use hybrid search instead of only vector search?

<details><summary>A strong answer has this shape</summary>

1. Vector search matches meaning and handles paraphrase; keyword search matches exact terms such as error codes, product names, dates and people. Each misses what the other finds.
2. Hybrid runs both and merges by rank (Reciprocal Rank Fusion), because the raw scores are on different scales.
3. A reranker can reorder the merged top results for quality at some cost in latency.
4. I would confirm it on our own questions: hit rate in the top 3 for vector only, keyword only and hybrid, reported with the sample size.
5. The cost is a second index and more tuning; the benefit is robustness on the exact-match questions users actually ask.

</details>

---

## Evidence to keep

Keep the before-and-after table, the checklist with source dates, and the test plan. The store decision is part of the architecture note you attach to the lesson 30 build.

---
