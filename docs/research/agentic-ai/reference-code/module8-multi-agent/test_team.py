from team import Proposal, diagnoser, executor, reviewer, run_team

LATE = "customers FAILED ERR-5102 file arrived 06:42 UTC"
QUOTA = "refunds FAILED ERR-6001 warehouse quota exceeded"


def test_justified_proposal_is_executed():
    world = {}
    assert run_team(LATE, world).startswith("executed rerun_job on customers")
    assert world["done"] == [("rerun_job", "customers")]


def test_no_runbook_match_means_no_proposal():
    world = {}
    assert run_team(QUOTA, world).startswith("no proposal") and world == {}


def test_executor_refuses_without_approval():
    p = diagnoser(LATE)
    assert executor(p, None, {}) == "refused: no approval"


def test_reviewer_rejects_an_unjustified_action():
    p = Proposal(action="rerun_job", target="refunds", reason="try it", evidence=[QUOTA])
    assert reviewer(p) is None


def test_a_proposal_edited_after_approval_is_refused():
    world = {}
    out = run_team(LATE, world, tamper=lambda p: p.model_copy(update={"target": "payments"}))
    assert out == "refused: the proposal changed after it was approved" and world == {}
