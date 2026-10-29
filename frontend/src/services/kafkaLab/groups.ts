// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun, PictureCell, PictureLane } from '../adfLab/definition';

/**
 * Kafka Lab, experiment 3: Consumer groups and parallelism (KAFKA-LAB-CONTRACT.md, E3).
 *
 * A topic receives 700 records a second, spread evenly over its partitions. A consumer group shares
 * the partitions out, at most one consumer per partition; each consumer can process a fixed number of
 * records a second. A consumer with more incoming than it can process falls behind, and lag grows.
 * A second group may read the same topic. Pure and deterministic.
 */

export const MODEL = 'kafkaLab.groups';
export const SOURCES = ['§5', '§12', '§13'];

/** Records a second written to the topic: the scenario's teaching constant. */
export const INCOMING = 700;

export interface GroupsLevers {
  consumers: number;
  partitions: number;
  /** Records a second one consumer can process. */
  rate: number;
  secondGroup: boolean;
}

export type GroupsOutcome = 'keeps-up' | 'falls-behind';

export interface GroupsResult {
  outcome: GroupsOutcome;
  /** Partitions each consumer owns, by consumer index. */
  assignment: number[][];
  active: number;
  idle: number;
  /** Records a second arriving at the busiest consumer. */
  busiestLoad: number;
  /** Lag added per minute across the group. */
  lagPerMinute: number;
  findings: Finding[];
}

export function runGroups(l: GroupsLevers): GroupsResult {
  const assignment: number[][] = Array.from({ length: l.consumers }, () => []);
  for (let p = 0; p < l.partitions; p += 1) assignment[p % l.consumers].push(p);
  const perPartition = INCOMING / l.partitions;
  const loads = assignment.map((ps) => ps.length * perPartition);
  const active = assignment.filter((ps) => ps.length > 0).length;
  const idle = l.consumers - active;
  const busiestLoad = Math.max(...loads);
  const lagPerMinute = Math.round(loads.reduce((sum, load) => sum + Math.max(0, load - l.rate), 0) * 60);

  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  add('one-per-partition', idle > 0
    ? `${l.partitions} partitions, ${l.consumers} consumers: each partition has one consumer in the group, so only ${active} get work and ${idle} sit idle.`
    : `${l.partitions} partitions over ${l.consumers} consumers: every consumer has at least one partition.`,
  idle > 0 ? 'problem' : 'ok');
  const over = loads.filter((load) => load > l.rate).length;
  add('capacity', over > 0
    ? `${over} consumer${over === 1 ? '' : 's'} receive${over === 1 ? 's' : ''} up to ${Math.round(busiestLoad)} records a second but can process ${l.rate}: lag grows by about ${lagPerMinute.toLocaleString('en-GB')} records a minute.`
    : `The busiest consumer receives ${Math.round(busiestLoad)} records a second and can process ${l.rate}: the group keeps up.`,
  over > 0 ? 'problem' : 'ok');
  if (l.secondGroup) {
    add('groups-independent', 'A second group, audit, reads every partition again with its own offsets. It has no effect on this group’s lag.', 'info');
  }
  return { outcome: lagPerMinute > 0 ? 'falls-behind' : 'keeps-up', assignment, active, idle, busiestLoad, lagPerMinute, findings };
}

function picture(l: GroupsLevers, r: GroupsResult): LabPicture {
  const perPartition = INCOMING / l.partitions;
  const lanes: PictureLane[] = r.assignment.map((ps, c) => {
    const load = ps.length * perPartition;
    const behind = load > l.rate;
    return {
      label: `Consumer ${c + 1} (processes ${l.rate}/s)`,
      cells: ps.map((p): PictureCell => ({ label: `P${p}`, tone: behind ? 'bad' : 'good', spoken: `partition ${p}${behind ? ', falling behind' : ''}` })),
      note: ps.length === 0 ? 'Idle: no partition to read.' : `Receives ${Math.round(load)}/s${behind ? ': falling behind' : ''}.`,
    };
  });
  if (l.secondGroup) {
    lanes.push({
      label: 'Group audit (one consumer)',
      cells: Array.from({ length: l.partitions }, (_, p) => ({ label: `P${p}`, tone: 'accent' as const, spoken: `partition ${p}, read again by audit` })),
      note: 'Reads every partition again, at its own position.',
    });
  }
  return {
    lanes,
    legend: [
      { tone: 'good', label: 'Partition keeping up' },
      { tone: 'bad', label: 'Partition falling behind' },
      ...(l.secondGroup ? [{ tone: 'accent' as const, label: 'Read by the second group' }] : []),
    ],
  };
}

const asLevers = (l: Levers): GroupsLevers => ({
  consumers: l.consumers as number, partitions: l.partitions as number, rate: l.rate as number, secondGroup: l.secondGroup as boolean,
});

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const l = asLevers(levers);
  const r = runGroups(l);
  return {
    outcome: r.outcome,
    measures: {
      active: { label: 'Consumers with work', value: r.active, unit: `of ${l.consumers}` },
      idle: { label: 'Idle consumers', value: r.idle },
      busiest: { label: 'Records a second at the busiest consumer', value: Math.round(r.busiestLoad), unit: '/s' },
      lag: { label: 'Lag added each minute', value: r.lagPerMinute, unit: 'records' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(l, r),
  };
}

export const PRESET: GroupsLevers = { consumers: 8, partitions: 6, rate: 100, secondGroup: false };

export const GROUPS_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'one-per-partition', type: 'fact',
    formula: 'within a group, each partition is read by exactly one consumer',
    uiLabel: 'From the Kafka guide (chapter 7): within a group each partition has exactly one owner, so the partition count caps a group’s parallelism and extra consumers idle.',
    effect: 'More consumers than partitions: the extra ones get nothing.',
  },
  {
    id: 'groups-independent', type: 'fact',
    formula: 'a different group gets every partition again, with its own offsets',
    uiLabel: 'From the Kafka guide (chapter 7): a different group gets every partition again, with its own offsets.',
    effect: 'A second application reads everything without slowing the first.',
  },
  {
    id: 'capacity', type: 'arithmetic',
    formula: 'lag added a second = Σ max(0, records arriving at a consumer − records it can process)',
    uiLabel: 'Arithmetic: a consumer that receives more records a second than it can process falls behind by the difference; the group’s lag grows by the sum.',
    effect: 'Too much incoming for one consumer → lag on its partitions.',
  },
  {
    id: 'round-robin', type: 'convention',
    formula: 'partition p goes to consumer p mod consumers',
    uiLabel: 'Teaching convention: partitions are dealt to consumers in turn. Kafka’s assignors differ in detail; the rule they share, one consumer per partition per group, is the one taught.',
    effect: 'With 12 partitions and 8 consumers, four consumers get two partitions and four get one.',
  },
  {
    id: 'even-traffic', type: 'convention',
    formula: `${INCOMING} records a second, spread evenly over the partitions`,
    uiLabel: `Teaching convention: ${INCOMING} records a second arrive, the same number on every partition, and every record takes the same time to process.`,
    effect: 'Load per consumer follows only from how many partitions it owns.',
  },
];

export const GROUPS: ExperimentDefinition<null> = {
  track: 'groups',
  idPrefix: 'kg',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A consumer group is how one application reads a topic with several consumers at once. Kafka shares the '
    + 'topic’s partitions out among the group’s consumers, and each partition goes to exactly one of them, so the group can '
    + 'never have more consumers working than there are partitions. If records arrive faster than the group processes them, '
    + 'the gap between the newest record and the group’s position, called lag, keeps growing.',
  preset: { ...PRESET },
  levers: [
    { key: 'consumers', label: 'Consumers in the group', options: [4, 6, 8, 12].map((v) => ({ value: v, label: String(v) })) },
    { key: 'partitions', label: 'Partitions', options: [{ value: 6, label: '6' }, { value: 12, label: '12' }] },
    { key: 'rate', label: 'Records a second one consumer can process', options: [{ value: 100, label: '100' }, { value: 150, label: '150' }] },
    { key: 'secondGroup', label: 'A second group reading the same topic', options: [{ value: false, label: 'No' }, { value: true, label: 'Yes' }] },
  ],
  heldNote: `${INCOMING} records a second arrive, evenly over the partitions. The levers start at the scenario you predicted. `
    + 'Change one or more, then run the model.',
  run: modelRun,
  predict: {
    prompt: `${INCOMING} records a second arrive on a topic with 6 partitions. The group has 8 consumers, and each can process `
      + '100 records a second, 800 between them. What happens?',
    options: [
      { id: 'keeps-up', text: 'The group keeps up: eight consumers handle 800 records a second' },
      { id: 'falls-behind', text: 'The group falls behind: only six consumers get work, and lag grows' },
      { id: 'refused', text: 'Kafka refuses the two extra consumers' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, what caused the result?',
    options: [
      { id: 'one-per-partition', text: 'Each partition has one consumer in a group, so two consumers had nothing to read' },
      { id: 'second-group', text: 'Another group was reading the same records' },
      { id: 'refused', text: 'The broker turned the extra consumers away' },
      { id: 'retention', text: 'Records were deleted before they were read' },
    ],
  },
  apply: {
    prompt: `The group must keep up with ${INCOMING} records a second. Which setup does it?`,
    options: [
      { id: 'p6-c12-100', text: '6 partitions, 12 consumers at 100 a second', levers: { consumers: 12, partitions: 6, rate: 100, secondGroup: false } },
      { id: 'p12-c12-100', text: '12 partitions, 12 consumers at 100 a second', levers: { consumers: 12, partitions: 12, rate: 100, secondGroup: false } },
      { id: 'p12-c8-100', text: '12 partitions, 8 consumers at 100 a second', levers: { consumers: 8, partitions: 12, rate: 100, secondGroup: false } },
      { id: 'p6-c4-150', text: '6 partitions, 4 consumers at 150 a second', levers: { consumers: 4, partitions: 6, rate: 150, secondGroup: false } },
    ],
    correct: (r) => r.outcome === 'keeps-up',
    right: 'The model shows the group keeping up with that setup.',
    wrong: 'The model shows lag growing with that setup.',
  },
  explainLabel: 'In your own words: what decides how many consumers in a group can work, and what would you check before adding consumers?',
  retrieve: {
    prompt: 'A topic has six partitions. How many consumers in one group can read it at once?',
    options: [
      { id: 'six', text: 'Up to six' },
      { id: 'unlimited', text: 'As many as you start' },
      { id: 'one', text: 'One' },
      { id: 'three', text: 'Three, one per broker' },
    ],
    answer: 'six',
    source: { chapter: 'consumer', quote: 'six partitions can be read by up to six consumers at once.' },
  },
  couplings: GROUPS_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Kafka guide, arithmetic, or a teaching convention.',
};
