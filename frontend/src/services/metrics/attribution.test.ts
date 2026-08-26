import { describe, it, expect } from 'vitest';
import type { ChartViewId, ScenarioParams } from '../../types/agileMetrics';
import { CHART_VIEWS } from './charts';
import { COUPLING_BY_ID } from './couplings';
import { DEFAULT_PARAMS, paramSpec } from './params';
import { simulate } from './compose';
import { buildChartPayload } from './chartData';

// Attribution: does each chart actually depend on the caveats it displays?
//
// The ledger has two failure modes and they are opposites:
//
//   UNDER-WIRED  a chart moves because of an assumption but declares nothing,
//                so the learner reads a modelled effect as a measured one.
//   OVER-WIRED   a chart declares an assumption that does not touch it, so a
//                caveat appears on a view it has nothing to do with. This is
//                worse than it sounds -- caveats that are obviously irrelevant
//                teach the reader to ignore all of them.
//
// This file mechanises the over-wired direction: every calibrated coupling a
// view declares must demonstrably move that view's data. The under-wired
// direction cannot be caught the same way, because dependency is transitive
// and almost everything eventually moves almost everything -- an incident
// costs capacity, which reduces delivery, which reduces deployments, which
// changes every DORA figure. Declaring that chain everywhere would put all
// nineteen caveats on all twenty-seven charts. So `consumes` records DIRECT
// dependency, chosen by hand, and this test keeps the hand-chosen set honest.
//
// The measurement goes through `buildChartPayload`, deliberately: it tests
// what the chart actually PLOTS, not a parallel set of selectors that could
// drift away from the rendered series and start certifying the wrong thing.

/**
 * Everything a view plots as measured data, flattened.
 *
 * Reference lines are excluded. A target, ideal or threshold is drawn from a
 * control rather than computed by the model, so letting one count would make
 * a chart look coupling-dependent when only its goal line moved.
 */
function plottedValues(p: ScenarioParams, viewId: ChartViewId): number[] {
  const payload = buildChartPayload(viewId, simulate(p), p);
  const fromSeries = payload.series
    .filter((s) => !s.reference)
    .flatMap((s) => s.data.map((v) => (v === null ? Number.NaN : v)));
  const fromPoints = (payload.points ?? []).flatMap((pt) => [pt.x, pt.y]);
  return [...fromSeries, ...fromPoints];
}

function differs(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((value, i) => Math.abs(value - b[i]) > 1e-9);
}

describe('chart attribution', () => {
  it('builds a payload for every declared view', () => {
    // Without this, a view whose payload threw would simply be skipped by the
    // checks below while appearing fully covered.
    const sprints = simulate({ ...DEFAULT_PARAMS, sprints: 6 });
    for (const view of CHART_VIEWS) {
      const payload = buildChartPayload(view.id, sprints, DEFAULT_PARAMS);
      expect(payload.viewId, view.id).toBe(view.id);
      expect(payload.reading.length, `${view.id} has no reading`).toBeGreaterThan(0);
    }
  });

  it('only declares calibrated couplings that actually move the chart', () => {
    const base: ScenarioParams = { ...DEFAULT_PARAMS, sprints: 8 };

    for (const view of CHART_VIEWS) {
      for (const couplingId of view.consumes) {
        const coupling = COUPLING_BY_ID.get(couplingId);
        expect(coupling, `${view.id} consumes unknown "${couplingId}"`).toBeDefined();

        const key = coupling!.calibrationParameter;
        // Only calibrated edges are mechanically testable: they have a knob
        // to turn. An arithmetic or convention edge has no coefficient, so
        // its relevance is a structural claim, not a measurable one.
        if (key === null) continue;

        const spec = paramSpec(key as keyof ScenarioParams);
        const low = plottedValues({ ...base, [spec.key]: spec.min }, view.id);
        const high = plottedValues({ ...base, [spec.key]: spec.max }, view.id);

        expect(
          differs(low, high),
          `"${view.id}" declares "${couplingId}", but sweeping its calibration ` +
            `parameter "${key}" from ${spec.min} to ${spec.max} leaves the plotted ` +
            `data unchanged. Either the caveat does not belong on this view, or ` +
            `the coupling is not wired into the model.`,
        ).toBe(true);
      }
    }
  });

  it('proves the check can fail', () => {
    // A test that can only pass is not a test. Incident duration provably
    // does not touch any DORA figure -- that independence is asserted in
    // invariants.test.ts -- so wiring it to a DORA chart must be detected.
    const base: ScenarioParams = { ...DEFAULT_PARAMS, sprints: 8 };
    const spec = paramSpec('incidentDurationHours');
    const low = plottedValues({ ...base, incidentDurationHours: spec.min }, 'changeFailRate');
    const high = plottedValues({ ...base, incidentDurationHours: spec.max }, 'changeFailRate');

    expect(differs(low, high)).toBe(false);
  });
});
