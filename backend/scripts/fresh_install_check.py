# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Boot PrepBench against a database that has never existed.

    backend/.venv/Scripts/python.exe backend/scripts/fresh_install_check.py

Not a clean machine -- same Python, same installed packages -- but it covers
the part of "fresh install" that can actually go wrong: an empty file, every
migration running from nothing, the seeders running for the first time, and
the surfaces having to render a state with no evidence in it at all.

It has already earned its place. It found that a fresh install seeds three
subjects and zero exam questions, so Home's one action was "Take your first
mock" against an empty bank -- an error message as the only thing a new user
is offered.
"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

work = Path(tempfile.mkdtemp(prefix="prepbench-fresh-"))
db = work / "exam_simulator.db"
os.environ["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db}"
os.environ["DATABASE_PATH"] = str(db)

sys.path.insert(0, r"E:\workspace\PrepBench\backend")

from fastapi.testclient import TestClient          # noqa: E402
from app.core.config import settings               # noqa: E402

assert str(db) in settings.SQLALCHEMY_DATABASE_URI, settings.SQLALCHEMY_DATABASE_URI
assert not db.exists(), "the database should not exist before the app starts"

from app.main import app                           # noqa: E402
from app.core.database import _migration_failures  # noqa: E402

failures = []
with TestClient(app) as client:                    # startup events run here
    if _migration_failures:
        failures.append(f"migration failures: {_migration_failures}")

    checks = {
        "/api/v1/subjects": lambda r: isinstance(r, list),
        "/api/v1/home": lambda r: r["mock_count"] == 0 and r["unreviewed_total"] == 0,
        "/api/v1/home/activity?limit=5": lambda r: isinstance(r, list),
        "/api/v1/home/other-preparation": lambda r: r == [],
        "/api/v1/review/queue": lambda r: r["items"] == [] and r["total_unreviewed"] == 0,
        # The dead "Exam Defaults" columns must not reappear on a fresh
        # database either -- they were dropped from the model, not just the
        # existing table.
        "/api/v1/settings": lambda r: set(r) == {
            "theme", "timer_sound_enabled", "default_target_role",
        },
        "/api/v1/questions": lambda r: "total" in r,
    }
    for path, ok in checks.items():
        resp = client.get(path)
        if resp.status_code != 200:
            failures.append(f"{path} -> {resp.status_code} {resp.text[:120]}")
            continue
        try:
            if not ok(resp.json()):
                failures.append(f"{path} -> unexpected body {str(resp.json())[:160]}")
        except Exception as exc:
            failures.append(f"{path} -> {exc}")

    subjects = client.get("/api/v1/subjects").json()
    print(f"  subjects seeded: {len(subjects)}")
    for s in subjects:
        r = s["readiness"]
        print(f"    {s['name']}: {r['state']}, {r['mock_count']} mocks, "
              f"blockers={[b['kind'] for b in r['blockers']]}")
        # No evidence must never read as a bad score.
        if r["mock_count"] == 0 and r["state"] not in ("needs_evaluation", "developing"):
            failures.append(f"{s['name']} claims {r['state']} with no mocks")

    questions = client.get("/api/v1/questions").json()
    print(f"  questions seeded: {questions['total']}")

    # A fresh install seeds subjects but no exam questions, so Home must not
    # offer a mock it cannot assemble. Every subject reports its own count,
    # and the engine refuses rather than inventing a paper.
    if questions["total"] == 0:
        for s in subjects:
            if s["question_count"] != 0:
                failures.append(f"{s['name']} claims {s['question_count']} questions on an empty bank")
        refused = client.post("/api/v1/exams", json={
            "certification": subjects[0].get("slug", ""), "total_questions": 10,
        })
        if refused.status_code != 400:
            failures.append(f"empty bank did not refuse an exam: {refused.status_code}")
        elif "empty" not in refused.json()["detail"].lower():
            failures.append(f"unhelpful empty-bank message: {refused.json()['detail']}")

    cols = client.get("/api/v1/settings").json()
    print(f"  settings fields: {sorted(cols)}")

print(f"  db created: {db.exists()} ({db.stat().st_size if db.exists() else 0} bytes)")
shutil.rmtree(work, ignore_errors=True)

if failures:
    print("\nFRESH INSTALL FAILED:")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("\nFRESH INSTALL OK")
