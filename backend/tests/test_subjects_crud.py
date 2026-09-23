# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_subjects_crud.py

Creating, editing, archiving and deleting preparations.

Preparations were seed-only: `seed_subjects.py` put three in and nothing could
add a fourth, so the prototype's "+ Add preparation" -- which sits in the picker
on every screen -- had nothing to call.

The rules under test are mostly about refusing to create states the rest of the
system cannot represent honestly: a certification with no pass mark cannot be
measured, two preparations sharing a certification string means neither owns the
questions carrying it, and a delete that says it removes 712 questions has to
remove 712 questions.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.roadmap import Roadmap
from app.models.subject import Subject

client = TestClient(app)

BASE = "/api/v1/subjects"


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _name(stem="Prep") -> str:
    return f"{stem} {uuid.uuid4().hex[:8]}"


def _cert() -> str:
    return "Cert-" + uuid.uuid4().hex[:10]


def _certification_payload(**overrides) -> dict:
    payload = {
        "name": _name("Cert Prep"),
        "kind": "certification",
        "certification": _cert(),
        "pass_mark": 85.0,
        "exam_question_count": 80,
        "exam_minutes": 60,
    }
    payload.update(overrides)
    return payload


def _create(payload) -> dict:
    response = client.post(BASE, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _question(cert, subject_id=None):
    body = {
        "text": f"Subjects CRUD probe {uuid.uuid4().hex[:12]}",
        "question_type": "single_choice",
        "difficulty": "medium",
        "domain": "Some Domain",
        "topic": "Some Topic",
        "certification": cert,
        "explanation": "Seeded by the subjects-CRUD suite.",
        "options": [
            {"option_text": "Right", "is_correct": True, "order_index": 0},
            {"option_text": "Wrong", "is_correct": False, "order_index": 1},
        ],
    }
    if subject_id is not None:
        body["subject_id"] = subject_id
    response = client.post("/api/v1/questions", json=body)
    assert response.status_code == 201, response.text
    return response.json()


# ---- 1. create ----------------------------------------------------------


def test_a_certification_can_be_created_with_its_exam_profile():
    body = _create(_certification_payload(name=_name("Scrum")))

    assert body["kind"] == "certification"
    assert body["has_exam_profile"] is True
    assert body["pass_mark"] == 85.0
    assert body["is_archived"] is False


def test_a_skill_can_be_created_without_one():
    body = _create({"name": _name("Kafka"), "kind": "skill"})

    assert body["kind"] == "skill"
    assert body["has_exam_profile"] is False
    assert body["pass_mark"] is None
    # Readiness must report a skill as uncomputable rather than zero -- a skill
    # has no pass mark, so it can never be "ready", only practised.
    assert body["readiness"]["pass_mark"] is None


def test_the_server_derives_the_slug():
    body = _create(_certification_payload(name="Professional Scrum Master II"))
    assert body["slug"].startswith("professional-scrum-master-ii")


def test_two_preparations_with_similar_names_get_distinct_slugs():
    """The slug is unique in the schema, so a collision is a 500 if not handled."""
    stem = f"Duplicate Stem {uuid.uuid4().hex[:6]}"
    first = _create(_certification_payload(name=stem))
    second = _create(_certification_payload(name=stem + " Advanced"))

    assert first["slug"] != second["slug"]


def test_a_name_already_in_use_is_a_conflict():
    """409, not 400: the caller did nothing wrong, the name is simply taken.

    A client retrying a 400 is wasting its time; a 409 tells it to change the
    value.
    """
    taken = _name("Taken")
    _create(_certification_payload(name=taken))

    response = client.post(BASE, json=_certification_payload(name=taken))

    assert response.status_code == 409, response.text
    assert taken in response.json()["detail"]


def test_a_certification_string_already_claimed_is_a_conflict():
    """One certification string, one preparation.

    With two claimants, a question carrying that string can be attributed to
    neither -- resolve_subject_id refuses to guess and the migration backfill
    skips it. Both are right, but the learner just sees questions owned by
    nothing, so the second claim is refused instead.
    """
    shared = _cert()
    holder = _create(_certification_payload(certification=shared))

    response = client.post(BASE, json=_certification_payload(certification=shared))

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert holder["name"] in detail, detail
    assert shared in detail, detail


@pytest.mark.parametrize(
    "missing,label",
    [("pass_mark", "pass mark"), ("exam_question_count", "question count"), ("exam_minutes", "time limit")],
)
def test_a_certification_missing_part_of_its_exam_profile_is_refused(missing, label):
    """All three, or it cannot do the one thing a certification exists for.

    has_exam_profile needs all three and ExamEngine refuses a mock without it, so
    a certification missing one is a row that looks usable and is not. The message
    names which field.
    """
    payload = _certification_payload()
    payload[missing] = None

    response = client.post(BASE, json=payload)

    assert response.status_code == 422, response.text
    assert label in response.text


def test_a_skill_carrying_a_pass_mark_is_refused():
    """A number that can never be measured against is worse than no number."""
    response = client.post(BASE, json={
        "name": _name("Skill"), "kind": "skill", "pass_mark": 70.0,
    })

    assert response.status_code == 422, response.text
    assert "pass mark" in response.text


# ---- 2. adoption of an existing bank ------------------------------------


def test_creating_a_preparation_adopts_unowned_questions_carrying_its_certification():
    """The case that makes this feature useful rather than ceremonial.

    The learner imported a bank first and is adding the preparation it belongs to
    second. Without adoption the new preparation is empty and the bank is
    invisible to it -- which looks exactly like the import having failed.
    """
    cert = _cert()
    for _ in range(4):
        orphan = _question(cert)
        assert orphan["subject_id"] is None, "no preparation existed yet"

    body = _create(_certification_payload(certification=cert))

    assert body["question_count"] == 4, (
        f"created preparation adopted {body['question_count']} of 4 existing questions"
    )


def test_creating_a_preparation_cannot_take_another_preparations_questions():
    """Adoption is limited to unowned questions, and to exact equality.

    Two limits doing two jobs: `subject_id IS NULL` stops it stealing, and exact
    string equality stops the token matching that put a Databricks question in a
    PSM I mock.
    """
    owned_cert = _cert()
    owner = _create(_certification_payload(certification=owned_cert))
    for _ in range(3):
        _question(owned_cert)
    assert client.get(f"{BASE}/{owner['id']}").json()["question_count"] == 3

    newcomer = _create(_certification_payload(certification=_cert()))

    assert newcomer["question_count"] == 0
    assert client.get(f"{BASE}/{owner['id']}").json()["question_count"] == 3


# ---- 3. update and archive ---------------------------------------------


def test_editing_details_leaves_everything_else_alone():
    body = _create(_certification_payload())

    response = client.put(f"{BASE}/{body['id']}", json={
        "description": "Professional Scrum Master I Certification",
        "target_exam_date": "2026-12-01",
    })

    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["description"] == "Professional Scrum Master I Certification"
    assert updated["target_exam_date"] == "2026-12-01"
    # Untouched by an update that did not mention them.
    assert updated["pass_mark"] == body["pass_mark"]
    assert updated["name"] == body["name"]


def test_the_slug_does_not_move_when_the_name_changes():
    """The name is the label; the slug is the identity.

    A slug that moves when the name is edited breaks every link anyone kept.
    """
    body = _create(_certification_payload(name=_name("Original")))
    original_slug = body["slug"]

    response = client.put(f"{BASE}/{body['id']}", json={"name": _name("Renamed")})

    assert response.status_code == 200, response.text
    assert response.json()["slug"] == original_slug


def test_archiving_keeps_everything_and_is_reversible():
    """Archive and delete are different actions and must behave differently.

    The prototype's danger zone offers both: archive "hides it from the picker,
    history and questions are kept"; delete "permanently removes" them.
    """
    cert = _cert()
    body = _create(_certification_payload(certification=cert))
    for _ in range(2):
        _question(cert)

    archived = client.put(f"{BASE}/{body['id']}", json={"is_archived": True})
    assert archived.status_code == 200, archived.text
    assert archived.json()["is_archived"] is True
    assert archived.json()["question_count"] == 2, "archiving removed questions"

    restored = client.put(f"{BASE}/{body['id']}", json={"is_archived": False})
    assert restored.json()["is_archived"] is False


def test_an_archived_preparation_is_hidden_only_when_asked():
    """The default includes archived rows, deliberately.

    Five callers reach GET /subjects with no arguments. Flipping the default
    would silently remove rows from Home, the Practice hub, Analytics, Exam Setup
    and the subject page.
    """
    body = _create(_certification_payload())
    client.put(f"{BASE}/{body['id']}", json={"is_archived": True})

    default_ids = {s["id"] for s in client.get(BASE).json()}
    filtered_ids = {s["id"] for s in client.get(BASE, params={"include_archived": False}).json()}

    assert body["id"] in default_ids
    assert body["id"] not in filtered_ids


def test_a_skill_cannot_acquire_an_exam_profile_by_update():
    """The create schema validates the three fields as a set; an update arrives
    one field at a time, so the check has to read the stored kind."""
    body = _create({"name": _name("Skill"), "kind": "skill"})

    response = client.put(f"{BASE}/{body['id']}", json={"pass_mark": 80.0})

    assert response.status_code == 400, response.text
    assert "pass mark" in response.json()["detail"]


def test_renaming_onto_another_preparations_name_is_a_conflict():
    first = _create(_certification_payload())
    second = _create(_certification_payload())

    response = client.put(f"{BASE}/{second['id']}", json={"name": first["name"]})

    assert response.status_code == 409, response.text


# ---- 4. delete ----------------------------------------------------------


def test_delete_removes_the_questions_and_reports_what_it_removed(db):
    """The numbers the danger zone promises have to be the numbers that happen."""
    cert = _cert()
    body = _create(_certification_payload(certification=cert))
    for _ in range(3):
        _question(cert)

    roadmap = Roadmap(title=f"Plan {uuid.uuid4().hex[:6]}", subject_id=body["id"])
    db.add(roadmap)
    db.commit()
    db.refresh(roadmap)

    response = client.request(
        "DELETE", f"{BASE}/{body['id']}", json={"confirm_name": body["name"]}
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["questions_deleted"] == 3
    assert result["roadmaps_unlinked"] == 1
    assert result["deleted_subject_name"] == body["name"]

    assert client.get(f"{BASE}/{body['id']}").status_code == 404


def test_delete_unlinks_a_roadmap_rather_than_destroying_it(db):
    """The delete copy names questions, mocks and review state.

    It makes no claim on roadmaps, and a roadmap is separately imported content.
    It reappears in the "not linked to a preparation" group rather than vanishing.
    """
    body = _create(_certification_payload())
    roadmap = Roadmap(title=f"Survivor {uuid.uuid4().hex[:6]}", subject_id=body["id"])
    db.add(roadmap)
    db.commit()
    roadmap_id = roadmap.id

    client.request("DELETE", f"{BASE}/{body['id']}", json={"confirm_name": body["name"]})

    db.expire_all()
    survivor = db.query(Roadmap).filter(Roadmap.id == roadmap_id).first()
    assert survivor is not None, "deleting a preparation destroyed its roadmap"
    assert survivor.subject_id is None


def test_a_wrong_confirmation_name_deletes_nothing():
    """Irreversible, with no backup mechanism in this application.

    A mismatch is a refusal, not a silent no-op -- a caller that got a 200 would
    report the preparation as gone.
    """
    cert = _cert()
    body = _create(_certification_payload(certification=cert))
    _question(cert)

    response = client.request(
        "DELETE", f"{BASE}/{body['id']}", json={"confirm_name": "not the name"}
    )

    assert response.status_code == 400, response.text
    assert "did not match" in response.json()["detail"]

    still_there = client.get(f"{BASE}/{body['id']}")
    assert still_there.status_code == 200
    assert still_there.json()["question_count"] == 1


def test_deleting_one_preparation_leaves_anothers_questions_alone():
    """The isolation guarantee, at the most destructive moment there is."""
    keep_cert, go_cert = _cert(), _cert()
    keeper = _create(_certification_payload(certification=keep_cert))
    doomed = _create(_certification_payload(certification=go_cert))
    for _ in range(2):
        _question(keep_cert)
    for _ in range(3):
        _question(go_cert)

    client.request("DELETE", f"{BASE}/{doomed['id']}", json={"confirm_name": doomed["name"]})

    assert client.get(f"{BASE}/{keeper['id']}").json()["question_count"] == 2


# ---- 5. not found ------------------------------------------------------


def test_updating_an_unknown_preparation_is_a_404():
    assert client.put(f"{BASE}/99999999", json={"description": "x"}).status_code == 404


def test_deleting_an_unknown_preparation_is_a_404():
    response = client.request(
        "DELETE", f"{BASE}/99999999", json={"confirm_name": "anything"}
    )
    assert response.status_code == 404
