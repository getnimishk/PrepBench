# Prompting fundamentals

**Course:** Agentic AI, from first principles to production · Module 3 Prompting, Structured Output and Evaluation Basics · lesson 13 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Take one vague prompt and improve it three ways; show before-and-after outputs and say which change helped and why.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Anthropic documentation 'Prompt engineering overview' and 'Prompting best practices' (clear and direct instructions, context, examples, XML tags, role, long-context placement, prefill removal), and Claude Academy 'AI Fluency' lessons 8 and 9 (product, process and performance description; six techniques), all read 2026-10-02 (the AI Fluency notes come from earlier page summaries in docs/research/agentic-ai/courses). Vendor-specific: the prompting page is written for Anthropic's models and says a technique measured on one model should be re-checked on another. The 'up to 30 percent' effect of putting the question last is the vendor's own test result and we did not reproduce it. The before-and-after prompts are our illustration and are not model outputs; no model was called for this lesson. Unverified: model-specific advice changes with each model release.

---

## Part 1 · Before you write the prompt: say what good looks like

Anthropic's prompt engineering overview starts with three prerequisites: a clear definition of success, some way to test against it, and a first draft. Without the first two, 'improving' a prompt is guessing. The same page adds that not every failure is a prompting problem: sometimes a different model fixes latency or cost faster than rewording.

Write success criteria that are specific and measurable (lesson 18 builds on this). 'Summaries should be good' cannot be tested. 'Each summary is under 80 words, names the decision, and states any deadline' can.

The AI Fluency course gives a useful way to say what you want, called Description: describe the **product** (what you want back), the **process** (how it should go about it) and the **performance** (how it should behave: tone, caution, when to ask).

**Worked example**

Fictional. Task: summarise a meeting transcript. Product: five bullets, each under 15 words. Process: list decisions first, then actions, then open questions. Performance: if something is unclear, say so instead of guessing.

**Common mistake**

Starting with the wording of the prompt before you know how you will tell whether it worked.

**Check yourself.** Name the three things to have before you start improving a prompt.

<details><summary>Model answer (write yours first)</summary>

A clear definition of success, a way to test against it, and a first draft. Also check that prompting is the right lever, since a different model sometimes fixes cost or speed more easily.

</details>

---

## Part 2 · Be clear, direct and give reasons

The best-practices page says Claude responds well to clear, explicit instructions, and offers a test it calls the golden rule: show your prompt to a colleague with minimal context and ask them to follow it. If they would be confused, the model will be too. Think of the model as a capable new colleague who lacks your context.

Four habits follow:

- **Say exactly what you want**, including format and limits. If you want more than the minimum, ask for it explicitly.
- **Number the steps** when order or completeness matters.
- **Give the reason.** The page's example: instead of 'never use ellipses', say the reply will be read aloud by a text-to-speech engine that cannot pronounce them. The model can then generalise the reason to cases you did not list.
- **State what to do when unsure**, such as 'if the contract does not say, answer "not stated"'. This is the AI Fluency idea of describing performance.

Strong emphasis (capitals, 'NEVER', 'CRITICAL') was a habit with older, less attentive models. The same guidance warns that newer models can overreact to it; explain the reason instead.

**Worked example**

Fictional vague prompt: 'Summarise this.' Clearer: 'Summarise the meeting notes below for a manager who was absent. Use at most five bullets of under 15 words. List decisions first, then actions with owners, then open questions. If an owner is not named, write "owner not stated".'

**Common mistake**

Assuming the model knows your audience, format and standards. It only has the words you gave it.

**Check yourself.** Why is 'NEVER use jargon' weaker than 'Readers are new hires, so replace jargon with plain words'?

<details><summary>Model answer (write yours first)</summary>

The second gives the model the reason and the audience, so it can handle cases the first never mentions, such as an acronym you did not think of.

</details>

---

## Part 3 · Examples, structure and role

**Examples.** The page calls examples one of the most reliable ways to steer format, tone and structure. Make them relevant (like your real use), diverse (so the model does not pick up an accidental pattern from near-identical ones) and structured (wrapped in `<example>` tags, several inside `<examples>`). It suggests 3 to 5. AI Fluency's six techniques include the same: context, examples, constraints, step by step, room to think, and role or tone.

**Structure with tags.** When a prompt mixes instructions, background, examples and input, wrap each in its own tag so nothing is mistaken for something else:

```text
<instructions>Classify the ticket as billing, access or other. Reply with the label only.</instructions>
<examples>
  <example><ticket>I was charged twice</ticket><label>billing</label></example>
  <example><ticket>Cannot log in after the password reset</ticket><label>access</label></example>
</examples>
<ticket>{{the new ticket text}}</ticket>
```
Use consistent, descriptive tag names. This also helps keep untrusted text, such as a customer's message, visibly separate from your instructions, though it does not make injection impossible (Module 9).

**Role.** One sentence in the system prompt ('You are a support triage assistant for an IT help desk') focuses behaviour and tone. Treat it as a starting point, not a safeguard.

**Worked example**

Fictional. A classifier given three near-identical billing examples starts labelling everything 'billing'. Replacing two with an access and an 'other' example fixes the bias.

**Common mistake**

Examples that all look alike, so the model learns the accident (a shared word or length) instead of the rule.

**Check yourself.** Why must examples be diverse, and how many does the page suggest?

<details><summary>Model answer (write yours first)</summary>

So the model learns the intended rule and not an unintended pattern shared by similar examples. The page suggests 3 to 5.

</details>

---

## Part 4 · Long inputs, output format and what to avoid

**Long documents.** For inputs of roughly 20,000 tokens or more, the page advises putting the long material at the top, above your instructions and question, and structuring several documents with `<document>`, `<source>` and `<document_content>` tags. It says putting the query at the end can improve quality by up to 30 percent in the vendor's tests, especially for complex multi-document input. That figure is the vendor's, measured on its own tests; treat it as a reason to try, not a promise.

**Output format.** Say the format you want in words and show it. If your code will read the answer, do not rely on wording alone: lesson 14 covers schemas.

**Prefill is gone on newer models.** Starting the assistant's reply for the model ('prefill') used to force a format. Anthropic's documentation says models from Claude 4.6 onward reject it with a 400 error and recommends structured outputs, direct instructions or tools instead. A prompt copied from an old tutorial may still contain it.

**Chaining.** Splitting a job into several calls is still useful when you need to inspect a middle result. The page's most common pattern is draft, review against criteria, then refine, each as its own call so you can log and test it.

**Worked example**

Fictional. Three contracts and a question: place the contracts first, each in a `<document>` with its filename as `<source>`, and the question 'Which contract allows early termination?' last.

**Common mistake**

Copying an old prompt that ends with a prefilled assistant message into a new model and getting a 400 error.

**Check yourself.** Where should the question go in a prompt with a very long document, and what should you do with the vendor's '30 percent' claim?

<details><summary>Model answer (write yours first)</summary>

After the document, at the end of the prompt. Treat the 30 percent as the vendor's own result and verify the effect on your own test cases.

</details>

---

## Part 5 · One vague prompt, improved three ways

The lab asks you to improve one prompt and show which change helped. Here is the method on a made-up task, with no model output claimed:

**Start.** 'Triage this email.' Criteria: label is one of billing, access, other (checked by exact match); a one-line reason under 20 words.

1. **Clarity change.** Add the audience, the allowed labels and the format: 'Label the email billing, access or other. Reply with the label, a colon, then a reason of at most 20 words.'
2. **Examples change.** Add three diverse examples in `<examples>` tags.
3. **Reason and fallback change.** Add: 'Labels route to different teams, so a wrong label delays the customer. If an email fits two labels, choose other and say why.'

Run the original and each variant on the **same** 8 to 10 emails, and run each at least 3 times, because outputs vary. Count how many labels are right and how many replies follow the format. Change one thing at a time; otherwise you cannot say which change helped. Lesson 18 shows how to judge whether a difference is real.

**Worked example**

Fictional result table you would fill in: original 5 of 10 labels right and 3 of 10 in format; clarity 7 and 9; examples 8 and 10; reason and fallback 9 and 10. The numbers are invented to show the layout.

**Common mistake**

Changing three things at once and crediting the one you like best.

**Check yourself.** Why run each variant several times on the same inputs?

<details><summary>Model answer (write yours first)</summary>

Model output varies from run to run, so one run can mislead. The same inputs let you compare variants fairly, and repeats show how much is noise.

</details>

---

## Do it: lab

1. Pick one task you care about (triage, summary, extraction). Write its success criteria as product, process and performance, with at least one check a program could make.
2. Write a deliberately vague first prompt. Collect 8 to 10 realistic inputs, including at least one awkward one (too long, ambiguous, or off-topic).
3. Make three improved versions, one change each: clarity and format; diverse examples in tags; reason plus what to do when unsure.
4. Run all four prompts on the same inputs, three times each, using the same model and settings. Save every output.
5. Score each run against your criteria and fill a table of before and after.
6. Write which change helped most, which did nothing, and one hypothesis for why, in five sentences.

**Done when:** you have the four prompts, the saved outputs, a scored table, and a five-sentence conclusion that names the change that helped and the evidence for it.

---

## Interview check

**Question.** A prompt works on your examples but is inconsistent in production. How do you improve it without guessing?

<details><summary>A strong answer has this shape</summary>

1. Write down what 'good' means in checkable terms and collect real failing inputs.
2. Build a small test set from them, with edge cases, and score the current prompt to get a baseline.
3. Change one thing at a time: clearer instructions with reasons, diverse examples, a defined fallback ('say not stated'), structured output for what code reads.
4. Re-run on the same set, several times, and compare pass rates, not impressions.
5. Keep the winning version in version control with its results, and add each new production failure to the test set.

</details>

---

## Evidence to keep

Keep the four prompts, outputs and the scored table. They are your first evaluation evidence and seed the test set you build in lesson 18.

---
