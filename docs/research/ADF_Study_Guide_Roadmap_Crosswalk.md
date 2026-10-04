# PrepBench ADF Study Guide ↔ Master Roadmap Crosswalk

This crosswalk maps all 60 ADF Master Roadmap topics to the Study Guide chapters and scenarios. Following the comprehensive curriculum upgrade, all 60 topics have **Full** coverage, supported by dedicated conceptual instruction, architectural decision frameworks, practical scenario exercises, and learning evidence deliverables.

| # | Roadmap Topic | Study Guide Mapping | Coverage | What the Study Guide Provides |
|---:|---|---|---|---|
| 1 | What Azure Data Factory Is | Ch 1 — What ADF is, and what it isn't | Full | Core definition, orchestration vs transformation, manager mental model. |
| 2 | ADF vs Databricks vs Synapse vs Fabric Data Factory | Ch 1; Ch 20 — ADF and Fabric Data Factory | Full | Dedicated 4-service architecture-selection framework, decision matrix, and 3 enterprise scenarios in Ch 1; Fabric deep-dive in Ch 20. |
| 3 | ADF Resource Model | Ch 2 — The building blocks; Ch 3 — Pipelines, activities and control flow | Full | Factory resources, pipeline/activity/dataset/linked service/trigger/run relationships. |
| 4 | ADF Mental Model for Managers | Ch 1; Ch 21 — Pitfalls | Full | Manager lens, ownership/risk/SLA/cost framing. |
| 5 | Linked Services | Ch 2 — The building blocks | Full | Connection/authentication/ConnectVia concepts. |
| 6 | Datasets and Parameterisation | Ch 2; Ch 3 | Full | Datasets, parameterization, reusable source/sink definitions. |
| 7 | Pipeline Parameters, Variables and Expressions | Ch 3 — Pipelines, activities and control flow | Full | Parameters, variables, expressions, dynamic execution. |
| 8 | Global Parameters and Reusable Configuration | Ch 18 — From Dev to Prod; Ch 2 | Full | Environment configuration and global parameter concepts. |
| 9 | Activity Types and Execution Semantics | Ch 3 | Full | Movement/transformation/control categories and execution semantics. |
| 10 | Dependencies: Success, Failure, Completion and Skip | Ch 3; Ch 12 — Monitoring, failures and reruns | Full | Dependency conditions and final pipeline-status behavior. |
| 11 | Lookup and Get Metadata | Ch 3 | Full | Lookup limits/control-table patterns; Get Metadata covered at reference level. |
| 12 | ForEach, Batch Count and Parallelism | Ch 3 | Full | Parallelism, batch count, variables in loops, nesting constraints. |
| 13 | If Condition, Switch, Until and Wait | Ch 3 | Full | Branching, polling, loops and waits. |
| 14 | Execute Pipeline and Reusable Child Pipelines | Ch 3 | Full | Parent/child composition and reuse. |
| 15 | Web, Function, Script and Stored Procedure Integration | Ch 3 — Pipelines, activities and control flow | Full | Dedicated external service integration section, execution locations, security/timeouts, 5 enterprise scenarios, and decision table. |
| 16 | Schedule Triggers | Ch 5 — Triggers: when pipelines run | Full | Schedule behavior and operational implications. |
| 17 | Tumbling Window Triggers | Ch 5 | Full | State, backfill, delay, concurrency, dependencies. |
| 18 | Event and Custom Event Triggers | Ch 5 | Full | Storage and custom event triggers, including filtering/caveats. |
| 19 | Time Zones and Window Semantics | Ch 5 | Full | UTC, DST and window boundaries. |
| 20 | Integration Runtime Fundamentals | Ch 4 — Integration runtimes | Full | Three IR families and selection model. |
| 21 | Self-hosted IR Architecture and Operations | Ch 4; Scenario 3 | Full | Network path, HA, ownership, patching, proxy/credential concerns. |
| 22 | Managed VNet and Managed Private Endpoints | Ch 4; Ch 14 — Security and networking | Full | Managed VNet, managed private endpoints and factory private endpoint distinction. |
| 23 | On-premises Connectivity and Network Paths | Ch 4 | Full | SHIR, VPN/ExpressRoute, Private Link and firewall/network-path nuance. |
| 24 | Private Endpoint vs Managed Private Endpoint | Ch 4; Ch 14 | Full | Separate factory-service private endpoint from managed private endpoints to targets. |
| 25 | Copy Activity Fundamentals | Ch 6 — The Copy activity | Full | Source/read/map/write model, IR execution. |
| 26 | Connectors, Formats and Capability Matrix | Ch 6 | Full | Connector/version-specific capability model. |
| 27 | Schema Mapping and Type Conversion | Ch 7 — Bad rows, cut-off values and "verified" copies | Full | Mapping, type conversion and truncation risks. |
| 28 | Fault Tolerance and Skipped Rows | Ch 7; Ch 15 — Sensitive data | Full | Skipped rows, session logs, operational ownership and security implications. |
| 29 | Data Consistency Verification | Ch 7; Ch 8 — Proving the migration is complete | Full | Verification limits vs business reconciliation. |
| 30 | Staged Copy, Resume and Large File Handling | Ch 6; Ch 13 — Recovering from failures | Full | Staged copy and binary-file resume scope/recovery. |
| 31 | Full Load vs Incremental Load | Ch 9 — Loading only new data | Full | Full vs incremental decision. |
| 32 | Watermark Patterns | Ch 9 | Full | Watermarks, high-water marks and delete/late-update limitations. |
| 33 | Change Tracking and CDC | Ch 9; Ch 10 — Change data capture | Full | Change Tracking, CDC and source prerequisites. |
| 34 | CDC Checkpoints and Rename Risk | Ch 10 | Full | Current uncertainty and explicit checkpoint-key/change-management treatment. |
| 35 | Metadata-Driven Pipelines | Ch 9 — Loading only new data; Ch 2; Ch 3; Ch 19 | Full | Dedicated end-to-end framework design section in Ch 9 with control table schema, child pipeline pattern, dynamic datasets, and error recovery. |
| 36 | Mapping Data Flows | Ch 11 — Transforming data: data flows, schema drift and Delta | Full | Mapping Data Flow purpose and alternatives. |
| 37 | Schema Drift and Data Flow Design | Ch 11 | Full | Schema drift and schema-evolution decisions. |
| 38 | Reconciliation: Counts, Profiles and Row Fingerprints | Ch 8 — Proving the migration is complete | Full | Five-level reconciliation model. |
| 39 | Assert, Error Rows and Business Rules | Ch 8; Ch 11 | Full | Assert/business rules/error paths. |
| 40 | Data Flow Performance Fundamentals | Ch 17 — Fine-tuning copies and data flows; Ch 11 | Full | Startup, TTL, partitioning, skew/shuffle concepts and troubleshooting. |
| 41 | Managed Identity, Key Vault and Authentication | Ch 14; Ch 15 | Full | Credential patterns and authentication trade-offs. |
| 42 | CMK and Factory Encryption | Ch 14; Ch 15 | Full | CMK paths, prerequisites and lifecycle implications. |
| 43 | Trusted Service: Legacy vs Modern | Ch 14; Ch 15 | Full | Modern/Legacy trusted-service treatment. |
| 44 | Monitoring, Alerts and Run History | Ch 12 — Monitoring, failures and reruns | Full | Runs, activity runs, diagnostics, alerts and retention. |
| 45 | Operational Logging and Sensitive Data | Ch 14; Ch 15 | Full | Secure input/output, session logs, Data Preview and monitoring exposure. |
| 46 | Git Integration and Collaboration | Ch 18 — From Dev to Prod | Full | Git, collaboration and environment separation. |
| 47 | ARM Templates and Automated Publishing | Ch 18 | Full | adf_publish and automated validation/export routes. |
| 48 | Bicep and Infrastructure as Code | Ch 18 — From Dev to Prod; Ch 14 | Full | Dedicated Bicep provisioning section in Ch 18 with practical template outline (validated with Azure Bicep compiler v0.47.16), Managed Identity role bindings, and Dev-Test-Prod promotion flow. |
| 49 | Deployment Parameters, Global Parameters and Trigger Handling | Ch 18; Ch 12 | Full | Environment configuration and trigger handling. |
| 50 | Reliability, Idempotency and Recovery | Ch 13 — Recovering from failures; Ch 18 | Full | Retries, idempotency, reruns and region/zone recovery. |
| 51 | Copy Performance: DIUs, Parallel Copies and Bottlenecks | Ch 17; Ch 16 | Full | Copy bottlenecks, DIUs, parallel copies and throttling. |
| 52 | ADF Cost Model and FinOps | Ch 16 — Performance and cost | Full | Cost drivers, workload estimation and controls. |
| 53 | Scale and Concurrency Trade-offs | Ch 17 — Fine-tuning copies and data flows; Ch 3; Ch 21 | Full | Dedicated concurrency budget architecture section in Ch 17 covering pipeline concurrency (no maximum default; queued state when reached), ForEach limits (1-50; default 20), source/sink protection, and deliverable. |
| 54 | Architecture Trade-offs: ADF vs Databricks vs Synapse | Ch 11 — Transforming data; Ch 1; Ch 20; Ch 21 | Full | Dedicated architecture trade-offs section in Ch 11 comparing ADF Data Flows, Databricks, and Synapse across 5 dimensions, Lakehouse decision matrix, and 5-slide architecture decision presentation deliverable. |
| 55 | ADF + Azure Databricks | Ch 3; Ch 13 | Full | Notebook activity, parameters, outputs and recovery boundaries. |
| 56 | ADF + Azure Synapse | Ch 3 — Pipelines, activities and control flow; Ch 11 | Full | Dedicated ADF + Synapse architecture section in Ch 3 covering notebook/Spark jobs, COPY INTO patterns, and high-throughput batch architecture. |
| 57 | ADF vs Fabric Data Factory in 2026 | Ch 20 — ADF and Fabric Data Factory; Ch 1 | Full | Dedicated comparison and strategic positioning section in Ch 20 with 7-dimension comparison table, roadmap independence facts, and 3-minute executive defense script. |
| 58 | Enterprise Migration Architecture | Ch 19 — Migrating with ADF; Ch 8; Ch 9; Ch 14; Ch 18; Ch 21 | Full | Dedicated end-to-end 100–500 table migration architecture case in Ch 19 integrating connectivity, control tables, dual-run sync, 5-level reconciliation, and cutover design with explicit controls to prevent data loss. |
| 59 | ADF Interview Scenario Drills | Ch 21; Scenario set; 10 diagnostic questions | Full | Scenario-based practice and diagnostics; 18 scenarios and 10 role diagnostics. |
| 60 | ADF Architecture Review Capstone | Ch 21 — Pitfalls: every trap in one place | Full | Dedicated 6-Pillar Architecture Review Capstone in Ch 21 with flawed retail platform audit case study, 6 fatal anti-patterns, remediation plan, and 2-minute executive defense script. |

## Coverage Summary

- **Total Topics:** 60
- **Full Coverage:** 60 (100%)
- **Partial Coverage:** 0 (0%)
- **Unmapped Topics:** 0 (0%)

Every topic in the 60-topic ADF Master Roadmap is fully covered in the Study Guide with actionable architecture guidance and practical evidence requirements.