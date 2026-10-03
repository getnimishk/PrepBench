"""Tools for a small ticket assistant. One read-only tool, one write tool."""
from dataclasses import dataclass
from typing import Callable

from pydantic import BaseModel, Field

TICKETS = {
    101: {"title": "VPN drops every hour", "status": "open", "comments": []},
    102: {"title": "Printer on floor 3 offline", "status": "open", "comments": []},
}
APPLIED = {}          # idempotency key -> result, so a retried write is not applied twice


class LookupTicket(BaseModel):
    ticket_id: int = Field(description="Numeric ticket id, for example 101")


class AddComment(BaseModel):
    ticket_id: int
    text: str = Field(min_length=3, max_length=500)


def lookup_ticket(args: LookupTicket, key: str) -> dict:
    t = TICKETS.get(args.ticket_id)
    if t is None:
        raise KeyError(f"No ticket {args.ticket_id}. Known ids: {sorted(TICKETS)}")
    return {"id": args.ticket_id, **t}


def add_comment(args: AddComment, key: str) -> dict:
    if key in APPLIED:                      # same key seen before: return the earlier result
        return APPLIED[key]
    TICKETS[args.ticket_id]["comments"].append(args.text)
    result = {"ok": True, "ticket_id": args.ticket_id, "comments": len(TICKETS[args.ticket_id]["comments"])}
    APPLIED[key] = result
    return result


@dataclass
class Tool:
    name: str
    description: str
    model: type
    fn: Callable
    writes: bool = False

    def spec(self) -> dict:
        return {"name": self.name, "description": self.description, "input_schema": self.model.model_json_schema()}


REGISTRY = {t.name: t for t in [
    Tool("lookup_ticket",
         "Look up one support ticket by its numeric id and return its title, status and comments. Read-only. "
         "Use it whenever the user asks about a specific ticket. It does not search by text.",
         LookupTicket, lookup_ticket),
    Tool("add_comment",
         "Add a comment to one ticket. This changes data and needs a person's approval. Use it only when the user "
         "explicitly asks to add a comment, and never to close or reassign a ticket.",
         AddComment, add_comment, writes=True),
]}
