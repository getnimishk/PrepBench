// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { LAB_STAGES, type LabExperiment } from '../adfLab/experiments';
import type { LabIds } from '../adfLab/attempts';
import type { LabSpec } from '../adfLab/lab';

/**
 * The Kafka Lab (docs/implementation/KAFKA-LAB-CONTRACT.md): six experiments for a beginner, from
 * "what is a log" to "why acknowledged writes get lost", on the shared runner the ADF Behaviour Lab
 * uses. One registry, read by the hub and each experiment page.
 *
 * Chapters and topics are references into the Kafka content pack: every pair is a "Roadmap
 * alignment" entry in backend/app/content/packs/kafka (lab.test.ts checks each one there).
 */

export type KafkaLabSlug = 'log' | 'keys' | 'groups' | 'commits' | 'replication' | 'failures';

export const KAFKA_PACK_ID = 'kafka';

/** The Kafka Lab's attempt ids: its own, so they never meet the ADF lab's (`ab:`, `adf.lab.`). */
export const KAFKA_LAB_IDS: LabIds = { uid: 'kb', challenge: 'kafka.lab.', fingerprint: 'kafka-lab' };

export const KAFKA_LAB_EXPERIMENTS: LabExperiment<KafkaLabSlug>[] = [
  {
    slug: 'log',
    title: 'The log, not a queue',
    purpose: 'Records stay after they are read; each consumer group reads at its own position; a new group starts at the end unless told otherwise.',
    ready: true,
    model: 'services/kafkaLab/log.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'log', title: 'Topics, partitions and offsets' },
      { id: 'consumer', title: 'The consumer: poll loop, groups and offset commits' },
    ],
    topics: [
      { number: 3, title: 'Topics, Partitions, Offsets' },
      { number: 9, title: 'Consumer Internals' },
    ],
  },
  {
    slug: 'keys',
    title: 'Keys, partitions and order',
    purpose: 'The key decides the partition: it keeps one thing’s events in order, and a busy key makes one partition hot.',
    ready: true,
    model: 'services/kafkaLab/keys.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'log', title: 'Topics, partitions and offsets' },
      { id: 'keys', title: 'Partition keys, sizing and hot partitions' },
    ],
    topics: [
      { number: 18, title: 'Partition Key Design' },
      { number: 19, title: 'Ordering Guarantees' },
      { number: 21, title: 'Hot Partitions & Skew' },
    ],
  },
  {
    slug: 'groups',
    title: 'Consumer groups and parallelism',
    purpose: 'Each partition has one consumer in a group, so the partition count caps how many consumers can work, and lag comes from capacity.',
    ready: true,
    model: 'services/kafkaLab/groups.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'consumer', title: 'The consumer: poll loop, groups and offset commits' },
      { id: 'rebalancing', title: 'Rebalancing and consumer lag' },
    ],
    topics: [
      { number: 10, title: 'Consumer Groups & Assignment' },
      { number: 17, title: 'Consumer Lag' },
    ],
  },
  {
    slug: 'commits',
    title: 'Commits and crashes',
    purpose: 'When a consumer commits decides whether a crash loses work or repeats it; an idempotent effect makes repeats harmless.',
    ready: true,
    model: 'services/kafkaLab/commits.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'consumer', title: 'The consumer: poll loop, groups and offset commits' },
      { id: 'delivery', title: 'Delivery semantics and transactions' },
    ],
    topics: [
      { number: 11, title: 'Offset Commit Strategies' },
      { number: 12, title: 'Delivery Semantics' },
    ],
  },
  {
    slug: 'replication',
    title: 'Copies, acks and min ISR',
    purpose: 'How many copies must hold a write before it is acknowledged, and when Kafka refuses a write rather than risk it.',
    ready: true,
    model: 'services/kafkaLab/replication.ts',
    stages: LAB_STAGES,
    chapters: [
      { id: 'producer', title: 'The producer: batching, partitioning, acks and idempotence' },
      { id: 'replication', title: 'Replication, ISR and durability' },
    ],
    topics: [
      { number: 13, title: 'Producer Acknowledgements' },
      { number: 22, title: 'Replication & ISR' },
    ],
  },
  {
    slug: 'failures',
    title: 'When things go wrong',
    purpose: 'A bad record blocks its partition until it is moved aside; retrying in place, at every layer, turns an outage into a storm.',
    ready: true,
    model: 'services/kafkaLab/failures.ts',
    stages: LAB_STAGES,
    tracks: [
      { id: 'poison', title: 'A record that can’t be read' },
      { id: 'retries', title: 'A service that is down' },
    ],
    chapters: [{ id: 'failures', title: 'Poison pills, retries and dead-letter topics' }],
    topics: [
      { number: 24, title: 'Poison Pill Messages & DLQ' },
      { number: 25, title: 'Resilience Patterns' },
    ],
  },
];

/** AVAILABLE only once every one of the six is built. */
export const kafkaLabStatus = (experiments: LabExperiment[] = KAFKA_LAB_EXPERIMENTS): 'AVAILABLE' | 'INTEGRATION_PENDING' =>
  experiments.length === 6 && experiments.every((e) => e.ready) ? 'AVAILABLE' : 'INTEGRATION_PENDING';

/** Does this preparation have the Kafka content pack attached? */
export const hasKafkaPack = (prep: { content_packs?: { pack_id: string }[] } | null | undefined): boolean =>
  Boolean(prep?.content_packs?.some((cp) => cp.pack_id === KAFKA_PACK_ID));

export const KAFKA_LAB: LabSpec = {
  packId: KAFKA_PACK_ID,
  ids: KAFKA_LAB_IDS,
  name: 'Kafka Lab',
  guideName: 'the Kafka guide',
  guideTitle: 'Apache Kafka guide',
  basePath: '/lab/kafka',
  experiments: KAFKA_LAB_EXPERIMENTS,
  simulation: 'Teaching simulation. PrepBench runs a small model of a Kafka cluster in your browser. No broker runs and no '
    + 'figure here is a measurement; the rules the model follows come from the Kafka guide, and its own simplifications are '
    + 'listed under "What this model assumes". To see the real thing, use the guide’s "Try it on your cluster" steps.',
  forWhom: 'a preparation with the Apache Kafka guide attached',
  hubIntro: 'Six experiments for someone who has never seen Kafka run, from what a log is to why an acknowledged write can '
    + 'be lost. In each: predict what a small simulated cluster will do, change it, watch it, and explain why. Every stage '
    + 'is recorded against this preparation.',
  status: () => kafkaLabStatus(),
};
