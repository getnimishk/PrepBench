# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The evidence the product explains itself with.

Three surfaces landed together in the second correction, and each replaced
something that was silently wrong rather than merely plain:

  1.  Per-domain accuracy. SUM(is_correct) over a Boolean column came back
      through SQLAlchemy's Boolean result processor, so every domain in the
      product reported exactly one correct answer. The reported accuracies
      were N_mocks / answered, which meant the "weakest area" Home has been
      naming was simply the domain with the most questions in it.

  2.  Blockers. The rule could say what state you were in and never why, so
      every surface invented an explanation. Home's was "your weakest area"
      -- the lowest-scoring domain, named as a problem whether or not it was
      one.

  3.  The review queue. The product could count unreviewed misses and could
      not show them. Home's one action said "Review them"; Review restated
      the number; there the trail ended.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.exam_session import ExamSession, ExamStatus
from app.models.exam_answer import ExamAnswer
from app.models.subject import Subject, SubjectKind
from app.repositories.subject_repository import LEARNER, MOCK, SubjectRepository
from app.services import readiness as rules

client = TestClient(app)


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _cert() -> str:
    return "Exp" + uuid.uuid4().hex[:10]


def _subject(db, cert, question_count=4) -> Subject:
    tag = uuid.uuid4().hex[:8]
    subject = Subject(
        name="Explained Subject " + tag,
        slug="exp-" + tag,
        kind=SubjectKind.CERTIFICATION,
        certification=cert,
        pass_mark=85.0,
        exam_question_count=question_count,
        exam_minutes=60,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def _questions(cert, domain, n):
    """n questions in one domain, returning their ids."""
    ids = []
    for i in range(n):
        response = client.post("/api/v1/questions", json={
            "text": f"{domain} question {i} {uuid.uuid4().hex[:8]}",
            "question_type": "single_choice",
            "difficulty": "medium",
            "domain": domain,
            "topic": f"{domain} topic",
            "certification": cert,
            "explanation": f"**Because** of {domain}.\n- the other one is wrong",
            "options": [
                {"option_text": "Right", "is_correct": True, "order_index": 0},
                {"option_text": "Wrong", "is_correct": False, "order_index": 1},
            ],
        })
        assert response.status_code == 201, response.text
        ids.append(response.json()["id"])
    return ids


def _sit_mock(db, subject, cert, question_ids, correct_count):
    """A completed learner mock over exactly these questions."""
    session = ExamSession(
        title="Explained mock",
        exam_mode="timed",
        status=ExamStatus.COMPLETED,
        certification=cert,
        subject_id=subject.id,
        session_kind=MOCK,
        source=LEARNER,
        total_questions=len(question_ids),
        answered_questions=len(question_ids),
        correct_count=correct_count,
        score_percentage=round(correct_count / len(question_ids) * 100, 1),
        passing_percentage=85.0,
        time_allowed_seconds=3600,
        question_ids_order=question_ids,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    for index, qid in enumerate(question_ids):
        question = client.get(f"/api/v1/questions/{qid}").json()
        right = next(o["id"] for o in question["options"] if o["is_correct"])
        wrong = next(o["id"] for o in question["options"] if not o["is_correct"])
        got_it = index < correct_count
        db.add(ExamAnswer(
            session_id=session.id,
            question_id=qid,
            selected_option_ids=[right if got_it else wrong],
            is_correct=got_it,
        ))
    db.commit()
    return session


# ---- 1. Domain accuracy is accuracy ----------------------------------


def test_domain_accuracy_counts_correct_answers_not_mocks(db):
    """Eight of ten right is 80%, not 10%.

    The Boolean SUM came back as True -> 1 whatever the real total, so every
    domain in the product read one correct answer. Ten questions answered
    gave 10%; a hundred gave 1%; and because the number fell as the domain
    grew, the largest domain was always named the weakest.
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=10)
    ids = _questions(cert, "Broad Domain", 10)
    _sit_mock(db, subject, cert, ids, correct_count=8)

    readiness = rules.compute(
        SubjectRepository(db).get_mock_results(subject),
        pass_mark=subject.pass_mark,
        has_exam_profile=True,
    )
    domain = next(d for d in readiness.domains if d.domain == "Broad Domain")
    assert domain.score_pct == 80.0


def test_the_weakest_domain_is_the_weakest_one_not_the_biggest_one(db):
    """The consequence of the bug above, stated as the product promise.

    With accuracy pinned to 1/answered, a 100%-correct domain of forty
    questions scored lower than a 50%-correct domain of four.
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=32)
    big = _questions(cert, "Big Domain", 20)          # all correct
    # Twelve, not four: a domain under MIN_QUESTIONS_PER_DOMAIN reports no
    # score at all, which is the separate and correct behaviour.
    small = _questions(cert, "Small Domain", 12)      # half correct

    # One paper covering both, with the big domain answered perfectly.
    session = ExamSession(
        title="Two-domain mock",
        exam_mode="timed", status=ExamStatus.COMPLETED, certification=cert,
        subject_id=subject.id, session_kind=MOCK, source=LEARNER,
        total_questions=32, answered_questions=32, correct_count=26,
        score_percentage=81.3, passing_percentage=85.0,
        time_allowed_seconds=3600, question_ids_order=big + small,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    for qid in big:
        q = client.get(f"/api/v1/questions/{qid}").json()
        db.add(ExamAnswer(
            session_id=session.id, question_id=qid, is_correct=True,
            selected_option_ids=[next(o["id"] for o in q["options"] if o["is_correct"])],
        ))
    for index, qid in enumerate(small):
        q = client.get(f"/api/v1/questions/{qid}").json()
        right = index < 6
        db.add(ExamAnswer(
            session_id=session.id, question_id=qid, is_correct=right,
            selected_option_ids=[
                next(o["id"] for o in q["options"] if o["is_correct"] == right)
            ],
        ))
    db.commit()

    readiness = rules.compute(
        SubjectRepository(db).get_mock_results(subject),
        pass_mark=subject.pass_mark, has_exam_profile=True,
    )
    assert readiness.weakest_domain == "Small Domain"


# ---- 2. The verdict explains itself ----------------------------------


def test_a_domain_above_the_floor_is_not_reported_as_a_blocker():
    """85% is not a weakness when the floor is 80%.

    Home named the lowest-scoring domain "your weakest area" whatever its
    score, so a learner with no weak area at all was told they had one. An
    invented problem is indistinguishable from a real one, which is what
    makes it expensive.
    """
    mocks = [
        rules.MockResult(
            session_id=i, score_pct=90.0,
            taken_at=rules._now(),
            domain_counts={"Comfortable": (17, 20), "Also fine": (18, 20)},
        )
        for i in range(3)
    ]
    readiness = rules.compute(mocks, pass_mark=85.0)

    assert readiness.weakest_domain == "Comfortable"
    assert not [b for b in readiness.blockers if b.kind == rules.BLOCKER_WEAK_DOMAIN]


def test_a_domain_under_the_floor_is_reported_with_its_numbers():
    mocks = [
        rules.MockResult(
            session_id=i, score_pct=90.0, taken_at=rules._now(),
            domain_counts={"Shaky": (12, 20), "Fine": (19, 20)},
        )
        for i in range(3)
    ]
    readiness = rules.compute(mocks, pass_mark=85.0)

    blocker = next(b for b in readiness.blockers if b.kind == rules.BLOCKER_WEAK_DOMAIN)
    assert blocker.domain == "Shaky"
    assert blocker.value == 60.0
    assert blocker.target == rules.DOMAIN_FLOOR_PCT


def test_a_mock_under_the_pass_mark_is_named_as_the_reason():
    mocks = [
        rules.MockResult(session_id=1, score_pct=82.5, taken_at=rules._now(),
                         domain_counts={"Fine": (19, 20)}),
        rules.MockResult(session_id=2, score_pct=87.5, taken_at=rules._now(),
                         domain_counts={"Fine": (19, 20)}),
        rules.MockResult(session_id=3, score_pct=92.5, taken_at=rules._now(),
                         domain_counts={"Fine": (19, 20)}),
    ]
    readiness = rules.compute(mocks, pass_mark=85.0)

    blocker = next(b for b in readiness.blockers if b.kind == rules.BLOCKER_BELOW_PASS)
    assert blocker.value == 82.5
    assert blocker.count == 1


def test_ready_has_nothing_blocking_it():
    mocks = [
        rules.MockResult(session_id=i, score_pct=93.0, taken_at=rules._now(),
                         domain_counts={"Fine": (19, 20)})
        for i in range(3)
    ]
    readiness = rules.compute(mocks, pass_mark=85.0)

    assert readiness.state is rules.ReadinessState.READY
    assert readiness.blockers == []


def test_improvement_is_reported_only_when_it_is_real():
    """A domain sampled twice in a mock has not "improved 50 points"."""
    tiny = [
        rules.MockResult(session_id=1, score_pct=50.0, taken_at=rules._now(),
                         domain_counts={"Thin": (0, 2)}),
        rules.MockResult(session_id=2, score_pct=100.0, taken_at=rules._now(),
                         domain_counts={"Thin": (2, 2)}),
    ]
    assert rules.compute(tiny, pass_mark=85.0).most_improved is None

    real = [
        rules.MockResult(session_id=1, score_pct=70.0, taken_at=rules._now(),
                         domain_counts={"Solid ground": (14, 20)}),
        rules.MockResult(session_id=2, score_pct=90.0, taken_at=rules._now(),
                         domain_counts={"Solid ground": (18, 20)}),
    ]
    moved = rules.compute(real, pass_mark=85.0).most_improved
    assert moved is not None
    assert moved.domain == "Solid ground"
    assert moved.points == 20.0


# ---- 3. The review queue is real ------------------------------------


def test_the_review_queue_returns_the_misses_with_their_explanations(db):
    cert = _cert()
    subject = _subject(db, cert, question_count=4)
    ids = _questions(cert, "Reviewable Domain", 4)
    _sit_mock(db, subject, cert, ids, correct_count=1)   # three wrong


    session = db.query(ExamSession).filter(
        ExamSession.certification == cert
    ).one()
    queue = client.get("/api/v1/review/queue?limit=20").json()
    mine = [i for i in queue["items"] if i["session_id"] == session.id]

    assert len(mine) == 3
    item = mine[0]
    assert item["question_text"]
    assert item["selected_option_ids"]
    assert any(o["is_correct"] for o in item["options"])
    # Without the explanation the queue is a list of things you got wrong,
    # which is the backlog again rather than a way to learn.
    assert item["explanation"]


def test_marking_an_answer_read_takes_it_out_of_the_queue(db):
    """The count has to be able to go down.

    Before this, the endpoint existed and nothing called it: the unreviewed
    total could only ever rise, which is a guilt mechanic arrived at by
    omission.
    """
    cert = _cert()
    subject = _subject(db, cert, question_count=4)
    ids = _questions(cert, "Clearable Domain", 4)
    session = _sit_mock(db, subject, cert, ids, correct_count=3)  # one wrong

    def mine():
        queue = client.get("/api/v1/review/queue?limit=20").json()
        return [i for i in queue["items"] if i["session_id"] == session.id]

    before = mine()
    assert len(before) == 1

    marked = client.post(
        f"/api/v1/exams/{session.id}/answers/{before[0]['question_id']}/reviewed"
    )
    assert marked.status_code == 200
    assert mine() == []


def test_the_queue_is_bounded_and_says_what_is_behind_it(db):
    cert = _cert()
    subject = _subject(db, cert, question_count=6)
    ids = _questions(cert, "Long Domain", 6)
    _sit_mock(db, subject, cert, ids, correct_count=0)   # six wrong

    full = client.get("/api/v1/review/queue?limit=20").json()
    capped = client.get("/api/v1/review/queue?limit=2").json()

    assert len(capped["items"]) == 2
    assert len(full["items"]) > len(capped["items"])
    # Reported so the slice is honest, never rendered as a debt.
    assert capped["total_unreviewed"] >= 6
    assert capped["remaining"] == capped["total_unreviewed"] - 2


# ---- 4. A weak area can actually be drilled --------------------------


def test_a_drill_can_be_restricted_to_one_domain():
    """"Practise Managing Products with Agility" has to practise it.

    The link from Home and Practice carried the domain and the setup page
    dropped it, so the button did not do what the sentence above it said.
    There was no domain filter to carry it to.
    """
    cert = _cert()
    _questions(cert, "Wanted Domain", 4)
    _questions(cert, "Unwanted Domain", 4)

    response = client.post("/api/v1/exams", json={
        "certification": cert,
        "domains": ["Wanted Domain"],
        "total_questions": 4,
        "exam_mode": "practice",
        "session_kind": "drill",
    })
    assert response.status_code == 201, response.text

    detail = client.get(f"/api/v1/exams/{response.json()['id']}").json()
    assert {q["domain"] for q in detail["questions"]} == {"Wanted Domain"}


def test_a_domain_that_matches_nothing_fails_instead_of_widening():
    cert = _cert()
    _questions(cert, "Real Domain", 3)

    response = client.post("/api/v1/exams", json={
        "certification": cert,
        "domains": ["A Domain That Does Not Exist"],
        "total_questions": 3,
    })

    assert response.status_code == 400, response.text
    assert "A Domain That Does Not Exist" in response.json()["detail"]


# ---- 5. The review schedule is a loop, not a shelf --------------------


def test_answering_a_question_schedules_it_and_a_memory_drill_draws_it_back(db):
    """The spaced-repetition loop, end to end.

    Every piece of this existed and had unit tests -- the SM-2 arithmetic, the
    due query, the drill mode -- and none of them had ever been connected by
    a real session. Until Review grew a one-click memory drill, the schedule
    was written to and never read from, so a regression anywhere along the
    chain would have gone unnoticed indefinitely.

    Answer a question wrongly, wind its due date into the past, and the drill
    that claims to draw "what the schedule has brought round" must draw
    exactly that question and nothing else.
    """
    from datetime import datetime, timedelta, UTC

    from app.models.spaced_repetition import SpacedRepetition

    cert = _cert()
    subject = _subject(db, cert, question_count=4)
    scheduled = _questions(cert, "Scheduled Domain", 1)[0]
    _questions(cert, "Unscheduled Domain", 3)

    # A drill, answered wrongly. save_answer is what drives SM-2.
    created = client.post("/api/v1/exams", json={
        "certification": cert,
        "domains": ["Scheduled Domain"],
        "total_questions": 1,
        "exam_mode": "practice",
        "session_kind": "drill",
        "subject_id": subject.id,
    })
    assert created.status_code == 201, created.text
    session_id = created.json()["id"]

    question = client.get(f"/api/v1/questions/{scheduled}").json()
    wrong = next(o["id"] for o in question["options"] if not o["is_correct"])
    saved = client.post(f"/api/v1/exams/{session_id}/answer", json={
        "question_id": scheduled,
        "selected_option_ids": [wrong],
        "time_spent_seconds": 12,
        "confidence_level": "low",
        "is_flagged": False,
        "is_bookmarked": False,
    })
    assert saved.status_code == 200, saved.text

    # Answering it put it on the schedule at all -- that is the first half.
    item = db.query(SpacedRepetition).filter(
        SpacedRepetition.question_id == scheduled
    ).one()

    # Wind it due. Waiting a day for the assertion is not an option.
    item.next_review_date = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1)
    db.commit()

    drill = client.post("/api/v1/exams", json={
        "exam_mode": "spaced_repetition",
        "total_questions": 20,
        "session_kind": "drill",
        "subject_id": subject.id,
    })
    assert drill.status_code == 201, drill.text

    detail = client.get(f"/api/v1/exams/{drill.json()['id']}").json()
    drawn = {q["id"] for q in detail["questions"]}
    assert scheduled in drawn
    # And nothing that was never scheduled.
    assert all(q["domain"] != "Unscheduled Domain" for q in detail["questions"])
