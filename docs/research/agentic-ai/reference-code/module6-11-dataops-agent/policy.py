"""What the agent may do in each environment, who must approve, and the separation-of-duties and credential rules, as data plus one function.

POLICY maps (environment, permission level) to one of: allow, approve, deny.
  dev      : anything is allowed (the world is a sandbox), but approval_required actions are still logged
  staging  : changes need an approver from the team
  production: write is denied outright; approval_required needs a NAMED approver who is not the requester and not the agent itself
"""
import time

POLICY = {
    "dev": {"read": "allow", "write": "allow", "approval_required": "allow"},
    "staging": {"read": "allow", "write": "approve", "approval_required": "approve"},
    "prod": {"read": "allow", "write": "deny", "approval_required": "approve"},
}
NAMED_APPROVERS = {"sam.reviewer", "priya.owner"}          # production approvers; a named list, reviewed like code
MAX_CREDENTIAL_MINUTES = 60


class Credential:
    """A short-lived credential issued to the agent for one run. It stops working by itself."""
    def __init__(self, identity: str, issued: float, minutes: int = 15):
        if minutes > MAX_CREDENTIAL_MINUTES:
            raise ValueError(f"credentials may live at most {MAX_CREDENTIAL_MINUTES} minutes")
        self.identity, self.expires = identity, issued + minutes * 60

    def valid(self, now: float | None = None) -> bool:
        return (now if now is not None else time.time()) < self.expires


def decide(env: str, permission: str, *, requester: str, agent: str, approver: str | None = None, credential: Credential | None = None, now=None):
    """Returns (allowed, reason). The agent's own identity can never approve; the requester can never approve their own request."""
    if credential is None or not credential.valid(now) or credential.identity != agent:
        return False, "no valid credential for this agent identity"
    rule = POLICY[env][permission]
    if rule == "deny":
        return False, f"{permission} is not allowed in {env}"
    if rule == "allow":
        return True, "allowed"
    if approver is None:
        return False, "needs an approver"
    if approver == agent:
        return False, "the agent cannot approve its own action"
    if approver == requester:
        return False, "the requester cannot approve their own request"
    if env == "prod" and approver not in NAMED_APPROVERS:
        return False, f"{approver} is not a named production approver"
    return True, f"approved by {approver}"
