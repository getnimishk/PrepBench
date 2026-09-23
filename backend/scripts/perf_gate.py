# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The release gate's performance check (plan §33), for the backend.

Builds a database the size of a heavy real install -- a bank of 5,000 questions,
400 finished sessions with 20,000 answers, a 400-topic roadmap, 500 analysed
recordings with long transcripts -- then times the endpoints a learner waits on
and counts the SQL statements each one issues.

The query count is the N+1 detector: each read endpoint is called at two page
sizes, and a count that grows with the page size means one query per row.

Everything happens in a throwaway SQLite file in a temporary directory. The
learner's database is never opened.

    cd backend && ./.venv/Scripts/python.exe scripts/perf_gate.py [--json out.json]
"""
import json
import os
import random
import statistics
import sys
import tempfile
import time
from datetime import datetime, timedelta, UTC
from pathlib import Path

TMP = Path(tempfile.mkdtemp(prefix="prepbench-perf-"))
os.environ["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{(TMP / 'perf.db').as_posix()}"
os.environ["PREPBENCH_RECORDINGS_DIR"] = str(TMP / "recordings")
os.environ["GEMINI_API_KEY"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import event  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import engine, SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.question import Question, QuestionType, QuestionDifficulty  # noqa: E402
from app.models.option import QuestionOption  # noqa: E402
from app.models.exam_session import ExamSession, ExamMode, ExamStatus  # noqa: E402
from app.models.exam_answer import ExamAnswer, ConfidenceLevel  # noqa: E402
from app.models.spaced_repetition import SpacedRepetition  # noqa: E402
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic  # noqa: E402
from app.models.practice_recording import PracticeRecording  # noqa: E402
from app.models.recording_analysis import RecordingAnalysis  # noqa: E402
from app.models.subject import Subject  # noqa: E402

assert "perf.db" in settings.SQLALCHEMY_DATABASE_URI, "refusing to run against anything but the throwaway database"

random.seed(7)
NOW = datetime.now(UTC).replace(tzinfo=None)

DOMAINS = [f"Domain {i}" for i in range(8)]
TOPICS = {d: [f"{d} topic {j}" for j in range(5)] for d in DOMAINS}

# ------------------------------------------------------------------ SQL counter
_statements = 0


@event.listens_for(engine, "before_cursor_execute")
def _count(*_args, **_kwargs):
    global _statements
    _statements += 1


def seed(client: TestClient) -> dict:
    """The heavy install. Built through the ORM, in bulk."""
    db = SessionLocal()
    try:
        psm = db.query(Subject).filter(Subject.slug == "psm-i").one()
        started = time.perf_counter()

        questions = []
        for i in range(5000):
            domain = DOMAINS[i % len(DOMAINS)]
            questions.append(Question(
                text=f"Question {i}: which statement about {domain.lower()} holds under load?",
                question_type=QuestionType.SINGLE_CHOICE, difficulty=QuestionDifficulty.MEDIUM,
                domain=domain, topic=TOPICS[domain][i % 5], certification=psm.certification,
                subject_id=psm.id, explanation="Because the definition says so.", tags=[],
            ))
        db.add_all(questions)
        db.flush()
        db.add_all([
            QuestionOption(question_id=q.id, option_text=f"Option {k}", is_correct=(k == 0), order_index=k)
            for q in questions for k in range(4)
        ])
        db.flush()
        correct_option = {}
        for option in db.query(QuestionOption.question_id, QuestionOption.id).filter(QuestionOption.is_correct.is_(True)):
            correct_option[option.question_id] = option.id

        sessions = []
        for s in range(400):
            is_mock = s % 2 == 0
            size = 80 if is_mock else 20
            picked = random.sample(questions, size)
            start = NOW - timedelta(days=400 - s, hours=1)
            session = ExamSession(
                title=f"{'Mock' if is_mock else 'Drill'} {s}", exam_mode=ExamMode.TIMED if is_mock else ExamMode.PRACTICE,
                status=ExamStatus.COMPLETED, session_kind="mock" if is_mock else "drill", subject_id=psm.id,
                certification=psm.certification, total_questions=size, answered_questions=size,
                passing_percentage=85.0, question_ids_order=[q.id for q in picked],
                start_time=start, end_time=start + timedelta(minutes=50), time_spent_seconds=3000,
            )
            db.add(session)
            db.flush()
            correct = 0
            for q in picked:
                right = random.random() < 0.7
                correct += right
                db.add(ExamAnswer(
                    session_id=session.id, question_id=q.id,
                    selected_option_ids=[correct_option[q.id] if right else correct_option[q.id] + 1],
                    is_correct=right, time_spent_seconds=30, confidence_level=ConfidenceLevel.NOT_SET,
                    answered_at=start, first_answered_at=start,
                ))
            session.correct_count = correct
            session.score_percentage = round(100 * correct / size, 1)
            session.is_passed = "passed" if session.score_percentage >= 85 else "failed"
            sessions.append(session)
        db.flush()

        db.add_all([
            SpacedRepetition(question_id=q.id, repetition=1, interval_days=3, ease_factor=2.5,
                             next_review_date=NOW - timedelta(days=i % 10), last_reviewed_at=NOW - timedelta(days=5))
            for i, q in enumerate(questions[:3000])
        ])

        roadmap = Roadmap(title="Heavy roadmap", subject_id=psm.id)
        db.add(roadmap)
        db.flush()
        for p in range(20):
            phase = RoadmapPhase(roadmap_id=roadmap.id, name=f"Phase {p}", order_index=p)
            db.add(phase)
            db.flush()
            db.add_all([
                RoadmapTopic(roadmap_id=roadmap.id, phase_id=phase.id, title=f"Topic {p}.{t}", order_index=t,
                             learning_objective="Understand it.", success_criteria="Explain it.", estimated_hours=2)
                for t in range(20)
            ])

        transcript = ("Well, the situation was that the team had a deadline and I had to decide. " * 280)[:20000]
        recordings = [PracticeRecording(title=f"Take {r}", file_path=f"missing-{r}.webm", duration_seconds=120,
                                        file_size_bytes=1000) for r in range(500)]
        db.add_all(recordings)
        db.flush()
        db.add_all([
            RecordingAnalysis(recording_id=r.id, provider="fake", transcript=transcript, communication_scores=[],
                              content_scores=[], analysis_status="analyzed", summary="Fine.")
            for r in recordings
        ])
        db.commit()
        took = time.perf_counter() - started
        return {"subject_id": psm.id, "roadmap_id": roadmap.id, "recording_id": recordings[0].id,
                "domain": DOMAINS[0], "seconds": round(took, 1)}
    finally:
        db.close()


def measure(client: TestClient, method: str, url: str, runs: int = 5, **kwargs) -> dict:
    global _statements
    client.request(method, url, **kwargs)  # warm
    times, counts, status = [], [], None
    for _ in range(runs):
        _statements = 0
        started = time.perf_counter()
        response = client.request(method, url, **kwargs)
        times.append((time.perf_counter() - started) * 1000)
        counts.append(_statements)
        status = response.status_code
    return {"median_ms": round(statistics.median(times), 1), "max_ms": round(max(times), 1),
            "queries": max(counts), "status": status}


def main() -> int:
    with TestClient(app) as client:
        info = seed(client)
        sid, rid = info["subject_id"], info["roadmap_id"]
        print(f"Seeded in {info['seconds']}s into {TMP}")

        csv_rows = ["text,question_type,difficulty,domain,topic,certification,explanation,option_1,option_1_correct,option_2,option_2_correct"]
        subject = client.get(f"/api/v1/subjects/{sid}").json()
        for i in range(2000):
            csv_rows.append(f"\"Imported {i}: what does the Scrum Master serve?\",single_choice,medium,Imported,Imported topic,"
                            f"{subject['certification']},\"The team.\",The team,true,Nobody,false")
        csv_bytes = "\n".join(csv_rows).encode()

        checks = [
            # (name, budget_ms, method, url, kwargs)
            ("Question listing, 50 per page", 300, "GET", f"/api/v1/questions?subject_id={sid}&limit=50", {}),
            ("Question listing, 200 per page", 600, "GET", f"/api/v1/questions?subject_id={sid}&limit=200", {}),
            ("Question listing, filtered and searched", 300, "GET", f"/api/v1/questions?subject_id={sid}&domain=Domain%203&search=load&limit=50", {}),
            ("Question filters", 300, "GET", f"/api/v1/questions/filters?subject_id={sid}", {}),
            ("Preparations with readiness", 500, "GET", "/api/v1/subjects", {}),
            ("Home", 800, "GET", "/api/v1/home", {}),
            ("Daily goals", 500, "GET", "/api/v1/home/daily-goals", {}),
            ("Focus topics", 500, "GET", f"/api/v1/home/focus-topics?subject_id={sid}", {}),
            ("Insights: areas", 800, "GET", f"/api/v1/analytics/domain-performance?subject_id={sid}", {}),
            ("Insights: one area", 800, "GET", f"/api/v1/analytics/domain-detail?subject_id={sid}&domain={info['domain'].replace(' ', '%20')}", {}),
            ("Insights: score trend", 500, "GET", f"/api/v1/analytics/score-trends?subject_id={sid}", {}),
            ("Mock history", 500, "GET", f"/api/v1/subjects/{sid}/mocks", {}),
            ("Review queue", 500, "GET", f"/api/v1/review/queue?subject_id={sid}", {}),
            ("Spaced deck", 500, "GET", f"/api/v1/spaced/deck?subject_id={sid}", {}),
            ("Notifications", 500, "GET", "/api/v1/notifications", {}),
            ("Roadmap list", 300, "GET", "/api/v1/roadmaps", {}),
            ("Roadmap, 400 topics", 500, "GET", f"/api/v1/roadmaps/{rid}", {}),
            ("Roadmap schedule, 400 topics", 500, "GET", f"/api/v1/roadmaps/{rid}/schedule", {}),
            ("Recordings, 50 per page", 300, "GET", "/api/v1/recordings?limit=50", {}),
            ("Transcript (20,000 characters)", 300, "GET", f"/api/v1/recordings/{info['recording_id']}/analysis", {}),
            ("Storage report", 500, "GET", "/api/v1/system/storage", {}),
            ("Review badge counts", 300, "GET", f"/api/v1/review/counts?subject_id={sid}", {}),
            ("Search, everything", 500, "GET", f"/api/v1/search?q=load&subject_id={sid}", {}),
            ("Search, one kind (50)", 500, "GET", f"/api/v1/search?q=load&subject_id={sid}&limit=50", {}),
            ("Profile (days active over every answer)", 500, "GET", "/api/v1/profile", {}),
            ("Plan editor projection, 400 topics", 500, "GET", f"/api/v1/roadmaps/{rid}/schedule?draft=true&start_date=2099-01-01&weekly_hours_budget=6", {}),
            # The Question Bank's evidence: each row's outcome, the summary panels
            # and the outcome filter, all read from the 20,000 answers.
            ("Question listing with evidence, 50 per page", 300, "GET", f"/api/v1/questions?subject_id={sid}&limit=50&include_evidence=true", {}),
            ("Question listing, missed only", 300, "GET", f"/api/v1/questions?subject_id={sid}&outcome=missed&limit=50", {}),
            ("Question listing, due for review", 300, "GET", f"/api/v1/questions?subject_id={sid}&outcome=due&limit=50", {}),
            ("Question bank summary", 300, "GET", f"/api/v1/questions/summary?subject_id={sid}", {}),
        ]

        results = []
        for name, budget, method, url, kwargs in checks:
            outcome = measure(client, method, url, **kwargs)
            outcome.update(name=name, budget_ms=budget)
            results.append(outcome)

        # Writes, timed once each: they change what the next call sees.
        def once(name, budget, method, url, **kwargs):
            global _statements
            _statements = 0
            started = time.perf_counter()
            response = client.request(method, url, **kwargs)
            elapsed = (time.perf_counter() - started) * 1000
            results.append({"name": name, "budget_ms": budget, "median_ms": round(elapsed, 1), "max_ms": round(elapsed, 1),
                            "queries": _statements, "status": response.status_code})
            return response

        created = once("Start an 80-question mock", 1000, "POST", "/api/v1/exams",
                       json={"subject_id": sid, "session_kind": "mock", "total_questions": 80})
        exam = created.json()
        paper = client.get(f"/api/v1/exams/{exam['id']}").json()
        first = paper["questions"][0]
        once("Save an answer", 300, "POST", f"/api/v1/exams/{exam['id']}/answer",
             json={"question_id": first["id"], "selected_option_ids": [first["options"][0]["id"]]})
        for q in paper["questions"][1:]:
            client.post(f"/api/v1/exams/{exam['id']}/answer", json={"question_id": q["id"], "selected_option_ids": [q["options"][0]["id"]]})
        once("Submit the mock (scores, schedules 80 questions)", 1500, "POST", f"/api/v1/exams/{exam['id']}/finish")
        once("Validate a 2,000-row import", 5000, "POST", "/api/v1/imports/validate",
             files={"file": ("big.csv", csv_bytes, "text/csv")})

        # N+1: the same listing at two page sizes should cost the same number of queries.
        small = measure(client, "GET", f"/api/v1/questions?subject_id={sid}&limit=10&include_evidence=true", runs=1)["queries"]
        large = measure(client, "GET", f"/api/v1/questions?subject_id={sid}&limit=200&include_evidence=true", runs=1)["queries"]
        rec_small = measure(client, "GET", "/api/v1/recordings?limit=5", runs=1)["queries"]
        rec_large = measure(client, "GET", "/api/v1/recordings?limit=100", runs=1)["queries"]

    failures = 0
    width = max(len(r["name"]) for r in results)
    print(f"\n{'Endpoint'.ljust(width)}  median   max  budget  queries  status")
    for r in results:
        over = r["median_ms"] > r["budget_ms"] or r["status"] >= 400
        failures += over
        print(f"{r['name'].ljust(width)}  {r['median_ms']:>6}  {r['max_ms']:>5}  {r['budget_ms']:>6}  {r['queries']:>7}  {r['status']}"
              + ("   <-- OVER" if over else ""))
    print(f"\nN+1 check: questions with evidence {small} queries at 10 rows, {large} at 200; recordings {rec_small} at 5, {rec_large} at 100")
    n_plus_one = large > small + 2 or rec_large > rec_small + 2
    if n_plus_one:
        print("  <-- query count grows with the page size")
        failures += 1

    if "--json" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--json") + 1])
        out.write_text(json.dumps({"results": results, "n_plus_one": {
            "questions": [small, large], "recordings": [rec_small, rec_large]}}, indent=2), encoding="utf-8")

    engine.dispose()
    print(f"\n{'PASS' if failures == 0 else f'FAIL ({failures})'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
