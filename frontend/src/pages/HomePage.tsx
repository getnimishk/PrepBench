// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Chip, Alert,
  CircularProgress, LinearProgress, Stack, Divider,
} from '@mui/material';
import { PlayCircle, Plus } from 'lucide-react';
import { getSubjects, getHomeSummary } from '../services/api';
import { HomeSummary, Subject, READINESS_LABELS } from '../types/subject';
import { readinessColor, readinessProgress } from '../components/common/readinessDisplay';

const formatMinutes = (seconds?: number | null) =>
  seconds == null ? null : `${Math.round(seconds / 60)} min left`;

/**
 * Home shows two things: what you were doing, and where each subject stands.
 *
 * Deliberately not a third. A ranked "do this next" list was put to the user
 * and rejected as nagging, so every fact here is a statement of what is true
 * with a link to the thing it describes -- never an ordered instruction.
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSubjects(), getHomeSummary()])
      .then(([s, h]) => {
        setSubjects(s);
        setSummary(h);
      })
      .catch(() => setError('Failed to load. Please check the backend connection.'))
      .finally(() => setLoading(false));
  }, []);

  const unreviewedFor = (id: number) =>
    summary?.per_subject.find((p) => p.subject_id === id)?.unreviewed ?? 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Resume sits above everything. An abandoned session used to be
          invisible the next day, which made stopping a decision you had to
          make again from scratch. */}
      {summary?.resumable && (
        <Card sx={{ mb: 3, borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <PlayCircle size={22} />
            <Box sx={{ flexGrow: 1, minWidth: 220 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>Continue</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {summary.resumable.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {summary.resumable.answered} of {summary.resumable.total} answered
                {formatMinutes(summary.resumable.seconds_remaining)
                  ? ` · about ${formatMinutes(summary.resumable.seconds_remaining)}`
                  : ''}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => navigate(`/exam/${summary.resumable!.session_id}`)}
            >
              Resume
            </Button>
          </CardContent>
        </Card>
      )}

      <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
        Your subjects
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Readiness comes only from full mocks taken under exam conditions. Drills close
        gaps; they do not measure.
      </Typography>

      <Stack spacing={2}>
        {subjects.map((subject) => {
          const r = subject.readiness;
          const unreviewed = unreviewedFor(subject.id);
          return (
            <Card
              key={subject.id}
              onClick={() => navigate(`/subjects/${subject.id}`)}
              sx={{
                cursor: 'pointer',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                    {subject.name}
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
                  sx={{ height: 6, borderRadius: 3, mb: 1.25 }}
                />

                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {r.mock_count === 0
                    ? subject.has_exam_profile
                      ? 'No full mock taken yet.'
                      : 'No exam profile — this subject is practised, not certified.'
                    : `${r.mock_count} mock${r.mock_count === 1 ? '' : 's'}` +
                      (r.recent_scores.length
                        ? ` · last ${r.recent_scores.map((s) => `${s}%`).join('  ')}`
                        : '') +
                      (r.pass_mark != null ? ` · pass mark ${r.pass_mark}%` : '')}
                </Typography>

                {(unreviewed > 0 || r.weakest_domain) && (
                  <>
                    <Divider sx={{ my: 1.25 }} />
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                      {/* Facts, not instructions. A count of what is
                          outstanding, with no verb attached. */}
                      {unreviewed > 0 && (
                        <Chip size="small" variant="outlined" label={`${unreviewed} unreviewed`} />
                      )}
                      {r.weakest_domain && (
                        <Chip size="small" variant="outlined" label={`weakest: ${r.weakest_domain}`} />
                      )}
                      {r.is_stale && (
                        <Chip size="small" variant="outlined" color="warning" label="evidence is stale" />
                      )}
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Only when the request actually succeeded. A failed fetch is not an
            empty account, and saying "no subjects yet" on a connection error
            tells the user something false about their own data. */}
        {subjects.length === 0 && !error && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Plus size={30} style={{ opacity: 0.4 }} />
              <Typography variant="body1" sx={{ mt: 1.5, color: 'text.secondary' }}>
                No subjects yet. Import a question bank or a roadmap to get started.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      {summary && (summary.due_for_review > 0 || summary.unreviewed_total > 0) && (
        <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'text.secondary' }}>
          Across all subjects: {summary.unreviewed_total} unreviewed answer
          {summary.unreviewed_total === 1 ? '' : 's'} · {summary.due_for_review} due for memory
          review. Both live in Review.
        </Typography>
      )}
    </Box>
  );
};
