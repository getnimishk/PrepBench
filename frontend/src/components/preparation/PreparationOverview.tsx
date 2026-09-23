// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { getQuestionBankSummary, getReviewCounts, getRoadmaps } from '../../services/api';
import { chooseRoadmap } from '../../services/roadmapChoice';
import { drillHref } from '../../services/recommendation';
import { pct } from '../../services/readinessText';
import { READINESS_LABELS, type Subject } from '../../types/subject';
import type { RoadmapSummary } from '../../types/roadmap';
import type { ReviewCounts } from '../../types/review';
import type { QuestionBankSummary } from '../../types/question';
import { Bar, BigFigure, Detail, Eyebrow, Row } from '../ui/primitives';

/**
 * The parts of a preparation the portfolio and the preparation's own page both
 * show, as the prototype draws them: its readiness, the one thing recommended,
 * and a row for each thing inside it.
 *
 * Every figure is read for that preparation. A figure that could not be read is
 * left unsaid rather than drawn as a zero.
 */

export const KIND_LABEL: Record<Subject['kind'], string> = {
  certification: 'Certification',
  skill: 'Skill',
};

export interface OverviewFacts {
  roadmap: { roadmap: RoadmapSummary; linked: boolean } | null;
  counts: ReviewCounts | null;
  bank: QuestionBankSummary | null;
}

/** The roadmap, review counts and bank summary behind one preparation's rows. */
export function useOverviewFacts(subjectId: number | null | undefined): OverviewFacts | null {
  const [facts, setFacts] = useState<OverviewFacts | null>(null);

  useEffect(() => {
    if (subjectId == null) {
      setFacts(null);
      return undefined;
    }
    let cancelled = false;
    setFacts(null);
    Promise.all([
      getRoadmaps().then((all) => chooseRoadmap(all, subjectId)).catch(() => null),
      getReviewCounts(subjectId).catch(() => null),
      getQuestionBankSummary(subjectId).catch(() => null),
    ]).then(([roadmap, counts, bank]) => {
      // Only a roadmap linked to this preparation describes it.
      if (!cancelled) setFacts({ roadmap: roadmap?.linked ? roadmap : null, counts, bank });
    });
    return () => { cancelled = true; };
  }, [subjectId]);

  return facts;
}

const latestScore = (subject: Subject) => {
  const scores = subject.readiness.recent_scores;
  return scores.length > 0 ? scores[scores.length - 1] : null;
};

/** The verdict as a short label, or what stands in for one before any evidence. */
export const verdictLabel = (subject: Subject): string => {
  const r = subject.readiness;
  if (!subject.has_exam_profile) return subject.kind === 'skill' ? 'Practised, not certified' : 'No exam profile';
  if (r.mock_count === 0) return 'Not measured yet';
  return READINESS_LABELS[r.state];
};

/** "Almost there · 93%": the portfolio card's line. */
export const cardMeta = (subject: Subject): string => {
  const latest = latestScore(subject);
  return [verdictLabel(subject), latest != null && subject.readiness.mock_count > 0 ? pct(latest) : null]
    .filter(Boolean).join(' · ');
};

/** The prototype's readiness block: the verdict large, its evidence, and a bar. */
export const ReadinessBlock: React.FC<{ subject: Subject; size?: number }> = ({ subject, size }) => {
  const r = subject.readiness;
  const latest = latestScore(subject);
  const measured = subject.has_exam_profile && r.mock_count > 0 && latest != null;
  return (
    <Box>
      <Eyebrow>{subject.has_exam_profile ? 'Readiness' : 'Current signal'}</Eyebrow>
      <BigFigure size={size}>{verdictLabel(subject)}</BigFigure>
      <Detail>
        {measured
          ? `${pct(latest)} latest evidence${r.pass_mark != null ? ` · ${pct(r.pass_mark)} pass mark` : ''}`
          : subject.has_exam_profile
            ? 'No full mock under exam conditions yet. A mock measures; drills close gaps.'
            : 'This preparation has no exam profile, so readiness is not computed.'}
      </Detail>
      {measured && <Bar value={latest} label={`Latest evidence: ${pct(latest)}`} sx={{ mt: '10px' }} />}
    </Box>
  );
};

/** The one recommended next step, from the verdict's own figures. */
export const RecommendedBlock: React.FC<{ subject: Subject; eyebrow?: string }> = ({ subject, eyebrow = 'Recommended' }) => {
  const r = subject.readiness;
  const weakest = r.weakest_domain ? r.domains.find((d) => d.domain === r.weakest_domain) : null;

  let title: string;
  let detail: string;
  let to: string;
  if (subject.question_count === 0) {
    title = 'Import questions';
    detail = 'Nothing can be practised until the bank has questions.';
    to = '/question-bank';
  } else if (weakest && weakest.score_pct != null) {
    title = weakest.domain;
    detail = `${pct(weakest.score_pct)} · clearest gap`;
    to = drillHref(subject, weakest.domain);
  } else if (subject.has_exam_profile && r.mock_count === 0) {
    title = 'A first full mock';
    detail = 'Nothing is measured until one is sat.';
    to = '/exam-setup';
  } else {
    title = 'Practise';
    detail = `${subject.question_count} questions to draw from`;
    to = '/practice';
  }

  return (
    <Box>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Typography variant="h6" component="h3" sx={{ mt: '4px' }}>{title}</Typography>
      <Detail>{detail}</Detail>
      <Button component={RouterLink} to={to} variant="contained" sx={{ mt: '9px' }}>Start</Button>
    </Box>
  );
};

/** What the Learn row and panel say about the roadmap. */
export const learnSummary = (facts: OverviewFacts | null): string | null => {
  if (!facts) return null;
  if (!facts.roadmap) return 'No roadmap linked to this preparation';
  const p = facts.roadmap.roadmap.progress;
  return `${p.completed_count} / ${p.total_topics} topics`;
};

/** A row for each thing inside the preparation, each with the way in. */
export const InsideRows: React.FC<{ subject: Subject; facts: OverviewFacts | null }> = ({ subject, facts }) => {
  const r = subject.readiness;
  const learn = learnSummary(facts);
  const open = (to: string, what: string) => (
    <Button component={RouterLink} to={to} variant="outlined" aria-label={`Open ${what}`}>Open</Button>
  );
  const reviewDetail = facts?.counts
    ? `${facts.counts.unreviewed} ${facts.counts.unreviewed === 1 ? 'miss' : 'misses'} to read · ${facts.counts.spaced_due} due for retrieval`
    : 'Missed concepts followed by verification checks';

  return (
    <>
      <Row
        title="Learn"
        detail={`${learn ? `${learn} · ` : ''}roadmap, guides and demonstrations`}
        action={open('/learn', 'Learn')}
      />
      <Row
        title="Practice"
        detail="Weak topics, spaced repetition, custom practice and the full mock"
        action={open('/practice', 'Practice')}
      />
      <Row title="Review" detail={reviewDetail} action={open('/review', 'Review')} />
      <Row
        title="Assessment"
        detail={subject.has_exam_profile
          ? `${r.mock_count} full mock${r.mock_count === 1 ? '' : 's'} · performance and readiness`
          : 'Performance by area'}
        action={open('/analytics', 'Insights')}
      />
      <Row
        title="Question Bank"
        detail={`${subject.question_count} question${subject.question_count === 1 ? '' : 's'}`
          + (facts?.bank ? ` · ${facts.bank.missed_at_least_once} missed at least once` : '')}
        action={open('/question-bank', 'Question Bank')}
      />
    </>
  );
};
