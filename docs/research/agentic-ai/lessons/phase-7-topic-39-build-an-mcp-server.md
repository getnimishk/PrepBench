# Build an MCP server

**Course:** Agentic AI, from first principles to production · Module 7 MCP and A2A · lesson 39 of 77 · **about 5 hours** · paper draft for review.  
**Success criterion:** A client lists and calls both tools against your server, shown with logs, and one call is rejected by input validation. Finish with a one-page 4D review: what you delegated, how you described it, how you checked the result, and what you recorded and disclosed.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Model Context Protocol specification 2026-07-28, Tools page (tool definitions, names, results, errors, security considerations: servers must validate inputs, apply access controls, rate limit and sanitise outputs; clients should confirm sensitive operations and log tool use), read 2026-10-02; MCP Python SDK 2.2.0 (the `MCPServer` class, `mcp.tool()`, `ToolError`, `Client` with stdio and in-process transports), used by running it; the SDK documentation page we fetched gave only the server quickstart, so the client code comes from reading the installed package and running it. The code on this page was written by us and run on Python 3.14.7 with the official MCP Python SDK 2.2.0 (protocol version 2026-07-28), which we installed with uv; its 4 tests passed, and the wire log below is real output captured from that run. We ran the server over stdio only. We also tried the streamable HTTP transport on Windows and the server closed connections without replying; we did not diagnose that, so nothing here depends on HTTP. Also verified by running: a stray `print` on a stdio server's standard output reached the client as a parse error in its log, while the SDK carried on in our run. Unverified: other clients' tolerance of such output; HTTP transport; authorization (lesson 40); production hosting.

---

## Part 1 · A server with two tools

Here is a complete MCP server with two read-only tools for the DataOps domain. It is short on purpose: the SDK turns a typed Python function into a tool, builds the JSON Schema from the type hints and descriptions, and handles the protocol.

```python
"""A small MCP server with two tools, built with the official Python SDK (mcp 2.x, protocol 2026-07-28).

Run over stdio (a client launches it):   python server.py
Run over HTTP on port 9102 (for curl):   python server.py http
"""
import sys
from typing import Annotated, Literal

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import Field

mcp = MCPServer("northwind-dataops")

RUNBOOK = {
    "ERR-4417": "Schema drift: ask the data owner to approve a schema update. Do not drop the column.",
    "ERR-5102": "Late arrival: rerun the job once the upstream file lands.",
}
STATUS = {"orders": "healthy", "payments": "failing (2 consecutive runs)", "customers": "healthy"}


@mcp.tool()
def lookup_runbook(error_code: Annotated[str, Field(pattern=r"^ERR-\d{4}$", description="Error code such as ERR-4417")]) -> str:
    """Return the runbook guidance for one pipeline error code. Read-only."""
    if error_code not in RUNBOOK:
        raise ToolError(f"No runbook entry for {error_code}. Known codes: {sorted(RUNBOOK)}")   # an anticipated failure: the model sees this text
    return RUNBOOK[error_code]


@mcp.tool()
def pipeline_status(pipeline: Literal["orders", "payments", "customers"]) -> str:
    """Return the current health of one named pipeline. Read-only."""
    return f"{pipeline}: {STATUS[pipeline]}"


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "http":
        mcp.run(transport="streamable-http", host="127.0.0.1", port=9102)
    else:
        mcp.run()
```

What each line of design is doing:

- **`@mcp.tool()`** registers the function. The function's docstring becomes the tool `description`, which is what the model reads to decide when to use it (lesson 22). Write it as 'what it does, when to use it, what it does not do'.
- **The type hints become the input schema.** `Annotated[str, Field(pattern=...)]` produces a JSON Schema `pattern`, and `Literal[...]` produces an `enum`. Our client printed them: `{'pattern': '^ERR-\\d{4}$', ...}` and `{'enum': ['orders', 'payments', 'customers'], ...}`.
- **Validation happens before your function runs.** A value that does not match is rejected by the SDK with a validation message; your code never sees it. This is the input validation the specification says servers must do, and you get the first layer for free.
- **`ToolError` is for failures you expect.** When the code is well formed but has no entry, we raise `ToolError` with a message the model can use. Any other exception is treated as a crash and the client gets only a generic message, because internals should not leak.
- **Keep standard output clean.** Over stdio the protocol runs on standard output. We tested a server with a stray `print('starting up...')`: the client's log showed `Invalid JSON ... input_value='starting up...'`, and in our run the SDK kept going and the calls worked. Do not rely on that tolerance: log to standard error or a file.

**Worked example**

```text
tools: ['lookup_runbook', 'pipeline_status']
  lookup_runbook: input schema = {... 'pattern': '^ERR-\\d{4}$' ...}
  pipeline_status: input schema = {... 'enum': ['orders', 'payments', 'customers'] ...}
```

**Common mistake**

Writing a vague description such as 'database tool'. The model chooses tools from descriptions, so a vague one leads to wrong or missing calls.

**Check yourself.** Where does the tool's input schema come from, and what happens to an input that does not match it?

<details><summary>Model answer (write yours first)</summary>

From the function's type hints and Field annotations. The SDK rejects a non-matching input with a validation error before the function runs.

</details>

---

## Part 2 · A client that lists and calls both tools, and one rejected call

The client launches the server as a subprocess over stdio, lists its tools, calls both, and then sends three bad calls:

```python
"""A minimal MCP client: launch the server over stdio, list its tools, call both, and show a rejected call."""
import asyncio
import sys

from mcp import Client
from mcp.client.stdio import StdioServerParameters
from mcp.shared.exceptions import MCPError


def short(result):
    texts = [c.text for c in result.content if getattr(c, "type", "") == "text"]
    return ("ERROR " if result.is_error else "") + " ".join(texts)


async def main():
    params = StdioServerParameters(command=sys.executable, args=["server.py"])
    async with Client(params) as client:
        tools = await client.list_tools()
        print("tools:", [t.name for t in tools.tools])
        for t in tools.tools:
            print(f"  {t.name}: input schema = {t.input_schema}")
        print("call 1:", short(await client.call_tool("lookup_runbook", {"error_code": "ERR-4417"})))
        print("call 2:", short(await client.call_tool("pipeline_status", {"pipeline": "payments"})))
        for label, name, args in [("bad code format", "lookup_runbook", {"error_code": "4417; DROP TABLE"}),
                                  ("unknown pipeline", "pipeline_status", {"pipeline": "salaries"}),
                                  ("known format, no entry", "lookup_runbook", {"error_code": "ERR-9999"})]:
            try:
                print(f"call ({label}):", short(await client.call_tool(name, args)))
            except MCPError as e:
                print(f"call ({label}): protocol error {e}")


asyncio.run(main())
```

Output of the real run:

```text
tools: ['lookup_runbook', 'pipeline_status']
call 1: Schema drift: ask the data owner to approve a schema update. Do not drop the column.
call 2: payments: failing (2 consecutive runs)
call (bad code format): ERROR Error executing tool lookup_runbook: 1 validation error for lookup_runbookArguments
  error_code
    String should match pattern '^ERR-\d{4}$' [type=string_pattern_mismatch, input_value='4417; DROP TABLE', ...]
call (unknown pipeline): ERROR Error executing tool pipeline_status: 1 validation error ... Input should be 'orders', 'payments' or 'customers' [type=literal_error, input_value='salaries', ...]
call (known format, no entry): ERROR Error executing tool lookup_runbook: No runbook entry for ERR-9999. Known codes: ['ERR-4417', 'ERR-5102']
```

The three rejected calls show three different layers. The first two were stopped by the **schema** before any of our code ran. The third passed the schema and was stopped by our **business rule**, with a message that tells the model what to try instead. All three came back as results with `is_error` set, not as crashes, so an agent can read them and recover.

Tests make this repeatable without a subprocess. The SDK lets a client connect to the server object in the same process:

```python
async def _call(name, args):
    async with Client(mcp) as c:          # in-process: no subprocess, no network
        return await c.call_tool(name, args)


def test_bad_input_is_rejected_and_reported_as_a_tool_error():
    r = run(_call('lookup_runbook', {'error_code': '4417; DROP TABLE'}))
    assert r.is_error and 'string_pattern_mismatch' in text_of(r)
```

All four tests pass: both tools are listed with their schemas, both work, bad input is rejected as a tool error, and an anticipated failure carries a useful message.

**Worked example**

Add a third tool for a real action, such as `rerun_job`. Mark it clearly in its description as changing data, validate its arguments as strictly as you validated the others, and decide who confirms the call: the host should ask the user (the specification says there should be a human able to deny), and your server should still enforce its own access rule.

**Common mistake**

Relying on the client or the model to send valid input. The server is the last line: validate everything it receives, as if the caller were hostile.

**Check yourself.** The third rejected call (ERR-9999) passed schema validation. What stopped it, and why is the message important?

<details><summary>Model answer (write yours first)</summary>

The tool's own business rule (no entry for that code), raised as a ToolError. The message lists the known codes, so the model can correct itself instead of retrying blindly.

</details>

---

## Part 3 · Making it safe to hand to someone else

The specification's security considerations for tools are short, and worth turning into a checklist before anyone else connects to your server. Servers **must**: validate all tool inputs, implement access controls, rate-limit invocations and sanitise outputs. Clients **should**: prompt for confirmation on sensitive operations, show inputs to the user before calling, validate results before passing them to the model, use timeouts, and log tool use for audit.

| Control | In our server | What you still add |
|---|---|---|
| Validate inputs | Pattern and enum from the type hints; business rule in code | Length limits, allow-lists, and tests with hostile values (path traversal, SQL, very long strings) |
| Access control | None: it is a local demo with two read-only tools | Per-user identity and per-tool permissions (lesson 40); never trust a caller-supplied user id |
| Rate limiting | None | A limit per caller and per tool, and a budget for expensive calls |
| Sanitise outputs | Returns fixed strings | Strip secrets and internal paths; remember a result is text a model will read, so avoid echoing untrusted content as if it were an instruction |
| Logging | None in the server | A line per call: who, tool, arguments (minus secrets), outcome, duration |
| Names and descriptions | Clear, one job each | Review descriptions as you would review code: they steer the model |

Add a minimal log now, because the lab's evidence is the log. A decorator that writes one JSON line to a file (not to standard output) per call is enough. Note that the log is itself data you are responsible for: do not write secrets or personal data into it.

Last, think about **change**. A server's tool list can change (the `tools` capability can advertise `listChanged`), and a host that approved a tool yesterday may see a different tool today. Hosts should re-show changes and servers should version their tools; treat a silent change to a tool's behaviour as you would a silent change to a production API.

**Worked example**

Fictional log line: {"ts": "2026-10-02T10:03:11Z", "tool": "lookup_runbook", "args": {"error_code": "ERR-4417"}, "outcome": "ok", "ms": 3}. A rejected call logs outcome 'rejected: pattern' with the invalid value redacted or truncated.

**Common mistake**

Logging to standard output in a stdio server. It corrupts the protocol stream. Log to a file or standard error.

**Check yourself.** Give three things a server must do for every tool call, and one thing it should never print where.

<details><summary>Model answer (write yours first)</summary>

Validate inputs, apply access control, rate-limit, and sanitise outputs. It should never print log lines to standard output on a stdio server, because that is the protocol channel.

</details>

---

## Do it: lab

1. Build an MCP server with two tools (start from the reference `server.py`): use clear descriptions, strict input schemas (a pattern, an enum or a range), and a `ToolError` with a useful message for the failure you expect.
2. Add a log: one JSON line per call to a file, with the tool, the arguments (redact anything sensitive), the outcome and the duration. Make sure nothing is printed to standard output.
3. Write a client (start from `client.py`) that lists the tools, calls both, and sends one call that your validation rejects. Save its output and the server log.
4. Write in-process tests: both tools work, a bad input is rejected as a tool error, the anticipated failure has a useful message. All must pass.
5. Capture the wire with `wire_demo.py` and mark where your input schema appears and which message carries the rejection.
6. Write the one-page 4D review: what you delegated to a code assistant or to the SDK, how you described each tool, how you checked the behaviour (tests, hostile inputs, the log), and what you recorded and disclosed (who can connect, what each tool can reach, what it logs).

**Done when:** a client lists and calls both tools against your server, shown with logs; one call is rejected by input validation and the rejection is in the log; your tests pass; and the 4D review page exists.

---

## Interview check

**Question.** You are asked to expose an internal system to AI agents through MCP. What do you build into the server before anyone connects?

<details><summary>A strong answer has this shape</summary>

1. A small set of narrowly described tools, each with a strict input schema, and no tool the use case does not need.
2. Input validation, access control tied to the caller's real identity, rate limits and output sanitising, as the specification says servers must provide.
3. A log of every call, kept off the protocol channel, with secrets redacted.
4. A distinction between read-only and writing tools, with confirmation in the host and a second check in the server for writes.
5. Tests with hostile inputs and a plan for versioning the tool list. Descriptions are reviewed like code because they steer the model.

</details>

---

## Evidence to keep

Keep the server and client code, the server log with the rejected call, the tests, the annotated wire log and the 4D review page. This is a practice build, not a portfolio project.

---
