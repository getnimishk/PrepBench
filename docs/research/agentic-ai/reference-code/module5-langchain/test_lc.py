import pytest

import lc_rag as lc
from answer import ABSTAIN, answer
from corpus import QUESTIONS


def test_the_langchain_chain_gives_the_same_answers_as_the_plain_pipeline_on_all_25_questions():
    chain = lc.build_chain()
    for q, _gold, _fact in QUESTIONS:
        plain = answer(lc.INDEX, q)
        got = chain.invoke(q)
        assert got["answer"] == plain["answer"], q
        assert got["citations"] == [c["chunk"] for c in plain["citations"]], q


def test_access_filter_runs_before_ranking_in_the_retriever():
    restricted = [c for c in lc.INDEX.chunks if c["acl"] != "all"]
    assert restricted, "the corpus must contain restricted chunks for this test to mean anything"
    group = restricted[0]["acl"]
    text = restricted[0]["text"]
    nobody = lc.AclRetriever(index=lc.INDEX).invoke(text)
    member = lc.AclRetriever(index=lc.INDEX, groups=(group,)).invoke(text)
    assert all(d.metadata["chunk"] != restricted[0]["id"] for d in nobody)
    assert any(d.metadata["chunk"] == restricted[0]["id"] for d in member)


def test_an_unanswerable_question_abstains():
    assert lc.build_chain().invoke("What is the airspeed of a laden swallow?")["answer"] == ABSTAIN


def test_tool_has_a_schema_and_rejects_bad_arguments():
    assert lc.search_documents.args["query"]["type"] == "string"
    assert lc.search_documents.invoke({"query": QUESTIONS[0][0]})
    with pytest.raises(Exception):
        lc.search_documents.invoke({"query": "x", "max_results": 99})
    with pytest.raises(Exception):
        lc.search_documents.invoke({"max_results": 2})          # query missing
