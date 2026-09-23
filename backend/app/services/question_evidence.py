# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
What the learner's own answers say about each question.

One definition, used by every surface that sorts questions by evidence: the
exam engine's pool preview, the Question Bank's status column and its filter,
and the bank's summary figures. Written out once so "missed" on the bank's
table and "missed before" in a practice preview are the same set of questions.

Evidence is answers in completed learner sessions -- the rows every other
evidence surface counts -- and an answer with no correctness recorded (skipped)
is not an attempt. A question is:

  missed      answered, and wrong at least once
  correct     answered, and right every time so far
  unattempted never answered
  due         on the spaced schedule, with its next review now or past

Missed, correct and unattempted partition the bank; due is a separate fact that
can sit on any of the first two.
"""
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Dict, Iterable, Literal, Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.question import Question
from app.models.spaced_repetition import SpacedRepetition
from app.repositories.subject_repository import LEARNER

Outcome = Literal["missed", "due", "correct", "unattempted"]

# SQLite refuses an IN list past its variable limit, so long id lists go in chunks.
_CHUNK = 900


@dataclass(frozen=True)
class Evidence:
    answered: int = 0
    correct: int = 0
    due: bool = False

    @property
    def attempted(self) -> bool:
        return self.answered > 0

    @property
    def missed(self) -> bool:
        return self.answered > 0 and self.correct < self.answered


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _learner_answers():
    """Per question: answers counted and answers right, in completed learner sessions."""
    return (
        select(
            ExamAnswer.question_id.label("question_id"),
            func.count(ExamAnswer.id).label("answered"),
            func.sum(case((ExamAnswer.is_correct.is_(True), 1), else_=0)).label("correct"),
        )
        .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
        .where(
            ExamSession.status == ExamStatus.COMPLETED,
            ExamSession.source == LEARNER,
            ExamAnswer.is_correct.isnot(None),
        )
        .group_by(ExamAnswer.question_id)
    )


def evidence_for(db: Session, question_ids: Iterable[int], now: Optional[datetime] = None) -> Dict[int, Evidence]:
    """Evidence for each of these questions; a question with none gets the empty record."""
    ids = list(dict.fromkeys(question_ids))
    now = now or _now()
    answered: Dict[int, tuple] = {}
    due: set = set()
    for start in range(0, len(ids), _CHUNK):
        chunk = ids[start:start + _CHUNK]
        answers = _learner_answers().where(ExamAnswer.question_id.in_(chunk)).subquery()
        for question_id, n, correct in db.execute(select(answers.c.question_id, answers.c.answered, answers.c.correct)):
            answered[question_id] = (int(n or 0), int(correct or 0))
        due.update(
            row[0]
            for row in db.execute(
                select(SpacedRepetition.question_id).where(
                    SpacedRepetition.next_review_date <= now,
                    SpacedRepetition.question_id.in_(chunk),
                )
            )
        )
    return {
        qid: Evidence(answered=answered.get(qid, (0, 0))[0], correct=answered.get(qid, (0, 0))[1], due=qid in due)
        for qid in ids
    }


def outcome_criterion(outcome: Outcome, now: Optional[datetime] = None):
    """A filter on Question.id selecting the questions with this outcome."""
    answers = _learner_answers().subquery()
    if outcome == "missed":
        return Question.id.in_(select(answers.c.question_id).where(answers.c.correct < answers.c.answered))
    if outcome == "correct":
        return Question.id.in_(select(answers.c.question_id).where(answers.c.correct >= answers.c.answered))
    if outcome == "unattempted":
        return Question.id.not_in(select(answers.c.question_id))
    if outcome == "due":
        return Question.id.in_(
            select(SpacedRepetition.question_id).where(SpacedRepetition.next_review_date <= (now or _now()))
        )
    raise ValueError(f"Unknown outcome: {outcome}")


def bank_summary(db: Session, subject_id: Optional[int] = None, now: Optional[datetime] = None) -> dict:
    """The Question Bank's four figures, for one preparation's questions or all of them."""
    now = now or _now()

    q_query = select(func.count(Question.id))
    flagged_query = select(func.count(Question.id)).where(Question.is_reviewed.is_(True))
    if subject_id is not None:
        q_query = q_query.where(Question.subject_id == subject_id)
        flagged_query = flagged_query.where(Question.subject_id == subject_id)

    questions = db.scalar(q_query) or 0
    flagged = db.scalar(flagged_query) or 0

    ans_query = (
        select(
            func.count(func.distinct(ExamAnswer.question_id)),
            func.count(ExamAnswer.id),
            func.coalesce(func.sum(case((ExamAnswer.is_correct.is_(True), 1), else_=0)), 0),
            func.count(func.distinct(case((ExamAnswer.is_correct.is_(False), ExamAnswer.question_id), else_=None))),
        )
        .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
        .where(
            ExamSession.status == ExamStatus.COMPLETED,
            ExamSession.source == LEARNER,
            ExamAnswer.is_correct.isnot(None),
        )
    )
    if subject_id is not None:
        ans_query = ans_query.join(Question, Question.id == ExamAnswer.question_id).where(Question.subject_id == subject_id)

    attempted, recorded, right, missed = db.execute(ans_query).one()

    due_query = (
        select(func.count(func.distinct(SpacedRepetition.question_id)))
        .where(SpacedRepetition.next_review_date <= now)
    )
    if subject_id is not None:
        due_query = due_query.join(Question, Question.id == SpacedRepetition.question_id).where(Question.subject_id == subject_id)

    review_due = db.scalar(due_query) or 0

    recorded = int(recorded or 0)
    right = int(right or 0)
    return {
        "subject_id": subject_id,
        "questions": int(questions),
        "attempted": int(attempted or 0),
        "never_attempted": int(questions) - int(attempted or 0),
        "answers": recorded,
        "correct_answers": right,
        # Null, never 0, with nothing answered: no answers is not a score of zero.
        "correct_percentage": round(right * 100 / recorded, 1) if recorded else None,
        "review_due": int(review_due),
        "missed_at_least_once": int(missed or 0),
        "flagged_reviewed": int(flagged),
    }
