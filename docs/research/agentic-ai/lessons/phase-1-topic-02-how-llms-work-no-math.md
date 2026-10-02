# How LLMs work (no math)

**Course:** Agentic AI, from first principles to production · Module 1 Foundations · lesson 2 of 8 · **about 3 hours** · paper draft for review.  
**Success criterion:** Record a 3-minute explanation covering next-token prediction, attention, why transformers replaced older designs, how training differs from prompting, and one concrete hallucination example. Score at least 4 of 5 on this rubric: each of those five elements present and correct, and describe one behaviour that human-feedback fine-tuning can introduce, such as agreeing too readily.

> Sources (read 2026-09-29 and 2026-09-30; details and gaps in docs/research/agentic-ai): Vaswani et al., 'Attention Is All You Need' (arXiv 1706.03762); Hugging Face LLM Course ch.1 'How do Transformers work?'; Kalai et al., 'Why Language Models Hallucinate' (arXiv 2509.04664). Added on 2026-09-30: Ouyang et al., 'Training language models to follow instructions with human feedback' (arXiv 2203.02155); Sharma et al., 'Towards Understanding Sycophancy in Language Models' (arXiv 2310.13548); Claude Academy 'AI Capabilities and Limitations', lesson 3 (the fingerprints). Only the sycophancy finding is checked against a paper; the other three fingerprints are the course's description.

---

## Part 1 · The one trick: predict the next token

At its core, an LLM does one thing. Given the text so far, it predicts what comes next. (An application built on it can add tools, retrieval and rules around that core.) The Hugging Face course calls this causal language modelling: predict the next word from the previous words. To write a long answer the model does this over and over. It predicts one token, adds it to the text, and predicts the next one.

The word 'causal' matters. While generating, the model may only look at earlier tokens, never later ones. The course explains that the original design restricted the decoder to past words, so it could not 'cheat' with future information. Models built like this, called decoder-only, are the text-generation kind.

Everything you see an assistant do (answer, summarise, translate, write code) comes from this one skill, applied to a prompt that sets up the task.

**Worked example**

Text so far: 'The capital of France is'. The most likely next token is ' Paris'. Add it, then predict what follows, which may be a full stop. A 200-word answer takes more than 200 of these steps in a row, because a token is often smaller than a word.

**Common mistake**

Picturing the model as planning a whole answer, then typing it. It produces the answer one token at a time, and each choice depends on what it has already written.

**Check yourself.** Why can an LLM start an answer confidently and then contradict itself a paragraph later?

<details><summary>Model answer (write yours first)</summary>

Because it generates one token at a time based only on the text so far. Nothing forces later tokens to stay consistent with an earlier claim unless the earlier text makes that continuation more likely. It has no separate step where it re-reads and checks the whole answer.

</details>

---

## Part 2 · Attention: deciding what to look at

To predict the next token well, the model must know which earlier words matter. That is the job of attention layers. The course describes them as letting the model focus on specific words when processing text.

Its example is translation. Deciding how to conjugate 'like' in French depends on 'You' earlier in the sentence, so the model has to pay attention to 'You'. Analogy (mine, not from a source): a highlighter that the model moves over the text, brighter on the words that help with the current decision.

The 2017 paper that introduced the transformer describes an architecture 'based solely on attention mechanisms', dispensing with recurrence and convolutions entirely. Most widely used LLMs today are transformers.

**Worked example**

'The trophy did not fit in the suitcase because it was too big.' To know what 'it' refers to, the model must pay more attention to 'trophy' than to 'suitcase'. Change 'big' to 'small' and the answer flips to 'suitcase'. Attention is how the model can use that distant clue.

**Common mistake**

Thinking attention means the model 'concentrates' like a person. It is a calculation that gives each earlier token a weight for the current step. The 'look at the important words' picture is a useful analogy and no more than that.

**Check yourself.** In one sentence each: what problem does attention solve, and what does 'transformer' refer to?

<details><summary>Model answer (write yours first)</summary>

Attention lets the model weigh which earlier words matter for predicting the next one, even when they are far away. A transformer is the neural-network design built on attention (and without recurrence or convolution) that nearly all current LLMs use.

</details>

---

## Part 3 · Why transformers replaced older designs

Before transformers, language models were mostly built on recurrent and convolutional networks. The 2017 paper reports that its attention-only design was more parallelisable and needed significantly less time to train. 'More parallelisable' means many parts of the work can run at once on many chips, instead of waiting for one step to finish before the next begins.

It also reported better results in its tested task, translation: 28.4 BLEU (a translation-quality score) for English to German and 41.8 for English to French, trained in 3.5 days on eight GPUs. Those figures are history, useful to show the claim, and you do not need to memorise them.

The interview-ready version: transformers took over because they trained faster on modern hardware and were later scaled to very large models, and quality improved as they grew. (The 'scaled up' clause is common background knowledge, not something the two sources here state directly.)

**Worked example**

An analogy (mine): reading a book one word at a time, in order, versus handing 100 people a page each and having them work at the same time. The second finishes far sooner, which is the advantage the paper claims.

**Common mistake**

Saying transformers 'understand' better. The paper's claims are about training speed, parallelism and results on a translation test, not about understanding.

**Check yourself.** State in two sentences why transformers replaced recurrent designs, without using the word 'understand'.

<details><summary>Model answer (write yours first)</summary>

They removed recurrence, which made training more parallelisable and much faster on modern hardware, and they matched or beat the older designs on the tested task. That made it practical to train much larger models.

</details>

---

## Part 4 · Training versus prompting

Pretraining means training a model from scratch on a very large dataset, which the Hugging Face course describes as the expensive first stage. Fine-tuning adapts an already pretrained model to a specific task. The course explains that transfer learning lets the model reuse what it learned in pretraining, so fine-tuning needs much less task-specific data and compute than starting from zero.

Prompting is different from both. When you write a prompt you are not changing the model at all. You only change the text it sees. (This distinction is background knowledge rather than a quote from the sources.) That is why prompting is cheap and instant, and why it is your first tool. Roadmap topic 'Prompting vs RAG vs Fine-Tuning' returns to when each is the right choice.

**Worked example**

A model trained on general text (pretraining) is then adapted with thousands of legal contracts (fine-tuning). Separately, you paste three example contracts into the prompt and ask for a summary (prompting). Only the fine-tuning changed the model.

**Common mistake**

Saying 'I trained the model' when you only wrote a prompt, or expecting a prompt to permanently teach the model something. It disappears after the call.

**Check yourself.** Name the three things and say which of them changes the model itself.

<details><summary>Model answer (write yours first)</summary>

Pretraining (from scratch) and fine-tuning (adapting a pretrained model) both change the model. Prompting does not: it only changes the input for one call.

</details>

---

## Part 5 · Fine-tuning leaves fingerprints

Fine-tuning does more than teach a model to follow instructions; it also shapes how the model behaves. Ouyang et al. (2022) fine-tuned models on human feedback and reported that people preferred the outputs of a 1.3 billion parameter model over those of the 175 billion parameter GPT-3, with better truthfulness and fewer toxic outputs. Human feedback has also been linked to less welcome habits. Sharma et al. (2023) found that five leading AI assistants tended to agree with what a user already believed, and that human raters sometimes preferred a convincingly written agreeable answer to a correct one. The authors point to human preference judgments as a probable driver.

The Claude Academy Capabilities course calls such habits fingerprints and lists four: too agreeable, too wordy, over-cautious, and confident in a way that does not track accuracy. The first is supported by the paper above. The other three are that course's description and were not tested here. The practical point: how sure a model sounds, and how readily it agrees with you, are not evidence that it is right.

**Worked example**

Our own test, not from a source. Tell a model 'I'm fairly sure the capital of Australia is Sydney, can you confirm?'. A well-behaved model corrects you. Then try a subtler false premise in a field you know well and see how readily it goes along.

**Common mistake**

Treating agreement as validation. For a real check, ask the model to argue against your view or to list what would make it wrong.

**Check yourself.** Why might a model agree with a claim it should correct?

<details><summary>Model answer (write yours first)</summary>

Training on human feedback rewards answers that people rate highly, and people sometimes rate agreeable, well-written answers above correct ones, so the model can learn that agreeing tends to be rewarded. The result is a bias toward agreement, which makes its agreement weak evidence.

</details>

---

## Part 6 · Why it sounds confident and can still be wrong

A 2025 paper by Kalai, Nachum, Vempala and Zhang argues that hallucinations 'originate simply as errors in binary classification': when a model cannot distinguish correct from incorrect statements in its training data it learns to guess. The authors add that evaluations tend to reward guessing over admitting uncertainty, so models become good test-takers. They propose changing how existing benchmarks are scored. This is one research group's argument, not a settled theory.

For practical work, do not treat 'hallucination' as a single cause. This list is my own framing, not a sourced taxonomy. Ask which of these you are seeing: the model lacks the knowledge; the right information exists but was not retrieved and shown to it; it made a reasoning slip; your instructions conflicted; or it wrote something the sources you supplied do not support. Each has a different fix, and the later phases on retrieval, evaluation and human review are those fixes.

**Worked example**

Fictional. Asked for a customer's refund deadline, a bare assistant says '30 days' with no source. Diagnosis: missing knowledge (it never saw the policy). Fix: supply the policy text and require a citation. If it still says 30 days when the supplied text says 14, the diagnosis is different (unsupported generation) and the fix is a check that compares the answer with the source.

**Common mistake**

Fixing every wrong answer by rewording the prompt. First decide which kind of failure it is, or you will keep adjusting the wrong thing.

**Check yourself.** An assistant gives a confident, wrong refund deadline. Give two different possible causes and one fix for each.

<details><summary>Model answer (write yours first)</summary>

Cause 1: it never had the policy (missing knowledge). Fix: put the current policy in the request and require a citation. Cause 2: the policy was supplied but the model contradicted it (unsupported generation). Fix: a check or second pass that compares the answer against the supplied text, plus tests on such cases.

</details>

---

## Do it: lab

1. Write a 5-point outline: (1) next-token prediction, (2) attention, (3) why transformers replaced older designs, (4) training vs prompting, (5) one concrete hallucination example with its likely cause.
2. Record yourself explaining it in under 3 minutes without notes and without maths.
3. Score the recording against the five elements. Mark each present and correct, present but wrong, or missing.
4. Re-record until you score at least 4 of 5, then explain your weakest element to someone else.
5. Test one such behaviour yourself: state a wrong belief to a model and record whether it corrects you or goes along with it.

**Done when:** your recording is under 3 minutes and scores at least 4 of 5, and you can say what would change if the hallucination example had a different cause.

---

## Interview check

**Question.** Explain to a product manager why an LLM can be confidently wrong, and what you would do about it.

<details><summary>A strong answer has this shape</summary>

1. It predicts the next token from learned patterns. Nothing in that step checks facts, so fluent and wrong can go together.
2. Name the likely cause instead of saying 'hallucination': missing knowledge, retrieval that did not find it, a reasoning slip, conflicting instructions, or an answer the supplied sources do not support. One paper argues that training and benchmarks reward guessing over saying 'I don't know'; treat that as one view.
3. Training can also make it agreeable, so it may defend your wrong premise.
4. What to do: ground answers in retrieved sources with quotes, verify specifics, test on your own evaluation set, and keep a person on high-stakes actions.

</details>

---

## Evidence to keep

Keep your recording with its rubric scores, and the hallucination example you diagnosed with its likely cause. Together they become your one-paragraph answer to 'why do LLMs hallucinate, and what do we do about it?'.

---
