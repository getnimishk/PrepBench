"""A tool registry: one entry per tool, with the schema, the permission level, the owner and the rules a tool must meet to be listed.

The permission level is what governance reads: 'read' (changes nothing), 'write' (changes something but is reversible and low impact),
'approval_required' (a person approves before it runs). Entries can be generated from the tool objects, so the registry cannot drift from the code.
"""
import re
from typing import Literal

from pydantic import BaseModel, Field

SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


class ToolEntry(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_]{2,63}$")
    version: str
    description: str = Field(min_length=40)
    input_schema: dict
    permission: Literal["read", "write", "approval_required"]
    data_classes: list[str]                       # what data it can touch: 'operational', 'customer', 'financial' ...
    owner: str
    status: Literal["active", "deprecated"] = "active"
    runs_as: Literal["agent", "user_delegated"] = "agent"
    idempotent: bool = True
    rate_limit_per_min: int = Field(default=60, ge=1)


def validate_entry(e: ToolEntry) -> list[str]:
    f = []
    if not SEMVER.match(e.version):
        f.append(f"{e.name}: version must look like 1.2.3")
    if "@" not in e.owner:
        f.append(f"{e.name}: owner must be a contact (an email address)")
    if not e.data_classes:
        f.append(f"{e.name}: declare the data classes the tool can touch")
    d = e.description.lower()
    if "use " not in d and "use it" not in d:
        f.append(f"{e.name}: the description should say when to use the tool")
    if not any(w in d for w in ("not ", "never", "only")):
        f.append(f"{e.name}: the description should say what the tool does not do or its limit")
    if e.input_schema.get("type") != "object" or e.input_schema.get("additionalProperties") is not False:
        f.append(f"{e.name}: the input schema must be an object that forbids extra properties")
    if e.permission != "read":
        if not e.idempotent:
            f.append(f"{e.name}: a changing tool must be idempotent (or have a documented reason)")
        if e.permission == "write" and "customer" in e.data_classes:
            f.append(f"{e.name}: a tool that writes customer data must be approval_required")
    return f


def from_tools(tools: dict, owner: str, permissions: dict, data_classes: dict) -> list[ToolEntry]:
    """Build entries from the live Tool objects. `permissions` and `data_classes` are the decisions a human makes and a reviewer checks."""
    out = []
    for name, t in tools.items():
        out.append(ToolEntry(name=name, version="1.0.0", description=t.description, input_schema=t.model.model_json_schema(),
                             permission=permissions[name], data_classes=data_classes[name], owner=owner, idempotent=True))
    return out


def check_registry(entries: list[ToolEntry], agent_tool_names: set) -> list[str]:
    f = []
    names = [e.name for e in entries]
    if len(names) != len(set(names)):
        f.append("registry: duplicate tool names")
    for e in entries:
        f += validate_entry(e)
    by = {e.name: e for e in entries}
    for n in agent_tool_names:
        if n not in by:
            f.append(f"agent: tool {n} is used but not in the registry")
        elif by[n].status == "deprecated":
            f.append(f"agent: tool {n} is deprecated")
    return f
