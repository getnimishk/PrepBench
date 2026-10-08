// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { Scenario, ScenarioContent, ScenarioRole } from '../../types/contentPack';
import type { WireLearningAttempt } from '../../types/learning';
import { getLearningAttempts, patchLearningAttempt, startLearningAttempt } from '../api';
import { isAttemptIdTaken } from '../apiError';

// A scenario's progress, kept as learning attempts (skills plan D7).
//
// Two kinds of attempt, both on the active Skill preparation's subject_id:
//
//   check  one per check question, answered once for every role.
//          challenge_id "<pack>/<scenario>/check/<i>", the chosen option index
//          committed as the PREDICTION and completed with `correct`. The
//          server's write-once rule on a prediction is what makes "your first
//          answer locks" true: a second, different answer is refused there,
//          not just greyed out here.
//
//   lens   one per role practised. challenge_id "<pack>/<scenario>/lens/<role>".
//          The case notes are the learner's own analysis before the debrief,
//          so they are what gets committed: "Show the debrief" commits the
//          marker prediction `case-notes`, writes the notes into
//          explanation_text (headed per task) and completes the attempt in
//          one request. The debrief therefore can't be on record before the
//          notes it is compared with. The Say-it answer is added to the same
//          explanation_text afterwards, and the ticked Say-it points are
//          rubric_coverage.
//
// Nothing is kept in the browser. Notes typed before the debrief are page
// state until they are committed with it -- the service refuses
// explanation_text on an attempt with no committed prediction, and that rule
// is kept rather than worked around.
//
// Every id carries the pack version (D4), so an upgraded pack starts a fresh
// record instead of pinning old answers onto new questions.

export const ROLES: { id: ScenarioRole; label: string; focus: string }[] = [
  { id: 'po', label: 'Product Owner', focus: 'the backlog and acceptance criteria' },
  { id: 'pm', label: 'Product Manager', focus: 'users, impact and product measures' },
  { id: 'dm', label: 'Delivery Manager', focus: 'the incident, the process and the plan' },
  { id: 'em', label: 'Engineering Manager', focus: 'engineering practice and the team' },
];

export const isRole = (value: unknown): value is ScenarioRole =>
  ROLES.some((r) => r.id === value);

/** The prediction a lens attempt commits: "my case notes, in explanation_text". */
export const CASE_NOTES_COMMITTED = 'case-notes';

/** Per-field caps that keep a lens's explanation_text inside the server's 4000. */
export const NOTE_MAX = 500;
export const SAY_IT_MAX = 1500;
export const EXPLANATION_MAX = 4000;

export interface ScenarioKey {
  subjectId: number;
  packId: string;
  version: number;
  scenarioId: string;
}

// ---- ids ---------------------------------------------------------------------

export const checkChallengeId = (packId: string, scenarioId: string, index: number) =>
  `${packId}/${scenarioId}/check/${index}`;

export const lensChallengeId = (packId: string, scenarioId: string, role: ScenarioRole) =>
  `${packId}/${scenarioId}/lens/${role}`;

export const scenarioConceptId = (packId: string, chapterId: string) => `${packId}/${chapterId}`;

export const checkFingerprint = (version: number) => `pack_version=${version}`;

export const lensFingerprint = (version: number, role: ScenarioRole) => `pack_version=${version};lens=${role}`;

/** Where a saved Say-it question came from, e.g. "adf@1/scenario/1/lens/po". */
export const sayItSourceRef = (packId: string, version: number, scenarioId: string, role: ScenarioRole) =>
  `${packId}@${version}/scenario/${scenarioId}/lens/${role}`;

/** 32-bit FNV-1a, as hex: short, stable, and only used when a readable id won't fit. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The attempt's id, the same every time for the same question, role and
 * preparation. Deterministic on purpose: a check answered in another tab, or
 * again after a reload, reaches the attempt that already holds the first
 * answer, and the server refuses the second. A random id per visit would
 * quietly allow a fresh answer each time.
 *
 * `generation` exists because a subject id is not forever: SQLite reuses the
 * highest id after a delete, and a deleted preparation's attempts stay (their
 * subject_id set to NULL). The first id whose attempt is absent or belongs to
 * this preparation is the one to use -- see openAttempt.
 */
export function scenarioAttemptUid(key: ScenarioKey, part: string, generation = 0): string {
  const suffix = generation > 0 ? `~${generation}` : '';
  const readable = `s${key.subjectId}:${key.packId}@${key.version}:${key.scenarioId}:${part}${suffix}`;
  if (readable.length <= 64) return readable;
  return `s${key.subjectId}:${fnv1a(readable)}${fnv1a(`${readable}#`)}`;
}

// ---- the lens's explanation_text ----------------------------------------------

const letter = (i: number) => String.fromCharCode(97 + i);
const taskHeading = (task: string, i: number) => `${letter(i)}) ${task}`;
const sayItHeading = (question: string) => `Say it: ${question}`;

/** The shared tasks, then the role's own. */
export const lensTasks = (content: ScenarioContent, role: ScenarioRole) =>
  [...content.caseStudy.tasks, ...content.lenses[role].tasks];

/**
 * Case notes (and, once written, the Say-it answer) as one readable text,
 * each part under the question it answers.
 */
export function serializeLensText(
  tasks: string[],
  notes: Record<number, string>,
  sayIt?: { question: string; answer: string },
): string {
  const parts = tasks.map((t, i) => `${taskHeading(t, i)}\n${(notes[i] ?? '').trim()}`);
  if (sayIt && sayIt.answer.trim()) parts.push(`${sayItHeading(sayIt.question)}\n${sayIt.answer.trim()}`);
  return parts.join('\n\n');
}

/**
 * The reverse of serializeLensText, for the same tasks. Headings are matched in
 * order, as whole lines, so a note can contain anything except a line that is
 * exactly the next question's heading.
 */
export function parseLensText(
  tasks: string[],
  sayItQuestion: string,
  text: string | null | undefined,
): { notes: Record<number, string>; sayIt: string } {
  const headings = [...tasks.map(taskHeading), sayItHeading(sayItQuestion)];
  const bodies: string[][] = headings.map(() => []);
  let current = -1;
  for (const line of (text ?? '').split('\n')) {
    const next = headings.indexOf(line, current + 1);
    if (next !== -1) {
      current = next;
      continue;
    }
    if (current >= 0) bodies[current].push(line);
  }
  const clean = (lines: string[]) => lines.join('\n').trim();
  const notes: Record<number, string> = {};
  tasks.forEach((_, i) => {
    const body = clean(bodies[i]);
    if (body) notes[i] = body;
  });
  return { notes, sayIt: clean(bodies[tasks.length]) };
}

// ---- reading progress -----------------------------------------------------------

export interface LensProgress {
  /** The attempt this role's work is kept in; later saves go to it. */
  attemptUid: string;
  /** The case notes as committed with the debrief; empty until then. */
  notes: Record<number, string>;
  debriefShown: boolean;
  sayIt: string;
  pointsCovered: number[];
  /** When the debrief was opened, for picking the role the learner last used. */
  completedAt?: string;
}

export interface ScenarioProgress {
  /** Check question index → the option the learner chose (locked). */
  answers: Record<number, number>;
  lenses: Partial<Record<ScenarioRole, LensProgress>>;
}

/** This scenario's progress, at this pack version, from the preparation's attempts. */
export function scenarioProgress(
  attempts: WireLearningAttempt[],
  packId: string,
  version: number,
  scenario: Pick<Scenario, 'id'> & { content?: ScenarioContent | null },
): ScenarioProgress {
  const progress: ScenarioProgress = { answers: {}, lenses: {} };
  const content = scenario.content;
  const prefix = `${packId}/${scenario.id}/`;
  for (const a of attempts) {
    if (!a.challenge_id.startsWith(prefix)) continue;
    const rest = a.challenge_id.slice(prefix.length);
    const check = /^check\/(\d+)$/.exec(rest);
    if (check) {
      if (a.scenario_fingerprint !== checkFingerprint(version)) continue;
      const chosen = Number.parseInt(a.prediction ?? '', 10);
      if (a.committed_at && Number.isInteger(chosen)) progress.answers[Number(check[1])] = chosen;
      continue;
    }
    const lens = /^lens\/([a-z]+)$/.exec(rest);
    if (lens && isRole(lens[1]) && content) {
      const role = lens[1];
      if (a.scenario_fingerprint !== lensFingerprint(version, role)) continue;
      const parsed = parseLensText(lensTasks(content, role), content.lenses[role].sayIt.question, a.explanation_text);
      progress.lenses[role] = {
        attemptUid: a.attempt_uid,
        notes: parsed.notes,
        debriefShown: Boolean(a.completed_at),
        sayIt: parsed.sayIt,
        pointsCovered: Object.entries(a.rubric_coverage ?? {})
          .filter(([, covered]) => covered)
          .map(([i]) => Number(i))
          .filter(Number.isInteger)
          .sort((x, y) => x - y),
        completedAt: a.completed_at ?? undefined,
      };
    }
  }
  return progress;
}

export type ScenarioStatus = 'planned' | 'not-started' | 'in-progress' | 'practised';

/** Practised = at least one role has opened the debrief and written a Say-it answer. */
export function scenarioStatus(hasContent: boolean, progress: ScenarioProgress): ScenarioStatus {
  if (!hasContent) return 'planned';
  const lenses = Object.values(progress.lenses);
  if (lenses.some((l) => l?.debriefShown && l.sayIt.trim())) return 'practised';
  if (Object.keys(progress.answers).length || lenses.length) return 'in-progress';
  return 'not-started';
}

export const rolesPractised = (progress: ScenarioProgress) =>
  ROLES.filter((r) => progress.lenses[r.id]?.debriefShown && progress.lenses[r.id]?.sayIt.trim());

/** The role the learner last opened a debrief as here, or Product Owner. */
export function lastRole(progress: ScenarioProgress): ScenarioRole {
  let best: { role: ScenarioRole; at: string } | null = null;
  for (const r of ROLES) {
    const at = progress.lenses[r.id]?.completedAt;
    if (at && (!best || at > best.at)) best = { role: r.id, at };
  }
  return best?.role ?? 'po';
}

/** The preparation's attempts. */
export const fetchPreparationAttempts = (subjectId: number) => getLearningAttempts({ subject_id: subjectId });

// ---- writing -----------------------------------------------------------------------

/** Generations tried before giving up; a real install never needs more than one or two. */
const MAX_GENERATIONS = 20;

/**
 * Open (or reach) this preparation's attempt for one check question or lens.
 *
 * Opening is idempotent on the id, so an attempt that already exists comes
 * back as it is. An id another preparation's attempt holds -- a deleted one
 * whose id this preparation now reuses -- is refused by the server (409, with
 * none of that attempt in it): step to the next generation of the id. Every
 * tab walks the same sequence, so they all land on the same attempt and the
 * server's lock still holds.
 */
async function openAttempt(
  key: ScenarioKey,
  part: string,
  body: { challenge_id: string; concept_id: string; scenario_fingerprint: string },
): Promise<string> {
  for (let generation = 0; generation < MAX_GENERATIONS; generation += 1) {
    const uid = scenarioAttemptUid(key, part, generation);
    try {
      const attempt = await startLearningAttempt({
        attempt_uid: uid, ...body, mode: 'guided', hint_count: 0, subject_id: key.subjectId,
      });
      // The server answers only with this preparation's own row; checked again here.
      if (attempt.subject_id === key.subjectId) return uid;
    } catch (err) {
      if (!isAttemptIdTaken(err)) throw err;
    }
  }
  throw new Error('Could not open an attempt for this question. Reload the page and try again.');
}

/**
 * Answer a check question. Once only: the answer is committed as the attempt's
 * prediction, and the server refuses a different one after that.
 */
export async function answerCheck(
  key: ScenarioKey,
  chapterId: string,
  index: number,
  chosen: number,
  correct: boolean,
): Promise<WireLearningAttempt> {
  const uid = await openAttempt(key, `c${index}`, {
    challenge_id: checkChallengeId(key.packId, key.scenarioId, index),
    concept_id: scenarioConceptId(key.packId, chapterId),
    scenario_fingerprint: checkFingerprint(key.version),
  });
  return patchLearningAttempt(uid, { prediction: String(chosen), completed: true, correct }, key.subjectId);
}

/**
 * Commit the case notes and open the debrief, in one request: prediction,
 * notes and completion land together, so there is no record of a debrief
 * without the notes it is compared with.
 */
export async function commitCaseNotes(
  key: ScenarioKey,
  chapterId: string,
  role: ScenarioRole,
  text: string,
): Promise<WireLearningAttempt> {
  const uid = await openAttempt(key, `lens:${role}`, {
    challenge_id: lensChallengeId(key.packId, key.scenarioId, role),
    concept_id: scenarioConceptId(key.packId, chapterId),
    scenario_fingerprint: lensFingerprint(key.version, role),
  });
  return patchLearningAttempt(uid, {
    prediction: CASE_NOTES_COMMITTED,
    explanation_text: text,
    completed: true,
  }, key.subjectId);
}

/** After the debrief: the notes plus the Say-it answer, on the lens's own attempt. */
export const saveLensText = (subjectId: number, attemptUid: string, text: string) =>
  patchLearningAttempt(attemptUid, { explanation_text: text }, subjectId);

/** Which Say-it points the learner says they covered. Their own reading; never graded. */
export const saveCoverage = (subjectId: number, attemptUid: string, covered: number[], total: number) =>
  patchLearningAttempt(attemptUid, {
    rubric_coverage: Object.fromEntries(Array.from({ length: total }, (_, i) => [String(i), covered.includes(i)])),
  }, subjectId);
