# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Boot PrepBench against a database that already has a learner's history in it.

    backend/.venv/Scripts/python.exe backend/scripts/upgrade_check.py

fresh_install_check.py covers the empty case. This covers the one that can
actually lose something: an existing user's file, carrying evidence recorded
before half of these columns existed.

Two databases are exercised, because they fail differently.

  SYNTHETIC   A file built to the pre-change schema -- the dead "Exam
              Defaults" columns present, no session_kind, no source, no
              reviewed_at, no first_answered_at -- with history in it. This
              proves the migrations run at all against the old shape, which a
              copy of an already-upgraded file cannot.

  REAL        A copy of this machine's actual exam_simulator.db, booted twice.
              This proves the upgrade is idempotent over real data with real
              volume, and that nothing about the second run differs from the
              first.

The assertion that matters most in both is a negative one: no row disappears,
no score changes, and no session's provenance is rewritten by a restart.
"""
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

REPO = Path(r"E:\workspace\PrepBench")
REAL_DB = REPO / "backend" / "data" / "exam_simulator.db"

work = Path(tempfile.mkdtemp(prefix="prepbench-upgrade-"))
failures = []


def fail(msg):
    failures.append(msg)
    print("  FAIL:", msg)


def snapshot(path):
    """Everything a learner would notice if it changed."""
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    out = {}
    for table in ("exam_sessions", "exam_answers", "questions", "question_options",
                  "design_review_attempts", "system_design_attempts",
                  "practice_recordings", "spaced_repetition"):
        try:
            out[table] = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        except sqlite3.OperationalError:
            out[table] = None
    try:
        out["scores"] = [
            (r["id"], r["score_percentage"], r["status"])
            for r in con.execute(
                "SELECT id, score_percentage, status FROM exam_sessions ORDER BY id"
            )
        ]
        out["kinds"] = [
            (r["id"], r["session_kind"], r["source"])
            for r in con.execute(
                "SELECT id, session_kind, source FROM exam_sessions ORDER BY id"
            )
        ]
    except sqlite3.OperationalError:
        out["scores"] = out["kinds"] = None
    con.close()
    return out


def columns(path, table):
    con = sqlite3.connect(path)
    try:
        return [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
    finally:
        con.close()


# ---------------------------------------------------------------- SYNTHETIC
#
# Written as raw DDL rather than by deleting columns from the current models,
# because the point is to reproduce what a real pre-change file looks like --
# including the six settings columns that no longer exist anywhere in the
# source, so there is nothing left to derive them from.

OLD_SCHEMA = """
CREATE TABLE app_settings (
    id INTEGER NOT NULL,
    theme VARCHAR(20),
    timer_sound_enabled BOOLEAN,
    shuffle_options BOOLEAN,
    daily_practice_goal INTEGER,
    default_exam_mode VARCHAR(20),
    default_questions_count INTEGER,
    default_passing_percentage FLOAT,
    shuffle_questions BOOLEAN,
    initial_seed_completed BOOLEAN DEFAULT 0,
    default_target_role VARCHAR(200),
    PRIMARY KEY (id)
);
CREATE TABLE questions (
    id INTEGER NOT NULL,
    text TEXT NOT NULL,
    question_type VARCHAR(15) NOT NULL,
    difficulty VARCHAR(6) NOT NULL,
    domain VARCHAR(150) NOT NULL,
    topic VARCHAR(150) NOT NULL,
    subtopic VARCHAR(150),
    certification VARCHAR(150) NOT NULL,
    source VARCHAR(200),
    tags JSON,
    code_snippet TEXT,
    case_study_text TEXT,
    image_url VARCHAR(500),
    explanation TEXT,
    reference_url VARCHAR(500),
    created_at DATETIME,
    updated_at DATETIME,
    PRIMARY KEY (id)
);
CREATE TABLE question_options (
    id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    explanation_why_incorrect TEXT,
    order_index INTEGER,
    PRIMARY KEY (id),
    FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE
);
CREATE TABLE exam_sessions (
    id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    exam_mode VARCHAR(17) NOT NULL,
    status VARCHAR(11) NOT NULL,
    certification VARCHAR(150),
    total_questions INTEGER NOT NULL,
    answered_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    score_percentage FLOAT,
    passing_percentage FLOAT NOT NULL,
    is_passed VARCHAR(10),
    time_allowed_seconds INTEGER,
    time_spent_seconds INTEGER NOT NULL,
    current_question_index INTEGER NOT NULL,
    question_ids_order JSON NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    PRIMARY KEY (id)
);
CREATE TABLE exam_answers (
    id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    selected_option_ids JSON,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    confidence_level VARCHAR(7),
    is_flagged BOOLEAN,
    is_bookmarked BOOLEAN,
    user_notes TEXT,
    answered_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY(session_id) REFERENCES exam_sessions (id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE
);
"""

OLD_DATA = """
INSERT INTO app_settings VALUES (1, 'dark', 1, 1, 10, 'PRACTICE', 25, 95.0, 0, 1, NULL);

INSERT INTO questions (id, text, question_type, difficulty, domain, topic, certification, explanation, created_at, updated_at)
  VALUES (1, 'Who owns the Product Backlog?', 'SINGLE_CHOICE', 'EASY', 'Scrum Artifacts', 'Product Backlog', 'PSM I', 'The Product Owner.', '2026-01-04 10:00:00', '2026-01-04 10:00:00'),
         (2, 'How long is the Daily Scrum?', 'SINGLE_CHOICE', 'EASY', 'Scrum Events', 'Daily Scrum', 'PSM I', '15 minutes.', '2026-01-04 10:00:00', '2026-01-04 10:00:00');

-- A question loaded into the file by hand rather than through the app:
-- difficulty as the enum's VALUE instead of its name, and tags NULL instead
-- of []. Twenty-five of these were sitting in the real database and made the
-- whole Question Bank return 500 -- the page reported a connection problem
-- over a backend that was running perfectly.
INSERT INTO questions (id, text, question_type, difficulty, domain, topic, certification, explanation, tags, created_at, updated_at)
  VALUES (3, 'Who may cancel a Sprint?', 'SINGLE_CHOICE', 'medium', 'Scrum Events', 'Sprint', 'PSM I - Professional Scrum Master', 'Only the Product Owner.', NULL, '2026-09-01 06:21:52', '2026-09-01 06:21:52');

INSERT INTO question_options (question_id, option_text, is_correct, order_index)
  VALUES (1, 'The Product Owner', 1, 0), (1, 'The Scrum Master', 0, 1),
         (2, '15 minutes', 1, 0), (2, 'As long as it takes', 0, 1),
         (3, 'The Product Owner', 1, 0), (3, 'The Scrum Master', 0, 1);

-- An 80-question full paper: the shape reconcile_evidence recognises.
INSERT INTO exam_sessions (id, title, exam_mode, status, certification, total_questions,
                           answered_questions, correct_count, score_percentage,
                           passing_percentage, is_passed, time_allowed_seconds, time_spent_seconds,
                           current_question_index, question_ids_order, start_time, end_time)
  VALUES (1, 'PSM I Practice Exam', 'TIMED', 'COMPLETED', 'PSM I - Professional Scrum Master', 80, 80, 70, 87.5,
          95.0, 'failed', 3600, 3400, 79, '[1,2]', '2026-02-10 19:00:00', '2026-02-10 20:00:00');

-- A short warm-up: must stay a drill.
INSERT INTO exam_sessions (id, title, exam_mode, status, certification, total_questions,
                           answered_questions, correct_count, score_percentage,
                           passing_percentage, is_passed, time_spent_seconds,
                           current_question_index, question_ids_order, start_time, end_time)
  VALUES (2, 'Quick practice', 'PRACTICE', 'COMPLETED', 'PSM I - Professional Scrum Master', 10, 10, 6, 60.0,
          70.0, 'failed', 1200, 9, '[1,2]', '2026-02-12 08:00:00', '2026-02-12 08:20:00');

-- A regression test that was run against this database.
INSERT INTO exam_sessions (id, title, exam_mode, status, certification, total_questions,
                           answered_questions, correct_count, score_percentage,
                           passing_percentage, is_passed, time_spent_seconds,
                           current_question_index, question_ids_order, start_time, end_time)
  VALUES (3, 'Analytics fixture', 'PRACTICE', 'COMPLETED', 'UnitTestCert-abc123', 5, 5, 5, 100.0,
          70.0, 'passed', 300, 4, '[1]', '2026-02-13 08:00:00', '2026-02-13 08:05:00');

INSERT INTO exam_answers (session_id, question_id, selected_option_ids, is_correct, time_spent_seconds, confidence_level, is_flagged, is_bookmarked, answered_at)
  VALUES (1, 1, '[2]', 0, 30, 'NOT_SET', 0, 0, '2026-02-10 19:05:00'),
         (1, 2, '[3]', 1, 25, 'NOT_SET', 0, 0, '2026-02-10 19:07:00'),
         (2, 1, '[1]', 1, 20, 'NOT_SET', 0, 0, '2026-02-12 08:03:00');
"""

synthetic = work / "old.db"
con = sqlite3.connect(synthetic)
con.executescript(OLD_SCHEMA)
con.executescript(OLD_DATA)
con.commit()
con.close()

print("SYNTHETIC pre-change database")
before = snapshot(synthetic)
print(f"  before: {before['exam_sessions']} sessions, {before['exam_answers']} answers, "
      f"{before['questions']} questions")
old_settings_cols = columns(synthetic, "app_settings")
assert "default_passing_percentage" in old_settings_cols, "the fixture is not actually old"

os.environ["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{synthetic}"
os.environ["DATABASE_PATH"] = str(synthetic)
sys.path.insert(0, str(REPO / "backend"))

from fastapi.testclient import TestClient           # noqa: E402
from app.core.config import settings as cfg         # noqa: E402

assert str(synthetic) in cfg.SQLALCHEMY_DATABASE_URI, cfg.SQLALCHEMY_DATABASE_URI

from app.main import app                            # noqa: E402
from app.core.database import _migration_failures   # noqa: E402

with TestClient(app) as client:
    if _migration_failures:
        fail(f"migrations reported failures: {_migration_failures}")

    after = snapshot(synthetic)

    # ---- nothing was lost
    for table in ("exam_sessions", "exam_answers", "questions", "question_options"):
        if after[table] < before[table]:
            fail(f"{table}: {before[table]} rows before, {after[table]} after")

    # ---- no score was rewritten
    if [(i, s) for i, s, _ in after["scores"]][:3] != [(1, 87.5), (2, 60.0), (3, 100.0)]:
        fail(f"scores changed: {after['scores'][:3]}")

    # ---- provenance is what reconcile_evidence documents, and nothing more
    kinds = dict((i, (k, src)) for i, k, src in after["kinds"])
    if kinds.get(1) != ("mock", "learner"):
        fail(f"the 80-question paper should be a learner mock, got {kinds.get(1)}")
    if kinds.get(2) != ("drill", "learner"):
        fail(f"the 10-question warm-up should stay a learner drill, got {kinds.get(2)}")
    if kinds.get(3) != ("drill", "test"):
        fail(f"the UnitTestCert session should be quarantined as test, got {kinds.get(3)}")

    # ---- the dead columns are gone, and the API does not report them
    now_cols = columns(synthetic, "app_settings")
    for dead in ("shuffle_options", "daily_practice_goal", "default_exam_mode",
                 "default_questions_count", "default_passing_percentage", "shuffle_questions"):
        if dead in now_cols:
            fail(f"app_settings still carries {dead}")
    body = client.get("/api/v1/settings").json()
    if set(body) != {"theme", "timer_sound_enabled", "default_target_role"}:
        fail(f"settings API exposes {sorted(body)}")
    # The learner's own choice survived the drop.
    if body["theme"] != "dark":
        fail(f"theme was reset to {body['theme']!r}")

    # ---- the added columns arrived with the documented defaults
    answer_cols = columns(synthetic, "exam_answers")
    for added in ("reviewed_at", "first_answered_at"):
        if added not in answer_cols:
            fail(f"exam_answers is missing {added}")
    con = sqlite3.connect(synthetic)
    unbackfilled = con.execute(
        "SELECT COUNT(*) FROM exam_answers WHERE first_answered_at IS NULL"
    ).fetchone()[0]
    pre_reviewed = con.execute(
        "SELECT COUNT(*) FROM exam_answers WHERE reviewed_at IS NOT NULL"
    ).fetchone()[0]
    con.close()
    if unbackfilled:
        fail(f"{unbackfilled} answers have no first_answered_at")
    if pre_reviewed:
        fail(f"{pre_reviewed} historical answers were marked as already reviewed")

    # ---- the learner's evidence is readable through the product
    home = client.get("/api/v1/home").json()
    print(f"  home: {home['mock_count']} mocks, {home['unreviewed_total']} unreviewed")
    if home["mock_count"] != 1:
        fail(f"expected the one full paper to count, got {home['mock_count']}")
    if home["unreviewed_total"] != 1:
        fail(f"expected the one unreviewed miss, got {home['unreviewed_total']}")
    q = client.get("/api/v1/review/queue").json()
    if len(q["items"]) != 1:
        fail(f"review queue should hold the miss, got {q}")

    # ---- the hand-loaded row is repaired, and still there
    listed = client.get("/api/v1/questions?skip=0&limit=100")
    if listed.status_code != 200:
        fail(f"question listing failed on a hand-loaded row: "
             f"{listed.status_code} {listed.text[:160]}")
    else:
        body = listed.json()
        print(f"  questions listed: {body['total']}")
        if body["total"] < 3:
            fail(f"a question went missing: {body['total']} of 3")
        hand = [q for q in body["items"] if q["id"] == 3]
        if not hand:
            fail("the hand-loaded question was not returned")
        elif hand[0]["difficulty"] != "medium" or hand[0]["tags"] != []:
            fail(f"the hand-loaded row was not repaired: "
                 f"{hand[0]['difficulty']!r} tags={hand[0]['tags']!r}")

print("  synthetic upgrade complete")

# ------------------------------------------------------------------- REAL
#
# Booted in a subprocess, twice. The app is a module-level singleton bound to
# one engine at import time, so a second database cannot be reached from this
# process once app.main has been imported.

print("\nREAL database (copy of this machine's file), booted twice")
if not REAL_DB.exists():
    print("  skipped: no developer database on this machine")
else:
    real = work / "real.db"
    shutil.copy2(REAL_DB, real)
    baseline = snapshot(real)
    print(f"  before: {baseline['exam_sessions']} sessions, {baseline['exam_answers']} answers, "
          f"{baseline['questions']} questions, {baseline['spaced_repetition']} scheduled")

    runner = work / "boot_once.py"
    runner.write_text(
        "import os, sys, json\n"
        f"os.environ['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///{real.as_posix()}'\n"
        f"os.environ['DATABASE_PATH'] = r'{real}'\n"
        f"sys.path.insert(0, r'{REPO / 'backend'}')\n"
        "from fastapi.testclient import TestClient\n"
        "from app.main import app\n"
        "from app.core.database import _migration_failures\n"
        "with TestClient(app) as c:\n"
        "    print(json.dumps({\n"
        "        'failures': [str(f) for f in _migration_failures],\n"
        "        'home': c.get('/api/v1/home').json(),\n"
        "        'settings': sorted(c.get('/api/v1/settings').json()),\n"
        "        'questions': c.get('/api/v1/questions?skip=0&limit=1').status_code,\n"
        "    }))\n",
        encoding="utf-8",
    )

    import json
    import subprocess

    runs = []
    for n in (1, 2):
        proc = subprocess.run([sys.executable, str(runner)], capture_output=True, text=True)
        line = [ln for ln in proc.stdout.splitlines() if ln.startswith("{")]
        if not line:
            fail(f"boot {n} produced no result: {proc.stdout[-400:]} {proc.stderr[-400:]}")
            break
        result = json.loads(line[-1])
        runs.append(result)
        state = snapshot(real)
        print(f"  boot {n}: {state['exam_sessions']} sessions, {state['exam_answers']} answers, "
              f"mocks={result['home']['mock_count']}, unreviewed={result['home']['unreviewed_total']}")
        if result["failures"]:
            fail(f"boot {n} migration failures: {result['failures']}")
        if result.get("questions") != 200:
            fail(f"boot {n}: the question listing returned {result.get('questions')}")
        for table in ("exam_sessions", "exam_answers", "questions", "question_options",
                      "design_review_attempts", "system_design_attempts",
                      "practice_recordings", "spaced_repetition"):
            if baseline[table] is not None and state[table] < baseline[table]:
                fail(f"boot {n}: {table} lost rows ({baseline[table]} -> {state[table]})")
        if baseline["scores"] and state["scores"] != baseline["scores"]:
            fail(f"boot {n}: a score or status changed")

    if len(runs) == 2:
        # Idempotence is not "it did not crash the second time". It is that
        # the second run is indistinguishable from the first.
        if runs[0]["home"] != runs[1]["home"]:
            fail(f"second boot reports different state: {runs[0]['home']} vs {runs[1]['home']}")
        if runs[0]["settings"] != runs[1]["settings"]:
            fail("second boot changed the settings shape")
        after_two = snapshot(real)
        if after_two["kinds"] != snapshot(real)["kinds"]:
            fail("provenance is unstable across reads")
        print("  idempotent: second boot reports identical state")

shutil.rmtree(work, ignore_errors=True)

if failures:
    print(f"\nUPGRADE FAILED ({len(failures)} problem(s))")
    sys.exit(1)
print("\nUPGRADE OK")
