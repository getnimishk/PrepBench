// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Chip, Alert, Grid,
  CircularProgress, LinearProgress, Stack, Divider, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  PlayCircle, Plus, Target, ClipboardCheck, Layers, Sparkles,
} from 'lucide-react';
import {
  getSubjects, getHomeSummary, getActivity, getDashboardOverview,
} from '../services/api';
import { MetricCard } from '../components/dashboard/MetricCard';
import { ActivityItem, HomeSummary, Subject, READINESS_LABELS } from '../types/subject';
import { readinessColor, readinessProgress } from '../components/common/readinessDisplay';

const formatMinutes = (seconds?: number | null) =>
  seconds == null ? null : `${Math.round(seconds / 60)} min left`;

/**
 * Home is the dashboard, rebuilt around what the application now knows.
 *
 * The shape is the old dashboard's -- headline metrics, a wide panel, a
 * sidebar panel, a recent-activity table -- because that shape was right.
 * What changed is the content, in three ways:
 *
 *   1. The headline accuracy counts full mocks alone. The old figure averaged
 *      ten-question warm-ups with timed mocks, which is exactly why it could
 *      not answer whether you would pass.
 *   2. Subject readiness replaces topic mastery as the main panel, because
 *      "would I pass" is the question and "which topics am I good at" is not.
 *   3. Recent activity spans every format, not exams alone.
 *
 * What it still does not do is tell you what to do next. A ranked list was
 * built, put to the user, and rejected as nagging -- so every number here is
 * a statement of what is true with a link to the thing it describes.
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getSubjects(),
      getHomeSummary(),
      getActivity(8),
      // The existing overview still owns questions-attempted and the daily
      // goal. Reused rather than recomputed -- but its accuracy figure is
      // deliberately not shown, because it mixes mocks with drills.
      getDashboardOverview().catch(() => null),
    ])
      .then(([s, h, a, o]) => {
        setSubjects(s);
        setSummary(h);
        setActivity(a);
        setOverview(o);
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

  const outstanding = (summary?.unreviewed_total ?? 0) + (summary?.due_for_review ?? 0);

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

      {/* ---- headline metrics ---- */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="Subjects Ready"
            value={`${summary?.subjects_ready ?? 0} / ${summary?.subjects_total ?? 0}`}
            subtitle="Ready to book the exam"
            icon={Target}
            color="#146C2E"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="Full Mocks Taken"
            value={`${summary?.mock_count ?? 0}`}
            subtitle="Timed, under exam conditions"
            icon={ClipboardCheck}
            color="#0B57D0"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="Mock Accuracy"
            /* Never 0% for an absent measurement. Too few mocks to judge is
               not a failing score, and the old dashboard's accuracy figure
               averaged drills in, which is why it meant nothing. */
            value={summary?.mock_accuracy != null ? `${summary.mock_accuracy}%` : 'Needs evaluation'}
            subtitle="Drills excluded"
            icon={Layers}
            color="#00639B"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="Outstanding"
            value={`${outstanding}`}
            subtitle={`${summary?.unreviewed_total ?? 0} unreviewed · ${summary?.due_for_review ?? 0} due`}
            icon={Sparkles}
            color="#8F4C38"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* ---- subject readiness: the main panel ---- */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%', border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Where you stand
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Readiness comes only from full mocks. Drills close gaps; they do not measure.
              </Typography>

              <Stack spacing={2} sx={{ mt: 2 }}>
                {subjects.map((subject) => {
                  const r = subject.readiness;
                  const unreviewed = unreviewedFor(subject.id);
                  return (
                    <Box
                      key={subject.id}
                      onClick={() => navigate(`/subjects/${subject.id}`)}
                      sx={{
                        cursor: 'pointer',
                        p: 1.5,
                        mx: -1.5,
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, flexGrow: 1 }}>
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
                        sx={{ height: 6, borderRadius: 3, mb: 0.75 }}
                      />

                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {r.mock_count === 0
                          ? subject.has_exam_profile
                            ? 'No full mock taken yet.'
                            : 'No exam profile — practised, not certified.'
                          : `${r.mock_count} mock${r.mock_count === 1 ? '' : 's'}` +
                            (r.recent_scores.length
                              ? ` · last ${r.recent_scores.map((s) => `${s}%`).join('  ')}`
                              : '') +
                            (r.pass_mark != null ? ` · pass mark ${r.pass_mark}%` : '')}
                      </Typography>

                      {(unreviewed > 0 || r.weakest_domain || r.is_stale) && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                          {/* Facts, not instructions. A count with no verb. */}
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
                      )}
                    </Box>
                  );
                })}

                {/* Only when the request actually succeeded. A failed fetch is
                    not an empty account. */}
                {subjects.length === 0 && !error && (
                  <Box sx={{ textAlign: 'center', py: 5 }}>
                    <Plus size={28} style={{ opacity: 0.4 }} />
                    <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
                      No subjects yet. Import a question bank or a roadmap to get started.
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ---- daily goal, kept from the old dashboard ---- */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%', border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Today
              </Typography>

              {overview ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                    {(() => {
                      const goal = Math.max(1, overview.daily_goal ?? 1);
                      const pct = Math.min(100, Math.round((overview.today_practiced_count / goal) * 100));
                      return (
                        <>
                          <Box sx={{ position: 'relative', display: 'inline-flex', width: 76, height: 76, flexShrink: 0 }}>
                            <CircularProgress variant="determinate" value={100} size={76} thickness={6}
                              sx={{ color: 'divider', position: 'absolute', left: 0 }} />
                            <CircularProgress variant="determinate" value={pct} size={76} thickness={6}
                              sx={{ color: 'primary.main', position: 'absolute', left: 0 }} />
                            <Box sx={{
                              top: 0, left: 0, bottom: 0, right: 0, position: 'absolute',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Typography variant="h6" sx={{ fontWeight: 800 }}>{pct}%</Typography>
                            </Box>
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Practice goal</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {overview.today_practiced_count} / {goal} questions
                            </Typography>
                          </Box>
                        </>
                      );
                    })()}
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  <Stack spacing={1.25}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Questions attempted
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {overview.total_questions_attempted}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Study streak
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {overview.study_streak_days} day{overview.study_streak_days === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Sessions completed
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {overview.total_exams}
                      </Typography>
                    </Box>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Practice statistics are unavailable.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ---- recent activity, every format ---- */}
      <Card sx={{ border: 1, borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
              Recent activity
            </Typography>
            <Button size="small" onClick={() => navigate('/review')}>See all</Button>
          </Box>

          {activity.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nothing yet. Anything you complete in any format will appear here.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['When', 'What', 'Detail', ''].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activity.map((item, i) => (
                    <TableRow key={`${item.kind}-${i}`} hover>
                      <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {item.at
                          ? new Date(item.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                          : ''}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={item.kind.replace(/_/g, ' ')} sx={{ mr: 1 }} />
                        {item.title}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{item.detail}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => navigate(item.href)}>Open</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
