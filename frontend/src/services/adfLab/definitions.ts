// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { CONCURRENCY } from './concurrency';
import { COPY_PERF } from './copyPerf';
import type { ExperimentDefinition } from './definition';
import type { AdfLabSlug } from './experiments';
import { FAULT_TOLERANCE_BAD_ROWS, FAULT_TOLERANCE_DEPENDENCY } from './faultTolerance';
import { TRIGGERS } from './triggers';
import { WATERMARK } from './watermark';

/**
 * Each built experiment's definitions, by slug: one, or one per fault mode in the order of the
 * registry's `tracks`. Kept apart from experiments.ts so the capability logic can read the
 * registry without importing a single model.
 */
export const DEFINITIONS: Partial<Record<AdfLabSlug, ExperimentDefinition<unknown>[]>> = {
  watermark: [WATERMARK],
  triggers: [TRIGGERS],
  concurrency: [CONCURRENCY],
  'copy-perf': [COPY_PERF],
  'fault-tolerance': [FAULT_TOLERANCE_DEPENDENCY, FAULT_TOLERANCE_BAD_ROWS],
};
