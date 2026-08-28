import type { Scenario, ScenarioId } from '../../types/learning';
import type { ScenarioParams } from '../../types/agileMetrics';
import { DEFAULT_PARAMS } from '../metrics/params';

// Named parameter sets. Nothing else.
//
// A scenario is `DEFAULT_PARAMS` plus an override map. It is never a model
// variant, never a second set of formulas, and never a place to put a number
// that makes a lesson land. Two models would mean two truths and the sandbox
// would stop being able to settle its own questions.
//
// `intent` is not decoration: it is what a reviewer checks a challenge
// against, and what stops a scenario drifting into "whatever made the chart
// look good".

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  baseline: {
    id: 'baseline',
    label: 'Baseline team',
    intent:
      'The declared defaults. Everything the learner sees is measured against this, ' +
      'so it must never be tuned to suit a particular lesson.',
    overrides: {},
  },

  'wip-raised': {
    id: 'wip-raised',
    label: 'More work started at once',
    intent:
      'The baseline with a single control moved. Used for the first prediction: one ' +
      'variable, so nothing else can be blamed for the result.',
    overrides: { wip: 8 },
  },

  'tight-capacity': {
    id: 'tight-capacity',
    label: 'Smaller team, same board',
    intent:
      'Transfer case for the WIP concepts. The principle is identical and every ' +
      'number is different, so a learner who memorised the first picture fails here.',
    overrides: { throughput: 6, wip: 6, sprintLengthDays: 15 },
  },

  'incident-pressure': {
    id: 'incident-pressure',
    label: 'A rough quarter for reliability',
    intent:
      'The counterfactual partner to wip-raised: elapsed time rises here too, but ' +
      'through lagged incident load rather than through work in progress. Same ' +
      'symptom, different mechanism.',
    overrides: { externalIncidentsPerSprint: 4, incidentDurationHours: 12 },
  },

  'constrained-state': {
    id: 'constrained-state',
    label: 'One state runs slower than the rest',
    intent:
      'The workflow is out of balance: one state moves work onward more slowly than ' +
      'the others, so work piles up in it. Total work in progress is UNCHANGED -- only ' +
      'where it sits has moved. That is what makes it the honest partner to ' +
      'upstream-wip-raised.',
    overrides: { constrainedStateCapacity: 0.15 },
  },

  'upstream-wip-raised': {
    id: 'upstream-wip-raised',
    label: 'More work started, workflow balanced',
    intent:
      'The counterfactual partner. Every band grows because there is more work in ' +
      'progress overall, and the workflow itself is balanced. Same visual direction as ' +
      'a bottleneck, entirely different cause -- and the distribution is what tells ' +
      'them apart, not the direction.',
    overrides: { wip: 12, throughput: 12 },
  },

  'steady-team': {
    id: 'steady-team',
    label: 'A team with no week-to-week swing',
    intent:
      'Capacity variation off. Used to teach variation by CONTRAST -- the learner ' +
      'sees what a run looks like with none of it, then what the same run looks ' +
      'like with it back.',
    overrides: { capacityVariation: 0 },
  },
};

export const SCENARIO_LIST: Scenario[] = Object.values(SCENARIOS);

/** The full parameter set for a scenario. Always derived, never stored. */
export function paramsFor(id: ScenarioId): ScenarioParams {
  return { ...DEFAULT_PARAMS, ...SCENARIOS[id].overrides };
}

/**
 * A stable identity for a parameterisation.
 *
 * Recorded on every attempt so transfer can be checked mechanically: solving
 * the same fingerprint twice is repetition, solving a different one is
 * evidence. Sorted so key order cannot change the fingerprint.
 */
export function fingerprint(params: ScenarioParams): string {
  return (Object.keys(params) as (keyof ScenarioParams)[])
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('|');
}

/** True when two scenarios differ in any way the model can see. */
export function isDistinctScenario(a: ScenarioId, b: ScenarioId): boolean {
  return fingerprint(paramsFor(a)) !== fingerprint(paramsFor(b));
}
