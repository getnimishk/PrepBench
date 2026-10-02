"""In-process tests of the server (no subprocess): the client talks to the MCPServer object directly."""
import asyncio

from mcp import Client
from mcp.shared.exceptions import MCPError

from server import mcp


def run(coro):
    return asyncio.run(coro)


def text_of(result):
    return " ".join(c.text for c in result.content if getattr(c, "type", "") == "text")


async def _list():
    async with Client(mcp) as c:
        return await c.list_tools()


def test_lists_both_tools_with_schemas():
    tools = {t.name: t for t in run(_list()).tools}
    assert set(tools) == {"lookup_runbook", "pipeline_status"}
    assert tools["lookup_runbook"].input_schema["properties"]["error_code"]["pattern"] == r"^ERR-\d{4}$"
    assert tools["pipeline_status"].input_schema["properties"]["pipeline"]["enum"] == ["orders", "payments", "customers"]


async def _call(name, args):
    async with Client(mcp) as c:
        try:
            return await c.call_tool(name, args)
        except MCPError as e:
            return e


def test_both_tools_work():
    assert "Schema drift" in text_of(run(_call("lookup_runbook", {"error_code": "ERR-4417"})))
    assert text_of(run(_call("pipeline_status", {"pipeline": "payments"}))) == "payments: failing (2 consecutive runs)"


def test_bad_input_is_rejected_and_reported_as_a_tool_error():
    r = run(_call("lookup_runbook", {"error_code": "4417; DROP TABLE"}))
    assert r.is_error and "string_pattern_mismatch" in text_of(r)
    r = run(_call("pipeline_status", {"pipeline": "salaries"}))
    assert r.is_error and "literal_error" in text_of(r)


def test_an_anticipated_failure_gives_the_model_a_useful_message():
    r = run(_call("lookup_runbook", {"error_code": "ERR-9999"}))
    assert r.is_error and "Known codes" in text_of(r)
