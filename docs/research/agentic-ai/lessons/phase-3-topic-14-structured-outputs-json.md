# Structured outputs (JSON)

**Course:** Agentic AI, from first principles to production · Module 3 Prompting, Structured Output and Evaluation Basics · lesson 14 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Extract fields from 10 messy emails into JSON that validates against a Pydantic schema, with at least one malformed output detected and handled.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Anthropic documentation 'Structured outputs' (output_config.format with a JSON schema, strict tool use, supported models, schema limits, guarantees and exceptions), 'API errors' (prefill and forced-tool-use restrictions), 'Tool use overview' (the regex remark), Pydantic v2 'Models', all read 2026-10-02 through page summaries. Vendor-specific: the schema limits, the guarantee and the model lists describe Anthropic's feature as documented on that date. The retry demo (a scripted stand-in for the model, three replies, Pydantic 2.13.4) was written and run by us; its output is shown exactly. We did not call the real structured-output endpoint, so the SDK example is taken from the documentation and has not been run by us. Unverified: which models support the feature and its numeric limits change.

---

## Part 1 · Why free text is the wrong interface for code

When a program reads a model's reply, free text is fragile: a sentence of preamble, a changed key name or a missing quote breaks the parser. Anthropic's tool-use guide says it plainly: if you are writing a regular expression to pull a decision out of model output, that decision should have been a tool call. The remedy is to make the shape of the answer part of the request.

There are three levels, from weakest to strongest:

1. **Ask in the prompt, then validate.** Describe the JSON, show an example, parse the reply with a validator, and retry on failure. Works with any model.
2. **Structured outputs.** Give the API a JSON Schema and it constrains the output to match it.
3. **Strict tool use.** For tool calls, set `strict: true` so the tool's input always matches its schema.

**Worked example**

Fictional. A reply of 'Sure! Here is the JSON: {...}' breaks `json.loads`. A schema-constrained reply is only the JSON.

**Common mistake**

Trusting a model that says 'I will reply only in JSON'. A promise in the prompt is not a guarantee.

**Check yourself.** List the three ways to get machine-readable output, weakest first.

<details><summary>Model answer (write yours first)</summary>

Prompt for JSON and validate with retries; structured outputs with a schema; strict tool use for tool inputs.

</details>

---

## Part 2 · Structured outputs with a schema

In Anthropic's API you set `output_config.format` to a JSON Schema, and the reply is constrained to it using compiled grammars. With the Python SDK and a Pydantic model the documented example is:

```python
from pydantic import BaseModel
import anthropic

class ContactInfo(BaseModel):
    name: str
    email: str
    plan_interest: str
    demo_requested: bool

client = anthropic.Anthropic()
response = client.messages.parse(
    model="<a current model id>",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Extract: John Smith (john@example.com) interested in Enterprise plan, demo Tuesday 2pm"}],
    output_format=ContactInfo,
)
print(response.parsed_output)
```
What the documentation says to know (as of 2026-10-02):

- The output is valid JSON with required fields and the right types, and no retries are needed for schema violations.
- **Exceptions:** a refusal (`stop_reason: "refusal"`) or hitting `max_tokens` can leave output that does not match; always check `stop_reason`.
- **Schema limits:** numeric limits (`minimum`, `maximum`), string limits (`minLength`, `maxLength`) and recursive schemas are not supported. The first request with a new schema is slower because the grammar is compiled, and compiled grammars are cached for 24 hours.
- Not every model supports it, and two older tricks are gone: prefilled replies are rejected on Claude 4.6 and later, and forced tool use (`tool_choice` of `any` or `tool`) returns a 400 on several current models, where the docs point you to structured outputs or `strict` tools instead.

**Worked example**

Fictional. A schema field `priority` with an enum of `low`, `medium`, `high` means the reply cannot say 'urgent'.

**Common mistake**

Believing the schema guarantees the content is right. It guarantees the shape. The email field can still hold a wrong address.

**Check yourself.** Name two cases where a structured reply may still not match your schema.

<details><summary>Model answer (write yours first)</summary>

When the model refuses (stop reason `refusal`) and when generation stops at `max_tokens` and the JSON is cut off.

</details>

---

## Part 3 · Validate anyway: shape is not truth

Because the API's schema support does not cover value rules like length or range, and because shape never proves correctness, keep your own validation (lesson 10's Pydantic). Put the rules the schema cannot express into the model class, and validate every reply, whichever level you used.

Design the schema to avoid forcing a guess:

- Allow an explicit **not stated** value, such as an optional field or an enum member `unknown`, so the model is not pushed to invent a missing detail.
- Prefer **enums** over free text for categories.
- Keep it **small**: only fields your code uses.
- Add a **version** if the shape will change.

Check the content too. For extraction, sample the results against the source text; for anything that changes data, a person or a rule should confirm.

**Worked example**

Fictional. A form field 'delivery date' where the email never gave one. A required string field would invite an invented date; an optional field returns null.

**Common mistake**

Making every field required, which turns missing information into a made-up value.

**Check yourself.** Why make a field optional or add an 'unknown' option?

<details><summary>Model answer (write yours first)</summary>

So the model can say a detail is absent instead of being forced to invent one, which is how fabricated values get into your data.

</details>

---

## Part 4 · When the reply is malformed: validate, retry, escalate

Whatever level you use, plan for a bad reply. The pattern: validate, retry a few times telling the model what was wrong, then hand the item to a person. This runs the scripted example from our tests, in which a stand-in for the model returns a bad email, then cut-off text, then a good reply:

```python
from pydantic import BaseModel, Field, ValidationError

class Contact(BaseModel):
    name: str
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    wants_demo: bool

def extract(text, max_attempts=3):
    prompt = f"Extract name, email and wants_demo as JSON from: {text}"
    for attempt in range(1, max_attempts + 1):
        raw = call_model(prompt)                    # your real call goes here
        try:
            return Contact.model_validate_json(raw)
        except ValidationError as e:
            problem = e.errors()[0]
            print(f"attempt {attempt}: rejected ({problem['type']})")
            prompt += f"\nYour last reply was invalid: {problem['msg']}. Reply with JSON only."
    raise ValueError("no valid reply; send this one to a person")
```
Output of the run (Pydantic 2.13.4):

```text
attempt 1: rejected (string_pattern_mismatch at email)
attempt 2: rejected (json_invalid at whole reply)
name='John Smith' email='john@example.com' wants_demo=True
```
Count the retries as cost: each is another model call. Record how often each rejection type happens; that is the number you tune the prompt against.

**Worked example**

Fictional. Of 10 emails, 8 validate first time, 1 needs a retry, and 1 still fails after 3 attempts and goes to a person. That one-in-ten escalation rate is a number you can report and improve.

**Common mistake**

An unbounded retry loop. A reply that is never valid burns money forever; cap the attempts and escalate.

**Check yourself.** What happens after the last allowed attempt fails, and why?

<details><summary>Model answer (write yours first)</summary>

The item goes to a person (or a queue) with the failure recorded. A bounded loop keeps cost down and makes sure no item is silently lost or guessed.

</details>

---

## Do it: lab

1. Write 10 messy inputs for one extraction task, for example support emails from which you want sender intent, product, urgency and a deadline. Include some with missing details, one with a contradictory detail and one that is not an email at all.
2. Define a Pydantic model with at least one enum, one optional field and one rule the schema cannot express (a length or range).
3. Get structured replies from a model, either with structured outputs or with a JSON prompt plus validation. Validate every reply.
4. Add the retry-then-escalate loop with a cap of 3 attempts. Log each rejection type.
5. Force at least one malformed output (for instance by lowering `max_tokens` so a reply is cut off) and show that it is detected and handled.
6. Compare 10 results to the source text and count wrong values that passed validation. Write what a schema cannot catch.

**Done when:** all 10 inputs end as a valid record or a logged escalation, at least one malformed reply was detected and handled, and you counted values that were valid but wrong.

---

## Interview check

**Question.** Your extraction pipeline sometimes writes wrong values into a database even though every record validates. What do you do?

<details><summary>A strong answer has this shape</summary>

1. Validation proves shape, not truth, so add checks on content: compare extracted values to the source text, use enums and ranges, and allow 'unknown' so the model is not forced to guess.
2. Sample and audit regularly, and measure the wrong-but-valid rate on a labelled test set.
3. For high-impact fields, require a person's confirmation or a second source before writing.
4. Log the source, the model and the prompt version with every record so bad data can be traced and corrected.
5. Report the escalation rate and the wrong-value rate to the business as the quality measures, with a target for each.

</details>

---

## Evidence to keep

Keep the 10 inputs, the model class, the log of rejections, and your count of valid-but-wrong values. Module 4's assistant reuses this validation for tool inputs.

---
