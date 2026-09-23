// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/** 95 → "01:35". */
export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export type WindowFit = 'short' | 'inside' | 'over';

/** Where an answer's length sits against the round's target window. */
export const windowFit = (seconds: number, min: number, max: number): WindowFit =>
  seconds < min ? 'short' : seconds <= max ? 'inside' : 'over';

export const WINDOW_FIT_LABEL: Record<WindowFit, string> = {
  short: 'short of the target length',
  inside: 'inside the target length',
  over: 'over the target length',
};

/** What to say while the answer is running. */
export const windowPrompt = (seconds: number, min: number, max: number): string => {
  const fit = windowFit(seconds, min, max);
  if (fit === 'short') return `aim for ${formatClock(min)}–${formatClock(max)}`;
  if (fit === 'inside') return 'in the target window';
  return 'over — start landing it';
};

/** "Answered 3×" or "New". */
export const practisedLabel = (count: number): string =>
  count > 0 ? `answered ${count}×` : 'never answered';
