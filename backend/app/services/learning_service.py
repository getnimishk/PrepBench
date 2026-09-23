# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The rules that make a learning attempt worth recording.

There is exactly one rule here that matters, and the table exists to enforce it:

    a prediction cannot be amended once the learner has seen the outcome.

The client already refuses it -- `commitPrediction()` in
frontend/src/services/learning/attempts.ts returns the attempt unchanged if it
is already committed, and 494 lines of integrity tests hold that line. But a
rule enforced only in the browser is not enforced. Anything that can POST can
rewrite a prediction, and every accuracy figure in the product is derived from
these rows. So the refusal is repeated here, at the only place it cannot be
routed around.

The client's own words for why, kept because they are the clearest statement of
it: "an amended prediction after seeing the outcome is hindsight wearing a
prediction's clothes, and it would quietly turn every accuracy number in the
product into a measure of nothing."
"""
from datetime import datetime, timedelta, UTC
from typing import List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import InvalidExamStateException, ResourceNotFoundException
from app.models.learning_attempt import LearningAttempt
from app.repositories.learning_attempt_repository import LearningAttemptRepository
from app.schemas.learning import (
    LearningAttemptCreate,
    LearningAttemptResponse,
    LearningAttemptUpdate,
)


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# How far ahead of the server's clock a client time may be and still be taken as
# "now". The browser stamps a commit before the request leaves, so on one machine
# it is never ahead; across machines the clocks can differ by a little. Beyond
# this it is not skew, it is a time that has not happened.
_CLOCK_SKEW = timedelta(minutes=2)


def _naive_utc(when: Optional[datetime]) -> Optional[datetime]:
    if when is None or when.tzinfo is None:
        return when
    return when.astimezone(UTC).replace(tzinfo=None)


class LearningService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = LearningAttemptRepository(db)

    # ---- reads ----------------------------------------------------------

    def list_attempts(
        self,
        subject_id: Optional[int] = None,
        concept_id: Optional[str] = None,
    ) -> List[LearningAttemptResponse]:
        return [
            LearningAttemptResponse.model_validate(a)
            for a in self.repo.list_attempts(subject_id=subject_id, concept_id=concept_id)
        ]

    def get_attempt(self, attempt_uid: str) -> LearningAttemptResponse:
        return LearningAttemptResponse.model_validate(self._require(attempt_uid))

    # ---- writes ---------------------------------------------------------

    def start_attempt(self, req: LearningAttemptCreate) -> LearningAttemptResponse:
        """Open an attempt, or return the one already open under this uid.

        Idempotent on `attempt_uid` because the client generates it and may
        retry: a dropped response that became a second row would inflate every
        count derived from this table, and an attempt count that drifts upward
        on bad wifi is not evidence of anything.

        Returning the existing row rather than raising 409 is deliberate -- a
        retry is not a conflict, it is the same request arriving twice. What it
        must NOT do is overwrite: an existing attempt's progress is left exactly
        as it is.
        """
        existing = self.repo.get_by_uid(req.attempt_uid)
        if existing is not None:
            return LearningAttemptResponse.model_validate(existing)

        attempt = LearningAttempt(
            attempt_uid=req.attempt_uid,
            subject_id=req.subject_id,
            challenge_id=req.challenge_id,
            concept_id=req.concept_id,
            scenario_fingerprint=req.scenario_fingerprint,
            mode=req.mode,
            started_at=min(_naive_utc(req.started_at), _now()) if req.started_at else _now(),
            hint_count=req.hint_count,
            explanation_mechanisms=[],
            selected_alternative_ids=[],
            rubric_coverage={},
        )
        try:
            return LearningAttemptResponse.model_validate(self.repo.add(attempt))
        except IntegrityError:
            # Two creates for one uid arrived together: both looked, neither
            # found it, and the other insert won. That is still one attempt
            # arriving twice, so the answer is the row that won -- not a 500.
            self.db.rollback()
            existing = self.repo.get_by_uid(req.attempt_uid)
            if existing is None:
                raise
            return LearningAttemptResponse.model_validate(existing)

    def update_attempt(
        self, attempt_uid: str, req: LearningAttemptUpdate
    ) -> LearningAttemptResponse:
        attempt = self._require(attempt_uid)
        changes = req.model_dump(exclude_unset=True)

        if "prediction" in changes and changes["prediction"] is not None:
            self._commit_prediction(attempt, changes["prediction"], changes.get("committed_at"))

        # The experiment is recorded after the prediction, never before: what
        # happened must not be on the record ahead of what was expected.
        for field in ("manipulation", "observed"):
            if changes.get(field) is not None:
                self._record_once(attempt, field, changes[field])

        if "explanation_text" in changes and changes["explanation_text"] is not None:
            if attempt.committed_at is None:
                raise InvalidExamStateException(
                    "An explanation comes after the prediction and the result. Commit a "
                    "prediction first."
                )
            attempt.explanation_text = changes["explanation_text"].strip() or None

        # Hints are recorded, never blocked. Support is not a punishment, and a
        # hint taken after committing costs nothing -- the prediction is already
        # on the record by then.
        if changes.get("hint_count") is not None:
            attempt.hint_count = changes["hint_count"]

        for field in ("explanation_mechanisms", "selected_alternative_ids", "rubric_coverage"):
            if field in changes and changes[field] is not None:
                setattr(attempt, field, changes[field])

        if changes.get("subject_id") is not None:
            attempt.subject_id = changes["subject_id"]

        if changes.get("duration_ms") is not None:
            attempt.duration_ms = changes["duration_ms"]

        if changes.get("completed"):
            self._complete(attempt, correct=changes.get("correct"),
                           transfer=changes.get("transfer"),
                           when=changes.get("completed_at"))

        return LearningAttemptResponse.model_validate(self.repo.save(attempt))

    # ---- the two transitions that have rules ----------------------------

    def _record_once(self, attempt: LearningAttempt, field: str, value) -> None:
        """Write-once, like the prediction: a repeat of the same value is a retry."""
        if attempt.committed_at is None:
            raise InvalidExamStateException(
                "What changed and what the model showed are recorded after a prediction "
                "is committed, never before it."
            )
        current = getattr(attempt, field)
        if current is not None and current != value:
            raise InvalidExamStateException(
                f"This attempt's {field} is already recorded and cannot be changed. "
                "Start a new attempt to run the experiment again."
            )
        setattr(attempt, field, value)

    def _bounded(self, attempt: LearningAttempt, when: Optional[datetime]) -> datetime:
        """A client-supplied time, if it is plausible; the server's clock otherwise."""
        now = _now()
        if when is None:
            return now
        when = _naive_utc(when)
        if now < when <= now + _CLOCK_SKEW:
            when = now
        if when > now or (attempt.started_at is not None and when < attempt.started_at):
            raise InvalidExamStateException(
                "That time is outside the attempt: it cannot be in the future or before "
                "the attempt started."
            )
        return when

    def _commit_prediction(
        self, attempt: LearningAttempt, prediction: str, when: Optional[datetime] = None
    ) -> None:
        """Write-once. The integrity of every accuracy number in the product.

        Refused rather than silently ignored: a client that believes it changed
        a prediction and got a 200 would go on showing the new one, and the
        disagreement would surface much later as a number nobody can reconcile.
        """
        if attempt.committed_at is not None and attempt.prediction == prediction:
            # The same prediction arriving again is a retry -- a response lost
            # on the way back, or two saves crossing. It claims nothing new, so
            # it is not an amendment, and the first commit's time stands.
            return
        if attempt.committed_at is not None:
            raise InvalidExamStateException(
                "This attempt already has a committed prediction. A prediction "
                "cannot be changed after it is made -- an amended prediction is "
                "hindsight, and it would make every accuracy figure derived from "
                "these attempts meaningless. Start a new attempt instead."
            )
        attempt.prediction = prediction
        attempt.committed_at = self._bounded(attempt, when)

    def _complete(
        self,
        attempt: LearningAttempt,
        correct: Optional[bool],
        transfer: Optional[bool],
        when: Optional[datetime] = None,
    ) -> None:
        """Close the attempt.

        Refuses an uncommitted attempt, mirroring completeAttempt() on the
        client: with no recorded prediction there is nothing to be right or
        wrong about, and scoring it would invent evidence.

        Completing twice is a no-op rather than an error -- unlike a prediction,
        a repeated completion carries no new claim, so a retried request should
        not fail.
        """
        if attempt.committed_at is None:
            raise InvalidExamStateException(
                "This attempt has no committed prediction, so there is nothing "
                "to score. Commit a prediction before completing it."
            )
        if attempt.completed_at is not None:
            return

        attempt.completed_at = self._bounded(attempt, when)
        attempt.correct = correct
        attempt.transfer = transfer

    def _require(self, attempt_uid: str) -> LearningAttempt:
        attempt = self.repo.get_by_uid(attempt_uid)
        if attempt is None:
            raise ResourceNotFoundException("LearningAttempt", attempt_uid)
        return attempt
