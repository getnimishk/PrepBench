import type { CarriedState, ScenarioParams, SprintResult } from '../../types/agileMetrics';
import { assertParams } from './params';
import { flowModel } from './flowModel';
import { qualityModel } from './qualityModel';
import { deploymentModel } from './deploymentModel';
import { reliabilityModel } from './reliabilityModel';
import { teamModel } from './teamModel';

// The sprint loop, and the one-sprint lag.
//
// The structure below is load-bearing, not stylistic. Each iteration has two
// halves separated by a hard line:
//
//   CONSUME -- reads only `carriedIn`, which was produced no later than
//              sprint n-1. Nothing in this half reads anything computed in
//              this half's own future.
//   PRODUCE -- writes `carriedOut`, which is read by nothing above it, in
//              this sprint or any earlier one. It is consumed by n+1 only.
//
// That separation is what makes the model well-founded: no sprint reads its
// own outputs, so the loop terminates by construction and sprint 1 is always
// the undisturbed case. Divergence from the no-feedback baseline can only
// begin at sprint 2, and there is a test asserting exactly that.
//
// Three pieces of state cross the sprint boundary, all with lag 1:
//   incidentLoadDays       reliability(n)  -> flow(n+1)      capacity lost
//   unplannedDeployments   reliability(n)  -> deployment(n+1) corrective deploys
//   (both are seeded to zero at sprint 0)
//
// Moving `deploymentReworkRate` out of the consume half would break the
// bound: its numerator is the carry-in, and the moment that numerator is
// this sprint's own output the rate stops describing a population it belongs
// to. Rev 6 had that bug and it produced rates above 1.

const SEED: CarriedState = { unplannedDeployments: 0, incidentLoadDays: 0 };

/**
 * Sprint-to-sprint capacity swing, as multiples of `capacityVariation`.
 *
 * WHY THIS EXISTS. With constant parameters the incident loop is a
 * contraction mapping: it converges to a fixed point within three or four
 * sprints and every sprint after that is identical. Mathematically correct,
 * pedagogically useless -- Velocity, Say/do ratio and Sprint goal all draw
 * flat lines, and a flat velocity chart cannot teach anything about
 * variability, which is the entire reason those three charts exist.
 *
 * WHY IT IS NOT RANDOM. Same parameters must always give the same charts, so
 * a learner can change one control and attribute what moved to that control.
 * `Math.random()` would destroy that. This is a fixed profile indexed by
 * sprint number: deterministic, reproducible, and diffable.
 *
 * PROPERTIES THAT ARE LOAD-BEARING, not incidental:
 *  - It sums to EXACTLY ZERO, so the profile itself adds no bias. Teaching
 *    variability must not quietly teach that a variable team delivers less.
 *  - Seven entries, a prime, so the cycle does not line up with 6-, 8- or
 *    12-sprint runs and read as an artificial sawtooth.
 *
 * The REALISED mean drifts down by a percent or two as variation rises. That
 * is an EMERGENT CONSEQUENCE of the model, not a defect in the profile and
 * not something to correct for. Delivery is capped at the commitment, so a
 * good sprint cannot bank its surplus while a bad one still loses its
 * shortfall -- the upside is clipped and the downside is not. Variability
 * against a ceiling costs throughput, which is a real queueing result and one
 * of the more useful things this chart can show a learner.
 *
 * The tests therefore assert the profile's own sum is zero AND, separately,
 * that the realised mean stays close to the steady state. Two different
 * claims, deliberately not conflated: the first is a property of the profile,
 * the second is a property of the system it drives.
 *
 * WHAT IT IS NOT. It is not an empirical distribution of real team capacity,
 * and no figure here is estimated from data. It is a teaching pattern chosen
 * so the effect is legible, exactly like the k-coefficients -- and like them,
 * it must never be cited as a finding.
 */
export const SPRINT_CAPACITY_PROFILE = [-0.5, 0.5, -1, 1, 0, -0.75, 0.75];

/**
 * This sprint's capacity multiplier. Exported so the profile's zero-mean and
 * determinism properties can be asserted directly rather than inferred from
 * chart output.
 */
export function capacityFactorForSprint(p: ScenarioParams, sprint: number): number {
  const step = SPRINT_CAPACITY_PROFILE[(sprint - 1) % SPRINT_CAPACITY_PROFILE.length];
  return 1 + p.capacityVariation * step;
}

/**
 * Runs the scenario and returns one result per sprint.
 *
 * Throws if `p` is outside the declared parameter ranges or domains -- a
 * meaningless input produces a loud failure rather than a plausible chart.
 */
export function simulate(p: ScenarioParams): SprintResult[] {
  assertParams(p);

  const results: SprintResult[] = [];
  let carried: CarriedState = SEED;

  for (let n = 1; n <= p.sprints; n++) {
    const carriedIn = carried;

    // ---- CONSUME state produced no later than n-1 -----------------------
    const unplannedWorkDays = p.baseUnplannedDays + carriedIn.incidentLoadDays;

    // The sprint loop is the only place that knows about sprint ordering, so
    // it is the only place that can read the capacity profile. flowModel
    // stays memoryless.
    const flow = flowModel(p, unplannedWorkDays, capacityFactorForSprint(p, n));
    const quality = qualityModel(p, flow);
    const deployment = deploymentModel(p, flow, quality, carriedIn.unplannedDeployments);
    const reliability = reliabilityModel(p, deployment);
    const team = teamModel(p, flow);

    // ---- PRODUCE state consumed only by sprint n+1 ----------------------
    // Nothing below is read anywhere above, in this sprint or any earlier one.
    const carriedOut: CarriedState = {
      // ASSUMPTION -- a proportion of production incidents generate unplanned
      // deployments addressing user-facing defects. Not every incident does:
      // an infrastructure or upstream outage may generate operational work
      // and no deployment at all. `reworkPerIncident` is the calibrated
      // average across incidents, not a claim about each one.
      unplannedDeployments: reliability.incidentsPerSprint * p.reworkPerIncident,
      incidentLoadDays: reliability.incidentsPerSprint * p.incidentCostDays,
    };

    results.push({ sprint: n, flow, quality, deployment, reliability, team, carriedIn, carriedOut });
    carried = carriedOut;
  }

  return results;
}

/**
 * The deployment population, as its own named function.
 *
 * Exported so the mutation test can state the alternative it is guarding
 * against. Removing `unplannedDeploymentsCarriedIn` from this sum is the
 * "simplification" that silently reintroduces rework rates above 100%, and
 * the test asserts that the alternative composition really does break the
 * bound -- proving the bound comes from this line and not from luck.
 */
export function deploymentPopulation(
  plannedDeployments: number,
  unplannedDeploymentsCarriedIn: number,
): number {
  return plannedDeployments + unplannedDeploymentsCarriedIn;
}
