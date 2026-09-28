// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ContentPackDetail, ScenarioContent, ScenarioRole } from '../../types/contentPack';
import type { RequirementKind } from './jdParse';

/**
 * The role diagnostic: ten interview questions chosen for a job's requirements.
 *
 * The learner answers each in their own words, ticks which key points their
 * answer covered, and rates their confidence -- once at the start and again
 * before the interview, for a before/after view. It is a self-assessment, never
 * a score and never readiness: a role's readiness stays "Needs evaluation".
 *
 * Where the questions come from (D9): the diagnostic questions and the written
 * scenarios' role questions of the content packs attached to the Skills the
 * learner CONFIRMED as evidence for the job's requirements. A question fits the
 * job when its keywords appear in the requirements often enough (mandatory ones
 * count double, as in the prototype); the rest of the ten are core topics,
 * labelled as such, never "matched".
 */

export const DIAGNOSTIC_LENGTH = 10;

/**
 * The least relevance that counts as "fits this job": one keyword in a
 * mandatory requirement, or two in preferred ones. Below it a question is a
 * core topic -- a single stray substring in a nice-to-have is not a reason.
 */
export const MIN_RELEVANCE = 2;

/**
 * Never keywords. Nearly every data job says both, so they would crowd out the
 * topics a job actually names (the prototype's rule, kept for every pack).
 */
export const NOT_KEYWORDS = new Set(['pipeline', 'pipelines', 'load', 'loads']);

/**
 * Which requirement words fit each written scenario, by "<pack>/<scenario id>".
 * The prototype's list: scenarios carry no keywords in the pack format, and
 * these select questions rather than teach anything, so they live with the
 * selection rule.
 */
const SCENARIO_KEYWORDS: Record<string, string[]> = {
  'adf/1': ['increment', 'data factory', 'adf', 'etl', 'elt', 'ingest', 'data quality'],
  'adf/2': ['data factory', 'adf', 'backlog', 'requirement', 'stakeholder', 'etl', 'elt', 'agile'],
  'adf/3': ['hybrid', 'on-prem', 'infrastructure', 'integration', 'operat', 'vendor', 'handover', 'third part'],
  'adf/4': ['schedul', 'batch', 'orchestrat', 'ingest', 'freshness', 'sla', 'latency'],
};

export type Confidence = 'not-yet' | 'partly' | 'confident';

export const CONFIDENCE: { id: Confidence; label: string }[] = [
  { id: 'not-yet', label: 'Not yet' },
  { id: 'partly', label: 'Partly' },
  { id: 'confident', label: 'Confident' },
];

export interface RoleRequirementLike {
  text: string;
  kind: RequirementKind;
}

export interface DiagnosticQuestion {
  /** "<pack>@<version>/diagnostic/<id>" or "<pack>@<version>/scenario/<id>/lens/<role>". */
  ref: string;
  packId: string;
  topic: string;
  question: string;
  points: string[];
  keywords: string[];
  /** Where to study it: the guide chapter, or the scenario. */
  learn: { to: string; label: string };
}

export interface ChosenQuestion extends DiagnosticQuestion {
  /** True when chosen for this job's requirements; false = a core topic. */
  fits: boolean;
}

const keywordsOf = (words: string[]) => words.filter((k) => !NOT_KEYWORDS.has(k.toLowerCase()));

/** Every question a pack offers, in its usual order: its diagnostic (core) questions, then its written scenarios in this lens. */
export function packQuestions(pack: ContentPackDetail, lens: ScenarioRole): DiagnosticQuestion[] {
  const topics = pack.diagnostic_questions.map((q) => {
    const n = pack.chapters.findIndex((c) => c.id === q.chapter) + 1;
    return {
      ref: `${pack.pack_id}@${pack.version}/diagnostic/${q.id}`,
      packId: pack.pack_id,
      topic: q.topic,
      question: q.question,
      points: q.points,
      keywords: keywordsOf(q.keywords),
      learn: n > 0
        ? { to: `/learn/guides/${pack.pack_id}/${q.chapter}`, label: `${pack.title} guide, chapter ${n}` }
        : { to: `/learn/guides/${pack.pack_id}`, label: `${pack.title} guide` },
    };
  });
  const scenarios = pack.scenario_levels.flatMap((l) => l.scenarios).filter((s) => s.content).map((s) => {
    const lensContent = (s.content as ScenarioContent).lenses[lens];
    return {
      ref: `${pack.pack_id}@${pack.version}/scenario/${s.id}/lens/${lens}`,
      packId: pack.pack_id,
      topic: s.title,
      question: lensContent.sayIt.question,
      points: lensContent.sayIt.points,
      keywords: keywordsOf(SCENARIO_KEYWORDS[`${pack.pack_id}/${s.id}`] ?? []),
      learn: { to: `/scenarios/${pack.pack_id}/${s.id}`, label: `${pack.title} scenario ${s.number}` },
    };
  });
  return [...topics, ...scenarios];
}

/** The requirements a question speaks to, by its keywords. */
export function requirementsFor<R extends RoleRequirementLike>(q: Pick<DiagnosticQuestion, 'keywords'>, requirements: R[]): R[] {
  return requirements.filter((r) => {
    const t = r.text.toLowerCase();
    return q.keywords.some((k) => t.includes(k));
  });
}

/** Keywords found in each requirement, mandatory ones counting double. */
export function relevance(q: Pick<DiagnosticQuestion, 'keywords'>, requirements: RoleRequirementLike[]): number {
  return requirements.reduce((sum, r) => {
    const t = r.text.toLowerCase();
    const hits = q.keywords.filter((k) => t.includes(k)).length;
    return sum + hits * (r.kind === 'mandatory' ? 2 : 1);
  }, 0);
}

/**
 * The ten questions for a role's first attempt.
 *
 * 1. From the packs of the confirmed linked Skills, every question at or above
 *    MIN_RELEVANCE, most relevant first (ties keep the packs' order).
 * 2. Then core topics to make ten: the linked packs' remaining questions, then
 *    the other shipped packs' -- each pack's diagnostic questions before its
 *    scenarios. With no linked Skill, all ten are core topics.
 */
export function pickQuestions(
  lens: ScenarioRole,
  requirements: RoleRequirementLike[],
  linkedPacks: ContentPackDetail[],
  corePacks: ContentPackDetail[],
): ChosenQuestion[] {
  const linked = linkedPacks.flatMap((p) => packQuestions(p, lens));
  const fitting = linked
    .map((q, order) => ({ q, order, score: relevance(q, requirements) }))
    .filter((s) => s.score >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, DIAGNOSTIC_LENGTH)
    .map((s) => ({ ...s.q, fits: true }));

  const chosen = new Set(fitting.map((q) => q.ref));
  const linkedIds = new Set(linkedPacks.map((p) => p.pack_id));
  const core = [
    ...linked,
    ...corePacks.filter((p) => !linkedIds.has(p.pack_id)).flatMap((p) => packQuestions(p, lens)),
  ];
  const fill: ChosenQuestion[] = [];
  for (const q of core) {
    if (fitting.length + fill.length >= DIAGNOSTIC_LENGTH) break;
    if (chosen.has(q.ref)) continue;
    chosen.add(q.ref);
    fill.push({ ...q, fits: false });
  }
  return [...fitting, ...fill];
}

/** A question by its ref, from whichever loaded pack version it names; null when that pack isn't loaded. */
export function questionByRef(ref: string, packs: ContentPackDetail[]): DiagnosticQuestion | null {
  const m = /^([^@/]+)@(\d+)\/(?:diagnostic\/[^/]+|scenario\/[^/]+\/lens\/(po|pm|dm|em))$/.exec(ref);
  if (!m) return null;
  const pack = packs.find((p) => p.pack_id === m[1] && p.version === Number(m[2]));
  if (!pack) return null;
  const lens = (m[3] ?? 'po') as ScenarioRole;
  return packQuestions(pack, lens).find((q) => q.ref === ref) ?? null;
}

/** The distinct pack versions a set of refs needs, e.g. to show a retake or the results table. */
export function packVersionsOf(refs: string[]): { packId: string; version: number }[] {
  const seen = new Map<string, { packId: string; version: number }>();
  for (const ref of refs) {
    const m = /^([^@/]+)@(\d+)\//.exec(ref);
    if (m) seen.set(`${m[1]}@${m[2]}`, { packId: m[1], version: Number(m[2]) });
  }
  return [...seen.values()];
}

/** The prototype's best guess at a lens from a job title; the learner can change it. */
export function guessLens(roleName: string, jobDescription: string): ScenarioRole {
  const text = `${roleName}\n${jobDescription.slice(0, 400)}`.toLowerCase();
  if (/delivery (manager|lead)|programme manager|program manager|scrum master/.test(text)) return 'dm';
  if (/engineering manager|head of engineering|cloud engineering|engineering lead/.test(text)) return 'em';
  if (/product manager/.test(text)) return 'pm';
  if (/product owner/.test(text)) return 'po';
  return 'po';
}
