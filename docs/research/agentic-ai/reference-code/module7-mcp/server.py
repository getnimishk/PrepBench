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
