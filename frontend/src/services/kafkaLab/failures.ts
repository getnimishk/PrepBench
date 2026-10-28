// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Kafka Lab, experiment 6: When things go wrong (KAFKA-LAB-CONTRACT.md, E6), in two modes, each its
 * own track through the eight stages:
 *   poison  -- one record in a partition can never be read; what the consumer does about it decides
 *              whether the partition is stuck, moves on silently, or moves on keeping the record;
 *   retries -- a service the consumer calls is down for 40 minutes; where retries happen, how many
 *              layers retry, and a circuit breaker decide between a storm, a stalled group and recovery.
 * Pure and deterministic.
 */

export const SOURCES = ['§1', '§2', '§20', '§22', '§23'];

// ---- poison ---------------------------------------------------------------------------------------

export const POISON_MODEL = 'kafkaLab.failures.poison';
export const RECORDS = 10;
/** The offset that can't be deserialized. */
export const BAD = 4;

export type Handling = 'crash' | 'skip' | 'dlq';
export type PoisonOutcome = 'stuck' | 'lost-silently' | 'flowing-kept';

export interface PoisonResult {
  outcome: PoisonOutcome;
  processed: number;
  waiting: number;
  inDeadLetter: number;
  findings: Finding[];
}

export function runPoison(handling: Handling): PoisonResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  add('deser-error', `Offset ${BAD} is plain text in a JSON topic: reading it throws a deserialization error naming its partition and offset.`, 'info');
  if (handling === 'crash') {
    add('no-skip', `The consumer crashes, restarts from its committed offset, meets offset ${BAD} again and crashes again. It never moves past it by itself: ${RECORDS - BAD - 1} good records behind it wait.`, 'problem');
    return { outcome: 'stuck', processed: BAD, waiting: RECORDS - BAD, inDeadLetter: 0, findings };
  }
  if (handling === 'skip') {
    add('skip-silent', `The consumer skips offset ${BAD} and carries on. The partition moves, but nothing keeps the bad record: no one can see what it was or fix and replay it.`, 'problem');
    return { outcome: 'lost-silently', processed: RECORDS - 1, waiting: 0, inDeadLetter: 0, findings };
  }
  add('dlq', `The consumer writes offset ${BAD}’s raw bytes, with its partition, offset and error, to a dead-letter topic, then seeks past it. The partition moves on and the record is kept for someone to inspect and replay.`, 'ok');
  return { outcome: 'flowing-kept', processed: RECORDS - 1, waiting: 0, inDeadLetter: 1, findings };
}

function poisonPicture(r: PoisonResult): LabPicture {
  return {
    lanes: [
      {
        label: 'orders, partition 0',
        cells: Array.from({ length: RECORDS }, (_, i) => (i === BAD
          ? { label: String(i), tone: 'bad' as const, spoken: `offset ${i}, unreadable` }
          : i < BAD || r.outcome !== 'stuck'
            ? { label: String(i), tone: 'good' as const, spoken: `offset ${i}, processed` }
            : { label: String(i), tone: 'muted' as const, spoken: `offset ${i}, waiting` })),
        markers: r.outcome === 'stuck' ? [{ at: BAD, label: 'stuck here' }] : [],
      },
      {
        label: 'orders.dlq (dead-letter topic)',
        cells: r.inDeadLetter ? [{ label: `from ${BAD}`, tone: 'accent' as const, spoken: `the record from offset ${BAD}, with its error` }] : [],
      },
    ],
    legend: [
      { tone: 'good', label: 'Processed' },
      { tone: 'bad', label: 'Unreadable record' },
      ...(r.outcome === 'stuck' ? [{ tone: 'muted' as const, label: 'Waiting behind it' }] : []),
      ...(r.inDeadLetter ? [{ tone: 'accent' as const, label: 'Kept in the dead-letter topic' }] : []),
    ],
  };
}

export function poisonRun(_: unknown, levers: Levers): ModelRun {
  const r = runPoison(levers.handling as Handling);
  return {
    outcome: r.outcome,
    measures: {
      processed: { label: 'Good records processed', value: r.processed, unit: `of ${RECORDS - 1}` },
      waiting: { label: 'Records stuck behind the bad one', value: Math.max(0, r.waiting - 1) },
      kept: { label: 'Bad records kept for inspection', value: r.inDeadLetter },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: poisonPicture(r),
  };
}

export const POISON_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'deser-error', type: 'fact',
    formula: 'an unreadable record makes poll throw, naming its partition and offset',
    uiLabel: 'From the Kafka guide (chapter 14): in a plain Java consumer, poll throws RecordDeserializationException with the partition and offset.',
    effect: 'The consumer learns exactly which record is bad.',
  },
  {
    id: 'no-skip', type: 'fact',
    formula: 'the consumer won’t move past a record by itself',
    uiLabel: 'From the Kafka guide (chapter 14): Kafka keeps delivering the same bad record until your code decides what to do.',
    effect: 'Crashing and restarting meets the same record forever.',
  },
  {
    id: 'dlq', type: 'fact',
    formula: 'plain consumer: no built-in dead-letter topic; your code writes it and seeks past',
    uiLabel: 'From the Kafka guide (chapter 14): the plain consumer has no dead-letter topic built in: your code writes the record to one and seeks past it.',
    effect: 'The partition moves on and the bad record is kept.',
  },
  {
    id: 'skip-silent', type: 'assumption',
    formula: '“skip” = log and continue, keeping nothing',
    uiLabel: 'Model assumption: “skip” means the consumer logs one line and moves past, keeping no copy of the record. That is the default of Kafka Streams’ LogAndContinue handler, and of many hand-written consumers.',
    effect: 'Moving on without keeping the record loses it for good.',
  },
];

export const POISON: ExperimentDefinition<null> = {
  track: 'failures.poison',
  idPrefix: 'kfp',
  model: POISON_MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A consumer reads a partition in order. Sometimes one record can never be processed: it was written in the '
    + 'wrong format, so reading it fails every time. Kafka doesn’t skip it for you. Retrying can’t help, because the record '
    + 'itself is the problem, so the consumer’s code has to decide what to do with it.',
  preset: { handling: 'crash' },
  levers: [
    { key: 'handling', label: 'What the consumer does with a record it can’t read', options: [
      { value: 'crash', label: 'Crash and restart' },
      { value: 'skip', label: 'Skip it and carry on' },
      { value: 'dlq', label: 'Send it to a dead-letter topic, then carry on' },
    ] },
  ],
  heldNote: `Ten records, offsets 0 to 9; offset ${BAD} is unreadable. The lever starts at the scenario you predicted. Change it, then run the model.`,
  run: poisonRun,
  predict: {
    prompt: `A consumer reads ten orders. Offset ${BAD} was written as plain text into a JSON topic, so reading it fails. `
      + 'The consumer crashes on an error and the platform restarts it. What happens?',
    options: [
      { id: 'stuck', text: `The partition is stuck at offset ${BAD}: the records behind it are never processed` },
      { id: 'lost-silently', text: 'Kafka skips the bad record and the rest are processed' },
      { id: 'flowing-kept', text: 'Kafka moves the bad record to a dead-letter topic automatically' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, what caused the result?',
    options: [
      { id: 'no-skip', text: 'A consumer won’t move past a record by itself, so every restart meets the same record' },
      { id: 'retention', text: 'Retention deleted the records behind it' },
      { id: 'rebalance', text: 'The group kept rebalancing' },
      { id: 'dlq', text: 'The dead-letter topic was full' },
    ],
  },
  apply: {
    prompt: 'The partition must keep moving, and no record may be lost without a trace. Which handling does it?',
    options: [
      { id: 'dlq', text: 'Send it to a dead-letter topic, then carry on', levers: { handling: 'dlq' } },
      { id: 'skip', text: 'Skip it and carry on', levers: { handling: 'skip' } },
      { id: 'crash', text: 'Crash and restart, with more restarts allowed', levers: { handling: 'crash' } },
    ],
    correct: (r) => r.outcome === 'flowing-kept',
    right: 'The model shows the partition moving on with the bad record kept.',
    wrong: 'The model shows the partition stuck, or the record lost without a trace.',
  },
  explainLabel: 'In your own words: why doesn’t retrying fix a poison record, and what should a consumer do with one?',
  retrieve: {
    prompt: 'Does the plain Apache Kafka consumer have a dead-letter topic built in?',
    options: [
      { id: 'no', text: 'No: your code writes the record to one and seeks past it' },
      { id: 'yes-default', text: 'Yes, on by default' },
      { id: 'yes-setting', text: 'Yes, with errors.deadletterqueue.topic.name' },
      { id: 'acks', text: 'Only with acks=all' },
    ],
    answer: 'no',
    source: { chapter: 'failures', quote: 'None built in: your code writes it to a dead-letter topic and seeks past it' },
  },
  couplings: POISON_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Kafka guide, or a model assumption.',
};

// ---- retries --------------------------------------------------------------------------------------

export const RETRIES_MODEL = 'kafkaLab.failures.retries';
/** Attempts each retrying layer makes. */
export const ATTEMPTS_PER_LAYER = 3;
export const OUTAGE_MINUTES = 40;

export type RetryWhere = 'in-place' | 'retry-topics';
export type RetriesOutcome = 'storm' | 'stalled' | 'recovers';

export interface RetriesLevers {
  where: RetryWhere;
  layers: number;
  breaker: boolean;
}

export interface RetriesResult {
  outcome: RetriesOutcome;
  /** Calls the service receives for one record while it is down. */
  callsPerRecord: number;
  partitionBlocked: boolean;
  rebalancing: boolean;
  findings: Finding[];
}

export function runRetries(l: RetriesLevers): RetriesResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  const multiplied = ATTEMPTS_PER_LAYER ** l.layers;
  const callsPerRecord = l.breaker ? 1 : multiplied;
  const storm = !l.breaker && l.layers > 1;
  if (l.breaker) {
    add('breaker', 'The circuit breaker opens after a run of failures: calls stop until a test call succeeds, so the service gets at most one call per record while it is down.', 'ok');
  } else {
    add('multiply', `${l.layers} layer${l.layers === 1 ? '' : 's'} retr${l.layers === 1 ? 'ies' : 'y'}, ${ATTEMPTS_PER_LAYER} attempts each: ${ATTEMPTS_PER_LAYER}^${l.layers} = ${multiplied} calls for every record.`, storm ? 'problem' : 'info');
  }

  let partitionBlocked = false;
  let rebalancing = false;
  if (l.where === 'in-place') {
    if (l.breaker) {
      add('pause', 'While the breaker is open, the consumer pauses its partitions and keeps calling poll, so it stays in its group and resumes when the service is back.', 'ok');
    } else {
      partitionBlocked = true;
      rebalancing = true;
      add('poll-interval', `Retrying inside the poll loop for a ${OUTAGE_MINUTES}-minute outage means no poll for longer than max.poll.interval.ms (5 minutes): the consumer is removed from its group and the group rebalances, again and again.`, 'problem');
    }
  } else {
    add('retry-topics', 'A failed record goes to a retry topic with a delay (1 minute, then 10, then an hour) and the consumer carries on, so the main partition keeps moving. The price: a retried record is processed after later ones with its key.', 'info');
  }
  const outcome: RetriesOutcome = storm ? 'storm' : partitionBlocked ? 'stalled' : 'recovers';
  return { outcome, callsPerRecord, partitionBlocked, rebalancing, findings };
}

function retriesPicture(l: RetriesLevers, r: RetriesResult): LabPicture {
  const layerNames = ['Consumer', 'HTTP client', 'Payment service', 'API gateway'].slice(0, l.layers);
  return {
    lanes: [
      {
        label: 'Who retries a failed call',
        cells: layerNames.map((name) => ({ label: `${name} ×${ATTEMPTS_PER_LAYER}`, tone: (r.outcome === 'storm' ? 'bad' : 'neutral') as 'bad' | 'neutral' })),
        note: l.breaker
          ? 'A circuit breaker in front of the service stops calls while it is down.'
          : `Up to ${r.callsPerRecord} calls reach the service for each record.`,
      },
      {
        label: 'orders, partition 0',
        cells: Array.from({ length: 6 }, (_, i) => ({
          label: String(i),
          tone: (r.partitionBlocked && i > 0 ? 'muted' : 'good') as 'muted' | 'good',
          spoken: r.partitionBlocked && i > 0 ? `offset ${i}, waiting` : `offset ${i}, moving`,
        })),
        markers: r.partitionBlocked ? [{ at: 0, label: 'retrying here' }] : [],
        note: r.rebalancing ? 'The group keeps rebalancing.' : 'The partition keeps moving.',
      },
      ...(l.where === 'retry-topics' ? [{
        label: 'Retry path',
        cells: ['retry 1 min', 'retry 10 min', 'retry 1 h', 'dead-letter'].map((t) => ({ label: t, tone: 'accent' as const })),
      }] : []),
    ],
    legend: [
      { tone: 'good', label: 'Moving' },
      ...(r.partitionBlocked ? [{ tone: 'muted' as const, label: 'Waiting behind a retry' }] : []),
      ...(r.outcome === 'storm' ? [{ tone: 'bad' as const, label: 'Retries multiplying' }] : []),
      ...(l.where === 'retry-topics' ? [{ tone: 'accent' as const, label: 'Retry topics' }] : []),
    ],
  };
}

const asRetries = (l: Levers): RetriesLevers => ({ where: l.where as RetryWhere, layers: l.layers as number, breaker: l.breaker as boolean });

export function retriesRun(_: unknown, levers: Levers): ModelRun {
  const l = asRetries(levers);
  const r = runRetries(l);
  return {
    outcome: r.outcome,
    measures: {
      calls: { label: 'Calls to the service per record while it is down', value: r.callsPerRecord },
      blocked: { label: 'Partition blocked', value: r.partitionBlocked ? 'yes' : 'no' },
      rebalancing: { label: 'Group rebalancing', value: r.rebalancing ? 'yes' : 'no' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: retriesPicture(l, r),
  };
}

export const RETRIES_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'multiply', type: 'arithmetic',
    formula: `calls per record = ${ATTEMPTS_PER_LAYER} ^ layers`,
    uiLabel: `Arithmetic: if every layer makes ${ATTEMPTS_PER_LAYER} attempts and each attempt goes through the layers below, the attempts multiply: ${ATTEMPTS_PER_LAYER} × ${ATTEMPTS_PER_LAYER} × … per layer. A general reliability point, not a Kafka setting.`,
    effect: 'Four retrying layers turn one failing call into 81.',
  },
  {
    id: 'poll-interval', type: 'fact',
    formula: 'no poll within max.poll.interval.ms (5 min) → removed from the group',
    uiLabel: 'From the Kafka guide (chapter 7): a consumer that doesn’t call poll within max.poll.interval.ms, 5 minutes by default, is considered failed and its group rebalances.',
    effect: 'Retrying in place for long gets the consumer thrown out.',
  },
  {
    id: 'pause', type: 'assumption',
    formula: 'while the breaker is open, the consumer pauses its partitions and keeps calling poll',
    uiLabel: 'Model assumption: this consumer is written to pause its partitions while the breaker is open and keep calling poll. The KafkaConsumer documentation provides pause and resume for this, and a consumer stays in its group as long as it keeps calling poll.',
    effect: 'A paused consumer waits out an outage without losing its partitions.',
  },
  {
    id: 'retry-topics', type: 'fact',
    formula: 'failed records go to delayed retry topics; the main partition moves on',
    uiLabel: 'From the Kafka guide (chapter 14): if a retry needs to wait longer than a poll interval, the record goes through retry topics, at the cost of its order relative to later records with its key.',
    effect: 'The partition keeps flowing while the record waits elsewhere.',
  },
  {
    id: 'breaker', type: 'fact',
    formula: 'a circuit breaker stops calls after repeated failures',
    uiLabel: 'From the Kafka guide (chapter 14): a circuit breaker stops calling a dependency after a run of failures and tries again later, instead of hammering it while it is down.',
    effect: 'Calls stop during the outage.',
  },
  {
    id: 'one-call-open', type: 'convention',
    formula: 'with the breaker, one call per record while the service is down',
    uiLabel: 'Teaching convention: with the breaker on, the model counts one call per record during the outage. A real breaker’s count depends on its thresholds.',
    effect: 'The service sees bounded calls.',
  },
];

export const RETRIES: ExperimentDefinition<null> = {
  track: 'failures.retries',
  idPrefix: 'kfr',
  model: RETRIES_MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Sometimes the record is fine and something else is broken: a service the consumer calls is down. Retrying '
    + 'later will work, but how you retry matters. A retry that blocks the consumer stops its whole partition, and retries '
    + 'at several layers multiply. Kafka’s own producer retries with backoff and jitter; your calls to other services need '
    + 'the same care from your code.',
  preset: { where: 'in-place', layers: 4, breaker: false },
  levers: [
    { key: 'where', label: 'Where the consumer retries', options: [{ value: 'in-place', label: 'In the poll loop' }, { value: 'retry-topics', label: 'Through retry topics' }] },
    { key: 'layers', label: 'Layers that retry (3 attempts each)', options: [{ value: 1, label: '1' }, { value: 4, label: '4' }] },
    { key: 'breaker', label: 'Circuit breaker', options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }] },
  ],
  heldNote: `A payment service the consumer calls is down for ${OUTAGE_MINUTES} minutes. The levers start at the scenario you `
    + 'predicted. Change one or more, then run the model.',
  run: retriesRun,
  predict: {
    prompt: `A payment service goes down for ${OUTAGE_MINUTES} minutes. The consumer retries each failed call in its poll loop, `
      + 'and the HTTP client, the payment service and the API gateway each retry too: four layers, three attempts each, no '
      + 'circuit breaker. What happens?',
    options: [
      { id: 'recovers', text: 'Processing pauses, then resumes when the service is back' },
      { id: 'stalled', text: 'The partition stalls and the group rebalances, but the service sees normal traffic' },
      { id: 'storm', text: 'The service is flooded with retries, dozens of calls per record, on top of the consumer stalling' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, what caused the result?',
    options: [
      { id: 'multiply', text: 'Every layer retried, so the attempts multiplied: 3 × 3 × 3 × 3 calls per record' },
      { id: 'retry-topics', text: 'The retry topics filled up' },
      { id: 'pause', text: 'The consumer paused its partitions' },
      { id: 'jitter', text: 'The producer’s jitter delayed the records' },
    ],
  },
  apply: {
    prompt: 'Calls to the service must stay bounded during the outage, and processing must resume when it is back, without the '
      + 'group rebalancing. Which setup does it?',
    options: [
      { id: 'inplace-1-off', text: 'Retry in the poll loop, 1 layer, no circuit breaker', levers: { where: 'in-place', layers: 1, breaker: false } },
      { id: 'topics-4-off', text: 'Retry topics, 4 layers, no circuit breaker', levers: { where: 'retry-topics', layers: 4, breaker: false } },
      { id: 'topics-1-on', text: 'Retry topics, 1 layer, circuit breaker on', levers: { where: 'retry-topics', layers: 1, breaker: true } },
      { id: 'inplace-4-off', text: 'Retry in the poll loop, 4 layers, no circuit breaker, with longer timeouts', levers: { where: 'in-place', layers: 4, breaker: false } },
    ],
    correct: (r) => r.outcome === 'recovers',
    right: 'The model shows calls bounded and processing resuming with that setup.',
    wrong: 'The model shows a storm or a stalled group with that setup.',
  },
  explainLabel: 'In your own words: how do retries turn a short outage into a long one, and how would you design them in a consumer?',
  retrieve: {
    prompt: 'The Kafka producer backs off between its own retries. What random jitter does it add?',
    options: [
      { id: 'none', text: 'None' },
      { id: '5', text: '±5%' },
      { id: '20', text: '±20%' },
      { id: '50', text: '±50%' },
    ],
    answer: '20',
    source: { chapter: 'failures', quote: 'with exponential backoff from retry.backoff.ms to retry.backoff.max.ms and ±20% jitter.' },
  },
  couplings: RETRIES_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Kafka guide, arithmetic, or a teaching convention.',
};
