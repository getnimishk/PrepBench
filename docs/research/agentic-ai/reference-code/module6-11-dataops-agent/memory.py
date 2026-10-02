"""A preference memory that survives a restart (SQLite on disk), with the rules that decide what NOT to store.

Three things matter more than the storage: a scope (whose memory is this), a source and date (so you can judge staleness),
and a policy that refuses to store things that should never be remembered.
"""
import re
import sqlite3
import time

SECRET = re.compile(r"(password|passwd|api[_ -]?key|secret|token|bearer)\s*[:=]?\s*\S+", re.I)
PERSONAL = re.compile(r"(\b\d{3}-\d{2}-\d{4}\b|\b\d{12,19}\b|[\w.+-]+@[\w-]+\.[\w.]+)")   # looks like an ID number, card or email
ONE_OFF = re.compile(r"\b(today|tomorrow|this (week|morning)|right now|just this once)\b", re.I)
INSTRUCTION = re.compile(r"(^assistant:|ignore (all |any )?(previous|prior)|\balways (forward|send|approve)\b|pre-?approved)", re.I)   # a weak filter: see remember()
TRUSTED_SOURCES = {"user said so", "user confirmed"}      # the strong control is WHERE the text came from


def should_store(text: str) -> tuple[bool, str]:
    if SECRET.search(text):
        return False, "contains a credential"
    if PERSONAL.search(text):
        return False, "contains personal data"
    if ONE_OFF.search(text):
        return False, "one-off fact, not a lasting preference"
    if INSTRUCTION.search(text):
        return False, "looks like an instruction, not a fact"
    return True, "ok"


class Memory:
    def __init__(self, path=":memory:", ttl_days=180):
        self.db = sqlite3.connect(path)
        self.ttl = ttl_days * 86400
        self.db.execute("create table if not exists mem (user text, key text, value text, source text, saved real, primary key (user, key))")
        self.db.commit()

    def remember(self, user, key, value, source="user said so"):
        """Store only what the user said or confirmed. Text copied from an email, a web page or a tool result is never stored
        as a preference, whatever it says: that origin check stops memory poisoning far better than any pattern filter."""
        if source not in TRUSTED_SOURCES:
            return {"stored": False, "why": f"untrusted source: {source}"}
        ok, why = should_store(f"{key} {value}")
        if not ok:
            return {"stored": False, "why": why}
        self.db.execute("insert or replace into mem values (?,?,?,?,?)", (user, key, value, source, time.time()))
        self.db.commit()
        return {"stored": True}

    def recall(self, user, now=None):
        """Only this user's entries, and only fresh ones: an expired preference is treated as unknown, not as true."""
        now = now or time.time()
        rows = self.db.execute("select key, value, source, saved from mem where user=?", (user,)).fetchall()
        return {k: {"value": v, "source": s} for k, v, s, saved in rows if now - saved <= self.ttl}

    def forget(self, user, key):
        self.db.execute("delete from mem where user=? and key=?", (user, key))
        self.db.commit()
