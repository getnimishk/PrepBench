---
name: dataops-triage
description: Triage a failed or anomalous data pipeline run. Use when a ticket mentions a pipeline failure, an ERR- error code, stale or missing data, or a row-count anomaly. Do not use for access requests, expenses or general questions.
---

# DataOps triage

## Steps
1. Read the ticket and name the pipeline. If no pipeline is named, ask; do not guess.
2. Call `get_run_log` for that pipeline.
3. If the log has an `ERR-` code, call `search_runbook` with that code.
4. Say what you found and what the runbook recommends, in two or three sentences.
5. Only if the runbook names a fix that matches a write tool, propose it and wait for a person's approval.

## Advice, not enforcement
Never change data without approval. This sentence is advice to the model. The real control is the approval gate in code
(`ApprovalGate`), which blocks every write tool whatever this file says.
