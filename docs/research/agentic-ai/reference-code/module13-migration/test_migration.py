import converter
import data
import harness


def by_query(rows):
    return {r["query"]: r for r in rows}


def test_golden_results_encode_the_oracle_semantics():
    g = data.golden()
    assert g["Q3"] == [("Ana Maria Rao",), ("Li  Chen",), ("Sam  Ng",)]          # NULL middle name becomes empty text, two spaces
    assert round(g["Q4"][0][1], 2) == 33.33                                       # not integer division
    assert g["Q5"][0] == (1, "2026-01-17")


def test_naive_converter_fails_exactly_the_two_semantic_queries_with_the_right_category():
    r = by_query(harness.evaluate(converter.convert_v1))
    assert [q for q, x in r.items() if not x["passed"]] == ["Q3", "Q4"]
    assert r["Q3"]["defect"] == "null_semantics" and r["Q4"]["defect"] == "numeric"


def test_fixed_converter_passes_all_six():
    assert all(r["passed"] for r in harness.evaluate(converter.convert_v2))


def test_classifier_categories():
    assert harness.classify(ValueError("x"), [(1,)]) == "error"
    assert harness.classify([(1,)], [(1,), (2,)]) == "wrong_rows"
    assert harness.classify([(2,), (1,)], [(1,), (2,)]) == "ordering"
    assert harness.classify([(None,)], [("a",)]) == "null_semantics"
    assert harness.classify([(33,)], [(33.33,)]) == "numeric"
    assert harness.classify([("a",)], [("b",)]) == "wrong_values"
    assert harness.classify([(1,)], [(1,)]) is None


def test_gate_blocks_defects_and_unapproved_risky_changes_and_never_applies_without_a_person():
    log = []
    v1 = harness.evaluate(converter.convert_v1)
    assert harness.gate(v1, {"Q3": "sam", "Q4": "sam"}, log) == ["Q1", "Q2"]          # approving a defective query changes nothing
    assert any("defect null_semantics" in e["decision"] for e in log)
    v2 = harness.evaluate(converter.convert_v2)
    assert harness.gate(v2, {}, []) == ["Q1", "Q2"]                                   # risky rewrites and the write wait for a person
    assert harness.gate(v2, {q: "sam" for q in ("Q3", "Q4", "Q5", "Q6")}, []) == ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]


def test_a_write_runs_only_on_a_throwaway_copy():
    harness.run(converter.convert_v2(data.LEGACY["Q6"]), "Q6")
    assert data.fresh_db().execute("select count(*) from orders where status is null").fetchone()[0] == 1       # a new copy is untouched


def test_strict_gate_applies_nothing_without_a_named_approver():
    v2 = harness.evaluate(converter.convert_v2)
    assert harness.gate(v2, {}, [], strict=True) == []
    assert harness.gate(v2, {q: "sam" for q in ("Q1", "Q2")}, [], strict=True) == ["Q1", "Q2"]
    v1 = harness.evaluate(converter.convert_v1)
    assert harness.gate(v1, {q: "sam" for q in data.LEGACY}, [], strict=True) == ["Q1", "Q2", "Q5", "Q6"]   # defects still blocked
