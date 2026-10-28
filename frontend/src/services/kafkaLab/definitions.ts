// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ExperimentDefinition } from '../adfLab/definition';
import type { KafkaLabSlug } from './lab';
import { COMMITS } from './commits';
import { POISON, RETRIES } from './failures';
import { GROUPS } from './groups';
import { KEYS } from './keys';
import { LOG } from './log';
import { REPLICATION } from './replication';

/** Each Kafka Lab experiment's definitions, one per track (Failures has two: poison, then retries). */
export const KAFKA_DEFINITIONS: Record<KafkaLabSlug, ExperimentDefinition<unknown>[]> = {
  log: [LOG as ExperimentDefinition<unknown>],
  keys: [KEYS as ExperimentDefinition<unknown>],
  groups: [GROUPS as ExperimentDefinition<unknown>],
  commits: [COMMITS as ExperimentDefinition<unknown>],
  replication: [REPLICATION as ExperimentDefinition<unknown>],
  failures: [POISON as ExperimentDefinition<unknown>, RETRIES as ExperimentDefinition<unknown>],
};
