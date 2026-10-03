import json

import pytest
from starlette.testclient import TestClient

import app as a


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("AGENT_TOKENS", "alice:tok-a,bob:tok-b")
    monkeypatch.setenv("AGENT_DAILY_CAP_USD", "0.05")
    monkeypatch.setenv("AGENT_KILL", "0")
    a.LOG.clear()
    a.SPEND.clear()
    a.SPEND["global"] = 0.0


def post(client, token=None, text="payments load failed"):
    h = {"authorization": f"Bearer {token}"} if token else {}
    return client.post("/triage", json={"text": text}, headers=h)


def test_health_needs_no_auth_and_reveals_nothing_about_users():
    assert TestClient(a.app).get("/health").json() == {"ok": True}


def test_no_token_or_wrong_token_is_401_and_nothing_runs():
    c = TestClient(a.app)
    assert post(c).status_code == 401 and post(c, "nope").status_code == 401
    assert a.SPEND["global"] == 0.0


def test_a_valid_token_runs_and_cost_is_recorded_against_that_user():
    c = TestClient(a.app)
    assert post(c, "tok-a").status_code == 200
    assert a.SPEND["alice"] == 0.013 and "bob" not in a.SPEND


def test_per_user_cap_stops_one_user_without_stopping_another():
    c = TestClient(a.app)
    codes = [post(c, "tok-a").status_code for _ in range(5)]
    assert codes.count(200) == 3 and codes[-1] == 429             # 3 x 0.013 = 0.039; the next would pass 0.05 with the estimate
    assert post(c, "tok-b").status_code == 200


def test_kill_switch_stops_everything_without_a_redeploy(monkeypatch):
    c = TestClient(a.app)
    monkeypatch.setenv("AGENT_KILL", "1")
    assert post(c, "tok-a").status_code == 503
    monkeypatch.setenv("AGENT_KILL", "0")
    assert post(c, "tok-a").status_code == 200


def test_logs_have_ids_status_and_cost_but_never_the_content_or_the_token():
    c = TestClient(a.app)
    post(c, "tok-a", text="SECRET customer text")
    post(c, "wrong")
    blob = json.dumps(a.LOG)
    assert "SECRET" not in blob and "tok-a" not in blob and "diagnosis for" not in blob
    assert {e["status"] for e in a.LOG} == {200, 401} and a.LOG[0]["user"] == "alice"
