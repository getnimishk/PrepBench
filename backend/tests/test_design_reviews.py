# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.seed_design_reviews import SEED_DESIGN_REVIEWS
from tests.llm_fakes import (
    clear_env_provider,
    fake_gemini_text_response,
    patch_gateway_transport,
    set_env_provider,
)

client = TestClient(app)

BASE = "/api/v1/design-reviews"


@pytest.fixture(scope="module", autouse=True)
def seeded():
    """Seed the shared test DB once, since the lifespan handler does not run
    for a TestClient used outside a context manager."""
    from tests.conftest import TestingSessionLocal
    from app.utils.seed_design_reviews import seed_design_reviews

    db = TestingSessionLocal()
    try:
        seed_design_reviews(db)
    finally:
        db.close()


def _any_review_id() -> int:
    return client.get(f"{BASE}?limit=500").json()["items"][0]["id"]


# ---- the answer key must not leak -------------------------------------


def test_review_detail_never_carries_the_answer():
    """The deciding axis is the answer. Serving it alongside the question would
    be the same defect as shipping an exam question with its explanation
    attached, which this app strips server-side."""
    body = client.get(f"{BASE}/{_any_review_id()}").json()

    for leaked in ("deciding_axis", "reveal", "elicit_answer"):
        assert leaked not in body, f"{leaked} leaked to an unanswered review"

    assert body["brief"]
    assert len(body["options"]) == 2
    assert {o["label"] for o in body["options"]} == {"A", "B"}


def test_review_list_never_carries_the_answer():
    items = client.get(f"{BASE}?limit=500").json()["items"]
    assert items
    for item in items:
        for leaked in ("deciding_axis", "reveal", "elicit_answer", "brief"):
            assert leaked not in item


# ---- answering unlocks the reveal -------------------------------------


def test_submitting_an_attempt_returns_the_reveal():
    review_id = _any_review_id()
    res = client.post(f"{BASE}/attempts", json={
        "review_id": review_id,
        "choice": "A",
        "justification": "Freshness differs per consumer, so paying streaming rates for a daily reader is the waste.",
        "time_spent_seconds": 240,
    })
    assert res.status_code == 201
    body = res.json()

    assert body["reveal"]["deciding_axis"]
    assert body["reveal"]["reveal"]
    assert body["reveal"]["elicit_answer"]
    assert body["choice"] == "A"


def test_ask_first_is_a_first_class_answer():
    """Refusing to choose until you know something is frequently the correct
    professional move, so it is a stored choice rather than a special case."""
    res = client.post(f"{BASE}/attempts", json={
        "review_id": _any_review_id(),
        "choice": "ask_first",
        "justification": "What is the actual latency budget, and how many fields does the fast consumer need?",
    })
    assert res.status_code == 201
    assert res.json()["choice"] == "ask_first"


def test_declining_to_choose_must_name_a_question():
    """Otherwise "neither" is the one answer that can be given without thinking,
    and the exercise quietly acquires an opt-out."""
    res = client.post(f"{BASE}/attempts", json={
        "review_id": _any_review_id(),
        "choice": "ask_first",
        "justification": "I do not like either of these options.",
    })
    assert res.status_code == 422


def test_an_implied_question_counts_as_asking():
    """A real answer is as often "I would want to know the latency budget" as
    it is a sentence ending in a question mark."""
    res = client.post(f"{BASE}/attempts", json={
        "review_id": _any_review_id(),
        "choice": "ask_first",
        "justification": "I would want to know the actual latency budget before committing.",
    })
    assert res.status_code == 201


def test_the_question_rule_applies_only_to_declining():
    """Choosing an option and explaining it plainly must not be rejected for
    lacking a question."""
    res = client.post(f"{BASE}/attempts", json={
        "review_id": _any_review_id(),
        "choice": "A",
        "justification": "Streaming everywhere is overkill for a once-a-day reader.",
    })
    assert res.status_code == 201


def test_unknown_choice_is_rejected():
    res = client.post(f"{BASE}/attempts", json={
        "review_id": _any_review_id(),
        "choice": "C",
        "justification": "There is no option C.",
    })
    assert res.status_code == 422


def test_blank_justification_is_rejected():
    """Picking a side without saying why is the thing this format exists to
    prevent, so an empty reason is not a valid attempt."""
    res = client.post(f"{BASE}/attempts", json={
        "review_id": _any_review_id(),
        "choice": "B",
        "justification": "   ",
    })
    assert res.status_code == 422


def test_attempt_on_unknown_review_404s():
    res = client.post(f"{BASE}/attempts", json={
        "review_id": 999999999,
        "choice": "A",
        "justification": "This review does not exist.",
    })
    assert res.status_code == 404


# ---- no AI configured -------------------------------------------------


def test_attempt_saves_ungraded_rather_than_scoring_zero():
    """Phase 1 ships without grading. The honest state is "not graded" -- a
    zero would be a fabricated score, which this app does not produce."""
    res = client.post(f"{BASE}/attempts", json={
        "review_id": _any_review_id(),
        "choice": "B",
        "justification": "Duty cycle decides it, and nobody has said what the query-hours are.",
    })
    body = res.json()

    assert body["grading_status"] == "not_graded"
    assert body["axis_verdict"] is None
    assert body["feedback"] is None
    # Specifically not a number: an ungraded attempt has no score at all.
    assert "overall_score" not in body


# ---- revisiting -------------------------------------------------------


def test_latest_attempt_returns_what_the_learner_said_last_time():
    review_id = _any_review_id()
    client.post(f"{BASE}/attempts", json={
        "review_id": review_id,
        "choice": "A",
        "justification": "First pass reasoning.",
    })
    client.post(f"{BASE}/attempts", json={
        "review_id": review_id,
        "choice": "B",
        "justification": "Second pass, having thought about duty cycle.",
    })

    latest = client.get(f"{BASE}/{review_id}/latest-attempt").json()
    assert latest["justification"] == "Second pass, having thought about duty cycle."
    assert latest["reveal"]["deciding_axis"]


def test_latest_attempt_is_null_for_an_untouched_review():
    untouched = [
        r["id"] for r in client.get(f"{BASE}?limit=500").json()["items"]
        if not r["attempted"]
    ]
    assert untouched, "expected at least one unattempted review"
    assert client.get(f"{BASE}/{untouched[-1]}/latest-attempt").json() is None


def test_list_marks_which_reviews_have_been_attempted():
    review_id = _any_review_id()
    client.post(f"{BASE}/attempts", json={
        "review_id": review_id,
        "choice": "A",
        "justification": "Marking this one as attempted.",
    })
    items = client.get(f"{BASE}?limit=500").json()["items"]
    assert next(r for r in items if r["id"] == review_id)["attempted"] is True


def test_unknown_review_404s():
    assert client.get(f"{BASE}/999999999").status_code == 404


# ---- routing ----------------------------------------------------------


def test_literal_paths_are_not_swallowed_by_the_id_route():
    """/domains and /attempts are declared before /{review_id}; if that order
    ever regresses, FastAPI parses them as ids and these 422."""
    assert client.get(f"{BASE}/domains").status_code == 200
    assert client.get(f"{BASE}/attempts").status_code == 200


# ---- the content contract --------------------------------------------


def test_every_option_states_when_it_breaks():
    """The property the whole format rests on: an option with no failure mode
    is the right answer in disguise, and a review built from one stops teaching
    the moment the learner notices the pattern."""
    for review in SEED_DESIGN_REVIEWS:
        for option in review["options"]:
            assert option["holds_when"].strip(), f"{review['title']}/{option['label']}"
            assert option["breaks_when"].strip(), f"{review['title']}/{option['label']}"


def test_no_cost_multiplier_is_stated_without_its_basis():
    """No coefficient is presented as an empirically estimated constant.

    Narrowed deliberately to multipliers -- "10-20x", "seven times" -- because
    those are the figures that get quoted back as fact, and a cost that makes no
    numeric claim needs no basis. This does not check prose quality in general;
    it catches the one shape that would mislead.
    """
    multipliers = ("x the", "times the", "times as")
    basis = ("assum", "depends", "roughly", "which at")
    for review in SEED_DESIGN_REVIEWS:
        for option in review["options"]:
            cost = option["rough_cost"].lower()
            if not any(m in cost for m in multipliers):
                continue
            assert any(b in cost for b in basis), (
                f"{review['title']}/{option['label']} quotes a multiplier with no stated "
                f"basis: {option['rough_cost']}"
            )


def test_every_review_accepts_ask_first():
    for review in SEED_DESIGN_REVIEWS:
        assert review["elicit_answer"].strip(), f"{review['title']} has no ask-first answer"


def test_every_concept_is_actually_used_by_its_review():
    """The feature's central claim: vocabulary arrives attached to a decision it
    changed, not as a glossary. A concept listed under "vocabulary this review
    used" that the review never uses breaks exactly that claim.

    Matched on five-character stems so an honest word-form difference passes --
    a reader connects the chip "Idempotency" to "idempotent pipelines" without
    help -- while a term that is simply absent does not.
    """
    import re

    stopwords = {"vs", "of", "the", "a", "and"}

    def stems(phrase):
        words = [w for w in re.findall(r"[a-z]+", phrase.lower()) if w not in stopwords]
        return [w[:5] for w in words]

    unused = []
    for review in SEED_DESIGN_REVIEWS:
        visible = " ".join([
            review["title"], review["brief"], review["deciding_axis"],
            review["reveal"], review["elicit_answer"],
            *[
                " ".join([
                    o["name"], o["summary"], o["holds_when"], o["breaks_when"],
                    o["rough_cost"], " ".join(o["key_choices"]),
                    " ".join(s["label"] + " " + (s.get("detail") or "") for s in o["flow"]),
                ])
                for o in review["options"]
            ],
        ]).lower()

        for concept in review["concepts"]:
            if not all(stem in visible for stem in stems(concept)):
                unused.append(f"{review['title']} -> {concept}")

    assert not unused, "concepts listed but never used:\n  " + "\n  ".join(unused)


def test_every_seeded_review_carries_an_axis_label():
    """Analytics groups by this, so a review without one lands silently in an
    "Unlabelled" bucket that teaches nothing."""
    for review in SEED_DESIGN_REVIEWS:
        assert review.get("axis_label"), f"{review['title']} has no axis_label"


# ---- grading (phase 2) ------------------------------------------------


def _submit(review_id, choice="A", justification="Some reasoning about the trade-off."):
    return client.post(f"{BASE}/attempts", json={
        "review_id": review_id,
        "choice": choice,
        "justification": justification,
    })


def test_grading_records_the_verdict_when_a_provider_is_configured(monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "verdict": "named",
        "feedback": "You went straight to duty cycle rather than assuming serverless is cheaper.",
    }))

    body = _submit(_any_review_id(), "B", "Utilisation is high enough that per-second billing loses.").json()

    assert body["grading_status"] == "graded"
    assert body["axis_verdict"] == "named"
    assert "duty cycle" in body["feedback"]


def test_grading_is_skipped_cleanly_with_no_provider(monkeypatch):
    """No API key is not a failing grade. The attempt saves, the reveal still
    shows, and the verdict is absent rather than "missed"."""
    clear_env_provider(monkeypatch)

    body = _submit(_any_review_id(), "A", "Streaming everywhere is overkill for a daily reader.").json()

    assert body["grading_status"] == "not_graded"
    assert body["axis_verdict"] is None
    assert body["reveal"]["deciding_axis"]


def test_a_grader_error_does_not_become_a_bad_verdict(monkeypatch):
    """A transport failure means we do not know how they did, which is not the
    same as knowing they did badly."""
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, None, error="upstream exploded")

    body = _submit(_any_review_id(), "A", "A considered answer that never got graded.").json()

    assert body["grading_status"] == "not_graded"
    assert body["axis_verdict"] is None


def test_an_unknown_verdict_is_rejected_rather_than_stored(monkeypatch):
    """A model answering off-menu produces no verdict at all. Coercing an
    unrecognised string into "missed" would invent a result."""
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "verdict": "excellent",
        "feedback": "Not one of the three allowed verdicts.",
    }))

    body = _submit(_any_review_id(), "A", "Reasoning.").json()

    assert body["grading_status"] == "not_graded"
    assert body["axis_verdict"] is None


def test_the_grader_is_never_told_one_option_is_correct():
    """The format's central claim is that either option can be right. A prompt
    naming a correct answer would quietly turn this back into a quiz."""
    from tests.conftest import TestingSessionLocal
    from app.services.design_review_service import DesignReviewService

    db = TestingSessionLocal()
    try:
        service = DesignReviewService(db)
        review = service.review_repo.get_by_id(_any_review_id())
        prompt = service._build_grading_prompt(review, "A", "Some reasoning.")
        options = list(review.options)
        axis = review.deciding_axis
    finally:
        db.close()

    lowered = prompt.lower()
    assert "not assessing whether they picked the better option" in lowered
    assert "there is no correct choice" in lowered
    # The axis is the thing being graded, so it has to be in the prompt.
    assert axis[:40].lower() in lowered
    # Neither option's holds/breaks reasoning is handed over: the grader judges
    # the learner's reasoning, not the architecture.
    for option in options:
        assert option.holds_when not in prompt
        assert option.breaks_when not in prompt


# ---- analytics (phase 3) ----------------------------------------------


def test_analytics_names_the_weakest_axis(monkeypatch):
    """The payoff of the whole feature: not a score, but which decision the
    learner keeps failing to spot."""
    set_env_provider(monkeypatch)
    reviews = client.get(f"{BASE}?limit=500").json()["items"]
    by_axis = {r["axis_label"]: r["id"] for r in reviews if r["axis_label"]}
    assert "Cost" in by_axis and "Freshness" in by_axis

    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "verdict": "missed", "feedback": "Cost never came up.",
    }))
    for _ in range(3):
        _submit(by_axis["Cost"], "A", "Serverless scales to zero so it must be cheaper.")

    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "verdict": "named", "feedback": "Good.",
    }))
    _submit(by_axis["Freshness"], "B", "Different consumers need different freshness.")

    stats = client.get(f"{BASE}/analytics").json()
    axes = {a["axis_label"]: a for a in stats["by_axis"]}

    assert axes["Cost"]["missed"] >= 3
    assert axes["Cost"]["named_rate"] == 0.0
    assert axes["Freshness"]["named"] >= 1
    assert stats["weakest_axis"]["axis_label"] == "Cost"


def test_a_partial_is_not_counted_as_a_hit(monkeypatch):
    """Half credit would flatter the learner on exactly the axes they most need
    to go back to."""
    set_env_provider(monkeypatch)
    reviews = client.get(f"{BASE}?limit=500").json()["items"]
    target = next(r for r in reviews if r["axis_label"] == "Layering")

    patch_gateway_transport(monkeypatch, fake_gemini_text_response({
        "verdict": "partial", "feedback": "Close.",
    }))
    _submit(target["id"], "B", "Three layers seems like a lot for one dashboard.")

    axes = {a["axis_label"]: a for a in client.get(f"{BASE}/analytics").json()["by_axis"]}
    assert axes["Layering"]["partial"] == 1
    assert axes["Layering"]["named"] == 0
    assert axes["Layering"]["named_rate"] == 0.0


def test_analytics_has_no_weakest_axis_before_anything_is_graded():
    """Empty, not zeroed. A 0% here would read as a failure the learner has not
    actually had."""
    from tests.conftest import TestingSessionLocal
    from app.services.design_review_service import DesignReviewService
    from app.models.design_review import DesignReviewAttempt

    db = TestingSessionLocal()
    try:
        for attempt in db.query(DesignReviewAttempt).filter(
            DesignReviewAttempt.grading_status == "graded"
        ).all():
            attempt.grading_status = "not_graded"
            attempt.axis_verdict = None
        db.commit()

        stats = DesignReviewService(db).get_analytics()
        assert stats.graded_attempts == 0
        assert stats.by_axis == []
        assert stats.weakest_axis is None
        # The attempts still happened, and analytics says so.
        assert stats.total_attempts > 0
    finally:
        db.close()


# ---- axis filter (phase 3) --------------------------------------------


def test_axis_filter_narrows_practice_to_one_decision():
    axes = client.get(f"{BASE}/axes").json()
    assert "Cost" in axes and "Reprocessing" in axes

    items = client.get(f"{BASE}?axis_label=Cost&limit=500").json()["items"]
    assert items
    assert {r["axis_label"] for r in items} == {"Cost"}
