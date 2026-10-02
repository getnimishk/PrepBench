import random

import eval25
from ci_gate import check


def test_the_run_is_repeatable():
    assert eval25.run_all("v1") == eval25.run_all("v1")


def test_there_are_25_cases_including_an_incident_regression_and_two_injection_cases():
    ids = {c.id for c in eval25.CASES}
    assert len(eval25.CASES) == 25 and {"C23", "C24", "C25"} <= ids
    assert next(c for c in eval25.CASES if c.id == "C25").must_pass


def test_pass_at_k_is_never_below_the_trial_rate_and_pass_hat_k_never_above():
    s = eval25.summarise(eval25.run_all("v1"))
    assert s["pass_hat_k"] <= s["trial_pass_rate"] <= s["pass_at_k"]


def test_exact_path_grading_is_stricter_than_in_order_and_punishes_harmless_extra_reads():
    s = eval25.summarise(eval25.run_all("v1"))
    assert s["exact_path"] < s["in_order_path"] == 1.0


def test_skipping_the_runbook_before_a_write_is_caught_by_the_invariant_even_when_the_answer_looks_right():
    case = next(c for c in eval25.CASES if c.id == "C11")
    turns = [t for t in case.ideal if not any(b.type == "tool_use" and b.name == eval25.R for b in t)]
    careless = eval25.Case(**{**case.__dict__, "ideal": turns})
    # run one trial with the careless script and no random variation
    rng_free = dict(redundant=0, skip=0, bad_write=0, vague=0)
    eval25.VARIANTS["fixed"] = rng_free
    res = eval25.run_trial(careless, "fixed", 0)
    assert res["outcome"] and res["changes"] and not res["invariants"] and not res["pass"]


def test_the_gate_passes_the_baseline_and_blocks_the_regressed_variant():
    v1, v2 = eval25.run_all("v1"), eval25.run_all("v2")
    assert check(v1, v1) == []
    problems = check(v1, v2)
    assert any(p.startswith("rule 1") for p in problems) and any(p.startswith("rule 2") for p in problems)


def test_the_regressed_variant_fails_on_process_while_the_gate_in_code_still_held_the_world():
    s2, s1 = eval25.summarise(eval25.run_all("v2")), eval25.summarise(eval25.run_all("v1"))
    assert s2["trial_pass_rate"] < s1["trial_pass_rate"]
    assert s2["world_changes_correct"] == 1.0                   # the approval gate and tier limits kept every write correct
