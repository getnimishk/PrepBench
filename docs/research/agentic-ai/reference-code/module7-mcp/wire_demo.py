"""Run one list_tools and one call_tool through tee_proxy.py, then print the captured wire log."""
import asyncio
import json
import sys

from mcp import Client
from mcp.client.stdio import StdioServerParameters


async def main():
    async with Client(StdioServerParameters(command=sys.executable, args=["tee_proxy.py"])) as client:
        await client.list_tools()
        await client.call_tool("lookup_runbook", {"error_code": "ERR-4417"})


asyncio.run(main())
for line in open("wire.log", encoding="utf-8"):
    tag, _, payload = line.partition(" ")
    try:
        print(tag, json.dumps(json.loads(payload))[:520])
    except ValueError:
        print(tag, payload.strip()[:200])
