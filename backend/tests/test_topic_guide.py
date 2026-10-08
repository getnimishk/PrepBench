# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_topic_guide.py

A topic's study guide: AI-drafted, learner-editable, and never invented.

The prototype's guide was placeholder text throughout. The rules held here are
the ones that stop the real one becoming placeholder text by another route: with
no AI there is no draft, an unusable AI answer is a failure rather than something
to pad out, AI-written text stays labelled as AI-written after an edit, and
reading a section is recorded without being mistaken for completing the topic.

The network is never touched -- tests patch the gateway's single transport call.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.llm_fakes import (
    clear_env_provider,
    fake_gemini_text_response,
    patch_gateway_transport,
    set_env_provider,
)

client = TestClient(app)

DRAFT = {
    "sections": [
        {
            "title": "The log is the model",
            "body": "A Kafka topic is split into partitions, each an append-only log.",
            "example": "Three partitions, keys hashed to one of them.",
            "common_mistake": "Assuming ordering holds across a whole topic.",
            "check_question": "Why is ordering only guaranteed within a partition?",
            "check_answer": "Because each partition is a separate log with its own offsets.",
        },
        {
            "title": "Offsets",
            "body": "An offset is a record's position in its partition's log.",
            "example": None,
            "common_mistake": None,
            "check_question": "What does a consumer commit?",
            "check_answer": "The offset of the next record it expects to read.",
        },
    ]
}


@pytest.fixture
def topic():
    roadmap = client.post("/api/v1/roadmaps", json={"title": f"Guide roadmap {uuid.uuid4().hex[:6]}"}).json()
    phase = client.post(f"/api/v1/roadmaps/{roadmap['id']}/phases", json={"name": "Phase 1"}).json()
    created = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
        "phase_id": phase["id"],
        "title": "Topics, Partitions, Offsets",
        "learning_objective": "Understand Kafka's append-only log storage model.",
        "success_criteria": "Explain partition ordering guarantees and how offsets work.",
    }).json()
    yield roadmap["id"], created["id"]
    client.delete(f"/api/v1/roadmaps/{roadmap['id']}")


def _base(roadmap_id, topic_id):
    return f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}/guide"


# ---- 1. no AI, no invention ----------------------------------------------


def test_with_no_ai_configured_nothing_is_drafted_and_it_says_why(topic, monkeypatch):
    clear_env_provider(monkeypatch)
    roadmap_id, topic_id = topic

    guide = client.get(_base(roadmap_id, topic_id)).json()
    assert guide["drafting_available"] is False
    assert "Settings" in guide["drafting_unavailable_reason"]

    result = client.post(f"{_base(roadmap_id, topic_id)}/draft").json()

    assert result["status"] == "unavailable"
    assert result["guide"]["sections"] == [], "placeholder content was saved with no AI configured"


def test_an_unusable_ai_answer_is_a_failure_not_padding(topic, monkeypatch):
    """A provider that answers with nothing usable has produced nothing."""
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response({"sections": [{"title": "", "body": ""}]}))
    roadmap_id, topic_id = topic

    result = client.post(f"{_base(roadmap_id, topic_id)}/draft").json()

    assert result["status"] == "failed"
    assert result["guide"]["sections"] == []


def test_a_provider_error_saves_nothing(topic, monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, None, error="upstream timed out")
    roadmap_id, topic_id = topic

    result = client.post(f"{_base(roadmap_id, topic_id)}/draft").json()

    assert result["status"] == "failed"
    assert result["guide"]["sections"] == []


# ---- 2. a real draft ----------------------------------------------------


def test_an_ai_draft_is_saved_and_labelled_as_ai(topic, monkeypatch):
    set_env_provider(monkeypatch)
    capture = {}
    patch_gateway_transport(monkeypatch, fake_gemini_text_response(DRAFT), capture=capture)
    roadmap_id, topic_id = topic

    result = client.post(f"{_base(roadmap_id, topic_id)}/draft").json()

    assert result["status"] == "drafted"
    sections = result["guide"]["sections"]
    assert [s["title"] for s in sections] == ["The log is the model", "Offsets"]
    assert all(s["source"] == "ai" for s in sections)
    assert sections[0]["check_question"] and sections[0]["check_answer"]
    assert sections[1]["example"] is None, "a null from the model must stay null, not become filler"

    # The topic's success criterion reaches the prompt: the guide is written
    # toward what the learner will have to demonstrate.
    assert "Explain partition ordering guarantees" in str(capture["body"])


def test_a_second_draft_appends_rather_than_replacing_the_learners_work(topic, monkeypatch):
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response(DRAFT))
    roadmap_id, topic_id = topic

    mine = client.post(f"{_base(roadmap_id, topic_id)}/sections", json={
        "title": "My own notes", "body": "What I worked out myself.",
    })
    assert mine.status_code == 201, mine.text

    result = client.post(f"{_base(roadmap_id, topic_id)}/draft").json()

    titles = [s["title"] for s in result["guide"]["sections"]]
    assert titles[0] == "My own notes", "drafting discarded a section the learner wrote"
    assert len(titles) == 3


# ---- 3. editing keeps the true history ----------------------------------


def test_editing_an_ai_section_keeps_it_labelled_ai_and_records_the_edit(topic, monkeypatch):
    """"Drafted by AI, edited by you" is the true history. An edit must not
    launder a model's text into the learner's own."""
    set_env_provider(monkeypatch)
    patch_gateway_transport(monkeypatch, fake_gemini_text_response(DRAFT))
    roadmap_id, topic_id = topic
    section = client.post(f"{_base(roadmap_id, topic_id)}/draft").json()["guide"]["sections"][0]

    edited = client.put(f"{_base(roadmap_id, topic_id)}/sections/{section['id']}", json={
        "title": section["title"], "body": "Corrected: partitions are independent logs.",
    }).json()

    assert edited["source"] == "ai"
    assert edited["edited_at"] is not None
    assert edited["body"] == "Corrected: partitions are independent logs."


def test_a_learner_written_section_is_labelled_as_theirs(topic):
    roadmap_id, topic_id = topic

    created = client.post(f"{_base(roadmap_id, topic_id)}/sections", json={
        "title": "Offsets, in my words", "body": "An offset is a position in the log.",
    }).json()

    assert created["source"] == "learner"
    assert created["generated_by"] is None


def test_a_section_needs_a_title_and_a_body(topic):
    roadmap_id, topic_id = topic
    response = client.post(f"{_base(roadmap_id, topic_id)}/sections", json={"title": "", "body": ""})
    assert response.status_code == 422


# ---- 4. reading is recorded, and is not completion ----------------------


def test_reading_every_section_does_not_complete_the_topic(topic):
    """Reading is a real event, so it is stored -- but it is not evidence. A
    topic is completed only by demonstrating it against its success criterion."""
    roadmap_id, topic_id = topic
    ids = [
        client.post(f"{_base(roadmap_id, topic_id)}/sections", json={"title": f"S{i}", "body": "Body."}).json()["id"]
        for i in range(3)
    ]

    for section_id in ids:
        read = client.put(f"{_base(roadmap_id, topic_id)}/sections/{section_id}/read")
        assert read.status_code == 200 and read.json()["read_at"] is not None

    assert client.get(_base(roadmap_id, topic_id)).json()["read_count"] == 3

    detail = client.get(f"/api/v1/roadmaps/{roadmap_id}").json()
    status = next(t for ph in detail["phases"] for t in ph["topics"] if t["id"] == topic_id)["status"]
    assert status != "completed"


def test_marking_read_can_be_undone(topic):
    roadmap_id, topic_id = topic
    section_id = client.post(f"{_base(roadmap_id, topic_id)}/sections", json={"title": "S", "body": "B"}).json()["id"]
    client.put(f"{_base(roadmap_id, topic_id)}/sections/{section_id}/read")

    undone = client.put(f"{_base(roadmap_id, topic_id)}/sections/{section_id}/read", params={"read": False}).json()

    assert undone["read_at"] is None


# ---- 5. scoping ---------------------------------------------------------


def test_a_section_cannot_be_reached_through_another_topic(topic):
    roadmap_id, topic_id = topic
    section_id = client.post(f"{_base(roadmap_id, topic_id)}/sections", json={"title": "S", "body": "B"}).json()["id"]

    phase = client.get(f"/api/v1/roadmaps/{roadmap_id}").json()["phases"][0]["id"]
    other = client.post(f"/api/v1/roadmaps/{roadmap_id}/topics", json={"phase_id": phase, "title": "Other"}).json()["id"]

    response = client.put(f"{_base(roadmap_id, other)}/sections/{section_id}", json={"title": "x", "body": "y"})
    assert response.status_code == 404


def test_deleting_a_topic_removes_its_guide(topic):
    from app.models.roadmap import TopicGuideSection
    from tests.conftest import TestingSessionLocal

    roadmap_id, topic_id = topic
    client.post(f"{_base(roadmap_id, topic_id)}/sections", json={"title": "S", "body": "B"})

    assert client.delete(f"/api/v1/roadmaps/{roadmap_id}/topics/{topic_id}").status_code == 204

    db = TestingSessionLocal()
    try:
        assert db.query(TopicGuideSection).filter(TopicGuideSection.topic_id == topic_id).count() == 0
    finally:
        db.close()


# ---- 6. content pack study guide alignment -----------------------------


def _adf_preparation() -> int:
    import uuid
    created = client.post("/api/v1/subjects", json={"name": f"ADF guide {uuid.uuid4().hex[:6]}", "kind": "skill"})
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    assert client.post(f"/api/v1/subjects/{sid}/content-packs", json={"pack_id": "adf"}).status_code == 201
    return sid


def test_adf_topic_guide_includes_mapped_content_pack_chapters():
    """An ADF roadmap topic links directly to its authoritative built-in study guide chapters --
    through the ADF pack attached to the roadmap's own preparation, never through its title."""
    roadmap = client.post("/api/v1/roadmaps", json={"title": "ADF Master Roadmap", "subject_id": _adf_preparation()}).json()
    phase = client.post(f"/api/v1/roadmaps/{roadmap['id']}/phases", json={"name": "1. ADF Foundations"}).json()
    t1 = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
        "phase_id": phase["id"],
        "title": "What Azure Data Factory Is",
        "learning_objective": "Understand ADF fundamentals.",
    }).json()
    t2 = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
        "phase_id": phase["id"],
        "title": "ADF vs Databricks vs Synapse vs Fabric Data Factory",
        "learning_objective": "Compare big data and orchestration services.",
    }).json()

    try:
        g1 = client.get(_base(roadmap["id"], t1["id"])).json()
        assert len(g1["mapped_chapters"]) == 1
        assert g1["mapped_chapters"][0]["chapter_id"] == "what-it-is"
        assert g1["mapped_chapters"][0]["pack_id"] == "adf"
        assert g1["mapped_chapters"][0]["chapter_number"] == 1
        assert "orchestrator" in g1["mapped_chapters"][0]["chapter_summary"].lower()

        g2 = client.get(_base(roadmap["id"], t2["id"])).json()
        assert len(g2["mapped_chapters"]) == 2
        chapter_ids = [c["chapter_id"] for c in g2["mapped_chapters"]]
        assert "what-it-is" in chapter_ids
        assert "fabric" in chapter_ids

        # Also verify roadmap detail has linked_pack_id and topic mapped_chapters
        detail = client.get(f"/api/v1/roadmaps/{roadmap['id']}").json()
        assert detail["linked_pack_id"] == "adf"
        assert detail["linked_pack_title"] == "Azure Data Factory"
        d_topic1 = detail["phases"][0]["topics"][0]
        assert len(d_topic1["mapped_chapters"]) == 1
        assert d_topic1["mapped_chapters"][0]["chapter_id"] == "what-it-is"
    finally:
        client.delete(f"/api/v1/roadmaps/{roadmap['id']}")


def test_a_roadmap_is_never_linked_to_a_pack_by_its_name_alone():
    """Phase 7 (WP 7.9): no title, filename or topic-name guessing. A roadmap called
    "ADF Master Roadmap" with ADF's own topic names, but no preparation with the ADF
    pack attached, maps to no chapter at all."""
    roadmap = client.post("/api/v1/roadmaps", json={"title": "ADF Master Roadmap"}).json()
    phase = client.post(f"/api/v1/roadmaps/{roadmap['id']}/phases", json={"name": "1. ADF Foundations"}).json()
    topic = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
        "phase_id": phase["id"], "title": "What Azure Data Factory Is",
    }).json()
    try:
        assert client.get(_base(roadmap["id"], topic["id"])).json()["mapped_chapters"] == []
        detail = client.get(f"/api/v1/roadmaps/{roadmap['id']}").json()
        assert detail["linked_pack_id"] is None
        assert detail["phases"][0]["topics"][0]["mapped_chapters"] == []
    finally:
        client.delete(f"/api/v1/roadmaps/{roadmap['id']}")


def test_a_topic_is_never_mapped_by_its_position():
    """A topic whose title matches nothing in the pack maps to nothing -- not to the
    pack's topic at the same position (the old order_index fallback)."""
    roadmap = client.post("/api/v1/roadmaps", json={"title": "Plan", "subject_id": _adf_preparation()}).json()
    phase = client.post(f"/api/v1/roadmaps/{roadmap['id']}/phases", json={"name": "1. ADF Foundations"}).json()
    unrelated = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
        "phase_id": phase["id"], "title": "Something the pack does not cover",
    }).json()
    numbered = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
        "phase_id": phase["id"], "title": "32",
    }).json()
    three_d = client.post(f"/api/v1/roadmaps/{roadmap['id']}/topics", json={
        "phase_id": phase["id"], "title": "3D Printing",
    }).json()
    try:
        assert client.get(_base(roadmap["id"], unrelated["id"])).json()["mapped_chapters"] == []
        # A title that states a number maps by that number (the pack's own key) ...
        by_number = client.get(_base(roadmap["id"], numbered["id"])).json()["mapped_chapters"]
        assert by_number and all(c["topic_number"] == 32 for c in by_number)
        # ... but a number that merely starts a title is not one.
        assert client.get(_base(roadmap["id"], three_d["id"])).json()["mapped_chapters"] == []
    finally:
        client.delete(f"/api/v1/roadmaps/{roadmap['id']}")
