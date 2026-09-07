// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, CircularProgress, Stack, Divider,
} from '@mui/material';
import { getSubject, getSubjectCoverage } from '../services/api';
import {
  DOMAIN_LABELS, FormatCoverage, READINESS_LABELS, Subject,
} from '../types/subject';
import { blockerSentence, pct, plateauSentence, readySentence } from '../services/readinessText';

/**
 * Everything about one subject.
 *
 * Home answers "would I pass, and what should I do about it" in four lines.
 * This answers the question after that one: which areas, on what evidence,
 * and what formats exist for this subject. It is the only page that shows a
 * per-domain breakdown, and -- until the subject name on Home became a link
 * -- it was reachable only by typing its URL.
 *
 * Two things changed here beyond the route.
 *
 *   The three cards are gone. Readiness, Practice and Domains are sequential
 *   sections of one argument, not three separate objects; every other page in
 *   the product had already stopped drawing boxes round its own paragraphs,
 *   and this one had not, which made it read like a different application.
 *
 *   The verdict is explained from the shared vocabulary rather than from
 *   prose written here. This page used to phrase the plateau and the READY
 *   explanation in its own words while Home phrased the same verdict in
 *   others; two surfaces disagreeing about why you are not ready is the same
 *   defect as two surfaces disagreeing about your score.
 */

/** Where each format's action goes. Unavailable formats get no route. */
const ROUTES: Record<string, string> = {
  mock: '/exam-setup',
  drill: '/exam-setup',
  design_review: '/design-reviews',
  system_design: '/system-design',
  interview: '/interview-practice',
  roadmap: '/roadmaps',
};

export const SubjectPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const id = Number(subjectId);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [coverage, setCoverage] = useState<FormatCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getSubject(id), getSubjectCoverage(id)])
      .then(([s, c]) => {
        setSubject(s);
        setCoverage(c);
      })
      .catch(() => setError('Failed to load this subject.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (error || !subject) {
    return <Alert severity="error">{error ?? 'Subject not found.'}</Alert>;
  }

  const r = subject.readiness;
  const blocker = r.blockers[0] ?? null;

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Box
        component={RouterLink}
        to="/"
        sx={{
          display: 'inline-block', mb: 3, fontSize: 14, textDecoration: 'none',
          color: 'text.secondary',
          '&:hover': { color: 'primary.main' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        &larr; Home
      </Box>

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

      <Evidence subject={subject} />

      {/* Why the verdict is what it is, in the product's one vocabulary. */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {r.state === 'plateau' ? 'What this means' : blocker ? 'Why not ready' : 'Why'}
        </Typography>
        <Typography variant="body1" sx={{ mt: 0.5, lineHeight: 1.65, maxWidth: 620 }}>
          {r.state === 'plateau'
            ? plateauSentence(r.recent_scores)
            : blocker
              ? blockerSentence(blocker)
              : readySentence(r.pass_mark)}
        </Typography>
      </Box>

      <Domains subject={subject} />
      <Formats coverage={coverage} />
    </Box>
  );
};

/** The numbers the verdict rests on. Never a percentage the sample cannot carry. */
const Evidence: React.FC<{ subject: Subject }> = ({ subject }) => {
  const r = subject.readiness;

  if (r.mock_count === 0) {
    return (
      <Typography variant="body1" sx={{ mt: 2.5, maxWidth: 620, lineHeight: 1.65 }}>
        {subject.has_exam_profile
          ? 'No full mock under exam conditions yet. Drills close gaps; they do not measure '
            + 'readiness. A mock measures.'
          : 'This subject has no exam profile, so readiness cannot be computed. It is '
            + 'practised, not certified.'}
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 2.5 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        {r.recent_scores.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <Typography component="span" aria-hidden sx={{ color: 'text.disabled', fontSize: 18 }}>
                &rarr;
              </Typography>
            )}
            <Typography
              component="span"
              title={r.pass_mark != null && s < r.pass_mark ? 'below the pass mark' : undefined}
              sx={{
                fontSize: 26,
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                color: r.pass_mark != null && s < r.pass_mark ? 'text.secondary' : 'text.primary',
                textDecoration: r.pass_mark != null && s < r.pass_mark ? 'underline dotted' : 'none',
                textUnderlineOffset: '5px',
              }}
            >
              {pct(s)}
            </Typography>
          </React.Fragment>
        ))}
        {r.pass_mark != null && (
          <Typography variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
            {pct(r.pass_mark)} to pass
          </Typography>
        )}
      </Stack>

      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
        From {r.mock_count} full mock{r.mock_count === 1 ? '' : 's'}. Drills excluded.
        {r.points_per_mock != null && r.points_per_mock > 0
          && ` Rising about ${r.points_per_mock} points a mock.`}
        {r.points_per_mock != null && r.points_per_mock < 0
          && ` Falling about ${Math.abs(r.points_per_mock)} points a mock.`}
        {/* A finite number of mocks, never a date the app cannot know. */}
        {r.mocks_to_pass_estimate != null
          && ` At this rate, about ${r.mocks_to_pass_estimate} more `
             + `mock${r.mocks_to_pass_estimate === 1 ? '' : 's'} to cross the line.`}
        {r.is_stale && ' The most recent is more than two weeks old.'}
      </Typography>
    </Box>
  );
};

/** The reason to be on this page: which areas, on how much evidence. */
const Domains: React.FC<{ subject: Subject }> = ({ subject }) => {
  const navigate = useNavigate();
  const r = subject.readiness;
  if (r.domains.length === 0) return null;

  return (
    <Box sx={{ mt: 6 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Areas</Typography>
      <Stack sx={{ mt: 0.5 }} divider={<Divider />}>
        {r.domains.map((d) => (
          <Box
            key={d.domain}
            sx={{
              display: 'flex', alignItems: 'baseline', gap: 2, py: 1.25, flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 200 }}>
              {d.domain}
            </Typography>
            {/* Named in words as well as scored, so the reading never rests
                on a colour alone. */}
            <Typography
              variant="body2"
              sx={{ width: 110, color: d.state === 'needs_work' ? 'error.main' : 'text.secondary' }}
            >
              {DOMAIN_LABELS[d.state]}
            </Typography>
            <Typography
              variant="body2"
              sx={{ width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {/* An em dash, never 0%. Too few questions to judge is not a
                  bad score. */}
              {d.score_pct != null ? pct(d.score_pct) : '—'}
            </Typography>
            <Typography variant="caption" sx={{ width: 64, textAlign: 'right', color: 'text.secondary' }}>
              {d.answered} q
            </Typography>
            <Button
              size="small"
              onClick={() => navigate(
                `/exam-setup?kind=drill&subject=${subject.id}`
                + `&domain=${encodeURIComponent(d.domain)}`
              )}
              sx={{ textTransform: 'none' }}
            >
              Practise
            </Button>
          </Box>
        ))}
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
        &ldquo;Needs evaluation&rdquo; means too few questions to judge. It does not mean zero,
        and it is not a bad score.
      </Typography>
    </Box>
  );
};

/** What exists for this subject. Empty formats are shown, not hidden. */
const Formats: React.FC<{ coverage: FormatCoverage[] }> = ({ coverage }) => {
  const navigate = useNavigate();
  if (coverage.length === 0) return null;

  return (
    <Box sx={{ mt: 6 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Practice</Typography>
      <Stack sx={{ mt: 0.5 }} divider={<Divider />}>
        {coverage.map((c) => (
          c.available ? (
            <Box
              key={c.key}
              component="button"
              type="button"
              aria-label={`${c.label} — ${c.detail}`}
              onClick={() => navigate(ROUTES[c.key] ?? '/')}
              sx={{
                display: 'flex', alignItems: 'baseline', gap: 2, py: 1.4, width: '100%',
                textAlign: 'left', font: 'inherit', border: 0, bgcolor: 'transparent',
                flexWrap: 'wrap', color: 'text.primary', cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              <Typography variant="body1" sx={{ minWidth: 160 }}>{c.label}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                {c.detail}
                {c.completed > 0 && ` · ${c.completed} done`}
              </Typography>
            </Box>
          ) : (
            <Box
              key={c.key}
              sx={{
                display: 'flex', alignItems: 'baseline', gap: 2, py: 1.4,
                flexWrap: 'wrap', color: 'text.disabled',
              }}
            >
              <Typography variant="body1" sx={{ minWidth: 160, color: 'inherit' }}>{c.label}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                {c.detail}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Nothing yet</Typography>
            </Box>
          )
        ))}
      </Stack>
    </Box>
  );
};
