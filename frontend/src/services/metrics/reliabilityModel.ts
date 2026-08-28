import type { DeploymentResult, ReliabilityResult, ScenarioParams } from '../../types/agileMetrics';

// The reliability model.
//
// Two clocks live in this sandbox and they never touch:
//
//   failedDeploymentRecoveryHours  (deployment model) -- DORA. How long to
//       restore service after a deployment that required intervention.
//   incidentDurationHours          (this model)       -- SRE. How long a
//       production incident impairs service, whoever caused it.
//
// Conflating them is the commonest way an "Agile metrics dashboard" gets
// reliability wrong, so each has an independence test asserting that moving
// one leaves the other, and everything downstream of it, untouched.
//
// Incidents have two sources and only one of them is the team's deployments.
// `externalIncidentsPerSprint` is a control precisely so availability can
// fall while change fail rate is zero -- otherwise the sandbox teaches that
// reliability is entirely a function of how you deploy, which is false.

export function reliabilityModel(p: ScenarioParams, deployment: DeploymentResult): ReliabilityResult {
  // ASSUMPTION -- a failed change deployment is not itself an incident. Only
  // a proportion impair service; the rest are caught by a canary, a health
  // check or a rollback. `deploymentIncidentRate` is calibration only.
  const deploymentCausedIncidents = deployment.failedChangeDeployments * p.deploymentIncidentRate;

  const externalIncidents = p.externalIncidentsPerSprint;
  const incidentsPerSprint = deploymentCausedIncidents + externalIncidents;

  // ASSUMPTION -- incidents are treated as NON-OVERLAPPING, so downtime is
  // the plain sum of their durations. Real incidents overlap and real
  // downtime is therefore lower than this sum. Sandbox simplification, not a
  // production reliability identity, and the chart carries that caveat.
  const downtimeHours = incidentsPerSprint * p.incidentDurationHours;

  // Availability is measured over the sprint. Hours throughout -- incident
  // durations are hours and sprint length is days, and mixing them produces
  // a number that looks plausible and is wrong by a factor of 24.
  const periodHours = p.sprintLengthDays * 24;
  const availability =
    periodHours > 0 ? Math.max(0, Math.min(1, 1 - downtimeHours / periodHours)) : 1;

  // Unlike the rework rate, this bound genuinely needs the clamp: nothing in
  // the model stops enough long incidents from exceeding the sprint, and
  // "availability of -0.4" is not a thing. The clamp is the honest choice
  // here, and the design says so explicitly.

  // Share of the error budget consumed. Above 1 means the budget is blown,
  // which is meaningful and deliberately not capped.
  const errorBudgetBurn = p.slo < 1 ? (1 - availability) / (1 - p.slo) : 0;

  return {
    deploymentCausedIncidents,
    externalIncidents,
    incidentsPerSprint,
    downtimeHours,
    availability,
    errorBudgetBurn,
  };
}
