from answer import ABSTAIN, answer, unsupported_numbers
from chunk import chunk_all, fixed_chunks, heading_chunks
from corpus import DOCS
from retrieve import Index, rrf


def build(chunker=heading_chunks):
    return Index(chunk_all(DOCS, chunker))


def test_chunk_ids_are_unique_and_cite_their_document():
    ids = [c["id"] for c in chunk_all(DOCS, heading_chunks)]
    assert len(ids) == len(set(ids))
    assert all("#" in i for i in ids)


def test_heading_chunks_carry_title_context():
    texts = [c["text"] for c in chunk_all(DOCS, heading_chunks) if c["doc"] == "runbook-errors"]
    assert any(t.startswith("Runbook: common pipeline errors > ERR-4417") for t in texts)


def test_fixed_chunks_overlap():
    doc = {"id": "x", "title": "x", "acl": "all", "updated": "", "text": " ".join(str(i) for i in range(100))}
    chunks = fixed_chunks(doc, size=20, overlap=5)
    assert chunks[0]["text"].split()[-5:] == chunks[1]["text"].split()[:5]


def test_rrf_rewards_agreement_between_lists():
    assert rrf([[1, 2, 3], [3, 1, 4]])[0] == 1          # 1 is high in both
    assert abs(sum([1 / 61, 1 / 62]) - 0.032522) < 1e-5  # 1/(k+rank), k=60


def test_answer_cites_a_chunk():
    out = answer(build(), "What does ERR-4417 mean?")
    assert out["citations"][0]["chunk"].startswith("runbook-errors#")


def test_unanswerable_question_abstains():
    assert answer(build(), "What is the CEO's salary?")["answer"] == ABSTAIN


def test_restricted_document_is_invisible_without_the_group():
    q = "How big is the annual bonus pool for the finance team?"
    assert "finance-bonus" not in str(answer(build(), q)["citations"])
    assert answer(build(), q, groups=("finance",))["citations"][0]["chunk"].startswith("finance-bonus")


def test_invented_number_is_flagged():
    assert unsupported_numbers("Kept for 120 days.", ["kept for 90 days"]) == ["120"]
    assert unsupported_numbers("Kept for 90 days.", ["kept for 90 days"]) == []
