// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { RoadmapProgress } from '../../types/roadmap';

/**
 * How a possibly-null percentage should be shown.
 *
 * The backend returns null (never 0) whenever a percentage isn't computable,
 * so every render site has to distinguish "0% done" from "nothing to measure".
 * Centralising it here means that distinction can't quietly decay into
 * `pct ?? 0` at one call site and read as a fabricated zero.
 */
export function formatPercentage(value: number | null): string {
  return value === null || value === undefined ? '—' : `${value}%`;
}

/** Value for a progress bar, and whether the bar means anything at all. */
export function progressBarValue(value: number | null): { value: number; meaningful: boolean } {
  if (value === null || value === undefined) return { value: 0, meaningful: false };
  return { value, meaningful: true };
}

export function progressCaption(progress: RoadmapProgress): string {
  if (progress.total_topics === 0) return 'No topics yet';
  const parts = [`${progress.completed_count} of ${progress.total_topics} done`];
  if (progress.in_progress_count > 0) parts.push(`${progress.in_progress_count} in progress`);
  if (progress.skipped_count > 0) parts.push(`${progress.skipped_count} skipped`);
  return parts.join(' · ');
}

export function hoursCaption(progress: RoadmapProgress): string | null {
  if (progress.total_estimated_hours === null || progress.total_estimated_hours === undefined) {
    return null;
  }
  const done = progress.completed_estimated_hours ?? 0;
  return `${done}h of ${progress.total_estimated_hours}h`;
}
