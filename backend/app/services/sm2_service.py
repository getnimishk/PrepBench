# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime, UTC, timedelta
from sqlalchemy.orm import Session
from app.models.spaced_repetition import SpacedRepetition
from app.models.exam_answer import ConfidenceLevel
from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository


class SM2Service:
    # The schedule's numbers, named so a screen explaining the schedule reads
    # them from here rather than keeping its own copy.
    STARTING_EASE = 2.5
    MINIMUM_EASE = 1.3
    FIRST_INTERVAL_DAYS = 1
    SECOND_INTERVAL_DAYS = 6
    # Recall at or above this quality moves the item on; below it starts over.
    PASSING_QUALITY = 3

    @staticmethod
    def calculate_quality_score(is_correct: bool, confidence: ConfidenceLevel) -> int:
        if not is_correct:
            return 1 if confidence == ConfidenceLevel.HIGH else 2

        # Correct answer — map confidence to SM-2 quality score
        if confidence == ConfidenceLevel.HIGH:
            return 5
        elif confidence == ConfidenceLevel.MEDIUM:
            return 4
        else:
            return 3

    @staticmethod
    def next_schedule(
        repetition: int, interval_days: int, ease_factor: float, quality: int
    ) -> tuple[int, int, float]:
        """The SM-2 step, as a pure function: (repetition, interval_days, ease_factor).

        Pulled out of update_item so question reviews and topic rechecks
        (RoadmapService.record_demonstration) run the same arithmetic. Two copies
        of a scheduling formula drift the first time someone tunes one of them, and
        then a topic and a question answered the same way come back on different
        days for no reason anyone can see.
        """
        new_ef = (ease_factor or SM2Service.STARTING_EASE) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        if new_ef < SM2Service.MINIMUM_EASE:
            new_ef = SM2Service.MINIMUM_EASE

        if quality >= SM2Service.PASSING_QUALITY:
            if repetition == 0:
                new_interval = SM2Service.FIRST_INTERVAL_DAYS
            elif repetition == 1:
                new_interval = SM2Service.SECOND_INTERVAL_DAYS
            else:
                new_interval = int(round((interval_days or 1) * new_ef))
            new_rep = repetition + 1
        else:
            # Failed recall — reset to start
            new_rep = 0
            new_interval = SM2Service.FIRST_INTERVAL_DAYS

        return new_rep, new_interval, new_ef

    @staticmethod
    def update_item(db: Session, question_id: int, is_correct: bool, confidence: ConfidenceLevel) -> SpacedRepetition:
        q_quality = SM2Service.calculate_quality_score(is_correct, confidence)
        repo = SpacedRepetitionRepository(db)

        item = repo.get_by_question(question_id)
        if not item:
            item = repo.create_for_question(question_id, datetime.now(UTC).replace(tzinfo=None))

        SM2Service.apply(item, q_quality, datetime.now(UTC).replace(tzinfo=None))

        repo.commit()
        repo.refresh(item)
        return item

    @staticmethod
    def apply(item: SpacedRepetition, quality: int, now: datetime) -> SpacedRepetition:
        """Move one schedule entry forward by one recall of the given quality.

        Shared by answering in a session and by grading a spaced-repetition card,
        so a question recalled the same way comes back on the same day whichever
        screen it was recalled on.
        """
        new_rep, new_interval, new_ef = SM2Service.next_schedule(
            item.repetition, item.interval_days, item.ease_factor, quality
        )
        item.repetition = new_rep
        item.interval_days = new_interval
        item.ease_factor = new_ef
        item.last_reviewed_at = now
        item.next_review_date = now + timedelta(days=new_interval)
        return item
