// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Chip, Alert, CircularProgress,
  LinearProgress, Stack, Divider,
} from '@mui/material';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getSubject, getSubjectCoverage } from '../services/api';
import {
  DOMAIN_LABELS, FormatCoverage, READINESS_LABELS, Subject,
} from '../types/subject';
import { domainColor, readinessColor, readinessProgress } from '../components/common/readinessDisplay';

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
  const navigate = useNavigate();
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

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Home
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>{subject.name}</Typography>

      {/* ---- readiness, always with its evidence ---- */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', flexGrow: 1 }}>
              Readiness
            </Typography>
            <Chip
              size="small"
              label={READINESS_LABELS[r.state]}
              color={readinessColor(r.state)}
              variant={r.state === 'needs_evaluation' ? 'outlined' : 'filled'}
            />
          </Box>

          <LinearProgress
            variant="determinate"
            value={readinessProgress(r)}
            color={readinessColor(r.state)}
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />

          {r.mock_count === 0 ? (
            <Typography variant="body1">
              {subject.has_exam_profile
                ? 'No full mock under exam conditions yet. Drills close gaps; they do not measure readiness. A mock measures.'
                : 'This subject has no exam profile, so readiness cannot be computed. It is practised, not certified.'}
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              <Typography variant="body1">
                Last {r.recent_scores.length} mock{r.recent_scores.length === 1 ? '' : 's'}:{' '}
                <strong>{r.recent_scores.map((s) => `${s}%`).join('  ·  ')}</strong>
                {r.pass_mark != null && `   Pass mark ${r.pass_mark}%`}
              </Typography>
              {r.points_per_mock != null && r.points_per_mock !== 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {r.points_per_mock > 0 ? 'Rising' : 'Falling'} about{' '}
                  {Math.abs(r.points_per_mock)} points per mock.
                </Typography>
              )}
              {/* The forecast that replaces a countdown: a finite number of
                  mocks, never a date the app cannot know. */}
              {r.mocks_to_pass_estimate != null && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  At this rate: about {r.mocks_to_pass_estimate} more mock
                  {r.mocks_to_pass_estimate === 1 ? '' : 's'} to cross the line.
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                From {r.mock_count} full mock{r.mock_count === 1 ? '' : 's'}. Drills excluded.
                {r.is_stale && ' Most recent is more than two weeks old.'}
              </Typography>
            </Stack>
          )}

          {/* ---- the plateau: the one place the app recommends anything ---- */}
          {r.state === 'plateau' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                You have stopped improving, and you are at the line.
              </Typography>
              <Typography variant="body2">
                {r.recent_scores.map((s) => `${s}%`).join('  ·  ')} — no movement. The variance
                left is exam-day nerves, not knowledge. More drilling will not change this number.
              </Typography>
            </Alert>
          )}

          {r.state === 'ready' && (
            <Alert severity="success" icon={<CheckCircle2 size={20} />} sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                You are ready.
              </Typography>
              <Typography variant="body2">
                Three consecutive full mocks at or above the pass mark, no weak domain, nothing
                stale. This is the point most candidates book. It is a summary of your evidence,
                not a prediction — the app does not know what will be on your paper.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ---- coverage: empty formats are shown, not hidden ---- */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Practice</Typography>
          <Stack divider={<Divider />} sx={{ mt: 1 }}>
            {coverage.map((c) => (
              <Box
                key={c.key}
                sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25, flexWrap: 'wrap' }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 500, color: c.available ? 'text.primary' : 'text.secondary' }}
                  >
                    {c.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {c.detail}
                    {c.completed > 0 && ` · ${c.completed} done`}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant={c.available ? 'outlined' : 'text'}
                  disabled={!c.available}
                  onClick={() => navigate(ROUTES[c.key] ?? '/')}
                >
                  {c.available ? 'Open' : 'Nothing yet'}
                </Button>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* ---- domains, with small samples reported honestly ---- */}
      {r.domains.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Domains
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 1 }}>
              {r.domains.map((d) => (
                <Box key={d.domain} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>{d.domain}</Typography>
                  <Chip size="small" variant="outlined" color={domainColor(d.state)}
                        label={DOMAIN_LABELS[d.state]} />
                  <Typography variant="body2" sx={{ width: 78, textAlign: 'right', color: 'text.secondary' }}>
                    {/* An em dash, never 0%. Too few questions to judge is
                        not a bad score. */}
                    {d.score_pct != null ? `${d.score_pct}%` : '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ width: 54, textAlign: 'right', color: 'text.secondary' }}>
                    {d.answered} q
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
              “Needs evaluation” means too few questions to judge. It does not mean zero, and it
              is not a bad score.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
