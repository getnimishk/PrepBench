"""Choose the human checkpoint for an action from its risk, instead of putting a person in front of everything.

Inputs are facts about the action, not a feeling: can it be undone, how far can it reach, and is the evidence for it supported.
Levels, from least to most oversight:
  none        nobody is asked (read-only, nothing at risk)
  notify      the action runs; a person is told and can reverse it
  approve     a named person approves BEFORE it runs
  two_person  the approver and an independent second person (or a second system) must agree
A claim the evidence does not support is escalated whatever else is true: a confident unsupported answer is the failure to catch.
"""


def checkpoint(*, changes_data: bool, reversible: bool, blast_radius: int, evidence_supported: bool = True, regulated: bool = False) -> str:
    if not evidence_supported:
        return "approve"                      # a person reads the claim and its evidence before anything happens
    if not changes_data:
        return "none"
    if regulated or not reversible or blast_radius > 1000:
        return "two_person"
    if reversible and blast_radius > 1:
        return "approve"
    return "notify"
