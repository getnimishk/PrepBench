# Tool registries, schemas & permissions

**Course:** Agentic AI, from first principles to production · Module 10 Security and Governance · lesson 52 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Design a tool-registry entry (schema plus permission level) and a read, write and approval-required model for one agent.

> Sources (read 2026-10-02 and 2026-10-03; details and gaps in docs/research/agentic-ai): Model Context Protocol, 'The MCP Registry' (about page; in preview: a centralised metadata repository for publicly accessible servers; server.json metadata; namespace verification through GitHub or DNS; no private servers; the registry is not designed for self-hosting and private registries should implement its OpenAPI), MCP specification 2026-07-28 Tools page (names, schemas, annotations are untrusted; clients should confirm sensitive operations and log use); Databricks documentation 'Agent tools' (updated 2026-09-11: Unity Catalog functions, MCP servers and retriever tools as tools; EXECUTE permission; Unity Gateway as a control plane; on-behalf-of-user and service-principal invocation); Microsoft Azure Architecture Center 'AI agent orchestration patterns' (least privilege; security trimming in every agent); lessons 22, 23, 38 to 40 and 51. Read 2026-10-03 through page summaries. The code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; the folder's tests passed (58 in all, covering lessons 33 to 55). Permission names, policy values, owners and approvers in it are examples for the exercise, not recommendations for your organisation. Unverified: how a given Unity Catalog or Foundry deployment enforces registry entries in practice (we read overview pages, not the permission model in detail); the MCP Registry's status after its preview.

---

## Part 1 · Why a registry

With two tools in one agent, 'the registry' is the list in your code. With fifty tools across several agents and teams, the questions change: who owns this tool, what data can it touch, may this agent use it, what permission does it need, which version is live, and what do we log? A **tool registry** is the one place those answers live, kept outside any single agent so that governance can read it.

Public examples show the idea at different scales:

- **The MCP Registry** (in preview) is a central metadata repository for publicly accessible MCP servers. Each entry, in a standard `server.json` format, has the server's unique name (in a reverse-DNS style such as `io.github.user/server-name`), where to find it (a package name or a remote URL), how to run it, and descriptive data. Names are tied to a verified GitHub account or domain, so only the legitimate owner can publish under a namespace. Two limits to remember: it does **not** support private servers (it recommends you host your own private registry for those, implementing its OpenAPI), and it delegates **security scanning** to package registries and downstream marketplaces. A listing says who published a server; it does not say the server is safe.
- **Databricks** treats tools as governed objects: Unity Catalog functions, MCP servers and retriever tools, with permission to **EXECUTE** needed to run them, and a control plane ('Unity Gateway', in the page's words) that controls access and monitors activity. Tools can be called on behalf of the user or by a service principal.

An important point from lesson 38 carries over: the MCP specification says tool descriptions and annotations are untrusted unless they come from a trusted server. **Your registry is the trusted record**: you describe each tool, set its permission level and review changes. A server's own claim ('read-only') is a hint, not a fact.

**Worked example**

Fictional. Three teams build tools for ticket systems. Without a registry, two of them each ship a tool called `search` with different permissions, and no one knows which agents use which. With one, each entry has an owner and a version, the collision is noticed at review, and an agent can only be given tools that are listed and active.

**Common mistake**

Treating a public registry listing as an approval. It shows a name and where to get the server; whether it is safe is your review.

**Check yourself.** What does the MCP Registry tell you about a server, and what does it not?

<details><summary>Model answer (write yours first)</summary>

It tells you the server's verified-namespace name, where to find it and how to run it. It does not vouch for the safety of the code; security scanning is delegated elsewhere, and it does not support private servers.

</details>

---

## Part 2 · A registry entry: schema plus permission level

Here is the registry entry we use for the DataOps tools. It is a Pydantic model, so a bad entry fails validation, and entries can be **generated from the live tool objects** so the registry cannot drift from the code. The two decisions a human makes (the permission level and the data classes) are passed in and checked by a reviewer.

```python
"""A tool registry: one entry per tool, with the schema, the permission level, the owner and the rules a tool must meet to be listed.

The permission level is what governance reads: 'read' (changes nothing), 'write' (changes something but is reversible and low impact),
'approval_required' (a person approves before it runs). Entries can be generated from the tool objects, so the registry cannot drift from the code.
"""
import re
from typing import Literal

from pydantic import BaseModel, Field

SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


class ToolEntry(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_]{2,63}$")
    version: str
    description: str = Field(min_length=40)
    input_schema: dict
    permission: Literal["read", "write", "approval_required"]
    data_classes: list[str]                       # what data it can touch: 'operational', 'customer', 'financial' ...
    owner: str
    status: Literal["active", "deprecated"] = "active"
    runs_as: Literal["agent", "user_delegated"] = "agent"
    idempotent: bool = True
    rate_limit_per_min: int = Field(default=60, ge=1)



```

The fields that matter most:

| Field | Why it is there |
|---|---|
| `name`, `version` | A stable identity and a way to say which version an agent was tested with; a changed tool is a new version |
| `description` | What the model reads. Our rules require that it says **when to use** the tool and **what it does not do or its limit** |
| `input_schema` | A JSON Schema for the arguments. Our rule: an object that **forbids extra properties** (`additionalProperties: false`), so an unexpected argument is an error, not silently ignored |
| `permission` | `read`, `write` or `approval_required`: the level governance reads (next section and lesson 53) |
| `data_classes` | What data the tool can touch, so privacy and retention rules can be applied (lesson 54) |
| `owner`, `status` | Who answers for it, and whether it is `active` or `deprecated` (agents may not use deprecated tools) |
| `runs_as` | Whether the tool runs with the user's delegated authority or the agent's own (lesson 51) |
| `idempotent`, `rate_limit_per_min` | Whether a repeat is safe (lesson 25), and a ceiling on use |

To make `additionalProperties: false` appear in the generated schema we added `model_config = ConfigDict(extra="forbid")` to each tool's argument model. That also gives a runtime benefit: an injected extra argument fails validation (lesson 48).

**Worked example**

```python
ToolEntry(name='rerun_job', version='1.0.0',
    description="Schedule a rerun of one pipeline. Changes data. Needs a person's approval. Use only when the runbook says a rerun is the fix.",
    input_schema={'type': 'object', 'additionalProperties': False, 'properties': {...}},
    permission='approval_required', data_classes=['operational'], owner='platform-team@example.com', idempotent=True)
```

**Common mistake**

Writing the registry by hand beside the code. They drift apart, and the registry then describes tools that do not exist or misses ones that do. Generate entries from the code and review the human decisions.

**Check yourself.** Which two fields in an entry are human decisions that a reviewer must check, and why generate the rest from code?

<details><summary>Model answer (write yours first)</summary>

The permission level and the data classes. The rest (name, description, schema, owner) can be taken from the tool object so the registry cannot drift from the code.

</details>

---

## Part 3 · Read, write and approval-required: one model for one agent

The criterion asks for a read, write and approval-required model for one agent. Ours for the DataOps agent:

| Tool | Level | Why | Who or what stops misuse |
|---|---|---|---|
| `get_run_log` | read | Returns one log line; changes nothing | Enum of pipeline names; rate limit |
| `search_runbook` | read | Returns guidance for one error code; changes nothing | Pattern `^ERR-\d{4}$` on the argument |
| `rerun_job` | approval_required | Schedules a job, which costs money and changes data | Approval gate; idempotent on the action key; enum of pipelines; not offered at tier 2 |
| `quarantine_files` | approval_required | Holds back input files, which stops a load | Approval gate; idempotent; reason required (5 to 200 characters); not offered at tier 2 |

The three levels are a simple vocabulary for governance: **read** needs no approval; **write** changes something reversible and low-impact and may run with logging; **approval_required** means a person approves before it runs. Our DataOps agent has no plain `write` tools, because every change is either harmless or approval-required, which is easier to defend.

The registry earns its keep when it is **checked**. Our governance check (lesson 53) builds the entries from the live tools and validates them. The first time we ran it, it **failed on our own tools**: the two read tools had descriptions that did not say when to use them ('Return the latest run log line for one pipeline. Read-only.'). A model chooses tools from descriptions (lesson 22), so a missing 'when' is a real defect, not a formality. We fixed the descriptions ('Use it first, for the pipeline named in the ticket. It does not change anything and does not search by text.') and the check passed. That is the pattern: write the rule as a check, run it, and let it find what review missed.

The other things to decide per tool, for a larger system: **who may add or change an entry** (a pull request with a named reviewer, not the agent), **how versions roll out** (an agent pins a version; a new version is tested first), **how deprecation works** (mark deprecated, warn, remove after a date), and **how entries reach the agent** (only the tools the run's tier allows, as in lesson 37).

**Worked example**

```text
$ python check_governance.py        (first run, before the fix)
BLOCKED: G5: get_run_log: the description should say when to use the tool
BLOCKED: G5: search_runbook: the description should say when to use the tool
RESULT: blocked   (exit 1)

$ python check_governance.py        (after fixing the two descriptions)
RESULT: pass      (exit 0)
```

**Common mistake**

Letting an agent register or change its own tools. Any change to what an agent can do is a change to its authority and needs a human review.

**Check yourself.** Why does the registry mark `rerun_job` approval_required while `get_run_log` is read?

<details><summary>Model answer (write yours first)</summary>

`rerun_job` changes data and costs money, so a person must approve before it runs; `get_run_log` only reads, so it can run freely. The level is what governance and the policy engine act on.

</details>

---

## Do it: lab

1. Design a registry entry for each tool of one of your agents: name, version, description (with when to use and what it does not do), input schema with extra properties forbidden, permission level, data classes, owner, status and whether it is idempotent.
2. Generate the entries from your live tool objects (start from `registry.py`), passing in the permission levels and data classes as explicit decisions. Run `check_registry` and fix every finding.
3. Write the read, write and approval-required model for your agent as a table with the reason for each level and what stops misuse.
4. Prove one rule blocks: change a tool so it breaks a rule (remove 'when to use', or mark a writing tool `write`) and show the check fail with a nonzero exit code, then fix it.
5. Write the change process: who may add or change an entry, how versions roll out, how deprecation works, and how only the allowed entries reach each run.

**Done when:** you have a registry entry (schema plus permission level) for every tool of one agent, generated from code and passing your checks; a read, write and approval-required table; and a demonstration that a rule-breaking change fails the check.

---

## Interview check

**Question.** How do you manage tools for many agents safely?

<details><summary>A strong answer has this shape</summary>

1. A registry outside any single agent: one entry per tool with owner, version, schema, permission level, data classes and status, generated from the code so it cannot drift.
2. A small permission vocabulary (read, write, approval_required) that policy and approvals act on, and strict argument schemas that forbid extra properties.
3. Checks in CI that fail on rule breaks: a writing tool not marked approval_required, a missing description of when to use it, an unlisted or deprecated tool.
4. Tool descriptions from servers are untrusted until reviewed; a public registry listing shows ownership, not safety.
5. A change process: pull request with a named reviewer, versioned rollout, deprecation with dates; agents never edit the registry.

</details>

---

## Evidence to keep

Keep the entries, the generated registry, the permission table, the failing and passing check outputs and the change process. They feed lesson 53.

---
