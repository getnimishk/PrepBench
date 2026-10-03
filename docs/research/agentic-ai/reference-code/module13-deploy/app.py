"""A minimal deployable agent service: authentication, per-user and global cost limits, a kill switch, and logging with no content.

It wraps a stand-in agent function so the controls can be tested without a model. In your deployment the stand-in becomes your agent.
Run:  uvicorn app:app --port 9300        Environment: AGENT_TOKENS="alice:tok-a,bob:tok-b"  AGENT_DAILY_CAP_USD=2.0  AGENT_KILL=0
Controls (each is a place where a deployed agent usually fails):
  auth       a bearer token per user, compared in constant time; no token, no run
  cost       a per-user and a global daily cap checked BEFORE the run, using an estimate, and recorded AFTER with the actual cost
  kill       AGENT_KILL=1 stops every run immediately (a rollback lever that needs no redeploy)
  logging    one JSON line per request: user, route, status, cost, duration, run id. Never the prompt, the answer or the token.
  health     /health answers without auth for the platform's probe and says nothing about users
"""
import hmac
import json
import os
import time
import uuid

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

LOG = []                    # in production: stdout or a log service. Content is never written here.
SPEND = {"global": 0.0}


def config():
    tokens = dict(p.split(":", 1)[::-1] for p in os.environ.get("AGENT_TOKENS", "").split(",") if ":" in p)   # token -> user
    return dict(tokens=tokens, cap=float(os.environ.get("AGENT_DAILY_CAP_USD", "1.0")), kill=os.environ.get("AGENT_KILL", "0") == "1", est=0.02)


def stand_in_agent(text: str) -> tuple[str, float]:
    return f"diagnosis for: {text[:40]}", 0.013            # (answer, actual cost in USD)


def log(**kw):
    LOG.append({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), **kw})


async def health(request):
    return JSONResponse({"ok": True})


async def triage(request: Request):
    cfg, run_id, t0 = config(), uuid.uuid4().hex[:8], time.perf_counter()
    if cfg["kill"]:
        log(run=run_id, route="triage", status=503, reason="kill switch")
        return JSONResponse({"error": "temporarily disabled"}, status_code=503)
    auth = request.headers.get("authorization", "")
    user = next((u for t, u in cfg["tokens"].items() if hmac.compare_digest(auth.removeprefix("Bearer ").encode(), t.encode())), None)
    if user is None:
        log(run=run_id, route="triage", status=401)
        return JSONResponse({"error": "unauthorised"}, status_code=401)
    if SPEND.get(user, 0.0) + cfg["est"] > cfg["cap"] or SPEND["global"] + cfg["est"] > cfg["cap"] * 10:
        log(run=run_id, user=user, route="triage", status=429, reason="cost cap")
        return JSONResponse({"error": "daily cost cap reached"}, status_code=429)
    body = await request.json()
    answer, cost = stand_in_agent(str(body.get("text", "")))
    SPEND[user] = SPEND.get(user, 0.0) + cost
    SPEND["global"] += cost
    log(run=run_id, user=user, route="triage", status=200, cost_usd=cost, ms=round((time.perf_counter() - t0) * 1000, 2))
    return JSONResponse({"run": run_id, "answer": answer})


app = Starlette(routes=[Route("/health", health), Route("/triage", triage, methods=["POST"])])
