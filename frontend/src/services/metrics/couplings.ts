// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { Coupling } from '../../types/agileMetrics';

// The coupling ledger, as data.
//
// This is not documentation. Every edge below is asserted against the running
// model in invariants.test.ts, and the UI reads `uiLabel` to put the caveat on
// the chart the edge feeds. An assumption that lives only in a design document
// is an assumption the learner will read as a fact.
//
// The `type` field is the whole point of the file:
//
//   arithmetic  follows from definitions. Cannot be wrong, only misapplied.
//   assumption  a behavioural claim this sandbox makes so the lesson lands.
//               NOT an identity. Must never be presented as one.
//   convention  a counting decision local to this sandbox. Not an industry
//               definition.
//
// Frozen composition: 9 arithmetic, 11 assumptions, 1 convention. Four edges
// carry lagSprints: 1. Those counts are asserted, so adding an edge without
// deciding which kind it is fails the suite rather than sliding in as
// arithmetic by default.
//
// Which charts each edge feeds is NOT declared here. charts.ts declares the
// forward direction (`ChartViewMeta.consumes`) and `chartsConsuming()` derives
// the reverse, so the relationship has exactly one source of truth. See the
// note on the `Coupling` interface for why the mirrored field was dropped.

export const COUPLINGS: Coupling[] = [
  // ---- Flow internal ------------------------------------------------------
  {
    id: 'littles-law',
    source: 'flow',
    target: 'flow',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'cycleTime = wip / deliveredItems * sprintLengthDays',
    description:
      "Little's Law. Cycle time is WIP over throughput -- an identity, not a " +
      'behavioural claim, which is why raising the WIP limit raises cycle time in ' +
      'exact proportion while delivery does not move. It is the single most ' +
      'misread relationship in this model, and it was absent from this ledger ' +
      'entirely until the cycle time card was caught explaining a WIP experiment ' +
      'with an incident assumption -- the only edge it declared.',
    uiLabel: "Little's Law: cycle time is WIP over throughput.",
    effect:
      'More WIP -> the same throughput -> each item waits longer -> a longer cycle time.',
  },

  {
    id: 'wip-across-states',
    source: 'flow',
    target: 'flow',
    type: 'assumption',
    calibrationParameter: 'constrainedStateCapacity',
    lagSprints: 0,
    formula:
      'stateOccupancy[d][s] = wip[d] * share(s), share from service rates and ' +
      'constrainedStateCapacity',
    description:
      'How work in progress DISTRIBUTES across workflow states. A behavioural ' +
      'claim, not an identity: the total is fixed by the flow model and this ' +
      'decides only where it sits. Slowing one state makes work pile up in it ' +
      'day by day, which is what a widening band on a cumulative flow diagram ' +
      'means. The states themselves are a sandbox convention -- Analysis, ' +
      'Build, Review is a conventional pipeline, not a claim about any team.',
    uiLabel: 'Model assumption: work distributes across states by their service rates.',
    effect:
      'A slower state -> work arrives faster than it leaves -> that band widens day by ' +
      'day while the others narrow.',
  },

  // ---- Flow -> Deployment -------------------------------------------------
  {
    id: 'items-to-changes',
    source: 'flow',
    target: 'deployment',
    type: 'convention',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'plannedDeployments = deliveredItems + reworkItems',
    description:
      'Sandbox counting convention: each delivered item and each corrective ' +
      'rework item is represented as one planned deployment or change event. ' +
      'Not an industry definition.',
    effect: "Items delivered or reworked -> one change event each -> the deployment count.",
    uiLabel: 'Sandbox counting convention: one item maps to one change event.',
  },

  // ---- Deployment internal ------------------------------------------------
  {
    id: 'deployment-population',
    source: 'deployment',
    target: 'deployment',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 1,
    formula: 'deploys[n] = plannedDeployments[n] + unplannedDeployments[n-1]',
    description:
      'Corrective deployments carried in from the previous sprint are ' +
      'deployments, so they are counted in the population the rework rate is ' +
      'measured against. This is what bounds deploymentReworkRate to 0..1 by ' +
      'construction -- the numerator is a term of its own denominator. No ' +
      'clamp is involved.',
    effect: "Last sprint's corrective deploys -> counted in this sprint's deployment total.",
    uiLabel: "Deployment rework is a subset of this sprint's deployments.",
  },
  {
    id: 'deployment-rework-rate',
    source: 'deployment',
    target: 'deployment',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 1,
    formula: 'deploymentReworkRate[n] = unplannedDeployments[n-1] / deploys[n]',
    description:
      "DORA's Deployment Rework Rate. Computed in the consume half of the " +
      'sprint, so its numerator is state produced by n-1 and never this ' +
      "sprint's own output.",
    effect: "Corrective deploys carried in from last sprint -> divided by this sprint's deploys.",
    uiLabel: 'Share of this sprint’s deployments that were corrective.',
  },
  {
    id: 'failed-change-deployments',
    source: 'deployment',
    target: 'deployment',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'failedChangeDeployments = deploys * changeFailRate',
    description:
      'A failed change deployment required immediate intervention. It is not ' +
      'yet a production incident -- that crossing is a separate, assumed edge.',
    effect: "More deployments at the same fail rate -> more failed deployments.",
    uiLabel: 'A failed change deployment is not the same thing as an incident.',
  },
  {
    id: 'batch-to-change-fail-rate',
    source: 'deployment',
    target: 'deployment',
    type: 'assumption',
    calibrationParameter: 'batchFailPressure',
    lagSprints: 0,
    formula: 'changeFailRate = baseChangeFailRate * (1 + batchSize * k2)',
    description:
      'Larger batches are assumed to fail more often: more change per ' +
      'release, less isolation of the cause. A teaching claim, not a measured ' +
      'relationship.',
    effect: "Higher WIP -> larger release batches -> a higher share of changes fail.",
    uiLabel: 'Model assumption: larger batches raise the change fail rate.',
  },
  {
    id: 'automation-to-recovery',
    source: 'deployment',
    target: 'deployment',
    type: 'assumption',
    calibrationParameter: 'automationRecoveryGain',
    lagSprints: 0,
    formula: 'failedDeploymentRecoveryHours = baseRecoveryHours * (1 - automation * k3)',
    description:
      'Automation is assumed to shorten recovery from a failed deployment. ' +
      "This is DORA's Failed Deployment Recovery Time, renamed from MTTR in " +
      '2024, and it is a different clock from incident duration.',
    effect: "More automation -> less manual work to restore -> a shorter recovery clock.",
    uiLabel: 'Model assumption: automation shortens failed deployment recovery.',
  },

  // ---- Deployment -> Reliability -----------------------------------------
  {
    id: 'deployment-to-reliability',
    source: 'deployment',
    target: 'reliability',
    type: 'assumption',
    calibrationParameter: 'deploymentIncidentRate',
    lagSprints: 0,
    formula: 'deploymentCausedIncidents = failedChangeDeployments * deploymentIncidentRate',
    description:
      'Only a proportion of failed change deployments become production ' +
      'incidents in this sandbox. Many are caught by a canary, a health check ' +
      'or a rollback and never impair service.',
    effect: "Failed deployments -> a proportion of them -> production incidents.",
    uiLabel:
      'Model assumption: only a proportion of failed change deployments become ' +
      'production incidents.',
  },

  // ---- Reliability internal ----------------------------------------------
  {
    id: 'incident-sources',
    source: 'reliability',
    target: 'reliability',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'incidentsPerSprint = deploymentCausedIncidents + externalIncidents',
    description:
      'Incidents have two sources and only one of them is this team’s ' +
      'deployments. With changeFailRate at zero and external incidents above ' +
      'zero, availability is still below 100%.',
    effect: "Incidents caused by our deployments -> plus incidents from everywhere else.",
    uiLabel: 'Not every incident comes from a deployment.',
  },
  {
    id: 'incident-downtime',
    source: 'reliability',
    target: 'reliability',
    type: 'assumption',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'downtime = incidentsPerSprint * incidentDuration',
    description:
      'Incidents are treated as non-overlapping for availability purposes, so ' +
      'downtime is the plain sum of incident durations. Real incidents overlap ' +
      'and real downtime is therefore lower than this sum. Sandbox ' +
      'simplification, not a production reliability identity.',
    effect: "More incidents, or longer ones -> more downtime in the sprint.",
    uiLabel: 'Model assumption: incidents are treated as non-overlapping.',
  },
  {
    id: 'availability',
    source: 'reliability',
    target: 'reliability',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'availability = 1 - downtime / period',
    description: 'Availability over the sprint, computed in hours throughout.',
    effect: "Downtime -> measured against the length of the sprint.",
    uiLabel: 'Availability is downtime against the measurement period.',
  },
  {
    id: 'error-budget-burn',
    source: 'reliability',
    target: 'reliability',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'errorBudgetBurn = (1 - availability) / (1 - slo)',
    description:
      'Share of the error budget consumed. Above 1 means the budget is blown, ' +
      'which is meaningful and deliberately not capped.',
    effect: "Availability below the SLO -> as a share of what the SLO allows you to spend.",
    uiLabel: 'Burn above 1 means the error budget is spent.',
  },

  // ---- Reliability -> Deployment (lagged) --------------------------------
  {
    id: 'incident-to-rework-deployments',
    source: 'reliability',
    target: 'deployment',
    type: 'assumption',
    calibrationParameter: 'reworkPerIncident',
    lagSprints: 1,
    formula: 'unplannedDeployments[n] = incidentsPerSprint[n] * reworkPerIncident',
    description:
      'A proportion of production incidents generate unplanned deployments to ' +
      'address user-facing defects. DORA scopes deployment rework to ' +
      'user-facing bugs, so an infrastructure or upstream incident may produce ' +
      'operational work and no deployment at all. reworkPerIncident is the ' +
      'calibrated average across incidents, not a claim that every incident ' +
      'yields a deployment.',
    effect: "Incidents -> unplanned corrective deploys -> landing in the next sprint.",
    uiLabel:
      'Model assumption: a proportion of production incidents generate unplanned ' +
      'deployments to address user-facing defects.',
  },

  // ---- Reliability -> Flow (lagged) --------------------------------------
  {
    id: 'incident-to-capacity',
    source: 'reliability',
    target: 'flow',
    type: 'assumption',
    calibrationParameter: 'incidentCostDays',
    lagSprints: 1,
    formula: 'incidentLoad[n] = incidentsPerSprint[n] * incidentCostDays',
    description:
      'Handling an incident costs capacity, and that cost lands in the next ' +
      "sprint's unplanned work rather than the sprint that was already in " +
      'flight when the incident happened.',
    effect: "Incidents -> less capacity next sprint -> fewer items delivered -> this chart. The effect is indirect: nothing here is caused by an incident directly.",
    uiLabel: 'Model assumption: incidents cost capacity in the following sprint.',
  },

  // ---- Quality internal ---------------------------------------------------
  {
    id: 'defect-rate',
    source: 'quality',
    target: 'quality',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'defectRate = defectsInjected / deliveredItems',
    description: 'Defects per delivered item.',
    effect: "Defects injected -> divided by items delivered.",
    uiLabel: 'Defects per item delivered.',
  },
  {
    id: 'defect-density',
    source: 'quality',
    target: 'quality',
    type: 'arithmetic',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'defectDensity = defectsInjected / deliveredPoints',
    description:
      'Density against delivered SIZE rather than delivered count. Reported ' +
      'separately from the rate precisely because the denominator is points ' +
      'and not items -- measure both against items and they are the same ' +
      'number twice.',
    effect: "Defects injected -> divided by POINTS delivered, not items.",
    uiLabel: 'Density is per point of work shipped, not per item.',
  },

  // ---- Flow -> Quality ----------------------------------------------------
  {
    id: 'wip-to-defect-injection',
    source: 'flow',
    target: 'quality',
    type: 'assumption',
    calibrationParameter: 'wipDefectPressure',
    lagSprints: 0,
    formula: 'defectRate = baseDefectRate * (1 + wipPressure * k1)',
    description:
      'High WIP is assumed to raise defect injection: more context switching, ' +
      'longer feedback delay. A teaching claim, not a measured relationship.',
    effect: "Higher WIP -> more context switching and slower feedback -> more defects injected.",
    uiLabel: 'Model assumption: high WIP raises defect injection.',
  },

  // ---- Quality -> Flow ----------------------------------------------------
  {
    id: 'rework-consumes-capacity',
    source: 'quality',
    target: 'flow',
    type: 'assumption',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'netNewItems = deliveredItems - reworkItems',
    description:
      'Rework is real work that produced no new value, so it is subtracted ' +
      'from delivery to give net new items. Computed as a quality output ' +
      'rather than fed back into flow, which would make the two mutually ' +
      'dependent inside a single sprint with no well-founded evaluation order.',
    effect: "Defects caught inside the sprint -> rework -> delivery that produced nothing new.",
    uiLabel: 'Model assumption: rework occupies capacity that produced no new value.',
  },

  // ---- Team health --------------------------------------------------------
  {
    id: 'load-to-overload',
    source: 'flow',
    target: 'team',
    type: 'assumption',
    calibrationParameter: null,
    lagSprints: 0,
    formula: 'overload = (capacityPressure + wipPressure) / 2',
    description:
      'Sustained load is assumed to come from two places: capacity eaten by ' +
      'unplanned work, and WIP held above what the team can flow.',
    effect: "Unplanned work and WIP above what the team can flow -> sustained load.",
    uiLabel: 'Model assumption: unplanned work and excess WIP both read as overload.',
  },
  {
    id: 'overload-to-happiness',
    source: 'team',
    target: 'team',
    type: 'assumption',
    calibrationParameter: 'overloadHappinessDecay',
    lagSprints: 0,
    formula: 'happiness = baseHappiness - overload * k4',
    description:
      'Happiness is a survey reading, not a derived work-item metric. ' +
      'Modelling it as a deterministic function of load is a teaching ' +
      'simplification and nothing more.',
    effect: "More sustained load -> lower modelled happiness.",
    uiLabel: 'Model assumption: happiness is modelled, not surveyed.',
  },
];

export const COUPLING_BY_ID = new Map(COUPLINGS.map((c) => [c.id, c]));

export function couplingsOfType(type: Coupling['type']): Coupling[] {
  return COUPLINGS.filter((c) => c.type === type);
}

/** The edges whose state crosses a sprint boundary. */
export function laggedCouplings(): Coupling[] {
  return COUPLINGS.filter((c) => c.lagSprints === 1);
}
