import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.config import DATA_DIR
from app.core.database import Base, get_db
from app.main import app

# Dedicated isolated test database path
TEST_DB_PATH = DATA_DIR / "test_exam_simulator.db"
TEST_SQLALCHEMY_DATABASE_URI = f"sqlite:///{TEST_DB_PATH}"

test_engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False}
)

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
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass


@pytest.fixture
def client():
    """FastAPI TestClient fixture configured to use the isolated test database."""
    with TestClient(app) as test_client:
        yield test_client
