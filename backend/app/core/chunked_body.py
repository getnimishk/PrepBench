# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Large response bodies, sent in pieces.

A large JSON response could stop a few kilobytes short of its Content-Length and
never finish: the screen stayed on its loading state with no error. Phase 17 met
it through the Vite proxy -- the validation report for a 2,000-row import
(1.9 MB), a 500-question page (370 KB) -- and splitting bodies into 64 KB
messages made it rarer.

The cause, measured later against this server directly with two different
clients: the request asked for "Connection: close", so the server closed the
socket as soon as the response was written, and on Windows a response closed
that way while the reader was momentarily not reading (a proxy pauses whenever
its own client is slower) can lose its tail and the close with it. 330 KB read
slowly: 48 of 100 stalled as one message, about one in ten in 64 KB pieces, and
none with a kept-alive connection. Vite's proxy asked for close on every request
because it had no agent; it now keeps connections alive (frontend/vite.config.ts),
which is the fix.

This stays for any other client that asks to close. The headers, including
Content-Length, are untouched, and a client that reads the whole response
receives exactly the same bytes.
"""
from typing import Awaitable, Callable, MutableMapping, Any

Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[MutableMapping[str, Any], Receive, Send], Awaitable[None]]

CHUNK_BYTES = 64 * 1024


class ChunkedBodyMiddleware:
    def __init__(self, app: ASGIApp, chunk_bytes: int = CHUNK_BYTES):
        self.app = app
        self.chunk_bytes = chunk_bytes

    async def __call__(self, scope: MutableMapping[str, Any], receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        size = self.chunk_bytes

        async def send_in_pieces(message: Message) -> None:
            body = message.get("body", b"") if message["type"] == "http.response.body" else b""
            if len(body) <= size:
                await send(message)
                return
            more_after = message.get("more_body", False)
            for start in range(0, len(body), size):
                last = start + size >= len(body)
                await send({
                    "type": "http.response.body",
                    "body": body[start:start + size],
                    "more_body": more_after or not last,
                })

        await self.app(scope, receive, send_in_pieces)
