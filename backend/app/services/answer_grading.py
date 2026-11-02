# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
answer_grading.py

The one rule for whether a learner's answer to a question is right, used by the exam engine and the
review check alike, so the two can never disagree.

An answer is always a list of option ids (`selected_option_ids`). What the list means depends on the
question type:

  * choice types (single, multiple, true/false and the rest): the set of options picked. Right when it
    is exactly the set marked correct. Order doesn't matter.
  * ordering (a "build list" item): every option id, in the order the learner put them. Right when it
    is the options in their stored order (`order_index`, the correct order; the screen shuffles them).
  * matching: one entry per option, in the options' stored order, each the id of the option whose
    `match_target` the learner paired with that option's text; 0 for "not paired yet". Right when
    every option is paired with its own target.

`None` means "not answered": nothing picked, or a list that doesn't yet say a complete answer (an
ordering with options missing, a matching with an option not yet paired). An unanswered question is
never counted as a wrong one (exam_engine.save_answer explains why).
"""
from typing import Iterable, List, Optional

from app.models.question import Question, QuestionType

STRUCTURED_TYPES = (QuestionType.ORDERING, QuestionType.MATCHING)


def _stored_order(question: Question) -> List[int]:
    return [o.id for o in sorted(question.options, key=lambda o: (o.order_index or 0, o.id or 0))]


def grade(question: Question, selected: Optional[Iterable[int]]) -> Optional[bool]:
    picks = list(selected or [])
    if question.question_type == QuestionType.ORDERING:
        expected = _stored_order(question)
        if len(picks) != len(expected) or sorted(picks) != sorted(expected):
            return None
        return picks == expected
    if question.question_type == QuestionType.MATCHING:
        expected = _stored_order(question)
        if len(picks) != len(expected) or any(not p for p in picks):
            return None
        return picks == expected
    if not picks:
        return None
    return {o.id for o in question.options if o.is_correct} == set(picks)
