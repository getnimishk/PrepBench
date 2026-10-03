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
