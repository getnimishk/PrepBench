# Observability & tracing

**Course:** Agentic AI, from first principles to production · Module 9 Evaluation and Production · lesson 47 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Trace one full agent run and use the trace to find and fix a real problem; show before and after.

> Sources (read 2026-10-02 and 2026-10-03; details and gaps in docs/research/agentic-ai): OpenTelemetry GenAI semantic conventions, read from the attribute registry on opentelemetry.io 2026-10-02 (it states that the conventions moved to the semantic-conventions-genai repository; attributes such as gen_ai.operation.name, gen_ai.request.model, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.agent.name, gen_ai.tool.name, gen_ai.tool.call.id, gen_ai.conversation.id are marked 'Development', and tool arguments, results and message content are flagged as potentially sensitive and opt-in); MLflow documentation 'GenAI evaluation' (MLflow Tracing captures latency, token use and quality data at each step and attaches to evaluation runs); Microsoft Azure Architecture Center 'AI agent orchestration patterns' (instrument all agent operations and handoffs; track per-agent metrics) and 'Circuit breaker pattern' (distributed tracing for end-to-end visibility); Anthropic Engineering multi-agent write-up (full production tracing helped them diagnose why agents failed). Read 2026-10-02 through page summaries. The code on this page (the dataops folder) was written by us and run on Python 3.14.7 with pytest 9.1.1; its 36 tests passed. The 'model' is a scripted stand-in with seeded random variation, so every run is repeatable, and nothing here describes how a real model behaves. The trace in this lesson is produced by our own small tracer with simulated time (stated constants, not measurements), so the durations show how to read a trace, not how fast any real system is. Unverified: any specific tracing product's behaviour beyond what the pages above say; that the OpenTelemetry attribute names will stay as they are, since the registry marks them 'Development'.

---

## Part 1 · What a trace is, for an agent

A **trace** is a record of one run, made of **spans**: each span is one step with a start, an end, a parent and some attributes. For an agent the natural shape is a tree: the whole run at the top, a span for each model call, and a span for each tool call under it. OpenTelemetry's GenAI conventions name these operations `invoke_agent`, `chat` and `execute_tool`, and standardise attribute names such as `gen_ai.usage.input_tokens`, `gen_ai.tool.name` and `gen_ai.conversation.id`. The registry marks them **'Development'**, which means they may still change, so pin the version of any instrumentation library you use and expect to revisit it.

Why you want traces: an agent's behaviour is a sequence of decisions, and when the result is wrong, slow or expensive, the cause is almost always in the sequence, not in one line of code. A good trace answers four questions quickly: **what happened** (steps and arguments), **how long it took** (each span), **how many tokens it used** (each model call) and **what it cost** (tokens times price). Anthropic's write-up of their multi-agent research system says full production tracing was what let them diagnose why agents failed, and Microsoft's guidance says to instrument every agent operation and handoff.

Our tracer writes plain JSON lines, one per span, with those attribute names. A real project would export the same shape through OpenTelemetry to a backend (MLflow Tracing is one tool that records latency, token use and quality data at each step and attaches it to evaluation runs). Here is the core:

```python
"""Tracing for the agent loop: one span per agent run, per model call and per tool call, with OpenTelemetry-style attribute names.

The attribute names (gen_ai.operation.name, gen_ai.usage.input_tokens, ...) follow the OpenTelemetry GenAI conventions, which are marked
'Development' (not yet stable). We write the spans as plain JSON lines so no exporter is needed to learn from them.
Content (arguments, results, prompts) is NOT stored by default: the conventions flag it as potentially sensitive. Sizes and a short hash are.

Time is simulated so a run is repeatable: a model call takes 0.6 s + 0.4 ms per input token + 10 ms per output token,
a tool call 0.2 s + 1 s per 20,000 characters returned. These constants are assumptions for the exercise, not measurements.
"""
import hashlib
import json
import math

from agentkit import block_dict, run_tool


def est_tokens(obj) -> int:
    return math.ceil(len(json.dumps(obj, default=str)) / 4)       # 4 characters per token, a rough guide


# ... class Tracer: start(name, parent, **attrs) and end(span, advance, **attrs) append spans to a list ...

chat = tracer.start(f"chat {model}", root, **{"gen_ai.operation.name": "chat", "gen_ai.request.model": model, "gen_ai.usage.input_tokens": n_in})
resp = client.messages.create(...)
tracer.end(chat, latency, **{"gen_ai.usage.output_tokens": n_out})
...
span = tracer.start(f"execute_tool {b['name']}", root, **{"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": b["name"], "gen_ai.tool.call.id": b["id"], "app.args_hash": ...})
r = run_tool(b, registry, gate)
tracer.end(span, duration, **{"app.result_chars": len(r["content"]), "app.is_error": bool(r.get("is_error"))})
```

**Worked example**

Fictional. A run's trace has one `invoke_agent` span (24 s), three `chat` spans and two `execute_tool` spans. You can see at a glance that one tool span is long and the model call after it is the longest of all: the first clue in the next section.

**Common mistake**

Logging only the final answer and an error count. You cannot debug a sequence from its endpoint; keep the steps.

**Check yourself.** What are the three kinds of span in an agent trace, and what is the parent of the model-call and tool-call spans?

<details><summary>Model answer (write yours first)</summary>

invoke_agent (the whole run), chat (a model call) and execute_tool (a tool call). The model-call and tool-call spans are children of the invoke_agent span.

</details>

---

## Part 2 · Use a trace to find and fix a problem

Here is the exercise your criterion asks for, on a run where we planted a realistic problem: the `get_run_log` tool returns the **whole** log, which is large (about 2,000 lines, 80,947 characters). We ran the same ticket and the same scripted answers before and after a one-line fix. The diagnosis function reads the trace for what a person looks for: the slowest span, the biggest jump in input tokens, and repeated identical tool calls.

```text
--- before the fix (whole log)
  total_seconds          24.19
  model_calls            3
  input_tokens_total     42898
  slowest_span           chat stand-in (9.42 s)
  biggest_token_jump     +20792 input tokens before s4
  repeated_tool_calls    []
  one span as stored: {"span_id": "s3", "parent": "s1", "name": "execute_tool get_run_log", "start": 0.994,
    "attrs": {"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "get_run_log", "gen_ai.tool.call.id": "a",
    "app.args_hash": "dad0a7fc", "app.result_chars": 80947, "app.is_error": false}, "end": 5.242}
```

Read it as an investigator:

1. **The slowest span is not the tool.** The tool span took 4.25 s, but the slowest span overall is a *model call* (9.42 s). A trace that showed only tool timings would have blamed the wrong step.
2. **The token jump explains it.** Input tokens jump by 20,792 before the second model call: the whole log (80,947 characters, about 20,000 tokens) went into the conversation, and then went again into the call after it. Total input for a 3-call run: 42,898 tokens.
3. **The arguments hash is identical-free,** so there is no repeated-call problem to chase. Good: the trace also tells you what is *not* wrong.

The fix: return only the last three lines of the log (what the model needs), keeping the full log available through a separate tool if a case ever needs it. Then trace again:

```text
--- after the fix (tail 3 lines)
  total_seconds          3.59
  model_calls            3
  input_tokens_total     1495
  slowest_span           chat stand-in (1.14 s)
  biggest_token_jump     +90 input tokens before s4
```

Before and after: **24.19 s to 3.59 s** (simulated time; about 85 percent less), and **42,898 to 1,495 input tokens** (about 96.5 percent fewer). Priced at $2 per million input tokens (Sonnet 5.5 on the pricing page read on 2026-10-02, and ignoring its larger tokenizer), the first run's input costs about $0.086 and the second about $0.003, which at 10,000 such tasks a day is roughly $858 against $30. Those dollar figures are illustrative: they assume every task carries a log this large.

Two cautions. The durations come from stated formulas (0.6 s plus 0.4 ms per input token for a model call, 0.2 s plus 1 s per 20,000 characters for a tool), so they show the *shape* of a real trace, not real speed. And after any fix, **rerun the evaluation** (lesson 46): a smaller log may remove information the model needed. The fix is only a fix if the pass rate holds.

**Worked example**

Run `python demo_trace.py` and `python -m pytest test_guard_trace.py`. The test `test_diagnose_finds_the_big_tool_result_and_the_fix_removes_it` asserts that input tokens fall by more than 20 times and time by more than 5 times, and that the biggest jump is over 10,000 tokens.

**Common mistake**

Optimising the step that looks slow. Here the tool looked slow, but the larger cost was the model call that had to read the tool's output. Follow the tokens.

**Check yourself.** Before the fix, which span was the slowest and what in the trace explained it?

<details><summary>Model answer (write yours first)</summary>

A model call (9.42 s). The trace showed a jump of about 20,800 input tokens before it, because the whole log from the tool result was in its input.

</details>

---

## Part 3 · What to log for debugging, and what for audit

Two different purposes need two different levels of detail, and mixing them is a common mistake.

| | Debug traces | Audit log |
|---|---|---|
| Purpose | Find out why a run was wrong, slow or expensive | Prove who approved what, and what the agent did to real systems |
| Content | Every step, token counts, timings, tool names, hashes; **full prompts and tool results only when needed** | Identity of the user and the agent, tool, arguments (minus secrets), approver, decision, time, result, request ids |
| Sensitivity | The OpenTelemetry registry flags tool arguments, results and message content as potentially sensitive; capture is opt-in | Contains personal and business data by nature; protect accordingly |
| Retention | Short (days to weeks) | Long, set by policy and regulation (lesson 54) |
| Who can read | The engineering team | A small set of named roles; changes are append-only |
| Reliability | Best effort; sampling is fine | Must not be dropped; a failed audit write should stop a write action |

Our tracer follows the safe default: **it stores sizes and a hash of the arguments, not the content**, unless you switch content capture on (and the test `test_spans_form_a_tree_with_otel_style_attribute_names_and_no_content_by_default` proves the default). The approval gate from lesson 37 writes the audit record separately: who approved which write.

Practical rules:

- **Correlate with ids.** Put a conversation or ticket id on every span (`gen_ai.conversation.id`) so you can find all the steps of one task, and put the same id in the audit log.
- **Redact before you store.** Strip secrets and personal data at the point of logging, not later; a trace backend is another place for data to leak from.
- **Sample, but never sample failures away.** Keep every error and every must-pass violation; sample the successes.
- **Alert on a few things that matter:** error rate, a spike in tokens per run, p95 latency, an approval denied unusually often, and any run that hits a limit (turns, tokens, same call repeated).
- **Make a trace part of every bug report.** 'The agent was wrong' is not actionable; 'here is trace s1 and the span where it went wrong' is.

**Worked example**

Fictional. A user disputes an action. Support looks up the audit record by ticket id: approver sam.reviewer, tool rerun_job, arguments {pipeline: customers}, approved 10:14, executed once. They open the matching trace to see what the agent had read and why it proposed it. The audit record answers 'who allowed it'; the trace answers 'why did it propose it'.

**Common mistake**

Storing full prompts and tool results in a general trace store 'in case we need them'. That turns a debugging tool into a data-protection problem. Capture content only when needed, for a short time, with access limits.

**Check yourself.** Give two differences between a debug trace and an audit log.

<details><summary>Model answer (write yours first)</summary>

Any two of: purpose (why a run went wrong vs who approved what), content (steps and sizes vs identities, arguments and decisions), retention (short vs long), reliability (best effort vs must not be dropped), readers (engineers vs named roles).

</details>

---

## Do it: lab

1. Add tracing to your DataOps agent (start from `trace.py`): one `invoke_agent` span, one `chat` span per model call with input and output tokens, one `execute_tool` span per tool call with the tool name and result size. Do not store content by default.
2. Run one full agent run and save the trace as JSON lines. Write a `diagnose` of your own that reports the slowest span, the biggest token jump and repeated tool calls.
3. Use the trace to find a real problem in your agent (a huge tool result, a repeated call, a slow tool, a model that rereads context). Say which span and which attribute showed it.
4. Fix it, rerun the same ticket, and show before and after: seconds, model calls, total input tokens and the cost at today's price (record the date).
5. Rerun your evaluation set from lesson 46 and show the pass rate held after the fix.
6. Write the one-page logging policy: what you log for debugging (with retention) and what for audit (with retention), what is redacted, who can read each, and what alerts you set.

**Done when:** you have a trace of one full run, a diagnosis naming the span and attribute that showed a real problem, a before-and-after table (time, calls, tokens, cost) after your fix, the evaluation rerun showing quality held, and a logging policy separating debug from audit.

---

## Interview check

**Question.** An agent run was slow and expensive. How do you investigate?

<details><summary>A strong answer has this shape</summary>

1. Get the trace of that run, keyed by the ticket or conversation id. Without the steps I cannot tell a slow tool from a slow model call from a loop.
2. Read it for the slowest span, the biggest jump in input tokens, repeated identical calls, and errors. Follow the tokens: a big tool result usually makes the next model call slow and expensive.
3. Fix the cause (trim the result, cache, cap the steps), rerun the same input and compare seconds, calls, tokens and cost.
4. Rerun the evaluation to check I did not remove information the agent needed.
5. Add a case or an alert so it is caught next time, and check what we log: steps and sizes by default, content only with care, and a separate audit record of who approved what.

</details>

---

## Evidence to keep

Keep the trace file, the diagnosis, the before-and-after table with the price date, the evaluation rerun and the logging policy.

---
