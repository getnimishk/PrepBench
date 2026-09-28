# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The Lakehouse Lab journal (design §4.6).

Two ways in, deliberately different:
- `record_real()` is called only by the operation handlers, after the engine has
  actually done something. It's the only writer of `source='real_engine'`.
- `add_simulation()` is what the public POST calls. It forces
  `source='simulation'` and refuses an entry that claims to be real -- a client
  can't put a run on the record that the server didn't do.

No update path exists. An entry can be deleted, never edited.
"""
import uuid
from typing import List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import InvalidExamStateException, ResourceNotFoundException
from app.models.lab_journal_entry import LabJournalEntry
from app.schemas.lab import JournalEntry, JournalEntryIn


def record_real(db: Session, pack_id: str, op: str, table_name: Optional[str], result: dict,
                attempt_uid: Optional[str] = None, station: str = "c") -> str:
    """A result the real engine produced. Server-side only."""
    entry = LabJournalEntry(
        entry_uid=uuid.uuid4().hex, pack_id=pack_id, station=station, source="real_engine",
        op=op, table_name=table_name, result=result, attempt_uid=attempt_uid,
    )
    db.add(entry)
    db.commit()
    return entry.entry_uid


def add_simulation(db: Session, req: JournalEntryIn) -> JournalEntry:
    if req.source == "real_engine":
        raise InvalidExamStateException(
            "A journal entry from the browser is a simulation. Real-engine entries are written "
            "only by the server, when it runs the operation."
        )
    uid = req.entry_uid or uuid.uuid4().hex
    existing = db.query(LabJournalEntry).filter(LabJournalEntry.entry_uid == uid).first()
    if existing is not None:
        # The same entry arriving twice is a retry, not a second entry.
        return JournalEntry.model_validate(existing)
    entry = LabJournalEntry(
        entry_uid=uid, pack_id=req.pack_id, station=req.station, source="simulation",
        op=req.op, table_name=req.table_name, result=req.result, attempt_uid=req.attempt_uid,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(LabJournalEntry).filter(LabJournalEntry.entry_uid == uid).first()
        if existing is None:
            raise
        return JournalEntry.model_validate(existing)
    db.refresh(entry)
    return JournalEntry.model_validate(entry)


def list_entries(db: Session, pack_id: Optional[str] = None) -> List[JournalEntry]:
    query = db.query(LabJournalEntry)
    if pack_id:
        query = query.filter(LabJournalEntry.pack_id == pack_id)
    rows = query.order_by(LabJournalEntry.created_at.asc(), LabJournalEntry.id.asc()).all()
    return [JournalEntry.model_validate(r) for r in rows]


def delete_entry(db: Session, entry_uid: str) -> None:
    entry = db.query(LabJournalEntry).filter(LabJournalEntry.entry_uid == entry_uid).first()
    if entry is None:
        raise ResourceNotFoundException("LabJournalEntry", entry_uid)
    db.delete(entry)
    db.commit()


_SOURCE_LABEL = {"real_engine": "Real engine", "simulation": "Simulation"}
_SUMMARY_KEYS = ("version", "rows", "files", "files_before", "files_after", "error")


def export_markdown(db: Session, pack_id: Optional[str] = None) -> str:
    """"What I actually did": every entry, oldest first, each saying whether the
    engine really ran it or it was simulated."""
    entries = list_entries(db, pack_id)
    lines = ["# Lakehouse Lab journal", ""]
    lines.append(f"Pack: {pack_id}" if pack_id else "All packs")
    lines.append("")
    lines.append("Every entry says where its result came from: **Real engine** means the Delta engine on this "
                 "computer ran it; **Simulation** means a model in the browser worked it out.")
    lines.append("")
    if not entries:
        lines.append("_No entries yet._")
    for e in entries:
        when = e.created_at.strftime("%Y-%m-%d %H:%M UTC")
        target = f" on `{e.table_name}`" if e.table_name else ""
        lines.append(f"- **{when}** · {_SOURCE_LABEL[e.source]} · station {e.station.upper()} · `{e.op}`{target}")
        facts = [f"{k}: {e.result[k]}" for k in _SUMMARY_KEYS if e.result.get(k) is not None]
        if e.result.get("ok") is False and "error" not in e.result:
            facts.append("did not succeed")
        if facts:
            lines.append(f"  - {'; '.join(str(f) for f in facts)}")
    lines.append("")
    return "\n".join(lines)
