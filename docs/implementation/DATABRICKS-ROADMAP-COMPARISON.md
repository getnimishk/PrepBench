# Databricks roadmaps compared, line by line

**Date:** 2026-10-29. **Compared:** the new draft `docs/research/Databricks_Data_Engineering_Mastery_Roadmap.xlsx` (79
topics, "new #" below) against your two earlier roadmaps:

- **A.** `Databricks_Data_Platform_Master_Roadmap.xlsx` (60 topics, 7 October)
- **B.** `Azure_Databricks_Solutions_Architect_Roadmap.xlsx` (141 topics, 2 September)

Each earlier topic gets one verdict:

| Mark | Meaning |
|---|---|
| **Covered** | The new roadmap has it (new topic numbers given). |
| **Partly** | The new roadmap has part of it; the missing part is named. |
| **Can add** | Missing from the new roadmap, but the research notes already hold official facts for it (section given). |
| **Needs research** | In scope for Databricks, but not researched yet; adding it means reading the official pages first. |
| **Out of scope** | Not Databricks itself (general Azure, operating systems, hardware, Fabric, general architecture practice), or covered by another PrepBench track. |
| **Wrong or renamed** | The earlier topic names something that doesn't exist or has a newer name. |

## Summary

| | A (60) | B (141) |
|---|---|---|
| Covered | 43 | 28 |
| Partly | 11 | 19 |
| Can add | 3 | 9 |
| Needs research | 3 | 16 |
| Out of scope | 0 | 64 |
| Wrong or renamed | 0 | 5 |

- **Roadmap A is almost fully inside the new one** (54 of 60 covered or partly, 3 more addable from facts already researched). The new roadmap goes much deeper on
  Parquet and Delta internals (A's single "Delta Transaction Log and ACID" topic is nine topics now) and on governance.
- **Roadmap B is mostly outside a Databricks track**: 64 topics are general Azure, operating-system filesystems, storage
  hardware, HDFS, Fabric/OneLake, or architecture practice. Your "Storage FileSystems to Cloud Mastery" roadmap (roadmap
  3) and the ADLS study guide already cover much of the storage part.
- **Five things in B are wrong or renamed** (details in table B): there is **no "Databricks Solutions Architect
  Certification"**; **disk cache and Delta cache are the same feature** (renamed); Repos are now **Git folders**;
  Databricks Asset Bundles are now **Declarative Automation Bundles**; Delta Sharing is now **OpenSharing**.

## What I'd change in the new roadmap

**Done (2026-10-29, at your request):** all seven additions below are now in the roadmap, which has **91 topics in 12
phases** (new topics 4 Workspace Objects, 51 Photon and Runtime Selection, 68 Recovery, Replay and Backfill, 75 Job
Concurrency and Limits, and phase 11, topics 78-85, Azure networking; topic 52 now includes autoscaling and topic 69 covers
pipeline views and flows). Topic numbers in the tables below refer to the 79-topic draft the comparison was made
against.

**Add from facts already researched (no new reading needed):**

1. **Workspace objects and permissions** (notebooks, folders, jobs, dashboards governed by workspace ACLs, not Unity
   Catalog): notes §6.1. *(A 8)*
2. **Photon and Databricks Runtime selection** (LTS versions, what Photon is): notes §12. *(A 15, B 88, B 90)*
3. **Job concurrency and limits** (one run at a time by default, maximum concurrent runs with runs beyond it skipped,
   the 2,000 concurrent task runs limit; the notes say nothing about queueing): notes §11. *(A 48)*
4. **Recovery, replay and backfill** (new checkpoint means start fresh, full refresh, RESTORE seen downstream, Auto
   Loader backfill): notes §8, §10, §2.2, §21.2. *(A 56)*
5. **Autoscaling** folded into topic 50 (pools and policies): notes §12. *(A 14, B 85)*
6. **Pipeline datasets and flows** widened in topic 66 (views and flows, not only streaming tables and materialized
   views): notes §10. *(A 34)*
7. **An optional Azure networking phase** (VNet injection, subnets and NSGs, secure cluster connectivity and NAT
   egress, Private Link kinds, serverless connectivity and storage firewalls): notes §20. *(B 14-18, 20, 81, 118)*. Not
   in the Associate exam, but it is what you'd face running Databricks on Azure.

**Later (2026-10-29):** the production and troubleshooting research (notes §23-§24) has since covered several "needs research" rows below: alerts (A 52, partly), testing (A 58), environment and catalog isolation (A 10, B 91, B 93), disaster recovery (B 74-77, 125-127, in outline), encryption and customer-managed keys (B 79-80), init scripts (B 89) and query profiling (A 50, B 67, partly). They are in roadmap phase 13. The tables keep their original verdicts.

**Add only after researching official pages first:** repartition/coalesce and Spark caching (A 19, 20); ingestion
metadata and quarantine tables (A 32); environment and catalog isolation strategy (A 10, B 91, B 93); SQL analytics,
AI/BI dashboards and alerts (A 50-52); OpenSharing (B 96); Kafka and Event Hubs ingestion (B 102); testing Databricks
code (A 58); disaster recovery, encryption and customer-managed keys (B 74-77, 79-80, 125-127); init scripts (B 89).

**Leave out:** the general Azure, filesystem, hardware, HDFS, Fabric and architecture-practice topics (table B).
They belong to other tracks (roadmap 3, the ADLS guide, System Design), not to a Databricks study guide.

## Table A: Databricks Data Platform Master Roadmap (60 topics)

| A # | Topic | Verdict | New # / note |
|---|---|---|---|
| 1 | What Databricks Is | Covered | 1, 2, 3 |
| 2 | Lakehouse Architecture | Covered | 1 |
| 3 | Databricks vs ADF / Fabric / Synapse | Partly | 73 covers ADF; Fabric and Synapse need research |
| 4 | Medallion Architecture | Covered | 55 |
| 5 | Open Formats and Table Abstraction | Covered | 6-12 |
| 6 | Account vs Workspace Model | Covered | 3 |
| 7 | Control Plane vs Compute Plane | Covered | 2 |
| 8 | Workspace Objects and Folder Model | Can add | notes §6.1 |
| 9 | Identity, Groups and Service Principals | Covered | 76 |
| 10 | Environment Strategy: Dev / Test / Prod | Partly | 78 (bundle targets); workspace and catalog isolation needs research |
| 11 | Compute Types and Selection | Covered | 46, 47, 48 |
| 12 | Serverless Compute | Covered | 46 |
| 13 | Cluster Policies and Governance | Covered | 50 |
| 14 | Autoscaling, Pools and Startup Strategy | Partly | 50 (pools); autoscaling can be added from notes §12 |
| 15 | Photon and Runtime Selection | Can add | notes §12 |
| 16 | Spark Execution Mental Model | Covered | 52 |
| 17 | DataFrames, SQL and PySpark | Covered | 53 |
| 18 | Joins, Broadcasts and Skew | Covered | 54, 56, 57 |
| 19 | Partitioning and Shuffle Control | Partly | 56 (shuffle partitions); repartition/coalesce needs research |
| 20 | Caching and Materialization | Partly | 58 (disk cache); Spark cache/persist needs research |
| 21 | Spark UI and Query Diagnosis | Covered | 57, 58 |
| 22 | Delta Transaction Log and ACID | Covered | 12-20 (nine topics) |
| 23 | Create, Read, Update and Delete | Partly | 26, 28, 34 touch it; no topic on plain INSERT/UPDATE/DELETE/overwrite |
| 24 | MERGE and Upsert Design | Covered | 28 |
| 25 | Schema Enforcement and Evolution | Covered | 26, 27 |
| 26 | Time Travel, History and Restore | Covered | 21-25 |
| 27 | Table Layout: Partitioning, Liquid Clustering, ZORDER | Covered | 30-36 |
| 28 | Batch Ingestion Patterns | Covered | 59, 60 |
| 29 | Auto Loader Fundamentals | Covered | 61 |
| 30 | Auto Loader Schema Inference and Evolution | Covered | 62 |
| 31 | Checkpointing and Exactly-Once Mental Model | Covered | 20, 63, 65 |
| 32 | Ingestion Metadata and Quarantine Patterns | Partly | 62 (rescued data), 67 (expectations); source-file metadata and quarantine tables need research |
| 33 | Lakeflow Declarative Pipelines Mental Model | Covered | 66, 4 (the rename) |
| 34 | Pipeline Tables, Views and Flows | Partly | 66; widen it to views and flows (notes §10) |
| 35 | Expectations and Data Quality | Covered | 67 |
| 36 | Incremental Processing and Event-Driven Pipelines | Covered | 69 |
| 37 | Pipeline Observability and Failure Recovery | Covered | 75 |
| 38 | Unity Catalog Object Model | Covered | 37 |
| 39 | Managed vs External Tables and Volumes | Covered | 38, 39 |
| 40 | External Locations and Storage Credentials | Covered | 40 |
| 41 | Privileges, Groups and Least Privilege | Covered | 41, 42 |
| 42 | Row Filters, Column Masks and Fine-Grained Controls | Covered | 43, 44 |
| 43 | Lineage, Audit and Governance Operations | Covered | 45 |
| 44 | Lakeflow Jobs Fundamentals | Covered | 70 |
| 45 | Task Types and Dependencies | Covered | 70 |
| 46 | Retries, Repair Runs, Timeouts and Alerts | Covered | 71, 72 (notifications in 75) |
| 47 | Parameters, Dynamic Values and Reusable Jobs | Covered | 70 |
| 48 | Concurrency, Queueing and SLA Design | Can add | notes §11 |
| 49 | SQL Warehouses and Workload Selection | Covered | 48 |
| 50 | SQL Analytics Patterns | Needs research | query history and profiles only touched in notes |
| 51 | AI/BI Dashboards and Semantic Consumption | Needs research | not read |
| 52 | Alerts, Serving and External BI | Needs research | not read (a SQL alert task is in notes §11) |
| 53 | Structured Streaming Fundamentals | Covered | 63, 64 |
| 54 | State, Watermarks and Late Data | Covered | 64 |
| 55 | CDC Patterns and Change Application | Covered | 28, 29, 68 |
| 56 | Recovery, Replay and Backfill Strategy | Partly | 25, 63, 69 touch it; a dedicated topic can be added from notes |
| 57 | Declarative Automation Bundles | Covered | 78 |
| 58 | Git Integration, Testing and Promotion | Partly | 77, 78; testing needs research |
| 59 | System Tables, Monitoring and Usage Observability | Covered | 74 |
| 60 | End-to-End Data Platform Architecture Review | Partly | 79 is a build capstone, not an architecture review |

## Table B: Azure Databricks Solutions Architect Roadmap (141 topics)

| B # | Topic | Verdict | New # / note |
|---|---|---|---|
| 1 | Azure Resource Hierarchy | Out of scope | general Azure |
| 2 | IaC: ARM vs Bicep vs Terraform | Partly | notes §20.2 lists the deployment methods; comparing them is general Azure |
| 3 | Azure Policy & Governance Guardrails | Out of scope | general Azure |
| 4 | Cost Management & Budgets Fundamentals | Out of scope | general Azure (Databricks cost is 51, 74) |
| 5 | Azure Well-Architected Framework | Out of scope | general Azure |
| 6 | Service Selection Framework | Out of scope | general architecture |
| 7 | Landing Zone Design Patterns | Out of scope | general Azure |
| 8 | Entra ID (Azure AD) Fundamentals | Out of scope | general Azure (Lakehouse Lab Station I covers Entra trust paths) |
| 9 | RBAC vs ABAC vs PIM | Partly | 44 (Unity Catalog ABAC); Azure RBAC and PIM are general Azure |
| 10 | Service Principals & Managed Identities | Covered | 40, 76 |
| 11 | Azure Policy for Data Platforms | Out of scope | general Azure |
| 12 | Management Group Hierarchy for Multi-Team Orgs | Out of scope | general Azure |
| 13 | Landing Zone for a Databricks + Fabric Platform | Out of scope | general Azure and Fabric |
| 14 | VNet & Subnetting Fundamentals | Can add | notes §20.3 (Databricks subnet rules) |
| 15 | VNet Injection for Databricks | Can add | notes §20.3 |
| 16 | Private Link & Private Endpoints | Can add | notes §20.5 |
| 17 | Hub-Spoke Network Topology | Partly | notes §20.5 (transit and workspace VNets); hub-spoke itself is general Azure |
| 18 | NSGs, UDRs & Firewalls | Can add | notes §20.1, §20.3, §20.5 |
| 19 | DNS Resolution in Private Networks | Needs research | not read |
| 20 | Secure Cluster Connectivity (No Public IP) | Can add | notes §20.4 |
| 21 | VFS & Filesystem Abstraction Layer | Out of scope | operating systems (roadmap 3) |
| 22 | Inodes, Blocks & Superblocks | Out of scope | operating systems (roadmap 3) |
| 23 | Journaling Filesystems | Out of scope | operating systems (roadmap 3) |
| 24 | Page Cache & Buffered I/O | Out of scope | operating systems (roadmap 3) |
| 25 | POSIX File Semantics & Permissions | Out of scope | operating systems (roadmap 3) |
| 26 | Filesystem Types Comparison | Out of scope | operating systems (roadmap 3) |
| 27 | Mount Namespaces & Bind Mounts | Out of scope | operating systems (roadmap 3) |
| 28 | HDD vs SSD vs NVMe Internals | Out of scope | hardware (roadmap 3) |
| 29 | IOPS, Throughput & Latency Fundamentals | Out of scope | hardware (roadmap 3) |
| 30 | RAID Levels & Tradeoffs | Out of scope | hardware (roadmap 3) |
| 31 | DAS vs NAS vs SAN | Out of scope | hardware (roadmap 3) |
| 32 | Network Storage Protocols | Out of scope | hardware (roadmap 3) |
| 33 | HDFS Architecture (NameNode/DataNode) | Out of scope | Hadoop (roadmap 3) |
| 34 | HDFS Block Replication & Placement | Out of scope | Hadoop (roadmap 3) |
| 35 | Erasure Coding vs Replication | Out of scope | distributed storage (roadmap 3) |
| 36 | Consistency Models | Out of scope | distributed systems (roadmap 3) |
| 37 | CAP Theorem in Storage Systems | Out of scope | distributed systems (roadmap 3) |
| 38 | Quorum-Based Replication | Out of scope | distributed systems (roadmap 3) |
| 39 | Azure Storage Account Architecture | Out of scope | ADLS study guide |
| 40 | Blob Storage Types | Out of scope | ADLS study guide |
| 41 | Redundancy Options (LRS/ZRS/GRS/RA-GRS/GZRS) | Out of scope | ADLS study guide |
| 42 | Performance Tiers (Standard vs Premium) | Out of scope | ADLS study guide |
| 43 | Throttling, Scalability Targets & Limits | Out of scope | ADLS study guide |
| 44 | Azure Files & Azure Disks Overview | Out of scope | general Azure |
| 45 | Hierarchical Namespace Internals | Out of scope | ADLS study guide |
| 46 | ABFS Driver & Access Patterns | Out of scope | ADLS study guide (the `abfss://` path is in 40) |
| 47 | ACLs vs Azure RBAC | Out of scope | ADLS study guide |
| 48 | ADLS Performance Best Practices | Out of scope | ADLS study guide |
| 49 | OneLake Architecture & Namespace | Out of scope | Fabric |
| 50 | OneLake Shortcuts | Out of scope | Fabric |
| 51 | Fabric Capacity & Storage Throughput | Out of scope | Fabric |
| 52 | DBFS Legacy Model & Mount Points | Partly | notes §17 (legacy access patterns), §21.3 (DBFS root); no topic |
| 53 | Unity Catalog Volumes & External Locations | Covered | 39, 40 |
| 54 | Storage Credentials & Managed Identities | Covered | 40 |
| 55 | Delta Lake File Layout | Covered | 12-16 |
| 56 | Parquet Footer & Columnar Storage Internals | Covered | 6-9 |
| 57 | Delta Transaction Log Deep Dive | Covered | 13, 14, 15 |
| 58 | Checkpoint Files & Log Compaction | Covered | 16 |
| 59 | OPTIMIZE & File Compaction | Covered | 30 |
| 60 | VACUUM & Data Retention | Covered | 23, 24 |
| 61 | Z-Ordering vs Liquid Clustering | Covered | 32, 33 |
| 62 | Deletion Vectors & Merge-on-Read | Covered | 34 |
| 63 | Partitioning Strategy & Small-File Problem | Covered | 11, 36 |
| 64 | Data Skipping & File Statistics | Covered | 31 |
| 65 | Disk Cache vs Delta Cache | Wrong or renamed | the same feature: "Delta cache" is the old name of the disk cache (notes §9); 58 |
| 66 | Photon Engine Internals | Partly | notes §12 says what Photon is; its internals were not researched |
| 67 | Predicate Pushdown & Query Planning | Partly | 8, 31 (pushdown and skipping); query planning needs research |
| 68 | Auto-Optimize & Auto-Compaction | Partly | 30 (auto compaction); optimized writes need research |
| 69 | Blob Lifecycle Management | Out of scope | ADLS study guide |
| 70 | Databricks Storage Cost Patterns | Partly | 23 (retention cost), 35, 51 |
| 71 | Capacity Planning for Storage Growth | Out of scope | general storage |
| 72 | Geo-Redundancy & Failover Patterns | Out of scope | ADLS study guide |
| 73 | Time Travel as a Recovery Mechanism | Covered | 22, 25 (the docs warn history is not a long-term backup) |
| 74 | Backup Strategies for Lakehouse Data | Needs research | not read |
| 75 | Cross-Region Replication Design | Needs research | not read |
| 76 | RPO/RTO Planning for Storage | Needs research | not read |
| 77 | Unity Catalog Disaster Recovery | Needs research | not read |
| 78 | Cluster & Job Resilience Patterns | Partly | 71, 72 |
| 79 | Encryption at Rest & In Transit | Needs research | not read |
| 80 | Customer-Managed Keys (CMK) | Needs research | not read |
| 81 | Network Isolation | Can add | notes §20 |
| 82 | Unity Catalog Access Control Model | Covered | 41, 42 |
| 83 | Cluster Types (All-Purpose vs Job vs SQL Warehouse) | Covered | 46, 47, 48 |
| 84 | Cluster Policies & Pools | Covered | 50 |
| 85 | Autoscaling & Spot/Low-Priority Instances | Partly | 51 (spot); autoscaling can be added from notes §12 |
| 86 | Serverless Compute | Covered | 46 |
| 87 | Cluster Sizing Methodology | Needs research | only VACUUM sizing is in the notes |
| 88 | Runtime Versions & LTS Strategy | Can add | notes §12 |
| 89 | Init Scripts & Cluster-Scoped Libraries | Needs research | not read |
| 90 | Photon & Runtime Selection for Workload Type | Can add | notes §12 |
| 91 | Single vs Multi-Workspace Strategy | Partly | 3 (metastore per region shared by workspaces); strategy needs research |
| 92 | Unity Catalog Metastore Design | Covered | 3, 37 |
| 93 | Catalog/Schema/Table Naming & Isolation Strategy | Needs research | not read |
| 94 | Databricks Repos & Git Integration | Wrong or renamed | Repos are now Git folders; 77 |
| 95 | Databricks Asset Bundles (DABs) for CI/CD | Wrong or renamed | now Declarative Automation Bundles; 78 |
| 96 | Workspace-to-Workspace Data Sharing (Delta Sharing) | Wrong or renamed | Delta Sharing is now OpenSharing (notes §0); not researched beyond the name |
| 97 | Environment Promotion Strategy | Partly | 78 (targets) |
| 98 | Batch vs Streaming Decision Framework | Covered | 59, 64 |
| 99 | Azure Data Factory vs Databricks Workflows | Covered | 73 ("Databricks Workflows" is not confirmed as a former name of Lakeflow Jobs: notes §19) |
| 100 | Autoloader & Cloud File Notification Patterns | Covered | 61 |
| 101 | Change Data Capture (CDC) Patterns | Covered | 28, 29, 68 |
| 102 | Event Hubs / Kafka Ingestion into Databricks | Partly | 59 (Kafka and Event Hubs are named as sources); details need research |
| 103 | Fabric Data Factory/Dataflows vs Databricks Ingestion | Out of scope | Fabric |
| 104 | API & Third-Party Connector Patterns | Partly | 59 (managed SaaS connectors) |
| 105 | Data Contract & Schema Evolution Strategy | Covered | 26, 27, 62 |
| 106 | Medallion Architecture at Enterprise Scale | Covered | 55 |
| 107 | Lambda vs Kappa Architecture | Out of scope | general architecture |
| 108 | Data Mesh vs Centralized Lakehouse | Out of scope | general architecture |
| 109 | ML Platform Architecture on Databricks | Out of scope | machine learning, not data engineering |
| 110 | Real-Time Analytics Architecture | Needs research | notes §8 names real-time mode only |
| 111 | Multi-Cloud / Hybrid Considerations | Out of scope | general architecture |
| 112 | Choosing Between Fabric, Synapse & Databricks | Out of scope | Fabric and Synapse |
| 113 | Secrets Management | Covered | 76 |
| 114 | Data Classification & Sensitivity Labeling | Partly | 44 (governed tags) |
| 115 | Row/Column-Level Security & Masking at Scale | Covered | 43, 44 |
| 116 | Audit Logging & Diagnostic Settings | Partly | 45, 74; Azure diagnostic settings need research |
| 117 | Compliance Frameworks Overview | Out of scope | general compliance |
| 118 | Network Security Baseline | Can add | notes §20 |
| 119 | Threat Modeling a Lakehouse Architecture | Out of scope | general security practice |
| 120 | Total Cost of Ownership Modeling | Out of scope | general finance (Databricks cost drivers are 51) |
| 121 | Chargeback/Showback Models | Partly | 74 (cost attribution with system tables) |
| 122 | Databricks DBU Pricing Model & Cost Attribution | Covered | 51, 74 |
| 123 | Reserved Capacity & Commitment Discounts | Needs research | not read |
| 124 | Cost Anomaly Detection & Alerting | Needs research | not read |
| 125 | Multi-Region Databricks Architecture | Needs research | not read |
| 126 | Workspace-Level Failover Strategy | Needs research | not read |
| 127 | Metastore & Unity Catalog DR (Platform Level) | Needs research | not read |
| 128 | Business Continuity Planning | Out of scope | general practice |
| 129 | Chaos Engineering for Data Pipelines | Out of scope | general practice |
| 130 | SLA/SLO Definition for a Data Platform | Out of scope | general practice |
| 131 | Writing Architecture Decision Records | Out of scope | architecture practice (System Design track) |
| 132 | Trade-off Analysis Frameworks | Out of scope | architecture practice (System Design track) |
| 133 | Presenting Architecture to Non-Technical Stakeholders | Out of scope | architecture practice (scenario Say-it questions practise this) |
| 134 | Estimating & Scoping a Platform Build | Out of scope | architecture practice (Lakehouse Lab Station F) |
| 135 | Vendor/Tool Evaluation Frameworks | Out of scope | architecture practice |
| 136 | Running an Architecture Review Board Session | Out of scope | architecture practice |
| 137 | Databricks Certified Data Engineer Professional | Partly | notes §1.3; the plan treats it as a later step |
| 138 | Databricks Solutions Architect Certification | Wrong or renamed | **does not exist**; the nearest is the Azure Platform Architect badge (notes §1.4) |
| 139 | Azure Solutions Architect Expert (AZ-305) | Out of scope | a Microsoft certification, not researched |
| 140 | Mock Architecture Interview / Whiteboard Practice | Out of scope | System Design and interview tracks |
| 141 | Capstone: End-to-End Solution Design | Partly | 79 (a build, not a design review) |
