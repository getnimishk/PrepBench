// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { DesignReviewChoice } from '../types/designReview';

const DOMAIN_LABELS: Record<string, string> = {
  data_platform: 'Data Platform',
  ai_platform: 'AI Platform',
  request_serving: 'Request Serving',
};

/** A review's domain as a person would write it. */
export const domainLabel = (value: string) =>
  DOMAIN_LABELS[value] ?? value.replace(/_/g, ' ');

export const CHOICE_LABELS: Record<DesignReviewChoice, string> = {
  A: 'Option A',
  B: 'Option B',
  ask_first: 'Neither — I would ask first',
};

export const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
