// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Kafka Lab, experiment 5: Copies, acks and min ISR (KAFKA-LAB-CONTRACT.md, E5).
 *
 * A topic with replication factor 3 lives on three brokers: a leader and two followers, some of
 * which may have fallen out of the in-sync replica set (ISR). A producer sends one order. The model
 * decides, from acks and min.insync.replicas, whether the write is acknowledged, refused, or never
 * confirmed, and how many copies exist at the moment it is acknowledged. Then the leader's broker
 * fails. Pure and deterministic.
 */

export const MODEL = 'kafkaLab.replication';
export const SOURCES = ['§1', '§3', '§7', '§23'];

export type Acks = '0' | '1' | 'all';

export interface ReplicationLevers {
  acks: Acks;
  minIsr: number;
  /** Followers in the ISR: 2, 1 or 0. */
  inSync: number;
}

export type ReplicationOutcome = 'safe' | 'one-copy' | 'refused' | 'unconfirmed';

export interface ReplicationResult {
  outcome: ReplicationOutcome;
  isr: number;
  /**
   * Copies of the order when the producer is told it succeeded (0 if it never is). Null with acks=0:
   * no answer comes back, so nothing says whether the leader stored it.
   */
  copiesAtAck: number | null;
  /** Null with acks=0, for the same reason: the outcome is unknown, not a confirmed loss. */
  survivesLeaderLoss: boolean | null;
  findings: Finding[];
}

export function runReplication(l: ReplicationLevers): ReplicationResult {
  const isr = 1 + l.inSync;
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  add('isr', `The ISR is ${isr} of 3 replicas: the leader${l.inSync ? ` and ${l.inSync} follower${l.inSync === 1 ? '' : 's'}` : ' alone'}.`, 'info');

  if (l.acks === '0') {
    add('acks-0', 'With acks=0 the producer doesn’t wait for any answer: the record counts as sent once it leaves, and the producer never learns whether it was written. The order may be on the brokers or may be lost; nothing tells the producer which.', 'problem');
    return { outcome: 'unconfirmed', isr, copiesAtAck: null, survivesLeaderLoss: null, findings };
  }
  if (l.acks === '1') {
    add('acks-leader-only', 'With acks=1 the leader answers as soon as it has written the order to its own log, before any follower has copied it. When the leader’s broker fails right after, the order is gone.', 'problem');
    if (l.minIsr > 1) add('min-isr-acks-all', `min.insync.replicas is ${l.minIsr}, but it only applies to acks=all, so it changed nothing here.`, 'info');
    return { outcome: 'one-copy', isr, copiesAtAck: 1, survivesLeaderLoss: false, findings };
  }
  if (isr < l.minIsr) {
    add('refused', `acks=all with min.insync.replicas=${l.minIsr}, and the ISR is only ${isr}: the leader refuses the write with NotEnoughReplicas. The producer knows it failed and can retry or alert.`, 'ok');
    return { outcome: 'refused', isr, copiesAtAck: 0, survivesLeaderLoss: true, findings };
  }
  if (isr === 1) {
    add('acks-all-current-isr', 'acks=all waits for the current ISR, and the ISR is just the leader, so the order is acknowledged with one copy. When that broker fails, the order is gone.', 'problem');
    return { outcome: 'one-copy', isr, copiesAtAck: 1, survivesLeaderLoss: false, findings };
  }
  add('committed', `acks=all: every replica in the ISR has the order before the producer hears yes, ${isr} copies. When the leader fails, a follower in the ISR takes over with it.`, 'ok');
  return { outcome: 'safe', isr, copiesAtAck: isr, survivesLeaderLoss: true, findings };
}

function picture(l: ReplicationLevers, r: ReplicationResult): LabPicture {
  const brokers = [
    { name: 'Broker 1 (leader)', inIsr: true },
    { name: 'Broker 2 (follower)', inIsr: l.inSync >= 1 },
    { name: 'Broker 3 (follower)', inIsr: l.inSync >= 2 },
  ];
  const hasCopy = (i: number) => (r.outcome === 'refused' || r.copiesAtAck === null
    ? false
    : i === 0 || (r.copiesAtAck > 1 && brokers[i].inIsr));
  const unknown = r.outcome === 'unconfirmed';
  return {
    lanes: brokers.map((b, i) => ({
      label: b.name,
      cells: [unknown
        ? { label: '?', tone: 'warn' as const, spoken: 'may or may not have a copy: the producer is never told' }
        : hasCopy(i)
          ? { label: 'order', tone: (i === 0 && !r.survivesLeaderLoss ? 'bad' : 'good') as 'bad' | 'good', spoken: 'has a copy of the order when the producer is told yes' }
          : { label: '—', tone: 'muted' as const, spoken: 'no copy when the producer is told yes' }],
      note: [
        b.inIsr ? 'In the ISR.' : 'Out of the ISR: fallen behind.',
        i === 0 ? 'Fails right after acknowledging.' : '',
      ].filter(Boolean).join(' '),
    })),
    legend: unknown
      ? [{ tone: 'warn', label: 'Unknown: with acks=0 no broker answers, so the producer can’t tell' }]
      : [
        { tone: 'good', label: 'Has the order, and it survives' },
        { tone: 'bad', label: 'The only copy: lost with the leader' },
        { tone: 'muted', label: 'No copy when the producer was told yes' },
      ],
  };
}

const asLevers = (l: Levers): ReplicationLevers => ({ acks: l.acks as Acks, minIsr: l.minIsr as number, inSync: l.inSync as number });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const l = asLevers(levers);
  const r = runReplication(l);
  return {
    outcome: r.outcome,
    measures: {
      isr: { label: 'Replicas in the ISR', value: r.isr, unit: 'of 3' },
      copies: { label: 'Copies when the producer is told yes', value: r.copiesAtAck ?? 'unknown' },
      survives: { label: 'Survives the leader failing', value: r.survivesLeaderLoss === null ? 'unknown' : r.survivesLeaderLoss ? 'yes' : 'no' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(l, r),
  };
}

export const PRESET: ReplicationLevers = { acks: '1', minIsr: 1, inSync: 2 };

export const REPLICATION_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'acks-leader-only', type: 'fact',
    formula: 'acks=1: the leader answers after writing its own log, without waiting for followers',
    uiLabel: 'From the Kafka guide (chapter 6): with acks=1 the leader writes to its own log and answers without waiting for followers; the record is lost if the leader fails before they copy it.',
    effect: 'The producer hears yes while only one copy exists.',
  },
  {
    id: 'acks-0', type: 'fact',
    formula: 'acks=0: the producer doesn’t wait for an answer',
    uiLabel: 'From the Kafka guide (chapter 6): with acks=0 the producer doesn’t wait: the record counts as sent once it is in the socket buffer, and retries have no effect.',
    effect: 'The producer can’t tell a written record from a lost one.',
  },
  {
    id: 'acks-all-current-isr', type: 'fact',
    formula: 'acks=all waits for the current ISR, however small',
    uiLabel: 'From the Kafka guide (chapter 12): acks=all waits for the current ISR, however small it is. If two followers fall out, an acks=all write succeeds with one copy.',
    effect: 'acks=all alone doesn’t guarantee more than one copy.',
  },
  {
    id: 'refused', type: 'fact',
    formula: 'acks=all and ISR < min.insync.replicas → NotEnoughReplicas',
    uiLabel: 'From the Kafka guide (chapter 12): with acks=all, the leader refuses the write if the ISR is smaller than min.insync.replicas, and the producer gets a NotEnoughReplicas error.',
    effect: 'Kafka refuses a write rather than accept it with too few copies.',
  },
  {
    id: 'min-isr-acks-all', type: 'fact',
    formula: 'min.insync.replicas applies only to acks=all',
    uiLabel: 'From the Kafka guide (chapter 12): min.insync.replicas takes effect with acks=all; with acks=1 or 0 it doesn’t refuse anything.',
    effect: 'Raising min ISR doesn’t protect an acks=1 producer.',
  },
  {
    id: 'committed', type: 'fact',
    formula: 'a committed record survives while one in-sync replica is alive',
    uiLabel: 'From the Kafka guide (chapter 12): a record on every in-sync replica is committed, and is not lost as long as at least one of them stays alive; a new leader is chosen from the ISR.',
    effect: 'With two or more copies, losing the leader loses nothing acknowledged.',
  },
  {
    id: 'isr', type: 'fact',
    formula: 'a follower that falls too far behind leaves the ISR',
    uiLabel: 'From the Kafka guide (chapter 12): a follower that hasn’t caught up with the leader for replica.lag.time.max.ms (30 s) is removed from the ISR.',
    effect: 'Followers out of the ISR don’t count towards acks=all.',
  },
  {
    id: 'instant-failure', type: 'convention',
    formula: 'the leader fails immediately after acknowledging',
    uiLabel: 'Teaching convention: the leader’s broker fails the instant after it acknowledges, before any follower could catch up. That is the worst moment, and the one that shows what each setting promises.',
    effect: 'A copy that exists only on the leader is lost.',
  },
];

export const REPLICATION: ExperimentDefinition<null> = {
  track: 'replication',
  idPrefix: 'kr',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Kafka keeps copies of every partition on several brokers: one leader takes the writes, and followers copy '
    + 'from it. Followers that are keeping up form the in-sync replica set, the ISR. The producer’s acks setting decides how '
    + 'many of them must have a record before the producer is told “yes”, and the topic’s min.insync.replicas decides when '
    + 'Kafka would rather refuse a write than accept it with too few copies.',
  preset: { ...PRESET },
  levers: [
    { key: 'acks', label: 'Producer acks', options: [{ value: '0', label: '0' }, { value: '1', label: '1' }, { value: 'all', label: 'all (default)' }] },
    { key: 'minIsr', label: 'Topic min.insync.replicas', options: [{ value: 1, label: '1 (default)' }, { value: 2, label: '2' }] },
    { key: 'inSync', label: 'Followers in the ISR', options: [{ value: 2, label: '2 (all caught up)' }, { value: 1, label: '1' }, { value: 0, label: '0' }] },
  ],
  heldNote: 'Replication factor 3: a leader and two followers. One order is sent, then the leader’s broker fails. The levers '
    + 'start at the scenario you predicted. Change one or more, then run the model.',
  run: modelRun,
  predict: {
    prompt: 'A producer with acks=1 sends an order to a topic with replication factor 3, min.insync.replicas 1, both followers '
      + 'in the ISR. It is told yes, and a moment later the leader’s broker loses power. What happens to the order?',
    options: [
      { id: 'safe', text: 'It survives: three brokers have it' },
      { id: 'one-copy', text: 'It is lost: only the leader had it when it said yes' },
      { id: 'refused', text: 'The producer was told the write failed' },
      { id: 'unconfirmed', text: 'The producer never finds out either way' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, what caused the result?',
    options: [
      { id: 'acks-leader-only', text: 'acks=1 waits only for the leader, so the yes came before any follower had a copy' },
      { id: 'min-isr-acks-all', text: 'min.insync.replicas of 1 let it through' },
      { id: 'rf', text: 'A replication factor of 3 is too low' },
      { id: 'isr', text: 'The followers had fallen out of the ISR' },
    ],
  },
  apply: {
    prompt: 'An order must survive any one broker failing, or the producer must be told it can’t be stored safely. Which setup does that?',
    options: [
      { id: 'all-2-2', text: 'acks=all, min.insync.replicas 2, both followers in sync', levers: { acks: 'all', minIsr: 2, inSync: 2 } },
      { id: 'all-1-0', text: 'acks=all, min.insync.replicas 1, no follower in sync', levers: { acks: 'all', minIsr: 1, inSync: 0 } },
      { id: '1-2-2', text: 'acks=1, min.insync.replicas 2, both followers in sync', levers: { acks: '1', minIsr: 2, inSync: 2 } },
      { id: 'all-2-0', text: 'acks=all, min.insync.replicas 2, no follower in sync', levers: { acks: 'all', minIsr: 2, inSync: 0 } },
    ],
    correct: (r) => r.outcome === 'safe' || r.outcome === 'refused',
    right: 'The model shows the order either stored on two or more copies, or refused so the producer knows.',
    wrong: 'The model shows the producer told yes while only one copy existed.',
  },
  explainLabel: 'In your own words: what do acks and min.insync.replicas each decide, and why does the documented setup use both?',
  retrieve: {
    prompt: 'What setup does the Kafka documentation give as typical for durable writes?',
    options: [
      { id: 'rf3-min2-all', text: 'Replication factor 3, min.insync.replicas 2, acks=all' },
      { id: 'rf3-min3-1', text: 'Replication factor 3, min.insync.replicas 3, acks=1' },
      { id: 'rf2-min1-all', text: 'Replication factor 2, min.insync.replicas 1, acks=all' },
      { id: 'rf1-min1-0', text: 'Replication factor 1, min.insync.replicas 1, acks=0' },
    ],
    answer: 'rf3-min2-all',
    source: { chapter: 'replication', quote: 'replication factor 3, min.insync.replicas 2, acks=all.' },
  },
  couplings: REPLICATION_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Kafka guide, or a teaching convention.',
};
