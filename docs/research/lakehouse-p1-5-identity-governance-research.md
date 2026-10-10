# Lakehouse Lab P1-5: Station I, identity and governance: research

**Checked on:** 2026-10-10. **Status:** approved register for implementation (revision 2).

Station I is a teaching simulation over a fictional estate. Nothing in it calls Microsoft Entra ID, a Kerberos
KDC, Apache Ranger or Azure Databricks. This file is the only place its facts come from: the station shows no
technical statement that is not a claim below, and `frontend/src/services/lakehouse/identitySources.ts` holds the
same register as data, checked by tests.

## Revision history

- **Revision 1** (commit 0070562) was drafted in a separate tool. A claim-by-claim review against the cited pages
  found it not ready:
  - the identity puzzle had three correct answers, not one: Databricks-managed service principals get their
    tokens from Databricks, not Entra ID;
  - its planted failure rested on two claims (gMSAs excluded from sync; Entra ID has no gMSA type) that neither
    cited page states. The official default-sync-configuration page does not list managed service accounts
    among the excluded objects;
  - "unattended workloads require an app registration" is contradicted by the managed-identity service
    principal type;
  - an on-premises / Azure Arc claim, a "Generally Available" ABAC claim and an undocumented type-mismatch
    behaviour were not in their sources;
  - an exact Entra error message was unsourced, and the tenant name sat in a real namespace.
- **Revision 2** (this file) rebuilds the register from pages opened and read on 2026-10-10, and redesigns the
  identity puzzle so exactly one plan fails, decided by cited facts alone.

## 1. Scope

- **In:** how a workload is represented in Entra ID; where a managed identity can be used; the ways a workload
  authenticates to Azure Databricks and who issues its token; Apache Ranger row filters and masks; their Unity
  Catalog counterparts (row filters, column masks, dynamic views, ABAC policies) and the documented traps.
- **Out:** Kerberos protocol behaviour and how (or whether) Kerberos identities relate to Entra ID; directory
  synchronisation of service accounts; storage credentials. The station describes today's Kerberos set-up as
  scenario only (assumption A2) and judges only the cutover plans.

## 2. Sources

Every page below was opened and read on 2026-10-10.

| ID | Title | URL | Publisher |
|---|---|---|---|
| S1 | Apps & service principals in Microsoft Entra ID | https://learn.microsoft.com/en-us/entra/identity-platform/app-objects-and-service-principals | Microsoft Learn |
| S2 | Managed identities for Azure resources | https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview | Microsoft Learn |
| S3 | Authenticate with Microsoft Entra service principals (Azure Databricks) | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/auth/azure-sp | Microsoft Learn (Azure Databricks) |
| S4 | Use Azure managed identities with Azure Databricks | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/auth/azure-mi-auth | Microsoft Learn (Azure Databricks) |
| S5 | Authorize service principal access to Azure Databricks with OAuth | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/auth/oauth-m2m | Microsoft Learn (Azure Databricks) |
| S6 | Row-level filtering and column-masking using Apache Ranger policies in Apache Hive | https://cwiki.apache.org/confluence/display/RANGER/Row-level+filtering+and+column-masking+using+Apache+Ranger+policies+in+Apache+Hive | Apache Ranger wiki |
| S7 | Manually apply row filters and column masks | https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/filters-and-masks/manually-apply | Microsoft Learn (Azure Databricks) |
| S8 | Create a dynamic view | https://learn.microsoft.com/en-us/azure/databricks/views/dynamic | Microsoft Learn (Azure Databricks) |
| S9 | Attribute-based access control in Unity Catalog | https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/abac/ | Microsoft Learn (Azure Databricks) |
| S10 | Requirements, quotas, and limitations for row filter and column mask policies | https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/abac/requirements | Microsoft Learn (Azure Databricks) |

## 3. Claims register

Kinds: **fact** (stated by the cited page), **assumption** (a simplification or scenario choice of this
simulation, never presented as true of real systems), **convention** (a choice local to this station).

### Identity

| ID | Claim | Kind | Source |
|---|---|---|---|
| F1 | To reach resources secured by an Entra tenant, an application must be represented by a service principal. | fact | S1, "Service principal object" |
| F2 | There are three types of service principal: application, managed identity and legacy. | fact | S1, "Service principal object" |
| F3 | Registering an application creates an application object and a service principal in the home tenant, and secrets or certificates can be added to it. | fact | S1, "Application registration" |
| F4 | A service principal that represents a managed identity has no application object. | fact | S1, "Service principal object" |
| F5 | A managed identity is assigned to an Azure compute resource, such as a virtual machine, or to an app hosting platform Azure supports. | fact | S2, "What are managed identities?" |
| F6 | Applications use a managed identity to get Entra tokens without managing any credentials. | fact | S2, introduction |
| F7 | Only the Azure resource a system-assigned managed identity was enabled on can use it to request tokens. | fact | S2, "Managed identity types" |
| F8 | A Microsoft Entra service principal authenticates to Azure Databricks with its tenant ID, client ID and client secret, and Databricks recommends assigning it to the workspace. | fact | S3 |
| F9 | Databricks recommends OAuth M2M in most cases, and Entra service principal authentication only when a workload must authenticate to Azure Databricks and other Azure resources at the same time. | fact | S3, note |
| F10 | Managed identity authentication to Azure Databricks gets Entra ID tokens, and Databricks treats the managed identity as a service principal assigned to the account or workspace. | fact | S4 |
| F11 | A Databricks-managed service principal using OAuth M2M gets its access token from the Databricks token endpoint, not from the identity provider's or cloud's endpoint. | fact | S5, "Generate … access token" and "Wrong token issuer" |
| F12 | An OAuth secret is valid for at most 730 days, and each access token for one hour. | fact | S5, "Step 1" |

### Governance

| ID | Claim | Kind | Source |
|---|---|---|---|
| F13 | Each item of a Ranger row-filter policy carries a filter expression, and Ranger evaluates the items in the order they are listed. | fact | S6, use cases |
| F14 | In Ranger, an empty row-filter expression means no row restriction. | fact | S6, use case 4 |
| F15 | Ranger masking includes showing only the last four characters, nullifying, an unmasked option, and custom expressions in which `{col}` stands for the column. | fact | S6, use cases and FAQ |
| F16 | A Unity Catalog row filter is a SQL function returning a boolean, applied with `ALTER TABLE … SET ROW FILTER … ON (…)`; a table has at most one row filter. | fact | S7, "Apply a row filter" |
| F17 | A Unity Catalog column mask is a SQL function returning the type of its first parameter, applied with `ALTER TABLE … ALTER COLUMN … SET MASK`. | fact | S7, "Apply a column mask" |
| F18 | Row filters run with the definer's rights, except functions that check who is asking, such as `SESSION_USER` and `IS_ACCOUNT_GROUP_MEMBER`, which run as the person querying. | fact | S7, mapping tables note |
| F19 | When a column's type differs from the function's parameter type, the value is cast; with ANSI mode off, values that cannot be cast become NULL silently, which can give wrong results without an error. | fact | S7, "Important" notes |
| F20 | `is_account_group_member()` checks account-level groups and is the one recommended for Unity Catalog data; `is_member()` checks workspace-level groups only. | fact | S8 |
| F21 | Databricks recommends not granting users read access to the tables a dynamic view reads from. | fact | S8 |
| F22 | ABAC row-filter and column-mask policies attach to a catalog, schema or table and find their data through governed tags; attaching one at metastore level is Beta as of 2026-10-10. | fact | S9 |
| F23 | ABAC DENY policies, Beta as of 2026-10-10, deny the `MANAGE ACCESS CONTROL` privilege; they do not filter rows. | fact | S9 |
| F24 | ABAC policies need serverless compute or Databricks Runtime 16.4 or above; ABAC on views is Beta as of 2026-10-10 and needs Runtime 19 or above. | fact | S10 |

### Assumptions and conventions

| ID | Claim | Kind |
|---|---|---|
| A1 | The estate is fictional: realms `CORP.FAB.EXAMPLE` and `HADOOP.FAB.EXAMPLE`, hosts under `fab.example`, one unnamed Entra tenant, four workloads and their cutover plans. | assumption |
| A2 | Today each workload authenticates with Kerberos. The station makes no claim about Kerberos itself; it judges only the cutover plans. | assumption |
| A3 | The scenario's groups are account-level groups. | assumption |
| A4 | Users in neither regional group must see no rows. Ranger's page does not say what an unmatched user sees, so the legacy policy states it as a last item for the group `public` with the filter `1 = 0`. The page uses `public` without defining it; here it means every user. | assumption |
| A5 | `retail.customer_orders` and its rows are invented; the identity numbers in it are in a range no real person has. | assumption |
| A6 | How each wrong redesign plays out on the sample rows is this model's reading of the fact it breaks (F19, F20, F23), not a captured run. | assumption |
| K1 | Challenge ids: `lakehouse.i.identity-cutover` and `lakehouse.i.governance-redesign`. | convention |
| K2 | The prediction is checked against the model. The learner's sign-off criteria and rationale are their explanation and are never scored. | convention |

## 4. Not confirmed, and so not used

- Whether Entra Connect synchronises group or standalone managed service accounts. The cited default-configuration
  page does not list them among excluded objects, and no page read says either way.
- How a Kerberos ticket or keytab relates to Entra ID token requests.
- Using managed identities outside Azure (for example through Azure Arc). S2 does not cover it.
- Whether catalog- or schema-level ABAC policies are "Generally Available". The pages read carry no Beta label for
  them, but none says GA.
- What Ranger does for a user who matches no row-filter item (hence assumption A4).
- What happens when a column mask returns a type other than the column's.

## 5. Puzzle design

### 5.1 Identity: `lakehouse.i.identity-cutover`

The Hive jobs move to an Azure Databricks workspace. After cutover every workload below must authenticate to that
workspace. Today they all use Kerberos (A2).

| Workload | Runs on | Cutover plan | Token from | Result | Why |
|---|---|---|---|---|---|
| `svc-yield-etl` | on-premises edge node `edge01.hadoop.fab.example` | Entra app registration with a client secret, assigned to the workspace | Entra ID | Works | F1, F3, F8 |
| `svc-tool-feed` | on-premises server `toolgw01.corp.fab.example` | Enable a system-assigned managed identity | none | **Fails** | F5, F7 |
| `svc-report-refresh` | on-premises scheduler `sched02.corp.fab.example` | Databricks-managed service principal with an OAuth secret | Databricks | Works | F11, F12 |
| `svc-lot-sync` | re-hosted on an Azure virtual machine | User-assigned managed identity on that VM, assigned to the workspace | Entra ID | Works | F5, F6, F10 |

- **Question:** whose cutover plan leaves it unable to authenticate? **Answer:** `svc-tool-feed` only. A
  managed identity belongs to an Azure compute resource (F5), and a system-assigned one only to the resource it
  was enabled on (F7). An on-premises server is neither.
- **Distractor:** `svc-report-refresh` never gets an Entra ID token, yet it works. Databricks issues its token
  (F11).
- **Manipulate:** change `svc-tool-feed`'s plan:
  - managed identity: fails (F5, F7);
  - Entra app registration: works, Entra token (F3, F8);
  - Databricks-managed service principal: works, Databricks token (F11);
  - re-host on an Azure VM with a user-assigned managed identity: works, Entra token (F5, F10).
- **Explain:** the learner writes the acceptance criteria for signing off `svc-tool-feed`'s new identity, never
  scored (K2). F9 is the deciding fact between an Entra service principal and OAuth M2M.

### 5.2 Governance: `lakehouse.i.governance-redesign`

**Table and rule** (A5): `retail.customer_orders (order_id, customer_state, ssn, order_total)`.
- `national_mgmt` sees every row.
- `midwest_sales` sees IL, IN, MI, OH and WI only.
- Everyone else sees no rows (A4).
- SSNs show their last four characters, except to `compliance_audit`.

**Legacy Ranger policy:**
- Row filter, in this order (F13, F14):
  1. `national_mgmt`: empty filter.
  2. `midwest_sales`: `customer_state IN ('IL','IN','MI','OH','WI')`.
  3. `public`: `1 = 0`.
- Mask on `ssn` (F15):
  1. `compliance_audit`: unmasked.
  2. `public`: custom `concat('***-**-', substr({col}, 8, 4))`.

**Test users** (A3): `ana` (national_mgmt), `ben` (midwest_sales), `cara` (national_mgmt and compliance_audit),
`dev` (no group).

**Candidates:**
1. **R1: row filter and column mask functions.** `IS_ACCOUNT_GROUP_MEMBER` checks the groups, `national_mgmt`
   is tested first, the filter parameter is `STRING`, and the mask is `STRING` to `STRING`. **Keeps the purpose**
   (F16, F17, F18, F20).
2. **R2: a dynamic view using `is_member()`.** `is_member` checks workspace-level groups only (F20), and the
   groups are account-level (A3). So no membership test passes: ana, ben and cara see no rows. Users must also
   be kept off the base table (F21).
3. **R3: an ABAC DENY policy meant to hide other states' rows.** DENY policies deny `MANAGE ACCESS CONTROL`,
   not rows (F23). Rows stay unfiltered and SSNs unmasked.
4. **R4: R1, but the filter's parameter is declared `INT`.** The `STRING` state is cast; with ANSI mode off it
   becomes NULL (F19). The comparison is never true, so ben sees no rows; ana and cara are unaffected.

How R2–R4 play out on the sample rows is the model's reading of those facts (A6).

**Expected, by user, under the legacy policy and R1:**

| User | Rows | SSN |
|---|---|---|
| ana | all 6 | last four |
| ben | 3 (IL, OH, WI) | last four |
| cara | all 6 | in full |
| dev | 0 | (none) |

- **Question:** which redesign keeps the policy's purpose? **Answer:** R1.
- **Manipulate:** apply each candidate and compare what each user sees against the legacy policy.
- **Explain:** the learner's own rationale, never scored (K2). ABAC is mentioned as the tag-based alternative
  with its stated requirements and Beta parts (F22, F24); it is not a candidate here.

## 6. On-screen wording

- **Disclaimer:** "A teaching simulation over a fictional estate. Nothing here calls Microsoft Entra ID, a
  Kerberos realm, Apache Ranger or Azure Databricks. Documented facts are from the linked pages, as checked on
  10 October 2026; everything else is labelled as a simulation assumption."
- **Fact labels:**
  - "From Microsoft Learn:" for S1–S5 and S7–S10;
  - "From the Apache Ranger wiki:" for S6;
  - "Simulation assumption:" for A1–A6.
- Each fact is shown with its text from section 3 and a link to its source.
