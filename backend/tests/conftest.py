# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import os
import sqlite3
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Everything in this block runs before the first `app.*` import, and has to.
# ---------------------------------------------------------------------------
#
# The suite used to reach the real backend/data/exam_simulator.db -- the
# learner's own database, holding question banks they imported by hand and
# cannot regenerate from seeds. Request-scoped data was always isolated by
# app.dependency_overrides[get_db]; what leaked was schema and startup side
# effects, which never pass through that dependency:
#
#   * app/main.py runs create_all at IMPORT time, and this file imports
#     app.main to get `app`, so collecting the suite was enough to build and
#     upgrade tables in the real file;
#   * the lifespan handler's migrations and seeders build their own
#     SessionLocal(), so `with TestClient(app)` seeded the real file;
#   * test_question_validator.py and test_content_validator.py open the real
#     SessionLocal() directly.
#
# Two independent defences, because they cover different things:
#
#   1. Redirect. Pointing settings at the test database before app.core.config
#      is imported means app.core.database.engine and SessionLocal ARE the test
#      database. No code path, present or future, can reach the real file --
#      including the three above, none of which asks anyone's permission. Same
#      mechanism scripts/fresh_install_check.py and scripts/upgrade_check.py
#      already use.
#   2. Skip. The startup work is turned off as well, so the seeders do not
#      populate the test database and change what every list endpoint returns.
#
# The redirect is what makes the guarantee; the skip is what keeps the suite's
# expectations the ones it was written against. Both are held to it by
# tests/test_real_database_isolation.py.

BACKEND_DIR = Path(__file__).resolve().parent.parent
REAL_DB_PATH = BACKEND_DIR / "data" / "exam_simulator.db"
TEST_DB_PATH = BACKEND_DIR / "data" / "test_exam_simulator.db"
TEST_SQLALCHEMY_DATABASE_URI = f"sqlite:///{TEST_DB_PATH}"


def _fingerprint(path: Path) -> dict:
    """What a database looks like from outside, without writing to it.

    Covers the write-ahead log and shared-memory files too: a stray connection
    that only reads still creates them, and a schema change lands in the -wal
    before it lands in the .db.
    """
    state = {}
    for suffix in ("", "-wal", "-shm"):
        try:
            stat = Path(str(path) + suffix).stat()
        except OSError:
            state[suffix or ".db"] = None
        else:
            state[suffix or ".db"] = (stat.st_size, stat.st_mtime_ns)
    state["schema"] = _read_schema(path)
    return state


def _read_schema(path: Path):
    """The CREATE statements, read through a connection that cannot write.

    `mode=ro` is the point. Opening the real database the way the application
    does would set journal_mode=WAL on it (core/database.py), and that is
    itself a write -- the guard would become the thing that touched the file it
    exists to protect. Returns None when it cannot be read that way, and the
    filesystem half of the fingerprint carries the check alone.
    """
    if not path.exists():
        return None
    try:
        con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    except sqlite3.Error:
        return None
    try:
        return sorted(
            row[0] for row in con.execute(
                "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL"
            )
        )
    except sqlite3.Error:
        return None
    finally:
        con.close()


# Taken here, at the earliest moment any test code runs, so that the import of
# app.main below is inside the window the guard checks.
REAL_DB_AT_SESSION_START = _fingerprint(REAL_DB_PATH)


def _remove_test_database() -> None:
    """Delete the test database and its sidecars, tolerating a locked file.

    Start every run from an empty file rather than trusting the last run to
    have cleaned up. On Windows the unlink can fail while the file is still
    mapped, and it fails silently -- so a leaked row from a previous run shows
    up as a failure in a completely unrelated test, which is the worst kind to
    debug.
    """
    for suffix in ("", "-wal", "-shm"):
        stale = Path(str(TEST_DB_PATH) + suffix)
        if stale.exists():
            try:
                stale.unlink()
            except OSError:
                pass


# Before the app imports rather than after them: app.core.database.engine now
# points at this file, so it has to be gone before anything can open it.
_remove_test_database()


def describe_real_database_drift() -> list:
    """Every way the real database differs from how this run first found it.

    Returns an empty list when nothing changed, which includes the case where
    the file did not exist before and still does not -- the strongest result
    available, and the one a clean checkout or CI should produce.
    """
    before = REAL_DB_AT_SESSION_START
    now = _fingerprint(REAL_DB_PATH)
    drift = []

    for key in (".db", "-wal", "-shm"):
        if now[key] == before[key]:
            continue
        name = REAL_DB_PATH.name + ("" if key == ".db" else key)
        if before[key] is None:
            drift.append(f"{name} did not exist before this run and now does")
        elif now[key] is None:
            drift.append(f"{name} existed before this run and is now gone")
        else:
            drift.append(
                f"{name} changed: {before[key][0]} bytes / mtime {before[key][1]} "
                f"-> {now[key][0]} bytes / mtime {now[key][1]}"
            )

    if now["schema"] != before["schema"]:
        added = sorted(set(now["schema"] or []) - set(before["schema"] or []))
        removed = sorted(set(before["schema"] or []) - set(now["schema"] or []))
        drift.append(
            f"schema changed: {len(added)} statement(s) added, "
            f"{len(removed)} removed"
        )
        for statement in (added + removed)[:5]:
            drift.append(f"    {' '.join(statement.split())[:160]}")

    return drift


def verify_real_database_untouched() -> None:
    """Fail the run if the real database moved under it."""
    drift = describe_real_database_drift()
    if not drift:
        return
    lines = [f"The test suite changed the real database at {REAL_DB_PATH}."]
    lines.extend(f"  {line}" for line in drift)
    lines.append("")
    lines.append(
        "That file holds question banks the learner imported by hand and cannot "
        "regenerate from seeds, so the suite must not reach it at all. Check the "
        "redirect at the top of tests/conftest.py, and any new code that builds "
        "its own engine or session rather than taking the get_db dependency."
    )
    lines.append(
        "(If PrepBench itself was running against that database while the suite "
        "ran, that alone would explain this -- stop it and run again.)"
    )
    raise AssertionError("\n".join(lines))


os.environ["SQLALCHEMY_DATABASE_URI"] = TEST_SQLALCHEMY_DATABASE_URI
os.environ["DATABASE_PATH"] = str(TEST_DB_PATH)
os.environ["RUN_STARTUP_DB_INIT"] = "0"

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import DATA_DIR, settings  # noqa: E402
from app.core.database import Base, get_db, register_sqlite_pragmas  # noqa: E402
import app.core.database as app_database  # noqa: E402

# Loud rather than quiet. If a settings change ever stops the environment from
# reaching these fields -- an env_prefix, a different field name -- the suite
# must refuse to run instead of silently going back to writing to the real
# database, which is the failure this whole block exists to end.
assert DATA_DIR == BACKEND_DIR / "data", (
    f"conftest and app.core.config disagree about the data directory: "
    f"{BACKEND_DIR / 'data'} vs {DATA_DIR}"
)
assert settings.SQLALCHEMY_DATABASE_URI == TEST_SQLALCHEMY_DATABASE_URI, (
    f"the test database redirect did not take effect: "
    f"{settings.SQLALCHEMY_DATABASE_URI}"
)
assert settings.RUN_STARTUP_DB_INIT is False, (
    "startup database initialisation is still enabled under test"
)

from app.main import app  # noqa: E402

test_engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False}
)

# Without this the test engine runs with SQLite's default foreign_keys=OFF,
# so ON DELETE CASCADE silently does not fire under test even though it works
# in the real app -- tests would pass against orphaned rows the app would
# never actually produce.
register_sqlite_pragmas(test_engine)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


Base.metadata.create_all(bind=test_engine)
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure test database tables exist, and check the real one afterwards.

    The end-of-session check is here rather than in a test because it has to
    run after the last one. test_real_database_isolation.py makes the same
    assertion at the moment it runs, which catches the import-time and
    lifespan leaks; this catches anything that happens later.
    """
    Base.metadata.create_all(bind=test_engine)
    yield

    # Dispose first: an open pool keeps the file mapped and the unlink fails.
    # app_database.engine is disposed too -- it is redirected at this same file,
    # so a connection left open in its pool would keep the file mapped just as
    # surely as one of ours.
    test_engine.dispose()
    app_database.engine.dispose()
    _remove_test_database()

    # Last, so that a run which did touch the real database still cleans up
    # after itself before it fails. Removing the test database cannot change
    # what this looks at.
    verify_real_database_untouched()


@pytest.fixture
def client():
    """FastAPI TestClient fixture configured to use the isolated test database."""
    with TestClient(app) as test_client:
        yield test_client
