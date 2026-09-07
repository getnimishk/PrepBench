# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The two ways a schema arrives, and the promise that neither loses anything.

A fresh install gets its tables from `Base.metadata.create_all`. An existing
install gets them from `apply_lightweight_migrations`, which is a list of
independent `ALTER`/`CREATE IF NOT EXISTS` steps. Those two paths have to agree,
and a table added to one and forgotten in the other is invisible until someone
who upgraded in place hits a "no such table" a long way from its cause.

The startup path already refuses to serve a half-upgraded database
(`_raise_if_migrations_failed`). What was untested is the quieter failure: a
migration that runs cleanly and simply does not create the thing.
"""
from __future__ import annotations

import sqlite3

import pytest
from sqlalchemy import create_engine, text

from app.core.database import Base, register_sqlite_pragmas
import app.models  # noqa: F401  -- registers every table on Base.metadata


# Tables created by the lightweight migrations rather than by an ALTER. Each
# must also exist on the model metadata, or a fresh install and an upgraded one
# end up with different schemas.
MIGRATION_CREATED_TABLES = [
    "llm_provider_config",
    "llm_task_binding",
    "review_checks",
    "system_design_drafts",
]


def _tables(conn) -> set:
    return {
        row[0] for row in conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")
        )
    }


@pytest.fixture
def fresh(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'fresh.db'}", connect_args={"check_same_thread": False}
    )
    register_sqlite_pragmas(engine)
    try:
        yield engine
    finally:
        engine.dispose()


def test_a_fresh_install_gets_every_table_from_the_models(fresh):
    Base.metadata.create_all(bind=fresh)
    with fresh.connect() as conn:
        present = _tables(conn)
    for name in MIGRATION_CREATED_TABLES:
        assert name in present, f"{name} is missing from a fresh install"
    assert "exam_answers" in present and "spaced_repetition" in present


def test_every_migration_created_table_is_also_a_model(fresh):
    """The two install paths must not drift apart.

    A table created only by the migration list exists for people who upgraded
    and not for people who installed today.
    """
    modelled = set(Base.metadata.tables.keys())
    for name in MIGRATION_CREATED_TABLES:
        assert name in modelled, f"{name} is created by migration but has no model"


def _run_migrations_against(db_path) -> None:
    """Run the real migration list against an arbitrary database file.

    `apply_lightweight_migrations` is written against the module-level engine,
    so this exercises the same statements through a temporary one -- which is
    what an upgrade in place actually does.
    """
    import app.core.database as database

    original = database.engine
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    register_sqlite_pragmas(engine)
    database.engine = engine
    try:
        database.apply_lightweight_migrations()
    finally:
        database.engine = original
        engine.dispose()


def test_migrations_are_idempotent_across_repeated_startups(tmp_path):
    """Every start runs the whole list. The second one must be a no-op."""
    db_path = tmp_path / "existing.db"

    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    engine.dispose()

    _run_migrations_against(db_path)
    first = _schema_fingerprint(db_path)

    _run_migrations_against(db_path)
    _run_migrations_against(db_path)
    assert _schema_fingerprint(db_path) == first


def test_an_upgrade_in_place_creates_the_new_tables_and_keeps_the_old_rows(tmp_path):
    """The database that matters is the one that already has someone's work in it."""
    db_path = tmp_path / "old.db"

    # A database from before either new table existed: build the full schema,
    # then drop them, which is exactly the shape an older install has.
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    register_sqlite_pragmas(engine)
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE review_checks"))
        conn.execute(text("DROP TABLE system_design_drafts"))
        conn.execute(text(
            "INSERT INTO subjects (name, slug, kind, display_order, created_at) "
            "VALUES ('Kept Subject', 'kept', 'SKILL', 0, '2026-01-01 00:00:00')"
        ))
        conn.commit()
    engine.dispose()

    _run_migrations_against(db_path)

    con = sqlite3.connect(db_path)
    try:
        names = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert "review_checks" in names
        assert "system_design_drafts" in names
        # And the row that was there before the upgrade is still there.
        assert con.execute("SELECT name FROM subjects").fetchall() == [("Kept Subject",)]
    finally:
        con.close()


def _schema_fingerprint(db_path) -> list:
    con = sqlite3.connect(db_path)
    try:
        return sorted(
            con.execute(
                "SELECT type, name, COALESCE(sql, '') FROM sqlite_master ORDER BY type, name"
            ).fetchall()
        )
    finally:
        con.close()
