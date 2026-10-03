# Reliability basics: timeouts, retries and idempotency

**Course:** Agentic AI, from first principles to production · Module 4 Agent Core · lesson 25 of 77 · **about 3 hours** · paper draft for review.  
**Success criterion:** Add timeout and retry to your assistant, force a failure, and show that a retried write action is not applied twice.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Anthropic documentation 'API errors' and the Python SDK page (default 2 retries, 10-minute timeout, which errors are retried, APITimeoutError, request ids); HTTPX documentation 'Timeouts'; Stripe API documentation 'Idempotent requests' (how idempotency keys work: the first result is stored per key and returned on retries, keys up to 255 characters, pruned after at least 24 hours, an error if parameters differ, GET and DELETE idempotent by definition), all read 2026-10-02 through page summaries. Module 2 lesson 11 supplies the retry rules. The reference code on this page was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1 against a scripted stand-in for the model (11 tests passed). It uses the same message shapes as Anthropic's documented Messages API, but it has not been run against the real API, because that needs a key and spends money. The reliability demo (a write that commits but whose reply is lost) was written and run by us and its output is shown exactly. Stripe's design is one vendor's; the idea is general, but the key lifetime and details differ elsewhere. Unverified: how a particular downstream system treats duplicate requests; test it.

---

## Part 1 · Three kinds of failure

Agents depend on networks and services, so things will fail. Three controls cover most of it:

- **Timeouts:** do not wait forever. Anthropic's Python SDK defaults to 10 minutes and the HTTPX library to 5 seconds of inactivity, so set your own for each call, and an overall deadline for the whole run.
- **Retries:** try again on temporary failures (network errors, 429, 5xx) with backoff and a cap; do not retry errors that cannot improve (bad key, bad request). The SDK already retries some errors twice by default, so remember that retries multiply: your retries around the SDK's retries around a timeout can add up to a very long wait.
- **Idempotency:** make it safe to repeat an action, so a retry does not do it twice.

**Worked example**

Fictional. A tool call has a 30-second timeout, 3 attempts and the SDK underneath also retries twice: the worst case is about 3 x 3 x 30 seconds before the user hears anything. Count it.

**Common mistake**

Adding retries at every layer without computing the total wait and the total number of requests.

**Check yourself.** Why must you compute the worst-case wait when retries exist at several layers?

<details><summary>Model answer (write yours first)</summary>

Because retries multiply: attempts times attempts times the timeout can be far longer, and send many more requests, than any one layer suggests.

</details>

---

## Part 2 · The duplicate-write problem

Reads are safe to repeat. Writes are not. The dangerous case: your code sends a write, the service applies it, but the reply is lost (a timeout, a dropped connection). Your code sees an error and retries. If the service has no way to recognise the repeat, the write happens twice: two comments, two tickets, two refunds.

**Idempotency** means that doing the same operation more than once has the same effect as doing it once. HTTP's GET and DELETE are idempotent by definition (the Stripe page says so). For operations that are not, such as 'create' or 'add', the standard solution is an **idempotency key**: the client generates a unique key for one logical action and sends it with every attempt of that action. The service stores the result of the first attempt under the key and, if the key comes again, returns that stored result instead of acting again. Stripe's design: keys are random strings up to 255 characters (it suggests V4 UUIDs), results are kept for at least 24 hours, and if the same key arrives with different parameters it returns an error, to catch misuse.

**Worked example**

Fictional. 'Refund 40 dollars to order 77' retried after a timeout. With key `refund-77-a1`, the second attempt returns the first refund's result. Without a key, the customer gets 80 dollars.

**Common mistake**

Generating a new key on each retry. Then the service sees two different requests. The key must stay the same across attempts of one action.

**Check yourself.** Why must the idempotency key be the same on every retry of one action?

<details><summary>Model answer (write yours first)</summary>

Because the key is how the service recognises a repeat. A new key looks like a new request and will be applied again.

</details>

---

## Part 3 · Our demo: the same write, with and without a stable key

In the reference tools, `add_comment(args, key)` stores the result of each key and returns it if the key is seen again. The agent loop passes the model's `tool_use` id as the key, so every attempt at that one tool call carries the same key. The demo wraps the tool so it applies the write and then raises an error as if the reply had been lost, and retries:

```text
Without a stable key (a new key on every retry):
  attempt 1 failed, retrying
  comments on ticket: 2
With one stable key per action:
  attempt 1 failed, retrying
  comments on ticket: 1
```
That is the success criterion in one picture: the retried write is applied once. The test `test_a_retried_write_is_applied_once` checks the same thing, and also that a genuinely new request (a new key) is applied.

Two further cases to design for. If the service has **no** idempotency support, check the state before retrying (does the comment already exist?) or make the operation a replace instead of an add. And when a retry keeps failing, stop: record the action as 'outcome unknown', alert a person, and do not loop.

**Worked example**

Fictional. A system without keys: before retrying 'create invoice 551', query whether invoice 551 exists. If yes, treat the first attempt as having succeeded.

**Common mistake**

Assuming a timeout means the write did not happen. It may have. Treat a timed-out write as 'outcome unknown'.

**Check yourself.** A timed-out write call returns no response. What are your two safe options?

<details><summary>Model answer (write yours first)</summary>

Retry with the same idempotency key (so a repeat is ignored), or check the current state first to see whether the write already happened, then retry only if it did not.

</details>

---

## Part 4 · Putting it together in the assistant

For your build: wrap each tool call in a timeout and a bounded retry for temporary errors only; use the tool_use id (or another stable id) as the idempotency key for writes; set the model client's own `timeout` and `max_retries` deliberately; record every retry in the log with the request id; and add an overall run deadline. Test it the way the demo does: force the failure, and show the effect applied once. Module 9 returns to this for queues, resuming long tasks, rate limits and fallbacks.

**Worked example**

Fictional log line: 'add_comment key=toolu_01 attempt 2 of 3: timeout; state unchanged since attempt 1; applied once.'

**Common mistake**

Testing only successes. Reliability code is only proven by forcing failures.

**Check yourself.** List four things to put in place for a reliable write tool.

<details><summary>Model answer (write yours first)</summary>

A timeout, a bounded retry for temporary errors only, an idempotency key kept the same across attempts, and a log of each attempt (plus a path to a person when it still fails).

</details>

---

## Do it: lab

1. Add a timeout and a bounded retry (temporary errors only, with backoff) around your assistant's tool calls and the model client. Compute the worst-case wait.
2. Make your write tool idempotent with a stable key (the tool_use id) and write a test: the same key twice applies the write once, a new key applies it again.
3. Force a failure that looks like a lost reply: the write commits but the call raises. Retry and show the result is applied once.
4. Show the same experiment without the key and show the duplicate.
5. Write the 'outcome unknown' path: what your code does when retries run out, and who is told.
6. Record the retry log with request ids.

**Done when:** your log shows a forced failure and a retry, the write was applied exactly once, the same experiment without a key shows a duplicate, and the 'outcome unknown' path is written.

---

## Interview check

**Question.** An AI agent created duplicate tickets after a network timeout. What happened and how do you prevent it?

<details><summary>A strong answer has this shape</summary>

1. A write was applied but the reply was lost; the retry could not tell it was a repeat, so it ran again.
2. Fix: give each logical action a stable idempotency key sent on every attempt, and have the service store the first result and return it for repeats. Where the service has no keys, check state before retrying or use replace instead of add.
3. Set timeouts and bounded retries only for temporary errors, and compute the worst-case wait across layers.
4. Treat a timed-out write as 'outcome unknown', alert a person when retries run out, and log request ids.
5. Test by forcing the failure, and add it to the regression set.

</details>

---

## Evidence to keep

Keep the forced-failure log, both runs (with and without the key), the tests and the 'outcome unknown' note. They go into your Module 9 reliability work.

---
