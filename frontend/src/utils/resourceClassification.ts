// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { Tone } from '../components/ui/primitives';

/**
 * Classifies a roadmap resource / sheet for UI presentation.
 *
 * The underlying model persists strictly as purpose: 'plan' | 'reference'.
 * This helper provides descriptive presentation badges and tones.
 */
export function classifyResource(
  title: string,
  purpose: 'plan' | 'reference' = 'reference',
): {
  label: string;
  tone: Tone;
} {
  const lower = title.toLowerCase();
  if (lower.includes('course')) {
    return { label: 'Course Reference', tone: 'accent' };
  }
  if (lower.includes('project')) {
    return purpose === 'reference'
      ? { label: 'Project Reference', tone: 'accent' }
      : { label: 'Project Plan', tone: 'neutral' };
  }
  return purpose === 'reference'
    ? { label: 'Reference Sheet', tone: 'neutral' }
    : { label: 'Planning Sheet', tone: 'neutral' };
}
