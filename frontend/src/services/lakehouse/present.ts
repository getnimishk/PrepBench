// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { JournalEntry, LabOperationResult } from '../../types/lakehouse';
import { fmt, monthOf, type FactoryRun } from './factoryModel';

// How the lab words what it was told: only what the engine or the journal reported.

const count = (n: number, noun: string) => `${n.toLocaleString('en-GB')} ${noun}${n === 1 ? '' : 's'}`;

/** The result's headline: only what the engine reported, in the order it matters. */
export function resultSummary(r: LabOperationResult): string {
  const parts: string[] = [];
  if (r.version != null) parts.push(`Table at version ${r.version}`);
  if (r.rows != null) parts.push(count(r.rows, 'row'));
  if (r.files != null) parts.push(count(r.files, 'file'));
  return parts.join(' · ');
}

/** One line saying what the entry's result was, from the stored result and nothing else. */
export function entrySummary(e: JournalEntry): string {
  const r = e.result as Record<string, unknown>;
  const parts: string[] = [];
  if (r.ok === false) parts.push(typeof r.error === 'string' ? `Refused: ${r.error}` : 'Refused');
  if (typeof r.version === 'number') parts.push(`v${r.version}`);
  if (typeof r.rows === 'number') parts.push(`${r.rows.toLocaleString('en-GB')} rows`);
  if (typeof r.files === 'number') parts.push(`${r.files} files`);
  if (typeof r.note === 'string') parts.push(r.note);
  return parts.join(' · ');
}

/** The text a screen reader gets in place of the picture. The wave table below it has the rest. */
export function timelineSummary(run: FactoryRun): string {
  const row = (label: string, p: FactoryRun['count']) =>
    `${label}: promised month ${monthOf(p.plannedEnd)}, ended month ${monthOf(p.actualEnd)}, ${
      p.lateness > 1 ? `${fmt(p.lateness)} months late` : 'on plan'}`;
  return `Programme timeline in months. ${row('Plan by job count', run.count)}. ${row('Plan weighted by complexity', run.weighted)}.`;
}
