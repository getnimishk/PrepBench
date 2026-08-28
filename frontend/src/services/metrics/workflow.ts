import type { WorkflowState } from '../../types/agileMetrics';

// The workflow: an ordered list of in-progress states, and the rule that
// distributes work in progress across them.
//
// WHY THIS EXISTS
//
// The Rev 8 flow model has no per-state occupancy. Its cumulative-flow bands
// were derived from three aggregates, and the middle band was computed as
// `min(committed, done + wip) - done` -- which is exactly `wip`, constant for
// the whole sprint. That band is the CONTROL drawn as a shape. It cannot
// widen, so it cannot show accumulation, so no honest lesson about a
// bottleneck could be built on it.
//
// WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT
//
// This module partitions work in progress across named states. It does NOT
// decide how much work in progress there is: the total is fixed by the frozen
// flow model, and the invariant
//
//     sum over states of occupancy[day][state] === started[day] - burnup[day]
//
// is asserted in invariants.test.ts. Every existing Rev 8 output -- delivery,
// cycle time, Little's Law, flow efficiency, every DORA and reliability
// figure -- is untouched by construction, because none of them reads this.
//
// The partition is therefore a MODEL ASSUMPTION, declared as one in the
// coupling ledger: a behavioural claim about where work sits, layered on top
// of a total the model already knew.
//
// THE STATES ARE A SANDBOX CONVENTION
//
// Analysis / Build / Review is a conventional Kanban pipeline. It is not a
// claim that any team works this way, and nothing downstream may assume the
// list has three entries -- the chart derives its band count and its labels
// from this array, and the tests sweep workflows of other lengths.

/**
 * The in-progress states WIP is distributed across, in flow order.
 *
 * "To do" and "Done" are not here on purpose: they are terminal aggregates the
 * frozen model already computes, and including them would break the invariant
 * that this partition sums to work IN PROGRESS.
 */
export const WORKFLOW: WorkflowState[] = [
  {
    id: 'analysis',
    label: 'Analysis',
    baseServiceRate: 0.5,
    constrainable: false,
  },
  {
    id: 'build',
    label: 'Build',
    baseServiceRate: 0.5,
    constrainable: false,
  },
  {
    id: 'review',
    label: 'Review',
    // The conventional place for a queue to form: one reviewer, a handoff, an
    // approval. Marked constrainable so a scenario can slow it without the
    // chart or the learning layer knowing which state that is.
    baseServiceRate: 0.5,
    constrainable: true,
  },
];

/** Index of the state a scenario may constrain, or -1 when none is marked. */
export function constrainedStateIndex(states: WorkflowState[] = WORKFLOW): number {
  return states.findIndex((s) => s.constrainable);
}

/**
 * Effective per-day service rate for each state.
 *
 * `capacity` scales the constrainable state only: 1 leaves the workflow
 * balanced, and lower values slow that one state. Everything else is a model
 * constant.
 */
function serviceRates(states: WorkflowState[], capacity: number): number[] {
  const constrained = constrainedStateIndex(states);
  return states.map((s, i) =>
    Math.max(1e-6, s.baseServiceRate * (i === constrained ? Math.max(0, capacity) : 1)),
  );
}

/**
 * Work in progress, distributed across states, day by day.
 *
 * The dynamics are a closed tandem flow: each day a fraction of each state's
 * occupancy moves onward, the last state's departures re-enter the first as
 * newly started work, and the whole vector is then scaled to the total the
 * frozen model already fixed for that day.
 *
 * Two consequences matter, and both are tested:
 *
 *   - With every rate equal, a uniform distribution stays uniform. The model
 *     does NOT fabricate accumulation in a scenario that has no constraint.
 *   - With one rate lowered, that state's share grows day by day while the
 *     others shrink. That is genuine accumulation, arrived at by a stated
 *     rule rather than drawn on.
 *
 * Deterministic: same inputs, same output, always.
 *
 * @param totalByDay Work in progress per day, from the frozen flow model.
 *   This function never changes it; it only decides where it sits.
 */
export function partitionAcrossStates(
  totalByDay: number[],
  capacity: number,
  states: WorkflowState[] = WORKFLOW,
): number[][] {
  const n = states.length;
  if (n === 0) return totalByDay.map(() => []);

  const rates = serviceRates(states, capacity);

  // Start balanced. Any other opening distribution would be an extra claim,
  // and the dynamics below are what the lesson is about.
  let raw = new Array<number>(n).fill(1 / n);
  const out: number[][] = [];

  for (let day = 0; day < totalByDay.length; day++) {
    if (day > 0) {
      const departures = raw.map((occupancy, s) => Math.min(occupancy, occupancy * rates[s]));
      const next = raw.map((occupancy, s) => {
        const arriving = s === 0 ? departures[n - 1] : departures[s - 1];
        return Math.max(0, occupancy - departures[s] + arriving);
      });
      raw = next;
    }

    const rawTotal = raw.reduce((sum, v) => sum + v, 0);
    const total = totalByDay[day];
    out.push(
      rawTotal > 0
        ? raw.map((v) => (v / rawTotal) * total)
        : // A day with no work in progress: every state is empty, and dividing
          // by a zero total would emit NaN into a chart axis.
          new Array<number>(n).fill(0),
    );
  }

  return out;
}
