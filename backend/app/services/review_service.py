# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The check: one different question on the same concept, asked after the
explanation.

The gap this closes is the largest one in the product. Reviewing a miss set
`reviewed_at` and did nothing else -- SM2Service was called from exactly one
place, on *answering*, so an evening spent reading twenty explanations left the
product's model of the learner unchanged apart from twenty timestamps. Home
counted what had been read; nothing anywhere asked whether it had landed.

Three rules shape a check, and each is a decision worth arguing with:

  Different question, same concept. Re-asking the question just explained
  tests whether the last two minutes are still in short-term memory, which is
  not the thing anyone wants to know. Same topic where the bank has one, same
  domain where it does not, never the question itself.

  A check can demote and cannot promote. Passing means the concept transferred
  to a neighbouring question, so the miss is verified and the check question's
  own schedule advances -- it was genuinely answered. It does NOT advance the
  original question's schedule: claiming a question is learnt on the strength
  of a different question is exactly the kind of evidence this product refuses
  everywhere else. Failing resets the original, because a concept that does not
  transfer is not learnt, and that is information the schedule should have.

  Not exam evidence. Check answers live in their own table. Domain accuracy,
  the weak-topic list and readiness all read `exam_answers`, and a check is
  practice on a question chosen *because* the learner just got its neighbour
  wrong -- feeding that back in would drag every one of those numbers down
  and make drilling look like decline.
"""
from datetime import datetime, timedelta, UTC
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.exam_answer import ConfidenceLevel, ExamAnswer
from app.models.question import Question
from app.models.review_check import ReviewCheck
from app.models.spaced_repetition import SpacedRepetition
from app.services.sm2_service import SM2Service


def _now():
    return datetime.now(UTC).replace(tzinfo=None)


# Two constants that turn "pick one of these" into "pick *this* one".
#
# The check used to be drawn with ORDER BY random(), evaluated inside the queue
# fetch -- and Review fetches its queue on every visit, so five consecutive
# loads of the same miss offered four different questions. Nothing was
# corrupted by that, because nothing is recorded until the learner submits; but
# it meant a learner who did not like the question they were given could reload
# until they got one they did. This product's whole discipline is that evidence
# must not be shoppable: the weak-topic rule exists so that drilling a topic
# cannot clear it, and a re-rollable check is the same hole in the same wall.
#
# The obvious stable ordering -- lowest question id -- is stability bought by
# throwing the choice away: every miss in a topic would be checked with the
# same question. So the order is a hash instead, and the miss is mixed into the
# hash's *input* rather than added to its output. That distinction is the whole
# of it: adding the answer id to the finished hash only rotates one fixed
# ordering, and a rotation by a small amount leaves the same question at the
# front, so the first version of this passed the stability test and failed the
# one that says two misses may differ. Shifting the key before multiplying
# re-scrambles the ordering per miss.
#
# Knuth's multiplicative constant spreads consecutive ids across the range; the
# prime modulus keeps the product inside 64-bit arithmetic on the largest bank
# this product will ever see. No new table, no migration, no stored state: the
# same miss against the same bank always produces the same answer.
_SPREAD = 2654435761
_MODULUS = 1000003


def _stable_order(answer_id: int):
    """A fixed pseudo-random ordering of questions, keyed on the miss.

    `Question.id` is appended by the caller as a tiebreaker, so that even a
    modulus collision resolves the same way on every fetch.
    """
    return ((Question.id + answer_id) * _SPREAD) % _MODULUS


def _topic_area(topic: str) -> str:
    """The part of a topic before its facets.

    "Sprint Retrospective: participants" -> "Sprint Retrospective"
    "Product Backlog & Refinement (max 10% capacity rule)" -> "Product Backlog & Refinement"

    Returns the whole topic when it carries no facet marker, which the caller
    then skips as a duplicate of the exact-topic scope.
    """
    for marker in (":", "(", " -- ", " — "):
        head = topic.split(marker, 1)[0].strip()
        if head and head != topic.strip():
            return head
    return topic.strip()


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    # ---- choosing the check ------------------------------------------

    def pick_check_question(self, answer: ExamAnswer) -> Optional[Question]:
        """A different question on the same concept, or None if the bank has none.

        None is a real answer here, not a failure. A topic with exactly one
        question in the bank cannot be checked, and the honest thing is to say
        so rather than to ask a question about something else and call it
        verification.
        """
        missed = answer.question
        if missed is None:
            return None

        already_used = select(ReviewCheck.question_id).where(
            ReviewCheck.answer_id == answer.id
        )

        def candidates(scope):
            return (
                self.db.query(Question)
                .options(joinedload(Question.options))
                .filter(
                    scope,
                    Question.id != missed.id,
                    Question.id.notin_(already_used),
                )
            )

        # Narrowest first. Topics in this bank are written "Area: facets" --
        # "Sprint Retrospective: participants", "Definition of Done & Increment
        # quality" -- so the text before the colon is a real mid-level grouping
        # and a far better neighbour than "anything in this domain". Without
        # that middle step, a miss on "Sprint Retrospective: participants",
        # which is the only question carrying that exact topic, was checked
        # against any of the 287 questions in Understanding and Applying the
        # Scrum Framework. Same domain is transfer in name only.
        scopes = []
        if missed.topic:
            scopes.append(Question.topic == missed.topic)
            area = _topic_area(missed.topic)
            if area and area != missed.topic:
                scopes.append(Question.topic.like(f"{area}%"))
        if missed.domain:
            scopes.append(Question.domain == missed.domain)

        # Fixed for this miss. See _stable_order: the same miss must be offered
        # the same check however many times Review is opened, or a refresh
        # becomes a way to shop for an easier question.
        order = _stable_order(answer.id)

        for scope in scopes:
            # Prefer one the learner has never answered: a question they have
            # already seen tests recall of that sitting rather than transfer.
            unseen = (
                candidates(scope)
                .outerjoin(ExamAnswer, ExamAnswer.question_id == Question.id)
                .filter(ExamAnswer.id.is_(None))
                .order_by(order, Question.id)
                .first()
            )
            if unseen is not None:
                return unseen

            seen = candidates(scope).order_by(order, Question.id).first()
            if seen is not None:
                return seen

        return None

    # ---- recording the result ----------------------------------------

    def record_check(
        self,
        answer: ExamAnswer,
        question: Question,
        selected_option_ids: List[int],
        confidence: ConfidenceLevel = ConfidenceLevel.NOT_SET,
    ) -> ReviewCheck:
        correct_ids = {o.id for o in question.options if o.is_correct}
        passed = bool(selected_option_ids) and set(selected_option_ids) == correct_ids

        check = ReviewCheck(
            answer_id=answer.id,
            question_id=question.id,
            selected_option_ids=list(selected_option_ids),
            passed=passed,
            confidence_level=confidence,
        )
        self.db.add(check)

        # The check question was genuinely answered, so its own schedule moves
        # the way any answer moves it.
        SM2Service.update_item(self.db, question.id, passed, confidence)

        if not passed:
            # A concept that does not transfer is not learnt. Bring the
            # original back at the start of the ladder rather than leaving it
            # wherever the sitting that produced the miss had left it.
            self._reset_schedule(answer.question_id)

        self.db.commit()
        self.db.refresh(check)
        return check

    def _reset_schedule(self, question_id: int) -> None:
        item = (
            self.db.query(SpacedRepetition)
            .filter(SpacedRepetition.question_id == question_id)
            .first()
        )
        if item is None:
            # Never scheduled -- the failing check is reason enough to start.
            SM2Service.update_item(self.db, question_id, False, ConfidenceLevel.NOT_SET)
            return
        item.repetition = 0
        item.interval_days = 1
        # And the due date, which is the only column that decides anything.
        #
        # Resetting repetition and interval alone was a reset that did not
        # take: `count_due`, `get_due_items` and Home's "due for review" all
        # read `next_review_date` and nothing else, so a question sitting 23
        # days out stayed 23 days out. The learner was told "this concept is
        # back near the front of the schedule, so it will come round again
        # soon" and it was not -- and the branch above, for a question that had
        # never been scheduled, made it due tomorrow. The two halves of the
        # same reset disagreed, which is what gave it away.
        item.next_review_date = _now() + timedelta(days=1)
        # `last_reviewed_at` is deliberately not touched: it records the last
        # time this question was actually put to the learner, and the check was
        # a different question.
        #
        # The ease factor is left alone too. It is the running estimate of how
        # hard this question is for this learner, built over every previous
        # encounter; one failed check about a neighbouring question is not
        # grounds to throw that away.

    # ---- what has been verified --------------------------------------

    def verified_count(self, answer_ids: Optional[List[int]] = None) -> int:
        q = self.db.query(func.count(func.distinct(ReviewCheck.answer_id))).filter(
            ReviewCheck.passed.is_(True)
        )
        if answer_ids is not None:
            q = q.filter(ReviewCheck.answer_id.in_(answer_ids))
        return q.scalar() or 0
