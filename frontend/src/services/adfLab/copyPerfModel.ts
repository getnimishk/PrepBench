// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { Finding } from './definition';

/**
 * The ADF Behaviour Lab's copy-performance model (PHASE-5-CONTRACT.md, E4): a copy runs only as
 * fast as its slowest link, so DIUs or parallel copies help until another limit binds, and every
 * DIU still costs DIU-hours.
 *
 * Why a new model: the Lakehouse Lab's ADF model counts rows, not throughput, so it cannot
 * express this. Same pattern as it: pure, deterministic, every effect on COPY_PERF_COUPLINGS.
 *
 * A teaching model of cause and effect, not a benchmark. Every rate below is a teaching constant
 * chosen to make the bottlenecks visible; none is a measurement or a promise of what Azure Data
 * Factory achieves, and nothing here runs a copy. Cost is in DIU-hours, the unit ADF bills copy
 * compute in; no price is assumed.
 */

export const SCENARIO = {
  /** How much the copy moves. */
  gigabytes: 500,
  /** What one DIU moves in an hour, in this model. */
  gbPerDiuHour: 4,
  /** What one parallel copy (a thread) moves in an hour, in this model. */
  gbPerThreadHour: 40,
} as const;

/** What the predict scenario is compared against: the copy before anyone changed it. */
export const BASELINE = { dius: 16, parallelCopies: 4 } as const;

export interface CopyLevers {
  dius: number;
  parallelCopies: number;
  /** The most the source serves in an hour, in GB: its owners' read limit. */
  sourceGbPerHour: number;
}

export type Bottleneck = 'diu-capacity' | 'thread-ceiling' | 'source-ceiling';
/** The run against the baseline on the same source. */
export type Effect = 'halves' | 'faster' | 'same' | 'slower';

export interface CopyResult {
  ratePerHour: number;
  limits: Record<Bottleneck, number>;
  bottleneck: Bottleneck;
  minutes: number;
  diuHours: number;
  effect: Effect;
  findings: Finding[];
}

const positiveWhole = (x: number, max: number, what: string) => {
  if (!Number.isInteger(x) || x < 1 || x > max) throw new RangeError(`${what} must be a whole number from 1 to ${max}; got ${x}.`);
};

function core(l: CopyLevers, s: typeof SCENARIO) {
  // The guide: DIUs are "the copy's power on an Azure IR, up to 256"; parallel copies are threads, 1 to 32.
  positiveWhole(l.dius, 256, 'DIUs');
  positiveWhole(l.parallelCopies, 32, 'Parallel copies');
  if (!(l.sourceGbPerHour > 0)) throw new RangeError(`The source's read limit must be positive; got ${l.sourceGbPerHour}.`);
  const limits: Record<Bottleneck, number> = {
    'diu-capacity': l.dius * s.gbPerDiuHour,
    'thread-ceiling': l.parallelCopies * s.gbPerThreadHour,
    'source-ceiling': l.sourceGbPerHour,
  };
  // Ties go to the source, then the threads: the limit the copy cannot buy its way past.
  const order: Bottleneck[] = ['source-ceiling', 'thread-ceiling', 'diu-capacity'];
  const ratePerHour = Math.min(...order.map((b) => limits[b]));
  const bottleneck = order.find((b) => limits[b] === ratePerHour)!;
  const hours = s.gigabytes / ratePerHour;
  return { limits, ratePerHour, bottleneck, minutes: Math.round(hours * 60), diuHours: Math.round(l.dius * hours) };
}

export function runCopy(l: CopyLevers, s: typeof SCENARIO = SCENARIO): CopyResult {
  const r = core(l, s);
  const base = core({ ...BASELINE, sourceGbPerHour: l.sourceGbPerHour }, s);
  const ratio = r.minutes / base.minutes;
  const effect: Effect = ratio <= 0.55 ? 'halves' : ratio < 0.95 ? 'faster' : ratio <= 1.05 ? 'same' : 'slower';

  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  const idleDius = r.limits['diu-capacity'] > r.ratePerHour;
  const name: Record<Bottleneck, string> = {
    'diu-capacity': `the DIUs (${l.dius} × ${s.gbPerDiuHour} GB an hour)`,
    'thread-ceiling': `the parallel copies (${l.parallelCopies} × ${s.gbPerThreadHour} GB an hour)`,
    'source-ceiling': `the source’s read limit (${l.sourceGbPerHour} GB an hour)`,
  };
  add('slowest-link', `The copy runs at ${r.ratePerHour} GB an hour, set by ${name[r.bottleneck]}.`, 'info');
  if (r.bottleneck === 'diu-capacity') {
    add('diu-capacity', 'The DIUs are the limit here: more of them would make this copy faster.', 'info');
  } else {
    add(r.bottleneck, `${r.bottleneck === 'source-ceiling' ? 'The source' : 'The parallel copies'} cannot keep up with `
      + `${l.dius} DIUs, which could move ${r.limits['diu-capacity']} GB an hour${idleDius ? ': the extra DIUs sit idle and are still paid for' : ''}.`,
      idleDius ? 'problem' : 'info');
  }
  add('diu-hours', `${l.dius} DIUs for ${(r.minutes / 60).toFixed(1)} hours: ${r.diuHours} DIU-hours.`, 'info');
  return { ...r, effect, findings };
}

export const COPY_PERF_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'slowest-link', type: 'arithmetic',
    formula: 'rate = the least of: DIUs × 4 GB/h, parallel copies × 40 GB/h, the source’s read limit',
    uiLabel: 'Model arithmetic: the copy moves data only as fast as its slowest link.',
    effect: 'Raising a link that is not the slowest changes nothing but the bill.',
  },
  {
    id: 'diu-capacity', type: 'assumption',
    formula: 'one DIU moves 4 GB an hour',
    uiLabel: 'Teaching constant: one DIU moves 4 GB an hour here. Not a measurement; real throughput depends on the source, sink, network and integration runtime.',
    effect: 'More DIUs → more capacity, until another link is slower.',
  },
  {
    id: 'thread-ceiling', type: 'assumption',
    formula: 'one parallel copy moves 40 GB an hour',
    uiLabel: 'Teaching constant: one parallel copy (a thread) moves 40 GB an hour here. Not a measurement.',
    effect: 'Too few parallel copies → DIUs wait on the threads.',
  },
  {
    id: 'source-ceiling', type: 'assumption',
    formula: 'the source serves at most its read limit',
    uiLabel: 'Scenario assumption: the source’s owners allow at most a fixed read rate. The ADF guide: every knob that adds speed adds cost or load on someone else’s system.',
    effect: 'A source at its limit → more DIUs or threads cannot make the copy faster.',
  },
  {
    id: 'diu-hours', type: 'arithmetic',
    formula: 'DIU-hours = DIUs × hours',
    uiLabel: 'Model arithmetic: copy compute is counted in DIU-hours, the DIUs times how long they run. No price is assumed.',
    effect: 'Idle DIUs still count → a copy that is no faster can cost more.',
  },
  {
    id: 'diu-availability', type: 'fact',
    formula: 'DIUs apply on an Azure integration runtime, up to 256',
    uiLabel: 'From the ADF guide: DIUs are the copy’s power on an Azure integration runtime, up to 256. This model offers a few values; which are available depends on the runtime and the copy.',
    effect: 'DIUs are not a setting of a self-hosted integration runtime.',
  },
  {
    id: 'not-measured', type: 'convention',
    formula: 'a 500 GB copy; every figure modelled',
    uiLabel: 'Teaching convention: a 500 GB copy, modelled in your browser. No copy runs, and no figure is a cloud measurement or a benchmark.',
    effect: 'The shape of the trade-off is the lesson; the numbers are illustrations.',
  },
];
