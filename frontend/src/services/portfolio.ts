// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { Tone } from '../components/ui/primitives';
import type { AssessedBy, EvidenceKind, EvidenceLevel, WorkspaceKind } from '../types/portfolio';
import { ADF_LAB_EXPERIMENTS } from './adfLab/experiments';
import { TIERING_CHALLENGE } from './lakehouse/factoryModel';
import { ACCESS_CHALLENGE, WATERMARK_CHALLENGE } from './lakehouse/pipelineChallenges';
import { challengeById } from './lakehouse/stationC';
import { defectTitle } from './lakehouse/stationD';
import { STATION_I_TITLES } from './lakehouse/identityModel';
import { CONCEPTS } from './learning/concepts';

/**
 * How Workspace and Evidence name and label what the server sends.
 *
 * The server names what it can from its own rows (a topic, a scenario from its
 * content pack, a question). Lab work is named here, from the registries that
 * already name it on its own screens -- so an experiment is called the same thing
 * in the lab and in the Workspace. When a registry does not know an id, the
 * server's plain title stands; nothing is invented.
 */

/** An ADF lab track's title: the experiment, and its fault mode when it has one. */
export function adfTrackTitle(track: string): string | null {
  const [slug, mode] = track.split('.');
  const experiment = ADF_LAB_EXPERIMENTS.find((e) => e.slug === slug);
  if (!experiment) return null;
  if (!mode) return experiment.title;
  const t = experiment.tracks?.find((x) => x.id === mode);
  return t ? `${experiment.title}: ${t.title}` : experiment.title;
}

const LAKEHOUSE_TITLES: Record<string, string> = {
  [WATERMARK_CHALLENGE.id]: WATERMARK_CHALLENGE.title,
  [ACCESS_CHALLENGE.id]: ACCESS_CHALLENGE.title,
  [TIERING_CHALLENGE.id]: 'Migration Factory: tiering',
  ...STATION_I_TITLES,
};

/** The title to show for an item: from the lab's own registry when it is lab work. */
export function titleOf(item: { title: string; ref: Record<string, string> }): string {
  const { track, challenge_id: challenge, concept_id: concept } = item.ref ?? {};
  if (track) return adfTrackTitle(track) ?? item.title;
  if (challenge?.startsWith('lakehouse.')) {
    return LAKEHOUSE_TITLES[challenge] ?? challengeById(challenge)?.title ?? defectTitle(challenge) ?? item.title;
  }
  if (concept && concept in CONCEPTS) return CONCEPTS[concept as keyof typeof CONCEPTS].canonicalName;
  return item.title;
}

export const WORKSPACE_KIND_LABEL: Record<WorkspaceKind, string> = {
  lab_run: 'Lab run',
  lakehouse_challenge: 'Lakehouse challenge',
  scenario_notes: 'Case notes',
  interview_answer: 'Prepared answer',
  recording: 'Recording',
  topic_guide: 'Topic guide',
  topic_note: 'Topic notes',
  system_design_answer: 'System design',
  design_review_call: 'Design review',
  sandbox_run: 'Sandbox run',
};

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  lab_stage: 'ADF lab stage',
  lakehouse_challenge: 'Lakehouse challenge',
  scenario_check: 'Scenario check',
  scenario_lens: 'Scenario case notes',
  sandbox_prediction: 'Sandbox prediction',
  learning_attempt: 'Learning attempt',
  topic_demonstration: 'Topic demonstration',
  mock_exam: 'Full mock',
  recording: 'Recording',
  system_design: 'System design',
  design_review: 'Design review',
};

/** Strongest first. */
export const EVIDENCE_LEVELS: EvidenceLevel[] = ['evidenced', 'demonstrated', 'completed', 'activity'];

export const LEVEL: Record<EvidenceLevel, { label: string; tone: Tone; meaning: string }> = {
  evidenced: {
    label: 'Evidenced', tone: 'success',
    meaning: 'Correct, and backed by your own explanation or by applying it to a changed constraint.',
  },
  demonstrated: {
    label: 'Demonstrated', tone: 'accent',
    meaning: 'Graded correct against the model, the answer key or a mock’s pass mark.',
  },
  completed: {
    label: 'Completed', tone: 'neutral',
    meaning: 'Finished, but not graded correct: wrong, not graded, self-assessed or AI-assessed.',
  },
  activity: {
    label: 'Activity', tone: 'neutral',
    meaning: 'Started, not finished yet.',
  },
};

export const ASSESSED_BY_LABEL: Record<AssessedBy, string> = {
  model: 'Checked by the model',
  answer_key: 'Checked against the answer key',
  exam: 'Scored as an exam',
  self: 'Self-assessed',
  ai: 'AI-assessed, not verified',
  not_assessed: 'Not graded',
};

/** A server time as a short date, or null when there is none or it does not parse. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
