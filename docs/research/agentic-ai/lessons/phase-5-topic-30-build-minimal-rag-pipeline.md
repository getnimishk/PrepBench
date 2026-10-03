# Build: a minimal RAG pipeline

**Course:** Agentic AI, from first principles to production · Module 5 RAG and Data · lesson 30 of 77 · **about 8 hours** · paper draft for review.  
**Success criterion:** Ask 8 questions and get grounded, cited answers, including 2 questions the app correctly answers with 'not in the documents'. Finish with a one-page 4D review: what you delegated, how you described it, how you checked the result, and what you recorded and disclosed.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Builds on lessons 4, 27, 28 and 29 (sources there). Anthropic documentation 'How tool use works' and the Messages API, as used in lesson 12, for the model call; Claude Academy AI Fluency lesson 12 and the AI-native SDLC Playbook for the 4D review (Delegation, Description, Discernment, Diligence), read 2026-09-30 and 2026-10-02 through page summaries. The reference code on this page was written by us and run on Python 3.14.7 (standard library only for the retrieval code; pytest for the 8 tests, which passed). It uses a small fictional document set (18 documents, about 1,100 tokens by a 4-characters-per-token estimate). It has not been run with a real embedding model or a real LLM. The model call in step 4 is written from the vendor documentation and has not been run here (no key). The prompt wording is ours and untested on a real model. Unverified: how well any specific model follows the 'answer only from the sources' instruction; that is what your 8 questions measure.

---

## Part 1 · What you are building, and the plan for 8 hours

You will build a RAG application over a small set of documents **you own** (your own notes, a public manual, or fictional documents you write), then prove it with 8 questions: 6 it answers with a citation and 2 it correctly refuses with 'not in the documents'. The reference code in the rag folder is a working skeleton with no AI model in it; your job is to replace its weak parts and measure the difference.

| Hours | Step | Output |
|---|---|---|
| 1 | Choose and prepare 8 to 15 documents (2,000 to 20,000 words in total). Write down who may see which | A folder of text or Markdown files with an access label each |
| 1.5 | Ingest and chunk (lesson 28). Print 15 chunks and read them | `chunks.jsonl` with doc id, title, section, date, access, text |
| 1.5 | Retrieve: BM25 plus a real embedding model, fused with RRF (lesson 29), with the access filter applied first | A `search(question, user)` function |
| 1.5 | Answer: call a real model with the retrieved chunks and the grounded-answer prompt below | An `answer(question, user)` function returning text plus citations |
| 1 | Test: 8 questions with the exact fact each answer needs, 2 of them unanswerable | A results table: retrieved, answered, cited correctly |
| 1.5 | Review: fix the worst failure, retest, write the one-page 4D review | The review page and the final table |

Do the steps in this order. The common failure of builds like this is spending seven hours on the pipeline and ten minutes on the test.

**Worked example**

Fictional scope that works: eight Markdown runbooks about one system, written by you, 6,000 words in total, with two of them marked 'platform team only'. The 8 questions: 4 direct, 2 paraphrased, 2 unanswerable. Add a ninth that only the platform team may ask.

**Common mistake**

Choosing a document set so large or so messy that cleaning it eats the whole budget. Keep the corpus small and your own; the skill you are building is the pipeline and the test, not the data cleaning.

**Check yourself.** Why is the test written before you tune the pipeline, and what are its two unanswerable questions for?

<details><summary>Model answer (write yours first)</summary>

So tuning is judged against fixed questions and you cannot unconsciously fit the questions to the answers. The unanswerable ones test abstention: the system must say 'not in the documents' instead of guessing.

</details>

---

## Part 2 · Steps 1 to 3: ingest, chunk, retrieve

Start from the reference code and make three changes, each tested before the next.

1. **Ingest your files.** Replace `corpus.py` with a loader that reads your folder and fills the same fields: `id`, `title`, `updated`, `acl`, `text`. Keep the access label; it is what makes the filter possible.
2. **Chunk by structure** (headings for Markdown) and prepend the title and section to each chunk, as `heading_chunks` does. Drop chunks that contain only a heading. Print 15 chunks and read them as the model would.
3. **Add a dense retriever** to `retrieve.py` and keep BM25 beside it (lesson 29's lab). The skeleton's `search` already fuses lists with `rrf` and accepts `allowed=`, the function that hides chunks the caller may not see.

The part of the skeleton to keep intact:

```python
def rank(scores, allowed=None):
    idx = [i for i in range(len(scores)) if scores[i] > 0 and (allowed is None or allowed(i))]
    return sorted(idx, key=lambda i: -scores[i])


def search(index, q, mode="hybrid", top=3, allowed=None):
    ...   # the 'hybrid' branch fuses the ranked lists with rrf([...]) and returns order[:top]
```

Note that `allowed` is applied inside `rank`, before anything is ordered or cut to the top few. Keep it that way when you add the dense retriever.

**Worked example**

Fictional check after step 3: ask 'who may restart the nightly job' as an ordinary user and as a platform-team user. The restricted runbook must appear only for the second.

**Common mistake**

Applying the access filter after ranking. The forbidden chunk can then take a top slot and vanish, leaving the user an empty or worse answer.

**Check yourself.** Where in the code is the access filter applied, and why there?

<details><summary>Model answer (write yours first)</summary>

Inside the ranking step, before ordering and cutting to the top few, so forbidden chunks can never occupy a slot or reach the prompt.

</details>

---

## Part 3 · Step 4: the grounded answer, with a real model

Replace the extractive stand-in with a model call. Keep the structure: retrieve, check the relevance floor, then generate. If the floor fails, return `Not in the documents.` **without calling the model**: it is cheaper, and the model cannot invent an answer it was never asked for.

A prompt to start from (ours, untested; adapt it and measure):

```text
You answer questions using ONLY the sources below. Each source has an id in square brackets.
Rules:
1. Use only facts that appear in the sources. Do not use outside knowledge.
2. After each claim, cite the source id in square brackets, for example [leave-policy#1].
3. If the sources do not contain the answer, reply exactly: Not in the documents.
4. If two sources disagree, say so and cite both; prefer the one with the later date.
5. Be brief: one to three sentences.

Sources:
[leave-policy#1] (updated 2026-03-01) Full-time employees receive 24 days of paid annual leave ...
[...]

Question: How many days of paid annual leave do full-time staff get?
```

The call itself is the one from lesson 12: `client.messages.create(model=..., max_tokens=300, system=<the rules>, messages=[{"role": "user", "content": <sources and question>}])`. Put the rules in the system prompt and the sources in the user message, and separate them clearly: retrieved text can contain instructions (lesson 23 and Module 9), and you do not want the model to follow them. Treat everything under 'Sources' as data.

After the call, add three cheap checks in code: the answer contains at least one citation id; every cited id was in the prompt (a model can cite a source it was never given); every number in the answer appears in a cited source (`unsupported_numbers` in `answer.py`). A failed check returns `Not in the documents.` or goes to a person.

**Worked example**

Fictional failure to watch for: the model answers 'The review takes about two weeks [vendor#0]' when the source says 10 working days. The number check compares digits, so 'two' passes it. Decide whether that gap matters for your documents, and write the question that would catch it.

**Common mistake**

Letting the model answer first and checking the citation later in the UI. A citation that was never in the prompt looks identical to a real one unless your code checks it.

**Check yourself.** Name two checks to run in code on a generated answer before showing it.

<details><summary>Model answer (write yours first)</summary>

That it cites at least one source, that every cited source id was actually in the prompt, and that numbers in the answer appear in the cited text.

</details>

---

## Part 4 · Steps 5 and 6: the 8-question test and the 4D review

Write the 8 questions **before** you look at what the system says. For each, record the exact fact the answer must contain (or, for unanswerable ones, that it must refuse). Then run and fill this table:

| # | Question | Kind | Right document cited? | Right fact in answer? | Cited ids all in prompt? | Notes |
|---|---|---|---|---|---|---|

Finish with a one-page **4D review**, the evidence page every build in this course ends with:

- **Delegation:** what you gave the model (writing answers from retrieved text) and what you kept (what counts as a source, who may see what, what to do when unsure).
- **Description:** how you described the job to the model: the prompt, the sources format, the rules. Include the final prompt text.
- **Discernment:** how you checked the output: the 8-question table, the three code checks, what you found wrong and what you changed.
- **Diligence:** what you recorded and disclosed: where the documents came from, who may see the answers, which parts you could not verify, and what a user should be told (for example that answers are drawn from these documents and can be wrong).

Our reference run, for the shape of the table (22 answerable and 3 unanswerable questions, the extractive stand-in as the 'model'): `python demo.py` prints each question with OK, RETRIEVAL or ANSWER, then the three totals: right document 19 of 22, right fact 15 of 22, abstentions 3 of 3. The demo script:

```python
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
```

**Worked example**

Fictional row: 'How fast must the primary on-call respond?' | answerable | yes | yes | yes | primary responds within 15 minutes. And an unanswerable row: 'Do we have a policy on working from another country?' | unanswerable | refused correctly.

**Common mistake**

Writing the 4D review as a description of the code. It is a statement of judgement: what you trusted the model with, how you checked, and what you will tell people.

**Check yourself.** Which of the four Ds does the 8-question table belong to, and which one covers 'we tell users answers may be wrong'?

<details><summary>Model answer (write yours first)</summary>

The table is Discernment (checking the output). Telling users the limits is Diligence (recording and disclosing).

</details>

---

## Do it: lab

1. Choose and prepare your documents (8 to 15, your own or fictional) and record who may see each. Keep a copy of the originals unchanged.
2. Ingest, chunk by structure with title and section in each chunk, drop empty chunks, print and read 15 chunks. Save what you found.
3. Implement `search(question, user)` with BM25 plus a dense retriever fused by RRF, with the access filter applied before ranking. Prove the access filter with a two-user test.
4. Implement `answer(question, user)` with the relevance floor, the grounded prompt and a real model call, and the three code checks (a citation is present, every cited id was in the prompt, numbers appear in the source).
5. Write 8 questions with the exact facts (2 unanswerable) before running. Run them and fill the results table.
6. Fix the single worst failure, rerun all 8, and write the one-page 4D review with the final prompt in it.

**Done when:** the app answers 8 questions, 6 with a correct citation and 2 with a correct 'not in the documents', the access test passes for two users, the three code checks are in place, and the 4D review page exists.

---

## Interview check

**Question.** Walk me through a RAG system you built and how you know it works.

<details><summary>A strong answer has this shape</summary>

1. The problem and scope: which documents, who uses it, what it must never do (show restricted text, answer without a source).
2. The pipeline: structure-aware chunks with title context, hybrid retrieval with an access filter before ranking, a relevance floor, a grounded prompt with citations, and code checks on the output.
3. The proof: a fixed question set written first, with answerable and unanswerable questions, and results reported by stage (retrieval, answer, abstention) with the sample size.
4. What failed and what I changed because of it, with a before-and-after number.
5. What I would not claim: it is a small corpus and a small test, so the numbers show it works on this set, not that it will on all questions; and what I would add for production (monitoring, a larger set, refresh and ownership).

</details>

---

## Evidence to keep

Keep the code, the 15-chunk notes, the access test output, the final prompt, the results table and the 4D review page. It is the starting point for the roadmap's first portfolio project, Governed Enterprise RAG (priority 1 on the Portfolio Projects tab; check that tab for exactly which syllabus rows it counts).

---
