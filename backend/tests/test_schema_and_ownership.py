# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Two leftovers, and what keeps them honest.

DEAD SETTINGS COLUMNS. Six columns on app_settings backed controls that were
removed because nothing read them -- most damagingly default_passing_percentage,
whose value (95%) was stamped onto six real papers and made an 87.5% pass read
as a failure. They are dropped from the model and from existing databases. The
tests here exist because a dropped column is easy to reintroduce by accident:
a schema, a response model or a seed that mentions one would put the false
control back without anyone noticing.

DESIGN REVIEW OWNERSHIP. Design reviews carry a `domain` string and no
subject_id, so which subject owns which reviews is a dictionary in
HomeService. Phase 50 kept it -- generalising a table with one populated
domain would cost a column, a migration and a backfill to buy nothing -- on
the condition that it cannot silently attribute content to the wrong subject.
These tests are that condition.
"""
import uuid

import pytest
from sqlalchemy import inspect

from app.models.design_review import DesignReview
from app.models.subject import Subject, SubjectKind
from app.services.home_service import HomeService

DEAD_SETTINGS_COLUMNS = [
    "shuffle_options",
    "daily_practice_goal",
    "default_exam_mode",
    "default_questions_count",
    "default_passing_percentage",
    "shuffle_questions",
]


@pytest.fixture
def db():
    from tests.conftest import TestingSessionLocal

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---- dead settings columns ---------------------------------------------


def test_the_dead_settings_columns_are_gone_from_the_table(db):
    """Removed from the database, not merely from the model.

    Leaving them in the table would keep default_passing_percentage=95.0
    sitting under the exam history it already mislabelled once.
    """
    present = [c["name"] for c in inspect(db.get_bind()).get_columns("app_settings")]
    for dead in DEAD_SETTINGS_COLUMNS:
        assert dead not in present, f"app_settings still carries {dead}"
    # And what should be there, is.
    assert set(present) == {
        "id", "theme", "timer_sound_enabled", "initial_seed_completed", "default_target_role",
    }


def test_nothing_in_the_application_reads_a_dead_settings_column():
    """The disposition is 'removed', so no code path may name one.

    A grep is the right instrument here: SQLAlchemy would raise on a dropped
    attribute, but a raw string in a query, a schema field or a seed dict
    would not, and any of those would resurrect the control silently.
    """
    from pathlib import Path

    app_dir = Path(__file__).resolve().parent.parent / "app"
    offenders = []
    for path in app_dir.rglob("*.py"):
        text_ = path.read_text(encoding="utf-8", errors="ignore")
        for dead in DEAD_SETTINGS_COLUMNS:
            for lineno, line in enumerate(text_.splitlines(), 1):
                if dead not in line:
                    continue
                stripped = line.strip()
                # The migration that drops them must name them, and the model
                # records why they went. Neither is a read.
                if stripped.startswith("#") or path.name in ("database.py", "settings.py"):
                    continue
                offenders.append(f"{path.name}:{lineno} {stripped[:80]}")
    assert not offenders, "dead settings columns referenced: " + "; ".join(offenders)


def test_the_settings_api_exposes_only_the_settings_that_do_something(client):
    body = client.get("/api/v1/settings").json()
    assert set(body) == {"theme", "timer_sound_enabled", "default_target_role"}


def test_first_answered_at_is_live_and_immutable(db):
    """The one leftover on the Phase 49 list that is not dead.

    It exists because answered_at carries onupdate= and is re-stamped by
    ordinary navigation, so "what did I practise today" cannot be asked of it.
    Its disposition is "still needed", and this test is what says so.
    """
    present = [c["name"] for c in inspect(db.get_bind()).get_columns("exam_answers")]
    assert "first_answered_at" in present

    from app.models.exam_answer import ExamAnswer

    assert ExamAnswer.first_answered_at.property.columns[0].onupdate is None
    assert ExamAnswer.answered_at.property.columns[0].onupdate is not None


# ---- design review ownership -------------------------------------------


def _subject(db, slug) -> Subject:
    subject = Subject(
        name=f"Subject {slug}", slug=slug, kind=SubjectKind.SKILL, display_order=999,
    )
    db.add(subject)
    db.flush()
    return subject


def test_the_mapped_subjects_get_their_own_reviews(db):
    """The mapping as it stands, stated as a test rather than as a comment."""
    service = HomeService(db)
    assert service._DESIGN_REVIEW_DOMAIN_BY_SUBJECT == {
        "databricks": "data_platform",
        "system-design": "request_serving",
    }

    databricks = db.query(Subject).filter(Subject.slug == "databricks").first()
    if databricks is not None:
        assert service._design_domain(databricks) == "data_platform"


def test_a_subject_that_owns_no_reviews_gets_none_rather_than_a_sentinel(db):
    """The defect this phase closed.

    An unmapped subject used to map to the string "__none__" and then query
    for reviews carrying it. That is correct only for as long as no review is
    ever seeded with that domain -- and one that was would have been claimed
    by every unmapped subject simultaneously. None is not a value any row can
    hold, so the mistake is now unavailable.
    """
    service = HomeService(db)
    unmapped = _subject(db, f"unmapped-{uuid.uuid4().hex[:8]}")

    assert service._design_domain(unmapped) is None
    assert "__none__" not in {
        row[0] for row in db.query(DesignReview.domain).distinct().all()
    }


def test_an_unmapped_subject_reports_no_reviews_even_when_reviews_exist(db):
    """Under-report, never mis-attribute.

    The safe direction for an editorial mapping is silence: "No reviews for
    this subject" is a claim a reader can check and contradict, where reviews
    from another subject appearing under this heading is not.
    """
    unmapped = _subject(db, f"unmapped-{uuid.uuid4().hex[:8]}")
    # A review that really exists and really belongs to somebody else. Seeded
    # here rather than relied upon, so the test cannot pass by there being
    # nothing to mis-attribute.
    db.add(DesignReview(
        title=f"Owned by another subject {uuid.uuid4().hex[:6]}",
        brief="A situation with a tension in it.",
        domain="data_platform",
        deciding_axis="Freshness against cost.",
        axis_label="Freshness",
        reveal="Which of the two actually differs.",
        elicit_answer="Ask how stale the data is allowed to be.",
        concepts=[],
    ))
    db.commit()

    assert db.query(DesignReview).count() > 0, "no reviews seeded; the test proves nothing"

    coverage = {c.key: c for c in HomeService(db).coverage_for(unmapped)}
    assert coverage["design_review"].count == 0
    assert coverage["design_review"].available is False
    assert coverage["design_review"].detail == "No reviews for this subject"


def test_ownership_cannot_be_claimed_by_a_lookalike_slug(db):
    """Slugs are unique and matched exactly, so ownership is not fuzzy."""
    service = HomeService(db)
    for near_miss in ("Databricks", "databricks-2", "data-bricks", "system_design"):
        assert service._design_domain(_subject(db, f"{near_miss}-{uuid.uuid4().hex[:6]}")) is None


def test_system_design_prompts_belong_to_exactly_one_subject(db):
    """The same editorial judgement, applied to the other global pool.

    The PSM I page used to report "32 prompts" and "34 questions" because
    those tables have no subject scope and were counted unfiltered. A real
    number under the wrong heading is the same class of error as a fabricated
    one.
    """
    service = HomeService(db)
    owners = [
        s for s in db.query(Subject).all() if service._owns_system_design(s)
    ]
    assert [s.slug for s in owners] in ([], ["system-design"])


# ---- rows that did not come through the ORM -----------------------------
#
# The Question Bank 500'd on this machine's real database, and the page said
# "Failed to load questions from Question Bank. Please check backend
# connection" over a backend that was running perfectly. Twenty-five
# questions had been loaded into the file directly rather than through the
# app, so they carried `difficulty` as the enum's *value* ("medium") instead
# of its name ("MEDIUM"), and `tags` as NULL instead of [].
#
# Both are repaired at startup, and neither is fatal any more: the listing
# builds every row in one comprehension, so a single unreadable question took
# out all 712.


def test_a_question_with_no_tags_at_all_still_renders(db):
    """NULL and [] are the same statement about tags. A 500 is not a third one."""
    from datetime import datetime

    from app.models.question import QuestionDifficulty, QuestionType
    from app.schemas.question import QuestionResponse

    class Row:
        """What SQLAlchemy hands back for a row whose tags column is NULL."""
        id = 1
        text = "A question loaded by hand."
        question_type = QuestionType.SINGLE_CHOICE
        difficulty = QuestionDifficulty.MEDIUM
        domain = topic = certification = "General"
        subtopic = source = code_snippet = case_study_text = None
        image_url = explanation = reference_url = None
        tags = None
        is_reviewed = False
        created_at = updated_at = datetime(2026, 9, 1, 6, 21, 52)
        options = []

    assert QuestionResponse.model_validate(Row(), from_attributes=True).tags == []


def test_the_question_listing_survives_a_hand_loaded_row(client, db):
    """End to end, through the route that actually broke."""
    from sqlalchemy import text as sql

    created = client.post("/api/v1/questions", json={
        "text": f"Hand-loaded {uuid.uuid4().hex[:8]}",
        "question_type": "single_choice",
        "options": [{"option_text": "A", "is_correct": True, "order_index": 0}],
    })
    assert created.status_code == 201
    qid = created.json()["id"]

    # Put the row into the shape the app never writes but a file can hold.
    db.execute(sql("UPDATE questions SET tags = NULL WHERE id = :i"), {"i": qid})
    db.commit()

    listed = client.get("/api/v1/questions?skip=0&limit=100")
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] > 0
