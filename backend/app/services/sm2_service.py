from datetime import datetime, UTC, timedelta
from sqlalchemy.orm import Session
from app.models.spaced_repetition import SpacedRepetition
from app.models.exam_answer import ConfidenceLevel
from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository


class SM2Service:
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
    def update_item(db: Session, question_id: int, is_correct: bool, confidence: ConfidenceLevel) -> SpacedRepetition:
        q_quality = SM2Service.calculate_quality_score(is_correct, confidence)
        repo = SpacedRepetitionRepository(db)

        item = repo.get_by_question(question_id)
        if not item:
            item = repo.create_for_question(question_id, datetime.now(UTC).replace(tzinfo=None))

        # SM-2 ease-factor formula
        current_ef = item.ease_factor or 2.5
        new_ef = current_ef + (0.1 - (5 - q_quality) * (0.08 + (5 - q_quality) * 0.02))
        if new_ef < 1.3:
            new_ef = 1.3

        if q_quality >= 3:
            if item.repetition == 0:
                new_interval = 1
            elif item.repetition == 1:
                new_interval = 6
            else:
                new_interval = int(round((item.interval_days or 1) * new_ef))
            new_rep = item.repetition + 1
        else:
            # Failed recall — reset to start
            new_rep = 0
            new_interval = 1

        now = datetime.now(UTC).replace(tzinfo=None)
        item.repetition = new_rep
        item.interval_days = new_interval
        item.ease_factor = new_ef
        item.last_reviewed_at = now
        item.next_review_date = now + timedelta(days=new_interval)

        repo.commit()
        repo.refresh(item)
        return item
