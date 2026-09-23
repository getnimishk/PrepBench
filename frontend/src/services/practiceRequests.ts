// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ExamCreateRequest, ExamPreview } from '../types/exam';
import type { Subject } from '../types/subject';

/**
 * The exam requests each practice format sends, written once.
 *
 * Practice previews a request and then starts the same one, and Mock Exam starts
 * a mock from its own page. Built in one place so the preview cannot describe a
 * different session from the one that starts, and the two ways into a mock cannot
 * drift into different papers.
 */

/** A focused session, as the prototype sizes it: long enough to show a pattern,
 *  short enough to finish in one sitting. */
export const FOCUSED_SESSION_SIZE = 8;

/** The full paper. Every parameter comes from the exam profile, never the learner. */
export const mockRequest = (subject: Subject): ExamCreateRequest => ({
  title: `${subject.name} — full mock`,
  exam_mode: 'timed',
  total_questions: subject.exam_question_count ?? 80,
  time_allowed_minutes: subject.exam_minutes ?? 60,
  passing_percentage: subject.pass_mark ?? 85,
  randomize_questions: true,
  session_kind: 'mock',
  subject_id: subject.id,
});

export const weakTopicRequest = (subject: Subject): ExamCreateRequest => ({
  title: `${subject.name} — weak topics`,
  exam_mode: 'weak_topic',
  total_questions: FOCUSED_SESSION_SIZE,
  passing_percentage: subject.pass_mark ?? 70,
  randomize_questions: true,
  session_kind: 'drill',
  subject_id: subject.id,
});

export const customRequest = (
  subject: Subject,
  choice: { domain?: string; topic?: string; difficulty?: string; count: number },
): ExamCreateRequest => ({
  title: `${choice.topic || choice.domain || subject.name} — custom set`,
  // 'practice' shows the explanation after each answer, which is what a set
  // the learner built for themselves is for.
  exam_mode: 'practice',
  domains: choice.domain ? [choice.domain] : undefined,
  topics: choice.topic ? [choice.topic] : undefined,
  difficulties: choice.difficulty ? [choice.difficulty] : undefined,
  total_questions: choice.count,
  passing_percentage: subject.pass_mark ?? 70,
  randomize_questions: true,
  session_kind: 'drill',
  subject_id: subject.id,
});

/** "3 missed before · 2 due for review · 5 never attempted", zeros left out. */
export const compositionText = (p: ExamPreview): string => {
  const parts = [
    p.previously_missed ? `${p.previously_missed} missed before` : '',
    p.due_for_review ? `${p.due_for_review} due for review` : '',
    p.never_attempted ? `${p.never_attempted} never attempted` : '',
    p.answered_correctly ? `${p.answered_correctly} right every time so far` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'no evidence on these yet';
};
