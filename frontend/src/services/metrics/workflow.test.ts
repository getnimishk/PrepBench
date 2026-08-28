// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect } from 'vitest';
import type { ScenarioParams, WorkflowState } from '../../types/agileMetrics';
import { WORKFLOW, constrainedStateIndex, partitionAcrossStates } from './workflow';
import { COUPLING_BY_ID } from './couplings';
import { DEFAULT_PARAMS, PARAM_SPECS, paramSpec, validateParams } from './params';
import { flowModel } from './flowModel';
import { simulate } from './compose';
import { buildChartPayload } from './chartData';

// The workflow-state revision.
//
// This is the one place the Rev 8 model was extended rather than read, so it
// carries the heaviest guard in the suite. The extension is ADDITIVE by
// construction: the partition decides only WHERE work in progress sits, and
// the total is the one the frozen model already computed. That is what keeps
// delivery, cycle time, Little's Law, flow efficiency and every DORA and
// reliability figure untouched -- none of them reads this.

const scenario = (o: Partial<ScenarioParams> = {}): ScenarioParams => ({
  ...DEFAULT_PARAMS,
  sprints: 6,
  ...o,
});

/** A workflow of arbitrary length, so nothing can quietly assume three. */
const workflowOf = (n: number, constrainAt = -1): WorkflowState[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    label: `State ${i}`,
    baseServiceRate: 0.5,
    constrainable: i === constrainAt,
  }));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('the workflow is configuration, not a hard-coded three', () => {
  it('partitions across however many states it is given', () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const occupancy = partitionAcrossStates([10, 10, 10], 1, workflowOf(n));
      expect(occupancy, `${n} states`).toHaveLength(3);
      for (const day of occupancy) expect(day, `${n} states`).toHaveLength(n);
    }
  });

  it('draws one band per workflow state, plus To do and Done', () => {
    // Band count comes from the workflow. Add a fourth state and the chart
    // grows a fourth band with no change in chartData.ts.
    const params = scenario();
    const payload = buildChartPayload('cumulativeFlow', simulate(params), params);
    expect(payload.series).toHaveLength(WORKFLOW.length + 2);
  });

  it('takes its band labels and their order from the workflow', () => {
    const params = scenario();
    const payload = buildChartPayload('cumulativeFlow', simulate(params), params);
    const labels = payload.series.map((s) => s.label);

    expect(labels[0]).toBe('Done');
    expect(labels[labels.length - 1]).toBe('To do');
    // The states in between, in flow order, named by the workflow.
    expect(labels.slice(1, -1)).toEqual(WORKFLOW.map((s) => s.label));
  });

  it('handles a workflow with no constrainable state at all', () => {
    expect(constrainedStateIndex(workflowOf(3))).toBe(-1);
    const occupancy = partitionAcrossStates([9, 9], 0.2, workflowOf(3));
    // Nothing to constrain, so the distribution stays even.
    for (const day of occupancy) {
      expect(day[0]).toBeCloseTo(day[1], 10);
      expect(day[1]).toBeCloseTo(day[2], 10);
    }
  });

  it('handles an empty workflow without emitting anything into a chart', () => {
    expect(partitionAcrossStates([5, 5], 1, [])).toEqual([[], []]);
  });
});

describe('occupancy partitions work in progress exactly', () => {
  it('sums to started minus burnup on every day of every sprint', () => {
    // THE invariant. It is what makes this extension additive: the total is
    // fixed by the frozen model, and the partition only decides where it sits.
    for (const params of [
      scenario(),
      scenario({ wip: 1 }),
      scenario({ wip: 20, throughput: 20 }),
      scenario({ constrainedStateCapacity: 0.1 }),
      scenario({ baseUnplannedDays: 5, sprintLengthDays: 5 }),
    ]) {
      for (const sprint of simulate(params)) {
        const { started, burnup, stateOccupancy } = sprint.flow;
        stateOccupancy.forEach((day, i) => {
          const wipThatDay = Math.max(0, started[i] - burnup[i]);
          expect(sum(day), `sprint ${sprint.sprint} day ${i}`).toBeCloseTo(wipThatDay, 9);
        });
      }
    }
  });

  it('never emits a negative or non-finite occupancy', () => {
    for (const params of [scenario(), scenario({ throughput: 1, baseUnplannedDays: 5, sprintLengthDays: 5 })]) {
      for (const sprint of simulate(params)) {
        for (const day of sprint.flow.stateOccupancy) {
          for (const value of day) {
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('a constraint produces accumulation, and its absence does not', () => {
  it('does not fabricate accumulation in a balanced workflow', () => {
    // The most important negative result here. A partition that always
    // produced a lumpy picture would be drawing a bottleneck that the
    // scenario does not contain.
    const params = scenario({ constrainedStateCapacity: 1 });
    for (const sprint of simulate(params)) {
      for (const day of sprint.flow.stateOccupancy) {
        const first = day[0];
        for (const value of day) expect(value).toBeCloseTo(first, 9);
      }
    }
  });

  it('accumulates in the constrained state, and keeps accumulating', () => {
    const constrained = constrainedStateIndex();
    expect(constrained).toBeGreaterThanOrEqual(0);

    const params = scenario({ constrainedStateCapacity: 0.1 });
    const first = simulate(params)[0].flow;

    // Share, not absolute occupancy: the total varies day to day and the
    // claim is about DISTRIBUTION.
    const shareOn = (day: number) =>
      sum(first.stateOccupancy[day]) > 0
        ? first.stateOccupancy[day][constrained] / sum(first.stateOccupancy[day])
        : 0;

    const early = shareOn(1);
    const late = shareOn(first.stateOccupancy.length - 2);

    expect(late, 'the constrained state did not accumulate').toBeGreaterThan(early);
    expect(late, 'the constrained state should hold most of the work in progress')
      .toBeGreaterThan(1 / WORKFLOW.length);
  });

  it('drains the other states as the constrained one fills', () => {
    const constrained = constrainedStateIndex();
    const params = scenario({ constrainedStateCapacity: 0.1 });
    const flow = simulate(params)[0].flow;
    const lastDay = flow.stateOccupancy.length - 2;

    WORKFLOW.forEach((_, i) => {
      if (i === constrained) return;
      const total = sum(flow.stateOccupancy[lastDay]);
      const share = total > 0 ? flow.stateOccupancy[lastDay][i] / total : 0;
      expect(share, `state ${i} should have drained`).toBeLessThan(1 / WORKFLOW.length);
    });
  });

  it('is deterministic', () => {
    const params = scenario({ constrainedStateCapacity: 0.3 });
    expect(JSON.stringify(simulate(params).map((s) => s.flow.stateOccupancy))).toBe(
      JSON.stringify(simulate(params).map((s) => s.flow.stateOccupancy)),
    );
  });
});

describe('the extension changed nothing that already existed', () => {
  it('leaves every pre-existing flow output identical across the capacity range', () => {
    // The proof that this is additive. Sweeping the new parameter must move
    // the partition and NOTHING else -- if any of these drifted, the
    // revision would have silently rewritten Rev 8.
    const untouched = (p: ScenarioParams) => {
      const flow = flowModel(p, 1);
      return JSON.stringify({
        deliveredItems: flow.deliveredItems,
        batchSize: flow.batchSize,
        deliveredPoints: flow.deliveredPoints,
        cycleTimeDays: flow.cycleTimeDays,
        deliveryLeadTimeDays: flow.deliveryLeadTimeDays,
        flowEfficiency: flow.flowEfficiency,
        batchIntervalDays: flow.batchIntervalDays,
        wipPressure: flow.wipPressure,
        availableCapacityFraction: flow.availableCapacityFraction,
        burndown: flow.burndown,
        burnup: flow.burnup,
        started: flow.started,
        committedItems: flow.committedItems,
      });
    };

    const reference = untouched(scenario());
    for (const capacity of [0.05, 0.25, 0.5, 0.75, 1]) {
      expect(untouched(scenario({ constrainedStateCapacity: capacity })), `k5=${capacity}`).toBe(
        reference,
      );
    }
  });

  it('leaves every downstream model untouched by the new parameter', () => {
    const downstream = (p: ScenarioParams) =>
      JSON.stringify(
        simulate(p).map((s) => ({
          quality: s.quality,
          deployment: s.deployment,
          reliability: s.reliability,
          team: s.team,
        })),
      );

    expect(downstream(scenario({ constrainedStateCapacity: 0.1 }))).toBe(
      downstream(scenario({ constrainedStateCapacity: 1 })),
    );
  });
});

describe('the new parameter and its coupling are declared honestly', () => {
  it('is classified as a pedagogical calibration parameter, not a control', () => {
    const spec = paramSpec('constrainedStateCapacity');
    expect(spec.calibration, 'must not read as an empirical industry constant').toBe(true);
    expect(spec.exposed, 'calibration parameters stay off the slider panel').toBe(false);
  });

  it('has a spec, like every other parameter the model reads', () => {
    expect(PARAM_SPECS.some((s) => s.key === 'constrainedStateCapacity')).toBe(true);
    expect(validateParams(DEFAULT_PARAMS)).toEqual([]);
  });

  it('declares the partition as an ASSUMPTION, never as arithmetic', () => {
    // It is a behavioural claim about where work sits. Presenting it as an
    // identity would be the exact category error the ledger exists to prevent.
    const coupling = COUPLING_BY_ID.get('wip-across-states');
    expect(coupling, 'the partition is not in the ledger').toBeDefined();
    expect(coupling!.type).toBe('assumption');
    expect(coupling!.uiLabel).toMatch(/^Model assumption:/);
    expect(coupling!.calibrationParameter).toBe('constrainedStateCapacity');
  });

  it('says out loud that the states are a sandbox convention', () => {
    const coupling = COUPLING_BY_ID.get('wip-across-states')!;
    expect(coupling.description).toMatch(/sandbox convention/i);
  });
});
