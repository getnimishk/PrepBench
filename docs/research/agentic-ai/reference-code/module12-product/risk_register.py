"""An agent risk register as data, with checks: at least six agent-specific risks, each with an owner, a trigger and a mitigation that exists in code or process.

Likelihood and impact are 1 to 5; score = likelihood x impact. These ratings are judgements and are re-rated after incidents and evaluations.
Categories are the ones this course's lessons built controls for. Fictional ratings and owners.
"""
from typing import Literal

from pydantic import BaseModel, Field

AGENT_SPECIFIC = {"prompt_injection", "excessive_agency", "data_leakage", "wrong_answer", "provider_outage", "model_retirement", "cost_overrun", "vendor_lock_in", "approval_fatigue"}


class Risk(BaseModel):
    id: str
    category: str
    description: str
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    owner: str
    trigger: str                      # the observable sign that it is happening
    mitigation: str                   # what is already in place
    evidence: str                     # where we show it works (a test, a drill, a log)
    status: Literal["open", "mitigated", "accepted"] = "open"

    @property
    def score(self) -> int:
        return self.likelihood * self.impact


def validate(risks: list[Risk]) -> list[str]:
    f = []
    agent = [r for r in risks if r.category in AGENT_SPECIFIC]
    if len({r.category for r in agent}) < 6:
        f.append("need at least 6 different agent-specific risk categories")
    for r in risks:
        if "@" not in r.owner and not r.owner.islower():
            f.append(f"{r.id}: owner should be a named role or person")
        if r.score >= 15 and r.status == "open" and not r.evidence:
            f.append(f"{r.id}: a high risk needs evidence that the mitigation works")
        if not r.trigger:
            f.append(f"{r.id}: say what you would observe if it were happening")
    return f


REGISTER = [
    Risk(id="R1", category="prompt_injection", description="Untrusted ticket, log or document text steers the agent into an unauthorised action",
         likelihood=4, impact=4, owner="security lead", trigger="a run requests a tool it was not offered, or an approval is denied", status="mitigated",
         mitigation="tier-limited tools, schemas that forbid extra arguments, approval gate", evidence="eval cases C23 and C24; demo_inject.py"),
    Risk(id="R2", category="excessive_agency", description="A write tool is added or loosened and the agent can change production without approval",
         likelihood=3, impact=5, owner="engineering manager", trigger="governance check fails in CI", status="mitigated",
         mitigation="registry permission levels, policy as data, G1 to G5 check blocks the merge", evidence="check_governance.py and 4 blocked bad changes"),
    Risk(id="R3", category="data_leakage", description="Restricted text reaches a user, a log or a trace they should not see",
         likelihood=3, impact=5, owner="data owner", trigger="a two-user access test fails, or content appears in traces", status="open",
         mitigation="access filter before ranking, sizes-and-hashes tracing, retention limits", evidence="two-user test in the RAG build; trace policy"),
    Risk(id="R4", category="wrong_answer", description="A confident wrong diagnosis is accepted and acted on",
         likelihood=4, impact=3, owner="product owner", trigger="accepted-without-edit rate falls or must-pass case fails", status="open",
         mitigation="citations, abstention, evaluation gate with must-pass cases, approval for writes", evidence="25-case evaluation, pass^5"),
    Risk(id="R5", category="provider_outage", description="The model provider is down or rate-limits during a failure window",
         likelihood=3, impact=3, owner="platform on-call", trigger="breaker opens or queue age exceeds 5 minutes", status="mitigated",
         mitigation="queue, breaker, idempotency keys, degrade to log-only then to a person", evidence="outage.py simulation, runbook drill"),
    Risk(id="R6", category="model_retirement", description="The model version in use is retired or its behaviour changes",
         likelihood=4, impact=3, owner="engineering manager", trigger="vendor deprecation notice, or evaluation pass rate drops after an unannounced change", status="open",
         mitigation="evaluation set and gate, abstraction over the model client, quarterly deprecation check", evidence="evaluation rerun on a second model"),
    Risk(id="R7", category="cost_overrun", description="Tokens per task grow (big tool results, loops) and the run cost passes the budget",
         likelihood=3, impact=2, owner="program manager", trigger="cost per successful task above plan for a week", status="mitigated",
         mitigation="turn and token limits, trace review, budget alerts", evidence="trace before/after (lesson 47)"),
]
