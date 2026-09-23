# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The upgrade path, run against a copy of the database it will actually meet
(plan §32).

backend/tests/test_phase2_migrations.py proves the migration on a synthetic old
schema. This proves it on the real one: the learner's own database, with the
question banks they imported by hand, copied and upgraded so that the answer to
"will this install survive the next start?" is a result rather than a hope.

The original is opened read-only and copied with SQLite's backup API. Nothing is
written to it at any point; every check runs on the copy, in a temporary folder.

    cd backend && ./.venv/Scripts/python.exe scripts/upgrade_check.py [path-to.db]
"""
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND / "data" / "exam_simulator.db"

TMP = Path(tempfile.mkdtemp(prefix="prepbench-upgrade-"))
COPY = TMP / "upgraded.db"
FRESH = TMP / "fresh.db"

os.environ["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{COPY.as_posix()}"
os.environ["PREPBENCH_RECORDINGS_DIR"] = str(TMP / "recordings")
os.environ["PREPBENCH_SECRETS_DIR"] = str(TMP / "secrets")
os.environ["GEMINI_API_KEY"] = ""
sys.path.insert(0, str(BACKEND))


def copy_read_only(source: Path, destination: Path) -> None:
    """A consistent copy, without opening the original for writing."""
    source_connection = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
    try:
        target = sqlite3.connect(destination)
        try:
            source_connection.backup(target)
        finally:
            target.close()
    finally:
        source_connection.close()


def counts(path: Path) -> dict:
    db = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        tables = [r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )]
        return {t: db.execute(f"SELECT COUNT(*) FROM '{t}'").fetchone()[0] for t in tables}
    finally:
        db.close()


def schema(path: Path) -> dict:
    db = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        out = {}
        for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"):
            columns = {row[1] for row in db.execute(f"PRAGMA table_info('{table}')")}
            indexes = {row[1] for row in db.execute(f"PRAGMA index_list('{table}')") if not row[1].startswith("sqlite_autoindex")}
            out[table] = (columns, indexes)
        return out
    finally:
        db.close()


def main() -> int:
    if not SOURCE.exists():
        print(f"No database at {SOURCE}; nothing to upgrade.")
        return 0

    print(f"Source: {SOURCE} ({SOURCE.stat().st_size / 1_000_000:.1f} MB), read-only")
    before_bytes = SOURCE.read_bytes()
    copy_read_only(SOURCE, COPY)
    before = counts(COPY)

    # Importing the app runs create_all; the lifespan runs the migrations, the seeders
    # and the evidence reconciliation -- the whole of what a real start does.
    from fastapi.testclient import TestClient  # noqa: E402
    from sqlalchemy import create_engine  # noqa: E402

    from app.core.database import Base, apply_lightweight_migrations, engine  # noqa: E402
    from app.main import app  # noqa: E402

    assert "upgraded.db" in str(engine.url), "refusing to run against anything but the copy"

    with TestClient(app) as client:
        # Twice: an upgrade that is not idempotent breaks the second start, not the first.
        apply_lightweight_migrations()

        after = counts(COPY)
        lost = {t: (before[t], after.get(t, 0)) for t in before if after.get(t, 0) < before[t]}
        print(f"Rows before/after: {sum(before.values())} -> {sum(after.values())}")
        if lost:
            print(f"  ROWS LOST: {lost}")

        fresh_engine = create_engine(f"sqlite:///{FRESH.as_posix()}")
        Base.metadata.create_all(bind=fresh_engine)
        fresh_engine.dispose()

        upgraded_schema, fresh_schema = schema(COPY), schema(FRESH)
        differences = []
        for table, (columns, indexes) in fresh_schema.items():
            if table not in upgraded_schema:
                differences.append(f"{table}: missing from the upgraded database")
                continue
            missing_columns = columns - upgraded_schema[table][0]
            missing_indexes = indexes - upgraded_schema[table][1]
            if missing_columns:
                differences.append(f"{table}: columns missing after upgrade: {sorted(missing_columns)}")
            if missing_indexes:
                differences.append(f"{table}: indexes missing after upgrade: {sorted(missing_indexes)}")
        print(f"Schema: {len(fresh_schema)} tables in a fresh database, {len(differences)} differences after upgrade")
        for line in differences:
            print(f"  {line}")

        integrity = sqlite3.connect(f"file:{COPY.as_posix()}?mode=ro", uri=True)
        try:
            ok = integrity.execute("PRAGMA integrity_check").fetchone()[0]
            broken_keys = integrity.execute("PRAGMA foreign_key_check").fetchall()
            orphans = {
                "answers with no session": "SELECT COUNT(*) FROM exam_answers a LEFT JOIN exam_sessions s ON s.id = a.session_id WHERE s.id IS NULL",
                "answers with no question": "SELECT COUNT(*) FROM exam_answers a LEFT JOIN questions q ON q.id = a.question_id WHERE q.id IS NULL",
                "options with no question": "SELECT COUNT(*) FROM question_options o LEFT JOIN questions q ON q.id = o.question_id WHERE q.id IS NULL",
                "topics with no roadmap": "SELECT COUNT(*) FROM roadmap_topics t LEFT JOIN roadmaps r ON r.id = t.roadmap_id WHERE r.id IS NULL",
                "schedule rows with no question": "SELECT COUNT(*) FROM spaced_repetition s LEFT JOIN questions q ON q.id = s.question_id WHERE q.id IS NULL",
            }
            found = {name: integrity.execute(sql).fetchone()[0] for name, sql in orphans.items()}
        finally:
            integrity.close()
        print(f"integrity_check: {ok}; foreign_key_check: {len(broken_keys)} problems")
        print(f"Orphans: {found}")

        # And it serves: the screens a start lands on, against the upgraded copy.
        served = {}
        for name, url in (
            ("preparations", "/api/v1/subjects"),
            ("home", "/api/v1/home"),
            ("questions", "/api/v1/questions?limit=5"),
            ("review queue", "/api/v1/review/queue"),
            ("insights", "/api/v1/analytics/domain-performance"),
            ("storage", "/api/v1/system/storage"),
            ("review counts", "/api/v1/review/counts"),
            ("search", "/api/v1/search?q=the"),
            ("profile", "/api/v1/profile"),
        ):
            served[name] = client.get(url).status_code
        print(f"Endpoints: {served}")

    unchanged = SOURCE.read_bytes() == before_bytes
    print(f"Original database unchanged: {unchanged}")

    failures = (
        bool(lost) or bool(differences) or ok != "ok" or bool(broken_keys)
        or any(v for v in found.values()) or any(code != 200 for code in served.values())
        or not unchanged
    )
    print("\n" + ("FAIL" if failures else "PASS"))
    shutil.rmtree(TMP, ignore_errors=True)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
