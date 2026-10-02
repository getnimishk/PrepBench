# Chunking strategies

**Course:** Agentic AI, from first principles to production · Module 5 RAG and Data · lesson 28 of 77 · **about 2 hours** · paper draft for review.  
**Success criterion:** Choose and justify a chunking strategy for two document types, and show one query that fails under a poor choice.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Microsoft Learn 'Chunk documents - Azure AI Search' (page dated 2026-06-08, updated 2026-08-31: fixed-size, variable-size, semantic and custom chunking; the recommended starting point of 512 tokens with 25 percent overlap; the Text Split skill default of 2,000 characters with 500 overlap; the chunk counts for a 200-page e-book); Anthropic, 'Introducing Contextual Retrieval' (2024-09-19: chunks lose context, and adding 50 to 100 tokens of context to each chunk). Read 2026-10-02 through page summaries. The sweep over chunk sizes and the heading-chunk results come from running the code on this page (22 questions on 18 short fictional documents). The reference code on this page was written by us and run on Python 3.14.7 (standard library only for the retrieval code; pytest for the 8 tests, which passed). It uses a small fictional document set (18 documents, about 1,100 tokens by a 4-characters-per-token estimate). It has not been run with a real embedding model or a real LLM. Unverified: Microsoft's recommendations are a starting point from one vendor's tooling, and our documents are short (average about 41 words), so our sweep shows the shape of the effect, not the best size for your documents.

---

## Part 1 · Why chunk at all, and what goes wrong

A chunk is the unit you embed, store, retrieve and quote. Chunking exists because models and embedding models take limited input (Microsoft's page gives 8,191 tokens for one embedding model as an example) and because a whole document as one vector represents its many topics poorly. The cost of cutting is that every cut can separate a fact from what makes it meaningful. Two classic failures:

- **Too small:** the chunk has the number but not the subject. 'Revenue grew by 3 percent' with no company or year (Anthropic's own example). Retrieval finds it for the wrong questions, and when it is found the answer cannot be written from it.
- **Too large:** the chunk holds several topics, so its vector is an average of them, the prompt fills with irrelevant text, and relevant sentences sit in the middle of a long input.

There is also a mechanical failure: **a chunk with nothing in it**. Our first heading-based chunker produced a chunk containing only a document title (a title with no paragraph under it). It matched title words in queries, ranked well, and answered nothing. Removing title-only chunks raised the count of right answers from 14 to 15 of 22 in our run. One question is a small effect, but it shows the kind of bug you will find only by reading your chunks, which is why the lab starts there.

**Worked example**

Fictional. A 30-page runbook is cut every 500 characters. The line 'Do not drop the column silently.' ends up in its own chunk with no mention of schema drift. A user asks what to do about a new column; the best match is the chunk about new columns, which lacks the warning.

**Common mistake**

Choosing a chunk size once, from an article, and never looking at the chunks. Print twenty of them and read them as if you were the model.

**Check yourself.** Name one thing that goes wrong with chunks that are too small and one with chunks that are too large.

<details><summary>Model answer (write yours first)</summary>

Too small: a fact loses its subject and context, so it matches wrongly or cannot support an answer. Too large: the vector blurs several topics, the prompt fills with irrelevant text, and the useful sentence is easy to miss.

</details>

---

## Part 2 · Fixed, structural, semantic and context-added chunking

Microsoft's chunking page lists the common techniques; they combine freely.

| Technique | How it cuts | Strength | Weakness |
|---|---|---|---|
| **Fixed-size** | Every N tokens or characters, with overlap | Simple, predictable, works on any text | Cuts mid-sentence or mid-table; ignores structure |
| **Recursive** (a common library form of fixed-size) | Try paragraph breaks first, then sentences, then words, until the piece fits | Mostly respects natural breaks | Still blind to meaning |
| **Structure-aware** (headings, sections, rows) | Along the document's own markers | Chunks match how authors organised ideas | Needs clean structure; sections can be too big or too small |
| **Semantic** | At points where the topic shifts, found by comparing neighbouring sentences | Chunks hold one idea | Slower, needs an embedding model at ingestion, quality varies |
| **Context-added** | Any of the above, then add a short description of where the chunk sits in the document before embedding | Fixes 'a fact with no subject' | Extra cost: one model call per chunk |

Two practical numbers from Microsoft's page. For fixed-size chunking, start with **512 tokens and 25 percent overlap (128 tokens)** and tune; for its built-in Text Split skill the suggested default is **2,000 characters with 500 overlap**. Overlap is not free. On the page's example e-book, a 1,000-character page length gave 172 chunks with no overlap and 216 with 200 characters of overlap: 26 percent more chunks to embed and store. At 2,000 characters, 85 became 113 (33 percent more). At 5,000 characters the extra was 12 percent. Splitting by single sentences produced 13,361 chunks, which shows how fast chunk counts explode when chunks are tiny.

Anthropic's **contextual retrieval** adds 50 to 100 tokens of generated context to each chunk before embedding and keyword indexing, and reports a lower retrieval failure rate (5.7 to 3.7 percent with contextual embeddings, 2.9 percent with contextual keyword scoring added, 1.9 percent with a reranker as well), at a stated one-off cost of about $1.02 per million document tokens using prompt caching. Those figures are Anthropic's, on their data, with their prices at the time; we did not reproduce them. Our own chunker does a hand-made, free version of the idea: it puts the document title and section heading in front of each chunk ('Runbook: common pipeline errors > ERR-4417 schema drift. ...').

**Worked example**

```python
"""Two chunkers. Both return dicts that keep the source document id and title, so every chunk can be cited."""
import re


def fixed_chunks(doc, size=40, overlap=10):
    """Split by words, ignoring structure. `size` and `overlap` are in words (a stand-in for tokens)."""
    words = doc["text"].split()
    step = size - overlap
    out = []
    for start in range(0, max(len(words) - overlap, 1), step):
        piece = words[start:start + size]
        out.append({"doc": doc["id"], "title": doc["title"], "text": " ".join(piece), "acl": doc["acl"], "updated": doc["updated"]})
    return out


def heading_chunks(doc):
    """Split at Markdown headings and prepend the document title and heading to each chunk (context in the chunk)."""
    parts = re.split(r"\n(?=## )", doc["text"])
    out = []
    for part in parts:
        lines = part.strip().splitlines()
        if len(lines) < 2:
            continue  # a title with nothing under it: no content to retrieve (it still matches queries, so it must go)
        heading = lines[0].lstrip("# ").strip()
        body = " ".join(l for l in lines[1:] if l.strip()) or heading
        text = f"{doc['title']} > {heading}. {body}" if heading != doc["title"] else f"{doc['title']}. {body}"
        out.append({"doc": doc["id"], "title": doc["title"], "text": text, "body": body, "acl": doc["acl"], "updated": doc["updated"]})
    return out


def chunk_all(docs, chunker, **kw):
    return [dict(c, id=f"{d['id']}#{i}") for d in docs for i, c in enumerate(chunker(d, **kw))]
```

**Common mistake**

Adding overlap 'to be safe' without counting the cost. Overlap raises the number of chunks, the embedding bill, the index size and the number of near-duplicate chunks competing for the top slots.

**Check yourself.** A 1,000-character fixed chunker with 200 characters of overlap gives 216 chunks where no overlap gives 172. How much extra is that?

<details><summary>Model answer (write yours first)</summary>

216 / 172 = 1.256, so about 26 percent more chunks (the number is from Microsoft's example e-book and depends on the document).

</details>

---

## Part 3 · Our experiment: chunk size against right answers

We ran the same 22 answerable questions through the same hybrid retrieval and the same answer step, changing only the chunker. Overlap was 20 percent of the chunk size. Counts are of 22.

| Chunker | Chunks | Right document cited | Right fact in the answer |
|---|---|---|---|
| Fixed, 8 words | 110 | 16 | 4 |
| Fixed, 15 words | 65 | 19 | 8 |
| Fixed, 25 words | 43 | 19 | 13 |
| Fixed, 40 words | 25 | 19 | 13 |
| Fixed, 80 words | 18 | 18 | 15 |
| Fixed, 150 words | 18 | 18 | 15 |
| By heading, with title context | 24 | 19 | 15 |

Read it carefully, because it is easy to over-read:

- **Tiny chunks are clearly bad here.** At 8 words a chunk almost never contains a whole fact, so only 4 answers contained the right fact, even though the right document was cited 16 times.
- **Beyond about 80 words nothing changes**, because our documents average 41 words; a chunk of 80 or 150 words is simply the whole document (18 chunks for 18 documents). The documents are too short to test large chunks.
- **Heading chunks tie with whole documents** at 15 and keep 24 chunks, which matters once documents are long.
- **22 questions cannot separate close results.** The difference between 13 and 15 right is two questions. The Wilson 95 percent interval for 15 of 22 is about 47 to 84 percent. Treat the big gaps (4 against 15) as real and the small ones (13 against 15) as unproven.

The seven questions that fail even with the best chunkers show what chunking cannot fix. Three are retrieval failures: one is a paraphrase with no shared words (our stand-in has no real embedding), one is a superseded document outranking the current one, and one is a nearby document about the same topic. The other four retrieved the right document and the crude sentence picker chose the wrong sentence.

**Worked example**

```text
chunker              chunks  right document  right fact (of 22)
fixed   8 words        110         16               4
fixed  25 words         43         19              13
fixed  80 words         18         18              15
by heading              24         19              15
```

**Common mistake**

Reading a table of 22 questions as proof that one setting beats another by two questions. Report the counts with their uncertainty and ask for a larger set before committing.

**Check yourself.** In the sweep, chunks of 80 and 150 words give identical results. Why, and what does it tell you about the experiment?

<details><summary>Model answer (write yours first)</summary>

Our documents average about 41 words, so both sizes make one chunk per document. It tells you the experiment cannot test large chunk sizes; you need longer documents.

</details>

---

## Part 4 · Choosing a strategy for your documents

Pick the strategy from the document's shape, then confirm with a test, never the other way round.

| Document type | Start with | Why | Watch for |
|---|---|---|---|
| Policies and runbooks with headings | Structure-aware by heading, title and heading added to each chunk | Each section is one idea and the heading carries the subject | Title-only chunks, sections that are far too long |
| Long narrative text (reports, books) | Fixed-size 400 to 600 tokens with 10 to 25 percent overlap | No reliable structure to use | Facts split across a cut |
| FAQs and support articles | One question and answer per chunk | The unit users ask about | Duplicate near-identical entries |
| Tables and spreadsheets | A row, or a row with its column headers, per chunk | A row is the fact | A number without its column name |
| Code and notebooks | By function or cell | Matches how people look for it | Comments separated from the code they explain |
| Mixed PDFs with scans | Fix extraction first (OCR, layout), then chunk | Bad text in, bad chunks out (F1) | Garbled tables, headers repeated on every page |

Store with every chunk: the document id, title, section, date or version, and who may see it. Those fields are what let you cite, prefer the newest version and filter by access later. When a table or a figure matters, test it separately: tables are where fixed-size cutting does the most damage.

**Worked example**

Fictional. A bank's product terms (clauses with numbers like 4.2.1). Chunk by clause and prepend the product name and clause number. A fixed-size cut would separate a limit from the clause that defines when it applies.

**Common mistake**

One strategy for the whole corpus. The runbooks, the FAQs and the spreadsheets in one index may each need a different chunker, applied by document type.

**Check yourself.** Choose a strategy for (a) a spreadsheet of fee schedules and (b) a 200-page narrative report, and give one risk of each.

<details><summary>Model answer (write yours first)</summary>

(a) One row per chunk with its column headers; risk: a number without its column name. (b) Fixed-size 400 to 600 tokens with 10 to 25 percent overlap, or by chapter then fixed; risk: a fact split across a cut.

</details>

---

## Do it: lab

1. Take 5 to 10 documents of two different types from your own work (for example a policy and a spreadsheet, or two runbooks). Remove anything confidential or use your own notes.
2. Chunk them two ways: fixed-size, and by structure (headings, rows or paragraphs). Print 15 chunks from each and read them. Write down every chunk that loses its subject or is nearly empty.
3. Write 10 questions with the exact fact each answer must contain. Include at least 2 whose answer sits across a heading or a page break.
4. Run retrieval over both chunkings and count: the right document in the top 3, and the right fact present in the retrieved text.
5. Choose a strategy for each document type and justify it in two sentences each. Show one query that fails under the poor choice, with the chunk that caused it.

**Done when:** you have a chosen strategy for each of two document types, a count for each chunking on your 10 questions, and one real failing query with the chunk that caused the failure.

---

## Interview check

**Question.** How would you decide chunk size for a new document set?

<details><summary>A strong answer has this shape</summary>

1. Look at the documents: structure, length, tables. Use their structure if it is reliable.
2. Start from a documented default (for example 512 tokens with 25 percent overlap for plain text), then print and read a sample of chunks for lost subjects, split facts and near-empty pieces.
3. Build a labelled set of questions with the exact fact each answer needs, including awkward ones.
4. Compare two or three settings on retrieval hit rate and on whether the right fact is in the retrieved text; report counts, and admit when the set is too small to separate them.
5. Count the cost of overlap (chunks, embedding spend, index size) and put the title and section in each chunk. Re-test whenever the document mix changes.

</details>

---

## Evidence to keep

Keep the two chunkings, the 15-chunk reading notes, the question set, the counts and the failing query. They go into the RAG build in lesson 30.

---
