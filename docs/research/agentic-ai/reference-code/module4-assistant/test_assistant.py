import pytest
import tools
from fake_model import ScriptedModel, call, text
from gate import ApprovalGate
from loop import AgentStopped, run_agent
from tools import REGISTRY

quiet = lambda *_: None


@pytest.fixture(autouse=True)
def fresh_data():
    tools.TICKETS[101]["comments"].clear()
    tools.APPLIED.clear()


def run(turns, user="q", gate=None, **kw):
    return run_agent(ScriptedModel(turns), "m", "sys", REGISTRY, user, gate=gate, on_event=quiet, **kw)


def test_answers_from_a_tool_result():
    answer, msgs = run([[call("t1", "lookup_ticket", ticket_id=101)], [text("Ticket 101 is open.")]])
    assert answer == "Ticket 101 is open."
    assert msgs[2]["content"][0]["tool_use_id"] == "t1"


def test_declines_to_call_a_tool_when_none_is_needed():
    answer, msgs = run([[text("A token is a chunk of text.")]])
    assert len(msgs) == 2 and "token" in answer


def test_bad_input_goes_back_to_the_model_as_an_error():
    _, msgs = run([[call("t1", "lookup_ticket", ticket_id="abc")], [text("Sorry, I need a number.")]])
    r = msgs[2]["content"][0]
    assert r["is_error"] and "ticket_id" in r["content"]


def test_missing_ticket_is_an_error_with_a_hint():
    _, msgs = run([[call("t1", "lookup_ticket", ticket_id=999)], [text("No such ticket.")]])
    r = msgs[2]["content"][0]
    assert r["is_error"] and "Known ids" in r["content"]


def test_write_is_blocked_without_a_gate():
    _, msgs = run([[call("t1", "add_comment", ticket_id=101, text="Called the user")], [text("Not done.")]])
    assert msgs[2]["content"][0]["is_error"]
    assert tools.TICKETS[101]["comments"] == []


def test_write_runs_only_after_approval_and_is_logged():
    gate = ApprovalGate(lambda name, args: True)
    run([[call("t1", "add_comment", ticket_id=101, text="Called the user")], [text("Done.")]], gate=gate)
    assert tools.TICKETS[101]["comments"] == ["Called the user"]
    assert gate.decisions[0]["decision"] == "approved"


def test_denied_write_does_not_run_and_is_logged():
    gate = ApprovalGate(lambda name, args: False)
    run([[call("t1", "add_comment", ticket_id=101, text="Called the user")], [text("Not done.")]], gate=gate)
    assert tools.TICKETS[101]["comments"] == []
    assert gate.decisions[0]["decision"] == "denied"


def test_loop_stops_when_the_model_repeats_itself():
    with pytest.raises(AgentStopped, match="stuck"):
        run([[call("t1", "lookup_ticket", ticket_id=101)]] * 10)


def test_loop_stops_at_the_turn_limit():
    turns = [[call(f"t{i}", "lookup_ticket", ticket_id=101 + (i % 2))] for i in range(10)]
    with pytest.raises(AgentStopped):
        run(turns, max_turns=3, max_same_call=99)


def test_loop_stops_at_the_token_budget():
    turns = [[call(f"t{i}", "lookup_ticket", ticket_id=101 + (i % 2))] for i in range(10)]
    with pytest.raises(AgentStopped, match="budget"):
        run(turns, max_total_tokens=250, max_same_call=99)


def test_a_retried_write_is_applied_once():
    from tools import AddComment, add_comment
    args = AddComment(ticket_id=101, text="Called the user")
    add_comment(args, "toolu_1")
    add_comment(args, "toolu_1")             # the retry, same key
    assert tools.TICKETS[101]["comments"] == ["Called the user"]
    add_comment(args, "toolu_2")             # a genuinely new request
    assert len(tools.TICKETS[101]["comments"]) == 2
