import type { ModelId, ScenarioParams } from '../../types/agileMetrics';

// Parameter ranges and their validation.
//
// This file exists because several formulas in the frozen design are
// *pedagogical calibration assumptions* rather than identities, and a
// calibration assumption is only meaningful over a stated domain. Two of them
// go somewhere useless if you feed them anything:
//
//   changeFailRate = baseChangeFailRate * (1 + batchSize * k2)
//       -- unbounded above; a large enough batch drives it past 100%, which
//          is not a fail rate at all.
//   recoveryHours  = baseRecoveryHours * (1 - automation * k3)
//       -- goes negative once automation * k3 exceeds 1, i.e. recovering a
//          failed deployment before it fails.
//
// The fix follows the same principle Revision 8 used for the rework rate:
// make the property structural rather than clamped. The declared ranges below
// are chosen so that NO reachable combination leaves the domain, and
// params.test.ts sweeps the corners of the reachable space to prove it. The
// clamps that would otherwise be needed do not exist anywhere in this model.
//
// validateParams is therefore a programming-error detector, not a runtime
// safety net: if it ever reports anything from UI-driven input, a range in
// this table and a formula somewhere else have drifted apart.

export interface ParamSpec {
  key: keyof ScenarioParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  model: ModelId | 'simulation';
  /**
   * A pedagogical calibration parameter -- chosen so the effect is legible
   * across its range. NOT an empirically estimated industry constant, and it
   * must never be cited as one. The UI labels every exposed one as
   * "Calibration / teaching parameter".
   */
  calibration: boolean;
  /**
   * Exposed as a slider. The calibration coefficients are deliberately not:
   * surfacing them invites reading them as findings.
   */
  exposed: boolean;
}

export const PARAM_SPECS: ParamSpec[] = [
  // ---- Flow ---------------------------------------------------------------
  { key: 'sprintLengthDays', label: 'Sprint length', min: 5, max: 20, step: 1, unit: 'days', model: 'flow', calibration: false, exposed: true },
  { key: 'throughput', label: 'Capacity', min: 1, max: 20, step: 1, unit: 'items/sprint', model: 'flow', calibration: false, exposed: true },
  { key: 'wip', label: 'WIP limit', min: 1, max: 20, step: 1, unit: 'items', model: 'flow', calibration: false, exposed: true },
  { key: 'baseUnplannedDays', label: 'Baseline unplanned work', min: 0, max: 5, step: 0.5, unit: 'days/sprint', model: 'flow', calibration: false, exposed: true },
  // A scenario control, not a calibration coefficient: it describes the team
  // being simulated rather than tuning a relationship between two metrics.
  // That is why it gets a slider while k1..k4 do not.
  { key: 'capacityVariation', label: 'Capacity variation', min: 0, max: 0.2, step: 0.01, unit: 'share', model: 'flow', calibration: false, exposed: true },

  // ---- Quality ------------------------------------------------------------
  { key: 'baseDefectRate', label: 'Baseline defect rate', min: 0, max: 0.5, step: 0.01, unit: 'defects/item', model: 'quality', calibration: false, exposed: true },
  { key: 'escapeRate', label: 'Escape rate', min: 0, max: 1, step: 0.01, unit: 'share', model: 'quality', calibration: false, exposed: true },
  // Scenario shape, not a calibration coefficient: it describes how the team
  // sizes its work. Density needs it as a denominator distinct from items.
  { key: 'avgPointsPerItem', label: 'Average item size', min: 1, max: 13, step: 1, unit: 'points/item', model: 'quality', calibration: false, exposed: true },
  { key: 'wipDefectPressure', label: 'k1 - WIP pressure to defect injection', min: 0, max: 1, step: 0.05, unit: '', model: 'quality', calibration: true, exposed: false },

  // ---- Deployment ---------------------------------------------------------
  // baseChangeFailRate max 0.25 and k2 max 0.15 are not independent choices.
  // With wip max 20 (and batchSize <= wip) the worst reachable corner is
  // 0.25 * (1 + 20 * 0.15) = 1.00 exactly. Raising either one alone puts a
  // change fail rate above 100% inside the reachable space.
  { key: 'baseChangeFailRate', label: 'Baseline change fail rate', min: 0, max: 0.25, step: 0.01, unit: 'share', model: 'deployment', calibration: false, exposed: true },
  { key: 'batchFailPressure', label: 'k2 - batch size to change fail rate', min: 0, max: 0.15, step: 0.01, unit: '', model: 'deployment', calibration: true, exposed: false },
  { key: 'baseRecoveryHours', label: 'Failed deployment recovery time', min: 0, max: 72, step: 1, unit: 'hours', model: 'deployment', calibration: false, exposed: true },
  { key: 'automation', label: 'Deployment automation', min: 0, max: 1, step: 0.05, unit: 'share', model: 'deployment', calibration: false, exposed: true },
  // automation and k3 both cap at 1, so (1 - automation * k3) bottoms out at
  // exactly 0. Recovery time reaches zero and never goes negative.
  { key: 'automationRecoveryGain', label: 'k3 - automation to recovery time', min: 0, max: 1, step: 0.05, unit: '', model: 'deployment', calibration: true, exposed: false },

  // ---- Reliability --------------------------------------------------------
  { key: 'externalIncidentsPerSprint', label: 'External incidents', min: 0, max: 10, step: 0.5, unit: 'incidents/sprint', model: 'reliability', calibration: false, exposed: true },
  { key: 'incidentDurationHours', label: 'Incident duration', min: 0, max: 48, step: 1, unit: 'hours', model: 'reliability', calibration: false, exposed: true },
  { key: 'deploymentIncidentRate', label: 'Failed deployments becoming incidents', min: 0, max: 1, step: 0.05, unit: 'share', model: 'reliability', calibration: true, exposed: false },
  { key: 'reworkPerIncident', label: 'Unplanned deployments per incident', min: 0, max: 3, step: 0.1, unit: 'deploys/incident', model: 'reliability', calibration: true, exposed: false },
  { key: 'incidentCostDays', label: 'Capacity lost per incident', min: 0, max: 2, step: 0.1, unit: 'days/incident', model: 'reliability', calibration: true, exposed: false },
  { key: 'slo', label: 'Availability SLO', min: 0.9, max: 0.9999, step: 0.001, unit: 'share', model: 'reliability', calibration: false, exposed: true },

  // ---- Team health --------------------------------------------------------
  { key: 'baseHappiness', label: 'Baseline happiness', min: 1, max: 5, step: 0.1, unit: '/5', model: 'team', calibration: false, exposed: true },
  { key: 'overloadHappinessDecay', label: 'k4 - overload to happiness decay', min: 0, max: 4, step: 0.1, unit: '', model: 'team', calibration: true, exposed: false },

  // ---- Simulation ---------------------------------------------------------
  { key: 'sprints', label: 'Sprints', min: 1, max: 24, step: 1, unit: '', model: 'simulation', calibration: false, exposed: true },
];

const SPEC_BY_KEY = new Map<keyof ScenarioParams, ParamSpec>(
  PARAM_SPECS.map((s) => [s.key, s]),
);

export function paramSpec(key: keyof ScenarioParams): ParamSpec {
  const spec = SPEC_BY_KEY.get(key);
  if (!spec) throw new Error(`No ParamSpec declared for "${key}"`);
  return spec;
}

export type ViolationKind = 'range' | 'domain';

export interface ParamViolation {
  kind: ViolationKind;
  /** The parameter at fault, or the derived value that would go meaningless. */
  subject: string;
  message: string;
}

/**
 * Reports every way `p` would make a derived value meaningless.
 *
 * Range violations mean a value is outside its declared slider bounds. Domain
 * violations mean the values are each individually legal but combine to push
 * a calibration formula out of the region where its output means anything --
 * a change fail rate above 100%, a negative recovery clock, unplanned work
 * exceeding the sprint it is drawn from.
 *
 * An empty result is a precondition of simulate(), not a suggestion.
 */
export function validateParams(p: ScenarioParams): ParamViolation[] {
  const violations: ParamViolation[] = [];

  for (const spec of PARAM_SPECS) {
    const value = p[spec.key];
    if (!Number.isFinite(value)) {
      violations.push({
        kind: 'range',
        subject: spec.key,
        message: `${spec.label} must be a finite number, got ${value}.`,
      });
      continue;
    }
    if (value < spec.min || value > spec.max) {
      violations.push({
        kind: 'range',
        subject: spec.key,
        message: `${spec.label} must be within ${spec.min}..${spec.max} ${spec.unit}, got ${value}.`,
      });
    }
  }

  // A change fail rate is a share of deployments. Above 1 it is not a rate,
  // and every DORA figure downstream of it inherits the nonsense.
  const worstChangeFailRate = p.baseChangeFailRate * (1 + p.wip * p.batchFailPressure);
  if (worstChangeFailRate > 1) {
    violations.push({
      kind: 'domain',
      subject: 'changeFailRate',
      message:
        `baseChangeFailRate ${p.baseChangeFailRate} with k2 ${p.batchFailPressure} at WIP ${p.wip} ` +
        `yields a change fail rate of ${worstChangeFailRate.toFixed(3)}, above 100%. ` +
        `The calibration formula is only meaningful while this stays at or below 1.`,
    });
  }

  // Recovery time is a clock. Negative means the failed deployment recovered
  // before it failed.
  if (p.automation * p.automationRecoveryGain > 1) {
    violations.push({
      kind: 'domain',
      subject: 'failedDeploymentRecoveryHours',
      message:
        `automation ${p.automation} with k3 ${p.automationRecoveryGain} drives the recovery ` +
        `multiplier below zero, giving a negative recovery time.`,
    });
  }

  // Unplanned work is drawn from the sprint's own capacity, so it cannot
  // exceed the sprint.
  if (p.baseUnplannedDays > p.sprintLengthDays) {
    violations.push({
      kind: 'domain',
      subject: 'baseUnplannedDays',
      message:
        `Baseline unplanned work ${p.baseUnplannedDays} days exceeds the ${p.sprintLengthDays}-day sprint ` +
        `it is drawn from.`,
    });
  }

  return violations;
}

/** Throws unless `p` is inside every declared range and domain. */
export function assertParams(p: ScenarioParams): void {
  const violations = validateParams(p);
  if (violations.length === 0) return;
  throw new Error(
    'Invalid scenario parameters:\n' +
      violations.map((v) => `  [${v.kind}] ${v.subject}: ${v.message}`).join('\n'),
  );
}

/**
 * A balanced starting scenario. Deliberately not at any extreme -- the
 * sandbox teaches by showing what moves when you move one control, which
 * needs headroom in both directions.
 */
export const DEFAULT_PARAMS: ScenarioParams = {
  sprintLengthDays: 10,
  throughput: 12,
  wip: 4,
  baseUnplannedDays: 1,
  capacityVariation: 0.1,

  baseDefectRate: 0.15,
  escapeRate: 0.25,
  avgPointsPerItem: 3,
  wipDefectPressure: 0.6,

  baseChangeFailRate: 0.1,
  batchFailPressure: 0.05,
  baseRecoveryHours: 8,
  automation: 0.5,
  automationRecoveryGain: 0.7,

  externalIncidentsPerSprint: 0.5,
  incidentDurationHours: 4,
  deploymentIncidentRate: 0.4,
  reworkPerIncident: 0.8,
  incidentCostDays: 0.5,
  slo: 0.99,

  baseHappiness: 4,
  overloadHappinessDecay: 2,

  sprints: 12,
};
