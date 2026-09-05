# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Whether the candidate would pass, and the evidence for saying so.

This is the product's single output. Everything else in PrepBench --
question banks, drills, design reviews, analytics -- exists to feed it.

Two rules make it trustworthy, and neither is negotiable:

  1.  Only full mocks count. A drill is untimed, unpressured and usually
      shorter, so mixing the two produces a number that cannot answer
      "would I pass". This is enforced by the query, not by convention.

  2.  Never claim more than the evidence supports. Zero mocks is
      NEEDS_EVALUATION, not zero per cent. A subject with no pass mark
      can never be READY, because there is nothing to be ready against.

An encouraging app that leads to a failed exam costs the fee and the
confidence. It is worse than no app.
"""
import enum
from dataclasses import dataclass, field
from datetime import datetime, timedelta, UTC
from typing import Dict, List, Optional


# --------------------------------------------------------------------------
# Every number the rule depends on, in one place.
#
# These are product decisions, not implementation details. Each is arguable
# and each is meant to be argued with -- change them here and every surface
# follows.
# --------------------------------------------------------------------------

MIN_MOCKS_FOR_READY = 3         # one good mock is luck; three is a pattern
CONSECUTIVE_MOCKS_AT_PASS = 3   # consecutive, not averaged: an average hides a collapse
DOMAIN_FLOOR_PCT = 80.0         # exams sample every domain; one weak area sinks you
RECENCY_DAYS = 14               # knowledge decays, so stale evidence is not evidence
ALMOST_THERE_MARGIN = 5.0       # within this of the pass mark reads as "nearly"
PLATEAU_MIN_MOCKS = 4
PLATEAU_MAX_SPREAD = 3.0        # four results this tight are not improving
PLATEAU_MARGIN = 2.0            # ...and this close to the line

# A domain needs at least this many answered questions before its score is
# worth reporting. Below it the domain reads "needs evaluation" rather than
# a percentage, for the same reason the whole subject does.
MIN_QUESTIONS_PER_DOMAIN = 10


class ReadinessState(str, enum.Enum):
    NEEDS_EVALUATION = "needs_evaluation"
    DEVELOPING = "developing"
    ALMOST_THERE = "almost_there"
    PLATEAU = "plateau"
    READY = "ready"


class DomainState(str, enum.Enum):
    NEEDS_EVALUATION = "needs_evaluation"
    NEEDS_WORK = "needs_work"
    DEVELOPING = "developing"
    SOLID = "solid"


@dataclass(frozen=True)
class MockResult:
    """One full mock, reduced to what the rule needs.

    Deliberately not the ORM object: the rule is pure arithmetic over these,
    which is what makes it testable without a database and readable without
    tracing relationships.
    """
    session_id: int
    score_pct: float
    taken_at: datetime
    # domain -> (correct, answered) for that mock
    domain_counts: Dict[str, tuple] = field(default_factory=dict)


@dataclass
class DomainReadiness:
    domain: str
    state: DomainState
    answered: int
    score_pct: Optional[float]  # None below MIN_QUESTIONS_PER_DOMAIN


@dataclass(frozen=True)
class Blocker:
    """One unmet condition of READY.

    The product has always been able to say *what* state someone is in and
    never *why*, so every surface invented its own explanation -- Home said
    "weakest area" and named the lowest-scoring domain even when that domain
    was comfortably above the floor, which reads as a problem where there is
    none.

    A blocker is structural, not prose: the rule names the condition and the
    numbers, and the surface phrases it. That keeps one rule and one
    vocabulary, and makes the explanation testable.
    """
    kind: str                       # see BLOCKER_* below
    domain: Optional[str] = None    # WEAK_DOMAIN only
    value: Optional[float] = None   # what was measured
    target: Optional[float] = None  # what it has to reach
    count: Optional[int] = None     # how many, where a count is the point


BLOCKER_NO_EXAM_PROFILE = "no_exam_profile"  # nothing to be ready against
BLOCKER_MORE_MOCKS = "more_mocks"            # not enough evidence yet
BLOCKER_WEAK_DOMAIN = "weak_domain"          # one area below the floor
BLOCKER_BELOW_PASS = "below_pass"            # recent mocks under the line
BLOCKER_STALE = "stale"                      # evidence has aged out


@dataclass(frozen=True)
class Movement:
    """A domain that moved between the last mock and the one before it.

    Home is otherwise a list of things not yet good enough, and a product
    that only ever reports deficits teaches people to stop opening it. This
    is the same evidence read the other way round: what the last session of
    work actually bought.
    """
    domain: str
    before_pct: float
    after_pct: float

    @property
    def points(self) -> float:
        return round(self.after_pct - self.before_pct, 1)


@dataclass
class Readiness:
    state: ReadinessState
    # Everything below is the *evidence*. No surface may state a readiness
    # without also being able to state what it rests on.
    mock_count: int
    pass_mark: Optional[float]
    recent_scores: List[float]
    latest_taken_at: Optional[datetime]
    domains: List[DomainReadiness]
    weakest_domain: Optional[str]
    # Populated only when a trend is computable; None is not zero.
    points_per_mock: Optional[float] = None
    mocks_to_pass_estimate: Optional[int] = None
    # Why the state is not READY, most actionable first. Empty when it is.
    blockers: List[Blocker] = field(default_factory=list)
    # The clearest gain between the last two mocks, if there was one.
    most_improved: Optional[Movement] = None

    @property
    def is_stale(self) -> bool:
        if self.latest_taken_at is None:
            return False
        return _now() - self.latest_taken_at > timedelta(days=RECENCY_DAYS)


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _domain_readiness(mocks: List[MockResult]) -> List[DomainReadiness]:
    """Per-domain accuracy pooled across the mocks considered."""
    pooled: Dict[str, List[int]] = {}
    for mock in mocks:
        for domain, (correct, answered) in mock.domain_counts.items():
            acc = pooled.setdefault(domain, [0, 0])
            acc[0] += correct
            acc[1] += answered

    out: List[DomainReadiness] = []
    for domain in sorted(pooled):
        correct, answered = pooled[domain]
        if answered < MIN_QUESTIONS_PER_DOMAIN:
            # Too few to judge. Not a bad score -- no score.
            out.append(DomainReadiness(domain, DomainState.NEEDS_EVALUATION, answered, None))
            continue
        pct = (correct / answered) * 100.0
        if pct >= 90.0:
            state = DomainState.SOLID
        elif pct >= DOMAIN_FLOOR_PCT:
            state = DomainState.DEVELOPING
        else:
            state = DomainState.NEEDS_WORK
        out.append(DomainReadiness(domain, state, answered, round(pct, 1)))
    return out


# A domain has to move by more than this before it is worth reporting. Below
# it, the difference is the sample rather than the learner: a domain sampled
# twenty times a mock moves five points on one question.
MIN_MOVEMENT_PCT = 5.0


def _most_improved(mocks: List[MockResult]) -> Optional[Movement]:
    """The biggest genuine gain between the last mock and the one before.

    Compares like with like -- the same domain, one mock apart -- and reports
    nothing at all unless both mocks sampled the domain enough times for the
    comparison to mean something.
    """
    if len(mocks) < 2:
        return None
    before, after = mocks[-2], mocks[-1]

    best: Optional[Movement] = None
    for domain, (a_correct, a_answered) in after.domain_counts.items():
        prior = before.domain_counts.get(domain)
        if prior is None:
            continue
        b_correct, b_answered = prior
        # Half the reporting threshold, because this is one mock rather than
        # the three the domain readiness pools.
        floor = MIN_QUESTIONS_PER_DOMAIN // 2
        if a_answered < floor or b_answered < floor:
            continue
        b_pct = (b_correct / b_answered) * 100.0
        a_pct = (a_correct / a_answered) * 100.0
        if a_pct - b_pct < MIN_MOVEMENT_PCT:
            continue
        move = Movement(domain, round(b_pct, 1), round(a_pct, 1))
        if best is None or move.points > best.points:
            best = move
    return best


def _trend(scores: List[float]) -> Optional[float]:
    """Average points gained per mock across the scores given, or None.

    Deliberately the simple first-to-last slope rather than a regression:
    the number is shown to a person as "rising about N points per mock", and
    a regression coefficient would imply a precision three data points do not
    have.
    """
    if len(scores) < 2:
        return None
    return (scores[-1] - scores[0]) / (len(scores) - 1)


def _blockers(
    ordered: List[MockResult],
    scores: List[float],
    domains: List[DomainReadiness],
    pass_mark: Optional[float],
    has_exam_profile: bool,
    latest: Optional[datetime],
) -> List[Blocker]:
    """Every unmet condition of READY, most actionable first.

    "Most actionable" is the ordering, not severity: a named domain below the
    floor tells someone what to open tonight, where "your scores are not high
    enough yet" tells them only to try harder.
    """
    if not has_exam_profile or pass_mark is None:
        return [Blocker(kind=BLOCKER_NO_EXAM_PROFILE)]

    out: List[Blocker] = []

    if len(ordered) < MIN_MOCKS_FOR_READY:
        out.append(
            Blocker(
                kind=BLOCKER_MORE_MOCKS,
                value=float(len(ordered)),
                target=float(MIN_MOCKS_FOR_READY),
                count=MIN_MOCKS_FOR_READY - len(ordered),
            )
        )

    # Only a domain actually below the floor is a blocker. The lowest-scoring
    # domain is not automatically a weakness -- calling 92% "your weakest
    # area" invents a problem, and the learner cannot tell the invented ones
    # from the real ones.
    below = [d for d in domains if d.score_pct is not None and d.score_pct < DOMAIN_FLOOR_PCT]
    if below:
        worst = min(below, key=lambda d: d.score_pct)
        out.append(
            Blocker(
                kind=BLOCKER_WEAK_DOMAIN,
                domain=worst.domain,
                value=worst.score_pct,
                target=DOMAIN_FLOOR_PCT,
                count=worst.answered,
            )
        )

    under = [s for s in scores[-CONSECUTIVE_MOCKS_AT_PASS:] if s < pass_mark]
    if under:
        out.append(
            Blocker(
                kind=BLOCKER_BELOW_PASS,
                value=min(under),
                target=pass_mark,
                count=len(under),
            )
        )

    if latest is not None and _now() - latest > timedelta(days=RECENCY_DAYS):
        out.append(
            Blocker(
                kind=BLOCKER_STALE,
                value=float((_now() - latest).days),
                target=float(RECENCY_DAYS),
            )
        )

    return out


def compute(
    mocks: List[MockResult],
    pass_mark: Optional[float],
    has_exam_profile: bool = True,
) -> Readiness:
    """Apply the rule. Mocks must be chronological, oldest first.

    `mocks` is expected to contain only full mocks -- filtering drills out is
    the caller's job and is enforced at the repository, so that no future
    caller can accidentally widen it here.
    """
    ordered = sorted(mocks, key=lambda m: m.taken_at)
    scores = [m.score_pct for m in ordered]
    latest = ordered[-1].taken_at if ordered else None

    # Domains are computed from the mocks that decide the verdict, not from
    # all history, so the reported weakness matches the reported readiness.
    considered = ordered[-CONSECUTIVE_MOCKS_AT_PASS:] if ordered else []
    domains = _domain_readiness(considered)
    scored = [d for d in domains if d.score_pct is not None]
    weakest = min(scored, key=lambda d: d.score_pct).domain if scored else None

    base = dict(
        mock_count=len(ordered),
        pass_mark=pass_mark,
        recent_scores=[round(s, 1) for s in scores[-PLATEAU_MIN_MOCKS:]],
        latest_taken_at=latest,
        domains=domains,
        weakest_domain=weakest,
        blockers=_blockers(ordered, scores, domains, pass_mark, has_exam_profile, latest),
        most_improved=_most_improved(ordered),
    )

    # 1. Nothing to judge. Drills, however many, do not reach this function.
    if not ordered:
        return Readiness(state=ReadinessState.NEEDS_EVALUATION, **base)

    trend = _trend(scores[-PLATEAU_MIN_MOCKS:])
    base["points_per_mock"] = round(trend, 1) if trend is not None else None

    # A skill subject has no pass mark, so READY, ALMOST_THERE and PLATEAU are
    # all uncomputable. It can only ever be DEVELOPING. Reporting anything
    # stronger would be inventing a bar that does not exist.
    if pass_mark is None or not has_exam_profile:
        return Readiness(state=ReadinessState.DEVELOPING, **base)

    last3 = scores[-CONSECUTIVE_MOCKS_AT_PASS:]
    last4 = scores[-PLATEAU_MIN_MOCKS:]

    # 2. READY -- all four conditions, no exceptions.
    if (
        len(ordered) >= MIN_MOCKS_FOR_READY
        and len(last3) == CONSECUTIVE_MOCKS_AT_PASS
        and all(s >= pass_mark for s in last3)
        and all(
            d.score_pct is None or d.score_pct >= DOMAIN_FLOOR_PCT
            for d in domains
        )
        and latest is not None
        and _now() - latest <= timedelta(days=RECENCY_DAYS)
    ):
        return Readiness(state=ReadinessState.READY, **base)

    # 3. PLATEAU -- checked before ALMOST_THERE, because a plateau at the line
    #    also satisfies "almost", and the plateau is the more useful thing to
    #    say. It is the screen that stops someone practising forever at 85%.
    if (
        len(ordered) >= PLATEAU_MIN_MOCKS
        and (max(last4) - min(last4)) <= PLATEAU_MAX_SPREAD
        and abs((sum(last4) / len(last4)) - pass_mark) <= PLATEAU_MARGIN
    ):
        return Readiness(state=ReadinessState.PLATEAU, **base)

    # 4. ALMOST THERE, with the forecast that replaces a countdown.
    average3 = sum(last3) / len(last3)
    if abs(average3 - pass_mark) <= ALMOST_THERE_MARGIN:
        readiness = Readiness(state=ReadinessState.ALMOST_THERE, **base)
        if trend and trend > 0 and average3 < pass_mark:
            readiness.mocks_to_pass_estimate = max(1, int(-(-(pass_mark - average3) // trend)))
        return readiness

    # 5. Everything else with at least one mock.
    readiness = Readiness(state=ReadinessState.DEVELOPING, **base)
    if trend and trend > 0 and average3 < pass_mark:
        readiness.mocks_to_pass_estimate = max(1, int(-(-(pass_mark - average3) // trend)))
    return readiness
