# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The readiness rule, tested at every boundary.

This is the product's single output. If it says READY and the exam is
failed, the app has cost the candidate the fee and their confidence, so
these tests are about what the rule refuses to claim as much as what it
claims.
"""
from datetime import datetime, timedelta, UTC

from app.services.readiness import (
    DOMAIN_FLOOR_PCT,
    DomainState,
    MockResult,
    ReadinessState,
    RECENCY_DAYS,
    compute,
)

PASS = 85.0


def _now():
    return datetime.now(UTC).replace(tzinfo=None)


def _mock(score, days_ago=0, domains=None, sid=1):
    """A mock whose domains all sit comfortably above the floor unless stated."""
    return MockResult(
        session_id=sid,
        score_pct=score,
        taken_at=_now() - timedelta(days=days_ago),
        domain_counts=domains if domains is not None else {"Framework": (18, 20)},
    )


def _series(scores, domains=None):
    """Consecutive mocks, one per day, oldest first."""
    n = len(scores)
    return [
        _mock(s, days_ago=(n - i - 1), domains=domains, sid=i + 1)
        for i, s in enumerate(scores)
    ]


# ---- nothing to judge -------------------------------------------------


def test_no_mocks_is_needs_evaluation_not_zero():
    """Zero mocks is an absence of evidence, not a failing score. A drill,
    however many were done, never reaches this function."""
    r = compute([], pass_mark=PASS)
    assert r.state is ReadinessState.NEEDS_EVALUATION
    assert r.mock_count == 0
    assert r.recent_scores == []
    assert r.mocks_to_pass_estimate is None


# ---- ready ------------------------------------------------------------


def test_three_consecutive_passes_with_solid_domains_is_ready():
    r = compute(_series([86, 87, 88]), pass_mark=PASS)
    assert r.state is ReadinessState.READY
    assert r.recent_scores == [86.0, 87.0, 88.0]


def test_two_passes_is_not_enough():
    """One good mock is luck. The rule wants a pattern."""
    r = compute(_series([88, 90]), pass_mark=PASS)
    assert r.state is not ReadinessState.READY


def test_a_dip_inside_the_last_three_blocks_ready():
    """Consecutive, not averaged: 90-80-90 averages above the pass mark and
    is still not ready, because the 80 says the knowledge is not stable."""
    r = compute(_series([90, 80, 90]), pass_mark=PASS)
    assert r.state is not ReadinessState.READY


def test_a_weak_domain_blocks_ready_even_when_every_mock_passed():
    """Exams sample across all domains. An overall pass carried by one strong
    area is exactly the candidate who fails on the day."""
    weak = {"Framework": (19, 20), "Events": (10, 20)}  # 50% on Events
    r = compute(_series([88, 89, 90], domains=weak), pass_mark=PASS)

    assert r.state is not ReadinessState.READY
    assert r.weakest_domain == "Events"
    events = next(d for d in r.domains if d.domain == "Events")
    assert events.state is DomainState.NEEDS_WORK
    assert events.score_pct < DOMAIN_FLOOR_PCT


def test_stale_evidence_blocks_ready():
    """Someone who passed three mocks and then vanished for two months is not
    demonstrably ready today."""
    old = RECENCY_DAYS + 10
    r = compute(
        [_mock(88, old + 2, sid=1), _mock(89, old + 1, sid=2), _mock(90, old, sid=3)],
        pass_mark=PASS,
    )
    assert r.state is not ReadinessState.READY
    assert r.is_stale is True


# ---- plateau ----------------------------------------------------------


def test_four_flat_mocks_at_the_line_is_a_plateau():
    """The state that stops someone practising forever at the pass mark."""
    r = compute(_series([85, 84, 86, 85]), pass_mark=PASS)
    assert r.state is ReadinessState.PLATEAU


def test_plateau_is_checked_before_almost_there():
    """A plateau at the line also satisfies 'almost'. The plateau is the more
    useful thing to say, so it must win."""
    r = compute(_series([84, 84, 85, 84]), pass_mark=PASS)
    assert r.state is ReadinessState.PLATEAU


def test_a_rising_series_is_not_a_plateau():
    r = compute(_series([79, 82, 84, 87]), pass_mark=PASS)
    assert r.state is not ReadinessState.PLATEAU


# ---- almost there and the forecast ------------------------------------


def test_close_to_the_line_is_almost_there_with_a_forecast():
    r = compute(_series([79, 82, 84]), pass_mark=PASS)
    assert r.state is ReadinessState.ALMOST_THERE
    assert r.points_per_mock is not None and r.points_per_mock > 0
    # The forecast that replaces a countdown: a finite number of mocks, not a date.
    assert r.mocks_to_pass_estimate is not None and r.mocks_to_pass_estimate >= 1


def test_a_long_way_off_is_developing():
    r = compute(_series([40, 45, 48]), pass_mark=PASS)
    assert r.state is ReadinessState.DEVELOPING


def test_a_flat_series_gets_no_forecast():
    """No trend means no honest estimate. None, not an invented number."""
    r = compute(_series([60, 60, 60]), pass_mark=PASS)
    assert r.mocks_to_pass_estimate is None


# ---- subjects with no exam --------------------------------------------


def test_a_subject_without_a_pass_mark_is_never_ready():
    """There is nothing to be ready against, so claiming readiness would be
    inventing a bar that does not exist."""
    r = compute(_series([95, 96, 97]), pass_mark=None, has_exam_profile=False)
    assert r.state is ReadinessState.DEVELOPING
    assert r.pass_mark is None


def test_a_subject_with_no_exam_profile_is_never_ready_even_with_a_pass_mark():
    r = compute(_series([95, 96, 97]), pass_mark=PASS, has_exam_profile=False)
    assert r.state is not ReadinessState.READY


# ---- domain reporting honesty -----------------------------------------


def test_a_thinly_sampled_domain_reports_no_score_rather_than_a_bad_one():
    """Nine questions is too few to judge. It is not a 33%.

    Note the pooling: 3 questions in each of 3 mocks is 9, still under the
    threshold. Had it been 6 per mock it would pool to 18 and a score would
    be reported -- the threshold is about total evidence, not per sitting.
    """
    thin = {"Framework": (18, 20), "Empiricism": (1, 3)}
    r = compute(_series([88, 89, 90], domains=thin), pass_mark=PASS)

    empiricism = next(d for d in r.domains if d.domain == "Empiricism")
    assert empiricism.state is DomainState.NEEDS_EVALUATION
    assert empiricism.score_pct is None
    assert empiricism.answered == 9  # pooled across the three mocks considered


def test_an_unjudgeable_domain_does_not_block_ready():
    """A domain with too little data is unknown, not failing. Blocking on it
    would make readiness unreachable for any subject with a rare domain."""
    thin = {"Framework": (19, 20), "Empiricism": (1, 2)}
    r = compute(_series([88, 89, 90], domains=thin), pass_mark=PASS)
    assert r.state is ReadinessState.READY


def test_evidence_travels_with_every_verdict():
    """No surface may state a readiness without being able to state what it
    rests on, so the rule always returns its basis."""
    r = compute(_series([86, 87, 88]), pass_mark=PASS)
    assert r.mock_count == 3
    assert r.pass_mark == PASS
    assert r.latest_taken_at is not None
    assert r.domains
