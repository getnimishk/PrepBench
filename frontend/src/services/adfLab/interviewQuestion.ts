// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { LabExperiment } from './experiments';
import type { LabSpec } from './lab';

/**
 * Interview questions saved from a finished lab run, for every lab on the shared runner (the ADF
 * Behaviour Lab, the Kafka Lab, the Databricks Lab), as the Lakehouse Lab's stations already do
 * (services/lakehouse/labInterviewQuestion.ts).
 *
 * Source reference: `lab/<packId>/experiment/<track>`. One question per experiment and mode: a later
 * run updates it rather than adding another. It starts with `lab/`, so the backend counts it as a lab
 * interview question for the preparation (subjects.py, `_lab_interview_question_count`).
 *
 * Talking points come only from what the learner's own run recorded: the levers they changed, and the
 * scenario against their run for each measure. Nothing is added that the run didn't record.
 */

type Observed = Record<string, unknown> | null | undefined;
type Manipulation = Record<string, unknown> | null | undefined;

export function labRunSourceRef(lab: LabSpec, track: string): string {
  return `lab/${lab.packId}/experiment/${track}`.slice(0, 150);
}

const shown = (v: unknown): string | null =>
  (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && v !== '' ? String(v) : null;

/** The learner's run, as talking points: what they changed, and what each measure did. */
export function runTalkingPoints(manipulation: Manipulation, observed: Observed): string[] {
  const points: string[] = [];
  for (const [lever, change] of Object.entries(manipulation ?? {})) {
    if (!change || typeof change !== 'object') continue;
    const from = shown((change as { from?: unknown }).from);
    const to = shown((change as { to?: unknown }).to);
    if (from !== null && to !== null) points.push(`I changed ${lever} from ${from} to ${to}.`);
  }
  for (const [key, entry] of Object.entries(observed ?? {})) {
    if (key === 'source' || !entry || typeof entry !== 'object') continue;
    const { label, before, after, unit } = entry as { label?: unknown; before?: unknown; after?: unknown; unit?: unknown };
    const name = shown(label);
    const b = shown(before);
    const a = shown(after);
    if (name === null || b === null || a === null) continue;
    const u = shown(unit);
    const withUnit = (v: string) => (u && /^\d/.test(v) ? `${v} ${u}` : v);
    points.push(b === a ? `${name}: ${withUnit(a)}, unchanged from the scenario.` : `${name}: ${withUnit(b)} in the scenario, ${withUnit(a)} in my run.`);
  }
  return points;
}

/** A starting prompt the learner can rewrite: about what they saw, claiming nothing about a real system. */
export function runQuestionText(lab: LabSpec, experiment: LabExperiment, modeTitle?: string): string {
  const name = modeTitle ? `${experiment.title}: ${modeTitle}` : experiment.title;
  return `In the ${lab.name} (${name}), what did you change, what did you observe, and what would you do on a real project because of it?`;
}
