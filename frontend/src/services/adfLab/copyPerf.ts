// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { BASELINE, COPY_PERF_COUPLINGS, SCENARIO, runCopy, type CopyLevers } from './copyPerfModel';
import type { ExperimentDefinition, Levers, ModelRun } from './definition';

/**
 * ADF Behaviour Lab, experiment 4: Copy Performance (PHASE-5-CONTRACT.md, E4), on the new
 * copy-performance model. Results are modelled, never measured, and the screen says so.
 */

export const MODEL = 'copyPerfModel';

const asLevers = (l: Levers): CopyLevers => ({
  dius: l.dius as number, parallelCopies: l.parallelCopies as number, sourceGbPerHour: l.sourceGbPerHour as number,
});

const BOTTLENECK_TEXT: Record<string, string> = {
  'diu-capacity': 'The DIUs', 'thread-ceiling': 'The parallel copies', 'source-ceiling': 'The source’s read limit',
};

export function modelRun(_: unknown, l: Levers): ModelRun {
  const r = runCopy(asLevers(l));
  return {
    outcome: r.effect,
    measures: {
      minutes: { label: 'Modelled time to copy', value: r.minutes, unit: 'minutes' },
      diuHours: { label: 'DIU-hours used', value: r.diuHours, unit: 'DIU-hours' },
      bottleneck: { label: 'What limits the copy', value: BOTTLENECK_TEXT[r.bottleneck] },
      result: { label: `Against ${BASELINE.dius} DIUs and ${BASELINE.parallelCopies} parallel copies`, value: r.effect },
    },
    findings: r.findings,
  };
}

/** The baseline copy with its DIUs doubled, against a source that serves 60 GB an hour. */
export const PRESET: CopyLevers = { dius: 32, parallelCopies: 4, sourceGbPerHour: 60 };

/** The deadline in the Apply stage's changed constraint. */
export const DEADLINE_MINUTES = 240;

export const COPY_PERF: ExperimentDefinition<null> = {
  track: 'copy-perf',
  idPrefix: 'cp',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A copy activity’s speed comes from its Data Integration Units (DIUs, its compute on an Azure integration '
    + 'runtime) and its parallel copies (how many threads read and write at once). But it can go no faster than the slowest '
    + 'link, often the source system, and every DIU is paid for in DIU-hours whether it is busy or idle.',
  preset: { ...PRESET },
  levers: [
    { key: 'dius', label: 'DIUs', options: [4, 8, 16, 32, 64].map((v) => ({ value: v, label: String(v) })) },
    { key: 'parallelCopies', label: 'Parallel copies', options: [1, 2, 4, 8, 16].map((v) => ({ value: v, label: String(v) })) },
    { key: 'sourceGbPerHour', label: 'Source read limit (GB an hour)', options: [60, 120, 240].map((v) => ({ value: v, label: String(v) })) },
  ],
  heldNote: `The levers start at the scenario you predicted. The copy moves ${SCENARIO.gigabytes} GB; every rate is a teaching `
    + 'constant, and nothing is measured. Change one or more, then run the model.',
  run: modelRun,
  predict: {
    prompt: `A ${SCENARIO.gigabytes} GB copy runs with ${BASELINE.dius} DIUs and ${BASELINE.parallelCopies} parallel copies, from a source `
      + 'whose owners allow it to serve 60 GB an hour. You double the DIUs to 32. What happens to how long the copy takes?',
    options: [
      { id: 'halves', text: 'It takes about half as long' },
      { id: 'faster', text: 'It is faster, but by less than half' },
      { id: 'same', text: 'It takes no less time' },
      { id: 'slower', text: 'It takes longer' },
    ],
  },
  reason: {
    prompt: 'Why did doubling the DIUs do what it did?',
    options: [
      { id: 'source-ceiling', text: 'The source serves no faster than its read limit, so the extra DIUs sit idle' },
      { id: 'thread-ceiling', text: 'Four parallel copies could not use the extra DIUs' },
      { id: 'diu-availability', text: '32 DIUs is more than an Azure integration runtime allows' },
      { id: 'diu-capacity', text: 'The DIUs were still the limit' },
    ],
  },
  apply: {
    prompt: 'The source team raises its read limit to 240 GB an hour. The copy must now finish within four hours, using as '
      + 'few DIU-hours as possible. Which settings?',
    options: [
      { id: 'd16-pc4', text: '16 DIUs, 4 parallel copies', levers: { dius: 16, parallelCopies: 4, sourceGbPerHour: 240 } },
      { id: 'd32-pc4', text: '32 DIUs, 4 parallel copies', levers: { dius: 32, parallelCopies: 4, sourceGbPerHour: 240 } },
      { id: 'd64-pc4', text: '64 DIUs, 4 parallel copies', levers: { dius: 64, parallelCopies: 4, sourceGbPerHour: 240 } },
      { id: 'd64-pc8', text: '64 DIUs, 8 parallel copies', levers: { dius: 64, parallelCopies: 8, sourceGbPerHour: 240 } },
    ],
    // Right: within the deadline, and no option within it uses fewer DIU-hours.
    correct: (r, all) => {
      const fits = (x: ModelRun) => (x.measures.minutes.value as number) <= DEADLINE_MINUTES;
      if (!fits(r)) return false;
      const cheapest = Math.min(...all.filter(fits).map((x) => x.measures.diuHours.value as number));
      return (r.measures.diuHours.value as number) === cheapest;
    },
    right: 'The model finishes within four hours with those settings, and no other option uses fewer DIU-hours.',
    wrong: 'With those settings the model misses the four hours, or another option finishes in time for fewer DIU-hours.',
  },
  explainLabel: 'In your own words: why did doubling the DIUs do what it did, and how would you size this copy?',
  retrieve: {
    prompt: 'Where do Data Integration Units apply?',
    options: [
      { id: 'azure-ir', text: 'On an Azure integration runtime' },
      { id: 'shir', text: 'On a self-hosted integration runtime' },
      { id: 'source', text: 'On the source database' },
      { id: 'any-ir', text: 'On every kind of integration runtime' },
    ],
    answer: 'azure-ir',
    source: { chapter: 'copy', quote: 'the copy\'s power on an Azure IR, up to 256.' },
  },
  couplings: COPY_PERF_COUPLINGS,
  ledgerIntro: 'Each effect the copy-performance model applies, and the kind of claim it is. Every rate is a teaching constant: the model shows the shape of the trade-off, not how fast a real copy runs.',
};
