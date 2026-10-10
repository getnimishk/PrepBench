# Learning Lab

The Learning Lab teaches by doing rather than by reading. Every sandbox follows the same loop:

1. **Predict:** you commit to an answer first.
2. **Manipulate:** you change a lever.
3. **Observe:** a model shows what actually happens.
4. **Explain:** you put it in your own words.

The prediction is write-once, so you cannot change it after seeing the result. Explanations are yours and are never scored. The hub is at **`/lab`**.

There are three sandboxes.

| Sandbox | Route | Who it is for |
|---|---|---|
| **Agile Metrics** | `/chart-sandbox` | Everyone. No preparation is needed |
| **ADF Behaviour Lab** | `/lab/adf` | A preparation with the `adf` content pack attached |
| **Lakehouse Lab** | `/databricks-sandbox` | The preparation whose slug is `databricks` |

## The rules every sandbox holds to

- **A simulation says it is one.** Every result is labelled as a simulation over a fictional scenario. None of them calls Azure, Databricks, Entra ID or any real system. Every constant chosen to make an effect visible is labelled a *teaching constant*, not a measurement.
- **Every relationship has a declared kind.** Couplings between models are typed:
  - **arithmetic:** follows from definitions;
  - **assumption:** a claim the sandbox makes so the lesson lands;
  - **convention:** a counting choice.
  - **fact** (ADF only): stated by the ADF study guide.

  Each one is shown to the learner with its kind, so a modelling choice is never presented as a law.
- **The model grades, never AI.** A prediction is checked against the model's own outcome, and only that sets `correct`. The [AI feedback](AI-Providers) on acceptance criteria is advice only. It never sets `correct` and never raises an evidence level.
- **Work belongs to a preparation.** Attempts are `learning_attempts` rows scoped to the preparation that made them (see [Architecture](Architecture#preparation-scope)). They appear in **Workspace** and **Evidence**, and they never count towards exam readiness.

## Agile Metrics

The delivery simulator, with 27 views over one executable model. See [Chart Sandbox](Chart-Sandbox).

## ADF Behaviour Lab

Five experiments on how Azure Data Factory pipelines behave, at `/lab/adf/:slug`:
- **Watermark & Transient Failure** (`watermark`)
- **Trigger Behaviour** (`triggers`)
- **Concurrency Budget** (`concurrency`)
- **Copy Performance** (`copy-perf`)
- **Fault Tolerance** (`fault-tolerance`). It has two modes: `?mode=dependency` and `?mode=bad-rows`.

Each experiment runs eight stages: *Understand → Predict → Manipulate → Observe → Reason → Apply → Explain → Retrieve*.

The lab is open to any preparation with the `adf` content pack attached, not only a preparation called ADF. A run is stored as four learning attempts: predict, reason, apply and retrieve. A finished run is never edited; starting again begins run *n + 1*. The facts the models rest on come from the ADF study guide. Every screen says it is a teaching simulation, never Azure running.

## Lakehouse Lab

A fictional migration from an on-premises Hadoop platform to a Databricks lakehouse, seen at two levels.

| Station | Level | Runs on | What you do |
|---|---|---|---|
| **F · Migration Factory** | Programme | Simulation | Plan migration waves; see effort, tiers and lateness move |
| **I · Identity and governance** | Programme | Simulation | Find the workload whose cutover plan cannot authenticate; pick the Unity Catalog redesign that keeps a Ranger policy's purpose |
| **A · ADF + Lakeflow** | Pipeline | Simulation | Watermarks, incremental loads, the batch manifest |
| **B · ADLS** | Pipeline | Simulation | Landing layout, ACLs versus RBAC, storage tiers |
| **C · Delta Lake** | Pipeline | **Real Delta engine** | A batch with a new column, a batch delivered twice, vacuum with no retention, comparing the migrated table with the legacy one, and loading Station A's batch |
| **D · Reconciliation Detective** | Pipeline | **Real Delta engine** | Find the defects planted in the migrated data; your score is found out of planted |

### The two scenario packs

Packs live in `backend/app/data/lab_packs/`. The page offers only the stations a pack's manifest lists.

| Pack | Stations |
|---|---|
| `semiconductor-v1` | All six |
| `jd-po-005-v1` | C only. It is a data-only pack, so it runs without any new code |

### The real engine is optional

Stations C and D run real operations on Delta tables, through the `deltalake` package from `backend/requirements-lab.txt`. Install it as described in the [Development Guide](Development-Guide).

Without the engine those stations say so, and show no result of any kind: no number, no rows, nothing marked "expected". The other stations are simulations and always work.

### What the lab keeps

- **The journal:** a timeline of every operation and prediction.
- **A notebook export:** marked *Unverified* until someone has run it on Databricks Free Edition.
- **Interview questions from your own results:** on a finished attempt you can save an interview question. Its talking points come only from values your attempt recorded, never from anything invented. Saved questions go to the Databricks preparation. Once it owns at least one, that preparation gains interview rounds; the capability is never a hand-set flag.

### Station I and its sources

Station I covers identity at cutover and Unity Catalog governance. Every technical statement on screen is a claim from an approved register, `docs/research/lakehouse-p1-5-identity-governance-research.md`. That register holds 24 facts, each checked against an official Microsoft Learn or Apache Ranger page on 10 October 2026, plus 6 labelled simulation assumptions.

The station lists every fact it uses, with a link to its source. Tests hold the code's register to the research file and to official hosts.

A new fact goes into the research file first, never straight into the code. Feature statuses, such as which ABAC parts are Beta, carry the date they were checked.
