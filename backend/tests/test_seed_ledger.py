# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The four situations every built-in content seeder has to get right:

  fresh install            -> create everything
  restart, nothing changed -> create nothing
  upgrade adding built-ins -> create only the new ones
  user deleted a built-in  -> leave it deleted

Both seeders run through the same helper, so each rule is checked once against
the seeder where it matters most rather than twice against both.
"""
import pytest

from app.utils.seed_interview_questions import (
    SEED_INTERVIEW_QUESTIONS,
    SEED_NAMESPACE as INTERVIEW_NAMESPACE,
    _seed_key,
    seed_interview_questions,
)
from app.utils.seed_system_design_prompts import (
    SEED_SYSTEM_DESIGN_PROMPTS,
    seed_system_design_prompts,
)
from app.repositories.interview_question_repository import InterviewQuestionRepository
from app.repositories.seeded_content_repository import SeededContentRepository
from app.repositories.system_design_repository import SystemDesignPromptRepository


@pytest.fixture
def fresh_db(tmp_path):
    """A throwaway database owned entirely by one test.

    A seeder's whole contract is about what is *already* in the database, so a
    seeder test has to control that completely. The shared test DB is written
    by every other test in the suite and says nothing reliable here.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.database import Base, register_sqlite_pragmas

    engine = create_engine(
        "sqlite:///" + str(tmp_path / "seed_ledger_test.db"),
        connect_args={"check_same_thread": False},
    )
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _prompt_titles(db):
    return [p.title for p in SystemDesignPromptRepository(db).get_all(limit=500)]


def _question_keys(db):
    return [
        _seed_key(q.round_type, q.question_text)
        for q in InterviewQuestionRepository(db).get_all(limit=500)
    ]


# ---- fresh install ---------------------------------------------------


def test_fresh_install_seeds_every_built_in(fresh_db):
    prompts = seed_system_design_prompts(fresh_db)
    questions = seed_interview_questions(fresh_db)

    assert prompts == len(SEED_SYSTEM_DESIGN_PROMPTS)
    assert questions == len(SEED_INTERVIEW_QUESTIONS)
    assert set(_prompt_titles(fresh_db)) == {p["title"] for p in SEED_SYSTEM_DESIGN_PROMPTS}

    seeded_rounds = {
        q.round_type.value
        for q in InterviewQuestionRepository(fresh_db).get_all(limit=500)
    }
    assert seeded_rounds == {"hr_screening", "hiring_manager", "system_design", "behavioral"}


def test_restart_creates_nothing_and_never_duplicates(fresh_db):
    """This runs on every startup, so after the first time it has to be free."""
    seed_system_design_prompts(fresh_db)
    seed_interview_questions(fresh_db)

    assert seed_system_design_prompts(fresh_db) == 0
    assert seed_interview_questions(fresh_db) == 0

    titles = _prompt_titles(fresh_db)
    keys = _question_keys(fresh_db)
    assert len(titles) == len(set(titles))
    assert len(keys) == len(set(keys))


# ---- upgrade adding built-ins ----------------------------------------


def test_a_built_in_added_by_a_later_version_arrives(fresh_db, monkeypatch):
    """The original bug: the seeder returned early whenever the table held any
    row, so an install that had run once froze at whatever shipped that day and
    no later pack ever reached it."""
    from app.utils import seed_system_design_prompts as seed_module

    full_list = seed_module.SEED_SYSTEM_DESIGN_PROMPTS
    new_prompt = full_list[-1]

    monkeypatch.setattr(seed_module, "SEED_SYSTEM_DESIGN_PROMPTS", full_list[:-1])
    seeded_by_old_version = seed_module.seed_system_design_prompts(fresh_db)
    monkeypatch.undo()

    added_by_upgrade = seed_module.seed_system_design_prompts(fresh_db)

    assert seeded_by_old_version == len(full_list) - 1
    assert added_by_upgrade == 1
    assert new_prompt["title"] in _prompt_titles(fresh_db)


# ---- user deleted a built-in -----------------------------------------


def test_a_deleted_built_in_is_not_resurrected(fresh_db):
    """Interview questions have a delete endpoint, so this is reachable from
    the UI: without the ledger, matching built-ins against the bank's current
    contents would put every deleted one back at the next restart and make
    deleting a built-in something the app quietly undoes."""
    seed_interview_questions(fresh_db)
    repo = InterviewQuestionRepository(fresh_db)

    doomed = repo.get_all(limit=500)[0]
    doomed_key = _seed_key(doomed.round_type, doomed.question_text)
    assert repo.delete(doomed.id) is True

    assert seed_interview_questions(fresh_db) == 0
    assert doomed_key not in _question_keys(fresh_db)
    assert repo.count() == len(SEED_INTERVIEW_QUESTIONS) - 1


def test_emptying_a_round_no_longer_refills_it_on_restart(fresh_db):
    """A deliberate behaviour change. The previous seeder reseeded any round
    whose count had fallen to zero, so a user curating a round down to nothing
    got the whole round back on the next restart."""
    from app.models.interview_question import InterviewRoundType

    seed_interview_questions(fresh_db)
    repo = InterviewQuestionRepository(fresh_db)

    for q in repo.get_all(limit=500):
        if q.round_type == InterviewRoundType.BEHAVIORAL:
            repo.delete(q.id)

    assert seed_interview_questions(fresh_db) == 0
    rounds_present = {q.round_type for q in repo.get_all(limit=500)}
    assert InterviewRoundType.BEHAVIORAL not in rounds_present


# ---- upgrading a database that predates the ledger -------------------


def test_a_pre_ledger_install_adopts_its_content_instead_of_reseeding(fresh_db):
    """The upgrade path. Such a database holds built-ins but no record of them,
    and nothing distinguishes "the user deleted this" from "this was never
    shipped" -- so everything currently in the list counts as already offered
    and the user's deletions survive the upgrade."""
    from app.models.seeded_content import SeededContent

    seed_interview_questions(fresh_db)
    repo = InterviewQuestionRepository(fresh_db)
    ledger = SeededContentRepository(fresh_db)

    # Rewind to what an install from before the ledger looks like: content
    # present, ledger empty, and one built-in the user had already deleted.
    doomed = repo.get_all(limit=500)[0]
    doomed_key = _seed_key(doomed.round_type, doomed.question_text)
    repo.delete(doomed.id)
    fresh_db.query(SeededContent).delete()
    fresh_db.commit()
    assert ledger.get_keys(INTERVIEW_NAMESPACE) == set()

    created = seed_interview_questions(fresh_db)

    assert created == 0, "an upgrade must not re-create content the install already had"
    assert doomed_key not in _question_keys(fresh_db), "a pre-upgrade deletion was undone"
    # Everything shipped today is now on record, so only genuinely new
    # built-ins reach this install from here on.
    assert ledger.get_keys(INTERVIEW_NAMESPACE) == {
        _seed_key(q["round_type"], q["question_text"]) for q in SEED_INTERVIEW_QUESTIONS
    }


# ---- reset -----------------------------------------------------------


def test_reset_clears_the_ledger_so_built_ins_come_back(fresh_db):
    """Reset has to look like a fresh install. If the ledger survived it, the
    seeders would create nothing and the user would be left with empty banks."""
    from app.repositories.settings_repository import SettingsRepository

    seed_system_design_prompts(fresh_db)
    seed_interview_questions(fresh_db)

    SettingsRepository(fresh_db).delete_all_rows()

    assert seed_system_design_prompts(fresh_db) == len(SEED_SYSTEM_DESIGN_PROMPTS)
    assert seed_interview_questions(fresh_db) == len(SEED_INTERVIEW_QUESTIONS)


# ---- the built-in lists themselves -----------------------------------


def test_built_in_lists_have_no_duplicate_keys():
    """A duplicate key is silent data loss: items are looked up by key, so the
    second one carrying a given key is never created and never missed."""
    titles = [p["title"] for p in SEED_SYSTEM_DESIGN_PROMPTS]
    assert len(titles) == len(set(titles)), "duplicate system design prompt title"

    keys = [_seed_key(q["round_type"], q["question_text"]) for q in SEED_INTERVIEW_QUESTIONS]
    assert len(keys) == len(set(keys)), "duplicate interview question"
