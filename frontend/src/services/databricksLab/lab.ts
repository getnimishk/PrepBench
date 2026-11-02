// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { LAB_STAGES, type LabExperiment } from '../adfLab/experiments';
import type { LabIds } from '../adfLab/attempts';
import type { LabSpec } from '../adfLab/lab';

/**
 * The Databricks Lab (docs/implementation/DATABRICKS-LAB-CONTRACT.md): six experiments on the exam
 * topics the Lakehouse Lab's stations don't cover, on the shared runner the ADF and Kafka labs use.
 * One registry, read by the hub and each experiment page. The Lakehouse Lab (/databricks-sandbox) is
 * separate and unchanged.
 *
 * Chapters and topics are references into the Databricks content pack: every pair is a "Roadmap
 * alignment" entry in backend/app/content/packs/databricks (lab.test.ts checks each one there).
 */

export type DatabricksLabSlug = 'retention' | 'auto-loader' | 'datasets' | 'jobs' | 'skew' | 'governance';

export const DATABRICKS_PACK_ID = 'databricks';

/** The Databricks Lab's attempt ids: its own, so they never meet the ADF lab's (`ab:`) or the Kafka Lab's (`kb:`). */
export const DATABRICKS_LAB_IDS: LabIds = { uid: 'dbl', challenge: 'databricks.lab.', fingerprint: 'databricks-lab' };

export const DATABRICKS_LAB_EXPERIMENTS: LabExperiment<DatabricksLabSlug>[] = [
  {
    slug: 'retention',
    title: 'Versions, retention and VACUUM',
    purpose: 'Time travel needs both a version’s log entry and its data files, and the two are kept for different times.',
    ready: true,
    model: 'services/databricksLab/retention.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'delta-log', title: 'Delta Lake internals: the transaction log' },
      { id: 'history', title: 'History, time travel, RESTORE and VACUUM' },
    ],
    topics: [
      { number: 16, title: 'Snapshots, Tombstones and Log Replay' },
      { number: 23, title: 'Time Travel' },
      { number: 24, title: 'Log Retention vs Deleted-File Retention' },
      { number: 25, title: 'VACUUM' },
    ],
  },
  {
    slug: 'auto-loader',
    title: 'Auto Loader, schema changes and the checkpoint',
    purpose: 'Auto Loader’s default mode stops on a new column and resumes on restart; the checkpoint is what loads each file once.',
    ready: true,
    model: 'services/databricksLab/autoLoader.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'auto-loader', title: 'Auto Loader in depth' },
      { id: 'streaming', title: 'Structured Streaming: checkpoints, triggers, watermarks' },
    ],
    topics: [
      { number: 64, title: 'Auto Loader Schema Inference and Evolution' },
      { number: 65, title: 'Structured Streaming Checkpoints' },
    ],
  },
  {
    slug: 'datasets',
    title: 'Streaming tables and materialized views',
    purpose: 'A streaming table processes each row once and doesn’t recompute; a materialized view stays correct; a full refresh rebuilds.',
    ready: true,
    model: 'services/databricksLab/datasets.ts',
    stages: LAB_STAGES,
    chapters: [{ id: 'pipelines', title: 'Lakeflow Spark Declarative Pipelines' }],
    topics: [
      { number: 69, title: 'Pipeline Datasets and Flows' },
      { number: 72, title: 'Refresh vs Full Refresh' },
    ],
  },
  {
    slug: 'jobs',
    title: 'Retries, repair and duplicates',
    purpose: 'A retried or repaired task starts again from the beginning, so how it writes decides whether a rerun duplicates data.',
    ready: true,
    model: 'services/databricksLab/jobs.ts',
    stages: LAB_STAGES,
    chapters: [{ id: 'jobs', title: 'Lakeflow Jobs: orchestrating the work' }],
    topics: [
      { number: 74, title: 'Run If, Retries and Timeouts' },
      { number: 76, title: 'Triggers and Repair Runs' },
    ],
  },
  {
    slug: 'skew',
    title: 'Shuffle, skew and AQE',
    purpose: 'One hot key makes one slow task; AQE splits skewed join partitions but not aggregations, and salting spreads an aggregation.',
    ready: true,
    model: 'services/databricksLab/skew.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'performance', title: 'Performance: shuffles, skew, spill and the Spark UI' },
      { id: 'spark', title: 'Spark essentials for data engineering' },
    ],
    topics: [
      { number: 54, title: 'Spark Execution Model' },
      { number: 58, title: 'AQE, Broadcast and Shuffle Partitions' },
      { number: 59, title: 'Skew, Salting and Spill' },
    ],
  },
  {
    slug: 'governance',
    title: 'Privileges and dropped tables',
    purpose: 'Reading a table needs three privileges and schema grants reach future tables; dropping an external table leaves its files.',
    ready: true,
    model: 'services/databricksLab/governance.ts',
    stages: LAB_STAGES,
    tracks: [
      { id: 'grants', title: 'Who can read the table' },
      { id: 'drop', title: 'What a drop does to the files' },
    ],
    chapters: [
      { id: 'access', title: 'Privileges, fine-grained access, lineage and audit' },
      { id: 'tables-storage', title: 'Managed and external tables, volumes and storage access' },
    ],
    topics: [
      { number: 42, title: 'Privileges and Inheritance' },
      { number: 39, title: 'Managed vs External Tables' },
    ],
  },
];

/** AVAILABLE only once every one of the six is built. */
export const databricksLabStatus = (experiments: LabExperiment[] = DATABRICKS_LAB_EXPERIMENTS): 'AVAILABLE' | 'INTEGRATION_PENDING' =>
  experiments.length === 6 && experiments.every((e) => e.ready) ? 'AVAILABLE' : 'INTEGRATION_PENDING';

/** Does this preparation have the Databricks content pack attached? */
export const hasDatabricksPack = (prep: { content_packs?: { pack_id: string }[] } | null | undefined): boolean =>
  Boolean(prep?.content_packs?.some((cp) => cp.pack_id === DATABRICKS_PACK_ID));

export const DATABRICKS_LAB: LabSpec = {
  packId: DATABRICKS_PACK_ID,
  ids: DATABRICKS_LAB_IDS,
  name: 'Databricks Lab',
  guideName: 'the Databricks guide',
  guideTitle: 'Databricks on Azure guide',
  basePath: '/lab/databricks',
  experiments: DATABRICKS_LAB_EXPERIMENTS,
  simulation: 'Teaching simulation. PrepBench runs a small model in your browser. No Databricks workspace, cluster or table '
    + 'is involved and no figure here is a measurement; the rules the model follows come from the Databricks guide, and its '
    + 'own simplifications are listed under "What this model assumes". To do the real thing, use the guide’s Free Edition steps.',
  forWhom: 'a preparation with the Databricks guide attached',
  hubIntro: 'Six experiments on the parts of Databricks the exam tests and the Lakehouse Lab doesn’t: table history, Auto Loader, '
    + 'pipeline datasets, jobs, skew and governance. In each: predict what a small model will do, change it, watch it, and '
    + 'explain why. Every stage is recorded against this preparation.',
  status: () => databricksLabStatus(),
};
