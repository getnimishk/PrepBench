// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// Station I's model (P1-5): identity at cutover, and a Ranger policy redesigned for Unity Catalog.
// Pure and deterministic: no fetch, no clock, no randomness. Every outcome carries the claim ids that
// decide it (identitySources.ts), and the station shows those claims, not wording of its own.
// The design is section 5 of docs/research/lakehouse-p1-5-identity-governance-research.md.

import type { ShellOption } from '../../components/lakehouse/StationShell';
import { IDENTITY_CLAIMS, type ClaimId } from './identitySources';
import type { LabChallengeRef } from './attempts';

// ---- identity -------------------------------------------------------------------------------

export type WorkloadId = 'yield-etl' | 'tool-feed' | 'report-refresh' | 'lot-sync';
export type PlanId = 'entra-app' | 'system-mi' | 'databricks-sp' | 'rehost-user-mi';
export const PLAN_IDS: PlanId[] = ['entra-app', 'system-mi', 'databricks-sp', 'rehost-user-mi'];

export const PLAN_LABEL: Record<PlanId, string> = {
  'entra-app': 'Entra app registration with a client secret, assigned to the workspace',
  'system-mi': 'Enable a system-assigned managed identity',
  'databricks-sp': 'Databricks-managed service principal with an OAuth secret',
  'rehost-user-mi': 'Re-host on an Azure virtual machine with a user-assigned managed identity, assigned to the workspace',
};

export interface Workload {
  id: WorkloadId;
  name: string;
  /** Where it runs today, by fictional host (A1). */
  host: string;
  onPremises: boolean;
  /** Today's authentication, scenario only (A2). */
  today: string;
  plan: PlanId;
}

export const WORKLOADS: Workload[] = [
  { id: 'yield-etl', name: 'svc-yield-etl', host: 'edge01.hadoop.fab.example', onPremises: true, today: 'Keytab in HADOOP.FAB.EXAMPLE', plan: 'entra-app' },
  { id: 'tool-feed', name: 'svc-tool-feed', host: 'toolgw01.corp.fab.example', onPremises: true, today: 'Domain account in CORP.FAB.EXAMPLE', plan: 'system-mi' },
  { id: 'report-refresh', name: 'svc-report-refresh', host: 'sched02.corp.fab.example', onPremises: true, today: 'Domain account in CORP.FAB.EXAMPLE', plan: 'databricks-sp' },
  { id: 'lot-sync', name: 'svc-lot-sync', host: 'An Azure virtual machine (re-hosted)', onPremises: false, today: 'Keytab in HADOOP.FAB.EXAMPLE', plan: 'rehost-user-mi' },
];

export type TokenIssuer = 'entra' | 'databricks' | 'none';

export const ISSUER_LABEL: Record<TokenIssuer, string> = {
  entra: 'Token from Microsoft Entra ID',
  databricks: 'Token from Azure Databricks',
  none: 'No token',
};

export interface PlanResult {
  works: boolean;
  issuer: TokenIssuer;
  /** The claims that decide it, shown with the result. */
  claimIds: ClaimId[];
}

/** Whether a workload can authenticate to the workspace under a plan, and who would issue its token. */
export function evaluatePlan(workload: Pick<Workload, 'onPremises'>, plan: PlanId): PlanResult {
  switch (plan) {
    case 'entra-app':
      return { works: true, issuer: 'entra', claimIds: ['F1', 'F3', 'F8'] };
    case 'databricks-sp':
      return { works: true, issuer: 'databricks', claimIds: ['F11', 'F12'] };
    case 'rehost-user-mi':
      // Re-hosting puts the workload on Azure compute, where a managed identity can be assigned.
      return { works: true, issuer: 'entra', claimIds: ['F5', 'F6', 'F10'] };
    case 'system-mi':
      return workload.onPremises
        ? { works: false, issuer: 'none', claimIds: ['F5', 'F7'] }
        : { works: true, issuer: 'entra', claimIds: ['F5', 'F6', 'F10'] };
  }
}

/** Every workload under its cutover plan, or under a plan the learner tries instead. */
export function evaluateEstate(overrides: Partial<Record<WorkloadId, PlanId>> = {}) {
  return WORKLOADS.map((workload) => {
    const plan = overrides[workload.id] ?? workload.plan;
    return { workload, plan, result: evaluatePlan(workload, plan) };
  });
}

export interface StationIChallenge<T extends string> extends LabChallengeRef {
  title: string;
  prompt: string;
  options: (ShellOption & { id: T })[];
  answer: T;
}

const onlyFailing = evaluateEstate().filter((r) => !r.result.works);
if (onlyFailing.length !== 1) throw new Error('Station I: the identity puzzle must have exactly one failing plan.');

export const IDENTITY_CHALLENGE: StationIChallenge<WorkloadId> = {
  id: 'lakehouse.i.identity-cutover',
  conceptId: 'lakehouse.i.identity-cutover',
  title: 'Identity at cutover',
  prompt: 'After cutover, each workload must authenticate to the Azure Databricks workspace. Whose cutover plan leaves it unable to?',
  options: WORKLOADS.map((w) => ({ id: w.id, text: w.name })),
  answer: onlyFailing[0].workload.id,
};

// ---- governance -----------------------------------------------------------------------------

export type GroupId = 'national_mgmt' | 'midwest_sales' | 'compliance_audit';
export interface TestUser { id: string; groups: GroupId[] }

export const TEST_USERS: TestUser[] = [
  { id: 'ana', groups: ['national_mgmt'] },
  { id: 'ben', groups: ['midwest_sales'] },
  { id: 'cara', groups: ['national_mgmt', 'compliance_audit'] },
  { id: 'dev', groups: [] },
];

export const MIDWEST_STATES = ['IL', 'IN', 'MI', 'OH', 'WI'];

/** Invented rows (A5). The identity numbers start 000, a range no real person has. */
export const ORDERS = [
  { order_id: 'o-1001', customer_state: 'IL', ssn: '000-12-0041', order_total: 182.4 },
  { order_id: 'o-1002', customer_state: 'OH', ssn: '000-12-0157', order_total: 96.0 },
  { order_id: 'o-1003', customer_state: 'TX', ssn: '000-12-0233', order_total: 410.75 },
  { order_id: 'o-1004', customer_state: 'CA', ssn: '000-12-0318', order_total: 58.2 },
  { order_id: 'o-1005', customer_state: 'WI', ssn: '000-12-0466', order_total: 240.0 },
  { order_id: 'o-1006', customer_state: 'NY', ssn: '000-12-0592', order_total: 133.1 },
];

export type SsnView = 'full' | 'last-four' | 'none';
export interface UserView { rows: number; ssn: SsnView }

const regionalRows = ORDERS.filter((o) => MIDWEST_STATES.includes(o.customer_state)).length;
const seen = (rows: number, ssn: Exclude<SsnView, 'none'>): UserView => (rows === 0 ? { rows: 0, ssn: 'none' } : { rows, ssn });

/** The legacy Ranger policy as written in the scenario, read in item order: the first match wins (F13). */
export const RANGER_ROW_ITEMS: { group: GroupId | 'public'; filter: string }[] = [
  { group: 'national_mgmt', filter: '' }, // empty: no restriction (F14)
  { group: 'midwest_sales', filter: `customer_state IN (${MIDWEST_STATES.map((s) => `'${s}'`).join(',')})` },
  { group: 'public', filter: '1 = 0' }, // every other user: no rows (A4)
];
export const RANGER_MASK_ITEMS: { group: GroupId | 'public'; mask: string }[] = [
  { group: 'compliance_audit', mask: 'Unmasked' },
  { group: 'public', mask: "Custom: concat('***-**-', substr({col}, 8, 4))" },
];

const inGroup = (u: TestUser, g: GroupId | 'public') => g === 'public' || u.groups.includes(g);

export function legacyView(user: TestUser): UserView {
  const rowItem = RANGER_ROW_ITEMS.find((i) => inGroup(user, i.group))!;
  const rows = rowItem.filter === '' ? ORDERS.length : rowItem.filter === '1 = 0' ? 0 : regionalRows;
  const maskItem = RANGER_MASK_ITEMS.find((i) => inGroup(user, i.group))!;
  return seen(rows, maskItem.mask === 'Unmasked' ? 'full' : 'last-four');
}

export type RedesignId = 'r1' | 'r2' | 'r3' | 'r4';

export interface Redesign {
  id: RedesignId;
  title: string;
  sql: string;
  claimIds: ClaimId[];
}

const FILTER_BODY = `IF(IS_ACCOUNT_GROUP_MEMBER('national_mgmt'), TRUE,
   IS_ACCOUNT_GROUP_MEMBER('midwest_sales') AND state IN ('IL','IN','MI','OH','WI'))`;
const MASK_SQL = `CREATE FUNCTION retail.mask_ssn(ssn STRING)
RETURN IF(IS_ACCOUNT_GROUP_MEMBER('compliance_audit'), ssn, CONCAT('***-**-', RIGHT(ssn, 4)));
ALTER TABLE retail.customer_orders ALTER COLUMN ssn SET MASK retail.mask_ssn;`;

export const REDESIGNS: Redesign[] = [
  {
    id: 'r1',
    title: 'A row filter function and a column mask function on the table',
    sql: `CREATE FUNCTION retail.region_filter(state STRING)
RETURN ${FILTER_BODY};
ALTER TABLE retail.customer_orders SET ROW FILTER retail.region_filter ON (customer_state);
${MASK_SQL}`,
    claimIds: ['F16', 'F17', 'F18', 'F20'],
  },
  {
    id: 'r2',
    title: 'A dynamic view that checks groups with is_member()',
    sql: `CREATE VIEW retail.v_customer_orders AS
SELECT order_id, customer_state,
  CASE WHEN is_member('compliance_audit') THEN ssn ELSE CONCAT('***-**-', RIGHT(ssn, 4)) END AS ssn,
  order_total
FROM retail.customer_orders
WHERE CASE WHEN is_member('national_mgmt') THEN TRUE
           WHEN is_member('midwest_sales') THEN customer_state IN ('IL','IN','MI','OH','WI')
           ELSE FALSE END;`,
    claimIds: ['F20', 'F21', 'A3'],
  },
  {
    id: 'r3',
    title: 'An ABAC DENY policy to hide other states’ rows',
    sql: `-- A DENY policy on the table for midwest_sales,
-- meant to hide every row outside the five states.`,
    claimIds: ['F23'],
  },
  {
    id: 'r4',
    title: 'The same row filter and mask, with the filter’s parameter declared INT',
    sql: `CREATE FUNCTION retail.region_filter(state INT)
RETURN ${FILTER_BODY};
ALTER TABLE retail.customer_orders SET ROW FILTER retail.region_filter ON (customer_state);
${MASK_SQL}`,
    claimIds: ['F19'],
  },
];

/** What a user sees under a redesign: the model's reading of the fact each one keeps or breaks (A6). */
export function redesignView(id: RedesignId, user: TestUser): UserView {
  const masked: Exclude<SsnView, 'none'> = user.groups.includes('compliance_audit') ? 'full' : 'last-four';
  switch (id) {
    case 'r1':
      return seen(user.groups.includes('national_mgmt') ? ORDERS.length : user.groups.includes('midwest_sales') ? regionalRows : 0, masked);
    case 'r2':
      // is_member() checks workspace-level groups; these are account-level (F20, A3): no test passes.
      return seen(0, 'last-four');
    case 'r3':
      // A DENY policy denies a privilege, not rows (F23): nothing filters or masks.
      return seen(ORDERS.length, 'full');
    case 'r4':
      // The STRING state cast to INT is NULL with ANSI off (F19): the regional comparison never holds.
      return seen(user.groups.includes('national_mgmt') ? ORDERS.length : 0, masked);
  }
}

export const keepsPurpose = (id: RedesignId): boolean =>
  TEST_USERS.every((u) => {
    const a = legacyView(u);
    const b = redesignView(id, u);
    return a.rows === b.rows && a.ssn === b.ssn;
  });

const keeping = REDESIGNS.filter((r) => keepsPurpose(r.id));
if (keeping.length !== 1) throw new Error('Station I: exactly one redesign must keep the policy’s purpose.');

export const GOVERNANCE_CHALLENGE: StationIChallenge<RedesignId> = {
  id: 'lakehouse.i.governance-redesign',
  conceptId: 'lakehouse.i.governance-redesign',
  title: 'A Ranger policy, redesigned',
  prompt: 'Which redesign keeps the legacy policy’s purpose: the same rows and the same masking for every user?',
  options: REDESIGNS.map((r) => ({ id: r.id, text: r.title })),
  answer: keeping[0].id,
};

/** Every claim id the model reasons with: each must exist in the register. */
export function usedClaimIds(): ClaimId[] {
  const ids = new Set<ClaimId>();
  for (const plan of PLAN_IDS) for (const onPremises of [true, false]) evaluatePlan({ onPremises }, plan).claimIds.forEach((c) => ids.add(c));
  REDESIGNS.forEach((r) => r.claimIds.forEach((c) => ids.add(c)));
  return [...ids];
}

/** The claims a puzzle shows: its own facts and assumptions, never the conventions. */
export const claimsFor = (topic: 'identity' | 'governance') =>
  IDENTITY_CLAIMS.filter((c) => c.kind !== 'convention' && (c.topic === topic || c.topic === 'both'));

export const STATION_I_TITLES: Record<string, string> = {
  [IDENTITY_CHALLENGE.id]: IDENTITY_CHALLENGE.title,
  [GOVERNANCE_CHALLENGE.id]: GOVERNANCE_CHALLENGE.title,
};
