import cost
import outage


def test_naive_client_loses_tasks_sends_about_twice_the_calls_and_can_duplicate():
    r = outage.naive(3)
    assert r["lost"] > 100 and r["provider_calls"] > 1000 and r["duplicated"] >= 1


def test_robust_client_loses_nothing_duplicates_nothing_and_stays_under_the_providers_capacity():
    r = outage.robust(3)
    assert r["lost"] == 0 and r["still_queued"] == 0 and r["duplicated"] == 0
    assert r["completed"] == 600 and r["provider_calls"] < 700
    assert r["peak_queue"] > 100                      # the cost of safety: a backlog, and late answers
    assert r["late"] > 0


def test_results_hold_across_seeds():
    for seed in (1, 2, 4):
        r = outage.robust(seed)
        assert r["lost"] == 0 and r["duplicated"] == 0


def test_cheaper_design_has_lower_model_cost_but_needs_a_success_rate_near_the_dearer_one_to_win_overall():
    a = cost.simulate("A", days=2)
    b = cost.simulate("B", days=2)
    assert b["daily_model"][1] < a["daily_model"][1]
    assert b["total_per_success"][1] > a["total_per_success"][1]       # at the assumed success rates
    target, p = cost.break_even()
    assert 0.92 < p <= 0.94


def test_people_cost_dominates_model_cost():
    a = cost.simulate("A", days=2)
    assert a["total_per_success"][1] > 50 * a["model_per_success"][1]
