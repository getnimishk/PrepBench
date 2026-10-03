import bank
import selfscore as s


def test_banks_have_the_sizes_the_lessons_ask_for_and_every_question_cites_a_lesson():
    assert len(bank.FUNDAMENTALS) == 20 and len(bank.PLATFORM) == 15 and len(bank.DESIGN) == 4
    assert all(1 <= q[2] <= 59 for q in bank.FUNDAMENTALS + bank.PLATFORM)
    assert len({q[0] for q in bank.FUNDAMENTALS + bank.PLATFORM}) == 35


def test_leadership_bank_covers_modules_12_and_13_and_every_topic_60_to_71_that_a_question_can_test():
    assert len(bank.LEADERSHIP) == 14 and len({q[0] for q in bank.LEADERSHIP}) == 14
    assert all(60 <= q[2] <= 72 and len(q[4]) >= 3 and 60 <= q[3] <= 180 for q in bank.LEADERSHIP)
    assert {q[2] for q in bank.LEADERSHIP} >= {60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71}


def test_every_fundamentals_question_has_key_points_and_a_time_limit():
    assert all(len(q[4]) >= 3 and 60 <= q[3] <= 180 for q in bank.FUNDAMENTALS)


def test_coverage_finds_words_not_understanding():
    pts = bank.FUNDAMENTALS[8][4]
    got = bank.coverage("I would send an idempotency key and use a timeout", pts)
    assert got["idempotency key"] and got["timeouts and bounded retries"] and not got["stored first result"]


def test_drill_summary_flags_weak_and_slow_answers():
    rows = [dict(id="F01", seconds="60", points_hit="3", points_total="3"), dict(id="F02", seconds="120", points_hit="3", points_total="3"), dict(id="F03", seconds="50", points_hit="1", points_total="3")]
    r = s.summarise_drill(rows, {q[0]: q[3] for q in bank.FUNDAMENTALS})
    assert r["ok"] == 1 and r["over_time"] == ["F02"] and r["weak"] == ["F03"]


GOOD = dict(kind="incident", situation="A nightly load failed and customer dashboards showed stale numbers for three hours", action="I ran the incident call, assigned roles and had the rerun approved",
            result="Restored in 41 minutes; wrote a postmortem and added a freshness alert", my_part="ran the call and wrote the postmortem")


def test_story_checks():
    assert s.check_story(GOOD) == []
    f = s.check_story(dict(kind="x", situation="it happened", action="we did it", result="it was fine"))
    assert len(f) >= 5


def test_story_set_must_cover_all_six_kinds():
    assert len(s.stories_coverage([GOOD])) == 5


def test_case_study_checker_wants_all_seven_parts_and_numbers_and_honesty():
    assert len(s.check_case_study("# Case\nSome text")) >= 8
    full = "```mermaid\nflowchart TD\n```\n" + "\n".join(f"## {x}\nresult 12 of 20, $0.013, 96 percent" for x in s.CASE_SECTIONS) + "\nWhat I did not verify: cloud."
    assert s.check_case_study(full) == []


def test_mock_scoring():
    r = s.score_mock(dict(structure=2, evidence=1, tradeoffs=1, honesty=2, time=2))
    assert r["total"] == 8 and r["out_of"] == 10 and r["weakest"] == ["evidence", "tradeoffs"]
