// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ChartPayload } from './chartData';

/**
 * What a chart shows, for anyone who cannot see the canvas: its title, its axes
 * and where each measured series ends. Reference lines are left out, as they are
 * of the headline figures -- a target is not an observation.
 */
export function chartDescription(payload: ChartPayload): string {
  const latest = payload.series
    .filter((s) => !s.reference)
    .slice(0, 4)
    .map((s) => {
      const last = [...s.data].reverse().find((v) => v != null);
      return last == null ? null : `${s.label} ${Math.round(Number(last) * 100) / 100}`;
    })
    .filter(Boolean);
  const points = payload.points?.length ? ` ${payload.points.length} points.` : '';
  return `${payload.title}: ${payload.yLabel} by ${payload.xLabel}.${latest.length ? ` Latest: ${latest.join(', ')}.` : ''}${points}`;
}

