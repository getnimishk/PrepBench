"""A small local API that misbehaves on purpose, so retries can be tested without hammering a real service."""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

seen = {}                  # item id -> how many times it was requested
in_flight = 0
lock = threading.Lock()
MAX_IN_FLIGHT = 5


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global in_flight
        item = int(self.path.rsplit("/", 1)[-1])
        with lock:
            seen[item] = seen.get(item, 0) + 1
            attempt = seen[item]
            in_flight += 1
            over = in_flight > MAX_IN_FLIGHT
        try:
            time.sleep(0.15)
            if over:
                return self.reply(429, {"error": "too many at once"}, {"Retry-After": "1"})
            if item % 4 == 0 and attempt == 1:
                return self.reply(500, {"error": "temporary failure"})
            return self.reply(200, {"item": item, "attempt": attempt})
        finally:
            with lock:
                in_flight -= 1

    def reply(self, status, body, headers=None):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("listening on http://127.0.0.1:8765")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
