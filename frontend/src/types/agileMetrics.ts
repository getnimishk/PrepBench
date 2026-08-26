// Types for the Chart Sandbox model layer.
//
// Implements the design frozen at Revision 8. Two properties matter more than
// anything else in this file, and both are asserted in
// services/metrics/invariants.test.ts rather than trusted:
//
//   1. `deploymentReworkRate` is bounded 0..1 BY CONSTRUCTION. The numerator
//      is a term of its own denominator, so no clamp is involved. Anyone who
//      "simplifies" the `deploys[n]` composition breaks the bound -- there is
//      a mutation test whose job is to fail when they do.
//   2. No sprint reads its own outputs. Every cross-sprint transfer lags
//      exactly one sprint, so sprint 1 is always the undisturbed case.
//
// Unit convention: days for capacity and lead times, hours for incident and
// recovery clocks. Availability is computed entirely in hours -- mixing the
// two is the obvious way to get a plausible-looking but wrong number here.

export type ModelId = 'flow' | 'quality' | 'deployment' | 'reliability' | 'team';

/**
 * How a coupling earns its formula.
 *
 *  - `arithmetic`  follows from definitions; cannot be wrong, only misapplied.
 *  - `assumption`  a behavioural claim this sandbox makes for teaching. It is
 *                  not an identity and must never be presented as one.
 *  - `convention`  a counting decision local to this sandbox, not an industry
 *                  definition.
 */
export type CouplingType = 'arithmetic' | 'assumption' | 'convention';

export interface ScenarioParams {
  // ---- Flow -------------------------------------------------------------
  sprintLengthDays: number;
  /** Items per sprint the team can finish with a full sprint of capacity. */
  throughput: number;
  /** Items in flight. A control on cycle time and batch size -- never on
   *  throughput. Raising it cannot make the team deliver more. */
  wip: number;
  /** Days per sprint lost to unplanned work at baseline, before any incident
   *  load carried in from the previous sprint. */
  baseUnplannedDays: number;
  /**
   * Sprint-to-sprint swing in available capacity, as a share. Zero gives a
   * perfectly steady team.
   *
   * Real capacity is never identical two sprints running -- holidays,
   * onboarding, a support rota, an interview loop. Without some swing the
   * model converges to a fixed point and Velocity, Say/do and Sprint goal all
   * draw flat lines, which cannot teach variability at all.
   *
   * Applied from a FIXED, ZERO-MEAN profile, not a random draw: same
   * parameters and same sprint always produce the same number. See
   * SPRINT_CAPACITY_PROFILE in compose.ts.
   *
   * It carries no coupling-ledger edge, and the reason is categorical rather
   * than an oversight. The ledger records RELATIONSHIPS BETWEEN MODELS -- a
   * claim that moving one metric moves another, which is the kind of claim a
   * learner needs warned about. This is a scenario-shape parameter: it
   * describes the team being simulated, the way sprint length or capacity
   * does. It asserts nothing about how two metrics relate, so there is
   * nothing for a callout to caveat.
   *
   * That it is exogenous to the ledger is a property it shares with
   * `externalIncidentsPerSprint`, but the two are not the same kind of thing
   * and should not be described as equivalent: that one injects a reliability
   * event the team did not cause, this one shapes the capacity curve itself.
   */
  capacityVariation: number;

  // ---- Quality ----------------------------------------------------------
  baseDefectRate: number;
  /** Share of injected defects that reach production rather than being caught
   *  inside the sprint. */
  escapeRate: number;
  /**
   * Average story points per work item.
   *
   * Exists so defect DENSITY has a denominator of its own. Rate is defects
   * per item, density is defects per point -- measure both against items and
   * they are algebraically the same number, which is what this model did
   * until the duplicate-series check caught it.
   */
  avgPointsPerItem: number;
  /** k1 -- WIP pressure to defect injection. Calibration only. */
  wipDefectPressure: number;

  // ---- Deployment -------------------------------------------------------
  baseChangeFailRate: number;
  /** k2 -- batch size to change fail rate. Calibration only. */
  batchFailPressure: number;
  /** DORA's Failed Deployment Recovery Time, before any automation gain. */
  baseRecoveryHours: number;
  automation: number;
  /** k3 -- automation to recovery time. Calibration only. */
  automationRecoveryGain: number;

  // ---- Reliability ------------------------------------------------------
  /** Incidents per sprint from infrastructure, upstream services or load --
   *  nothing this team deployed. A control, so availability can fall while
   *  change fail rate is zero. */
  externalIncidentsPerSprint: number;
  incidentDurationHours: number;
  /** Proportion of failed change deployments that become production
   *  incidents. Calibration only, and deliberately not a slider. */
  deploymentIncidentRate: number;
  /** Unplanned deployments addressing a user-facing defect, per production
   *  incident. Not every incident produces one. Calibration only. */
  reworkPerIncident: number;
  /** Capacity lost next sprint per production incident. Calibration only. */
  incidentCostDays: number;
  slo: number;

  // ---- Team health ------------------------------------------------------
  baseHappiness: number;
  /** k4 -- sustained overload to happiness decay. Calibration only. */
  overloadHappinessDecay: number;

  // ---- Simulation -------------------------------------------------------
  sprints: number;
}

export interface FlowResult {
  /** Realised throughput. Independent of `wip` by construction. */
  deliveredItems: number;
  /** Items that complete together. Drives burndown shape and, through k2,
   *  change fail rate. */
  batchSize: number;
  /** Delivery sized in story points. The denominator defect density uses. */
  deliveredPoints: number;
  cycleTimeDays: number;
  deliveryLeadTimeDays: number;
  flowEfficiency: number;
  /** Even spacing between batch releases. Drives change lead time, so it is
   *  computed once here rather than re-derived in the deployment model where
   *  the two copies would quietly drift apart. */
  batchIntervalDays: number;
  /** wip / (wip + throughput). Bounded 0..1 by construction, so every
   *  coefficient multiplied by it stays in a meaningful range without a
   *  clamp. Consumed by the quality and team models. */
  wipPressure: number;
  unplannedWorkDays: number;
  availableCapacityFraction: number;
  /** Remaining work, indexed day 0..sprintLengthDays inclusive. */
  burndown: number[];
  /** Completed work, same indexing. burndown[d] + burnup[d] === committed. */
  burnup: number[];
  /** CFD started band. `started[d] - burnup[d]` is WIP while work remains. */
  started: number[];
  committedItems: number;
}

export interface QualityResult {
  defectRate: number;
  defectsInjected: number;
  /** Caught inside the sprint. Becomes planned corrective change events. */
  reworkItems: number;
  /** Reached production. Never becomes a planned deployment. */
  escapedDefects: number;
  defectDensity: number;
  /** Delivery net of the rework tax. Rework is real work the team did, so it
   *  occupies capacity that produced no new value -- `deliveredItems` is
   *  gross and this is what actually moved forward. Kept as a quality output
   *  rather than fed back into the flow model, which would make flow and
   *  quality mutually dependent inside a single sprint. */
  netNewItems: number;
}

/**
 * The twenty-seven views, as a closed union. Spelled out rather than derived
 * from the chart table so a typo in an `id` or in a `consumes` entry is a
 * compile error instead of a chart that silently never renders.
 */
export type ChartViewId =
  // Flow
  | 'throughput' | 'cycleTime' | 'cycleTimeDistribution' | 'deliveryLeadTime'
  | 'flowEfficiency' | 'cumulativeFlow' | 'agingWip' | 'wipOverTime'
  // Predictability
  | 'burndown' | 'burnup' | 'velocity' | 'sayDoRatio' | 'sprintGoal'
  // Quality
  | 'defectRate' | 'escapedDefects' | 'defectDensity'
  // Team health
  | 'teamHappiness' | 'unplannedWorkShare'
  // DORA
  | 'deploymentFrequency' | 'changeLeadTime' | 'changeFailRate'
  | 'failedDeploymentRecoveryTime' | 'deploymentReworkRate'
  // Reliability
  | 'incidentsPerSprint' | 'incidentDuration' | 'availabilityVsSlo' | 'errorBudgetBurn';

/**
 * The four renderers. Named after primitives, not after charts: a burndown
 * and a burnup are not two components, they are one line renderer given
 * different series. Four cover all twenty-seven views.
 */
export type ChartPrimitive = 'line' | 'bar' | 'stackedArea' | 'scatter';

export type FamilyId = 'flow' | 'predictability' | 'quality' | 'teamHealth' | 'dora' | 'reliability';

/**
 * Core is what this sandbox is primarily for. The engineering extension is
 * the deployment and operations picture, and it is reachable but secondary --
 * never more than one family on screen.
 */
export type TierId = 'core' | 'engineeringExtension';

export type Phase = 'P0' | 'P1' | 'P2';

/**
 * Where the metric CONCEPT comes from -- not which tool draws it. The named
 * tools live in `externalAnalogues`.
 *
 * Wider than the union sketched in the design, because the design's own
 * provenance table uses values the sketch omitted (lean flow, devops
 * literature, ops tooling). Collapsing those into `ours` would claim this
 * sandbox invented Unplanned Work and Flow Efficiency, which is exactly the
 * false-attribution the provenance table exists to prevent.
 */
export type Provenance =
  | 'jira'
  | 'jira-align'
  | 'kanban-flow'
  | 'lean-flow'
  | 'qa'
  | 'scrum-practice'
  | 'devops-literature'
  | 'dora'
  | 'ops-tooling'
  | 'sre'
  | 'ours';

export interface ChartViewMeta {
  id: ChartViewId;
  /** What THIS sandbox calls it. */
  canonicalName: string;
  /**
   * Named reports and tools that resemble this view. Analogues, NOT claims of
   * equivalence -- our cycle-time distribution is not Jira's Control Chart,
   * and saying "also known as" would assert that it is.
   */
  externalAnalogues: string[];
  primitive: ChartPrimitive;
  family: FamilyId;
  tier: TierId;
  phase: Phase;
  provenance: Provenance;
  /**
   * Ledger edges this view depends on. Drives the on-chart callouts: an
   * assumption listed here reaches the learner, and one listed nowhere does
   * not exist as far as they are concerned.
   */
  consumes: string[];
}

export interface Coupling {
  id: string;
  source: ModelId;
  target: ModelId;
  type: CouplingType;
  /** Names the coefficient, if any, so the UI callout can say WHICH one is in
   *  play -- and so the completeness test can check every calibrated edge
   *  declares it. Otherwise someone reading this in six months treats
   *  `deploymentIncidentRate` as a measured industry figure. */
  calibrationParameter: string | null;
  /** 1 = produced by sprint n, consumed by n+1. */
  lagSprints: 0 | 1;
  formula: string;
  description: string;
  /** Shown on every chart the edge feeds. An assumption that never reaches a
   *  callout is an assumption the learner will read as a fact. */
  uiLabel: string;
}

// The design sketched an `affectedCharts: ChartViewId[]` field here, mirroring
// `ChartViewMeta.consumes`. It is deliberately NOT implemented as a field.
//
// Two hand-maintained directions of one relationship drift, and the drift is
// silent: an edge that lists a chart the chart does not list back produces a
// callout on a view that never uses it, which is worse than no callout at all.
// `chartsConsuming()` in charts.ts derives the reverse direction from
// `consumes`, so there is one source of truth and the completeness test has
// something real to check.

export interface DeploymentResult {
  /** deliveredItems + reworkItems. A counting convention, not a definition. */
  plannedDeployments: number;
  /** plannedDeployments[n] + unplannedDeployments[n-1]. This composition is
   *  what bounds the rework rate. Do not simplify it. */
  deploys: number;
  deploymentFrequencyPerDay: number;
  changeLeadTimeDays: number;
  changeFailRate: number;
  failedChangeDeployments: number;
  failedDeploymentRecoveryHours: number;
  /** unplannedDeployments[n-1] / deploys[n]. Bounded 0..1 structurally. */
  deploymentReworkRate: number;
}

export interface ReliabilityResult {
  deploymentCausedIncidents: number;
  externalIncidents: number;
  incidentsPerSprint: number;
  downtimeHours: number;
  availability: number;
  errorBudgetBurn: number;
}

export interface TeamResult {
  happiness: number;
  overload: number;
}

/** State produced by sprint n and consumed only by sprint n+1. */
export interface CarriedState {
  unplannedDeployments: number;
  incidentLoadDays: number;
}

export interface SprintResult {
  sprint: number;
  flow: FlowResult;
  quality: QualityResult;
  deployment: DeploymentResult;
  reliability: ReliabilityResult;
  team: TeamResult;
  /** What this sprint consumed from n-1. Exposed so the lag is inspectable
   *  in tests and in the UI, instead of being an invisible implementation
   *  detail nobody can check. */
  carriedIn: CarriedState;
  carriedOut: CarriedState;
}
