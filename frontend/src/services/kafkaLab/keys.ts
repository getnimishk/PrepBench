// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun, PictureCell } from '../adfLab/definition';

/**
 * Kafka Lab, experiment 2: Keys, partitions and order (KAFKA-LAB-CONTRACT.md, E2).
 *
 * Ten orders each publish four lifecycle events (Placed, Paid, Shipped, Delivered): forty events,
 * written stage by stage across all orders. The key chosen decides each event's partition. The model
 * reports whether any order's events were split across partitions (order broken) and whether one
 * partition took more than twice its share (hot). Pure and deterministic.
 */

export const MODEL = 'kafkaLab.keys';
export const SOURCES = ['§1', '§12', '§13'];

export type KeyChoice = 'order' | 'customer' | 'none';
export type Share = 'most' | 'third';

export interface KeysLevers {
  key: KeyChoice;
  partitions: number;
  share: Share;
}

export type KeysOutcome = 'balanced' | 'hot' | 'unordered';

const STAGES = ['Placed', 'Paid', 'Shipped', 'Delivered'] as const;
/** Order numbers 1000 to 1009: ten distinct teaching-hash values, so no two orders collide by accident. */
const ORDERS = Array.from({ length: 10 }, (_, i) => 1000 + i);
/** Without a key, the producer sticks to a partition for a batch; here a batch is five events. */
export const STICKY_BATCH = 5;
/** "Hot": more than twice the average events per partition. */
export const HOT_FACTOR = 2;

/** Which customer placed each order, by the big customer's share. */
export function customerOf(order: number, share: Share): 'A' | 'B' | 'C' {
  const i = order - ORDERS[0];
  if (share === 'most') return i < 8 ? 'A' : i === 8 ? 'B' : 'C';
  return i < 4 ? 'A' : i < 7 ? 'B' : 'C';
}

/** The teaching hash: the sum of the key's character codes, modulo the partition count. */
export function partitionOf(key: string, partitions: number): number {
  let sum = 0;
  for (const ch of key) sum += ch.charCodeAt(0);
  return sum % partitions;
}

interface Placed { order: number; stage: typeof STAGES[number]; customer: 'A' | 'B' | 'C'; partition: number }

export interface KeysResult {
  outcome: KeysOutcome;
  events: Placed[];
  perPartition: number[];
  /** Orders whose four events landed in more than one partition. */
  splitOrders: number;
  busiest: number;
  average: number;
  /** Keys that would land on a different partition if the count went from 6 to 12. */
  movedAt12: number;
  findings: Finding[];
}

const keyOf = (order: number, customer: string, key: KeyChoice) => (key === 'order' ? `ORDER-${order}` : `CUST-${customer}`);

export function runKeys(l: KeysLevers): KeysResult {
  const events: Placed[] = [];
  let n = 0;
  for (const stage of STAGES) {
    for (const order of ORDERS) {
      const customer = customerOf(order, l.share);
      const partition = l.key === 'none'
        ? Math.floor(n / STICKY_BATCH) % l.partitions
        : partitionOf(keyOf(order, customer, l.key), l.partitions);
      events.push({ order, stage, customer, partition });
      n += 1;
    }
  }
  const perPartition = Array.from({ length: l.partitions }, (_, p) => events.filter((e) => e.partition === p).length);
  const splitOrders = ORDERS.filter((o) => new Set(events.filter((e) => e.order === o).map((e) => e.partition)).size > 1).length;
  const busiest = Math.max(...perPartition);
  const average = events.length / l.partitions;
  const hot = busiest > HOT_FACTOR * average;

  const keys = l.key === 'none' ? [] : [...new Set(ORDERS.map((o) => keyOf(o, customerOf(o, l.share), l.key)))];
  const movedAt12 = keys.filter((k) => partitionOf(k, 6) !== partitionOf(k, 12)).length;

  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  if (l.key === 'none') {
    add('sticky', `No key: the producer fills one partition for a batch (${STICKY_BATCH} events here), then moves to the next. Load spreads, but an order’s four events land wherever the batch was.`, 'info');
  } else {
    add('key-hash', `Keyed by ${l.key === 'order' ? 'order ID' : 'customer ID'}: every event with the same key goes to the same partition. ${keys.length} distinct keys over ${l.partitions} partitions.`, hot ? 'problem' : 'ok');
  }
  if (splitOrders > 0) {
    add('order-per-partition', `${splitOrders} of ${ORDERS.length} orders have their events in more than one partition, so nothing keeps those events in order: a consumer may see Delivered before Shipped.`, 'problem');
  } else {
    add('order-per-partition', 'Every order’s four events are in one partition, so they are read in the order they were written.', 'ok');
  }
  add('hot', `The busiest partition holds ${busiest} of ${events.length} events; the average is ${average.toFixed(1)}. `
    + (hot ? `More than ${HOT_FACTOR} times the average: that partition, and the one consumer reading it, carry the load.` : 'Within twice the average.'),
  hot ? 'problem' : 'ok');
  if (l.key !== 'none') {
    add('keys-move', `If this topic went from 6 to 12 partitions, ${movedAt12} of these ${keys.length} keys would land on a different partition, and their old events would stay where they are.`, 'info');
  }
  const outcome: KeysOutcome = splitOrders > 0 ? 'unordered' : hot ? 'hot' : 'balanced';
  return { outcome, events, perPartition, splitOrders, busiest, average, movedAt12, findings };
}

const ABBR: Record<typeof STAGES[number], string> = { Placed: 'Pl', Paid: 'Pd', Shipped: 'Sh', Delivered: 'Dl' };

function picture(r: KeysResult): LabPicture {
  const lanes = r.perPartition.map((count, p) => ({
    label: `Partition ${p}${count > HOT_FACTOR * r.average ? ' (hot)' : ''}`,
    cells: r.events.filter((e) => e.partition === p).map((e): PictureCell => ({
      label: `${String(e.order).slice(-2)} ${ABBR[e.stage]}`,
      tone: e.customer === 'A' ? 'warn' : 'neutral',
      spoken: `order ${e.order} ${e.stage}, customer ${e.customer}`,
    })),
    note: `${count} event${count === 1 ? '' : 's'}`,
  }));
  return {
    lanes,
    legend: [
      { tone: 'warn', label: 'Customer A’s orders (the big customer)' },
      { tone: 'neutral', label: 'Other customers’ orders' },
    ],
  };
}

const asLevers = (l: Levers): KeysLevers => ({ key: l.key as KeyChoice, partitions: l.partitions as number, share: l.share as Share });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const l = asLevers(levers);
  const r = runKeys(l);
  return {
    outcome: r.outcome,
    measures: {
      split: { label: 'Orders split across partitions', value: r.splitOrders, unit: 'of 10' },
      busiest: { label: 'Events on the busiest partition', value: r.busiest, unit: 'of 40' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(r),
  };
}

export const PRESET: KeysLevers = { key: 'customer', partitions: 6, share: 'most' };

export const KEYS_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'key-hash', type: 'fact',
    formula: 'same key → same partition, while the partition count stays the same',
    uiLabel: 'From the Kafka guide (chapter 6): with a key, the producer picks the partition from a hash of the key, so the same key always maps to the same partition while the partition count stays the same.',
    effect: 'All of one customer’s events, or one order’s, go to one partition.',
  },
  {
    id: 'order-per-partition', type: 'fact',
    formula: 'order is guaranteed within a partition only',
    uiLabel: 'From the Kafka guide (chapter 2): records in one partition are stored, and read, in the order they were written; there is no order across partitions.',
    effect: 'An order whose events are in two partitions can be read out of order.',
  },
  {
    id: 'sticky', type: 'fact',
    formula: 'no key → a sticky partition that changes after a batch',
    uiLabel: 'From the Kafka guide (chapter 6): with no key, the producer sticks to one partition until a batch is sent, then moves on, which spreads load but keeps no per-entity order.',
    effect: 'Load spreads evenly; an order’s events scatter.',
  },
  {
    id: 'hot', type: 'convention',
    formula: `hot = more than ${HOT_FACTOR}× the average events per partition`,
    uiLabel: `Teaching convention: a partition is called hot here when it holds more than ${HOT_FACTOR} times the average. Kafka has no such threshold; it is how this lesson draws the line.`,
    effect: 'Above the line, the outcome is hot.',
  },
  {
    id: 'keys-move', type: 'fact',
    formula: 'adding partitions changes hash(key) % partitions; existing data is not moved',
    uiLabel: 'From the Kafka guide (chapter 10): adding partitions moves some keys to new partitions, and existing data is not redistributed, so a key’s events can sit in two partitions.',
    effect: 'More partitions don’t split a hot key, and they break order for keys that move.',
  },
  {
    id: 'teaching-hash', type: 'convention',
    formula: 'partition = sum of the key’s character codes mod partitions',
    uiLabel: 'Teaching convention: the model uses a simple hash so you can follow it. Kafka’s own partitioner uses a different hash; what matters, and what is taught, is that one key always gives one partition.',
    effect: 'Which partition a key lands on here is not where Kafka would put it.',
  },
  {
    id: 'sticky-batch', type: 'convention',
    formula: `a batch is ${STICKY_BATCH} events`,
    uiLabel: `Teaching convention: without a key, the model moves to the next partition every ${STICKY_BATCH} events. Kafka moves after a batch of at least batch.size bytes.`,
    effect: 'How often the unkeyed producer switches partitions.',
  },
];

export const KEYS: ExperimentDefinition<null> = {
  track: 'keys',
  idPrefix: 'kk',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A topic is split into partitions so several brokers and consumers can share the work. Each record can carry a '
    + 'key, and the key decides the partition: the same key always goes to the same partition. Kafka keeps records in order '
    + 'only within one partition, so the key you choose decides what stays in order, and how evenly the load spreads.',
  preset: { ...PRESET },
  levers: [
    { key: 'key', label: 'The record key', options: [
      { value: 'order', label: 'Order ID' }, { value: 'customer', label: 'Customer ID' }, { value: 'none', label: 'No key' }] },
    { key: 'partitions', label: 'Partitions', options: [{ value: 6, label: '6' }, { value: 12, label: '12' }] },
    { key: 'share', label: 'Orders from the big customer', options: [{ value: 'most', label: '8 of 10' }, { value: 'third', label: '4 of 10' }] },
  ],
  heldNote: 'Ten orders, four events each, written stage by stage. In the picture each box is one event: 03 Pl is order 1003 '
    + 'Placed; Pd is Paid, Sh Shipped, Dl Delivered. The levers start at the scenario you predicted. Change one or more, then '
    + 'run the model.',
  run: modelRun,
  predict: {
    prompt: 'A shop keys its order events by customer ID, on a topic with 6 partitions. One big customer places 8 of the 10 '
      + 'orders. Each order publishes four events. What happens?',
    options: [
      { id: 'balanced', text: 'Load spreads evenly, and each order’s events stay in order' },
      { id: 'hot', text: 'Each order’s events stay in order, but one partition gets most of the load' },
      { id: 'unordered', text: 'Load spreads, but some orders’ events are split across partitions and can be read out of order' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, what caused the result?',
    options: [
      { id: 'key-hash', text: 'Every event with the same key goes to the same partition, and one customer sends most of the events' },
      { id: 'too-few', text: 'Six partitions are too few for forty events' },
      { id: 'sticky', text: 'The producer stuck to one partition for each batch' },
      { id: 'order-per-partition', text: 'Order is kept across the whole topic, which slows one partition down' },
    ],
  },
  apply: {
    prompt: 'Keep each order’s four events in order, and keep every partition within twice its share of the load. Which setup does it?',
    options: [
      { id: 'order-6', text: 'Key by order ID, 6 partitions', levers: { key: 'order', partitions: 6, share: 'most' } },
      { id: 'customer-12', text: 'Key by customer ID, 12 partitions', levers: { key: 'customer', partitions: 12, share: 'most' } },
      { id: 'none-6', text: 'No key, 6 partitions', levers: { key: 'none', partitions: 6, share: 'most' } },
      { id: 'customer-6', text: 'Key by customer ID, 6 partitions, and wait for the sale to end', levers: { key: 'customer', partitions: 6, share: 'most' } },
    ],
    correct: (r) => r.outcome === 'balanced',
    right: 'The model shows every order in order and no hot partition with that setup.',
    wrong: 'The model shows a hot partition or orders split across partitions with that setup.',
  },
  explainLabel: 'In your own words: how does a key decide the partition, and how would you choose a key for order events?',
  retrieve: {
    prompt: 'Kafka guarantees that records are read in the order they were written…',
    options: [
      { id: 'partition', text: 'within one partition' },
      { id: 'topic', text: 'within a whole topic' },
      { id: 'cluster', text: 'across the whole cluster' },
      { id: 'key-only', text: 'only for records without a key' },
    ],
    answer: 'partition',
    source: { chapter: 'log', quote: 'records in one partition are stored, and read, in the order they were written.' },
  },
  couplings: KEYS_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Kafka guide, or a teaching convention.',
};
