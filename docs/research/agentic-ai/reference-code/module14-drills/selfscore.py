"""Self-scoring helpers: drill results, STAR stories, case studies, and a mock-interview rubric.

Nothing here judges quality. It checks that the evidence the lesson asks for is present and counts what you recorded.
"""
import csv
import re
import statistics

STORY_KINDS = ["delivery", "stakeholder conflict", "incident", "cost decision", "stopped project", "build vs buy"]
CASE_SECTIONS = ["architecture diagram", "tradeoff record", "evaluation results", "cost calculation", "failure case", "production decision", "2-minute spoken version"]
RUBRIC = {"structure": "clear opening, three points, a close", "evidence": "numbers or a demonstrated result for each claim", "tradeoffs": "alternative, cost, what would change your mind",
          "honesty": "says what was read versus run, and what is unknown", "time": "inside the limit"}


def summarise_drill(path_or_rows, limits: dict) -> dict:
    """CSV columns: id, seconds, points_hit, points_total. Returns pass rate by a simple rule: at least 2/3 of points inside the limit."""
    rows = list(csv.DictReader(open(path_or_rows, encoding="utf-8"))) if isinstance(path_or_rows, str) else path_or_rows
    out = []
    for r in rows:
        hit, total, secs = int(r["points_hit"]), int(r["points_total"]), float(r["seconds"])
        out.append(dict(id=r["id"], covered=hit / total, on_time=secs <= limits[r["id"]], ok=hit / total >= 2 / 3 and secs <= limits[r["id"]]))
    return dict(n=len(out), ok=sum(o["ok"] for o in out), mean_coverage=round(statistics.mean(o["covered"] for o in out), 2),
                over_time=[o["id"] for o in out if not o["on_time"]], weak=[o["id"] for o in out if o["covered"] < 2 / 3])


def check_story(story: dict) -> list[str]:
    f = []
    for part in ("situation", "action", "result"):
        if len(story.get(part, "").split()) < 8:
            f.append(f"{part}: too thin, say what happened")
    if not re.search(r"\d", story.get("result", "")):
        f.append("result: needs a number (time, money, count, percentage)")
    if story.get("kind") not in STORY_KINDS:
        f.append(f"kind must be one of {STORY_KINDS}")
    if not story.get("my_part"):
        f.append("say what YOU did, not what the team did")
    return f


def stories_coverage(stories: list[dict]) -> list[str]:
    missing = [k for k in STORY_KINDS if k not in {s.get("kind") for s in stories}]
    return [f"no story for: {k}" for k in missing]


def check_case_study(text: str) -> list[str]:
    t = text.lower()
    f = [f"missing section: {s}" for s in CASE_SECTIONS if s not in t]
    if "```mermaid" not in t and "![" not in t:
        f.append("the architecture diagram must be an actual diagram or image")
    if len(re.findall(r"\d", text)) < 10:
        f.append("too few numbers: add evaluation and cost figures")
    if "not verified" not in t and "unverified" not in t and "did not" not in t:
        f.append("say what you did not verify")
    return f


def score_mock(scores: dict) -> dict:
    """scores: rubric item -> 0..2 by a peer. Returns total and the weakest items."""
    assert set(scores) == set(RUBRIC), "score every rubric item"
    return dict(total=sum(scores.values()), out_of=2 * len(RUBRIC), weakest=[k for k, v in scores.items() if v == min(scores.values())])
