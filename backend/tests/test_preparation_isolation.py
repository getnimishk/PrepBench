# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_preparation_isolation.py

Preparation isolation, asserted against realistic certification names.

Why this file exists separately from test_product_invariants.py: that suite's
`_cert()` helper deliberately returns "one unbroken token, so another test's
certification cannot match it through a shared word -- create_exam splits on
punctuation and ILIKEs every piece." That is an honest way to keep those tests
independent, but it also means the whole suite runs on certification strings
that cannot collide, and so it never exercises the matching rule that real
certification names hit.

Real names collide constantly. "PSM I - Professional Scrum Master" tokenises to
PSM / Professional / Scrum / Master, and ExamEngine.create_exam ORs an ILIKE for
every token across BOTH Question.certification AND Question.domain. Any question
in any other preparation whose domain merely contains the word "Master" is
therefore a candidate for a PSM I mock.

These tests pin the behaviour that plan section 8 requires -- "Do not allow AWS
selected + PSM question set" -- using names that actually overlap.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.subject import Subject, SubjectKind

client = TestClient(app)


@pytest.fixture
def db():
    """Matches the local fixture in test_product_invariants.py.

    conftest.py exposes the engine and `TestingSessionLocal` but no session
    fixture, so each suite that needs one defines it.
    """
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---- helpers -------------------------------------------------------------
#
# Deliberately NOT collision-proof ACROSS the pair, because the leak only
# appears when words are shared -- but unique PER TEST, because two
# preparations claiming the same certification string is a misconfiguration
# rather than the thing under test, and the repository refuses to attribute a
# question in that case.


def _cert_pair():
    """A certification name for each of two preparations.

    Unique to the calling test, and sharing the word "Professional" plus the
    tag. That overlap is the whole point: it is what the old token/ILIKE match
    treated as evidence of ownership.
    """
    tag = uuid.uuid4().hex[:6]
    return (
        f"PSM {tag} I - Professional Scrum Master",
        f"Databricks {tag} Certified Data Engineer Professional",
    )


def _subject(db, name, cert, question_count=3) -> Subject:
    tag = uuid.uuid4().hex[:8]
    subject = Subject(
        name=f"{name} {tag}",
        slug=f"{name.lower().replace(' ', '-')}-{tag}",
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


def _question(cert, domain, topic="Isolation Topic"):
    """One question, filed under `cert` with domain `domain`."""
    response = client.post(
        "/api/v1/questions",
        json={
            "text": f"Isolation probe {uuid.uuid4().hex[:12]}",
            "question_type": "single_choice",
            "difficulty": "medium",
            "domain": domain,
            "topic": topic,
            "certification": cert,
            "explanation": "Seeded by the preparation-isolation suite.",
            "options": [
                {"option_text": "Right", "is_correct": True, "order_index": 0},
                {"option_text": "Wrong", "is_correct": False, "order_index": 1},
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _exam_questions(subject_id, total=3, kind="mock"):
    created = client.post(
        "/api/v1/exams",
        json={"subject_id": subject_id, "session_kind": kind, "total_questions": total},
    )
    assert created.status_code == 201, created.text
    detail = client.get(f"/api/v1/exams/{created.json()['id']}")
    assert detail.status_code == 200, detail.text
    return detail.json()["questions"]


# ---- 1. the leak ---------------------------------------------------------


def test_a_mock_excludes_another_preparations_questions_that_share_a_word(db):
    """A Databricks question must not appear in a PSM I mock.

    The two certification names share the word "Professional". Nothing else
    about these questions is related: different certification, different domain,
    different topic. Sharing one English word in the certification name is not
    evidence that a question belongs to a preparation.
    """
    psm_cert, dbx_cert = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert, question_count=3)
    # A real second preparation, so its questions are genuinely owned by
    # something else rather than merely unowned. Unowned questions are excluded
    # too (see below), and a test that only proved that would be weaker than it
    # looks.
    _subject(db, "Databricks", dbx_cert, question_count=3)

    for _ in range(3):
        _question(psm_cert, domain="Scrum Events")
    # The other preparation's questions. "Professional" is the shared token.
    for _ in range(5):
        _question(dbx_cert, domain="Delta Lake")

    certifications = {q["certification"] for q in _exam_questions(psm.id, total=3)}

    assert certifications == {psm_cert}, (
        "A PSM I mock drew questions from another preparation: "
        f"{sorted(certifications)}"
    )


def test_a_mock_excludes_questions_whose_domain_shares_a_certification_word(db):
    """Domain is not a certification.

    create_exam ORs `Question.domain.ilike('%Master%')` into the candidate set
    for "PSM I - Professional Scrum Master". A question about mastering Delta
    Lake is not a Scrum question, and a domain that happens to contain the word
    is not a claim of ownership.
    """
    psm_cert, dbx_cert = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert, question_count=3)
    _subject(db, "Databricks", dbx_cert, question_count=3)

    for _ in range(3):
        _question(psm_cert, domain="Scrum Events")
    # Filed under a different certification entirely; only the DOMAIN collides.
    for _ in range(5):
        _question(dbx_cert, domain="Delta Lake Mastery")

    certifications = {q["certification"] for q in _exam_questions(psm.id, total=3)}

    assert certifications == {psm_cert}, (
        "A PSM I mock drew questions from another preparation via a domain "
        f"word match: {sorted(certifications)}"
    )


# ---- 2. the legitimate case must keep working ---------------------------


def test_a_preparation_still_finds_its_own_questions(db):
    """The counterpart to the two tests above.

    Tightening the match must not tighten it to nothing. This is the test that
    fails if isolation is fixed by simply refusing to match.
    """
    psm_cert, _ = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert, question_count=3)
    for _ in range(4):
        _question(psm_cert, domain="Scrum Events")

    questions = _exam_questions(psm.id, total=3)

    assert len(questions) == 3
    assert {q["certification"] for q in questions} == {psm_cert}


def test_a_question_created_under_a_known_certification_is_attributed(db):
    """The write-time half of the same rule.

    Nothing in the product sends `subject_id` when creating a question -- the
    importers know a certification name and not a subject id -- so if create
    did not resolve it, every imported question would be unowned and its
    preparation's mock would find nothing. That failure would look exactly like
    an empty question bank, which is why it gets its own test.
    """
    psm_cert, _ = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert, question_count=3)

    created = _question(psm_cert, domain="Scrum Events")

    assert created["subject_id"] == psm.id


def test_a_question_whose_certification_matches_no_preparation_stays_unowned(db):
    """Unowned is a real state, and it is not a licence to appear anywhere.

    "General Prep" is the column default, so unowned questions exist in every
    install. They must not drift into a preparation's mock -- that is the same
    fabricated ownership the subject_id column removes, arriving by a different
    route.
    """
    psm_cert, _ = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert, question_count=3)
    for _ in range(3):
        _question(psm_cert, domain="Scrum Events")

    orphan = _question("A Certification No Preparation Claims", domain="Scrum Events")
    assert orphan["subject_id"] is None

    ids = {q["id"] for q in _exam_questions(psm.id, total=3)}
    assert orphan["id"] not in ids


# ---- 3. what the surface counts must be what the engine draws -----------


def test_the_reported_question_count_agrees_with_what_an_exam_can_draw(db):
    """One number, one source.

    `question_count` on the subjects endpoint exists so a surface can tell
    whether a preparation can be sat before it offers to start one -- its own
    comment says a fresh install once offered "Take your first mock" against an
    empty bank and the engine correctly refused, leaving a new user's only
    offered action an error message.

    That only works while the count and the engine agree. The engine now scopes
    by Question.subject_id; a count that still matches on the certification
    string reports 0 for any preparation whose questions were bound by id rather
    than inherited from a matching name -- which is every preparation a learner
    assigns questions to by hand, and every skill subject, because a skill has
    no certification string to match at all.
    """
    tag = uuid.uuid4().hex[:8]
    skill = Subject(
        name=f"Skill With A Bank {tag}",
        slug=f"skill-bank-{tag}",
        kind=SubjectKind.SKILL,
        certification=None,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)

    # Bound by id, which is the only way a skill subject can own a question.
    for _ in range(3):
        response = client.post(
            "/api/v1/questions",
            json={
                "text": f"Bound by id {uuid.uuid4().hex[:12]}",
                "question_type": "single_choice",
                "difficulty": "medium",
                "domain": "Lakehouse",
                "topic": "Delta",
                "certification": "General Prep",
                "subject_id": skill.id,
                "explanation": "Seeded by the preparation-isolation suite.",
                "options": [
                    {"option_text": "Right", "is_correct": True, "order_index": 0},
                    {"option_text": "Wrong", "is_correct": False, "order_index": 1},
                ],
            },
        )
        assert response.status_code == 201, response.text

    reported = client.get(f"/api/v1/subjects/{skill.id}")
    assert reported.status_code == 200, reported.text

    assert reported.json()["question_count"] == 3, (
        "the subjects endpoint reported "
        f"{reported.json()['question_count']} questions for a preparation that "
        "owns 3 -- the count and the exam engine are reading different columns"
    )

    # And the engine really can draw them, which is what the count is claiming.
    drawn = client.post(
        "/api/v1/exams",
        json={"subject_id": skill.id, "session_kind": "drill", "total_questions": 3},
    )
    assert drawn.status_code == 201, drawn.text


# ---- 4. the skill-subject hole ------------------------------------------


def test_a_skill_subject_draws_only_its_own_questions(db):
    """A preparation with no certification string is still a scope.

    This was the second half of the same defect and the more surprising one. A
    skill subject has certification=None (Databricks and System Design both do,
    in seed_subjects.py), so no certification filter was built at all -- and a
    filter of nothing is not a narrow scope, it is every question in the
    database. A Databricks drill served Scrum questions.

    The honest answer for a skill subject with no bank is a refusal, which is
    what the "matches nothing" guard already gives. The wrong answer is
    everything.
    """
    psm_cert, _ = _cert_pair()
    _subject(db, "Scrum PSM", psm_cert, question_count=3)
    for _ in range(5):
        _question(psm_cert, domain="Scrum Events")

    tag = uuid.uuid4().hex[:8]
    skill = Subject(
        name=f"Skill Without An Exam {tag}",
        slug=f"skill-{tag}",
        kind=SubjectKind.SKILL,
        certification=None,
        pass_mark=None,
        exam_question_count=None,
        exam_minutes=None,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)

    response = client.post(
        "/api/v1/exams",
        json={"subject_id": skill.id, "session_kind": "drill", "total_questions": 3},
    )

    assert response.status_code == 400, (
        "A skill subject with no question bank was given an exam anyway: "
        f"{response.text[:300]}"
    )
    # And it names the real cause. "Widen the selection" would be advice the
    # learner cannot act on -- there is no filter to loosen, only a bank to
    # import -- and this is the normal state of a newly added preparation, so
    # it is the first thing many people will see.
    detail = response.json()["detail"]
    assert skill.name in detail, detail
    assert "no questions yet" in detail, detail


def test_a_too_narrow_filter_names_the_preparation_not_its_certification(db):
    """The refusal has to name something the learner recognises.

    They picked a preparation from a picker; they have very likely never seen
    the certification string that used to be quoted back at them.
    """
    psm_cert, _ = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert, question_count=3)
    for _ in range(3):
        _question(psm_cert, domain="Scrum Events")

    response = client.post(
        "/api/v1/exams",
        json={
            "subject_id": psm.id,
            "session_kind": "drill",
            "total_questions": 3,
            "domains": ["A Domain This Preparation Does Not Have"],
        },
    )

    assert response.status_code == 400, response.text
    detail = response.json()["detail"]
    assert psm.name in detail, detail
    assert psm_cert not in detail, (
        "the refusal quoted the certification string at the learner: " + detail
    )


# ---- 5. imports must attribute too --------------------------------------


def test_an_imported_question_is_attributed_to_its_preparation(db):
    """The import path must bind questions the same way create does.

    ImportService.import_validated_batch built Question rows directly rather
    than through QuestionRepository.create, so it skipped resolve_subject_id.
    Before preparations scoped by foreign key that went unnoticed -- the fuzzy
    certification match found imported questions anyway. After it, a freshly
    imported bank landed unowned: present in "All questions", invisible to its
    own preparation's mocks and Question Bank. Every import route (confirm, JSON,
    Markdown, CSV, Excel) funnels through that one function.
    """
    psm_cert, _ = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert, question_count=3)

    response = client.post("/api/v1/imports/confirm", json=[
        {
            "text": f"Imported question {i} {uuid.uuid4().hex[:8]}",
            "question_type": "single_choice",
            "difficulty": "medium",
            "domain": "Scrum Events",
            "topic": "Imported",
            "certification": psm_cert,
            "explanation": "Imported by the isolation suite.",
            "options": [
                {"option_text": "Right", "is_correct": True, "order_index": 0},
                {"option_text": "Wrong", "is_correct": False, "order_index": 1},
            ],
        }
        for i in range(3)
    ])
    assert response.status_code == 200, response.text
    assert response.json()["success_count"] == 3

    owned = client.get("/api/v1/questions", params={"subject_id": psm.id, "limit": 50}).json()
    assert owned["total"] == 3, (
        f"imported questions were not attributed: {owned['total']} of 3 owned by "
        "their preparation"
    )

    # And the preparation can actually sit a paper from them.
    exam = client.post("/api/v1/exams", json={"subject_id": psm.id, "session_kind": "mock", "total_questions": 3})
    assert exam.status_code == 201, exam.text


def test_an_import_does_not_attribute_to_a_contested_certification(db):
    """Same refusal as create: two preparations claiming one string owns neither."""
    shared, _ = _cert_pair()
    _subject(db, "First", shared, question_count=3)
    _subject(db, "Second", shared, question_count=3)

    response = client.post("/api/v1/imports/confirm", json=[{
        "text": f"Contested import {uuid.uuid4().hex[:8]}",
        "question_type": "single_choice",
        "difficulty": "medium",
        "domain": "D",
        "topic": "T",
        "certification": shared,
        "options": [
            {"option_text": "Right", "is_correct": True, "order_index": 0},
            {"option_text": "Wrong", "is_correct": False, "order_index": 1},
        ],
    }])
    assert response.status_code == 200, response.text

    found = client.get("/api/v1/questions", params={"certification": shared}).json()["items"]
    assert found and all(q["subject_id"] is None for q in found)


def test_a_memory_drill_draws_only_the_preparations_own_due_questions(db):
    """Spaced repetition is a schedule of questions, and questions belong to one preparation.

    The due list was global, so a memory drill started from one preparation drew
    whatever any preparation had due -- and Review offered the drill on a global
    count. Both now read the question's own preparation.
    """
    from datetime import timedelta

    from app.core.timeutils import utc_now_naive
    from app.models.spaced_repetition import SpacedRepetition

    psm_cert, dbx_cert = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert)
    dbx = _subject(db, "Databricks", dbx_cert)
    idle_cert = f"Idle {uuid.uuid4().hex[:6]} Certification"
    idle = _subject(db, "Idle", idle_cert)

    past = utc_now_naive() - timedelta(days=1)
    psm_ids = {_question(psm_cert, domain="Scrum Events")["id"] for _ in range(2)}
    dbx_ids = {_question(dbx_cert, domain="Delta Lake")["id"] for _ in range(3)}
    _question(idle_cert, domain="Nothing Due")
    for question_id in psm_ids | dbx_ids:
        db.add(SpacedRepetition(question_id=question_id, next_review_date=past))
    db.commit()

    created = client.post("/api/v1/exams", json={
        "subject_id": psm.id, "exam_mode": "spaced_repetition",
        "session_kind": "drill", "total_questions": 20,
    })
    assert created.status_code == 201, created.text
    drawn = {q["id"] for q in client.get(f"/api/v1/exams/{created.json()['id']}").json()["questions"]}
    assert drawn == psm_ids, f"a PSM memory drill drew {drawn - psm_ids} from another preparation"

    queue = client.get("/api/v1/review/queue", params={"subject_id": dbx.id}).json()
    assert queue["spaced_due"] == 3

    refused = client.post("/api/v1/exams", json={
        "subject_id": idle.id, "exam_mode": "spaced_repetition",
        "session_kind": "drill", "total_questions": 20,
    })
    assert refused.status_code == 400
    assert f"Nothing in {idle.name} is due" in refused.json()["detail"]


def test_continue_offers_only_the_preparations_own_unfinished_session(db):
    """Home and Practice lead with "Continue". It must not open another preparation.

    The resumable session was global, so with PSM I picked, both pages offered a
    half-done Databricks drill and opened its runner under a picker saying PSM I.
    """
    from datetime import datetime, UTC

    from app.models.exam_session import ExamSession, ExamStatus

    psm_cert, dbx_cert = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert)
    dbx = _subject(db, "Databricks", dbx_cert)
    unfinished = ExamSession(
        title="Half-done Databricks drill", session_kind="drill", source="learner",
        status=ExamStatus.IN_PROGRESS, subject_id=dbx.id, certification=dbx_cert,
        total_questions=10, answered_questions=4,
        start_time=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(unfinished)
    db.commit()

    per_subject = {row["subject_id"]: row for row in client.get("/api/v1/home").json()["per_subject"]}

    assert per_subject[psm.id]["resumable"] is None, (
        "PSM I was offered another preparation's unfinished session: "
        f"{per_subject[psm.id]['resumable']}"
    )
    assert per_subject[dbx.id]["resumable"]["session_id"] == unfinished.id


def test_reviews_history_lists_only_the_preparations_own_sessions(db):
    from datetime import datetime, UTC

    from app.models.exam_session import ExamSession, ExamStatus

    psm_cert, dbx_cert = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert)
    dbx = _subject(db, "Databricks", dbx_cert)
    now = datetime.now(UTC).replace(tzinfo=None)
    for subject, cert, title in ((psm, psm_cert, "PSM drill"), (dbx, dbx_cert, "Databricks drill")):
        db.add(ExamSession(
            title=f"{title} {uuid.uuid4().hex[:6]}", session_kind="drill", source="learner",
            status=ExamStatus.COMPLETED, subject_id=subject.id, certification=cert,
            total_questions=5, answered_questions=5, score_percentage=60.0,
            start_time=now, end_time=now,
        ))
    db.commit()

    titles = [i["title"] for i in client.get(
        "/api/v1/home/activity", params={"subject_id": psm.id, "limit": 200}
    ).json()]

    assert any(t.startswith("PSM drill") for t in titles)
    assert not any(t.startswith("Databricks drill") for t in titles), titles


# ---- practice preview -----------------------------------------------------


def _preview(**body):
    response = client.post("/api/v1/exams/preview", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_the_preview_counts_only_the_preparations_own_questions_and_filters_change_it(db):
    """Custom practice must actually change the session composition -- and say so first."""
    psm_cert, dbx_cert = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert)
    _subject(db, "Databricks", dbx_cert)
    for _ in range(3):
        _question(psm_cert, domain="Scrum Events")
    for _ in range(2):
        _question(psm_cert, domain="Scrum Roles")
    for _ in range(4):
        _question(dbx_cert, domain="Scrum Events")  # same domain name, other preparation

    everything = _preview(subject_id=psm.id, session_kind="drill", total_questions=20)
    assert everything["can_start"] is True
    assert everything["available"] == 5
    assert everything["will_draw"] == 5
    assert everything["never_attempted"] == 5

    events = _preview(subject_id=psm.id, session_kind="drill", total_questions=2, domains=["Scrum Events"])
    assert events["available"] == 3, "another preparation's same-named domain leaked into the pool"
    assert events["will_draw"] == 2


def test_the_preview_refuses_with_the_engines_own_words(db):
    """A preview that promised a set the engine then refused would be worse than none."""
    psm_cert, _ = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert)
    _question(psm_cert, domain="Scrum Events")

    body = {"subject_id": psm.id, "session_kind": "drill", "total_questions": 5, "domains": ["Nowhere"]}
    preview = _preview(**body)
    started = client.post("/api/v1/exams", json=body)

    assert preview["can_start"] is False
    assert started.status_code == 400
    assert preview["reason"] == started.json()["detail"]


def test_the_preview_sorts_the_pool_by_the_learners_own_evidence(db):
    """Missed, then due, then never attempted, then answered right every time."""
    from datetime import datetime, UTC, timedelta

    from app.models.exam_answer import ExamAnswer
    from app.models.exam_session import ExamSession, ExamStatus
    from app.models.spaced_repetition import SpacedRepetition

    psm_cert, _ = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert)
    missed, due, unseen, right = (_question(psm_cert, domain="Scrum Events")["id"] for _ in range(4))

    now = datetime.now(UTC).replace(tzinfo=None)
    sitting = ExamSession(
        title="Earlier drill", session_kind="drill", source="learner", status=ExamStatus.COMPLETED,
        subject_id=psm.id, certification=psm_cert, total_questions=3, answered_questions=3,
        start_time=now - timedelta(days=2), end_time=now - timedelta(days=2),
    )
    db.add(sitting)
    db.flush()
    for question_id, correct in ((missed, False), (due, True), (right, True)):
        db.add(ExamAnswer(session_id=sitting.id, question_id=question_id, selected_option_ids=[1], is_correct=correct))
    db.add(SpacedRepetition(question_id=due, next_review_date=now - timedelta(hours=1)))
    db.add(SpacedRepetition(question_id=missed, next_review_date=now - timedelta(hours=1)))
    db.commit()

    preview = _preview(subject_id=psm.id, session_kind="drill", total_questions=10)

    assert preview["available"] == 4
    assert (preview["previously_missed"], preview["due_for_review"],
            preview["never_attempted"], preview["answered_correctly"]) == (1, 1, 1, 1)
    assert unseen  # named for readability of the setup above


def test_the_filter_values_offered_are_the_preparations_own(db):
    psm_cert, dbx_cert = _cert_pair()
    psm = _subject(db, "Scrum PSM", psm_cert)
    _subject(db, "Databricks", dbx_cert)
    _question(psm_cert, domain="Scrum Events", topic="Sprint Review")
    _question(dbx_cert, domain="Delta Lake", topic="Time Travel")

    filters = client.get("/api/v1/questions/filters", params={"subject_id": psm.id}).json()

    assert filters["domains"] == ["Scrum Events"]
    assert filters["topics"] == ["Sprint Review"]
