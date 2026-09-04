// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { DomainState, Readiness, ReadinessState } from '../../types/subject';

type MuiColor = 'primary' | 'success' | 'warning' | 'error' | 'info';

/**
 * Colour per readiness state.
 *
 * "Needs evaluation" is deliberately neutral rather than red. It means there
 * is no measurement yet, which is not a failure and must not look like one --
 * the same reason it is never rendered as 0%.
 */
export function readinessColor(state: ReadinessState): MuiColor {
  switch (state) {
    case 'ready':
      return 'success';
    case 'plateau':
      return 'warning';
    case 'almost_there':
      return 'info';
    case 'developing':
      return 'primary';
    default:
      return 'primary';
  }
}

export function domainColor(state: DomainState): MuiColor {
  switch (state) {
    case 'solid':
      return 'success';
    case 'developing':
      return 'info';
    case 'needs_work':
      return 'error';
    default:
      return 'primary';
  }
}

/**
 * How full the readiness bar is.
 *
 * Progress toward the pass mark, not raw accuracy, because the question the
 * bar answers is "how close am I to booking" rather than "how many did I get
 * right". With no mocks the bar is empty -- that is an absence of evidence,
 * and it is why the label beside it reads "needs evaluation" rather than 0%.
 */
export function readinessProgress(r: Readiness): number {
  if (r.state === 'ready') return 100;
  if (r.mock_count === 0) return 0;

  const latest = r.recent_scores.length ? r.recent_scores[r.recent_scores.length - 1] : 0;
  if (r.pass_mark == null) {
    // No pass mark means no target to be a fraction of, so the bar shows raw
    // accuracy and the label carries the honesty.
    return Math.max(0, Math.min(100, latest));
  }
  return Math.max(0, Math.min(100, (latest / r.pass_mark) * 100));
}
