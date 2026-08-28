// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect } from 'vitest';
import type { ScenarioParams } from '../../types/agileMetrics';
import { CHART_VIEWS } from './charts';
import { DEFAULT_PARAMS } from './params';
import { simulate } from './compose';
import { baselineFor, isBaseline, keyOutcomes, whatMoved } from './whatMoved';

// Two claims the page makes in words are computed here, so they cannot be
// wrong in the way authored copy is wrong:
//
//   "one control reaches N of the 6 families"   (the first-experiment card)
//   "N of 27 charts moved"                      (the summary and the tabs)
//
// If a coupling is removed, these numbers fall rather than the sentence
// staying true-looking and stale.

const scenario = (o: Partial<ScenarioParams> = {}): ScenarioParams => ({
  ...DEFAULT_PARAMS,
  sprints: 8,
  ...o,
});

function movementFor(params: ScenarioParams) {
  const baseline = baselineFor(params);
  return whatMoved(simulate(params), params, simulate(baseline), baseline);
}

describe('what moved', () => {
  it('reports nothing moved when nothing was moved', () => {
    const params = scenario();
    expect(isBaseline(params)).toBe(true);
    const moved = movementFor(params);
    expect(moved.movedViews.size).toBe(0);
    expect(moved.movedFamilies.size).toBe(0);
  });

  it('treats the sprint count as a viewport control, not a scenario change', () => {
    // `sprints` decides how much of the run is on screen, not how the team
    // behaves. Resetting it in the baseline would give the two runs different
    // series lengths and report all 27 views as moved on a control that
    // changed nothing about the system.
    const params = scenario({ sprints: 14 });
    expect(isBaseline(params)).toBe(true);
    expect(movementFor(params).movedViews.size).toBe(0);
  });

  it('shows one flow control reaching families it has no business in', () => {
    // The payoff the whole page is built around, and the claim the
    // first-experiment card makes out loud. WIP is a flow control; if it only
    // moved the flow family there would be no reason for a coupled model.
    const moved = movementFor(scenario({ wip: 8 }));

    expect(moved.movedFamilies.has('flow')).toBe(true);
    expect(moved.movedFamilies.size, 'raising WIP stayed inside its own family').toBeGreaterThan(2);

    // Named explicitly rather than by count, so losing a specific coupling
    // fails here instead of quietly reducing a number nobody reads.
    expect(moved.movedFamilies.has('quality')).toBe(true);
    expect(moved.movedFamilies.has('teamHealth')).toBe(true);
  });

  it('counts moved views per family consistently with the moved set', () => {
    const moved = movementFor(scenario({ wip: 12, automation: 0.9 }));
    const summed = [...moved.countByFamily.values()].reduce((a, b) => a + b, 0);
    expect(summed).toBe(moved.movedViews.size);
    expect(moved.movedViews.size).toBeLessThanOrEqual(CHART_VIEWS.length);
  });

  it('does not report a chart as moved when only its reference line shifted', () => {
    // The SLO slider draws a threshold; it does not change measured
    // availability. A chart that reported "moved" because its goal line moved
    // would train the reader to ignore the indicator.
    const moved = movementFor(scenario({ slo: 0.999 }));
    expect(moved.movedViews.has('availabilityVsSlo')).toBe(false);
    // ...while the burn rate genuinely is a function of the SLO.
    expect(moved.movedViews.has('errorBudgetBurn')).toBe(true);
  });
});

describe('key outcomes', () => {
  it('plots the same quantity its chart plots', () => {
    // Each card names a chart. If the card reported unplanned work in days
    // while the chart drew a share of the sprint, the card would be pointing
    // at a different y-axis -- a small version of exactly the mislabelling
    // the lineage captions exist to prevent.
    const params = scenario();
    const sprints = simulate(params);
    const outcomes = keyOutcomes(sprints, params, sprints, params);

    for (const o of outcomes) {
      expect(
        CHART_VIEWS.some((v) => v.id === o.view),
        `${o.id} names a view that is not in the inventory`,
      ).toBe(true);
      expect(o.series).toHaveLength(sprints.length);
      expect(o.formula.length, `${o.id} has no formula`).toBeGreaterThan(10);
      expect(o.note, `${o.id} does not say why it has no control`).toMatch(/\w/);
    }
  });

  it('reports every outcome as unchanged against its own run', () => {
    const params = scenario();
    const sprints = simulate(params);
    for (const o of keyOutcomes(sprints, params, sprints, params)) {
      expect(o.value, o.id).toBeCloseTo(o.baseline, 12);
    }
  });

  it('separates the capacity control from realised throughput', () => {
    // The most reachable confusion on the page: "Capacity" is a slider,
    // "Realised throughput" is not, and they are different numbers whenever
    // unplanned work has eaten any of the sprint.
    const params = scenario();
    const sprints = simulate(params);
    const realised = keyOutcomes(sprints, params, sprints, params).find(
      (o) => o.id === 'throughput',
    )!;
    expect(realised.label).toBe('Realised throughput');
    expect(realised.value).toBeLessThan(params.throughput);
  });
});
