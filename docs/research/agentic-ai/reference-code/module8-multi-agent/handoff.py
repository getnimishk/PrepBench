"""Handoffs between agents: a packet that carries context, guards against loops, and a routing check.

Three ways a handoff fails, each with the fix that is in this file and a test in test_handoff.py:
  lost context   -> the next agent gets only the last message.      Fix: a HandoffPacket with required fields.
  a loop         -> A hands to B, B hands back to A, and so on.      Fix: a hop limit and a ping-pong check, then escalate to a person.
  the wrong route-> triage sends a billing question to technical.   Fix: measure routing on labelled cases; let a specialist hand back once with a reason.
"""
from collections import Counter

from pydantic import BaseModel, Field


class HandoffPacket(BaseModel):
    """What the receiving agent needs so it does not have to ask the customer again."""
    to: str
    goal: str = Field(min_length=5, description="what the customer wants, in one sentence")
    facts: dict[str, str] = Field(min_length=1, description="identifiers and values already established, e.g. order id")
    tried: list[str] = Field(default_factory=list, description="what has already been done or ruled out")
    ask: str = Field(min_length=5, description="what the receiving agent is being asked to do")


class Escalate(Exception):
    """Stop the automatic chain and give the case to a person, with the trail so far."""


def route(agents: dict, start: str, packet: HandoffPacket, max_hops=4):
    """Run agents one at a time. Each agent is a function(packet) -> ('done', text) or ('handoff', HandoffPacket)."""
    trail, current = [], start
    while True:
        trail.append(current)
        if len(trail) > max_hops:
            raise Escalate(f"more than {max_hops} hops: {' -> '.join(trail)}")
        if len(trail) >= 4 and trail[-4] == trail[-2] and trail[-3] == trail[-1] and trail[-1] != trail[-2]:
            raise Escalate(f"ping-pong between {trail[-2]} and {trail[-1]}: {' -> '.join(trail)}")
        kind, out = agents[current](packet)
        if kind == "done":
            return out, trail
        packet, current = out, out.to


# a stand-in router: keyword rules, which is exactly the kind of thing that misroutes
RULES = [("billing", ("refund", "invoice", "charge", "charged", "payment", "bill")),
         ("technical", ("error", "crash", "slow", "login", "bug", "outage", "down")),
         ("account", ("password", "email address", "close my account", "profile"))]


def classify(message: str) -> str:
    text = message.lower()
    hits = Counter()
    for label, words in RULES:
        hits[label] = sum(w in text for w in words)
    best, n = hits.most_common(1)[0]
    return best if n else "unknown"


ROUTING_SET = [
    ("I was charged twice for my invoice", "billing"),
    ("Please refund my last payment", "billing"),
    ("The app crashes when I open reports", "technical"),
    ("Login shows an error since this morning", "technical"),
    ("I need to reset my password", "account"),
    ("Update the email address on my profile", "account"),
    ("The invoice page is slow to load", "technical"),            # mentions invoice but is a performance problem
    ("My payment failed with an error code 502", "technical"),    # mentions payment but is a technical fault
    ("Was I charged after I asked to close my account?", "billing"),   # mentions closing but is about a charge
    ("Can you cancel everything?", "account"),                    # no keywords at all
]


def routing_report(classifier=classify, cases=ROUTING_SET):
    confusion, right = Counter(), 0
    for message, truth in cases:
        got = classifier(message)
        confusion[(truth, got)] += 1
        right += got == truth
    return right, len(cases), confusion
