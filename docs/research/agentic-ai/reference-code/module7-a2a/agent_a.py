"""Agent A: a small A2A client that delegates a task to another agent over JSON-RPC, using plain httpx.

It discovers the agent from its Agent Card, sends the A2A-Version header on every request, and turns every kind of
failure (unreachable, HTTP error, JSON-RPC error, failed task) into a result the caller can act on instead of an exception.
"""
import json
import uuid

import httpx

VERSION = "1.0"


def delegate(base_url: str, text: str, timeout: float = 5.0) -> dict:
    headers = {"A2A-Version": VERSION, "content-type": "application/json"}
    try:
        with httpx.Client(timeout=timeout) as http:
            card = http.get(f"{base_url}/.well-known/agent-card.json", headers={"A2A-Version": VERSION})
            card.raise_for_status()
            card = card.json()
            iface = next((i for i in card["supportedInterfaces"] if i["protocolBinding"] == "JSONRPC"), None)
            if iface is None:
                return {"ok": False, "reason": "no JSON-RPC interface in the Agent Card", "agent": card.get("name")}
            body = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": "SendMessage",
                    "params": {"message": {"messageId": str(uuid.uuid4()), "role": "ROLE_USER", "parts": [{"text": text}]}}}
            resp = http.post(iface["url"], headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
        return {"ok": False, "reason": f"agent unreachable: {type(e).__name__}", "retryable": True}
    except httpx.HTTPStatusError as e:
        return {"ok": False, "reason": f"HTTP {e.response.status_code}", "retryable": e.response.status_code >= 500}
    if "error" in data:
        return {"ok": False, "reason": f"JSON-RPC error {data['error']['code']}: {data['error']['message']}", "retryable": False}
    task = data["result"].get("task")
    if task is None:                      # the agent answered with a plain Message instead of a Task
        return {"ok": True, "agent": card["name"], "message": data["result"].get("message")}
    state = task["status"]["state"]
    if state == "TASK_STATE_COMPLETED":
        parts = [p.get("text", "") for a in task.get("artifacts", []) for p in a.get("parts", [])]
        return {"ok": True, "agent": card["name"], "task_id": task["id"], "state": state, "text": " ".join(parts)}
    note = (task["status"].get("message") or {}).get("parts", [{}])[0].get("text", "")
    return {"ok": False, "agent": card["name"], "task_id": task["id"], "state": state, "reason": note, "retryable": False}


if __name__ == "__main__":
    for label, url, q in [("answerable", "http://127.0.0.1:9101", "What does ERR-4417 mean?"),
                          ("no such entry", "http://127.0.0.1:9101", "What does ERR-9999 mean?"),
                          ("agent down", "http://127.0.0.1:9199", "What does ERR-4417 mean?")]:
        print(f"{label:14}", json.dumps(delegate(url, q), ensure_ascii=False))
