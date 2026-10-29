// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Kafka Lab, experiment 4: Commits and crashes (KAFKA-LAB-CONTRACT.md, E4).
 *
 * A consumer's poll returns ten order records, offsets 0 to 9. Processing one sends a confirmation
 * email. The consumer crashes after sending the email for offset 5, and restarts from its committed
 * offset. When it committed decides what the restart misses or repeats; whether the email step checks
 * the order first decides whether a repeat sends a second email. Pure and deterministic.
 */

export const MODEL = 'kafkaLab.commits';
export const SOURCES = ['§2', '§5', '§22'];

export type CommitWhen = 'before' | 'after' | 'auto-handoff';

export interface CommitsLevers {
  commit: CommitWhen;
  idempotent: boolean;
}

export type CommitsOutcome = 'lost' | 'repeated' | 'exact';

export const RECORDS = 10;
/** The last offset whose email was sent before the crash. */
export const CRASH_AFTER = 5;

export interface CommitsResult {
  outcome: CommitsOutcome;
  /** The committed offset when the consumer crashed: where the restart begins. */
  committedAtCrash: number;
  /** Emails sent per offset, after the restart has finished the batch. */
  emails: number[];
  lost: number;
  repeated: number;
  findings: Finding[];
}

export function runCommits(l: CommitsLevers): CommitsResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  let committedAtCrash: number;
  if (l.commit === 'before') {
    committedAtCrash = RECORDS;
    add('committed-ahead', `It committed offset ${RECORDS} as soon as poll returned, before processing. After the crash it restarts at ${RECORDS}: offsets ${CRASH_AFTER + 1} to ${RECORDS - 1} are never processed.`, 'problem');
  } else if (l.commit === 'auto-handoff') {
    committedAtCrash = RECORDS;
    add('auto-commit-ahead', `Records were handed to worker threads and poll was called again, so auto-commit committed offset ${RECORDS} while the workers were still busy. The restart begins at ${RECORDS}: offsets ${CRASH_AFTER + 1} to ${RECORDS - 1} are never processed.`, 'problem');
  } else {
    committedAtCrash = CRASH_AFTER;
    add('commit-after', `It commits each record after processing it. It crashed after emailing offset ${CRASH_AFTER} and before committing ${CRASH_AFTER + 1}, so the committed offset is ${CRASH_AFTER}: the restart processes offset ${CRASH_AFTER} again.`, 'info');
  }
  add('next-offset', `The committed offset is the next record to read: ${committedAtCrash} means “start at ${committedAtCrash}”.`, 'info');

  const emails = Array.from({ length: RECORDS }, (_, i) => (i <= CRASH_AFTER ? 1 : 0));
  for (let i = committedAtCrash; i < RECORDS; i += 1) {
    if (emails[i] > 0 && l.idempotent) continue; // the email step finds the order already done
    emails[i] += 1;
  }
  const lost = emails.filter((e) => e === 0).length;
  const repeated = emails.filter((e) => e > 1).length;
  if (repeated > 0) {
    add('redelivered', `Offset ${CRASH_AFTER} was processed twice and its customer got two emails: at-least-once delivery repeats work after a crash.`, 'problem');
  } else if (l.commit === 'after' && l.idempotent) {
    add('idempotent', `Offset ${CRASH_AFTER} came back, and the email step found order ${CRASH_AFTER} already emailed, so it sent nothing: the repeat was harmless.`, 'ok');
  }
  if (lost > 0) add('committed-ahead', `${lost} orders never get an email.`, 'problem');
  const outcome: CommitsOutcome = lost > 0 ? 'lost' : repeated > 0 ? 'repeated' : 'exact';
  return { outcome, committedAtCrash, emails, lost, repeated, findings };
}

function picture(r: CommitsResult): LabPicture {
  return {
    lanes: [
      {
        label: 'orders, partition 0: emails sent per record',
        cells: r.emails.map((count, i) => ({
          label: `${i}: ${count === 0 ? 'none' : count === 1 ? '1 email' : `${count} emails`}`,
          tone: count === 0 ? 'bad' : count > 1 ? 'warn' : 'good',
          spoken: `offset ${i}, ${count === 0 ? 'never processed' : count === 1 ? 'one email' : `${count} emails`}`,
        })),
        markers: [
          { at: CRASH_AFTER, label: 'crash after this' },
          ...(r.committedAtCrash < RECORDS ? [{ at: r.committedAtCrash, label: `committed ${r.committedAtCrash}` }] : [{ at: RECORDS, label: `committed ${RECORDS}` }]),
        ],
      },
    ],
    legend: [
      { tone: 'good', label: 'Emailed once' },
      { tone: 'warn', label: 'Emailed twice' },
      { tone: 'bad', label: 'Never processed' },
    ],
  };
}

const asLevers = (l: Levers): CommitsLevers => ({ commit: l.commit as CommitWhen, idempotent: l.idempotent as boolean });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const r = runCommits(asLevers(levers));
  return {
    outcome: r.outcome,
    measures: {
      committed: { label: 'Committed offset at the crash', value: r.committedAtCrash },
      lost: { label: 'Orders never emailed', value: r.lost, unit: `of ${RECORDS}` },
      repeated: { label: 'Orders emailed twice', value: r.repeated, unit: `of ${RECORDS}` },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(r),
  };
}

export const PRESET: CommitsLevers = { commit: 'before', idempotent: false };

export const COMMITS_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'next-offset', type: 'fact',
    formula: 'committed offset = the next record to read (last processed + 1)',
    uiLabel: 'From the Kafka guide (chapter 7): the committed offset means “the next record to read”, not “the last record processed”. After processing offset 41, you commit 42.',
    effect: 'A restarted consumer begins at the committed offset.',
  },
  {
    id: 'committed-ahead', type: 'fact',
    formula: 'commit, then process: a crash loses what wasn’t processed (at most once)',
    uiLabel: 'From the Kafka guide (chapter 8): saving the position before processing gives at-most-once delivery; a crash in between loses those records.',
    effect: 'Commit before processing → records skipped after a crash.',
  },
  {
    id: 'auto-commit-ahead', type: 'fact',
    formula: 'auto-commit is at-least-once only if a poll’s records are processed before the next poll',
    uiLabel: 'From the Kafka guide (chapter 7): auto-commit gives at-least-once only if every record from a poll is processed before the next poll; otherwise the committed offset can run ahead of what was processed.',
    effect: 'Handing records to other threads and polling again → commits ahead of the work.',
  },
  {
    id: 'commit-after', type: 'fact',
    formula: 'process, then commit: a crash repeats work (at least once)',
    uiLabel: 'From the Kafka guide (chapter 8): processing before saving the position gives at-least-once delivery; a crash in between processes some records again.',
    effect: 'Commit after processing → nothing skipped, some records repeated.',
  },
  {
    id: 'redelivered', type: 'fact',
    formula: 'at-least-once + an effect that isn’t idempotent = duplicates',
    uiLabel: 'From the Kafka guide (chapter 8): at-least-once is often fine when updates are idempotent; an effect that isn’t, like sending an email, happens twice.',
    effect: 'A repeated record sends a second email.',
  },
  {
    id: 'idempotent', type: 'assumption',
    formula: 'the email step checks a record of sent orders first',
    uiLabel: 'Model assumption: “idempotent” here means the email step looks up the order ID in a store of orders already emailed, and the record of sending is saved with the send.',
    effect: 'A repeated record finds the order already done and sends nothing.',
  },
  {
    id: 'crash-point', type: 'convention',
    formula: `the crash comes after the email for offset ${CRASH_AFTER}, before anything else`,
    uiLabel: `Teaching convention: the crash happens at one fixed moment, just after offset ${CRASH_AFTER}’s email is sent. A real crash can come anywhere; this moment shows each strategy’s weak point.`,
    effect: 'Each strategy is tested at the same moment.',
  },
];

export const COMMITS: ExperimentDefinition<null> = {
  track: 'commits',
  idPrefix: 'kc',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A consumer tells Kafka how far it has got by committing an offset: the next record it wants to read. If it '
    + 'crashes, it starts again from its last commit. So the moment it commits matters: commit before doing the work and a '
    + 'crash skips that work; commit after and a crash repeats some of it. Whether a repeat does harm depends on the work.',
  preset: { ...PRESET },
  levers: [
    { key: 'commit', label: 'When the consumer commits', options: [
      { value: 'before', label: 'Before processing' },
      { value: 'after', label: 'After processing each record' },
      { value: 'auto-handoff', label: 'Auto-commit, work handed to other threads' },
    ] },
    { key: 'idempotent', label: 'The email step checks whether the order was already emailed', options: [
      { value: false, label: 'No' }, { value: true, label: 'Yes' }] },
  ],
  heldNote: `One poll returns ten orders, offsets 0 to 9. The consumer crashes just after emailing offset ${CRASH_AFTER}, then `
    + 'restarts. The levers start at the scenario you predicted. Change one or more, then run the model.',
  run: modelRun,
  predict: {
    prompt: 'A consumer reads ten orders and commits right away, then emails each customer. It crashes after the sixth '
      + 'email and restarts. What happens to the ten orders?',
    options: [
      { id: 'exact', text: 'Every customer gets exactly one email' },
      { id: 'lost', text: 'Four customers never get an email' },
      { id: 'repeated', text: 'Some customers get two emails' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, what caused the result?',
    options: [
      { id: 'committed-ahead', text: 'The committed offset was ahead of the work, so the restart skipped what wasn’t done' },
      { id: 'redelivered', text: 'The restart processed some orders a second time' },
      { id: 'broker', text: 'The broker deleted the records when the consumer crashed' },
      { id: 'next-offset', text: 'The consumer committed the last processed offset instead of the next one' },
    ],
  },
  apply: {
    prompt: 'No order may be missed, and no customer may get two emails, even if the consumer crashes. Which setup does it?',
    options: [
      { id: 'after-idem', text: 'Commit after processing, and the email step checks first', levers: { commit: 'after', idempotent: true } },
      { id: 'after', text: 'Commit after processing, no check', levers: { commit: 'after', idempotent: false } },
      { id: 'before-idem', text: 'Commit before processing, and the email step checks first', levers: { commit: 'before', idempotent: true } },
      { id: 'auto-idem', text: 'Auto-commit with worker threads, and the email step checks first', levers: { commit: 'auto-handoff', idempotent: true } },
    ],
    correct: (r) => r.outcome === 'exact',
    right: 'The model shows every customer getting exactly one email with that setup.',
    wrong: 'The model shows orders missed or emailed twice with that setup.',
  },
  explainLabel: 'In your own words: how does the moment you commit decide what a crash does, and why do you also need the work to be safe to repeat?',
  retrieve: {
    prompt: 'A consumer has just processed the record at offset 41. Which offset should it commit?',
    options: [
      { id: '41', text: '41' },
      { id: '42', text: '42' },
      { id: '40', text: '40' },
      { id: '0', text: '0' },
    ],
    answer: '42',
    source: { chapter: 'consumer', quote: 'After processing offset 41, you commit 42.' },
  },
  couplings: COMMITS_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Kafka guide, a model assumption, or a teaching convention.',
};
