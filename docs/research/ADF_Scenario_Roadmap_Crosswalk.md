# PrepBench ADF Scenario ↔ Master Roadmap Crosswalk

This crosswalk provides the authoritative, bidirectional mapping between the **18 Azure Data Factory Scenarios** in PrepBench (`backend/app/content/packs/adf/v1.json`) and the **60-topic ADF Master Roadmap** (`docs/research/ADF_Master_Roadmap_Mapped.xlsx`).

Every scenario is architected around a realistic enterprise engineering or delivery dilemma, mapped to primary and secondary roadmap topics, evaluated through four professional lenses (**Product Owner**, **Product Manager**, **Delivery Manager**, **Engineering Manager**), and grounded in official Microsoft Learn documentation.

---

## 1. Scenario Summary Matrix

| # | Scenario ID | Level | Scenario Title | Primary Roadmap Topic | Secondary Topics | Scenario Type | Microsoft Documentation Grounding |
|---|---|---|---|---|---|---|---|
| 1 | `1` | Level 1: Moving data | The missing lots | Topic 32: Watermark-Based Incremental Loading | Topic 33, Topic 26 | Incident / Performance | [Incrementally load data from Azure SQL Database](https://learn.microsoft.com/en-us/azure/data-factory/tutorial-incremental-copy-portal) |
| 2 | `2` | Level 1: Moving data | The first pipeline | Topic 7: Pipeline Parameters, Variables and Expressions | Topic 46, Topic 47 | Architecture / Governance | [Parameters, expressions and functions in ADF](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-expression-language-functions) |
| 3 | `3` | Level 1: Moving data | The server nobody owned | Topic 22: Self-Hosted Integration Runtime (SHIR) | Topic 20, Topic 53 | Performance / Infrastructure | [Create and configure a SHIR](https://learn.microsoft.com/en-us/azure/data-factory/create-self-hosted-integration-runtime); [High availability and scalability of SHIR](https://learn.microsoft.com/en-us/azure/data-factory/create-self-hosted-integration-runtime?tabs=data-factory#high-availability-and-scalability) |
| 4 | `4` | Level 1: Moving data | The hour that never loaded | Topic 17: Tumbling Window Triggers | Topic 16, Topic 18 | Scheduling / Recovery | [Create a tumbling window trigger](https://learn.microsoft.com/en-us/azure/data-factory/how-to-create-tumbling-window-trigger) |
| 5 | `5` | Level 1: Moving data | Green runs that failed | Topic 12: Error Handling and Conditional Routing | Topic 44, Topic 50 | Incident / Governance | [Understanding pipeline failure and error handling in ADF](https://learn.microsoft.com/en-us/azure/data-factory/how-to-handle-activity-failures) |
| 6 | `6` | Level 1: Moving data | The skipped rows nobody read | Topic 27: Fault Tolerance and Binary Copy | Topic 25, Topic 38 | Data Quality / Operations | [Fault tolerance of copy activity in ADF](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-fault-tolerance) |
| 7 | `7` | Level 2: Real-world traps | The rename that re-read everything | Topic 34: CDC Checkpoints and Rename Risk | Topic 33, Topic 35 | Architecture / Data Integrity | [Change data capture in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/concepts-change-data-capture) |
| 8 | `8` | Level 2: Real-world traps | The new column | Topic 37: Schema Drift and Data Flow Design | Topic 36, Topic 39 | Architecture / Schema Evolution | [Schema drift in mapping data flow](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-schema-drift) |
| 9 | `17` | Level 2: Real-world traps | The balances that matched | Topic 38: Reconciliation: Counts, Profiles and Row Fingerprints | Topic 39, Topic 13 | Data Quality / Financial Integrity | [Data validation patterns in ADF](https://learn.microsoft.com/en-us/azure/data-factory/how-to-data-flow-dedupe-nulls); [Assert transformation in mapping data flow](https://learn.microsoft.com/en-us/azure/data-factory/data-flow-assert) |
| 10 | `9` | Level 2: Real-world traps | The audit question | Topic 44: Monitoring, Alerts and Run History | Topic 45, Topic 41 | Compliance / Retention | [Monitor Azure Data Factory with Azure Monitor](https://learn.microsoft.com/en-us/azure/data-factory/monitor-using-azure-monitor) |
| 11 | `10` | Level 2: Real-world traps | The bill that doubled | Topic 52: Cost Modeling, DIU Allocation and Estimation | Topic 53, Topic 20 | Cost / FinOps | [Plan and manage costs for Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/plan-manage-costs); [Data movement pricing examples](https://learn.microsoft.com/en-us/azure/data-factory/pricing-concepts) |
| 12 | `11` | Level 2: Real-world traps | The password in the pipeline | Topic 41: Managed Identity, Key Vault and Authentication | Topic 5, Topic 46 | Security / Secret Management | [Managed identities for Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/data-factory-service-identity); [Store credentials in Azure Key Vault](https://learn.microsoft.com/en-us/azure/data-factory/store-credentials-in-key-vault) |
| 13 | `18` | Level 2: Real-world traps | Card numbers in the error log | Topic 45: Operational Logging and Sensitive Data | Topic 28, Topic 27 | Compliance / PCI-DSS / Security | [Azure Data Factory security considerations](https://learn.microsoft.com/en-us/azure/data-factory/data-factory-security-considerations); [Diagnostic logging](https://learn.microsoft.com/en-us/azure/data-factory/monitor-using-azure-monitor) |
| 14 | `12` | Level 3: Architecture & delivery | The urgent fix | Topic 46: Git Integration and Collaboration | Topic 47, Topic 49 | CI/CD / Release Management | [Continuous integration and delivery in ADF](https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery); [Automated publishing for CI/CD](https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery-improvements) |
| 15 | `13` | Level 3: Architecture & delivery | The 1,000 tables that vanished | Topic 35: Metadata-Driven Pipelines | Topic 13, Topic 11 | Architecture / Scalability | [Metadata-driven copy activity](https://learn.microsoft.com/en-us/azure/data-factory/copy-data-tool-metadata-driven); [Lookup activity limits and return sizes](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-lookup-activity#lookup-activity-properties) |
| 16 | `14` | Level 3: Architecture & delivery | Cutover in three weeks | Topic 58: Enterprise Migration Architecture | Topic 32, Topic 22 | Migration / Program Delivery | [Data migration from on-premises to Azure using ADF](https://learn.microsoft.com/en-us/azure/data-factory/solution-template-migration-overview); [SHIR scale-out guidelines](https://learn.microsoft.com/en-us/azure/data-factory/create-self-hosted-integration-runtime#high-availability-and-scalability) |
| 17 | `15` | Level 3: Architecture & delivery | The count Databricks sent back | Topic 55: Databricks Integration and Lakehouse Orchestration | Topic 15, Topic 54 | Integration / Architecture | [Run a Databricks notebook with the Databricks activity in ADF](https://learn.microsoft.com/en-us/azure/data-factory/transform-data-using-databricks-notebook); [Notebook exit value limitations](https://learn.microsoft.com/en-us/azure/databricks/notebooks/notebook-workflows#exit-a-notebook) |
| 18 | `16` | Level 3: Architecture & delivery | ADF or Fabric? | Topic 2: ADF vs Databricks vs Synapse vs Fabric Data Factory | Topic 57, Topic 4 | Architecture / Strategic Selection | [What is Data Factory in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/data-factory-overview); [Compare Azure Data Factory and Microsoft Fabric Data Factory](https://learn.microsoft.com/en-us/fabric/data-factory/compare-fabric-data-factory-and-azure-data-factory) |

---

## 2. Detailed Scenario Deep Dives & Role Lenses

### Level 1: Moving Data (Scenarios 1 – 6)

#### Scenario 1 (id: `1`) — The missing lots
- **Primary Roadmap Topic:** Topic 32 (Phase 7: Incremental Loading & Metadata)
- **Secondary Topics:** Topic 33 (Change Tracking and CDC), Topic 26 (Copy Activity Performance & Tuning)
- **Pedagogical Objective:** Teach watermark table mechanics, upper-bound timestamp capture before ingestion, timezone consistency, and idempotent re-runs.
- **Key Technical Constraint:** If watermark logic updates the control table using the pipeline start time or current timestamp instead of the actual maximum timestamp read from the source query (`SELECT MAX(LastModified) FROM source WHERE LastModified > @Watermark`), late-arriving records or concurrent source commits become permanently skipped.
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: customer SLA tracking, data completeness verification, and prioritization of critical fact tables over analytical staging tables.
  - **PM:** Users, impact and product measures: stakeholder outage notifications, assessing downstream reporting impact, and tracking user-facing metrics.
  - **DM:** The incident, the process and the plan: running the incident bridge, coordinating mean-time-to-resolution (MTTR), boundary condition testing (`>` vs `>=`), and UTC standardization.
  - **EM:** Engineering practice and the team: implementing atomic watermark update stored procedures, automated reconciliation queries, and idempotent re-run scripts.
- **Evidence Produced:** A watermarking control table schema, boundary condition test script, and idempotent replay runbook.

#### Scenario 2 (id: `2`) — The first pipeline
- **Primary Roadmap Topic:** Topic 7 (Phase 2: Core ADF Construction)
- **Secondary Topics:** Topic 5 (Linked Services), Topic 6 (Datasets)
- **Pedagogical Objective:** Deconstruct a seemingly simple "just copy the claims table" request into the core ADF building blocks (Linked Services, Datasets, Pipelines, Activities, Integration Runtimes, Triggers), manage cross-team dependencies, and establish parameterized reusability.
- **Key Technical Constraint:** In ADF, data movement requires separate abstractions: Linked Services (connection/auth), Datasets (schema/file reference), Pipelines (logical grouping), and Activities (execution step). Treating pipelines as point-to-point hardcoded scripts creates configuration sprawl, while missing network line-of-sight or credentials from upstream teams blocks deployment.
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: breaking down ambiguous ingestion requests into well-defined acceptance criteria, data contracts, and delivery milestones.
  - **PM:** Users, impact and product measures: setting realistic delivery expectations with business stakeholders and communicating dependency lead times.
  - **DM:** The incident, the process and the plan: coordinating cross-team handovers with database administrators, network engineers, and security teams for credentials and firewalls.
  - **EM:** Engineering practice and the team: implementing parameterized linked services and datasets, enforcing standard naming conventions, and establishing code review guidelines.
- **Evidence Produced:** ADF building blocks architecture diagram, reusable linked service template, and cross-team dependency checklist.

#### Scenario 3 (id: `3`) — The server nobody owned
- **Primary Roadmap Topic:** Topic 22 (Phase 4: Integration Runtimes)
- **Secondary Topics:** Topic 20 (Integration Runtime Fundamentals), Topic 53 (Scale and Concurrency Trade-offs)
- **Pedagogical Objective:** Understand Self-Hosted Integration Runtime (SHIR) compute management, on-premises host machine ownership, credential lifecycle, and active-active high availability (HA) clustering.
- **Key Technical Constraint:** An on-premises SHIR hosted on an unowned or unmanaged virtual machine is an enterprise single point of failure when host credentials rotate or machines reboot. Up to 4 physical or virtual nodes can be clustered into a single logical SHIR for active-active high availability and concurrent load distribution, where nodes pull tasks concurrently from the cloud queue.
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: quantifying business risk of unowned infrastructure and establishing operational readiness criteria.
  - **PM:** Users, impact and product measures: communicating downtime impacts to business stakeholders and reporting on IR service level health.
  - **DM:** The incident, the process and the plan: establishing clear infrastructure ownership matrices (RACI), coordinating host OS maintenance windows with IT operations.
  - **EM:** Engineering practice and the team: configuring active-active multi-node SHIR clusters, setting up gateway health alerts in Azure Monitor, and automating gateway key rotations.
- **Evidence Produced:** Active-active SHIR HA architecture, infrastructure RACI matrix, and gateway queue health monitoring alert rules.

#### Scenario 4 (id: `4`) — The hour that never loaded
- **Primary Roadmap Topic:** Topic 17 (Phase 3: Control Flow & Orchestration)
- **Secondary Topics:** Topic 16 (Schedule Triggers), Topic 18 (Storage Event Triggers)
- **Pedagogical Objective:** Master tumbling window triggers vs schedule triggers, window boundaries (`windowStartTime`, `windowEndTime`), dependency chains, and automated backfill mechanics.
- **Key Technical Constraint:** Schedule triggers fire at recurring clock times but do not track historical slices; if a schedule trigger is deactivated for maintenance or deployment, missed hours are never executed. Tumbling window triggers represent contiguous, non-overlapping time windows and automatically detect and backfill missed windows upon reactivation without manual intervention.
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: defining historical data completeness criteria and ensuring business reporting accuracy across maintenance windows.
  - **PM:** Users, impact and product measures: tracking data freshness metrics, providing user notifications for delayed reporting slices during backfill processing.
  - **DM:** The incident, the process and the plan: planning deployment downtime windows, coordinating trigger deactivation and reactivation runbooks.
  - **EM:** Engineering practice and the team: parameterizing pipelines using `@trigger().outputs.windowStartTime` and `@trigger().outputs.windowEndTime`, configuring tumbling window concurrency (`maxConcurrency`), and defining self-dependency wait policies.
- **Evidence Produced:** Tumbling window trigger definition JSON, automated backfill execution pattern, and pipeline time-slice monitoring dashboard.

#### Scenario 5 (id: `5`) — Green runs that failed
- **Primary Roadmap Topic:** Topic 12 (Phase 3: Control Flow & Orchestration)
- **Secondary Topics:** Topic 44 (Monitoring, Alerts and Run History), Topic 50 (Pipeline Recovery and Re-run Patterns)
- **Pedagogical Objective:** Master ADF activity dependency semantics (`Succeeded`, `Failed`, `Skipped`, `Completed`), loop error handling, and silent failure prevention.
- **Key Technical Constraint:** If an activity fails inside an `Until` or `If Condition` activity, or if a downstream activity is connected via `Upon Completion` without an explicit failure check, the parent pipeline run status will be marked **Succeeded** (green) despite data movement failing completely.
- **Role Lens Focus:**
  - **PO:** Aligning pipeline success definitions with data delivery veracity rather than raw execution status.
  - **PM:** Establishing stakeholder notification protocols when silent failure masks missing reporting data.
  - **DM:** Designing explicit downstream status evaluation patterns, error flags, and poison-message routing.
  - **EM:** Implementing the standard ADF fail-fast pattern: terminating failed loops with explicit Fail activities or Web Activity webhook alerts.
- **Evidence Produced:** Dependency tree error-handling blueprint and pipeline failure alerting configuration.

#### Scenario 6 (id: `6`) — The skipped rows nobody read
- **Primary Roadmap Topic:** Topic 27 (Phase 6: Copy Activity in Practice)
- **Secondary Topics:** Topic 25 (Copy Activity Fundamentals), Topic 38 (Reconciliation: Counts, Profiles and Row Fingerprints)
- **Pedagogical Objective:** Understand Copy Activity fault tolerance settings (`EnableSkipIncompatibleRow`), logging configurations, and dead-letter quarantine management.
- **Key Technical Constraint:** Enabling `Skip incompatible rows` without configuring redirected row logging (`redirectIncompatibleRowSettings`) silently discards malformed rows into the void, causing silent data corruption between source and destination.
- **Role Lens Focus:**
  - **PO:** Setting data loss tolerance thresholds and compliance standards for downstream regulatory feeds.
  - **PM:** Establishing daily data triage reviews between source data producers and consumer analytics teams.
  - **DM:** Configuring fault-tolerant Copy activities with dedicated ADLS Gen2 quarantine containers.
  - **EM:** Creating automated daily quarantine alerting and dead-letter ingestion processing pipelines.
- **Evidence Produced:** Copy activity fault tolerance JSON payload, quarantine storage architecture, and reconciliation audit script.

---

### Level 2: Real-World Traps (Scenarios 7 – 13)

#### Scenario 7 (id: `7`) — The rename that re-read everything
- **Primary Roadmap Topic:** Topic 34 (Phase 7: Incremental Loading & Metadata)
- **Secondary Topics:** Topic 33 (Change Tracking and CDC), Topic 35 (Metadata-Driven Pipelines)
- **Pedagogical Objective:** Master native Change Data Capture (CDC) state stores, checkpoint binding, and schema renaming pitfalls.
- **Key Technical Constraint:** In native ADF CDC, if an activity or pipeline is renamed without setting a `Custom Checkpoint Key`, the engine treats the renamed activity as a brand new pipeline instance, discarding checkpoint history and re-reading the entire change log from transaction zero.
- **Role Lens Focus:**
  - **PO:** Enforcing data platform change policies to prevent unexpected source system load spikes and billing surges.
  - **PM:** Establishing schema and activity renaming review checkpoints in Sprint planning.
  - **DM:** Defining state store architecture and audit trail validation for change capture feeds.
  - **EM:** Mandating Custom Checkpoint Keys across all CDC activities and implementing pre-deployment checklist gates.
- **Evidence Produced:** Native CDC checkpoint decoupling specification and safe renaming change management procedure.

#### Scenario 8 (id: `8`) — The new column
- **Primary Roadmap Topic:** Topic 37 (Phase 8: Data Flows & Reconciliation)
- **Secondary Topics:** Topic 36 (Mapping Data Flows), Topic 39 (Assert, Error Rows and Business Rules)
- **Pedagogical Objective:** Implement schema drift handling, dynamic column projection, and Delta Lake schema merging in Mapping Data Flows.
- **Key Technical Constraint:** When upstream databases add new columns, static dataset projections drop the new fields. If schema drift is enabled blindly without Drifted Column Rules or Delta `mergeSchema`, downstream Parquet or SQL sinks may fail due to schema mismatch or write untyped strings.
- **Role Lens Focus:**
  - **PO:** Defining business schema contract policies: differentiating backward-compatible additions from breaking changes.
  - **PM:** Facilitating schema synchronization cadences between upstream ERP/CRM application teams and lakehouse architects.
  - **DM:** Designing Mapping Data Flows with Schema Drift enabled, Drifted Column pattern rules, and Delta Lake sink options.
  - **EM:** Setting up automated contract validation unit tests and CI/CD drift assertion pipelines.
- **Evidence Produced:** Data flow schema drift transformation definition and Delta Lake schema evolution design.

#### Scenario 9 (id: `17`) — The balances that matched
- **Primary Roadmap Topic:** Topic 38 (Phase 8: Data Flows & Reconciliation)
- **Secondary Topics:** Topic 39 (Assert, Error Rows and Business Rules), Topic 13 (Lookup and GetMetadata)
- **Pedagogical Objective:** Design multi-tier data reconciliation beyond simple row counts: validating checksums, column-level aggregations, and cryptographic row fingerprints.
- **Key Technical Constraint:** Row counts can match perfectly (e.g., 10,000 source rows vs 10,000 target rows) while critical numeric fields contain silent truncations, sign reversals, or offsetting corruptions (e.g., +$100,000 balanced by -$100,000 in corrupted records).
- **Role Lens Focus:**
  - **PO:** Upholding SOX and financial audit compliance: mandating value-level reconciliation before release sign-off.
  - **PM:** Scheduling parallel-run reconciliation testing phases and managing audit evidence sign-off gates.
  - **DM:** Designing the three-tier reconciliation framework: 1. Row count, 2. Financial totals/hash sums, 3. Row-level MD5/SHA256 fingerprinting.
  - **EM:** Implementing automated Assert transformations in Mapping Data Flows to quarantine records failing balance checks.
- **Evidence Produced:** Multi-level reconciliation query suite, Assert transformation rules, and financial audit reconciliation log.

#### Scenario 10 (id: `9`) — The audit question
- **Primary Roadmap Topic:** Topic 44 (Phase 9: Security, Governance & Monitoring)
- **Secondary Topics:** Topic 45 (Operational Logging and Sensitive Data), Topic 41 (Managed Identity, Key Vault and Authentication)
- **Pedagogical Objective:** Master native ADF Studio 45-day monitoring retention boundaries, configure Azure Monitor Diagnostic Settings, and build Log Analytics KQL audit queries for long-term regulatory compliance.
- **Key Technical Constraint:** ADF Studio retains pipeline, activity, and trigger run history for exactly 45 days. Regulated enterprises (e.g., SOX, HIPAA, PCI) requiring 6-month to 7-year audit trails will fail compliance examinations unless Diagnostic Settings are configured to route ADF telemetry (`PipelineRuns`, `ActivityRuns`, `TriggerRuns`) to a Log Analytics workspace or Azure Storage archive.
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: translating regulatory audit requirements (SOX/HIPAA) into data platform acceptance criteria and retention policies.
  - **PM:** Users, impact and product measures: managing auditor relationships, presenting compliance evidence, and tracking audit remediation roadmaps.
  - **DM:** The incident, the process and the plan: coordinating cross-team audit evidence gathering across DBA, cloud platform, and compliance teams; establishing operational sign-off gates.
  - **EM:** Engineering practice and the team: configuring Bicep/ARM diagnostic settings to Log Analytics, writing KQL queries for historical execution auditing, and setting up automated retention alerts.
- **Evidence Produced:** Diagnostic settings deployment template, Log Analytics KQL audit query suite, and compliance audit trail runbook.

#### Scenario 11 (id: `10`) — The bill that doubled
- **Primary Roadmap Topic:** Topic 52 (Phase 10: CI/CD, IaC & Reliability)
- **Secondary Topics:** Topic 53 (Scale and Concurrency Trade-offs), Topic 20 (Integration Runtime Fundamentals)
- **Pedagogical Objective:** Master the multi-tier ADF concurrency hierarchy (pipeline concurrency, ForEach batchCount, Copy parallelism / DIUs), prevent endpoint saturation, and execute systematic 5-tier bottleneck analysis.
- **Key Technical Constraint:** As an upper-bound planning model, potential connection pressure scales as `(Active Pipelines) × (ForEach batchCount) × (parallelCopies)` (effective connections may be lower due to dynamic ADF determination). Copy activities enforce a 4 DIU minimum per run with 1-minute billing granularity. Unconstrained loop parallelism and parallel copy streams saturate source connection pools (e.g. the scenario's stated 20-connection pool constraint) and sink storage, causing lock waits, query timeouts, and retry loops that dramatically spike compute costs while degrading throughput.
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: defining concurrency ceilings, connection limits, and verified speedup metrics in ingestion acceptance criteria; balancing throughput SLAs against FinOps budget boundaries.
  - **PM:** Users, impact and product measures: explaining concurrency-induced connection starvation and retry cascades to leadership; establishing FinOps KPI frameworks (Unit Cost per Run / per GB).
  - **DM:** The incident, the process and the plan: governing compute change management gates; requiring architectural review and synthetic load testing for DIU, pipeline concurrency, and loop batchCount changes.
  - **EM:** Engineering practice and the team: formulating multi-tier concurrency budgets (e.g. 2 pipelines × 4 batchCount × 2 parallelCopies = 16 connections max on a 20-connection pool); executing 5-tier bottleneck analysis across queue, loop, compute, network, and endpoint layers.
- **Evidence Produced:** Multi-tier concurrency budget model, 5-tier bottleneck analysis framework, and Azure Cost Management budget alert configuration.

#### Scenario 12 (id: `11`) — The password in the pipeline
- **Primary Roadmap Topic:** Topic 41 (Phase 9: Security, Governance & Monitoring)
- **Secondary Topics:** Topic 5 (Linked Services), Topic 46 (Git Integration and Collaboration)
- **Pedagogical Objective:** Eliminate hardcoded credentials and scattered passwords across pipelines and linked services using System/User-Assigned Managed Identity and Key Vault secret references with Azure RBAC.
- **Key Technical Constraint:** Hardcoding passwords in linked service definitions or passing credentials through pipeline parameters causes credential leakage in Git repositories and ARM templates, and breaks pipelines during password rotations. Modern security posture requires Managed Identities or Key Vault secret references with least-privilege RBAC (`Key Vault Secrets User`).
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: establishing zero-trust credential policies and secretless architecture as non-negotiable acceptance criteria.
  - **PM:** Users, impact and product measures: communicating rotation timelines to downstream service consumers and managing security incident disclosure risks.
  - **DM:** The incident, the process and the plan: coordinating emergency credential rotation incident bridges, defining operational handovers between security operations and data squads.
  - **EM:** Engineering practice and the team: refactoring linked services to use Managed Identity and Key Vault secrets, configuring automated secret rotation with Azure Event Grid, and adding CI/CD secret scanning.
- **Evidence Produced:** Managed Identity linked service Bicep template, Key Vault RBAC configuration runbook, and pre-commit secret detection rule.

#### Scenario 13 (id: `18`) — Card numbers in the error log
- **Primary Roadmap Topic:** Topic 45 (Phase 9: Security, Governance & Monitoring)
- **Secondary Topics:** Topic 28 (Regulated Data and Encryption in Transit), Topic 27 (Fault Tolerance and Binary Copy)
- **Pedagogical Objective:** Understand how operational logging and copy activity fault-tolerance row redirection can inadvertently expose sensitive PII / PCI-DSS data (such as credit card PANs) in cleartext storage accounts.
- **Key Technical Constraint:** Enabling `Secure Input` and `Secure Output` on ADF activities protects runtime telemetry in Azure Monitor and ADF Studio, but Copy activity fault tolerance (`redirectIncompatibleRowSettings`) dumps raw, rejected rows into blob storage in cleartext. Ingestion of card numbers without pre-ingestion masking violates PCI-DSS if stored unencrypted.
- **Role Lens Focus:**
  - **PO:** The backlog and acceptance criteria: collaborating with Data Protection and Legal teams on PCI-DSS / GDPR compliance requirements and customer notification obligations.
  - **PM:** Users, impact and product measures: leading security incident containment communication and managing post-incident compliance audits.
  - **DM:** The incident, the process and the plan: organizing immediate incident containment sprints, coordinating storage access revocation, and establishing cross-team log review processes.
  - **EM:** Engineering practice and the team: isolating fault-tolerant error logs in dedicated storage with Private Endpoints and CMK, implementing pre-ingestion regex masking in Azure Functions / Data Flows, and configuring storage lifecycle auto-purge policies.
- **Evidence Produced:** Secure error logging architecture diagram, pre-ingestion masking transformation script, and storage lifecycle purge policy.

---

### Level 3: Architecture & Delivery (Scenarios 14 – 18)

#### Scenario 14 (id: `12`) — The urgent fix
- **Primary Roadmap Topic:** Topic 46 (Phase 10: CI/CD, IaC & Reliability)
- **Secondary Topics:** Topic 47 (ARM Template Deployment), Topic 49 (Release Gates and Testing Strategies)
- **Pedagogical Objective:** Establish robust Git collaboration, branching models, and hotfix release paths while avoiding "live mode" editing traps.
- **Key Technical Constraint:** Making emergency manual changes directly in ADF "live mode" in production creates configuration drift. The next CI/CD release will overwrite the live change, re-introducing the bug. All changes must originate in Git and deploy via ARM/Bicep pipelines.
- **Role Lens Focus:**
  - **PO:** Guarding production stability by refusing unvalidated live-mode shortcuts.
  - **PM:** Establishing an expedited hotfix workflow with mandatory peer code review and testing criteria.
  - **DM:** Enforcing repository branching architecture: hotfix branch -> PR to collaboration branch -> automated publish to `adf_publish` -> production release.
  - **EM:** Configuring CI/CD automated validation using `@microsoft/azure-data-factory-utilities` npm package and automated smoke test execution.
- **Evidence Produced:** Hotfix Git branching flowchart, CI/CD pipeline definition, and configuration drift prevention checklist.

#### Scenario 15 (id: `13`) — The 1,000 tables that vanished
- **Primary Roadmap Topic:** Topic 35 (Phase 7: Incremental Loading & Metadata)
- **Secondary Topics:** Topic 13 (Lookup and GetMetadata), Topic 11 (ForEach and Iteration Patterns)
- **Pedagogical Objective:** Scale metadata-driven ingestion frameworks to enterprise scale while respecting ADF Lookup activity limits and batch iteration boundaries.
- **Key Technical Constraint:** The ADF Lookup activity has a hard return limit of **5,000 rows** and **4 MB** of JSON payload. Querying a metadata catalog of 1,000+ tables with extensive column definitions causes Lookup to truncate rows or fail with size exceeded errors.
- **Role Lens Focus:**
  - **PO:** Advocating for standardized, scalable metadata ingestion over bespoke point-to-point pipeline development.
  - **PM:** Managing phased migration waves and coordinating metadata onboarding schedules across database teams.
  - **DM:** Designing two-tier metadata architectures: partitioning catalog lookups by domain/schema chunks or paging queries to stay under limits.
  - **EM:** Implementing child worker pipeline execution using parameterized ForEach loops with controlled concurrency (e.g., `batchCount: 20`).
- **Evidence Produced:** Scalable metadata control table schema, two-tier chunking pipeline design, and concurrency limit configuration.

#### Scenario 16 (id: `14`) — Cutover in three weeks
- **Primary Roadmap Topic:** Topic 58 (Phase 11: Enterprise Architecture & Strategy)
- **Secondary Topics:** Topic 32 (Watermark-Based Incremental Loading), Topic 22 (Self-Hosted Integration Runtime)
- **Pedagogical Objective:** Plan and execute enterprise database migration architectures combining initial bulk historical load, continuous delta catch-up, and zero-downtime cutover.
- **Key Technical Constraint:** A cutover window of a few hours cannot copy multi-terabyte databases. The architecture requires pre-seeding historical data, running high-frequency incremental delta syncs, performing dual-write reconciliation, and switching application pointers during the maintenance window.
- **Role Lens Focus:**
  - **PO:** Defining cutover acceptance criteria, business rollback triggers, and customer communication windows.
  - **PM:** Building the hour-by-hour cutover runbook with cross-functional dependencies and go/no-go milestones.
  - **DM:** Designing initial bulk copy vs CDC/watermark catch-up pipelines and dual-read validation frameworks.
  - **EM:** Sizing and load-testing SHIR clusters, verifying ExpressRoute throughput, and automating post-cutover data verification scripts.
- **Evidence Produced:** Cutover hour-by-hour runbook, fallback/rollback criteria, and dual-system reconciliation plan.

#### Scenario 17 (id: `15`) — The count Databricks sent back
- **Primary Roadmap Topic:** Topic 55 (Phase 11: Enterprise Architecture & Strategy)
- **Secondary Topics:** Topic 15 (Web, Function, Script and Stored Procedure Integration), Topic 54 (Architecture Trade-offs)
- **Pedagogical Objective:** Architect enterprise integration between ADF orchestration and Azure Databricks compute, respecting interface boundaries and return payload limits.
- **Key Technical Constraint:** Databricks Notebook activity in ADF captures the exit status via `dbutils.notebook.exit("value")`. This output has a strict **2 MB limit** in ADF activity output (`runOutput`). Returning large JSON datasets or row dumps causes pipeline failure. Large metrics must be written to ADLS/Delta, returning only execution tokens and storage paths to ADF.
- **Role Lens Focus:**
  - **PO:** Delineating architectural responsibilities: ADF conducts the workflow and business SLAs; Databricks executes heavy compute.
  - **PM:** Aligning development standards between data engineering (Databricks) and orchestration (ADF) teams.
  - **DM:** Defining API contracts between ADF and Databricks: returning metadata pointers, status codes, and summary KPIs.
  - **EM:** Implementing Key Vault linked services, cluster reuse policies (job clusters vs all-purpose pools), and error handling on notebook exit.
- **Evidence Produced:** ADF-Databricks interface architecture specification, notebook exit wrapper script, and monitoring dashboard.

#### Scenario 18 (id: `16`) — ADF or Fabric?
- **Primary Roadmap Topic:** Topic 2 (Phase 1: ADF Foundations)
- **Secondary Topics:** Topic 57 (Modernizing ADF to Fabric Data Factory), Topic 4 (ADF Mental Model for Managers)
- **Pedagogical Objective:** Formulate a rigorous architectural decision model evaluating Azure Data Factory vs Microsoft Fabric Data Factory based on enterprise constraints.
- **Key Technical Constraint:** Fabric Data Factory provides SaaS-first simplicity and tight OneLake integration, but lacks certain mature PaaS enterprise features (such as granular Azure VNet private endpoints for on-premises hybrid routing, mature Git branch-per-developer tooling in some regions, and custom IR topologies).
- **Role Lens Focus:**
  - **PO:** Aligning platform choices with organizational skills, existing Azure investments, and cloud modernisation roadmaps.
  - **PM:** Building multi-year TCO financial models comparing ADF consumption pricing against Fabric F-SKU capacity reservations.
  - **DM:** Establishing architectural selection guardrails: ADF for hybrid PaaS multi-cloud integration; Fabric for centralized OneLake lakehouse architectures.
  - **EM:** Evaluating operational readiness, CI/CD maturity, networking isolation, and monitoring capabilities in Fabric vs ADF.
- **Evidence Produced:** 4-service architectural decision matrix, migration readiness assessment checklist, and executive presentation deck.

---

## 3. Pedagogical Role Lens Matrix Across All 18 Scenarios

Every scenario delivers specific, actionable prompts and tasks for the four PrepBench leadership roles:

| Role | Core Pedagogical Focus | Key Deliverable in Each Scenario | Typical Interview Question Prepared |
|---|---|---|---|
| **Product Owner (PO)** | The backlog and acceptance criteria: business value, SLA contracts, customer data impact, compliance sign-offs, data product integrity | Business Impact Assessment & Prioritization Plan | "How do you prioritize pipeline remediation when an SLA breach threatens customer-facing analytics?" |
| **Product Manager (PM)** | Users, impact and product measures: user communication, product health KPIs, executive roadmaps, stakeholder trust | Stakeholder Communication Plan & Impact Assessment | "How do you communicate data outage risks and delivery delays to executive stakeholders?" |
| **Delivery Manager (DM)** | The incident, the process and the plan: incident bridges, cross-team handovers, dependency management, runbooks, cutover execution | Incident Response Plan & Cutover Runbook | "How do you coordinate a zero-downtime cutover between database teams, infrastructure, and business users?" |
| **Engineering Manager (EM)** | Engineering practice and the team: implementation details, CI/CD automation, cluster scaling, monitoring, code review standards | Technical Runbook, Infrastructure Template & Test Suite | "How do you prevent configuration drift and manage emergency hotfixes in an automated ADF deployment pipeline?" |

---

## 4. Microsoft Documentation Reference Index

1. **ADF Core & Architecture:**
   - [Azure Data Factory documentation](https://learn.microsoft.com/en-us/azure/data-factory/)
   - [Pipelines and activities in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities)
   - [Integration runtime in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime)
   - [High availability and scalability of SHIR](https://learn.microsoft.com/en-us/azure/data-factory/create-self-hosted-integration-runtime#high-availability-and-scalability)

2. **Data Movement & Copy Activity:**
   - [Copy activity in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-overview)
   - [Copy activity performance and scalability guide](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance)
   - [Fault tolerance of copy activity](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-fault-tolerance)
   - [Binary format copy in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/format-binary)

3. **Incremental Loading & CDC:**
   - [Incrementally load data from Azure SQL Database](https://learn.microsoft.com/en-us/azure/data-factory/tutorial-incremental-copy-portal)
   - [Change data capture in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/concepts-change-data-capture)
   - [Metadata-driven copy activity](https://learn.microsoft.com/en-us/azure/data-factory/copy-data-tool-metadata-driven)

4. **Security, Networking & Governance:**
   - [Azure Data Factory security considerations](https://learn.microsoft.com/en-us/azure/data-factory/data-factory-security-considerations)
   - [Encrypt Data Factory with customer-managed keys](https://learn.microsoft.com/en-us/azure/data-factory/enable-customer-managed-key)
   - [Store credentials in Azure Key Vault](https://learn.microsoft.com/en-us/azure/data-factory/store-credentials-in-key-vault)
   - [Managed virtual network and private endpoints](https://learn.microsoft.com/en-us/azure/data-factory/managed-virtual-network-private-endpoint)

5. **CI/CD, Monitoring & FinOps:**
   - [Continuous integration and delivery in ADF](https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery)
   - [Automated publishing for CI/CD](https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery-improvements)
   - [Monitor Azure Data Factory with Azure Monitor](https://learn.microsoft.com/en-us/azure/data-factory/monitor-using-azure-monitor)
   - [Plan and manage costs for Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/plan-manage-costs)

6. **External Integrations & Fabric:**
   - [Transform data using Databricks notebook](https://learn.microsoft.com/en-us/azure/data-factory/transform-data-using-databricks-notebook)
   - [What is Data Factory in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/data-factory-overview)
   - [Compare ADF and Microsoft Fabric Data Factory](https://learn.microsoft.com/en-us/fabric/data-factory/compare-fabric-data-factory-and-azure-data-factory)
