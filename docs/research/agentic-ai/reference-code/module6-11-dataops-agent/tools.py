"""DataOps tools. Two read-only, two that change the world. Writes are idempotent on a key derived from the ACTION
(ticket + tool + arguments), not from the model's tool_use id: after a crash the model is asked again and may use a new id.
"""
import hashlib
import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from agentkit import Tool
from checkpoint import RunStore

RUNBOOK = {
    "ERR-4417": "Schema drift: the incoming file has a column the target table does not. Ask the data owner to approve a schema update. Do not drop the column.",
    "ERR-5102": "Late arrival: the upstream file came after the 06:00 UTC cutoff. Rerun the job once the file lands.",
    "ERR-6001": "Quota exceeded on the warehouse. No automatic fix; page the platform on-call.",
}
LOGS = {
    "orders": "2026-09-30 02:10 run ok, 1,204,000 rows",
    "payments": "2026-09-30 02:15 FAILED ERR-4417 column 'tax_region' not in target",
    "customers": "2026-09-30 02:20 FAILED ERR-5102 file arrived 06:42 UTC",
    "refunds": "2026-09-30 02:25 FAILED ERR-6001 warehouse quota exceeded",
}


class RunLog(BaseModel):
    model_config = ConfigDict(extra="forbid")      # an unexpected argument is an error, not something to ignore
    pipeline: Literal["orders", "payments", "customers", "refunds"]


class Runbook(BaseModel):
    model_config = ConfigDict(extra="forbid")      # an unexpected argument is an error, not something to ignore
    error_code: str = Field(pattern=r"^ERR-\d{4}$")


class Rerun(BaseModel):
    model_config = ConfigDict(extra="forbid")      # an unexpected argument is an error, not something to ignore
    pipeline: Literal["orders", "payments", "customers", "refunds"]


class Quarantine(BaseModel):
    model_config = ConfigDict(extra="forbid")      # an unexpected argument is an error, not something to ignore
    pipeline: Literal["orders", "payments", "customers", "refunds"]
    reason: str = Field(min_length=5, max_length=200)


def action_key(ticket, tool, args):
    return hashlib.sha1(f"{ticket}|{tool}|{json.dumps(args.model_dump(), sort_keys=True)}".encode()).hexdigest()[:16]


def make_registry(ticket: str, store: RunStore, world: dict, crash_after_write: bool = False) -> dict:
    """`world` stands in for the real systems the writes change. `crash_after_write` simulates dying right after a write."""

    def idempotent(tool_name, do):
        def fn(args, _tool_use_id):
            key = action_key(ticket, tool_name, args)
            prior = store.applied(key)
            if prior is not None:
                return {**prior, "note": "already applied, not repeated"}
            result = do(args)
            store.record_applied(key, result)
            if crash_after_write:
                raise SystemExit("simulated crash: the write is done, the checkpoint is not saved")
            return result
        return fn

    def rerun(a):
        world["reruns"].append(a.pipeline)
        return {"ok": True, "pipeline": a.pipeline, "action": "rerun scheduled"}

    def quarantine(a):
        world["quarantined"].append(a.pipeline)
        return {"ok": True, "pipeline": a.pipeline, "action": "new files held back"}

    tools = [
        Tool("get_run_log", "Return the latest run log line for one pipeline. Read-only. Use it first, for the pipeline named in the ticket. "
                            "It does not change anything and does not search by text.", RunLog,
             lambda a, k: LOGS[a.pipeline]),
        Tool("search_runbook", "Return the runbook guidance for one error code such as ERR-4417. Read-only. "
                               "Use it when a log line contains an ERR- code. It does not search by text.", Runbook,
             lambda a, k: RUNBOOK.get(a.error_code, f"No runbook entry for {a.error_code}.")),
        Tool("rerun_job", "Schedule a rerun of one pipeline. Changes data. Needs a person's approval. "
                          "Use only when the runbook says a rerun is the fix.", Rerun, idempotent("rerun_job", rerun), writes=True),
        Tool("quarantine_files", "Hold back new input files for one pipeline so bad data does not load. Changes data. "
                                 "Needs a person's approval. Use only when the runbook says to protect the target table.",
             Quarantine, idempotent("quarantine_files", quarantine), writes=True),
    ]
    return {t.name: t for t in tools}
