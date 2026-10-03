# Reference code for the course lessons (waves 2 to 5)

Small programs that the lessons in `../lessons/` show and quote. Each was run on Python 3.14.7 (Pydantic 2.13.4, pytest 9.1.1, httpx 0.28.1); the lessons print real output. Files import each other by bare name, so **run them from inside their own folder**.

| Folder | Lessons | What it is | Run it |
|---|---|---|---|
| `module2/` | 9 to 11 | Python checks, a Pydantic model with tests, a misbehaving local API and a retrying async client | `python check_py.py`; `pytest`; `python mock_api.py` then `python client.py` |
| `module3/` | 18 | Confidence-interval and paired-test arithmetic | `python stats_check.py` |
| `module4-assistant/` | 21 to 25 | Ticket assistant: tools, approval gate, agent loop with guards, scripted model, 11 tests | `pytest`; `python demo.py` |
| `module5-rag/` | 27 to 32, 69 | Dependency-free RAG: chunkers, BM25, TF-IDF and trigram retrieval, RRF, grounded answers with abstention and access filter, evaluation by stage, 8 tests | `python demo.py`; `python evaluate.py`; `python chunk_sweep.py`; `python rag_eval.py`; `python rag_report.py`; `pytest` |
| `module6-11-dataops-agent/` | 33 to 37, 46 to 55 | The DataOps agent: sigma-band detection and tiers, checkpoint and resume, memory, skills linter, 25-case evaluation with CI gate, tracing, injection guards, cost model, outage simulation, identity linter, tool registry, policy, governance check, risk-based checkpoints; 58 tests | `pytest`; `python demo_tickets.py`; `python demo_crash.py`; `python eval25.py v1` then `v2` then `python ci_gate.py results_v1.json results_v2.json`; `python demo_trace.py`; `python demo_inject.py`; `python cost.py`; `python outage.py`; `python check_governance.py` |
| `module6-langgraph/` | 33, 36 | The approval-and-resume flow in LangGraph 1.2.12 with a SQLite checkpointer | needs `langgraph` and `langgraph-checkpoint-sqlite`; `python graph_agent.py` |
| `module7-mcp/` | 38 to 40 | An MCP server with two tools (SDK 2.2.0, protocol 2026-07-28), a stdio client, a wire logger, 4 tests | needs `mcp`; `python client.py`; `python wire_demo.py`; `pytest` |
| `module7-a2a/` | 41, 42 | An A2A agent served with a2a-sdk 1.2.1, a plain-httpx client with failure handling, 7 tests | needs `a2a-sdk`, `httpx`, `uvicorn`; `python agent_b.py` then `python agent_a.py`; `pytest` |
| `module8-multi-agent/` | 43 to 45 | Cost model of one agent versus workers, handoff packets and guards, separation of duties, 12 tests | `python compare.py`; `pytest` |
| `module12-product/` | 63 to 67 | RICE ranking with a stability test, ROI range and sensitivity simulation, build/extend/buy scorecard with weight stability, metric spec validator (HEART mapping), risk register validator; all figures fictional; 8 tests | `python rice.py`; `python roi.py`; `python scorecard.py`; `pytest` |
| `module13-migration/` | 70 | Migration harness around a rule-based converter stand-in on SQLite: six legacy-style queries, defect classification, approval gate with audit log; 6 tests | `python harness.py`; `pytest` |
| `module13-deploy/` | 71 | A small Starlette service with per-user bearer tokens, per-user and global cost caps, a kill switch and content-free logging; 6 tests | needs `starlette`, `httpx`; `pytest`; `uvicorn app:app --port 9300` |
| `module14-drills/` | 73 to 77 | The interview question banks (20 fundamentals, 15 platform, 4 designs) and self-scoring helpers for drills, stories, case studies and mock rubric; 8 tests | `pytest` |

Install the optional libraries in a virtual environment (for example `uv venv` then `uv pip install mcp a2a-sdk httpx uvicorn langgraph langgraph-checkpoint-sqlite pytest pydantic`). Generated files such as `results_v1.json` are not committed; run the evaluation to create them.

Nothing here has been run against a real model API (that needs a key and spends money) or on Azure or Databricks (no accounts). The scripted model uses the same message shapes as Anthropic's documented Messages API. Servers in these folders use ports 9101 and 9102 on purpose, to stay away from PrepBench's own ports (8000 and 5173).
