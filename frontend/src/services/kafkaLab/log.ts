// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Kafka Lab, experiment 1: The log, not a queue (KAFKA-LAB-CONTRACT.md, E1).
 *
 * One partition holds six order records. The billing group has read all six and committed. Then an
 * analytics group starts. Where it starts is decided by its committed offset if it has one, and by
 * auto.offset.reset if it doesn't; retention may already have deleted the records. Pure: no clock, no
 * randomness; every effect is an entry in LOG_COUPLINGS.
 */

export const MODEL = 'kafkaLab.log';

/** The research-notes sections this model's facts come from (checked by lab.test.ts). */
export const SOURCES = ['§2', '§3', '§13'];

export type Reset = 'latest' | 'earliest';
export type GroupChoice = 'own' | 'billing';
export type Retention = '7d' | '1h';

export interface LogLevers {
  reset: Reset;
  group: GroupChoice;
  retention: Retention;
}

export type LogOutcome = 'all' | 'none' | 'gone';

/** The scenario's teaching constants. */
export const SCENARIO = {
  records: ['Order 1001', 'Order 1002', 'Order 1003', 'Order 1004', 'Order 1005', 'Order 1006'],
  /** How old the six records are when analytics starts. */
  ageHours: 2,
} as const;

export interface LogResult {
  outcome: LogOutcome;
  /** Records still in the partition. */
  retained: number;
  /** The offset analytics starts reading at. */
  startOffset: number;
  /** Of the six, how many analytics reads. */
  analyticsRead: number;
  findings: Finding[];
}

export function runLog(l: LogLevers): LogResult {
  const total = SCENARIO.records.length;
  const end = total; // the log-end offset: the next offset to be written
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  add('read-keeps', `Billing read all ${total} records and committed offset ${end}. Reading removed nothing: the records are still in the partition.`, 'info');

  const deleted = l.retention === '1h' && SCENARIO.ageHours > 1;
  if (deleted) {
    add('retention-deletes', `Retention is 1 hour and the records are ${SCENARIO.ageHours} hours old, so Kafka has deleted them. Nothing is left for analytics to read, from any position.`, 'problem');
    return { outcome: 'gone', retained: 0, startOffset: end, analyticsRead: 0, findings };
  }

  let start: number;
  if (l.group === 'billing') {
    start = end;
    add('shared-offset', `Analytics uses billing’s group id, so it is billing: it resumes from billing’s committed offset, ${end}, and reads none of the six. auto.offset.reset is not consulted, because the group has a committed offset.`, 'problem');
  } else if (l.reset === 'latest') {
    start = end;
    add('no-offset-latest', `Analytics is a new group with no committed offset, so auto.offset.reset decides. It is latest, the default: start at the end, offset ${end}, and read only records written from now on.`, 'problem');
  } else {
    start = 0;
    add('no-offset-earliest', 'Analytics is a new group with no committed offset, and auto.offset.reset is earliest: it starts at the oldest retained record, offset 0.', 'ok');
  }
  const read = end - start;
  add('own-position', `Each group keeps its own position. Analytics reads ${read} of the ${total}; billing’s position is unchanged.`, 'info');
  return { outcome: read === total ? 'all' : 'none', retained: total, startOffset: start, analyticsRead: read, findings };
}

function picture(l: LogLevers, r: LogResult): LabPicture {
  const total = SCENARIO.records.length;
  const cells = SCENARIO.records.map((_, i) => (r.retained === 0
    ? { label: String(i), tone: 'muted' as const, spoken: `offset ${i}, deleted by retention` }
    : { label: String(i), tone: (i >= r.startOffset ? 'good' : 'neutral') as 'good' | 'neutral', spoken: `offset ${i}${i >= r.startOffset ? ', read by analytics' : ''}` }));
  return {
    lanes: [
      {
        label: 'orders, partition 0',
        cells,
        markers: [
          { at: total, label: 'billing: committed 6' },
          ...(r.startOffset === total ? [] : [{ at: r.startOffset, label: 'analytics starts' }]),
        ],
        note: r.retained === 0
          ? 'Deleted by retention: the offsets are gone for every group.'
          : r.startOffset === total
            ? `Analytics starts at the end (offset ${total}): it waits for new records.`
            : 'Analytics starts at offset 0 and reads all six.',
      },
    ],
    legend: [
      { tone: 'good', label: 'Read by analytics' },
      { tone: 'neutral', label: 'In the log, not read by analytics' },
      ...(r.retained === 0 ? [{ tone: 'muted' as const, label: 'Deleted by retention' }] : []),
    ],
  };
}

const asLevers = (l: Levers): LogLevers => ({ reset: l.reset as Reset, group: l.group as GroupChoice, retention: l.retention as Retention });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const l = asLevers(levers);
  const r = runLog(l);
  return {
    outcome: r.outcome,
    measures: {
      retained: { label: 'Records still in the partition', value: r.retained, unit: `of ${SCENARIO.records.length}` },
      start: { label: 'Offset analytics starts at', value: r.startOffset },
      read: { label: 'Of the six, records analytics reads', value: r.analyticsRead },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(l, r),
  };
}

export const PRESET: LogLevers = { reset: 'latest', group: 'own', retention: '7d' };

export const LOG_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'read-keeps', type: 'fact',
    formula: 'consuming a record does not delete it',
    uiLabel: 'From the Kafka guide (chapter 1): Kafka does not delete an event because someone read it; events stay for the topic’s retention period.',
    effect: 'Billing reading the records leaves them in the partition for every other group.',
  },
  {
    id: 'own-position', type: 'fact',
    formula: 'each consumer group has its own committed offset per partition',
    uiLabel: 'From the Kafka guide (chapter 7): each group keeps its own committed offset for each partition, so groups read independently.',
    effect: 'Analytics’ position doesn’t move billing’s, and billing’s doesn’t move analytics’.',
  },
  {
    id: 'no-offset-latest', type: 'fact',
    formula: 'no committed offset → auto.offset.reset decides; default latest',
    uiLabel: 'From the Kafka guide (chapter 7): when a group has no committed offset, auto.offset.reset decides where it starts, and its default is latest: only new records.',
    effect: 'A new group with the default starts at the end and reads none of what is already there.',
  },
  {
    id: 'no-offset-earliest', type: 'fact',
    formula: 'auto.offset.reset=earliest → start at the oldest retained record',
    uiLabel: 'From the Kafka guide (chapter 7): with auto.offset.reset=earliest, a group with no committed offset starts at the oldest record still retained.',
    effect: 'A new group set to earliest reads the whole retained history.',
  },
  {
    id: 'shared-offset', type: 'fact',
    formula: 'a committed offset, when there is one, decides where a group starts',
    uiLabel: 'From the Kafka guide (chapter 7): auto.offset.reset is used only when a group has no committed offset. A group id that already has one resumes from it.',
    effect: 'Reusing billing’s group id makes analytics a member of billing, at billing’s committed position.',
  },
  {
    id: 'retention-deletes', type: 'fact',
    formula: 'records older than retention.ms are deleted, whether or not anyone read them',
    uiLabel: 'From the Kafka guide (chapter 13): retention.ms is how long records are kept, default 7 days; it is the limit on how late a consumer can read.',
    effect: 'Records older than the retention are gone for every group.',
  },
  {
    id: 'one-segment', type: 'convention',
    formula: 'the six records are deleted together',
    uiLabel: 'Teaching convention: retention deletes a whole segment file at a time; here all six records are in one closed segment, so they go together.',
    effect: 'With 1-hour retention, all six records are deleted at once rather than one by one.',
  },
];

export const LOG: ExperimentDefinition<null> = {
  track: 'log',
  idPrefix: 'kl',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A Kafka topic is a log: records are appended in order, and each gets an offset, its position in the partition. '
    + 'Reading a record does not remove it. Each consumer group remembers how far it has read (its committed offset), so '
    + 'several applications can read the same records independently, each at its own pace. When a group has never read '
    + 'before, a setting called auto.offset.reset decides where it starts.',
  preset: { ...PRESET },
  levers: [
    { key: 'reset', label: 'Analytics’ auto.offset.reset', options: [{ value: 'latest', label: 'latest (default)' }, { value: 'earliest', label: 'earliest' }] },
    { key: 'group', label: 'Analytics’ group id', options: [{ value: 'own', label: 'Its own: analytics' }, { value: 'billing', label: 'Billing’s: billing' }] },
    { key: 'retention', label: 'Topic retention', options: [{ value: '7d', label: '7 days (default)' }, { value: '1h', label: '1 hour' }] },
  ],
  heldNote: 'The levers start at the scenario you predicted: six orders, written two hours ago, already read by billing. '
    + 'Change one or more, then run the model.',
  run: modelRun,
  predict: {
    prompt: 'Six orders were written to a one-partition topic two hours ago. The billing group read all six and committed. '
      + 'Now a new group, analytics, starts reading the same topic with every setting at its default. What does analytics read?',
    options: [
      { id: 'all', text: 'All six orders' },
      { id: 'none', text: 'None of the six: it waits for new orders' },
      { id: 'consumed', text: 'None: billing’s reading removed them from the topic' },
      { id: 'gone', text: 'None: retention has already deleted them' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why did analytics read what it did?',
    options: [
      { id: 'no-offset-latest', text: 'Analytics had no committed offset, so auto.offset.reset decided, and its default is latest' },
      { id: 'read-removes', text: 'Billing reading the records removed them' },
      { id: 'retention-deletes', text: 'Retention had deleted the records' },
      { id: 'shared-offset', text: 'Analytics shared billing’s committed offset' },
    ],
  },
  apply: {
    prompt: 'Analytics must process the six orders billing has already read, as well as new ones. Which setup does it?',
    options: [
      { id: 'earliest-own', text: 'Its own group id, auto.offset.reset=earliest, 7-day retention', levers: { reset: 'earliest', group: 'own', retention: '7d' } },
      { id: 'earliest-billing', text: 'Billing’s group id, auto.offset.reset=earliest, 7-day retention', levers: { reset: 'earliest', group: 'billing', retention: '7d' } },
      { id: 'latest-own', text: 'Its own group id, auto.offset.reset=latest, 7-day retention', levers: { reset: 'latest', group: 'own', retention: '7d' } },
      { id: 'earliest-1h', text: 'Its own group id, auto.offset.reset=earliest, 1-hour retention', levers: { reset: 'earliest', group: 'own', retention: '1h' } },
    ],
    correct: (r) => r.outcome === 'all',
    right: 'The model shows analytics reading all six with that setup.',
    wrong: 'The model shows analytics missing the six with that setup.',
  },
  explainLabel: 'In your own words: why is Kafka not a queue, and what decides where a new consumer group starts reading?',
  retrieve: {
    prompt: 'What is the default value of auto.offset.reset?',
    options: [
      { id: 'earliest', text: 'earliest' },
      { id: 'latest', text: 'latest' },
      { id: 'none', text: 'none' },
      { id: 'by_duration', text: 'by_duration' },
    ],
    answer: 'latest',
    source: { chapter: 'consumer', quote: 'latest (the default: only new records)' },
  },
  couplings: LOG_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Kafka guide, or a teaching convention.',
};
