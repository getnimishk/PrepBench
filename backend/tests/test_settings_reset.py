"""
"Reset Entire Application" must actually reset the entire application.

The bug these tests exist to prevent: the reset endpoint carried a hand-written
list of seven tables while the schema grew to nineteen, so recordings, roadmaps,
system design attempts and the configured AI provider all survived a reset that
told the user it had restored a "brand-new empty state". The old regression test
could not catch it -- it created a question and an exam session, and checked
those two were gone.

So the coverage here is driven from the mapper metadata instead of a list. A new
model is included automatically, and if the reset ever stops clearing it, this
fails without anyone having to remember to come back here.
"""
import datetime

import pytest
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    Integer,
    JSON,
    Numeric,
)

from app.core.database import Base
from tests.conftest import TestingSessionLocal, test_engine

# Emptied and then repopulated, exactly as a first boot would: the settings
# singleton, the built-in practice content, and a provider row rebuilt from
# GEMINI_API_KEY if one is present in the environment. Everything NOT named here
# must be empty after a reset.
RESEEDED_TABLES = {
    "app_settings",
    "system_design_prompts",
    "interview_questions",
    "llm_provider_config",
}


def _dummy_value(column):
    """A type-appropriate value for a NOT NULL column we do not care about."""
    type_ = column.type
    if isinstance(type_, Boolean):
        return True
    if isinstance(type_, (Integer,)):
        return 1
    if isinstance(type_, (Float, Numeric)):
        return 1.0
    if isinstance(type_, DateTime):
        return datetime.datetime(2026, 1, 1, 12, 0, 0)
    if isinstance(type_, Date):
        return datetime.date(2026, 1, 1)
    if isinstance(type_, JSON):
        return {}
    return "probe"


def _fill_every_table(db):
    """
    Put at least one row in every table in the schema.

    Walks sorted_tables forwards -- parents before children -- keeping each
    table's new primary key so a NOT NULL foreign key further down can point at
    a row that genuinely exists.
    """
    created_pk = {}

    for table in Base.metadata.sorted_tables:
        # Already populated -- by app startup seeding, or by an earlier test in
        # this session. A row is a row for our purposes, and inserting a second
        # one would collide on singletons like app_settings (whose id defaults
        # to 1) and on unique columns like llm_provider_config.name.
        existing = db.execute(table.select().limit(1)).first()
        if existing is not None:
            pk_column = list(table.primary_key.columns)[0]
            created_pk[table.name] = existing._mapping[pk_column.name]
            continue

        values = {}
        for column in table.columns:
            if column.primary_key and isinstance(column.type, Integer):
                continue  # let SQLite autoincrement it
            if column.nullable or column.default is not None or column.server_default is not None:
                continue

            if column.foreign_keys:
                parent = next(iter(column.foreign_keys)).column.table.name
                if parent not in created_pk:
                    pytest.skip(f"{table.name}.{column.name} references unseeded {parent}")
                values[column.name] = created_pk[parent]
            else:
                values[column.name] = _dummy_value(column)

        result = db.execute(table.insert().values(**values))
        created_pk[table.name] = result.inserted_primary_key[0]

    db.commit()
    return created_pk


def _row_counts():
    with test_engine.connect() as conn:
        return {
            table.name: len(conn.execute(table.select()).fetchall())
            for table in Base.metadata.sorted_tables
        }


def test_reset_clears_every_table_in_the_schema(client):
    """
    The assertion the old test was missing. Every table gets a row, and every
    table that is not deliberately reseeded must be empty afterwards.
    """
    db = TestingSessionLocal()
    try:
        _fill_every_table(db)
    finally:
        db.close()

    before = _row_counts()
    assert all(count > 0 for count in before.values()), (
        f"probe failed to populate: {[t for t, c in before.items() if c == 0]}"
    )

    assert client.post("/api/v1/settings/reset-app").status_code == 200

    after = _row_counts()
    survivors = {
        name: count
        for name, count in after.items()
        if count > 0 and name not in RESEEDED_TABLES
    }
    assert not survivors, f"these tables survived a full reset: {survivors}"


def test_reset_does_not_keep_the_configured_ai_provider(client):
    """
    Called out separately because it is the one with a privacy edge: someone
    resetting to hand the machine on, or to start clean, must not keep a
    provider row pointing at their stored credential.
    """
    from app.models.llm_config import LLMProviderConfig

    db = TestingSessionLocal()
    try:
        db.add(
            LLMProviderConfig(
                name="Reset Probe Provider",
                profile_key="llamafile",
                api_key_ref="env:SOME_KEY_THAT_IS_NOT_SET",
            )
        )
        db.commit()
    finally:
        db.close()

    assert client.post("/api/v1/settings/reset-app").status_code == 200

    db = TestingSessionLocal()
    try:
        remaining = (
            db.query(LLMProviderConfig)
            .filter(LLMProviderConfig.name == "Reset Probe Provider")
            .first()
        )
    finally:
        db.close()

    assert remaining is None, "the user's configured provider survived a full reset"


def test_reset_restores_the_built_in_content_a_fresh_install_has(client):
    """
    Emptying every table is only half of "brand-new empty state". A fresh
    install has the built-in system design prompts and interview questions, so a
    reset that leaves those empty until the next server restart has not actually
    restored a fresh install.
    """
    assert client.post("/api/v1/settings/reset-app").status_code == 200

    counts = _row_counts()
    assert counts["system_design_prompts"] > 0, "built-in prompts were not restored"
    assert counts["interview_questions"] > 0, "built-in interview questions were not restored"


def test_reset_restores_default_settings(client):
    """Settings come back as the model's declared defaults, not as whatever the
    user last saved."""
    client.put(
        "/api/v1/settings",
        json={
            "theme": "dark",
            "timer_sound_enabled": False,
            "default_exam_mode": "practice",
            "default_questions_count": 10,
            "default_passing_percentage": 50,
            "shuffle_questions": False,
            "shuffle_options": False,
            "daily_practice_goal": 1,
            "initial_seed_completed": True,
            "default_target_role": "Staff SRE",
        },
    )

    assert client.post("/api/v1/settings/reset-app").status_code == 200

    settings = client.get("/api/v1/settings").json()
    assert settings["theme"] == "light"
    assert settings["default_exam_mode"] == "timed"
    assert settings["default_questions_count"] == 80
    assert settings["default_passing_percentage"] == 95.0
    assert settings["daily_practice_goal"] == 20
    assert settings["default_target_role"] is None
