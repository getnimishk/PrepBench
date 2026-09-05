// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert, CircularProgress, Stack } from '@mui/material';
import { getSubjects, getHomeSummary, getOtherPreparation } from '../services/api';
import {
  HomeSummary, OtherPreparation, Readiness, Subject, READINESS_LABELS,
} from '../types/subject';
import { blockerSentence, pct, readySentence } from '../services/readinessText';

/**
 * Where you stand, why, and the one thing worth doing about it.
 *
 * Two rounds of correction landed here. The first removed a metric wall --
 * four KPI cards, a chart of every session, a streak, a daily goal ring, an
 * "adaptive tip", two topic widgets and an activity table. The second removed
 * what was left over from being a status page:
 *
 *   The subject name was the largest thing on the screen. It is the one fact
 *   the learner already knows. The verdict is the headline now.
 *
 *   "Weakest area: Managing Products with Agility" named the lowest-scoring
 *   domain whether or not it was actually weak -- that domain sits five
 *   points above the floor. It read as an accusation and explained nothing.
 *   The rule now reports which condition of READY is unmet, and the page
 *   states it in a sentence.
 *
 *   A six-row "Recently" table repeated the three mocks whose scores are
 *   already in the trend, and Review owns history anyway.
 *
 *   A sparkline sat above the same four numbers written out. Four points do
 *   not need a chart; the numbers carry more and cost less.
 *
 * What is here is the verdict, the evidence for it, the reason it is not
 * better, one continuation, and -- because a page that only lists deficits
 * teaches people to stop opening it -- what the last stretch of work bought.
 */

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [other, setOther] = useState<OtherPreparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getSubjects(), getHomeSummary(), getOtherPreparation().catch(() => [])])
      .then(([s, h, o]) => { setSubjects(s); setSummary(h); setOther(o); })
      .catch(() => setError('Could not reach PrepBench’s backend, so this page has nothing '
        + 'to show yet. Nothing has been lost — your history is in the database on this machine.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }
  // Actionable rather than merely truthful: an error the reader can only
  // look at is a dead end, and this is the first screen of the product.
  if (error) {
    return (
      <Alert
        severity="error"
        action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}
      >
        {error}
      </Alert>
    );
  }

  if (subjects.length === 0) {
    return (
      <Box sx={{ maxWidth: 520, py: 8 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1.5 }}>Nothing to measure yet</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
          Import a question bank and PrepBench will start keeping track of where you stand.
        </Typography>
        <Button
          variant="contained"
          disableElevation
          onClick={() => navigate('/question-bank')}
          sx={{ borderRadius: '100px', textTransform: 'none' }}
        >
          Import questions
        </Button>
      </Box>
    );
  }

  // The subject being prepared for: the one with an exam profile and the most
  // evidence behind it. A second one appears only if it has evidence too.
  const primary =
    [...subjects]
      .filter((s) => s.has_exam_profile)
      .sort((a, b) => b.readiness.mock_count - a.readiness.mock_count)[0]
    ?? subjects[0];
  const alsoMeasured = subjects.filter(
    (s) => s.id !== primary.id && s.has_exam_profile && s.readiness.mock_count > 0
  );

  const unreviewed = summary?.per_subject.find((p) => p.subject_id === primary.id)?.unreviewed ?? 0;

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 5, lg: 8 },
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 620px) minmax(220px, 280px)' },
        alignItems: 'start',
        maxWidth: 1000,
        pt: 1,
      }}
    >
      <Box>
        <Verdict subject={primary} also={alsoMeasured} />
        <Why readiness={primary.readiness} />
        <Continuation subject={primary} unreviewed={unreviewed} summary={summary} />
      </Box>

      <Box sx={{ display: 'grid', gap: 5 }}>
        <RecentLearning readiness={primary.readiness} />
        <OtherPreparationList items={other} />
      </Box>
    </Box>
  );
};

/**
 * The verdict, with the evidence directly under it.
 *
 * The state is the headline because it answers the only question someone
 * opens this page with. The subject name sits above it in small type: it
 * identifies the numbers, it is not news.
 */
const Verdict: React.FC<{ subject: Subject; also: Subject[] }> = ({ subject, also }) => {
  const r = subject.readiness;
  const passMark = r.pass_mark ?? null;

  return (
    <Box>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary', letterSpacing: '0.08em',
          textTransform: 'uppercase', fontSize: 12, fontWeight: 500,
        }}
      >
        {subject.name}
      </Typography>

      <Typography variant="h3" sx={{ fontWeight: 600, mt: 0.5, letterSpacing: '-0.02em' }}>
        {r.mock_count === 0 && r.state === 'needs_evaluation'
          ? 'Not measured yet'
          : READINESS_LABELS[r.state]}
      </Typography>

      {r.mock_count > 0 && (
        <>
          <Stack direction="row" sx={{ mt: 2.5, alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
            {r.recent_scores.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Typography component="span" aria-hidden sx={{ color: 'text.disabled', fontSize: 18 }}>
                    &rarr;
                  </Typography>
                )}
                {/* A score under the pass mark is marked as well as muted:
                    colour alone would leave the distinction invisible to a
                    reader who cannot see it. */}
                <Typography
                  component="span"
                  title={passMark != null && s < passMark ? 'below the pass mark' : undefined}
                  sx={{
                    fontSize: 26,
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    color: passMark != null && s < passMark ? 'text.secondary' : 'text.primary',
                    textDecoration: passMark != null && s < passMark ? 'underline dotted' : 'none',
                    textUnderlineOffset: '5px',
                  }}
                >
                  {pct(s)}
                </Typography>
              </React.Fragment>
            ))}
            {passMark != null && (
              <Typography variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
                {pct(passMark)} to pass
              </Typography>
            )}
          </Stack>

          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
            {r.mock_count} full mock{r.mock_count === 1 ? '' : 's'}
            {r.points_per_mock != null && r.points_per_mock > 0
              && ` · rising about ${r.points_per_mock} points a mock`}
            {r.points_per_mock != null && r.points_per_mock < 0
              && ` · falling about ${Math.abs(r.points_per_mock)} points a mock`}
          </Typography>
        </>
      )}

      {also.length > 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          Also measured:{' '}
          {also
            .map((s) => `${s.name} — ${READINESS_LABELS[s.readiness.state].toLowerCase()}`)
            .join(', ')}
        </Typography>
      )}
    </Box>
  );
};

/** Why the verdict is what it is. Explanation only: it carries no button. */
const Why: React.FC<{ readiness: Readiness }> = ({ readiness }) => {
  const blocker = readiness.blockers[0] ?? null;

  return (
    <Box sx={{ mt: 5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        {blocker ? 'Why not ready' : 'Why'}
      </Typography>
      <Typography variant="body1" sx={{ mt: 0.5, lineHeight: 1.65 }}>
        {blocker ? blockerSentence(blocker) : readySentence(readiness.pass_mark)}
      </Typography>
    </Box>
  );
};

/**
 * One continuation, and only one.
 *
 * Ordered by what the evidence most supports, stopping at the first match.
 * Finishing something already open beats starting something new; reviewing a
 * known miss beats a fresh question, because that is where the score moves.
 *
 * There is no second CTA, no count of what was skipped, and nothing here
 * that punishes being ignored for a week.
 */
const Continuation: React.FC<{
  subject: Subject;
  unreviewed: number;
  summary: HomeSummary | null;
}> = ({ subject, unreviewed, summary }) => {
  const navigate = useNavigate();
  const r = subject.readiness;
  const resumable = summary?.resumable ?? null;
  const weak = r.blockers.find((b) => b.kind === 'weak_domain');

  const next = (() => {
    if (resumable) {
      return {
        label: 'Unfinished session',
        why: `You stopped at question ${resumable.answered + 1} of ${resumable.total}.`,
        cta: 'Pick it up',
        go: () => navigate(`/exam/${resumable.session_id}`),
      };
    }
    if (unreviewed > 0) {
      return {
        label: 'Unreviewed misses',
        why: `${unreviewed} wrong answer${unreviewed === 1 ? '' : 's'} you have not read `
          + 'the explanation for. Understanding a miss is what changes the next score; '
          + 'answering another new question is not.',
        cta: 'Review them',
        go: () => navigate('/review'),
      };
    }
    if (weak) {
      return {
        label: 'Weak area',
        why: `${weak.domain} is the one area under the floor, at ${pct(weak.value ?? 0)}.`,
        cta: 'Practise it',
        go: () => navigate(
          `/exam-setup?kind=drill&subject=${subject.id}`
          + `&domain=${encodeURIComponent(weak.domain ?? '')}`
        ),
      };
    }
    // A fresh install has subjects and no questions. Offering a mock that
    // the engine will refuse to assemble makes the only action on a new
    // user's Home an error message.
    if (subject.question_count === 0) {
      return {
        label: 'Next',
        why: `There are no ${subject.name} questions yet. Import a bank and `
          + 'PrepBench can start measuring where you stand.',
        cta: 'Import questions',
        go: () => navigate('/question-bank'),
      };
    }
    if (!subject.has_exam_profile) {
      return {
        label: 'Next',
        why: 'There is no exam to sit for this one, so practice is the whole of it.',
        cta: 'Practise',
        go: () => navigate('/practice'),
      };
    }
    if (r.mock_count === 0) {
      return {
        label: 'Next',
        why: 'A full paper under exam conditions calibrates everything else — the '
          + 'weak-area detection, the review schedule, and whether you would actually pass.',
        cta: 'Take your first mock',
        go: () => navigate(`/exam-setup?kind=mock&subject=${subject.id}`),
      };
    }
    if (r.state === 'ready') {
      return { label: 'Next', why: 'Book the exam.', cta: null, go: null };
    }
    return {
      label: 'Next',
      why: 'Another full paper is the only thing that moves the verdict.',
      cta: 'Take a mock',
      go: () => navigate(`/exam-setup?kind=mock&subject=${subject.id}`),
    };
  })();

  return (
    <Box
      sx={{
        mt: 5,
        // The one surface on the page. The reason and the button have to read
        // as a single thing, which is the only job containment does here.
        bgcolor: 'action.hover',
        borderRadius: 2,
        px: 3,
        py: 2.5,
      }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>{next.label}</Typography>
      <Typography variant="body1" sx={{ mt: 0.5, lineHeight: 1.65 }}>{next.why}</Typography>
      {next.cta && next.go && (
        <Button
          variant="contained"
          disableElevation
          onClick={next.go}
          sx={{ mt: 2, borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
        >
          {next.cta}
        </Button>
      )}
    </Box>
  );
};

/** What the last stretch of work actually bought. Absent when nothing moved. */
const RecentLearning: React.FC<{ readiness: Readiness }> = ({ readiness }) => {
  const m = readiness.most_improved;
  if (!m) return null;
  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Recent learning</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.6 }}>
        {m.domain} went from {pct(m.before_pct)} to {pct(m.after_pct)} between your last two mocks.
      </Typography>
    </Box>
  );
};

/** The formats that are not the exam. Only the ones actually used. */
const OtherPreparationList: React.FC<{ items: OtherPreparation[] }> = ({ items }) => {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Other preparation</Typography>
      <Stack sx={{ mt: 0.5 }}>
        {items.map((it) => (
          <Box
            key={it.key}
            component="button"
            type="button"
            // Named explicitly: a row assembled from two Typography children
            // reads as an unnamed button to anything not looking at it.
            aria-label={`${it.label} — ${it.detail}`}
            onClick={() => navigate(it.href)}
            sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2,
              py: 0.85, width: '100%', textAlign: 'left', font: 'inherit', border: 0,
              bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer',
              '&:hover': { color: 'primary.main' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Typography variant="body2">{it.label}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'right' }}>
              {it.detail}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};
