import type { FlowResult, ScenarioParams } from '../../types/agileMetrics';

// The flow model. Everything else in the sandbox hangs off this one.
//
// The single most important property here: WIP is not a throughput control.
// Raising it cannot make the team deliver more. It changes cycle time (via
// Little's Law) and the SHAPE of the burndown (via batching), and nothing
// else. `wip` therefore appears nowhere in the `deliveredItems` calculation,
// and there is a test that sweeps WIP across its whole range asserting
// delivery does not move.
//
// This is the "oh, THAT's why" the sandbox exists to produce: people raise WIP
// expecting more output and get a flat-then-cliff burndown with the same total
// instead.

/** Little's Law over the delivery boundary: cycleTime = WIP / throughput. */
function littlesLaw(wip: number, throughputPerSprint: number, sprintLengthDays: number): number {
  // Throughput of zero is a real reachable state (a sprint entirely consumed
  // by unplanned work). Little's Law has no answer there -- an infinite cycle
  // time is arithmetically true and useless on a chart -- so the sandbox
  // reports zero and the degenerate-input test pins that choice down. What it
  // must never do is emit NaN or Infinity into a chart axis.
  if (throughputPerSprint <= 0) return 0;
  return (wip * sprintLengthDays) / throughputPerSprint;
}

/**
 * @param unplannedWorkDays Days of this sprint's capacity already spoken for.
 *   Composed by the sprint loop as `baseUnplanned + incidentLoad[n-1]`, so the
 *   incident half of it always arrives from the PREVIOUS sprint. The flow
 *   model itself is memoryless -- it never sees a sprint index.
 * @param capacityFactor This sprint's capacity multiplier, read off a fixed
 *   zero-mean profile by the sprint loop. Passed IN rather than derived here
 *   for the same reason `unplannedWorkDays` is: keeping this function
 *   memoryless is what lets the sprint loop stay the single place that knows
 *   about sprint ordering. Defaults to 1, so a caller that does not care
 *   about variation gets the steady-state behaviour unchanged.
 */
export function flowModel(
  p: ScenarioParams,
  unplannedWorkDays: number,
  capacityFactor = 1,
): FlowResult {
  const availableCapacityFraction =
    p.sprintLengthDays > 0
      ? Math.max(0, Math.min(1, 1 - unplannedWorkDays / p.sprintLengthDays))
      : 0;

  // The team commits to a full sprint of capacity, so anything unplanned work
  // eats shows up as a miss rather than as a smaller commitment. This is what
  // makes the burndown fail to reach zero, and what predictability measures.
  const committedItems = p.throughput;

  // Realised throughput. Note the absence of `p.wip`.
  //
  // Capped at the commitment because a good sprint cannot conjure work that
  // was never committed -- extra capacity finishes the sprint early, it does
  // not raise the scope. The cap is also what keeps `flowEfficiency` inside
  // 0..1 without a clamp of its own: that bound rests on
  // deliveredItems <= throughput.
  const deliveredItems = Math.min(
    committedItems,
    p.throughput * availableCapacityFraction * Math.max(0, capacityFactor),
  );
  const carryOver = Math.max(0, committedItems - deliveredItems);

  // Items in flight finish together. WIP=1 releases one at a time and draws a
  // near-linear burndown; WIP at capacity releases everything at once and
  // draws flat-then-cliff. Same total either way.
  const batchSize = Math.min(p.wip, deliveredItems);

  const cycleTimeDays = littlesLaw(p.wip, deliveredItems, p.sprintLengthDays);

  // Little's Law again, over a wider boundary that includes the backlog wait.
  // Delivery lead time is therefore always at least cycle time -- it is the
  // same law applied from commitment rather than from start.
  const deliveryLeadTimeDays = littlesLaw(p.wip + carryOver, deliveredItems, p.sprintLengthDays);

  // Work content of a single item at full capacity. Bounded 0..1 by
  // construction: cycleTime >= touchTime because wip >= 1 and
  // deliveredItems <= throughput, so no clamp is needed.
  const touchTimeDays = p.throughput > 0 ? p.sprintLengthDays / p.throughput : 0;
  const flowEfficiency = cycleTimeDays > 0 ? touchTimeDays / cycleTimeDays : 0;

  const batches = batchSize > 0 ? Math.ceil(deliveredItems / batchSize) : 0;
  const batchIntervalDays = batches > 0 ? p.sprintLengthDays / batches : 0;

  // Bounded 0..1 by construction rather than by clamping: wip and throughput
  // are both non-negative and wip >= 1, so the ratio can approach 1 but never
  // reach or pass it. Anything multiplied by this stays in range.
  const wipPressure = p.wip + p.throughput > 0 ? p.wip / (p.wip + p.throughput) : 0;

  const { burndown, burnup, started } = buildDailySeries(
    p.sprintLengthDays,
    committedItems,
    deliveredItems,
    batchSize,
    p.wip,
  );

  return {
    deliveredItems,
    batchSize,
    deliveredPoints: deliveredItems * p.avgPointsPerItem,
    cycleTimeDays,
    deliveryLeadTimeDays,
    flowEfficiency,
    batchIntervalDays,
    wipPressure,
    unplannedWorkDays,
    availableCapacityFraction,
    burndown,
    burnup,
    started,
    committedItems,
  };
}

/**
 * Day-by-day series for burndown, burnup and the CFD bands.
 *
 * Batches land at even intervals across the sprint, which is what turns WIP
 * into burndown shape. Kept continuous rather than rounding to whole items:
 * rounding introduces steps that look like a modelling claim and are actually
 * an artefact.
 */
function buildDailySeries(
  sprintLengthDays: number,
  committedItems: number,
  deliveredItems: number,
  batchSize: number,
  wip: number,
): Pick<FlowResult, 'burndown' | 'burnup' | 'started'> {
  const days = Math.max(0, Math.floor(sprintLengthDays));
  const burndown: number[] = [];
  const burnup: number[] = [];
  const started: number[] = [];

  const batches = batchSize > 0 ? Math.ceil(deliveredItems / batchSize) : 0;
  const batchInterval = batches > 0 ? sprintLengthDays / batches : Infinity;

  for (let day = 0; day <= days; day++) {
    const completedBatches = batches > 0 ? Math.floor(day / batchInterval) : 0;
    const done = Math.min(deliveredItems, completedBatches * batchSize);

    burnup.push(done);
    // Burndown is defined as the complement of burnup against the same
    // commitment, so the two can never disagree about completed work. The
    // test asserting they agree is guarding this line staying a subtraction.
    burndown.push(committedItems - done);
    // CFD started band. `started - done` is WIP while work remains, then
    // collapses as the last batch lands.
    started.push(Math.min(committedItems, done + wip));
  }

  return { burndown, burnup, started };
}
