"""Tests for Agent B (the SDK-served runbook agent) and Agent A's failure handling. No sockets for B: Starlette's test client."""
from a2a.types import AgentCard, SendMessageRequest, Task
from google.protobuf.json_format import ParseDict
from starlette.testclient import TestClient

from agent_a import delegate
from agent_b import CARD, build_app

HEADERS = {"A2A-Version": "1.0", "content-type": "application/json"}


def rpc(client, method, params, headers=HEADERS):
    return client.post("/a2a", headers=headers, json={"jsonrpc": "2.0", "id": "1", "method": method, "params": params}).json()


def message(text):
    return {"message": {"messageId": "m-1", "role": "ROLE_USER", "parts": [{"text": text}]}}


def test_agent_card_is_served_and_valid():
    with TestClient(build_app()) as c:
        card = c.get("/.well-known/agent-card.json").json()
    ParseDict(card, AgentCard())                                   # the SDK's own type accepts our JSON field names
    assert card["supportedInterfaces"][0]["protocolBinding"] == "JSONRPC" and card["skills"][0]["id"] == "runbook-lookup"


def test_a_message_creates_a_completed_task_with_an_artifact():
    with TestClient(build_app()) as c:
        out = rpc(c, "SendMessage", message("What does ERR-4417 mean?"))
    task = out["result"]["task"]                                   # the result is wrapped as {"task": ...}
    ParseDict(task, Task())
    assert task["status"]["state"] == "TASK_STATE_COMPLETED" and "Schema drift" in task["artifacts"][0]["parts"][0]["text"]


def test_no_matching_entry_ends_in_a_failed_task():
    with TestClient(build_app()) as c:
        task = rpc(c, "SendMessage", message("What does ERR-9999 mean?"))["result"]["task"]
    assert task["status"]["state"] == "TASK_STATE_FAILED"


def test_the_request_we_send_is_a_valid_send_message_request():
    ParseDict(message("hello"), SendMessageRequest())


def test_missing_or_wrong_version_header_is_rejected():
    with TestClient(build_app()) as c:
        for headers in ({"content-type": "application/json"}, {**HEADERS, "A2A-Version": "9.9"}):
            out = rpc(c, "SendMessage", message("ERR-4417"), headers)
            assert out["error"]["code"] == -32009 and "not supported" in out["error"]["message"]


def test_unknown_task_is_an_error():
    with TestClient(build_app()) as c:
        assert rpc(c, "GetTask", {"id": "nope"})["error"]["code"] == -32001


def test_unreachable_agent_is_a_handled_result_not_an_exception():
    out = delegate("http://127.0.0.1:9199", "What does ERR-4417 mean?", timeout=1.0)
    assert out["ok"] is False and out["retryable"] is True and "unreachable" in out["reason"]
