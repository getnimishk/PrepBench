// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// Station I's register of what it may say, as data (P1-5). The approved research is
// docs/research/lakehouse-p1-5-identity-governance-research.md (revision 2); this file holds the same
// sources and claims, and identityModel.test.ts holds the two together.
//
//   fact        stated by the cited page, as read on CHECKED_ON. Shown with a link to it.
//   assumption  a choice this simulation makes so the lesson lands. Never presented as true of a real
//               system: the screen labels it "Simulation assumption".
//   convention  a choice local to this station (ids, grading). Not shown as content.
//
// Anything the station says about Entra ID, Azure Databricks, Apache Ranger or Unity Catalog is one of the
// facts below. A fact that isn't here is not added in the code: it goes through the research file first.

export const CHECKED_ON = '2026-10-10';

/** Hosts a fact's source may live on: official documentation only. */
export const ALLOWED_SOURCE_HOSTS = ['learn.microsoft.com', 'docs.databricks.com', 'ranger.apache.org', 'cwiki.apache.org'];

export type SourceId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10';

export interface IdentitySource {
  id: SourceId;
  title: string;
  url: string;
  publisher: 'Microsoft Learn' | 'Apache Ranger wiki';
  checkedOn: string;
}

const ms = (id: SourceId, title: string, url: string): IdentitySource => ({ id, title, url, publisher: 'Microsoft Learn', checkedOn: CHECKED_ON });

export const IDENTITY_SOURCES: IdentitySource[] = [
  ms('S1', 'Apps & service principals in Microsoft Entra ID', 'https://learn.microsoft.com/en-us/entra/identity-platform/app-objects-and-service-principals'),
  ms('S2', 'Managed identities for Azure resources', 'https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview'),
  ms('S3', 'Authenticate with Microsoft Entra service principals (Azure Databricks)', 'https://learn.microsoft.com/en-us/azure/databricks/dev-tools/auth/azure-sp'),
  ms('S4', 'Use Azure managed identities with Azure Databricks', 'https://learn.microsoft.com/en-us/azure/databricks/dev-tools/auth/azure-mi-auth'),
  ms('S5', 'Authorize service principal access to Azure Databricks with OAuth', 'https://learn.microsoft.com/en-us/azure/databricks/dev-tools/auth/oauth-m2m'),
  {
    id: 'S6',
    title: 'Row-level filtering and column-masking using Apache Ranger policies in Apache Hive',
    url: 'https://cwiki.apache.org/confluence/display/RANGER/Row-level+filtering+and+column-masking+using+Apache+Ranger+policies+in+Apache+Hive',
    publisher: 'Apache Ranger wiki',
    checkedOn: CHECKED_ON,
  },
  ms('S7', 'Manually apply row filters and column masks', 'https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/filters-and-masks/manually-apply'),
  ms('S8', 'Create a dynamic view', 'https://learn.microsoft.com/en-us/azure/databricks/views/dynamic'),
  ms('S9', 'Attribute-based access control in Unity Catalog', 'https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/abac/'),
  ms('S10', 'Requirements, quotas, and limitations for row filter and column mask policies', 'https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/abac/requirements'),
];

export type ClaimId =
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'F10' | 'F11' | 'F12'
  | 'F13' | 'F14' | 'F15' | 'F16' | 'F17' | 'F18' | 'F19' | 'F20' | 'F21' | 'F22' | 'F23' | 'F24'
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'K1' | 'K2';

export type ClaimKind = 'fact' | 'assumption' | 'convention';

export interface IdentityClaim {
  id: ClaimId;
  kind: ClaimKind;
  /** Shown on screen, as written: the station adds no technical wording of its own. */
  text: string;
  sourceIds: SourceId[];
  /** Which puzzle the claim belongs to, so each shows only its own. */
  topic: 'identity' | 'governance' | 'both';
}

const fact = (id: ClaimId, topic: IdentityClaim['topic'], sourceIds: SourceId[], text: string): IdentityClaim => ({ id, kind: 'fact', topic, sourceIds, text });
const assume = (id: ClaimId, topic: IdentityClaim['topic'], text: string): IdentityClaim => ({ id, kind: 'assumption', topic, sourceIds: [], text });

export const IDENTITY_CLAIMS: IdentityClaim[] = [
  // ---- identity ------------------------------------------------------------------------------
  fact('F1', 'identity', ['S1'], 'To reach resources secured by an Entra tenant, an application must be represented by a service principal.'),
  fact('F2', 'identity', ['S1'], 'There are three types of service principal: application, managed identity and legacy.'),
  fact('F3', 'identity', ['S1'], 'Registering an application creates an application object and a service principal in the home tenant, and secrets or certificates can be added to it.'),
  fact('F4', 'identity', ['S1'], 'A service principal that represents a managed identity has no application object.'),
  fact('F5', 'identity', ['S2'], 'A managed identity is assigned to an Azure compute resource, such as a virtual machine, or to an app hosting platform Azure supports.'),
  fact('F6', 'identity', ['S2'], 'Applications use a managed identity to get Entra tokens without managing any credentials.'),
  fact('F7', 'identity', ['S2'], 'Only the Azure resource a system-assigned managed identity was enabled on can use it to request tokens.'),
  fact('F8', 'identity', ['S3'], 'A Microsoft Entra service principal authenticates to Azure Databricks with its tenant ID, client ID and client secret, and Databricks recommends assigning it to the workspace.'),
  fact('F9', 'identity', ['S3'], 'Databricks recommends OAuth M2M in most cases, and Entra service principal authentication only when a workload must authenticate to Azure Databricks and other Azure resources at the same time.'),
  fact('F10', 'identity', ['S4'], 'Managed identity authentication to Azure Databricks gets Entra ID tokens, and Databricks treats the managed identity as a service principal assigned to the account or workspace.'),
  fact('F11', 'identity', ['S5'], 'A Databricks-managed service principal using OAuth M2M gets its access token from the Databricks token endpoint, not from the identity provider’s or cloud’s endpoint.'),
  fact('F12', 'identity', ['S5'], 'An OAuth secret is valid for at most 730 days, and each access token for one hour.'),
  // ---- governance ----------------------------------------------------------------------------
  fact('F13', 'governance', ['S6'], 'Each item of a Ranger row-filter policy carries a filter expression, and Ranger evaluates the items in the order they are listed.'),
  fact('F14', 'governance', ['S6'], 'In Ranger, an empty row-filter expression means no row restriction.'),
  fact('F15', 'governance', ['S6'], 'Ranger masking includes showing only the last four characters, nullifying, an unmasked option, and custom expressions in which {col} stands for the column.'),
  fact('F16', 'governance', ['S7'], 'A Unity Catalog row filter is a SQL function returning a boolean, applied with ALTER TABLE … SET ROW FILTER … ON (…); a table has at most one row filter.'),
  fact('F17', 'governance', ['S7'], 'A Unity Catalog column mask is a SQL function returning the type of its first parameter, applied with ALTER TABLE … ALTER COLUMN … SET MASK.'),
  fact('F18', 'governance', ['S7'], 'Row filters run with the definer’s rights, except functions that check who is asking, such as SESSION_USER and IS_ACCOUNT_GROUP_MEMBER, which run as the person querying.'),
  fact('F19', 'governance', ['S7'], 'When a column’s type differs from the function’s parameter type, the value is cast; with ANSI mode off, values that cannot be cast become NULL silently, which can give wrong results without an error.'),
  fact('F20', 'governance', ['S8'], 'is_account_group_member() checks account-level groups and is the one recommended for Unity Catalog data; is_member() checks workspace-level groups only.'),
  fact('F21', 'governance', ['S8'], 'Databricks recommends not granting users read access to the tables a dynamic view reads from.'),
  fact('F22', 'governance', ['S9'], 'ABAC row-filter and column-mask policies attach to a catalog, schema or table and find their data through governed tags; attaching one at metastore level is Beta as of 10 October 2026.'),
  fact('F23', 'governance', ['S9'], 'ABAC DENY policies, Beta as of 10 October 2026, deny the MANAGE ACCESS CONTROL privilege; they do not filter rows.'),
  fact('F24', 'governance', ['S10'], 'ABAC policies need serverless compute or Databricks Runtime 16.4 or above; ABAC on views is Beta as of 10 October 2026 and needs Runtime 19 or above.'),
  // ---- assumptions -----------------------------------------------------------------------------
  assume('A1', 'identity', 'The estate is fictional: realms CORP.FAB.EXAMPLE and HADOOP.FAB.EXAMPLE, hosts under fab.example, one unnamed Entra tenant, four workloads and their cutover plans.'),
  assume('A2', 'identity', 'Today each workload authenticates with Kerberos. This station makes no claim about Kerberos itself; it judges only the cutover plans.'),
  assume('A3', 'governance', 'The scenario’s groups are account-level groups.'),
  assume('A4', 'governance', 'Users in neither regional group must see no rows. The Ranger page does not say what an unmatched user sees, so the legacy policy states it as a last item for the group public with the filter 1 = 0; here public means every user.'),
  assume('A5', 'governance', 'The table retail.customer_orders and its rows are invented; its identity numbers are in a range no real person has.'),
  assume('A6', 'governance', 'How each wrong redesign plays out on the sample rows is this model’s reading of the fact it breaks, not a captured run.'),
  // ---- conventions -----------------------------------------------------------------------------
  { id: 'K1', kind: 'convention', topic: 'both', sourceIds: [], text: 'Challenge ids: lakehouse.i.identity-cutover and lakehouse.i.governance-redesign.' },
  { id: 'K2', kind: 'convention', topic: 'both', sourceIds: [], text: 'The prediction is checked against the model; the learner’s criteria and rationale are their explanation and are never scored.' },
];

const BY_ID = new Map(IDENTITY_CLAIMS.map((c) => [c.id, c]));
export const claimById = (id: string): IdentityClaim | undefined => BY_ID.get(id as ClaimId);
export const sourceById = (id: SourceId): IdentitySource => IDENTITY_SOURCES.find((s) => s.id === id)!;

/** How a claim is introduced on screen: who says it. */
export function claimLabel(c: IdentityClaim): string {
  if (c.kind === 'assumption') return 'Simulation assumption';
  const publishers = new Set(c.sourceIds.map((s) => sourceById(s).publisher));
  return publishers.has('Apache Ranger wiki') ? 'From the Apache Ranger wiki' : 'From Microsoft Learn';
}
