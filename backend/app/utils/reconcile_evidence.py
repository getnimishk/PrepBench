# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Recognise full papers that were recorded before the app could say so.

For most of PrepBench's life the browser could not send `session_kind`. Every
session it created fell back to the "drill" default, including papers that
were sat at full length, fully answered, under the subject's own timer. The
working database holds six 80-question PSM I papers across 25 days, two of
them above the pass mark, and readiness reported "needs evaluation" on all of
them because not one row said "mock".

That is the false negative behind rule 6: "never invent" and "never miss" are
separate disciplines, and only the first was implemented.

This is the second one. It does not invent evidence -- it stops discarding
evidence that is already there, and only where the row itself proves what it
was.

WHAT THIS CLAIMS, AND WHAT IT DOES NOT

It claims: this row is a full paper sat under exam conditions. That is what
the word "mock" means in this product -- a shape, stated in as many words on
the exam setup screen -- and the row proves the shape.

It does not claim the learner pressed a button marked "mock". No such button
existed. And, importantly, it is not overwriting a choice: `session_kind` was
added by

    ALTER TABLE exam_sessions ADD COLUMN session_kind ... NOT NULL DEFAULT 'drill'

so "drill" on a historical row is a schema default, not something anybody
said. There was no intent recorded either way, which is precisely why the
shape is the only evidence available and why reading it is legitimate.

What remains genuinely ambiguous is motive: an 80-question, 60-minute,
PSM I-filtered paper is both exactly the real exam and exactly what the old
app handed you if you changed nothing. Six of them, each answered to the last
question, across twenty-five days, is not something done by accident -- but
the database cannot prove the learner called it a measurement. So the product
states the rule where it states the count, and every promoted session stays
visible and dated in Review, where it can be disagreed with.

The threshold stored on those rows is ignored on purpose. Five of the six
carry passing_percentage 95.0, which was the app's default at the time and
never the PSM I pass mark; readiness re-judges the raw score against the
subject's own pass mark, so a settings default from August cannot decide
whether a paper passed.

The test is structural and strict:

    * completed, and every question answered
    * exam_mode TIMED
    * exactly as many questions as the subject's exam profile
    * exactly the time allowance the subject's exam profile specifies
    * the subject's own certification
    * learner provenance

A session that fails any of those stays a drill. An abandoned paper, a short
warm-up, a regression test and an untimed practice run all fail, which is the
point: the criteria are the definition of a mock, applied backwards.

Idempotent and cheap, so it runs at every startup rather than once behind a
schema guard -- an install that gained its subjects after its sessions would
otherwise never be reconciled at all.
"""
from typing import List, Tuple

from sqlalchemy.orm import Session

from app.models.exam_session import ExamSession, ExamMode, ExamStatus
from app.models.subject import Subject
from app.repositories.subject_repository import DRILL, LEARNER, MOCK


def reconcile_session_kinds(db: Session) -> List[Tuple[int, str]]:
    """Promote qualifying historical drills to mocks. Returns what changed."""
    subjects = [
        s for s in db.query(Subject).all()
        if s.has_exam_profile and s.certification
    ]
    if not subjects:
        return []

    promoted: List[Tuple[int, str]] = []

    for subject in subjects:
        candidates = (
            db.query(ExamSession)
            .filter(
                ExamSession.session_kind == DRILL,
                ExamSession.source == LEARNER,
                ExamSession.status == ExamStatus.COMPLETED,
                ExamSession.exam_mode == ExamMode.TIMED,
                ExamSession.certification == subject.certification,
                ExamSession.total_questions == subject.exam_question_count,
                ExamSession.time_allowed_seconds == (subject.exam_minutes or 0) * 60,
            )
            .all()
        )
        for session in candidates:
            # Sat, not merely started. A paper walked away from halfway is
            # real learner activity and stays in the history, but it is not a
            # measurement of whether they would pass.
            if session.answered_questions != session.total_questions:
                continue
            session.session_kind = MOCK
            # Bind it to the subject too. Matching by certification string
            # works, but only the id survives a subject being renamed.
            if session.subject_id is None:
                session.subject_id = subject.id
            promoted.append((session.id, subject.name))

    if promoted:
        db.commit()
    return promoted
