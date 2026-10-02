"""Save an agent run after every step so it can resume. SQLite, one row per run, replaced after each step.

What is saved: the conversation so far (as JSON) and the idempotency keys of writes already applied. The second part
matters: a crash can happen AFTER a write ran but BEFORE the checkpoint was saved. On resume the model re-asks for that
write; the stored key makes the tool return the earlier result instead of applying it twice.
"""
import json
import sqlite3


class RunStore:
    def __init__(self, path=":memory:"):
        self.db = sqlite3.connect(path)
        self.db.execute("create table if not exists runs (run_id text primary key, step integer, messages text, status text)")
        self.db.execute("create table if not exists applied (key text primary key, result text)")
        self.db.commit()

    def save(self, run_id, step, messages, status="running"):
        self.db.execute("insert or replace into runs values (?,?,?,?)", (run_id, step, json.dumps(messages), status))
        self.db.commit()

    def load(self, run_id):
        row = self.db.execute("select step, messages, status from runs where run_id=?", (run_id,)).fetchone()
        return None if row is None else {"step": row[0], "messages": json.loads(row[1]), "status": row[2]}

    def applied(self, key):
        row = self.db.execute("select result from applied where key=?", (key,)).fetchone()
        return None if row is None else json.loads(row[0])

    def record_applied(self, key, result):
        self.db.execute("insert or ignore into applied values (?,?)", (key, json.dumps(result)))
        self.db.commit()
