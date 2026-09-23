# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Global search: one box over questions, study guides, roadmaps, topics and
recordings, scoped the way each of those areas is already scoped.

Every test searches for a token it made up, so rows other tests leave behind in
the shared test database cannot match.
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.interview_question import InterviewQuestion, InterviewRoundType
from app.models.practice_recording import PracticeRecording
from app.models.recording_analysis import RecordingAnalysis
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic, TopicGuideSection
from app.models.subject import Subject, SubjectKind
from app.services.search_service import excerpt

client = TestClient(app)


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _token() -> str:
    return f"zq{uuid.uuid4().hex[:10]}"


def _subject(db, label: str) -> Subject:
    tag = uuid.uuid4().hex[:8]
    subject = Subject(
        name=f"{label} {tag}", slug=f"{label.lower()}-{tag}", kind=SubjectKind.CERTIFICATION,
        certification=f"{label} certification {tag}", pass_mark=85.0, exam_question_count=10, exam_minutes=30,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def _question(subject: Subject, text: str, explanation: str = "An explanation.") -> dict:
    response = client.post("/api/v1/questions", json={
        "text": text,
        "question_type": "single_choice",
        "difficulty": "hard",
        "domain": "Search domain",
        "topic": "Search topic",
        "certification": subject.certification,
        "subject_id": subject.id,
        "explanation": explanation,
        "options": [
            {"option_text": "Right", "is_correct": True, "order_index": 0},
            {"option_text": "Wrong", "is_correct": False, "order_index": 1},
        ],
    })
    assert response.status_code == 201, response.text
    return response.json()


def _roadmap(
    db, title: str, subject: Subject | None, archived: bool = False, topic_title: str = "A topic",
) -> tuple[Roadmap, RoadmapTopic]:
    roadmap = Roadmap(title=title, subject_id=subject.id if subject else None, is_archived=archived)
    db.add(roadmap)
    db.flush()
    phase = RoadmapPhase(roadmap_id=roadmap.id, name="Foundations", order_index=0)
    db.add(phase)
    db.flush()
    topic = RoadmapTopic(roadmap_id=roadmap.id, phase_id=phase.id, title=topic_title, order_index=0)
    db.add(topic)
    db.commit()
    db.refresh(roadmap)
    db.refresh(topic)
    return roadmap, topic


def _search(q: str, subject: Subject | None = None, limit: int | None = None) -> dict:
    params = {"q": q}
    if subject is not None:
        params["subject_id"] = subject.id
    if limit is not None:
        params["limit"] = limit
    response = client.get("/api/v1/search", params=params)
    assert response.status_code == 200, response.text
    return response.json()


# ---- questions -----------------------------------------------------------


def test_questions_are_the_preparations_own_and_counted_the_way_the_bank_counts_them(db):
    token = _token()
    mine, theirs = _subject(db, "Mine"), _subject(db, "Theirs")
    for n in range(8):
        _question(mine, f"Question {n} about {token}")
    _question(theirs, f"Someone else's question about {token}")

    found = _search(token, mine, limit=6)

    assert found["subject_id"] == mine.id and found["subject_name"] == mine.name
    assert found["questions"]["total"] == 8
    assert len(found["questions"]["items"]) == 6
    assert all(token in item["text"] for item in found["questions"]["items"])
    assert all("Someone else" not in item["text"] for item in found["questions"]["items"])

    # "See all in the Question Bank" opens the bank with the same keyword and
    # preparation, and it must land on the same number and the same first rows.
    bank = client.get("/api/v1/questions", params={"keyword": token, "subject_id": mine.id, "limit": 6}).json()
    assert bank["total"] == found["questions"]["total"]
    assert [q["id"] for q in bank["items"]] == [q["id"] for q in found["questions"]["items"]]


def test_without_a_preparation_every_preparations_questions_are_searched(db):
    token = _token()
    _question(_subject(db, "One"), f"First {token}")
    _question(_subject(db, "Two"), f"Second {token}")

    assert _search(token)["questions"]["total"] == 2


def test_what_was_typed_is_matched_literally(db):
    token = _token()
    subject = _subject(db, "Literal")
    _question(subject, f"{token} scored 100% on the paper")
    _question(subject, f"{token} scored 1000 on the paper")
    _question(subject, f"{token} uses event_id as the key")
    _question(subject, f"{token} uses eventXid as the key")

    assert _search(f"{token} scored 100%", subject)["questions"]["total"] == 1
    assert _search(f"{token} uses event_id", subject)["questions"]["total"] == 1
    # The bank reads the keyword the same way.
    bank = client.get("/api/v1/questions", params={"keyword": f"{token} scored 100%", "subject_id": subject.id}).json()
    assert bank["total"] == 1


# ---- guides, roadmaps and topics -----------------------------------------


def test_guide_sections_come_from_this_preparations_roadmaps_and_unlinked_ones(db):
    token = _token()
    mine, theirs = _subject(db, "Guides"), _subject(db, "Elsewhere")
    _, my_topic = _roadmap(db, "My plan", mine)
    _, their_topic = _roadmap(db, "Their plan", theirs)
    _, loose_topic = _roadmap(db, "Loose plan", None)
    _, archived_topic = _roadmap(db, "Old plan", mine, archived=True)
    long_body = ("Filler sentence about something else entirely. " * 6) + f"The {token} is the heart of it. " + ("More filler text follows here. " * 6)
    db.add_all([
        TopicGuideSection(topic_id=my_topic.id, title="Events", body=long_body, source="ai", read_at=datetime(2026, 1, 1)),
        TopicGuideSection(topic_id=their_topic.id, title="Theirs", body=f"About {token}.", source="learner"),
        TopicGuideSection(topic_id=loose_topic.id, title=f"All about {token}", body="Nothing in the body.", source="learner"),
        TopicGuideSection(topic_id=archived_topic.id, title="Archived", body=f"About {token}.", source="learner"),
    ])
    db.commit()

    guides = _search(token, mine)["guides"]

    assert guides["total"] == 2
    by_title = {item["title"]: item for item in guides["items"]}
    assert set(by_title) == {"Events", f"All about {token}"}
    events = by_title["Events"]
    assert events["written_by"] == "ai" and events["read"] is True
    assert events["topic_id"] == my_topic.id and events["roadmap_title"] == "My plan"
    # The sentence around the match, cut at words, not the whole body.
    assert token in events["excerpt"]
    assert events["excerpt"].startswith("…") and events["excerpt"].endswith("…")
    assert len(events["excerpt"]) < len(long_body)
    # A title match excerpts the start of the body.
    assert by_title[f"All about {token}"]["excerpt"] == "Nothing in the body."


def test_roadmaps_and_topics_are_found_by_their_own_words(db):
    token = _token()
    mine = _subject(db, "Plans")
    roadmap, topic = _roadmap(db, f"Kafka {token} mastery", mine)
    loose, _ = _roadmap(db, f"Unlinked {token} plan", None)
    other, other_topic = _roadmap(db, "Another plan", mine)
    other_topic.learning_objective = f"Explain {token} partitions."
    db.commit()

    found = _search(token, mine)

    roadmaps = {item["id"]: item for item in found["roadmaps"]["items"]}
    assert found["roadmaps"]["total"] == 2
    assert roadmaps[roadmap.id] == {
        "id": roadmap.id, "title": f"Kafka {token} mastery", "phase_count": 1, "topic_count": 1, "linked": True,
    }
    assert roadmaps[loose.id]["linked"] is False
    topics = found["topics"]
    assert topics["total"] == 1
    assert topics["items"][0] == {
        "id": other_topic.id, "title": "A topic", "status": "not_started",
        "phase_name": "Foundations", "roadmap_id": other.id, "roadmap_title": "Another plan",
    }


# ---- recordings ----------------------------------------------------------


def test_recordings_are_found_by_title_question_or_transcript_whichever_preparation_is_picked(db):
    token = _token()
    question = InterviewQuestion(round_type=InterviewRoundType.BEHAVIORAL, question_text=f"Tell me about {token}.")
    db.add(question)
    db.flush()
    by_question = PracticeRecording(title="Behavioral take", file_path="x.webm", interview_question_id=question.id,
                                    created_at=datetime(2026, 5, 1))
    by_transcript = PracticeRecording(title="Freeform", file_path="y.webm", duration_seconds=95,
                                      created_at=datetime(2026, 5, 2))
    db.add_all([by_question, by_transcript])
    db.flush()
    db.add(RecordingAnalysis(recording_id=by_transcript.id, transcript=f"I once handled {token} badly.",
                             analysis_status="analyzed"))
    db.commit()

    found = _search(token, _subject(db, "Any"))["recordings"]

    assert found["total"] == 2
    # Newest first.
    assert [item["id"] for item in found["items"]] == [by_transcript.id, by_question.id]
    assert found["items"][0]["analysis_status"] == "analyzed"
    assert found["items"][0]["duration_seconds"] == 95
    assert found["items"][1]["question_text"] == f"Tell me about {token}."
    assert found["items"][1]["analysis_status"] is None


# ---- the request ---------------------------------------------------------


def test_a_blank_search_is_refused_rather_than_matching_everything():
    response = client.get("/api/v1/search", params={"q": "   "})
    assert response.status_code == 400
    assert "blank" in response.json()["detail"]


def test_an_unknown_preparation_is_not_found():
    assert client.get("/api/v1/search", params={"q": "x", "subject_id": 999999}).status_code == 404


@pytest.mark.parametrize("params", [{"q": ""}, {"q": "x", "limit": 0}, {"q": "x", "limit": 51}, {"q": "x" * 201}])
def test_out_of_range_requests_are_rejected(params):
    assert client.get("/api/v1/search", params=params).status_code == 422


def test_nothing_matching_is_an_empty_answer_not_an_error(db):
    found = _search(_token(), _subject(db, "Empty"))
    for kind in ("questions", "guides", "roadmaps", "topics", "recordings"):
        assert found[kind] == {"total": 0, "items": []}


def test_excerpt_starts_at_the_text_when_the_match_is_early_or_absent():
    assert excerpt("Short text with the word.", "word") == "Short text with the word."
    assert excerpt("No match here at all.", "missing") == "No match here at all."
    assert excerpt(None, "x") is None
    assert excerpt("line one\n\n   line two", "two") == "line one line two"
