// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, CircularProgress, Stack, alpha, useTheme,
} from '@mui/material';
import { ArrowRight, ChevronRight } from 'lucide-react';
import {
  getSubjects, getHomeSummary, getOtherPreparation, getFocusTopics,
} from '../services/api';
import {
  FocusTopic, HomeSummary, OtherPreparation, Readiness, Subject, READINESS_LABELS,
} from '../types/subject';
import { blockerSentence, pct, plateauSentence, readySentence } from '../services/readinessText';

/**
 * Where you stand, why, and the one thing worth doing about it.
 *
 * Three rounds of correction landed here. The first removed a metric wall --
 * four KPI cards, a chart of every session, a streak, a daily goal ring, an
 * "adaptive tip", two topic widgets and an activity table. The second removed
 * what was left over from being a status page: the subject name as the largest
 * thing on screen, an invented "weakest area", a six-row history table that
 * Review already owns, and a sparkline above the same four numbers written out.
 *
 * The third and fourth are the two halves of one correction, against a visual
 * reference. The third read the reference's density as the thing to resist and
 * stripped the page to a headline, two panels and a three-line list: honest,
 * and too thin to be worth opening. It had also dropped the trend, which left
 * the page able to say where the learner stood but not whether they were
 * moving -- and "am I improving" is most of why anyone opens it.
 *
 * The fourth put the richness back without putting the dashboard back. The
 * distinction it runs on: a KPI wall is four unrelated numbers given equal
 * weight; grouped evidence is one argument with a picture of itself.
 *
 *   the verdict, large, with the subject as its eyebrow
 *   the case for it -- the latest run, the shape of the last four, and the
 *     conditions it is measured against -- in one panel rather than four cards
 *   why it is not better, and the one thing to do about it
 *   the topics that action would draw from
 *   the rest of the preparation, quieter, but present enough to find
 *
 * Still refused: a second chart, a streak, a daily goal, an activity feed, and
 * a row of equally loud buttons -- a page with four primary actions has none.
 */

/** How many focus topics the panel shows before deferring to Insights. */
const FOCUS_LIMIT = 4;

/** The card treatment, in one place so every surface on the page agrees. */
const panel = {
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 3.5,
} as const;

const shortDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [other, setOther] = useState<OtherPreparation[]>([]);
  const [focus, setFocus] = useState<FocusTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSubjects(),
      getHomeSummary(),
      getOtherPreparation().catch(() => []),
      // The focus list is supporting detail. Losing it must not cost the
      // learner the verdict, which is the reason they opened the page.
      getFocusTopics().catch(() => []),
    ])
      .then(([s, h, o, f]) => { setSubjects(s); setSummary(h); setOther(o); setFocus(f); })
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
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Nothing to measure yet
        </Typography>
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

  const full = { gridColumn: { md: '1 / -1' } };

  return (
    // One grid rather than a stack, so the wide layout can put the margin note
    // beside the verdict without the narrow one having to carry it there too.
    //
    // The note is LAST in the DOM and placed explicitly into the top-right
    // cell on md+, rather than written second and moved down with `order`.
    // Both look identical; only one of them reads correctly. `order` moves
    // boxes on screen and leaves the document alone, so a screen reader would
    // still have heard "recent learning" before the evidence it is a footnote
    // to -- the required reading order is preparation, state, evidence, why,
    // action, and only then anything else, for everybody.
    <Box
      sx={{
        maxWidth: 1180, pb: 6,
        display: 'grid',
        gap: { xs: 3, md: 3 },
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 340px)' },
        alignItems: 'start',
      }}
    >
      <Briefing subject={primary} also={alsoMeasured} />

      <Box sx={full}>
        <Evidence readiness={primary.readiness} />
      </Box>

      {/* Why, and what to do about it, in the width the reference gave its
          chart -- because the explanation is the thing a chart of six points
          was standing in for. */}
      <Box
        sx={{
          ...full,
          display: 'grid',
          gap: { xs: 3, md: 3.5 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(280px, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={{ ...panel, p: { xs: 2.5, sm: 3 } }}>
          <Why readiness={primary.readiness} />
          <Continuation subject={primary} unreviewed={unreviewed} summary={summary} />
        </Box>

        <FocusTopics topics={focus} subject={primary} />
      </Box>

      <Box sx={full}>
        <OtherPreparationRow items={other} />
      </Box>

      <Box sx={{ gridColumn: { md: '2' }, gridRow: { md: '1' }, width: '100%' }}>
        <RecentLearning readiness={primary.readiness} />
      </Box>
    </Box>
  );
};

/**
 * The briefing head: what you are preparing for, and where you stand.
 *
 * The state is the headline because it answers the only question someone
 * opens this page with. The subject name sits above it in small type: it
 * identifies the numbers, it is not news -- and it is a link, because the
 * next question ("which domains?") is answered on its page.
 */
const Briefing: React.FC<{ subject: Subject; also: Subject[] }> = ({ subject, also }) => {
  const r = subject.readiness;
  const unmeasured = r.mock_count === 0 && r.state === 'needs_evaluation';

  return (
    <Box>
        <Box
          component={RouterLink}
          to={`/subjects/${subject.id}`}
          sx={{
            display: 'inline-block', textDecoration: 'none',
            color: 'text.secondary', letterSpacing: '0.09em',
            textTransform: 'uppercase', fontSize: 12, fontWeight: 600,
            '&:hover': { color: 'primary.main' },
            '&:focus-visible': {
              outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2,
            },
          }}
        >
          {subject.name}
        </Box>

        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 700, mt: 0.75, letterSpacing: '-0.025em',
            fontSize: { xs: 34, sm: 42, md: 46 }, lineHeight: 1.1,
          }}
        >
          {unmeasured ? 'Not measured yet' : READINESS_LABELS[r.state]}
        </Typography>

        {also.length > 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
            Also measured:{' '}
            {also.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && ', '}
                <Box
                  component={RouterLink}
                  to={`/subjects/${s.id}`}
                  sx={{
                    color: 'inherit', textDecoration: 'underline',
                    textDecorationColor: 'transparent',
                    '&:hover': { color: 'primary.main', textDecorationColor: 'currentColor' },
                    '&:focus-visible': {
                      outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2,
                    },
                  }}
                >
                  {s.name} &mdash; {READINESS_LABELS[s.readiness.state].toLowerCase()}
                </Box>
              </React.Fragment>
            ))}
          </Typography>
        )}
    </Box>
  );
};

/**
 * The evidence, as one band rather than four cards.
 *
 * The reference put four bordered metric cards here, each with an icon, a
 * large number and an encouraging line under it. Four cards say four things
 * of equal weight; these four are one thing -- the case for the verdict above
 * them -- and they only mean anything read together. So they share a surface
 * and are separated by rules rather than by gaps, and the trend, which is the
 * part that carries the argument, gets the room.
 */
/**
 * The shape of the last few papers, drawn.
 *
 * Four numbers in a row answer "what did I get". They do not answer "am I
 * improving" without the reader doing the arithmetic, and that is the question
 * this picture exists for -- so the pass mark is drawn as a line rather than
 * printed as a figure, and whether the run has crossed it is then something
 * you see rather than something you work out.
 *
 * It is deliberately NOT built on /analytics/score-trends, which is the series
 * Insights charts. That endpoint pools every completed session: on this
 * database it contains a 5.0%, a 36.2% and a 60.0% from drills and practice
 * runs. Charting those under "your progress" would contradict the verdict
 * printed directly above it, which is computed from mocks alone. The series
 * here is `recent_scores` -- the same numbers, from the same rule, as the
 * state it is evidence for.
 *
 * SVG rather than Chart.js: four points need a line, two labels and a rule,
 * and the axes, legend, tooltips and gradient that come with the chart library
 * would dress the data up as more than it is.
 */
const TrendChart: React.FC<{ scores: number[]; passMark: number | null }> = ({
  scores, passMark,
}) => {
  const theme = useTheme();
  // One point is a dot, not a trend. Say nothing rather than draw nothing.
  if (scores.length < 2) return null;

  const W = 460;
  const H = 116;
  const padX = 26;
  const padTop = 18;
  const padBottom = 26;

  // Scaled to the run and the pass mark together, so the line's relationship
  // to the mark is the thing the height encodes.
  const values = passMark != null ? [...scores, passMark] : scores;
  const lo = Math.max(0, Math.min(...values) - 8);
  const hi = Math.min(100, Math.max(...values) + 8);
  const span = hi - lo || 1;

  const x = (i: number) => padX + (i * (W - padX * 2)) / (scores.length - 1);
  const y = (v: number) => padTop + (1 - (v - lo) / span) * (H - padTop - padBottom);

  const line = scores.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s)}`).join(' ');
  const area = `${line} L ${x(scores.length - 1)} ${H - padBottom} L ${x(0)} ${H - padBottom} Z`;
  const accent = theme.palette.primary.main;

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          `Your last ${scores.length} mocks: ${scores.map((s) => `${Math.round(s)}%`).join(', ')}.`
          + (passMark != null ? ` The pass mark is ${Math.round(passMark)}%.` : '')
        }
        sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="prepbench-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {passMark != null && (
          <>
            <line
              x1={padX - 10} y1={y(passMark)} x2={W - padX + 10} y2={y(passMark)}
              stroke={theme.palette.text.secondary} strokeWidth="1"
              strokeDasharray="4 4" opacity="0.55"
            />
            {/* Left end, above the rule. Anchored to the right it landed on
                top of the final point, which is exactly where the eye goes. */}
            <text
              x={padX - 10} y={y(passMark) - 7} textAnchor="start"
              fontSize="11" fontWeight="600"
              fill={theme.palette.text.secondary}
            >
              {Math.round(passMark)}% to pass
            </text>
          </>
        )}

        <path d={area} fill="url(#prepbench-trend)" />
        <path d={line} fill="none" stroke={accent} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {scores.map((s, i) => {
          const under = passMark != null && s < passMark;
          return (
            <g key={i}>
              <circle
                cx={x(i)} cy={y(s)} r={i === scores.length - 1 ? 5.5 : 4}
                fill={under ? theme.palette.background.paper : accent}
                stroke={accent} strokeWidth="2.5"
              />
              <text
                x={x(i)} y={H - 8} textAnchor="middle"
                fontSize="12" fontWeight={i === scores.length - 1 ? 700 : 500}
                fill={i === scores.length - 1
                  ? theme.palette.text.primary : theme.palette.text.secondary}
              >
                {Math.round(s)}%
              </text>
            </g>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * The case for the verdict: the headline figure, the run behind it, and the
 * two numbers that give both meaning -- grouped, because they only mean
 * anything read together.
 *
 * This has been through both failure modes. It began as four bordered KPI
 * cards, which made supporting evidence the loudest thing on the page and
 * turned one argument into four unrelated facts. Then it was stripped to a
 * rule-delimited row of figures, which was honest and told the reader nothing
 * about direction -- "70, 83, 88, 93" is a trend only if you do the work.
 * It is now one panel: the number, the picture of how it got there, and the
 * conditions it is measured against.
 */
const Evidence: React.FC<{ readiness: Readiness }> = ({ readiness: r }) => {
  const passMark = r.pass_mark ?? null;
  const last = shortDate(r.latest_taken_at);
  const scores = r.recent_scores ?? [];
  const latest = scores.length > 0 ? scores[scores.length - 1] : null;

  // No mocks means no evidence, and an empty band of zeroes would read as
  // failure rather than as absence.
  if (r.mock_count === 0) return null;

  return (
    <Box>
      <Box
        sx={{
          ...panel,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 340px) minmax(0, 1fr)' },
        }}
      >
        {/* The argument, in words and figures. */}
        <Box
          sx={{
            p: { xs: 2.5, sm: 3 },
            borderRight: { md: '1px solid' },
            borderBottom: { xs: '1px solid', md: 'none' },
            borderColor: 'divider',
          }}
        >
          <Typography
            component="div"
            sx={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'text.secondary',
            }}
          >
            Latest qualifying run
          </Typography>
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.25, mt: 0.5 }}>
            <Typography
              sx={{
                fontSize: { xs: 40, sm: 46 }, fontWeight: 700,
                letterSpacing: '-0.03em', lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {latest != null ? pct(latest) : '—'}
            </Typography>
            {r.points_per_mock != null && r.points_per_mock !== 0 && (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: r.points_per_mock > 0 ? 'success.main' : 'error.main',
                }}
              >
                {r.points_per_mock > 0 ? '+' : ''}{r.points_per_mock} a mock
              </Typography>
            )}
          </Stack>

          <Box
            sx={{
              mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider',
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            }}
          >
            <Cell label="Pass mark" sx={{ px: 0, py: 0 }}>
              <Figure>{passMark != null ? pct(passMark) : '—'}</Figure>
            </Cell>
            <Cell label={`Full mock${r.mock_count === 1 ? '' : 's'}`} sx={{ px: 0, py: 0 }}>
              <Figure>{r.mock_count}</Figure>
            </Cell>
            <Cell label="Last sat" sx={{ px: 0, py: 0 }}>
              <Figure>{last ?? '—'}</Figure>
            </Cell>
          </Box>
        </Box>

        {/* The same argument, drawn. */}
        <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography
            component="div"
            sx={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'text.secondary', mb: 0.5,
            }}
          >
            Your last {scores.length} mock{scores.length === 1 ? '' : 's'}
          </Typography>
          {scores.length >= 2 ? (
            <TrendChart scores={scores} passMark={passMark} />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
              One paper is a reading, not a direction. The shape of your progress
              appears from the second mock.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const Cell: React.FC<{
  label: string;
  children: React.ReactNode;
  sx?: object;
}> = ({ label, children, sx }) => (
  <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 }, minWidth: 0, ...sx }}>
    <Typography
      component="div"
      sx={{
        fontSize: { xs: 10, sm: 11 }, fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'text.secondary', mb: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

const Figure: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    component="div"
    sx={{
      fontSize: { xs: 20, sm: 28 }, fontWeight: 600,
      letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </Typography>
);

/**
 * Why the verdict is what it is. Explanation only: it carries no button.
 *
 * A plateau is read from the state rather than from `blockers[0]`. PLATEAU is
 * a state, not an unmet condition, so the blocker list describes the score and
 * never the shape of it -- "one of your last three came in at 84%" is true and
 * useless when all four came in at 84%.
 */
const Why: React.FC<{ readiness: Readiness }> = ({ readiness }) => {
  const plateau = readiness.state === 'plateau';
  const blocker = readiness.blockers[0] ?? null;

  return (
    <Box>
      <Typography
        component="h2"
        sx={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'text.secondary',
        }}
      >
        {plateau ? 'What this means' : blocker ? 'Why not ready' : 'Why'}
      </Typography>
      <Typography variant="body1" sx={{ mt: 1, lineHeight: 1.7, fontSize: 17 }}>
        {plateau
          ? plateauSentence(readiness.recent_scores)
          : blocker
            ? blockerSentence(blocker)
            : readySentence(readiness.pass_mark)}
      </Typography>
    </Box>
  );
};

/**
 * The one action, chosen from the evidence rather than offered as a menu.
 *
 * The reference ends on four cards with four coloured buttons -- practise,
 * mock, review, write -- which is a menu, and a menu is what a page shows when
 * it does not know which one you need. This page does know: the ladder below
 * reads the same blockers the verdict is computed from, so the button changes
 * as the evidence changes.
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

  const stale = r.blockers.some((b) => b.kind === 'stale');

  const next = (() => {
    if (resumable) {
      return {
        label: 'Unfinished session',
        why: `You stopped at question ${resumable.answered + 1} of ${resumable.total}.`,
        cta: 'Pick it up',
        go: () => navigate(`/exam/${resumable.session_id}`),
      };
    }
    // Stale evidence outranks reading, and only here. Everywhere else in this
    // ladder understanding a miss beats sitting another paper -- but when the
    // last mock has aged out, the page is stating a verdict it no longer has
    // the evidence for, and no amount of reading restores that. This is the
    // one blocker whose remedy is time-critical.
    if (stale) {
      return {
        label: 'Out of date',
        // Deliberately does not restate the number: "Why not ready" has just
        // given it, and this block owes the remedy rather than the reading.
        why: 'A fresh paper is the only thing that brings the verdict back to now. '
          + 'Reading old misses is still worth doing; it cannot make old evidence current.',
        cta: 'Take a mock',
        go: () => navigate(`/exam-setup?kind=mock&subject=${subject.id}`),
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
    // At a plateau with nothing left to read, "another full paper is the only
    // thing that moves the verdict" contradicts the sentence directly above
    // it, which has just said that another paper will not move it. The honest
    // continuation is the decision, not more practice.
    if (r.state === 'plateau') {
      return {
        label: 'Next',
        why: 'There is nothing further this can measure. Four papers at the same '
          + 'mark is the answer: book the exam, or find the gap somewhere other '
          + 'than in more questions.',
        cta: null,
        go: null,
      };
    }
    return {
      label: 'Next',
      why: 'Another full paper is the only thing that moves the verdict.',
      cta: 'Take a mock',
      go: () => navigate(`/exam-setup?kind=mock&subject=${subject.id}`),
    };
  })();

  return (
    <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography
        component="h2"
        sx={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'text.secondary',
        }}
      >
        {next.label}
      </Typography>
      <Typography variant="body1" sx={{ mt: 1, lineHeight: 1.7 }}>{next.why}</Typography>
      {next.cta && next.go && (
        <Button
          variant="contained"
          disableElevation
          onClick={next.go}
          endIcon={<ArrowRight size={18} />}
          sx={{
            mt: 2.5, borderRadius: '100px', fontWeight: 600, textTransform: 'none',
            px: 2.75, py: 1.15, fontSize: 15,
          }}
        >
          {next.cta}
        </Button>
      )}
    </Box>
  );
};

/**
 * The topics the one action would actually draw from.
 *
 * The reference's best idea, kept almost as drawn: the name, a bar, the
 * fraction, a way in. Two changes. The counts are real and come from the same
 * query the weak-topic drill uses, so this list cannot name something Practice
 * would then refuse to offer. And every row here is below the floor -- the
 * reference showed three green rows in a panel headed "Topics to Focus On",
 * which is a list of topics you are fine at.
 */
const FocusTopics: React.FC<{ topics: FocusTopic[]; subject: Subject }> = ({ topics, subject }) => {
  const theme = useTheme();
  if (topics.length === 0) return null;

  const shown = topics.slice(0, FOCUS_LIMIT);

  return (
    <Box sx={{ ...panel, p: { xs: 2.5, sm: 3 } }}>
      <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
        Topics to focus on
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.5 }}>
        From your mocks only, over at least three answers each.
      </Typography>

      <Stack sx={{ mt: 2.5 }} spacing={0.5}>
        {shown.map((t) => {
          const ratio = t.answered > 0 ? t.correct / t.answered : 0;
          const severe = t.accuracy_percentage < 50;
          const barColor = severe ? theme.palette.error.main : theme.palette.warning.main;
          return (
            <Box
              key={t.topic}
              component={RouterLink}
              to={`/exam-setup?kind=drill&subject=${subject.id}`
                + `&topic=${encodeURIComponent(t.topic)}`}
              aria-label={`Practise ${t.topic} — ${t.correct} of ${t.answered} correct in your mocks`}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                alignItems: 'center',
                gap: 1.5,
                px: 1, py: 0.8, mx: -1,
                borderRadius: 2,
                textDecoration: 'none',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': {
                  outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2,
                },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  // Topics in this bank run to sixty characters, so the row
                  // truncates. The full name is on the link's accessible name
                  // and here, so nothing is only available to a mouse.
                  title={t.topic}
                  sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' }}
                >
                  {t.topic}
                </Typography>
                {/* The bar restates the fraction beside it, so nothing here
                    depends on reading a colour. */}
                <Box
                  aria-hidden
                  sx={{
                    mt: 0.6, height: 5, borderRadius: 3,
                    bgcolor: alpha(theme.palette.text.primary, 0.08),
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{
                    width: `${Math.round(ratio * 100)}%`, height: '100%',
                    bgcolor: barColor, borderRadius: 3,
                  }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap' }}
              >
                {t.correct} / {t.answered}
              </Typography>
              <ChevronRight size={16} aria-hidden style={{ opacity: 0.45 }} />
            </Box>
          );
        })}
      </Stack>

      {topics.length > shown.length && (
        <Box
          component={RouterLink}
          to="/analytics"
          sx={{
            display: 'inline-block', mt: 2, fontSize: 14, fontWeight: 500,
            color: 'primary.main', textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
            '&:focus-visible': {
              outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2,
            },
          }}
        >
          {topics.length - shown.length} more in Insights
        </Box>
      )}
    </Box>
  );
};

/**
 * What the last stretch of work bought.
 *
 * A page that only lists deficits teaches people to stop opening it. This is
 * the one place on Home that reports a gain, and it stays quiet: a note in the
 * margin, not a celebration.
 *
 * A rule rather than a filled panel. As a grey box it was 126px tall against a
 * 90px briefing, and since the two share a grid row it was the box -- not the
 * verdict -- setting the row height, opening 130px of empty space to the left
 * of nothing. The hole read as a layout accident because it was one.
 */
const RecentLearning: React.FC<{ readiness: Readiness }> = ({ readiness }) => {
  const m = readiness.most_improved;
  if (!m) return null;
  return (
    <Box
      sx={{
        borderLeft: '2px solid',
        borderColor: 'divider',
        pl: 2,
      }}
    >
      <Typography
        component="h2"
        sx={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'text.secondary',
        }}
      >
        Recent learning
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.75, lineHeight: 1.6 }}>
        {m.domain} went from {pct(m.before_pct)} to {pct(m.after_pct)} between your last two mocks.
      </Typography>
    </Box>
  );
};

/**
 * Everything else being prepared: a record, not a launcher.
 *
 * This has now been wrong in two opposite directions. The reference gave these
 * the bottom of the page as full cards with their own coloured buttons, which
 * is a launcher competing with the one action above. Replacing the buttons
 * with a row of pastel-badged tiles fixed the competition and kept the
 * launcher: four equal boxes in a horizontal grid, each with a coloured
 * circular mark, is the visual grammar of an app drawer whatever is written
 * in it. The grid also held four columns for three items, so the page ended
 * on an empty cell.
 *
 * A list reads as a record of what has been done. A row of tiles reads as a
 * menu of what could be done. The content here is the former: counts of work
 * already completed, each linking to where that work lives.
 *
 * That correction then overshot. Three bare lines at the foot of the page were
 * quiet to the point of being missable, and quieter-than-the-verdict is the
 * requirement -- invisible is not. The rows keep their list semantics and get
 * a surface, room, and a way in on each one, so the area reads as a section of
 * the page rather than a footnote to it. Divided by rules, not boxed
 * individually: the same device the evidence panel uses, so the two agree.
 */
const OtherPreparationRow: React.FC<{ items: OtherPreparation[] }> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <Box>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 2, flexWrap: 'wrap', mb: 1.5,
      }}>
        <Typography
          component="h2"
          sx={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'text.secondary',
          }}
        >
          Other preparation
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Counted from work already done. None of it moves the verdict above.
        </Typography>
      </Box>

      <Box
        sx={{
          ...panel,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
          overflow: 'hidden',
        }}
      >
        {items.map((it, i) => (
          <Box
            key={it.key}
            component={RouterLink}
            to={it.href}
            aria-label={`${it.label} — ${it.detail}`}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 2, px: 2.5, py: 2, minWidth: 0,
              borderTop: i === 0 ? 0 : { xs: '1px solid', sm: 0 },
              borderLeft: i === 0 ? 0 : { xs: 0, sm: '1px solid' },
              borderColor: 'divider',
              textDecoration: 'none', color: 'text.primary',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': {
                outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2,
              },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{it.label}</Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', mt: 0.25, lineHeight: 1.45 }}
              >
                {it.detail}
              </Typography>
            </Box>
            <ChevronRight size={16} aria-hidden style={{ opacity: 0.4, flexShrink: 0 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
};
