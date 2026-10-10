# Lakehouse Lab P1-5: Station I — Identity & Governance Research

**Checked on date:** 2026-10-10  
**Status:** Phase A Research Complete (Awaiting User Review & Approval)  
**Branch:** `feat/lakehouse-p1-5-station-i`  
**Deliverable:** Research foundation, claims register, and puzzle designs for Station I ("Identity and governance (a simulation)").

---

## 1. Scope, Date & Simulation Disclaimer

### 1.1 Scope
Lakehouse Lab Station I is a pure client-side simulation covering two core enterprise migration disciplines:
1. **Identity & Authentication Migration:** Transitioning on-premises Kerberos service accounts across multiple realms to cloud identities (Microsoft Entra ID Service Principals, Databricks-managed service principals, and Azure Managed Identities).
2. **Data Governance & Access Control Translation:** Translating legacy Apache Ranger row-level filtering and column-masking policies into native Unity Catalog constructs (table-level row filters, column masks, and Attribute-Based Access Control / ABAC).

No real Azure, Microsoft Entra ID, Kerberos KDC, or Databricks REST API calls are executed. All models and evaluations are deterministic and pure.

### 1.2 Date
All documentation was verified live on **2026-10-10**. Feature availability, release channels (General Availability vs. Beta/Preview), and syntax represent the documented state as of this date.

### 1.3 Simulation Disclaimer
> **IMPORTANT NOTICE:**  
> Station I is an educational teaching simulation over a fictional enterprise estate (`*.example.com`). It does **not** connect to, represent, or inspect any live Active Directory forest, Kerberos realm, Microsoft Entra tenant, or Azure Databricks workspace. All account identifiers, principal names, and directory structures are hypothetical constructs designed solely to teach architectural migration patterns.

---

## 2. Sources Table

All sources listed below are official vendor documentation pages retrieved and verified live during this session. No blogs, community forums, or secondary aggregators are cited.

| Source ID | Title | URL | Publisher | Checked on |
|---|---|---|---|---|
| **S1** | Attributes synchronized by Microsoft Entra Connect | `https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/reference-connect-sync-attributes-synchronized` | Microsoft Learn | 2026-10-10 |
| **S2** | Microsoft Entra Connect: ADSync service account | `https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/concept-adsync-service-account` | Microsoft Learn | 2026-10-10 |
| **S3** | Application and service principal objects in Microsoft Entra ID | `https://learn.microsoft.com/en-us/entra/identity-platform/app-objects-and-service-principals` | Microsoft Learn | 2026-10-10 |
| **S4** | What are managed identities for Azure resources? | `https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview` | Microsoft Learn | 2026-10-10 |
| **S5** | Manage service principals (Azure Databricks) | `https://learn.microsoft.com/azure/databricks/admin/users-groups/service-principals` | Microsoft Learn / Azure Databricks | 2026-10-10 |
| **S6** | Authorize service principal access to Databricks with OAuth (OAuth M2M) | `https://docs.databricks.com/en/dev-tools/auth/oauth-m2m.html` | Databricks Documentation | 2026-10-10 |
| **S7** | Authenticate with Microsoft Entra service principals | `https://learn.microsoft.com/azure/databricks/dev-tools/auth/azure-sp` | Microsoft Learn / Azure Databricks | 2026-10-10 |
| **S8** | Use Azure managed identities in Unity Catalog to access storage | `https://learn.microsoft.com/azure/databricks/data-governance/unity-catalog/azure-managed-identities` | Microsoft Learn / Azure Databricks | 2026-10-10 |
| **S9** | Row-level filtering and column-masking using Apache Ranger policies in Apache Hive | `https://cwiki.apache.org/confluence/display/RANGER/Row-level+filtering+and+column-masking+using+Apache+Ranger+policies+in+Apache+Hive` | Apache Software Foundation (Apache Ranger Confluence) | 2026-10-10 |
| **S10** | Row filters and column masks | `https://learn.microsoft.com/azure/databricks/tables/row-and-column-filters` | Microsoft Learn / Azure Databricks | 2026-10-10 |
| **S11** | Manually apply row filters and column masks | `https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/filters-and-masks/manually-apply` | Microsoft Learn / Azure Databricks | 2026-10-10 |
| **S12** | Create dynamic views in Unity Catalog | `https://learn.microsoft.com/en-us/azure/databricks/views/dynamic` | Microsoft Learn / Azure Databricks | 2026-10-10 |
| **S13** | Attribute-based access control in Unity Catalog | `https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/abac/` | Microsoft Learn / Azure Databricks | 2026-10-10 |
| **S14** | Core concepts for attribute-based access control (ABAC) | `https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/abac/core-concepts` | Microsoft Learn / Azure Databricks | 2026-10-10 |

---

## 3. Claims Register

Every entry is classified as one of:
- `fact`: A documented rule confirmed against an official vendor source.
- `assumption`: A scenario parameter adopted to make the simulation teaching narrative concrete.
- `convention`: A local structural or numbering choice internal to PrepBench.

| Claim ID | Claim (One Sentence) | Kind | Source ID(s) | Section / Heading | Notes |
|---|---|---|---|---|---|
| **C1** | Microsoft Entra Connect Sync synchronizes User, Group, Contact, and Device object types from Active Directory DS to Microsoft Entra ID. | `fact` | S1 | Attributes synchronized by Microsoft Entra Connect | Standard sync scope excludes specialized service accounts. |
| **C2** | Microsoft Entra Connect Sync does not synchronize Group Managed Service Accounts (`msDS-GroupManagedServiceAccount`) or standalone Managed Service Accounts (`msDS-ManagedServiceAccount`) to Microsoft Entra ID. | `fact` | S1, S2 | Default configuration / Group Managed Service Accounts | gMSAs are strictly excluded by directory synchronization rules. |
| **C3** | Microsoft Entra ID has no native Group Managed Service Account (gMSA) object type. | `fact` | S2 | Concepts / gMSA | gMSAs rely entirely on on-prem Active Directory KDC domain controllers. |
| **C4** | Automated unattended workloads authenticating to Microsoft Entra ID require a registered Application with an associated Service Principal object. | `fact` | S3 | Application and service principal objects in Microsoft Entra ID | Workloads cannot present Kerberos tickets directly to Entra ID OAuth endpoints. |
| **C5** | Microsoft Entra service principals authenticate using the OAuth 2.0 client credentials grant flow with a client ID and client secret, certificate, or federated credential. | `fact` | S3, S7 | Application objects / Authentication | On-prem keytabs cannot directly authenticate against `https://login.microsoftonline.com`. |
| **C6** | Managed identities for Azure resources provide automatically managed identities in Microsoft Entra ID for Azure compute without embedding credentials in configuration. | `fact` | S4 | Overview / How managed identities work | Bound to Azure compute metadata service (IMDS). |
| **C7** | Managed identities cannot be used by on-premises servers without Azure Arc or Workload Identity Federation. | `fact` | S4 | User-assigned and system-assigned identities | On-prem batch servers cannot invoke Azure IMDS (`169.254.169.254`). |
| **C8** | Azure Databricks supports authentication via Microsoft Entra service principals using `azure_client_id`, `azure_client_secret`, and `azure_tenant_id`. | `fact` | S5, S7 | Authentication / Service principals | Native supported cloud service principal authentication pattern. |
| **C9** | Azure Databricks Account Console supports Databricks-managed service principals authenticated via OAuth Machine-to-Machine (M2M) with secrets valid up to 730 days. | `fact` | S5, S6 | OAuth M2M / Step 1: Create an OAuth secret | Workspace-independent M2M service principal flow. |
| **C10** | In Azure Databricks Unity Catalog, storage access is mediated by Storage Credentials referencing an Access Connector for Azure Databricks managed identity, not workload credentials. | `fact` | S8 | How it works / Access Connectors | Workloads do not directly hold storage keys or storage container permissions. |
| **C11** | Apache Ranger row filter policies enforce row-level security by dynamically injecting SQL WHERE clause expressions into queries at query execution time. | `fact` | S9 | 1. Introduction / 2. Use cases: row-level filters | External centralized policy enforcement without altering table DDL. |
| **C12** | Apache Ranger column masking policies dynamically mask column values in SQL queries using redaction, partial masks, NULL values, or custom SQL expressions. | `fact` | S9 | 1. Introduction / 3. Use cases: data-masking | Managed centrally in the Ranger Admin console. |
| **C13** | Apache Ranger evaluates policy items in listed order, applying the filter expression of the first item matching the user or group request. | `fact` | S9 | 2. Use cases / Use case #4 | First matching item wins; an empty filter grants full row access. |
| **C14** | Unity Catalog provides table-level row filters using user-defined functions (UDFs) that return BOOLEAN, bound to tables with `ALTER TABLE ... SET ROW FILTER ... ON (<col>)`. | `fact` | S10, S11 | Apply a row filter / SQL | Table-level RLS attached directly to table metadata. |
| **C15** | Unity Catalog provides table-level column masks using SQL UDFs that return a value matching the column data type, bound with `ALTER TABLE ... ALTER COLUMN <col> SET MASK <udf>`. | `fact` | S10, S11 | Apply a column mask / SQL | Masking logic executes transparently on base table reads. |
| **C16** | Unity Catalog row filter and column mask UDFs run with definer's rights, except for user context functions like `SESSION_USER()` and `IS_ACCOUNT_GROUP_MEMBER()` which run as invoker. | `fact` | S11 | Use mapping tables to create an access-control list / Note | Context functions evaluate caller identity at query runtime. |
| **C17** | In Unity Catalog, `is_account_group_member()` evaluates account-level group membership and is recommended for dynamic views and fine-grained access control. | `fact` | S11, S12 | Built-in functions / Requirements | Standard account-level group resolution across Unity Catalog. |
| **C18** | In Azure Databricks, `is_member()` evaluates only workspace-local groups for legacy Hive metastore compatibility and does not evaluate account-level groups in Unity Catalog. | `fact` | S12 | Requirements / Built-in functions | Using `is_member()` in Unity Catalog causes group membership checks to fail. |
| **C19** | Unity Catalog dynamic views wrap base tables in a SQL view with CASE statements, requiring separate privilege management on the view versus underlying tables. | `fact` | S10, S12 | Dynamic views / Column-level permissions | If users possess direct SELECT on the base table, dynamic view restrictions are bypassed. |
| **C20** | When a column type differs from a Unity Catalog UDF parameter type and ANSI mode is disabled (`spark.sql.ansi.enabled = false`), uncastable values silently convert to NULL without error. | `fact` | S10, S11 | Data type mismatch behavior | Can cause row filters to leak records or masks to silently produce NULLs. |
| **C21** | Unity Catalog Attribute-Based Access Control (ABAC) defines catalog- and schema-level row filter and column mask policies attached automatically via governed tags. | `fact` | S13, S14 | Attribute-based access control in Unity Catalog | Managed centrally with `CREATE POLICY ... MATCH COLUMNS has_tag(...)`. |
| **C22** | Metastore-level ABAC policies and ABAC DENY policies are in Beta as of 2026-10-10, while catalog/schema row filter and column mask policies are Generally Available. | `fact` | S13, S14 | Policies / Policy types / DENY policies (Beta) | Verified status as of 2026-10-10. |
| **C23** | Unity Catalog standard object privileges are additive grants (`GRANT`), and Unity Catalog does not support SQL DDL `DENY SELECT` statements on standard tables. | `fact` | S10, S14 | Security Context / GRANT policies | Restrictions must be implemented via row filters, column masks, or ABAC policies. |
| **C24** | The simulated enterprise estate comprises on-premises Active Directory domain `corp.example.com`, Kerberos realm `ANALYTICS.EXAMPLE.COM`, and Entra ID tenant `example.onmicrosoft.com`. | `assumption` | — | Simulation Design | Fictional names preventing confusion with live infrastructure. |
| **C25** | The migration scenario includes five service accounts representing batch extraction, streaming ingestion, reporting, and orchestration workloads. | `assumption` | — | Simulation Design | Concrete workload diversity for the identity puzzle. |
| **C26** | The legacy governance scenario represents a telecom and retail customer dataset (`retail.customer_orders`) with regional sales restrictions and customer SSN masking. | `assumption` | — | Simulation Design | Clear business rationale for row filtering and column masking. |
| **C27** | Station I challenges are registered under IDs `lakehouse.i.identity` and `lakehouse.i.governance`. | `convention` | — | Handoff §P1-5 | Follows PrepBench challenge naming conventions. |
| **C28** | Grading in Station I is deterministic, while the learner's written migration workstream and governance rationale raise evidence to "evidenced" without AI scoring. | `convention` | — | Handoff §P1-5 | Complies with CLAUDE.md rule against fabricated auto-scores. |

---

## 4. Unverified or Contradictory List

| Topic / Item | Sources Inspected | Finding & Subtlety | Resolution / Status |
|---|---|---|---|
| **Unity Catalog ABAC Release Status** | S13, S14 | Metastore-level policies and `DENY` policies are explicitly flagged as **Beta** in official docs as of 2026-10-10. Catalog- and schema-level row filter/column mask policies using governed tags are supported in production (Databricks Runtime 16.4+ / Serverless). | **Verified:** The governance puzzle explicitly identifies ABAC metastore policies and DENY as Beta, and adopts table-level row filters/column masks with `IS_ACCOUNT_GROUP_MEMBER()` as the primary GA migration pattern. |
| **`is_member()` vs `is_account_group_member()`** | S11, S12 | Older Databricks tutorials frequently use `is_member()`. S12 explicitly states: "`is_member()` is provided for compatibility with the existing Hive metastore. Avoid using it with views against Unity Catalog data, because it does not evaluate account-level group membership." | **Verified:** Redesigns using `is_member()` are documented as an anti-pattern and form one of the plausible wrong choices. |
| **Active Directory gMSA Cloud Synchronization** | S1, S2 | Confirmed that Microsoft Entra Connect Sync omits `msDS-GroupManagedServiceAccount` objects entirely, and Entra ID has no gMSA capability. | **Verified:** Solid factual basis for the failing identity in the identity puzzle. |
| **Conflicting/Unverified Claims** | All | None. All 23 factual claims trace directly to official documentation checked on 2026-10-10. | **0 unverified claims.** |

---

## 5. Puzzle Design

### 5.1 Puzzle 1: Identity & Authentication Migration (`lakehouse.i.identity`)

#### Scenario & Enterprise Architecture
A large enterprise is migrating legacy on-premises Hadoop/Spark workloads to Azure Databricks with Unity Catalog.
- **On-Premises Infrastructure:**
  - Kerberos Realm 1 (Active Directory): `CORP.EXAMPLE.COM`
  - Kerberos Realm 2 (MIT Kerberos): `ANALYTICS.EXAMPLE.COM`
  - Microsoft Entra ID Tenant: `example.onmicrosoft.com`
  - Hybrid Sync: Microsoft Entra Connect Sync running between `CORP.EXAMPLE.COM` and `example.onmicrosoft.com`.
- **The Cutover Change:**
  - The data engineering team points all batch pipelines and ingestion jobs away from on-premises Hive/HDFS to an Azure Databricks workspace configured with Unity Catalog.
  - Workloads authenticate to Azure Databricks via OAuth 2.0 client credentials (`https://login.microsoftonline.com/example.onmicrosoft.com/oauth2/v2.0/token`) or Databricks OAuth M2M.

#### The 5 Candidate Service Accounts
1. **`svc-etl-batch@CORP.EXAMPLE.COM`**
   - *Type:* Standard Active Directory User Account.
   - *Migration State:* Synchronized to Microsoft Entra ID via Entra Connect Sync; registered as an Enterprise App with an Entra Service Principal and client secret stored in Azure Key Vault.
   - *Result:* **SUCCEEDS**. Obtains OAuth token and connects to Databricks [C1, C4, C5, C8].
2. **`svc-bi-reporting@CORP.EXAMPLE.COM`**
   - *Type:* Standard Active Directory User Account.
   - *Migration State:* Synchronized to Microsoft Entra ID; provisioned with a Databricks-managed service principal in the Account Console with OAuth M2M secret.
   - *Result:* **SUCCEEDS**. Obtains Databricks OAuth M2M token [C5, C9].
3. **`svc-stream-ingest@ANALYTICS.EXAMPLE.COM`**
   - *Type:* Standalone Linux service account in separate MIT Kerberos realm (not in Active Directory).
   - *Migration State:* Replaced in cloud by an Azure Databricks service principal with OAuth M2M credentials configured in the Databricks Account Console.
   - *Result:* **SUCCEEDS**. Authentication mediated by Databricks OAuth M2M [C9].
4. **`svc-orchestrator-adf`**
   - *Type:* Azure Data Factory System-Assigned Managed Identity.
   - *Migration State:* Native Azure Managed Identity assigned `Storage Blob Data Contributor` via Unity Catalog Access Connector.
   - *Result:* **SUCCEEDS**. Acquires Entra token directly via Azure IMDS [C6, C10].
5. **`svc-sqoop-daily@CORP.EXAMPLE.COM`**
   - *Type:* Active Directory Group Managed Service Account (`msDS-GroupManagedServiceAccount` / gMSA).
   - *Migration State:* The legacy on-prem Sqoop extraction script was containerized and shifted as-is. It attempts to request an Entra ID token using its on-prem gMSA name without an App Registration or registered client secret in Entra ID.
   - *Result:* **FAILS TO OBTAIN TOKEN (THE plant)** [C2, C3, C4, C5].

#### Claim Chain: Why `svc-sqoop-daily` Fails
1. `svc-sqoop-daily` is a Group Managed Service Account (`msDS-GroupManagedServiceAccount`) in Active Directory whose Kerberos password is automatically negotiated and rotated by on-prem Domain Controllers [C3].
2. Microsoft Entra Connect Sync explicitly excludes `msDS-GroupManagedServiceAccount` objects from synchronization [C2].
3. Microsoft Entra ID has no native concept of gMSAs and cannot validate AD DS KDC ticket grants [C3].
4. To request an OAuth 2.0 token from Microsoft Entra ID's token endpoint (`/oauth2/v2.0/token`), an Application registration and Service Principal must exist in the Entra tenant with registered credentials (secret, certificate, or federated credential) [C4, C5].
5. Because no Entra ID Application or Service Principal exists for `svc-sqoop-daily`, Entra ID returns `AADSTS700016: Application with identifier 'svc-sqoop-daily@CORP.EXAMPLE.COM' was not found in the directory 'example.onmicrosoft.com'` [C4, C5].

#### Migration Workstream Plan (Correct Remedy)
The learner formulates the migration plan with 4 required sign-off stages:
1. **Identity Provisioning:** Create an Application Registration in Microsoft Entra ID (`app-sqoop-extract`) with a Service Principal in tenant `example.onmicrosoft.com` [C4].
2. **Credential Management:** Generate an OAuth client secret or certificate, store it in Azure Key Vault, and configure a Databricks secret scope backed by Key Vault [C5, C8].
3. **Privilege Assignment:** Add the Service Principal to the Databricks Account Console, grant workspace access, and execute Unity Catalog grants (`GRANT USE CATALOG, USE SCHEMA, SELECT`) [C8, C23].
4. **Pipeline Configuration:** Update the containerized pipeline to authenticate via the Databricks CLI / SDK using `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` [C8].

---

### 5.2 Puzzle 2: Governance & Policy Translation (`lakehouse.i.governance`)

#### Fictional Legacy Apache Ranger Policy
- **Secured Table:** `retail.customer_orders`
  ```sql
  Columns:
    order_id STRING,
    customer_id STRING,
    customer_state STRING,
    ssn STRING,
    order_total DECIMAL(10,2)
  ```
- **Business Rationale / Requirements:**
  1. *Row Filtering:* Regional sales representatives belonging to group `midwest_sales` must only see customer records where `customer_state IN ('IL', 'IN', 'OH', 'MI', 'WI')`. National managers belonging to `national_mgmt` must see all rows nationwide without restriction.
  2. *Column Masking:* For PII protection, the `ssn` column must be masked to reveal only the last 4 digits (e.g. `***-**-1234`) for general users. Only auditors belonging to group `compliance_audit` are authorized to see the cleartext SSN.
- **Legacy Ranger Implementation (in Ranger Admin Console):**
  - *Row Policy (Hive Service):*
    - Item 1: Group `national_mgmt` -> Row Filter: ` ` (empty/unrestricted) [C13]
    - Item 2: Group `midwest_sales` -> Row Filter: `customer_state IN ('IL', 'IN', 'OH', 'MI', 'WI')` [C11, C13]
  - *Column Masking Policy (Hive Service, Column `ssn`):*
    - Item 1: Group `compliance_audit` -> Mask Type: `None` (unmasked)
    - Item 2: Group `public` -> Mask Type: `Custom Expression`: `concat('***-**-', substr({col}, 8, 4))` [C12]

#### The Correct Unity Catalog Redesign
```sql
-- 1. Row Filter UDF in Unity Catalog
CREATE OR REPLACE FUNCTION retail.filter_customer_state(state STRING)
RETURN IF(
  IS_ACCOUNT_GROUP_MEMBER('national_mgmt'),
  TRUE,
  IS_ACCOUNT_GROUP_MEMBER('midwest_sales') AND state IN ('IL', 'IN', 'OH', 'MI', 'WI')
);

-- Apply Row Filter directly to table
ALTER TABLE retail.customer_orders
SET ROW FILTER retail.filter_customer_state ON (customer_state);

-- 2. Column Mask UDF in Unity Catalog
CREATE OR REPLACE FUNCTION retail.mask_customer_ssn(ssn STRING)
RETURN IF(
  IS_ACCOUNT_GROUP_MEMBER('compliance_audit'),
  ssn,
  CONCAT('***-**-', RIGHT(ssn, 4))
);

-- Apply Column Mask directly to column
ALTER TABLE retail.customer_orders
ALTER COLUMN ssn
SET MASK retail.mask_customer_ssn;
```
*Why this is correct:*
- Uses `IS_ACCOUNT_GROUP_MEMBER()`, which evaluates account-level groups in Unity Catalog [C16, C17].
- Directly modifies base table DDL with `SET ROW FILTER` and `SET MASK`, ensuring that any user with `SELECT` on `retail.customer_orders` is governed automatically without needing auxiliary views [C14, C15].
- Function return types match column and filter requirements: `filter_customer_state` returns `BOOLEAN`; `mask_customer_ssn` returns `STRING` matching `ssn STRING` [C14, C15].

#### Plausible Wrong Redesign 1: Legacy Dynamic View with `is_member()`
```sql
CREATE VIEW retail.v_customer_orders AS
SELECT
  order_id,
  customer_id,
  customer_state,
  CASE
    WHEN is_member('compliance_audit') THEN ssn
    ELSE '***-**-XXXX'
  END AS ssn,
  order_total
FROM retail.customer_orders
WHERE CASE
  WHEN is_member('national_mgmt') THEN TRUE
  WHEN is_member('midwest_sales') THEN customer_state IN ('IL', 'IN', 'OH', 'MI', 'WI')
  ELSE FALSE
END;
```
*Why this is rejected (Claim IDs cited):*
1. **Wrong Function:** Uses `is_member()` instead of `IS_ACCOUNT_GROUP_MEMBER()`. As documented in S12 [C18], `is_member()` only checks workspace-local groups for Hive metastore backwards compatibility and fails to evaluate account-level groups in Unity Catalog.
2. **View Bypass:** Dynamic views require dual privilege management (granting the view while revoking the underlying table). Any user with direct table access bypasses the view's security logic [C19].
3. **Maintenance Overhead:** Every downstream query, dashboard, or pipeline must be updated to target the view rather than the physical table [C10, C19].

#### Plausible Wrong Redesign 2: Ranger-Style External DENY / Push Grants
```sql
-- Attempting SQL DENY grants on the base table
DENY SELECT ON retail.customer_orders
WHERE customer_state NOT IN ('IL', 'IN', 'OH', 'MI', 'WI')
TO `midwest_sales`;
```
*Why this is rejected (Claim IDs cited):*
1. **Invalid SQL Syntax in Unity Catalog:** Unity Catalog standard permissions model is purely additive (`GRANT`); there is no SQL DDL `DENY SELECT ... WHERE` syntax on standard tables [C23].
2. **Architecture Mismatch:** Ranger relies on a push-model plugin embedded in the HiveServer2 JVM. Unity Catalog enforces fine-grained access control inside the Databricks compute engine using SQL UDFs registered in the catalog [C11, C14].
3. **ABAC Scope:** While ABAC supports DENY policies (Beta), they are currently scoped strictly to the `MANAGE ACCESS CONTROL` privilege, not row-level query filtering [C22].

#### Plausible Wrong Redesign 3: Column Mask Type Mismatch under Non-ANSI Mode
```sql
-- Parameter declared as INT while column is STRING
CREATE OR REPLACE FUNCTION retail.bad_mask(ssn INT)
RETURN IF(IS_ACCOUNT_GROUP_MEMBER('compliance_audit'), ssn, 9999);

ALTER TABLE retail.customer_orders ALTER COLUMN ssn SET MASK retail.bad_mask;
```
*Why this is rejected (Claim IDs cited):*
1. **Silent NULL Conversion:** When parameter types do not match column types and `spark.sql.ansi.enabled = false`, string values containing hyphens cannot be cast to `INT` and silently become `NULL` [C20].
2. **Silent Failure:** The UDF receives `NULL`, causing corrupted output or logic bypass without throwing a query error [C20].

---

## 6. On-Screen Wording Tagged by Claim ID

Below is the user-facing copy to be displayed in Station I, annotated with claim citations:

### 6.1 Station I Header & Simulation Disclaimer
> **Station I: Identity & Governance Simulation**  
> *Notice: This station is an educational teaching simulation over a fictional estate (`*.example.com`). It does not connect to or inspect any live tenant or realm.* `[C24, C27]`

### 6.2 Identity Puzzle Instructions
> "During cutover from on-premises Kerberos to Azure Databricks, unattended workloads must acquire OAuth tokens rather than presenting Kerberos tickets `[C4, C5]`.  
> While standard Active Directory users synchronize via Entra Connect Sync `[C1]`, specialized accounts such as Group Managed Service Accounts (gMSAs) are excluded from synchronization `[C2]` and have no native equivalent in Entra ID `[C3]`.  
> Inspect the five migrated service accounts below. Identify the exact account that fails to acquire a token upon cutover, trace the technical failure chain, and outline the proper service principal migration workstream." `[C4, C5, C8, C9, C25]`

### 6.3 Governance Puzzle Instructions
> "In your legacy Hadoop environment, Apache Ranger applied row-level filtering and column-masking policies centrally via query interception `[C11, C12]`.  
> In Azure Databricks Unity Catalog, fine-grained access control is implemented directly on tables using SQL User-Defined Functions (UDFs) evaluated with definer's rights `[C14, C15, C16]`.  
> Group evaluations must use `IS_ACCOUNT_GROUP_MEMBER()` rather than legacy workspace `is_member()` `[C17, C18]`.  
> Review the legacy Ranger policy on `retail.customer_orders`, select the architecturally valid Unity Catalog redesign, and justify why legacy dynamic views or pseudo-DENY statements fail." `[C19, C20, C23, C26]`

---

## 7. Next Steps for Phase B (Upon Approval)

Upon receipt of the user's explicit reply `"Proceed to Phase B"`, implementation will execute:
1. `frontend/src/services/lakehouse/identityModel.ts`: Pure TypeScript model with typed records (`kind: 'fact' | 'assumption' | 'convention'`) citing claims C1–C28.
2. `frontend/src/services/lakehouse/identityModel.test.ts`: Deterministic unit tests covering both puzzle solutions.
3. `frontend/src/components/lakehouse/StationI.tsx`: Interactive Station I component inside `StationShell.tsx`.
4. Pack manifest & portfolio updates: Add station `'i'` to `semiconductor-v1` manifest and `LAKEHOUSE_TITLES` in `portfolio.ts`.
5. Full verification suite: `npm test`, `npm run typecheck`, `npm run lint`, Playwright e2e, and gate report `GATE-LL-P1-5-REPORT.md`.
