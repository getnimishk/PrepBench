"""The DataOps rerun flow in LangGraph, for comparison with our hand-written loop. Scripted 'model', SQLite checkpointer.

Run:  python graph_agent.py
It runs the graph until the approval step, 'kills' the process (drops every object), builds a NEW graph on the same SQLite file,
and resumes with the approval decision. The write is applied once.
"""
import os
import sqlite3
from typing import TypedDict

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

DB = "graph_runs.sqlite"
WORLD = {"reruns": []}              # stands in for the real system the write changes


class State(TypedDict):
    ticket: str
    log: str
    runbook: str
    approved: bool
    result: str


def read_log(state):                # a read-only step
    return {"log": "customers FAILED ERR-5102 file arrived 06:42 UTC"}


def read_runbook(state):
    return {"runbook": "Late arrival: rerun the job once the file lands."}


def ask_person(state):              # pauses the run until a person answers; the state is saved at this point
    answer = interrupt({"question": "Rerun the customers job?", "log": state["log"], "runbook": state["runbook"]})
    return {"approved": bool(answer)}


def act(state):
    if not state["approved"]:
        return {"result": "not approved, nothing changed"}
    WORLD["reruns"].append("customers")
    return {"result": "rerun scheduled"}


def build(saver):
    g = StateGraph(State)
    for name, fn in [("read_log", read_log), ("read_runbook", read_runbook), ("ask_person", ask_person), ("act", act)]:
        g.add_node(name, fn)
    g.add_edge(START, "read_log")
    g.add_edge("read_log", "read_runbook")
    g.add_edge("read_runbook", "ask_person")
    g.add_edge("ask_person", "act")
    g.add_edge("act", END)
    return g.compile(checkpointer=saver)


if __name__ == "__main__":
    if os.path.exists(DB):
        os.remove(DB)
    cfg = {"configurable": {"thread_id": "T-9"}}

    conn = sqlite3.connect(DB, check_same_thread=False)
    app = build(SqliteSaver(conn))
    out = app.invoke({"ticket": "customers table is stale"}, cfg)
    print("first process: paused with", out["__interrupt__"][0].value["question"], "| reruns:", WORLD["reruns"])
    conn.close()
    del app                                                    # the process 'dies'

    conn = sqlite3.connect(DB, check_same_thread=False)
    app = build(SqliteSaver(conn))                             # a new process, same file
    snap = app.get_state(cfg)
    print("second process: saved state next step =", snap.next, "| log =", snap.values.get("log"))
    out = app.invoke(Command(resume=True), cfg)
    print("resumed:", out["result"], "| reruns:", WORLD["reruns"])
    print("checkpoints stored:", len(list(app.get_state_history(cfg))))
