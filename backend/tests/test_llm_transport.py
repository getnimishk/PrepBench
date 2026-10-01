# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The one HTTP client every AI call goes through, and its promise: a failure is
returned as an error message, never raised.

Everything above it relies on that. A provider that times out, refuses the
connection, answers 500 or answers with something that is not JSON must reach
the feature as "no answer, and why" -- shown as Not Graded with the reason --
never as an exception that becomes a 500, and never as a result. Each failure
is produced here by an httpx.MockTransport, so no test touches the network.
"""

import httpx
import pytest

from app.llm import transport

URL = "http://provider.invalid/v1/chat"


def client_that(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def raises(exc: Exception):
    def handler(request: httpx.Request) -> httpx.Response:
        raise exc
    return handler


def answers(status: int, *, json=None, text=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if json is not None:
            return httpx.Response(status, json=json)
        return httpx.Response(status, text=text or "")
    return handler


TIMEOUT = httpx.ReadTimeout("read timed out")
REFUSED = httpx.ConnectError("connection refused")
OTHER = httpx.RemoteProtocolError("server disconnected without a response")

# (what goes wrong, handler, what the error must say)
FAILURES = [
    ("a timeout", raises(TIMEOUT), "Timed out after 7s"),
    ("a refused connection", raises(REFUSED), "Could not connect"),
    ("a dropped connection", raises(OTHER), "Network/HTTP Exception"),
    ("an HTTP error", answers(503, text="model is loading"), "HTTP 503: model is loading"),
]


@pytest.mark.parametrize("what, handler, says", FAILURES, ids=[f[0] for f in FAILURES])
def test_post_json_returns_every_failure_as_an_error_never_raises(what, handler, says):
    body, error = transport.post_json(client_that(handler), URL, {"prompt": "x"}, timeout=7)
    assert body is None, f"{what} must not produce a body"
    assert error is not None and says in error


@pytest.mark.parametrize("what, handler, says", FAILURES, ids=[f[0] for f in FAILURES])
def test_get_json_returns_every_failure_as_an_error_never_raises(what, handler, says):
    body, error = transport.get_json(client_that(handler), URL, timeout=7)
    assert body is None
    assert error is not None and says in error


@pytest.mark.parametrize("what, handler, says", FAILURES, ids=[f[0] for f in FAILURES])
def test_get_text_returns_every_failure_as_an_error_never_raises(what, handler, says):
    body, error = transport.get_text(client_that(handler), URL, timeout=7)
    assert body is None
    assert error is not None and says in error


@pytest.mark.parametrize("call", [
    lambda c: transport.post_json(c, URL, {"prompt": "x"}, timeout=7),
    lambda c: transport.get_json(c, URL, timeout=7),
], ids=["post_json", "get_json"])
def test_a_200_that_is_not_json_is_an_error_not_a_result(call):
    body, error = call(client_that(answers(200, text="<html>proxy login page</html>")))
    assert body is None
    assert error is not None and error.startswith("Response was not valid JSON")


def test_an_http_error_body_is_cut_short_in_the_message():
    body, error = transport.post_json(client_that(answers(500, text="x" * 1000)), URL, {}, timeout=7)
    assert body is None
    assert error == "HTTP 500: " + "x" * 150


def test_success_returns_the_body_and_no_error():
    payload = {"choices": [{"message": {"content": "graded"}}]}
    assert transport.post_json(client_that(answers(200, json=payload)), URL, {}, timeout=7) == (payload, None)
    assert transport.get_json(client_that(answers(200, json={"models": []})), URL, timeout=7) == ({"models": []}, None)
    assert transport.get_text(client_that(answers(200, text="<html>ok</html>")), URL, timeout=7) == ("<html>ok</html>", None)


def test_headers_reach_the_provider_and_an_empty_set_sends_none():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={})

    transport.post_json(client_that(handler), URL, {}, timeout=7, headers={"Authorization": "Bearer test-key"})
    assert seen["auth"] == "Bearer test-key"
    transport.post_json(client_that(handler), URL, {}, timeout=7, headers={})
    assert seen["auth"] is None


def test_the_shared_client_is_reused_and_replaced_once_closed():
    first = transport.get_shared_client()
    assert transport.get_shared_client() is first
    first.close()
    second = transport.get_shared_client()
    assert second is not first and not second.is_closed
