import type { ChartViewId, ChartViewMeta, FamilyId, TierId } from '../../types/agileMetrics';

// The chart inventory: 27 views, 6 families, 2 tiers, 4 renderers.
//
// Two things this file is careful about, both of which the design got burned
// on before it was frozen:
//
// 1. `externalAnalogues` names resemblances, never equivalences. Our
//    cycle-time distribution is not Jira's Control Chart -- the Control Chart
//    plots a rolling average, ours plots the distribution. Writing "also
//    known as" would assert an equality that is false, and an interview
//    answer built on it falls over the moment someone who uses Jira daily
//    hears it.
//
// 2. `provenance` records where the METRIC CONCEPT came from, not who draws
//    it. Exactly one view in this inventory is `ours`, and that is Sprint
//    goal achievement, for which no standard chart exists. Everything else
//    has a lineage, and claiming otherwise is how "Deployment rework rate"
//    was nearly shipped as an invention of this sandbox when it is DORA's
//    fifth metric.
//
// Family and tier are what the navigation reads: never more than one family
// on screen, Core first, the engineering extension reachable but secondary.

export const CHART_VIEWS: ChartViewMeta[] = [
  // ======================= CORE / FLOW (P0) ================================
  {
    id: 'throughput',
    canonicalName: 'Throughput',
    externalAnalogues: ['Throughput Run Chart'],
    primitive: 'line',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'kanban-flow',
    consumes: ['incident-to-capacity', 'rework-consumes-capacity'],
    stage: 'what',
  },
  {
    id: 'cycleTime',
    canonicalName: 'Cycle time',
    externalAnalogues: ['Cycle Time Run Chart'],
    primitive: 'line',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'kanban-flow',
    consumes: ['littles-law', 'incident-to-capacity'],
    stage: 'what',
  },
  {
    id: 'cycleTimeDistribution',
    canonicalName: 'Cycle-time distribution',
    externalAnalogues: ['Jira Control Chart', 'ActionableAgile Cycle Time Scatterplot'],
    primitive: 'scatter',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'jira',
    consumes: ['littles-law', 'incident-to-capacity'],
    stage: 'where',
  },
  {
    id: 'deliveryLeadTime',
    canonicalName: 'Delivery lead time',
    externalAnalogues: ['Jira Control Chart', 'Jira Resolution Time Report'],
    primitive: 'line',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'lean-flow',
    consumes: ['littles-law', 'incident-to-capacity'],
    stage: 'why',
  },
  {
    id: 'flowEfficiency',
    canonicalName: 'Flow efficiency',
    externalAnalogues: ['Flow Efficiency'],
    primitive: 'line',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'lean-flow',
    consumes: ['littles-law', 'incident-to-capacity'],
    stage: 'why',
  },
  {
    id: 'cumulativeFlow',
    canonicalName: 'Cumulative flow',
    externalAnalogues: ['Jira Cumulative Flow Diagram'],
    primitive: 'stackedArea',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'jira',
    consumes: ['wip-across-states', 'incident-to-capacity'],
    stage: 'why',
    // The one chart here whose lesson IS the geometry: WIP is the thickness
    // of a band and cycle time is the horizontal distance between two
    // curves. Neither survives being drawn a third of a row wide.
    emphasis: 'wide',
  },
  {
    id: 'agingWip',
    canonicalName: 'Aging WIP',
    externalAnalogues: ['Jira Average Age Report (related, not equivalent)'],
    primitive: 'scatter',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'kanban-flow',
    consumes: ['incident-to-capacity'],
    stage: 'where',
  },
  {
    id: 'wipOverTime',
    canonicalName: 'WIP over time',
    externalAnalogues: ['WIP Run Chart'],
    primitive: 'line',
    family: 'flow',
    tier: 'core',
    phase: 'P0',
    provenance: 'kanban-flow',
    consumes: [],
    stage: 'what',
  },

  // =================== CORE / PREDICTABILITY (P0) ==========================
  {
    id: 'burndown',
    canonicalName: 'Burndown',
    externalAnalogues: ['Jira Burndown Chart'],
    primitive: 'line',
    family: 'predictability',
    tier: 'core',
    phase: 'P0',
    provenance: 'jira',
    consumes: ['incident-to-capacity'],
    stage: 'why',
  },
  {
    id: 'burnup',
    canonicalName: 'Burnup',
    externalAnalogues: ['Jira Burnup Chart'],
    primitive: 'line',
    family: 'predictability',
    tier: 'core',
    phase: 'P0',
    provenance: 'jira',
    consumes: ['incident-to-capacity'],
    stage: 'why',
  },
  {
    id: 'velocity',
    canonicalName: 'Velocity',
    externalAnalogues: ['Jira Velocity Chart'],
    primitive: 'bar',
    family: 'predictability',
    tier: 'core',
    phase: 'P0',
    provenance: 'jira',
    consumes: ['incident-to-capacity', 'rework-consumes-capacity'],
    stage: 'what',
  },
  {
    id: 'sayDoRatio',
    canonicalName: 'Say/do ratio',
    externalAnalogues: ['Predictability (Jira Align)', 'Commitment Reliability'],
    primitive: 'line',
    family: 'predictability',
    tier: 'core',
    phase: 'P0',
    provenance: 'jira-align',
    consumes: ['incident-to-capacity'],
    stage: 'where',
  },
  {
    id: 'sprintGoal',
    canonicalName: 'Sprint goal achievement',
    // The one genuinely `ours` view in the inventory. No standard chart
    // exists, which is itself the teaching point: the outcome Scrum cares
    // about most is the one no tool draws for you.
    externalAnalogues: [],
    primitive: 'bar',
    family: 'predictability',
    tier: 'core',
    phase: 'P0',
    provenance: 'ours',
    consumes: ['incident-to-capacity'],
    stage: 'what',
  },

  // ====================== CORE / QUALITY (mixed) ===========================
  {
    id: 'defectRate',
    canonicalName: 'Defect rate',
    externalAnalogues: ['Jira Created vs Resolved Work Items'],
    primitive: 'line',
    family: 'quality',
    tier: 'core',
    phase: 'P0',
    provenance: 'qa',
    consumes: ['wip-to-defect-injection', 'defect-rate'],
    stage: 'what',
  },
  {
    id: 'escapedDefects',
    canonicalName: 'Escaped defects',
    externalAnalogues: ['Defect Escape Rate'],
    primitive: 'line',
    family: 'quality',
    tier: 'core',
    phase: 'P0',
    provenance: 'qa',
    consumes: ['wip-to-defect-injection'],
    stage: 'what',
  },
  {
    id: 'defectDensity',
    canonicalName: 'Defect density',
    externalAnalogues: ['Defect Density'],
    primitive: 'line',
    family: 'quality',
    tier: 'core',
    phase: 'P2',
    provenance: 'qa',
    consumes: ['wip-to-defect-injection', 'defect-density'],
    stage: 'why',
  },

  // ==================== CORE / TEAM HEALTH (P0) ============================
  {
    id: 'teamHappiness',
    canonicalName: 'Team happiness',
    externalAnalogues: ['Happiness Metric'],
    primitive: 'line',
    family: 'teamHealth',
    tier: 'core',
    phase: 'P0',
    provenance: 'scrum-practice',
    consumes: ['load-to-overload', 'overload-to-happiness'],
    stage: 'what',
  },
  {
    id: 'unplannedWorkShare',
    canonicalName: 'Unplanned work share',
    externalAnalogues: ['Unplanned Work'],
    primitive: 'line',
    family: 'teamHealth',
    tier: 'core',
    phase: 'P0',
    provenance: 'devops-literature',
    consumes: ['incident-to-capacity', 'load-to-overload'],
    stage: 'why',
  },

  // ============= ENGINEERING EXTENSION / DORA (P1, whole family) ===========
  {
    id: 'deploymentFrequency',
    canonicalName: 'Deployment frequency',
    externalAnalogues: ['Deployment Frequency'],
    primitive: 'bar',
    family: 'dora',
    tier: 'engineeringExtension',
    phase: 'P1',
    provenance: 'dora',
    consumes: ['items-to-changes', 'deployment-population'],
    stage: 'what',
  },
  {
    id: 'changeLeadTime',
    canonicalName: 'Change lead time',
    externalAnalogues: ['Lead Time for Changes'],
    primitive: 'line',
    family: 'dora',
    tier: 'engineeringExtension',
    phase: 'P1',
    provenance: 'dora',
    consumes: ['items-to-changes'],
    stage: 'why',
  },
  {
    id: 'changeFailRate',
    canonicalName: 'Change fail rate',
    externalAnalogues: ['Change Fail Rate'],
    primitive: 'line',
    family: 'dora',
    tier: 'engineeringExtension',
    phase: 'P1',
    provenance: 'dora',
    consumes: ['batch-to-change-fail-rate', 'failed-change-deployments', 'items-to-changes'],
    stage: 'what',
  },
  {
    id: 'failedDeploymentRecoveryTime',
    canonicalName: 'Failed deployment recovery time',
    // Renamed by DORA in 2024. The old name is carried here precisely so a
    // learner who only ever heard it can find the current one -- and it is
    // marked as legacy so nobody reads it as current.
    externalAnalogues: ['formerly MTTR (legacy name)', 'Time to Restore Service'],
    primitive: 'line',
    family: 'dora',
    tier: 'engineeringExtension',
    phase: 'P1',
    provenance: 'dora',
    consumes: ['automation-to-recovery'],
    stage: 'why',
  },
  {
    id: 'deploymentReworkRate',
    canonicalName: 'Deployment rework rate',
    externalAnalogues: ['Deployment Rework Rate (DORA metric 5)'],
    primitive: 'line',
    family: 'dora',
    tier: 'engineeringExtension',
    phase: 'P1',
    provenance: 'dora',
    consumes: [
      'deployment-population',
      'deployment-rework-rate',
      'incident-to-rework-deployments',
    ],
    stage: 'where',
  },

  // ============ ENGINEERING EXTENSION / RELIABILITY (P2) ===================
  {
    id: 'incidentsPerSprint',
    canonicalName: 'Incidents per sprint',
    externalAnalogues: ['Incident count / frequency (denominator varies by tool)'],
    primitive: 'bar',
    family: 'reliability',
    tier: 'engineeringExtension',
    phase: 'P2',
    provenance: 'ops-tooling',
    consumes: ['deployment-to-reliability', 'incident-sources'],
    stage: 'what',
  },
  {
    id: 'incidentDuration',
    canonicalName: 'Incident duration',
    externalAnalogues: ['Time to restore service (operational sense)'],
    primitive: 'line',
    family: 'reliability',
    tier: 'engineeringExtension',
    phase: 'P2',
    provenance: 'ops-tooling',
    consumes: [],
    stage: 'why',
  },
  {
    id: 'availabilityVsSlo',
    canonicalName: 'Availability vs SLO',
    externalAnalogues: ['SLO attainment'],
    primitive: 'line',
    family: 'reliability',
    tier: 'engineeringExtension',
    phase: 'P2',
    provenance: 'sre',
    consumes: ['incident-downtime', 'availability', 'deployment-to-reliability', 'incident-sources'],
    stage: 'what',
  },
  {
    id: 'errorBudgetBurn',
    canonicalName: 'Error budget burn',
    externalAnalogues: ['Error Budget Burn Rate'],
    primitive: 'line',
    family: 'reliability',
    tier: 'engineeringExtension',
    phase: 'P2',
    provenance: 'sre',
    consumes: ['error-budget-burn', 'incident-downtime', 'availability'],
    stage: 'where',
  },
];

export const CHART_BY_ID = new Map<ChartViewId, ChartViewMeta>(
  CHART_VIEWS.map((c) => [c.id, c]),
);

export interface FamilyMeta {
  id: FamilyId;
  label: string;
  tier: TierId;
  /** One line explaining what this family is for, shown under the tab. */
  blurb: string;
}

/** Display order. Core first -- the engineering extension is secondary. */
export const FAMILIES: FamilyMeta[] = [
  {
    id: 'flow',
    label: 'Flow',
    tier: 'core',
    blurb: 'How work moves: how much, how fast, and how much of that time was actually work.',
  },
  {
    id: 'predictability',
    label: 'Predictability',
    tier: 'core',
    blurb: 'What the team said it would do, against what it did.',
  },
  {
    id: 'quality',
    label: 'Quality',
    tier: 'core',
    blurb: 'What the delivery charts do not show you: what shipped broken.',
  },
  {
    id: 'teamHealth',
    label: 'Team health',
    tier: 'core',
    blurb: 'The cost that shows up in a survey before it shows up in a burndown.',
  },
  {
    id: 'dora',
    label: 'DORA',
    tier: 'engineeringExtension',
    blurb: 'All five delivery metrics, including the two most people forget.',
  },
  {
    id: 'reliability',
    label: 'Reliability',
    tier: 'engineeringExtension',
    blurb: 'What happens after the deploy, and who pays for it next sprint.',
  },
];

export function chartsInFamily(family: FamilyId): ChartViewMeta[] {
  return CHART_VIEWS.filter((c) => c.family === family);
}

export function familiesInTier(tier: TierId): FamilyMeta[] {
  return FAMILIES.filter((f) => f.tier === tier);
}

/**
 * The reverse of `ChartViewMeta.consumes` -- every view that a given ledger
 * edge feeds.
 *
 * Derived rather than declared. The design sketched a mirrored
 * `affectedCharts` array on `Coupling`, and two hand-maintained directions of
 * one relationship drift silently: an edge claiming a chart that does not
 * claim it back puts a caveat on a view that never uses it. Deriving means
 * the completeness test has one thing to check instead of two things to
 * reconcile.
 */
export function chartsConsuming(couplingId: string): ChartViewMeta[] {
  return CHART_VIEWS.filter((c) => c.consumes.includes(couplingId));
}
