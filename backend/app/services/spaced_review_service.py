# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Spaced repetition as retrieval: a card, recalled before it is revealed, then graded.

The schedule has always been driven by answering -- a session's answers move it at
finish, and a review check moves it when a miss is verified. Both of those show the
options, and picking the right one from four is recognition. This is the third way
in, and the only one that asks for recall: the question alone, then the answer, then
the learner's own account of how well it came back.

A grade is one recall event, so a card can only be graded while it is due. Grading
it twice would move it forward twice off the back of a single recall -- the same
non-idempotence ExamEngine.save_answer documents, and refused here for the same
reason.
"""
from datetime import UTC, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException, ResourceNotFoundException
from app.models.question import QuestionType
from app.models.subject import Subject
from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository
from app.services.sm2_service import SM2Service

# SM-2 quality for each grade. "Again" is a failed recall (below 3 resets the item);
# the other three are passes of increasing ease.
GRADE_QUALITY = {"again": 2, "hard": 3, "good": 4, "easy": 5}


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class SpacedReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SpacedRepetitionRepository(db)

    def deck(self, subject: Optional[Subject], limit: int, domain: Optional[str] = None) -> dict:
        now = _now()
        subject_id = subject.id if subject is not None else None
        items = self.repo.due_items(now, subject_id=subject_id, limit=limit, domain=domain)
        return {
            "cards": [self._card(item) for item in items if item.question is not None],
            "due_total": self.repo.count_due(now, subject_id, domain),
        }

    def grade(self, question_id: int, grade: str) -> dict:
        item = self.repo.get_by_question(question_id)
        if item is None:
            raise ResourceNotFoundException("Scheduled question", question_id)

        now = _now()
        if item.next_review_date > now:
            raise ConflictException(
                "This card is not due until "
                f"{item.next_review_date:%d %b %Y}. Grading it again now would move it "
                "further on without a recall to base that on."
            )

        SM2Service.apply(item, GRADE_QUALITY[grade], now)
        self.repo.commit()
        self.repo.refresh(item)
        return {
            "question_id": item.question_id,
            "grade": grade,
            "interval_days": item.interval_days,
            "next_review_date": item.next_review_date,
        }

    @staticmethod
    def _card(item) -> dict:
        question = item.question
        options = sorted(question.options, key=lambda o: (o.order_index or 0, o.id))
        return {
            "question_id": question.id,
            "question_text": question.text,
            "domain": question.domain,
            "topic": question.topic,
            "is_multiple": question.question_type == QuestionType.MULTIPLE_CHOICE,
            "answer": [o.option_text for o in options if o.is_correct],
            "explanation": question.explanation,
            "due_since": item.next_review_date,
            "repetition": item.repetition,
            "intervals": {
                grade: SM2Service.next_schedule(
                    item.repetition, item.interval_days, item.ease_factor, quality
                )[1]
                for grade, quality in GRADE_QUALITY.items()
            },
        }
