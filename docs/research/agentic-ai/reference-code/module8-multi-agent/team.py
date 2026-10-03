"""Three roles with different powers, so no single agent can both decide and do.

  diagnoser : read-only. Produces a Proposal (an action, a target, evidence).
  reviewer  : checks the proposal against the runbook and approves or rejects. Cannot execute.
  executor  : the only role with a write tool, and it runs ONLY a proposal that carries a reviewer's approval
              for exactly that content (a hash). A proposal edited after approval is refused.

The roles here are plain functions so the control logic can be tested without a model. In the lab each role is a model call with its own prompt and tool list.
"""
import hashlib
import json

from pydantic import BaseModel


class Proposal(BaseModel):
    action: str            # 'rerun_job'
    target: str            # 'customers'
    reason: str
    evidence: list[str]    # the log lines or runbook entries the diagnoser relied on

    def digest(self) -> str:
        return hashlib.sha256(json.dumps(self.model_dump(), sort_keys=True).encode()).hexdigest()[:12]


RUNBOOK_ALLOWS = {"ERR-5102": "rerun_job"}          # which error code justifies which action


def diagnoser(log_line: str) -> Proposal | None:
    code = next((c for c in RUNBOOK_ALLOWS if c in log_line), None)
    if code is None:
        return None
    return Proposal(action=RUNBOOK_ALLOWS[code], target=log_line.split()[0], reason=f"{code} in the latest run", evidence=[log_line])


def reviewer(p: Proposal) -> dict | None:
    """Approve only if the evidence contains an error code whose runbook entry names this action. Returns a signed approval or None."""
    justified = any(RUNBOOK_ALLOWS.get(code) == p.action for code in RUNBOOK_ALLOWS if any(code in e for e in p.evidence))
    return {"digest": p.digest(), "by": "reviewer-agent"} if justified else None


def executor(p: Proposal, approval: dict | None, world: dict) -> str:
    if approval is None:
        return "refused: no approval"
    if approval["digest"] != p.digest():
        return "refused: the proposal changed after it was approved"
    world.setdefault("done", []).append((p.action, p.target))
    return f"executed {p.action} on {p.target} (approved by {approval['by']})"


def run_team(log_line: str, world: dict, tamper=None) -> str:
    p = diagnoser(log_line)
    if p is None:
        return "no proposal: nothing in the log matches a runbook entry"
    approval = reviewer(p)
    if tamper:
        p = tamper(p)
    return executor(p, approval, world)
