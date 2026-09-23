# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import os
import tempfile
from pathlib import Path

# Before anything imports the app: recordings made by the tests go to a throwaway
# folder, never beside the learner's own recordings in backend/data/recordings.
os.environ.setdefault(
    "PREPBENCH_RECORDINGS_DIR", tempfile.mkdtemp(prefix="prepbench-test-recordings-")
)

# And the provider secret store, for the same reason: creating a provider with an
# API key wrote the fake key into the learner's own .llm_secrets.json.
os.environ.setdefault(
    "PREPBENCH_SECRETS_DIR", tempfile.mkdtemp(prefix="prepbench-test-secrets-")
)

# And the database, for the same reason and at the same moment. Overriding get_db
# is not enough: app.main creates tables when it is imported, and every TestClient
# that starts the app runs its migrations, seeding and evidence reconciliation on
# the app's own engine. Left to its default, that engine is backend/data/
# exam_simulator.db -- the learner's real database, holding question banks that
# cannot be regenerated. Set unconditionally, so a SQLALCHEMY_DATABASE_URI left
# in the shell cannot point a test run at real data either.
TEST_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "test_exam_simulator.db"
TEST_SQLALCHEMY_DATABASE_URI = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SQLALCHEMY_DATABASE_URI"] = TEST_SQLALCHEMY_DATABASE_URI

# Start every run from an empty file rather than trusting the last run to have
# cleaned up. On Windows the teardown unlink can fail while the file is still
# mapped, and it fails silently -- so a leaked row from a previous run shows up
# as a failure in a completely unrelated test, which is the worst kind to debug.
# Before the app is imported, which would otherwise open the file first.
for _suffix in ("", "-wal", "-shm", "-journal"):
    _stale = Path(f"{TEST_DB_PATH}{_suffix}")
    if _stale.exists():
        try:
            _stale.unlink()
        except OSError:
            pass

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.config import DATA_DIR, settings
from app.core.database import Base, get_db, register_sqlite_pragmas
from app.main import app

assert TEST_DB_PATH == DATA_DIR / "test_exam_simulator.db"
assert settings.SQLALCHEMY_DATABASE_URI == TEST_SQLALCHEMY_DATABASE_URI, (
    "The app's own engine is not on the test database; refusing to run against real data."
)

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
    """Ensure test database tables exist for the test session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    # Dispose first: an open pool keeps the file mapped and the unlink fails.
    test_engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except OSError:
            pass


@pytest.fixture
def client():
    """FastAPI TestClient fixture configured to use the isolated test database."""
    with TestClient(app) as test_client:
        yield test_client
