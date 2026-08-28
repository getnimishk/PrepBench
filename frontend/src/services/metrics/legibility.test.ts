// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect } from 'vitest';
import type { ScenarioParams } from '../../types/agileMetrics';
import { DEFAULT_PARAMS, PARAM_SPECS } from './params';
import { SPRINT_CAPACITY_PROFILE, capacityFactorForSprint, simulate } from './compose';
import { buildChartPayload } from './chartData';

// Temporal legibility of the canonical scenario.
//
// These are LEARNING ACCEPTANCE CRITERIA, not mathematical invariants. Little's
// Law is true whether or not anyone can read the chart; these assert something
// weaker and different -- that the default scenario a learner lands on has
// enough distinct observations to teach the concept the chart is named after.
//
// A velocity chart with seven identical bars is not wrong. It is correct and
// useless: variability is the entire subject of Velocity, Say/do ratio and
// Sprint goal, and a flat line teaches the opposite of the lesson.
//
// Deliberately NOT asserted: any particular oscillation, amplitude or shape.
// Pinning those would make the profile untunable without a test rewrite, and
// the requirement is legibility, not a specific waveform.

const scenario = (o: Partial<ScenarioParams> = {}): ScenarioParams => ({
  ...DEFAULT_PARAMS,
  ...o,
});

/** Distinct values, at a tolerance coarse enough to ignore float noise. */
function distinct(values: (number | null)[]): number {
  return new Set(values.filter((v): v is number => v !== null).map((v) => v.toFixed(4))).size;
}

function measured(viewId: 'velocity' | 'sayDoRatio' | 'sprintGoal', p: ScenarioParams) {
  const payload = buildChartPayload(viewId, simulate(p), p);
  // Reference lines are constants by design -- the commitment line SHOULD be
  // flat. Only the measured series has to carry information.
  return payload.series.filter((s) => !s.reference).flatMap((s) => s.data);
}

describe('the canonical scenario is temporally legible', () => {
  const p = scenario();

  it.each(['velocity', 'sayDoRatio'] as const)(
    'gives %s enough distinct observations to teach from',
    (viewId) => {
      // Four is the floor, not a target: below that a learner cannot tell a
      // trend from a blip, which is the judgement these charts exist to train.
      const values = measured(viewId, p);
      expect(
        distinct(values),
        `${viewId} draws too few distinct values across ${p.sprints} sprints to read as anything but a flat line`,
      ).toBeGreaterThanOrEqual(4);
    },
  );

  it('shows the sprint goal both met and missed', () => {
    // A binary metric gets a binary criterion. Demanding four distinct values
    // here would be incoherent -- there are only two -- but a column that is
    // all-met or all-missed teaches just as little as a flat line, because
    // the learner never sees the outcome change.
    const values = measured('sprintGoal', p).filter((v): v is number => v !== null);
    expect(values.some((v) => v === 1), 'the goal is never met').toBe(true);
    expect(values.some((v) => v === 0), 'the goal is never missed').toBe(true);
  });

  it('does not render the sprint goal as a copy of the say/do ratio', () => {
    // These are computed from the same two numbers, and an earlier version
    // plotted the identical series on both -- two of the original eight
    // metrics that a learner had no way to tell apart. A ratio says by how
    // much; a goal says whether it counted.
    const goal = measured('sprintGoal', p);
    const sayDo = measured('sayDoRatio', p);
    expect(goal).not.toEqual(sayDo);
    expect(new Set(goal.map(String)).size).toBe(2);
  });

  it('stays fully deterministic', () => {
    // The whole point of a fixed profile over a random draw: change one
    // control, and everything that moved is attributable to that control.
    expect(simulate(p)).toEqual(simulate(p));
    expect(simulate(p)).toEqual(simulate({ ...DEFAULT_PARAMS }));
  });

  it('collapses to the steady state when variation is switched off', () => {
    // The flat case must stay reachable. It is what makes the contraction
    // visible -- and every invariant in this suite is easier to reason about
    // against it.
    const flat = simulate(scenario({ capacityVariation: 0, sprints: 10 }));
    const tail = flat.slice(4).map((s) => s.flow.deliveredItems);
    expect(distinct(tail)).toBe(1);
  });
});

describe('the capacity profile', () => {
  it('sums to exactly zero, so it adds no bias of its own', () => {
    const sum = SPRINT_CAPACITY_PROFILE.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0, 12);
  });

  it('repeats on a cycle that will not line up with a typical sprint count', () => {
    // A period sharing a factor with 6, 8 or 12 reads as an artificial
    // sawtooth rather than as variability.
    const period = SPRINT_CAPACITY_PROFILE.length;
    for (const common of [6, 8, 10, 12]) {
      expect(common % period, `period ${period} divides a common sprint count`).not.toBe(0);
    }
  });

  it('is a pure function of the sprint index', () => {
    for (let n = 1; n <= 20; n++) {
      expect(capacityFactorForSprint(DEFAULT_PARAMS, n)).toBe(
        capacityFactorForSprint(DEFAULT_PARAMS, n),
      );
    }
  });

  it('barely moves the average it varies around', () => {
    // The profile is zero-mean, but delivery is capped at the commitment: a
    // good sprint cannot bank its surplus while a bad one still loses its
    // shortfall. Variability against a ceiling costs a little throughput --
    // real, and worth showing. What must not happen is variation quietly
    // teaching that a variable team delivers substantially less.
    const mean = (v: number) => {
      const run = simulate(scenario({ capacityVariation: v, sprints: 14 }));
      return run.reduce((a, s) => a + s.flow.deliveredItems, 0) / run.length;
    };
    const flat = mean(0);
    for (const variation of [0.05, 0.1, 0.2]) {
      expect(Math.abs(mean(variation) - flat) / flat, `variation ${variation}`).toBeLessThan(0.05);
    }
  });

  it('is a scenario control, not a hidden calibration constant', () => {
    // It describes the team being simulated, so it gets a slider. k1..k4 tune
    // a relationship between two metrics, so they do not.
    const spec = PARAM_SPECS.find((s) => s.key === 'capacityVariation')!;
    expect(spec.exposed).toBe(true);
    expect(spec.calibration).toBe(false);
    expect(spec.min).toBe(0);
  });
});
