# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Large bodies leave the server in pieces (see app/core/chunked_body.py): a single
body message of a few hundred kilobytes stalled in the Vite proxy in front of the
API, and the screen waiting for it never finished loading.
"""
import asyncio

from fastapi.testclient import TestClient

from app.core.chunked_body import ChunkedBodyMiddleware
from app.main import app


def _run(inner, chunk_bytes=64 * 1024):
    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    asyncio.run(ChunkedBodyMiddleware(inner, chunk_bytes)({"type": "http"}, receive, send))
    return sent


def _responding_with(body: bytes):
    async def inner(scope, receive, send):
        await send({"type": "http.response.start", "status": 200,
                    "headers": [(b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})
    return inner


def test_a_large_body_is_sent_in_pieces_that_add_up_to_it():
    body = bytes(range(256)) * 1000  # 256 KB
    sent = _run(_responding_with(body))

    pieces = [m for m in sent if m["type"] == "http.response.body"]
    assert len(pieces) == 4
    assert all(len(p["body"]) <= 64 * 1024 for p in pieces)
    assert [p["more_body"] for p in pieces] == [True, True, True, False]
    assert b"".join(p["body"] for p in pieces) == body
    # The headers, Content-Length included, are passed on untouched.
    assert sent[0]["headers"] == [(b"content-length", str(len(body)).encode())]


def test_a_small_body_is_passed_on_as_it_was():
    sent = _run(_responding_with(b"{}"))
    assert sent[1] == {"type": "http.response.body", "body": b"{}"}


def test_the_app_still_answers_large_reads_in_full():
    client = TestClient(app)
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    assert len(response.content) > 64 * 1024
    assert response.json()["info"]["title"]
