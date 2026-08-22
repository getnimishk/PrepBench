import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.config import DATA_DIR
from app.core.database import Base, get_db, register_sqlite_pragmas
from app.main import app

# Dedicated isolated test database path
TEST_DB_PATH = DATA_DIR / "test_exam_simulator.db"
TEST_SQLALCHEMY_DATABASE_URI = f"sqlite:///{TEST_DB_PATH}"

# Start every run from an empty file rather than trusting the last run to have
# cleaned up. On Windows the teardown unlink can fail while the file is still
# mapped, and it fails silently -- so a leaked row from a previous run shows up
# as a failure in a completely unrelated test, which is the worst kind to debug.
if TEST_DB_PATH.exists():
    try:
        TEST_DB_PATH.unlink()
    except OSError:
        pass

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
