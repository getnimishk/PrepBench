# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import json
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import ResourceNotFoundException
from app.core.logging_config import logger
from app.llm.gateway import LLMGateway
from app.llm.types import LLMTask
from app.models.design_review import DesignReviewAttempt
from app.repositories.design_review_repository import (
    DesignReviewRepository,
    DesignReviewAttemptRepository,
)
from app.schemas.design_review import (
    AxisPerformance,
    DesignReviewAnalytics,
    DesignReviewAttemptResponse,
    DesignReviewDetail,
    DesignReviewFilter,
    DesignReviewReveal,
    DesignReviewSummary,
    SubmitReviewAttemptRequest,
)

VALID_VERDICTS = {"named", "partial", "missed"}

CHOICE_DESCRIPTIONS = {
    "A": "chose option A",
    "B": "chose option B",
    "ask_first": "declined to choose and said what they would ask first",
}


class DesignReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.review_repo = DesignReviewRepository(db)
        self.attempt_repo = DesignReviewAttemptRepository(db)
        self.gateway = LLMGateway(db)

    # ---- reviews ----------------------------------------------------

    def list_reviews(
        self,
        skip: int = 0,
        limit: int = 100,
        filter_params: Optional[DesignReviewFilter] = None,
    ) -> dict:
        reviews = self.review_repo.get_all(skip=skip, limit=limit, filter_params=filter_params)
        attempted = self.attempt_repo.get_attempted_review_ids()
        return {
            "items": [
                DesignReviewSummary(
                    id=r.id,
                    title=r.title,
                    domain=r.domain,
                    difficulty=r.difficulty,
                    axis_label=r.axis_label,
                    concepts=r.concepts or [],
                    attempted=r.id in attempted,
                )
                for r in reviews
            ],
            "total": self.review_repo.count(filter_params),
            "skip": skip,
            "limit": limit,
        }

    def get_review(self, review_id: int) -> DesignReviewDetail:
        """The brief and both options -- and deliberately not the answer.

        deciding_axis, reveal and elicit_answer are stripped here rather than
        merely hidden by the client, the same rule the exam endpoints follow
        for an unanswered question's explanation.
        """
        review = self.review_repo.get_by_id(review_id)
        if not review:
            raise ResourceNotFoundException("DesignReview", review_id)
        return DesignReviewDetail.model_validate(review)

    def list_domains(self) -> list:
        return self.review_repo.get_distinct_domains()

    def list_axes(self) -> list:
        return self.review_repo.get_distinct_axes()

    # ---- attempts ---------------------------------------------------

    def submit_attempt(self, req: SubmitReviewAttemptRequest) -> DesignReviewAttemptResponse:
        review = self.review_repo.get_by_id(req.review_id)
        if not review:
            raise ResourceNotFoundException("DesignReview", req.review_id)

        justification = req.justification.strip()
        attempt = DesignReviewAttempt(
            review_id=review.id,
            choice=req.choice,
            justification=justification,
            time_spent_seconds=max(0, req.time_spent_seconds),
            grading_status="not_graded",
            axis_verdict=None,
            feedback=None,
        )

        verdict, feedback, status = self._grade(review, req.choice, justification)
        attempt.grading_status = status
        attempt.axis_verdict = verdict
        attempt.feedback = feedback

        self.attempt_repo.create(attempt)
        return self._attempt_response(attempt, review)

    def get_attempt(self, attempt_id: int) -> DesignReviewAttemptResponse:
        attempt = self.attempt_repo.get_by_id(attempt_id)
        if not attempt:
            raise ResourceNotFoundException("DesignReviewAttempt", attempt_id)
        return self._attempt_response(attempt, attempt.review)

    def list_attempts(self, skip: int = 0, limit: int = 100) -> dict:
        attempts = self.attempt_repo.get_all(skip=skip, limit=limit)
        return {
            "items": [self._attempt_response(a, a.review) for a in attempts],
            "total": self.attempt_repo.count(),
            "skip": skip,
            "limit": limit,
        }

    def get_latest_attempt_for_review(self, review_id: int) -> Optional[DesignReviewAttemptResponse]:
        """What the learner said last time, so reopening a completed review
        shows their own reasoning beside the reveal instead of only the answer."""
        if not self.review_repo.get_by_id(review_id):
            raise ResourceNotFoundException("DesignReview", review_id)
        attempt = self.attempt_repo.get_latest_for_review(review_id)
        if not attempt:
            return None
        return self._attempt_response(attempt, attempt.review)

    # ---- grading ----------------------------------------------------

    def _grade(self, review, choice: str, justification: str):
        """Did this justification identify the deciding axis?

        Returns (verdict, feedback, grading_status). One narrow question, not a
        judgement about architecture quality -- which is what makes it a
        question a model answers reliably, and also the thing worth learning.

        Every failure path returns "not_graded" with no verdict. An attempt
        that could not be graded has no verdict at all; inventing "missed"
        would blame the learner for a missing API key.
        """
        if not self.gateway.is_available(LLMTask.DESIGN_REVIEW_GRADING):
            return None, None, "not_graded"

        prompt = self._build_grading_prompt(review, choice, justification)
        parsed, error_msg = self.gateway.run(LLMTask.DESIGN_REVIEW_GRADING, prompt).as_tuple()

        if not parsed or error_msg:
            logger.warning(f"Design review grading failed: {error_msg}")
            return None, None, "not_graded"

        verdict = str(parsed.get("verdict") or "").strip().lower()
        if verdict not in VALID_VERDICTS:
            logger.warning(f"Design review grading returned an unknown verdict: {verdict!r}")
            return None, None, "not_graded"

        feedback = str(parsed.get("feedback") or "").strip() or None
        return verdict, feedback, "graded"

    def _build_grading_prompt(self, review, choice: str, justification: str) -> str:
        """The grader is never told that one option is correct, because none is.

        Naming a "right" option would make it grade the choice, which is the
        exact mistake this whole format exists to avoid: in a real design
        conversation either option can be right, and what separates a strong
        answer from a weak one is whether the reasoning found the axis.
        """
        return f"""You are assessing one specific thing about a candidate's reasoning in a
system design discussion. You are NOT assessing whether they picked the better option --
both options presented to them are defensible, and there is no correct choice.

THE SCENARIO THEY WERE GIVEN:
{review.brief}

THE AXIS THIS DECISION ACTUALLY TURNS ON:
{review.deciding_axis}

WHAT A STRONG ANSWER WOULD ASK BEFORE COMMITTING:
{review.elicit_answer}

THE CANDIDATE {CHOICE_DESCRIPTIONS.get(choice, "responded")} AND REASONED:
"{justification}"

YOUR ONLY QUESTION: does their reasoning identify the axis above?

They do not have to use the same words. Credit the substance: if the axis is about
differing freshness requirements and they wrote "not everyone needs it that fresh",
that is the axis, phrased their way.

Answer with one of:
- "named": they identified the axis, in their words or ours.
- "partial": they touched a factor that matters but did not reach the deciding one,
  or named the axis without saying why it decides anything.
- "missed": their reasoning is about something else entirely, or gives no reason.

Return ONLY valid JSON:
{{
  "verdict": "named" | "partial" | "missed",
  "feedback": "One sentence, addressed to the candidate. If they missed or partially
               reached it, point at the axis without lecturing. If they named it, say
               what specifically they got right rather than just agreeing."
}}"""

    # ---- analytics --------------------------------------------------

    def get_analytics(self) -> DesignReviewAnalytics:
        """What the learner keeps missing, in words rather than a score.

        Everything here degrades to empty rather than to zero: with nothing
        graded there is no weakest axis, and saying so is the honest answer.
        A 0% would read as a failure the learner has not actually had.
        """
        graded = self.attempt_repo.get_graded_with_review()
        total_attempts = self.attempt_repo.count()
        attempted_ids = self.attempt_repo.get_attempted_review_ids()

        tallies: dict = {}
        for attempt in graded:
            review = attempt.review
            label = (review.axis_label if review else None) or "Unlabelled"
            bucket = tallies.setdefault(label, {"named": 0, "partial": 0, "missed": 0})
            if attempt.axis_verdict in bucket:
                bucket[attempt.axis_verdict] += 1

        by_axis: List[AxisPerformance] = []
        for label in sorted(tallies):
            counts = tallies[label]
            attempts = counts["named"] + counts["partial"] + counts["missed"]
            by_axis.append(AxisPerformance(
                axis_label=label,
                attempts=attempts,
                named=counts["named"],
                partial=counts["partial"],
                missed=counts["missed"],
                # A "partial" is not a hit. Half credit here would flatter the
                # learner on exactly the axes they most need to revisit.
                named_rate=(counts["named"] / attempts) if attempts else None,
            ))

        scored = [a for a in by_axis if a.attempts > 0 and a.named_rate is not None]
        weakest = min(
            scored,
            # Ties broken by the axis missed most often, so "0 of 1" never
            # outranks "1 of 6" as the thing to go and study.
            key=lambda a: (a.named_rate, -a.missed),
        ) if scored else None

        return DesignReviewAnalytics(
            total_attempts=total_attempts,
            graded_attempts=len(graded),
            reviews_completed=len(attempted_ids),
            reviews_available=self.review_repo.count(),
            by_axis=by_axis,
            weakest_axis=weakest,
        )

    # ---- internals --------------------------------------------------

    def _attempt_response(self, attempt: DesignReviewAttempt, review) -> DesignReviewAttemptResponse:
        """The reveal travels with the attempt.

        Answering is what unlocks it, so bundling it here is what keeps the
        client from needing a second request that would have to re-check the
        same permission.
        """
        return DesignReviewAttemptResponse(
            id=attempt.id,
            review_id=attempt.review_id,
            review_title=review.title if review else None,
            choice=attempt.choice,
            justification=attempt.justification,
            grading_status=attempt.grading_status,
            axis_verdict=attempt.axis_verdict,
            feedback=attempt.feedback,
            time_spent_seconds=attempt.time_spent_seconds,
            created_at=attempt.created_at,
            reveal=DesignReviewReveal(
                deciding_axis=review.deciding_axis,
                reveal=review.reveal,
                elicit_answer=review.elicit_answer,
            ) if review else None,
        )
