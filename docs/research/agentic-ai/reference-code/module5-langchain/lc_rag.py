"""The lesson 27 to 31 RAG pipeline expressed in LangChain (langchain-core), so the two styles can be compared line by line.

What is LangChain here and what is ours:
  ours        Index, search (BM25 + TF-IDF + trigram + rank fusion), best_sentence, the abstention rule  (../module5-rag, unchanged)
  LangChain   the Document type, the BaseRetriever interface, the Runnable pipeline syntax (|), a tool with a schema
The 'model' step is a deterministic extractive function wrapped as a Runnable, exactly like ../module5-rag/answer.py. No LLM is called.
Swapping in a real chat model means replacing that one step with a chat model object; the retriever and the access filter stay.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "module5-rag"))

from langchain_core.documents import Document  # noqa: E402
from langchain_core.retrievers import BaseRetriever  # noqa: E402
from langchain_core.runnables import RunnableLambda, RunnablePassthrough  # noqa: E402
from langchain_core.tools import tool  # noqa: E402
from pydantic import Field  # noqa: E402

from answer import ABSTAIN, best_sentence  # noqa: E402
from chunk import chunk_all, heading_chunks  # noqa: E402
from corpus import DOCS  # noqa: E402
from retrieve import Index, search  # noqa: E402

INDEX = Index(chunk_all(DOCS, heading_chunks))
THRESHOLD = 4.5


class AclRetriever(BaseRetriever):
    """Filters by the caller's groups BEFORE ranking, like answer.py. The groups belong to the retriever instance, never to the question text."""
    index: Index
    groups: tuple = Field(default_factory=tuple)
    top: int = 3

    model_config = {"arbitrary_types_allowed": True}

    def _get_relevant_documents(self, query, *, run_manager=None):
        visible = lambda i: self.index.chunks[i]["acl"] in ("all", *self.groups)
        scores = self.index.bm25(query)
        hits = search(self.index, query, "hybrid", top=self.top, allowed=visible)
        if not hits or max(scores[i] for i in hits) < THRESHOLD:
            return []                                    # nothing strong enough: the chain abstains
        return [Document(page_content=self.index.chunks[i].get("body", self.index.chunks[i]["text"]),
                         metadata={"chunk": self.index.chunks[i]["id"], "title": self.index.chunks[i]["title"]}) for i in hits]


def _answer_step(inputs: dict) -> dict:
    docs, question = inputs["docs"], inputs["question"]
    if not docs:
        return {"answer": ABSTAIN, "citations": []}
    best = docs[0]
    return {"answer": f"{best_sentence(question, best.page_content, INDEX.idf)} [{best.metadata['chunk']}]", "citations": [best.metadata["chunk"]]}


def build_chain(groups=()):
    retriever = AclRetriever(index=INDEX, groups=tuple(groups))
    return {"docs": retriever, "question": RunnablePassthrough()} | RunnableLambda(_answer_step)


def make_search_tool(groups=()):
    """Build the tool for ONE caller. The groups are bound here by the application, never taken from the model's arguments."""
    @tool
    def search_documents(query: str, max_results: int = 3) -> list[str]:
        """Search the document set the caller may see and return chunk ids. Use for a question about policy or process; do not use for anything else."""
        if not 1 <= max_results <= 5:
            raise ValueError("max_results must be between 1 and 5")
        return [d.metadata["chunk"] for d in AclRetriever(index=INDEX, groups=tuple(groups), top=max_results).invoke(query)]
    return search_documents
