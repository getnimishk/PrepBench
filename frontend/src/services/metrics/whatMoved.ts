// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type {
  ChartViewId,
  FamilyId,
  ScenarioParams,
  SprintResult,
} from '../../types/agileMetrics';
import { CHART_VIEWS } from './charts';
import { DEFAULT_PARAMS } from './params';
import { buildChartPayload } from './chartData';

// What changed, computed rather than written down.
//
// Two things on the page used to be unanswerable without reading all 27
// charts: "which families did that control touch?" and "what did I just
// learn?". A mockup answered both with authored prose. Prose cannot be
// checked, goes stale the moment a coupling changes, and -- since the whole
// premise is that a control reaches further than you expect -- would be
// asserting the payoff instead of demonstrating it.
//
// So both are derived from the model, by the same mechanism the attribution
// test uses: run the simulation twice, diff what each chart actually PLOTS.
// Going through `buildChartPayload` rather than reading model fields is
// deliberate. A parallel set of selectors would drift away from the rendered
// series and start certifying movement the learner cannot see.

/**
 * The scenario every comparison is made against.
 *
 * Simulation-group controls are inherited rather than reset: `sprints` sets
 * how much of the run is on screen, not how the team behaves, and resetting
 * it would give the two runs different series lengths and report all 27 views
 * as moved.
 */
export function baselineFor(params: ScenarioParams): ScenarioParams {
  return { ...DEFAULT_PARAMS, sprints: params.sprints };
}

export function isBaseline(params: ScenarioParams): boolean {
  const base = baselineFor(params);
  return (Object.keys(base) as (keyof ScenarioParams)[]).every((k) => base[k] === params[k]);
}

/**
 * Everything a view plots as measured data, flattened.
 *
 * Reference lines are excluded: an ideal line or an SLO threshold is drawn
 * from a control, so counting one would report a chart as moved when only its
 * goal line shifted.
 */
function plottedValues(sprints: SprintResult[], params: ScenarioParams, viewId: ChartViewId): number[] {
  const payload = buildChartPayload(viewId, sprints, params);
  const fromSeries = payload.series
    .filter((s) => !s.reference)
    .flatMap((s) => s.data.map((v) => (v === null ? Number.NaN : v)));
  const fromPoints = (payload.points ?? []).flatMap((pt) => [pt.x, pt.y]);
  return [...fromSeries, ...fromPoints];
}

function differs(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return true;
  // NaN is a legitimate plotted gap, so two gaps in the same slot are equal
  // rather than different -- otherwise every degenerate scenario reads as
  // "everything moved".
  return a.some((value, i) => {
    const other = b[i];
    if (Number.isNaN(value) && Number.isNaN(other)) return false;
    return Math.abs(value - other) > 1e-9;
  });
}

export interface Movement {
  movedViews: Set<ChartViewId>;
  movedFamilies: Set<FamilyId>;
  /** How many views in each family moved. Drives the tab indicators. */
  countByFamily: Map<FamilyId, number>;
}

const NOTHING_MOVED: Movement = {
  movedViews: new Set(),
  movedFamilies: new Set(),
  countByFamily: new Map(),
};

/**
 * Which views plot different data under `params` than under the baseline.
 *
 * `baselineSprints` is passed in rather than simulated here so the caller can
 * memoise one baseline run across the outcomes strip, the tab indicators and
 * the summary instead of running it three times.
 */
export function whatMoved(
  sprints: SprintResult[],
  params: ScenarioParams,
  baselineSprints: SprintResult[],
  baseline: ScenarioParams,
): Movement {
  if (sprints.length === 0 || baselineSprints.length === 0) return NOTHING_MOVED;

  const movedViews = new Set<ChartViewId>();
  const countByFamily = new Map<FamilyId, number>();

  for (const view of CHART_VIEWS) {
    const now = plottedValues(sprints, params, view.id);
    const before = plottedValues(baselineSprints, baseline, view.id);
    if (!differs(now, before)) continue;

    movedViews.add(view.id);
    countByFamily.set(view.family, (countByFamily.get(view.family) ?? 0) + 1);
  }

  return { movedViews, movedFamilies: new Set(countByFamily.keys()), countByFamily };
}

// ---------------------------------------------------------------------------
// Headline outcomes
// ---------------------------------------------------------------------------

export interface Outcome {
  id: string;
  label: string;
  /** The latest sprint's value. */
  value: number;
  /** The same sprint under the baseline scenario. */
  baseline: number;
  /** Every sprint, for the sparkline. The real series, not a smoothed one. */
  series: number[];
  unit: string;
  /** Decimal places for the headline figure. */
  precision: number;
  /** Rendered as a percentage rather than a bare number. */
  percent?: boolean;
  /**
   * Which way is good. Used only to colour the delta -- the number itself is
   * reported the same either way, because "worse" is often the lesson.
   */
  betterWhen: 'lower' | 'higher';
  /** The chart in the inventory that plots this, so the card can point at it. */
  view: ChartViewId;
  /** How it was computed, with this sprint's actual numbers substituted in. */
  formula: string;
  /** Why it has no slider. Read out on focus, shown on hover. */
  note: string;
}

/**
 * Reads one headline number off a sprint.
 *
 * Takes the params too, because every outcome here must be the SAME quantity
 * its chart plots -- unplanned work is drawn as a share of the sprint, so a
 * card reporting it in days would point at a chart with a different y-axis.
 */
type Read = (s: SprintResult, p: ScenarioParams) => number;

type Describe = (s: SprintResult, p: ScenarioParams) => string;

type OutcomeSpec = Omit<Outcome, 'value' | 'baseline' | 'series' | 'formula'> & {
  read: Read;
  describe: Describe;
};

// These five carry the lesson that used to live in a separate "derived
// fields" block beside the sliders: NONE of them has a control, and the
// reason each one cannot have one is different.
//
// Merging the two was forced by this redesign rather than chosen. The
// outcomes strip and the derived-fields block showed four of the same
// numbers, which is the same defect the duplicate-series sweep exists to
// catch on charts -- everything correct, nothing on screen telling the two
// apart. One place, both lessons.
const OUTCOME_SPECS: OutcomeSpec[] = [
  {
    id: 'cycleTime',
    label: 'Cycle time',
    unit: 'days',
    precision: 1,
    betterWhen: 'lower',
    view: 'cycleTime',
    read: (s) => s.flow.cycleTimeDays,
    describe: (s, p) =>
      `WIP ÷ realised throughput × sprint length = ${p.wip} ÷ ` +
      `${s.flow.deliveredItems.toFixed(2)} × ${p.sprintLengthDays}`,
    note:
      'An output, never a control. Little’s Law fixes it: the only way to move cycle ' +
      'time is to move WIP or throughput.',
  },
  {
    id: 'throughput',
    label: 'Realised throughput',
    unit: 'items/sprint',
    precision: 1,
    betterWhen: 'higher',
    view: 'throughput',
    read: (s) => s.flow.deliveredItems,
    describe: (s, p) =>
      `capacity × available capacity = ${p.throughput} × ` +
      `${(s.flow.availableCapacityFraction * 100).toFixed(0)}%`,
    note:
      'What the team actually finished, as distinct from the Capacity slider. Raising ' +
      'the WIP limit cannot raise this — WIP does not appear in the formula at all.',
  },
  {
    id: 'flowEfficiency',
    label: 'Flow efficiency',
    unit: '',
    precision: 1,
    percent: true,
    betterWhen: 'higher',
    view: 'flowEfficiency',
    read: (s) => s.flow.flowEfficiency,
    describe: (s, p) =>
      `touch time ÷ cycle time = ${(p.sprintLengthDays / p.throughput).toFixed(2)} ÷ ` +
      `${s.flow.cycleTimeDays.toFixed(2)}`,
    note:
      'The share of an item’s open time that was actual work. The rest was waiting, and ' +
      'high WIP is what creates the waiting.',
  },
  {
    id: 'unplannedWork',
    label: 'Unplanned work',
    unit: '',
    precision: 1,
    percent: true,
    betterWhen: 'lower',
    view: 'unplannedWorkShare',
    read: (s, p) => s.flow.unplannedWorkDays / p.sprintLengthDays,
    describe: (s, p) =>
      `(baseline + incident load from sprint ${s.sprint - 1}) ÷ sprint length = ` +
      `(${p.baseUnplannedDays} + ${s.carriedIn.incidentLoadDays.toFixed(2)}) ÷ ` +
      `${p.sprintLengthDays}`,
    note:
      'Arrives from the PREVIOUS sprint, which is why a bad sprint so often gets blamed ' +
      'on the wrong one.',
  },
  {
    id: 'escapedDefects',
    label: 'Escaped defects',
    unit: 'per sprint',
    precision: 2,
    betterWhen: 'lower',
    view: 'escapedDefects',
    read: (s) => s.quality.escapedDefects,
    describe: (s, p) =>
      `defects injected × escape rate = ${s.quality.defectsInjected.toFixed(2)} × ` +
      `${(p.escapeRate * 100).toFixed(0)}%`,
    note:
      'Defects that reached production. The escape RATE is a control; how many escape ' +
      'is not — that follows from how many were injected in the first place.',
  },
];

export function keyOutcomes(
  sprints: SprintResult[],
  params: ScenarioParams,
  baselineSprints: SprintResult[],
  baseline: ScenarioParams,
): Outcome[] {
  if (sprints.length === 0) return [];
  const last = sprints[sprints.length - 1];
  const baseLast = baselineSprints[baselineSprints.length - 1] ?? last;

  return OUTCOME_SPECS.map(({ read, describe, ...spec }) => ({
    ...spec,
    value: read(last, params),
    baseline: read(baseLast, baselineSprints.length > 0 ? baseline : params),
    series: sprints.map((s) => read(s, params)),
    formula: describe(last, params),
  }));
}
