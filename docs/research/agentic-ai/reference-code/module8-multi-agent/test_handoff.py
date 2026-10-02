import pytest
from pydantic import ValidationError

from handoff import Escalate, HandoffPacket, route, routing_report


def packet(to, **kw):
    base = dict(to=to, goal="Get the duplicate charge refunded", facts={"order_id": "A-1042"}, tried=["checked the invoice"], ask="Issue the refund if the charge is a duplicate")
    return HandoffPacket(**{**base, **kw})


# --- lost context ---------------------------------------------------------------------------------------------
def test_a_packet_without_the_order_id_is_rejected():
    with pytest.raises(ValidationError):
        packet("billing", facts={})                 # the receiving agent would have had to ask the customer again


def test_the_receiver_sees_the_facts_the_sender_established():
    seen = {}

    def billing(p):
        seen.update(p.facts)
        return "done", f"Refund queued for {p.facts['order_id']}"

    text, trail = route({"triage": lambda p: ("handoff", packet("billing")), "billing": billing}, "triage", packet("triage"))
    assert seen == {"order_id": "A-1042"} and "A-1042" in text and trail == ["triage", "billing"]


# --- loops ----------------------------------------------------------------------------------------------------
def test_ping_pong_is_stopped_and_escalated():
    agents = {"a": lambda p: ("handoff", packet("b")), "b": lambda p: ("handoff", packet("a"))}
    with pytest.raises(Escalate) as e:
        route(agents, "a", packet("a"))
    assert "a -> b" in str(e.value)


def test_a_long_chain_of_different_agents_is_also_stopped():
    names = ["a", "b", "c", "d", "e", "f"]
    agents = {n: (lambda nxt: lambda p: ("handoff", packet(nxt)))(names[(i + 1) % len(names)]) for i, n in enumerate(names)}
    with pytest.raises(Escalate) as e:
        route(agents, "a", packet("a"), max_hops=4)
    assert "more than 4 hops" in str(e.value)


# --- wrong route ----------------------------------------------------------------------------------------------
def test_routing_is_measured_on_labelled_cases():
    right, n, confusion = routing_report()
    assert n == 10 and right < n                    # the keyword router is imperfect, and now we can see where
    assert any(truth != got for (truth, got) in confusion)


def test_a_better_classifier_can_be_compared_on_the_same_cases():
    truth = dict(__import__("handoff").ROUTING_SET)
    right, n, _ = routing_report(lambda m: truth[m])
    assert right == n


def test_one_legitimate_hand_back_is_allowed():
    def triage(p):
        return ("handoff", packet("technical")) if not p.tried else ("handoff", packet("billing"))
    seq = {"triage": triage,
           "technical": lambda p: ("handoff", packet("triage", tried=["technical: this is a billing question"])),
           "billing": lambda p: ("done", "Refund queued")}
    text, trail = route(seq, "triage", packet("triage", tried=[]))
    assert trail == ["triage", "technical", "triage", "billing"] and text == "Refund queued"
