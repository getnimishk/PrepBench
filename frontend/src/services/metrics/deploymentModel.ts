import type {
  DeploymentResult,
  FlowResult,
  QualityResult,
  ScenarioParams,
} from '../../types/agileMetrics';

// The deployment model -- DORA's five metrics.
//
// READ THIS BEFORE CHANGING `deploys`.
//
// `deploys` is deliberately composed as:
//
//     plannedDeployments[n] + unplannedDeploymentsCarriedIn
//
// where the carry-in is the corrective deployment count produced by sprint
// n-1. That composition is the ONLY thing bounding `deploymentReworkRate` to
// 0..1: the numerator is literally a term of its own denominator, so the
// ratio cannot exceed 1 for any parameter values at all. There is no clamp,
// no min(), no cap anywhere in this file, and there must not be one.
//
// Simplifying the population to just `plannedDeployments` looks harmless and
// silently reintroduces rates above 100%. `invariants.test.ts` carries a
// mutation test that removes the carry-in term and asserts the bound test
// then FAILS -- if that mutation test ever starts passing, the bound has
// stopped being structural.
//
// Naming: `failedChangeDeployments`, never the older abbreviated form. A
// failed change deployment is not a production incident -- most are caught by
// a canary, a health check or a rollback and never impair service. The
// reliability model applies `deploymentIncidentRate` to make that crossing,
// and it is typed as an assumption because it is one. There is a lint test
// that fails on the short name anywhere under src/.

export function deploymentModel(
  p: ScenarioParams,
  flow: FlowResult,
  quality: QualityResult,
  unplannedDeploymentsCarriedIn: number,
): DeploymentResult {
  // COUNTING CONVENTION -- one delivered item and one corrective rework item
  // each map to one planned change event. Local to this sandbox; not an
  // industry definition, and the chart says so.
  const plannedDeployments = flow.deliveredItems + quality.reworkItems;

  // Do not simplify. See the header.
  const deploys = plannedDeployments + unplannedDeploymentsCarriedIn;

  // ARITHMETIC, bounded by construction. The only guard is division by zero.
  const deploymentReworkRate = deploys === 0 ? 0 : unplannedDeploymentsCarriedIn / deploys;

  // ASSUMPTION -- k2 is a pedagogical calibration parameter. The declared
  // parameter ranges keep this at or below 1 across the whole reachable
  // space (see params.ts); it is validated rather than clamped, so a range
  // change that breaks the domain fails loudly instead of silently capping.
  const changeFailRate = p.baseChangeFailRate * (1 + flow.batchSize * p.batchFailPressure);

  const failedChangeDeployments = deploys * changeFailRate;

  const deploymentFrequencyPerDay = p.sprintLengthDays > 0 ? deploys / p.sprintLengthDays : 0;

  // DORA's Change Lead Time is commit to production. Here that is the time
  // inside the work item (cycle time) plus the average wait for the next
  // batch to release -- half a batch interval. Bigger batches lengthen it
  // without anyone changing how fast the work itself goes, which is the
  // point worth seeing.
  const changeLeadTimeDays = flow.cycleTimeDays + flow.batchIntervalDays / 2;

  // ASSUMPTION -- k3, calibration only. `automation` and k3 both cap at 1, so
  // the multiplier bottoms out at exactly 0 and this clock never goes
  // negative. That is a property of the declared ranges, asserted in
  // params.test.ts, not of a clamp here.
  const failedDeploymentRecoveryHours = p.baseRecoveryHours * (1 - p.automation * p.automationRecoveryGain);

  return {
    plannedDeployments,
    deploys,
    deploymentFrequencyPerDay,
    changeLeadTimeDays,
    changeFailRate,
    failedChangeDeployments,
    failedDeploymentRecoveryHours,
    deploymentReworkRate,
  };
}
