"""Launch metrics as validated data: three launch metrics and one guardrail, each with formula, source, baseline, target, cadence and the decision it triggers.

Mapped to Google's HEART dimensions (Happiness, Engagement, Adoption, Retention, Task success) through the Goals-Signals-Metrics idea:
a goal, the user behaviour that signals it, and the number that measures the signal. Example values are fictional (DataOps agent).
"""
import re
from typing import Literal

from pydantic import BaseModel, Field

HEART = ("happiness", "engagement", "adoption", "retention", "task_success")


class Metric(BaseModel):
    name: str
    kind: Literal["launch", "guardrail"]
    heart: Literal["happiness", "engagement", "adoption", "retention", "task_success", "none"] = "none"
    goal: str
    signal: str
    formula: str
    data_source: str
    baseline: float
    target: float
    higher_is_better: bool = True
    cadence: Literal["daily", "weekly", "monthly"]
    decision: str = Field(description="what we do when the target is met or missed, with a threshold")


def validate(metrics: list[Metric]) -> list[str]:
    f = []
    launch = [m for m in metrics if m.kind == "launch"]
    guard = [m for m in metrics if m.kind == "guardrail"]
    if len(launch) != 3:
        f.append(f"need exactly 3 launch metrics, found {len(launch)}")
    if len(guard) != 1:
        f.append(f"need exactly 1 guardrail metric, found {len(guard)}")
    for m in metrics:
        if m.baseline == m.target:
            f.append(f"{m.name}: target equals baseline, so nothing can be learned")
        better = m.target > m.baseline if m.higher_is_better else m.target < m.baseline
        if m.kind == "launch" and not better:
            f.append(f"{m.name}: target is not an improvement on the baseline")
        if not re.search(r"[<>]=?|\bat least\b|\bbelow\b|\babove\b", m.decision):
            f.append(f"{m.name}: the decision must state a threshold (for example 'below 70 percent for two weeks')")
        if "/" not in m.formula and "count" not in m.formula.lower() and "median" not in m.formula.lower():
            f.append(f"{m.name}: write the formula so someone else can compute it")
        if m.kind == "launch" and m.heart == "none":
            f.append(f"{m.name}: map it to a HEART dimension")
    return f


EXAMPLE = [
    Metric(name="Weekly active users of the agent", kind="launch", heart="adoption", goal="Platform engineers actually use it",
           signal="a person starts a triage with the agent", formula="distinct users with at least 1 agent session in the week / engineers on call roster",
           data_source="agent audit log joined to the on-call roster", baseline=0.0, target=0.6, cadence="weekly",
           decision="If below 0.3 after week 4, stop feature work and interview non-users; if at least 0.6 for 3 weeks, expand to the next team"),
    Metric(name="Diagnoses accepted without edit", kind="launch", heart="task_success", goal="The diagnosis is useful",
           signal="the person keeps the agent's diagnosis in the ticket", formula="diagnoses kept unchanged / diagnoses shown",
           data_source="ticket system revision history", baseline=0.0, target=0.7, cadence="weekly",
           decision="If below 0.5 for two weeks, review the 20 most-edited diagnoses and add them to the evaluation set"),
    Metric(name="Median minutes from ticket to diagnosis", kind="launch", heart="engagement", goal="Faster handling of failed loads",
           signal="time between ticket creation and first accepted diagnosis", formula="median(minutes from ticket created to diagnosis accepted)",
           data_source="ticket timestamps", baseline=38, target=15, higher_is_better=False, cadence="weekly",
           decision="If above 25 after week 6, check whether the agent or the queue is the delay before changing anything"),
    Metric(name="Unsafe action attempts reaching the gate", kind="guardrail", goal="The agent stays inside its limits",
           signal="a write request the policy or the approver denies", formula="count of denied or blocked write requests / write requests",
           data_source="approval gate audit log", baseline=0.0, target=0.02, higher_is_better=False, cadence="daily",
           decision="If above 0.05 on any day, pause write proposals and open an incident (lesson 67)"),
]
