import metrics_spec
import rice
import risk_register
import roi
import scorecard


def test_rice_ranking_and_formula():
    assert rice.score(400, 2, 0.8, 2) == 320
    assert rice.rank()[0][0] == "Auto-diagnose late-file failures"


def test_rice_winner_is_not_certain_under_nudged_inputs():
    s = rice.stability(runs=2000)
    top = max(s.values())
    assert 30 < top < 90                      # a clear favourite, but not a sure thing


def test_roi_arithmetic_for_the_most_likely_month():
    n, b, c = roi.net(roi.likely())
    assert round(b) == 59400 and round(c) == 12453 and round(n) == 46947


def test_roi_range_and_what_matters_most():
    s = roi.simulate(runs=3000)
    lo, mid, hi = s["net_10_50_90"]
    assert lo < mid < hi
    base, rows = roi.tornado()
    assert rows[0][0] == "minutes_saved_per_success"          # the benefit assumption, not the model price, dominates
    assert rows[-1][0] == "model_cost_per_task"


def test_scorecard_totals_and_a_near_tie_is_visible():
    t = scorecard.totals()
    assert abs(t["Build on our own framework and stack"] - 3.8) < 0.01
    s = scorecard.stability(runs=3000)
    assert s["Buy a ready-made agent product"] == 0.0 and 20 < s["Extend a managed platform (prompt/hosted agent)"] < 80


def test_recommendation_needs_evidence_and_a_complete_exit_plan():
    assert scorecard.check_recommendation({}) == ["missing evidence", "missing exit plan"]
    assert scorecard.check_recommendation({"evidence": "x", "exit plan": "if the vendor fails we ..."}) == ["exit plan must cover both a vendor failing and a model being retired"]
    assert scorecard.check_recommendation({"evidence": "x", "exit plan": "If the vendor fails ... if a model retired ..."}) == []


def test_example_metrics_pass_and_bad_ones_are_caught():
    assert metrics_spec.validate(metrics_spec.EXAMPLE) == []
    bad = metrics_spec.EXAMPLE[0].model_copy(update={"target": 0.0, "decision": "keep an eye on it", "formula": "vibes", "heart": "none"})
    problems = " | ".join(metrics_spec.validate([bad] + metrics_spec.EXAMPLE[1:]))
    for needle in ("equals baseline", "not an improvement", "threshold", "formula", "HEART"):
        assert needle in problems


def test_the_register_has_six_agent_specific_risks_with_owners_and_a_high_risk_has_evidence():
    assert risk_register.validate(risk_register.REGISTER) == []
    assert len({r.category for r in risk_register.REGISTER}) >= 6
    thin = risk_register.REGISTER[0].model_copy(update={"evidence": "", "status": "open", "trigger": ""})
    problems = " | ".join(risk_register.validate([thin] + risk_register.REGISTER[1:]))
    assert "needs evidence" in problems and "what you would observe" in problems
