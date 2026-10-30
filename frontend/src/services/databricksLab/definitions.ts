// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ExperimentDefinition } from '../adfLab/definition';
import type { DatabricksLabSlug } from './lab';
import { AUTO_LOADER } from './autoLoader';
import { DATASETS } from './datasets';
import { DROP, GRANTS } from './governance';
import { JOBS } from './jobs';
import { RETENTION } from './retention';
import { SKEW } from './skew';

/** Each Databricks Lab experiment's definitions, one per track (Governance has two: grants, then drop). */
export const DATABRICKS_DEFINITIONS: Record<DatabricksLabSlug, ExperimentDefinition<unknown>[]> = {
  retention: [RETENTION as ExperimentDefinition<unknown>],
  'auto-loader': [AUTO_LOADER as ExperimentDefinition<unknown>],
  datasets: [DATASETS as ExperimentDefinition<unknown>],
  jobs: [JOBS as ExperimentDefinition<unknown>],
  skew: [SKEW as ExperimentDefinition<unknown>],
  governance: [GRANTS as ExperimentDefinition<unknown>, DROP as ExperimentDefinition<unknown>],
};
