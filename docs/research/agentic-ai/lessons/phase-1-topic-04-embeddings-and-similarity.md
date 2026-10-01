# Embeddings and similarity

**Course:** Agentic AI, from first principles to production · Module 1 Foundations · lesson 4 of 8 · **about 3 hours** · paper draft for review.  
**Success criterion:** Run an embedding call on 5 sentences, compute cosine similarity between them, and explain why two differently worded sentences scored high and one unrelated sentence scored low.

> Sources (read 2026-09-29 and 2026-09-30; details and gaps in docs/research/agentic-ai): OpenAI docs 'Vector embeddings' (developers.openai.com/api/docs/guides/embeddings). The map analogy and the toy numbers are mine.

---

## Part 1 · Meaning as coordinates

An embedding is a list of floating-point numbers (a vector) that represents a piece of text so that meaning can be compared with arithmetic. OpenAI's guide puts it that way: a vector of numbers that captures semantic meaning.

Analogy (mine): a map of meaning. Every text gets a position. Texts about similar things land close together, and unrelated texts land far apart. A real embedding has hundreds or thousands of numbers instead of two, so you cannot draw it, but the idea is the same.

To measure how close two positions are, the docs recommend cosine similarity, which compares the direction the two vectors point in. A value near 1 means very similar, near 0 means unrelated. OpenAI notes that its vectors are normalised to length 1, so cosine similarity gives the same ranking as Euclidean (straight-line) distance.

**Worked example**

A toy in two numbers. Say 'car' = (0.9, 0.1), 'automobile' = (0.8, 0.3) and 'banana' = (0.1, 0.9). Cosine similarity of car and automobile is 0.969, very high. Car and banana is 0.220, low. The numbers are made up to show the idea. Real embeddings are learned by a model, and they are what let a search find 'automobile' when you typed 'car'.

**Common mistake**

Thinking an embedding stores the text or its facts. It is only a position. You cannot read the original sentence back from it, and two texts can be close in meaning while one of them is factually wrong.

**Check yourself.** Two sentences use no words in common but get a cosine similarity of 0.85. What does that tell you, and what does it not tell you?

<details><summary>Model answer (write yours first)</summary>

It tells you the model places their meaning close together. It does not tell you that they are both true, that they say the same thing precisely, or that the score is high enough for your use. That threshold has to be tested on your own examples.

</details>

---

## Part 2 · What embeddings are used for

OpenAI lists six uses: search (rank results by relevance), clustering (group similar texts), recommendations (suggest related items), anomaly detection (spot outliers), diversity measurement (see how spread out a set of texts is) and classification (label text by which labelled examples it is closest to).

For this course the important one is search. Later, in the RAG phase, you will turn every chunk of a document into an embedding, turn a question into an embedding, and retrieve the chunks that are closest to the question. Embeddings are the part that lets the system look things up by meaning.

**Worked example**

Fictional. A help centre has 2,000 articles. A customer writes 'my card was swallowed by the cash machine'. No article uses those words, but the embedding of the question sits closest to the embedding of an article titled 'ATM retained your card', so the search returns it.

**Common mistake**

Using embeddings for exact matches, such as an order number or a person's name. Meaning-based search is weak at exact strings. Combining it with keyword search (hybrid search, covered later) is common.

**Check yourself.** Name three tasks that use embeddings and say which of them you would use to find the right paragraph of a policy for a question.

<details><summary>Model answer (write yours first)</summary>

For example search, clustering and classification. To find the right paragraph you use search: embed the question and the paragraphs and return the closest ones.

</details>

---

## Part 3 · Practical facts and limits

As of the OpenAI page read on 2026-09-29, its two third-generation embedding models were text-embedding-3-small (1,536 numbers per vector by default, 62.3 percent on the MTEB benchmark, 8,192 tokens maximum input) and text-embedding-3-large (3,072 numbers, 64.6 percent, 8,192 tokens). Both accept a dimensions setting that shortens the vector without losing the concept-carrying properties, the page says. These are one vendor's models on one date. Newer models may exist.

Three ideas to keep, separate from any vendor: dimension is the length of the vector; the input limit is how much text one call can embed, measured in tokens; similarity is how you compare two vectors.

One rule follows from the map analogy (my reasoning, so test it yourself): compare vectors only when they come from the same model. Different models draw different maps, so a score between vectors from two different models has no meaning.

**Worked example**

You embed 10,000 policy paragraphs with model X. Six months later you switch to model Y for new questions. Y's question vectors cannot be compared with X's stored paragraph vectors. The fix is to re-embed the paragraphs with Y, which is a real cost to plan for.

**Common mistake**

Mixing embeddings from different models, or from the same model after it is replaced, and being puzzled that search quality collapses.

**Check yourself.** You have to switch embedding models. What must you redo, and why?

<details><summary>Model answer (write yours first)</summary>

Re-embed all stored texts with the new model, because vectors from different models are not comparable. Then re-test retrieval quality on your own questions.

</details>

---

## Do it: lab

1. Write 5 sentences: two that mean nearly the same thing in different words, one on a related topic, and two unrelated.
2. Get their embeddings from one provider's embedding endpoint (or a free local embedding model).
3. Compute cosine similarity for every pair (10 pairs) and put the results in a table.
4. Explain in 3 sentences why the paraphrase pair scored high and the unrelated sentence scored low, and note any surprise.

**Done when:** your table has all 10 scores, the explanation matches the numbers, and you named the embedding model you used.

---

## Interview check

**Question.** How would you find the right paragraph of a policy for a user's question?

<details><summary>A strong answer has this shape</summary>

1. Split the policy into paragraphs and embed them once with one embedding model.
2. At question time, embed the question with the same model and rank paragraphs by cosine similarity.
3. Add keyword search for exact strings such as order numbers and names, because meaning-based search is weak at exact matches.
4. Measure how often the right paragraph is in the top few on real questions. Do not guess a similarity threshold.
5. If you change the embedding model, re-embed everything.

</details>

---

## Evidence to keep

Keep your 10-pair similarity table, the name of the embedding model, and your two-sentence explanation. You will need them again when you build retrieval.

---
