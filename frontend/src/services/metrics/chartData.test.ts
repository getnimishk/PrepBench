import { describe, it, expect } from 'vitest';
import type { ScenarioParams } from '../../types/agileMetrics';
import { CHART_VIEWS } from './charts';
import { DEFAULT_PARAMS, PARAM_SPECS } from './params';
import { simulate } from './compose';
import { buildChartPayload } from './chartData';

// Every view has to produce something a renderer can draw and a reader can
// read. "Draws without crashing" is not the bar -- an axis with no label or a
// series full of NaN renders perfectly happily and teaches nothing.

const scenario = (o: Partial<ScenarioParams> = {}): ScenarioParams => ({
  ...DEFAULT_PARAMS,
  sprints: 6,
  ...o,
});

describe('chart payloads', () => {
  const sprints = simulate(scenario());

  it('labels both axes and states a reading for every view', () => {
    for (const view of CHART_VIEWS) {
      const p = buildChartPayload(view.id, sprints, scenario());
      expect(p.xLabel.length, `${view.id} x-axis`).toBeGreaterThan(0);
      expect(p.yLabel.length, `${view.id} y-axis`).toBeGreaterThan(0);
      // A shape with no reading is decoration. The whole sandbox is an
      // argument that a chart should tell you what to look at.
      expect(p.reading.length, `${view.id} reading`).toBeGreaterThan(20);
    }
  });

  it('leads with a short instruction for the eye, separate from the meaning', () => {
    // Two different jobs, and the card used to run them together in one
    // paragraph under a small chart -- which reads the chart as an
    // illustration of the prose rather than the other way round.
    //
    // `lookFor` points at a feature of the PICTURE: a gap, a thickness, a
    // level, a tail. `reading` says what that feature means. The length cap
    // is the load-bearing part: a "look for" that grows into a paragraph has
    // silently become a second reading.
    for (const view of CHART_VIEWS) {
      const p = buildChartPayload(view.id, sprints, scenario());
      expect(p.lookFor.length, `${view.id} has no lookFor`).toBeGreaterThan(15);
      expect(p.lookFor.length, `${view.id} lookFor is too long to scan`).toBeLessThanOrEqual(80);
      expect(p.lookFor, view.id).not.toBe(p.reading);
      expect(p.reading.length, `${view.id} reading is shorter than its lookFor`)
        .toBeGreaterThan(p.lookFor.length);
    }
  });

  it('gives each renderer the shape it needs', () => {
    for (const view of CHART_VIEWS) {
      const p = buildChartPayload(view.id, sprints, scenario());
      if (view.primitive === 'scatter') {
        expect(p.points, `${view.id} is a scatter with no points`).toBeDefined();
        expect(p.points!.length, view.id).toBeGreaterThan(0);
      } else {
        expect(p.series.length, `${view.id} has no series`).toBeGreaterThan(0);
        expect(p.labels.length, `${view.id} has no labels`).toBeGreaterThan(0);
        for (const s of p.series) {
          expect(s.data.length, `${view.id} / ${s.label} length`).toBe(p.labels.length);
        }
      }
    }
  });

  it('never emits a non-finite value into a chart', () => {
    // Degenerate scenarios are reachable from the sliders: capacity 1 with a
    // full sprint of unplanned work delivers nothing, and every ratio
    // downstream has a zero denominator.
    const degenerate = [
      scenario(),
      scenario({ throughput: 1, baseUnplannedDays: 5, sprintLengthDays: 5 }),
      scenario({ wip: 20, throughput: 1 }),
      scenario({ baseChangeFailRate: 0, externalIncidentsPerSprint: 0, baseDefectRate: 0 }),
      scenario({ externalIncidentsPerSprint: 10, incidentDurationHours: 48 }),
    ];

    for (const params of degenerate) {
      const run = simulate(params);
      for (const view of CHART_VIEWS) {
        const p = buildChartPayload(view.id, run, params);
        for (const s of p.series) {
          s.data.forEach((value, i) => {
            expect(
              value === null || Number.isFinite(value),
              `${view.id} / ${s.label}[${i}] was ${value}`,
            ).toBe(true);
          });
        }
        for (const pt of p.points ?? []) {
          expect(Number.isFinite(pt.x) && Number.isFinite(pt.y), `${view.id} point`).toBe(true);
        }
        for (const marker of p.percentiles ?? []) {
          expect(Number.isFinite(marker.value), `${view.id} ${marker.label}`).toBe(true);
        }
      }
    }
  });

  it('keeps percent-scaled views in a readable range', () => {
    // A y-axis rendered as a percentage has to hold values that mean one.
    // Error budget burn is the deliberate exception -- above 1 means the
    // budget is spent, which is the reading, so it is not capped.
    for (const view of CHART_VIEWS) {
      const p = buildChartPayload(view.id, sprints, scenario());
      if (p.unit !== 'percent' || view.id === 'errorBudgetBurn') continue;
      for (const s of p.series) {
        for (const value of s.data) {
          if (value === null) continue;
          expect(value, `${view.id} / ${s.label}`).toBeGreaterThanOrEqual(0);
          expect(value, `${view.id} / ${s.label}`).toBeLessThanOrEqual(p.yMax ?? 1.2);
        }
      }
    }
  });

  it('survives every exposed slider at both ends of its range', () => {
    // The sliders are the only way a user reaches this code. If any endpoint
    // breaks a payload, it is reachable in one drag.
    for (const spec of PARAM_SPECS.filter((s) => s.exposed)) {
      for (const value of [spec.min, spec.max]) {
        const params = scenario({ [spec.key]: value } as Partial<ScenarioParams>);
        const run = simulate(params);
        for (const view of CHART_VIEWS) {
          expect(
            () => buildChartPayload(view.id, run, params),
            `${view.id} at ${spec.key}=${value}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('never renders two views as the same series', () => {
    // Two charts plotting identical numbers is the quietest failure in the
    // whole sandbox: everything typechecks, every test passes, the callouts
    // are correct, and the learner still cannot say what distinguishes them.
    //
    // It has happened twice. Sprint goal was the say/do ratio with a line
    // drawn on it, and defect density divided by items exactly as defect rate
    // did -- four of the original eight metrics collapsed into two pairs.
    // Both were found by this sweep, which is why it is now permanent.
    const params = scenario();
    const run = simulate(params);
    const byShape = new Map<string, string[]>();

    for (const view of CHART_VIEWS) {
      const p = buildChartPayload(view.id, run, params);
      const measured = p.series
        .filter((s) => !s.reference)
        .flatMap((s) => s.data.map((v) => (v === null ? 'null' : v.toFixed(6))));
      const points = (p.points ?? []).map((pt) => `${pt.x.toFixed(4)},${pt.y.toFixed(4)}`);
      const shape = [...measured, ...points].join('|');
      byShape.set(shape, [...(byShape.get(shape) ?? []), view.id]);
    }

    const duplicates = [...byShape.values()].filter((ids) => ids.length > 1);
    expect(
      duplicates,
      `these views plot identical data, so nothing on screen tells them apart: ` +
        duplicates.map((ids) => ids.join(' == ')).join('; '),
    ).toEqual([]);
  });

  it('measures defect rate and defect density against different denominators', () => {
    // Rate is per item, density is per point. Divide both by items and they
    // are the same number twice -- which is exactly what this model did until
    // the duplicate sweep above caught it.
    const params = scenario({ avgPointsPerItem: 5 });
    const run = simulate(params);
    const s = run[run.length - 1];
    expect(s.quality.defectDensity).toBeCloseTo(s.quality.defectRate / 5, 10);
    expect(s.quality.defectDensity).not.toBeCloseTo(s.quality.defectRate, 4);
  });

  it('marks targets and thresholds as reference series, not as data', () => {
    // Reference lines are drawn dashed so a commitment does not read as an
    // observation. These four exist to be compared against, so if one stops
    // being a reference the chart quietly starts asserting it as measured.
    const expectReference: Record<string, string> = {
      burndown: 'Ideal',
      burnup: 'Scope',
      velocity: 'Committed',
      availabilityVsSlo: 'SLO',
    };
    for (const [viewId, label] of Object.entries(expectReference)) {
      const p = buildChartPayload(viewId as never, sprints, scenario());
      const series = p.series.find((s) => s.label === label);
      expect(series, `${viewId} has no "${label}" series`).toBeDefined();
      expect(series!.reference, `${viewId} / ${label}`).toBe(true);
    }
  });
});
