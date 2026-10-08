// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The ADF Behaviour Lab's five experiments (docs/implementation/PHASE-5-CONTRACT.md, scope
 * frozen at five). One registry, read by the hub and by each experiment page.
 *
 * `ready` is true only for an experiment that has met its completion criteria. It is not the
 * lab's availability: that is `learningLabStatus` in services/capabilities.ts, which stays
 * INTEGRATION_PENDING until all five are ready.
 *
 * Topics and chapters are references into the ADF content pack, not curriculum of our own:
 * every pair is a "Roadmap alignment" entry in backend/app/content/packs/adf/v1.json, and
 * experiments.test.ts checks each one there so they cannot drift.
 */

export type AdfLabSlug = 'watermark' | 'triggers' | 'concurrency' | 'copy-perf' | 'fault-tolerance';

/** The ADF content pack the lab belongs to; a preparation without it is not an ADF one. */
export const ADF_PACK_ID = 'adf';

/** The PrepBench learning loop every experiment runs (services/adfLab/stages.ts holds the same list). */
export const LAB_STAGES = ['Understand', 'Predict', 'Manipulate', 'Observe', 'Reason', 'Apply', 'Explain', 'Retrieve'] as const;

/** How every experiment's attempts are kept: the same for all five. */
export const PERSISTENCE = 'learning_attempts through LearningService. One run is four rows (Predict, Reason, Apply, Retrieve) '
  + 'sharing the uid prefix ab:<preparation>:<track>:r<run>: and one scenario_fingerprint; Manipulate and Observe are the '
  + 'Predict row’s write-once manipulation and observed, Explain its explanation_text. A finished run is never edited: '
  + 'starting again is run n+1.';

export interface AdfLabExperiment {
  slug: AdfLabSlug;
  title: string;
  /** One sentence: what the learner comes away understanding. */
  purpose: string;
  ready: boolean;
  /** The production model the experiment runs, by module. */
  model: string;
  /** The eight stages, the same for every experiment. */
  stages: typeof LAB_STAGES;
  /** For an experiment with fault modes: each mode is a track, run through all eight stages on its own. */
  tracks?: { id: string; title: string }[];
  /** Study Guide chapters in the ADF pack, by chapter id. */
  chapters: { id: string; title: string }[];
  /** ADF roadmap topics, by the roadmap's own numbering (1-60), with the pack's titles. */
  topics: { number: number; title: string }[];
}

export const ADF_LAB_EXPERIMENTS: AdfLabExperiment[] = [
  {
    slug: 'watermark',
    title: 'Watermark & Transient Failure',
    purpose: 'When the watermark is stored, whether a failed copy is retried, and whether the sink is idempotent decide '
      + 'together whether rows are lost, repeated or neither.',
    ready: true,
    model: 'services/lakehouse/adfModel.ts (runPipeline), the Lakehouse Lab’s ADF model',
    stages: LAB_STAGES,
    chapters: [
      { id: 'incremental', title: 'Loading only new data' },
      { id: 'recovery', title: 'Recovering from failures' },
    ],
    topics: [
      { number: 32, title: 'Watermark Patterns' },
      { number: 50, title: 'Reliability, Idempotency and Recovery' },
    ],
  },
  {
    slug: 'triggers',
    title: 'Trigger Behaviour',
    purpose: 'Schedule, tumbling-window and storage-event triggers treat the same late or out-of-order file differently.',
    ready: true,
    model: 'services/lakehouse/adfModel.ts (runPipeline), the Lakehouse Lab’s ADF model',
    stages: LAB_STAGES,
    chapters: [{ id: 'triggers', title: 'Triggers: when pipelines run' }],
    topics: [
      { number: 16, title: 'Schedule Triggers' },
      { number: 17, title: 'Tumbling Window Triggers' },
      { number: 18, title: 'Event and Custom Event Triggers' },
      { number: 19, title: 'Time Zones and Window Semantics' },
    ],
  },
  {
    slug: 'concurrency',
    title: 'Concurrency Budget',
    purpose: 'Pipeline concurrency, ForEach batch count and parallel copies multiply into load on a source with a limit.',
    ready: true,
    model: 'services/adfLab/concurrencyModel.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'pipelines', title: 'Pipelines, activities and control flow' },
      { id: 'fine-tuning', title: 'Fine-tuning copies and data flows' },
    ],
    topics: [
      { number: 12, title: 'ForEach, Batch Count and Parallelism' },
      { number: 53, title: 'Scale and Concurrency Trade-offs' },
    ],
  },
  {
    slug: 'copy-perf',
    title: 'Copy Performance',
    purpose: 'More DIUs or parallel copies stop helping once another bottleneck binds, and every step costs something.',
    ready: true,
    model: 'services/adfLab/copyPerfModel.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'copy', title: 'The Copy activity' },
      { id: 'fine-tuning', title: 'Fine-tuning copies and data flows' },
      { id: 'performance-cost', title: 'Performance and cost' },
    ],
    topics: [
      { number: 25, title: 'Copy Activity Fundamentals' },
      { number: 51, title: 'Copy Performance: DIUs, Parallel Copies and Bottlenecks' },
      { number: 52, title: 'ADF Cost Model and FinOps' },
    ],
  },
  {
    slug: 'fault-tolerance',
    title: 'Fault Tolerance',
    purpose: 'A pipeline can report success while steps or rows were lost, unless failures are routed or kept.',
    ready: true,
    model: 'services/adfLab/faultToleranceModel.ts',
    stages: LAB_STAGES,
    tracks: [
      { id: 'dependency', title: 'Dependency failure paths' },
      { id: 'bad-rows', title: 'Bad-row handling' },
    ],
    chapters: [
      { id: 'pipelines', title: 'Pipelines, activities and control flow' },
      { id: 'monitoring', title: 'Monitoring, failures and reruns' },
      { id: 'recovery', title: 'Recovering from failures' },
      { id: 'bad-rows', title: 'Bad rows, cut-off values and "verified" copies' },
      { id: 'sensitive-data', title: 'Sensitive data in regulated industries' },
    ],
    topics: [
      { number: 10, title: 'Dependencies: Success, Failure, Completion and Skip' },
      { number: 44, title: 'Monitoring, Alerts and Run History' },
      { number: 50, title: 'Reliability, Idempotency and Recovery' },
      { number: 27, title: 'Schema Mapping and Type Conversion' },
      { number: 28, title: 'Fault Tolerance and Skipped Rows' },
      { number: 45, title: 'Operational Logging and Sensitive Data' },
    ],
  },
];

export const adfLabExperiment = (slug: string | undefined): AdfLabExperiment | null =>
  ADF_LAB_EXPERIMENTS.find((e) => e.slug === slug) ?? null;

/** Does this preparation have the ADF content pack attached? The lab is only for one that does. */
export const hasAdfPack = (prep: { content_packs?: { pack_id: string }[] } | null | undefined): boolean =>
  Boolean(prep?.content_packs?.some((cp) => cp.pack_id === ADF_PACK_ID));

/** The tracks an experiment runs: its slug alone, or slug.mode for each fault mode. */
export const tracksOf = (e: AdfLabExperiment): string[] =>
  e.tracks ? e.tracks.map((t) => `${e.slug}.${t.id}`) : [e.slug];

/**
 * The lab's availability, from the registry: AVAILABLE only once every experiment is built.
 * services/capabilities.ts reads this for any preparation with the ADF pack; a lab that is
 * missing even one experiment stays INTEGRATION_PENDING.
 */
export const adfLabStatus = (experiments: AdfLabExperiment[] = ADF_LAB_EXPERIMENTS): 'AVAILABLE' | 'INTEGRATION_PENDING' =>
  experiments.length === 5 && experiments.every((e) => e.ready) ? 'AVAILABLE' : 'INTEGRATION_PENDING';
