"""A check that BLOCKS: it reads the tool registry and the policy and exits with code 1 if a governance rule is broken.

Run in CI on every change to tools, the registry or the policy:  python check_governance.py
It enforces rules that a prompt can only ask for:
  G1 every tool that changes data is approval_required in the registry
  G2 production must not allow writes, and must require approval for approval_required tools
  G3 the agent's own identity is never a named production approver
  G4 credentials live at most MAX_CREDENTIAL_MINUTES minutes
  G5 the registry itself passes its own checks
"""
import sys

import policy
from registry import check_registry, from_tools
from tools import make_registry
from checkpoint import RunStore

AGENT_IDENTITY = "agent-dataops"
PERMISSIONS = {"get_run_log": "read", "search_runbook": "read", "rerun_job": "approval_required", "quarantine_files": "approval_required"}
DATA = {"get_run_log": ["operational"], "search_runbook": ["operational"], "rerun_job": ["operational"], "quarantine_files": ["operational"]}


def check(permissions=PERMISSIONS, pol=None, approvers=None, minutes=None):
    pol = pol or policy.POLICY
    approvers = policy.NAMED_APPROVERS if approvers is None else approvers
    tools = make_registry("CI", RunStore(), {"reruns": [], "quarantined": []})
    findings = []
    for name, t in tools.items():
        if t.writes and permissions.get(name) != "approval_required":
            findings.append(f"G1: {name} changes data but is marked {permissions.get(name)!r}, not approval_required")
    if pol["prod"]["write"] != "deny":
        findings.append("G2: production allows writes")
    if pol["prod"]["approval_required"] != "approve":
        findings.append("G2: production does not require approval for approval_required tools")
    if AGENT_IDENTITY in approvers:
        findings.append("G3: the agent's own identity is a named production approver")
    if (minutes if minutes is not None else policy.MAX_CREDENTIAL_MINUTES) > 60:
        findings.append("G4: credentials may live longer than 60 minutes")
    entries = from_tools(tools, "platform-team@example.com", permissions, DATA)
    findings += [f"G5: {x}" for x in check_registry(entries, set(tools))]
    return findings


if __name__ == "__main__":
    problems = check()
    for p in problems:
        print("BLOCKED:", p)
    print("RESULT:", "blocked" if problems else "pass")
    sys.exit(1 if problems else 0)
