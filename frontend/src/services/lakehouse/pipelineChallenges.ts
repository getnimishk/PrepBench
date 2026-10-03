// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { defaultAdlsLevers, type AccessOutcome, type AccessResult, type AdlsConfig, type AdlsLevers } from './adlsModel';
import { DEFAULT_LEVERS, type AdfConfig, type AdfLevers, type BatchManifest } from './adfModel';

// The one prediction each of Stations A and B asks, and how the browser's model reads its
// own result back as one of the options. As with Station F's tiering, the outcome is worked
// out by a deterministic model in the browser, and the attempt is closed with
// `observed.source = "simulation"`, so it is never mistaken for an engine result.
//
// Not in services/learning/challenges.ts: that registry is the Chart Sandbox's, and the lab's
// attempts are told apart by their `lakehouse.` ids (see attempts.ts).

export interface PipelineChallenge<Outcome extends string> {
  id: string;
  conceptId: string;
  title: string;
  prompt: string;
  options: { id: Outcome; text: string }[];
  /** What each outcome means. Said after the prediction is committed, never before. */
  reveal: Record<Outcome, string>;
}

// ---- Station A ------------------------------------------------------------------------

export type WatermarkOutcome = 'complete' | 'duplicates' | 'missing' | 'both';

export const WATERMARK_CHALLENGE: PipelineChallenge<WatermarkOutcome> = {
  id: 'lakehouse.a.watermark-order',
  conceptId: 'lakehouse.a.watermark-order',
  title: 'The watermark moves before the copy',
  prompt: 'The watermark is stored before the copy starts. The copy then fails about 60% of the way through, and nothing retries it. After the next run has picked up what it can, what does the destination hold for this batch?',
  options: [
    { id: 'complete', text: 'Every row, once' },
    { id: 'duplicates', text: 'Every row, and some of them twice' },
    { id: 'missing', text: 'Some rows never arrive' },
    { id: 'both', text: 'Some rows are missing and some are repeated' },
  ],
  reveal: {
    complete: 'Every row landed once.',
    duplicates: 'Rows were written twice. Check which setting repeated them.',
    missing: 'The watermark had already moved past rows that were never copied, so the next run started after them. A watermark stored before the work is done records progress that did not happen.',
    both: 'Some rows were lost and some repeated at the same time.',
  },
};

/** The scenario the prediction is about, as levers. */
export const watermarkPreset = (config: AdfConfig): AdfLevers => ({
  ...DEFAULT_LEVERS, watermark: 'before', failureAtPercent: config.defaultFailurePercent, retries: 0,
});

/** What a manifest amounts to, as one of the prediction's options. */
export function classifyManifest(m: Pick<BatchManifest, 'missed' | 'duplicated'>): WatermarkOutcome {
  if (m.missed.length > 0 && m.duplicated.length > 0) return 'both';
  if (m.missed.length > 0) return 'missing';
  if (m.duplicated.length > 0) return 'duplicates';
  return 'complete';
}

// ---- Station B ------------------------------------------------------------------------

export type AccessChoice = 'allowed' | 'denied' | 'too-broad';

export const ACCESS_CHALLENGE: PipelineChallenge<AccessChoice> = {
  id: 'lakehouse.b.vendor-access',
  conceptId: 'lakehouse.b.vendor-access',
  title: 'Access for one folder',
  prompt: 'vendor-x needs write access to bronze/vendor-x/ and nothing else. It is given a directory ACL with read, write and execute on that folder, and nothing on the folders above it. Can it write there?',
  options: [
    { id: 'allowed', text: 'Yes, and only there' },
    { id: 'denied', text: 'No: it is stopped before it reaches the folder' },
    { id: 'too-broad', text: 'Yes, but it can write to other folders too' },
  ],
  reveal: {
    allowed: 'The folder’s own permissions were enough, with execute on each parent.',
    denied: 'To reach a folder a principal needs execute on every folder above it. Permissions on the target alone are not enough.',
    'too-broad': 'The grant reached further than the request.',
  },
};

/** The scenario the prediction is about: the ACL on the folder, nothing on the parents. */
export const accessPreset = (config: AdlsConfig): AdlsLevers => defaultAdlsLevers(config);

export function classifyAccess(r: Pick<AccessResult, 'outcome'>): AccessChoice {
  const outcome: AccessOutcome = r.outcome;
  // Without a hierarchical namespace there is no ACL to grant, so the nearest reading is "too broad".
  return outcome === 'unavailable' ? 'too-broad' : outcome;
}

