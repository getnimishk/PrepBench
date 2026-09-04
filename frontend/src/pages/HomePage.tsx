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
import { Plus, Target, ClipboardCheck, Layers, Sparkles, PlayCircle } from 'lucide-react';
import {
  getSubjects, getHomeSummary, getActivity, getDashboardOverview, getScoreTrends,
} from '../services/api';
import { MetricCard } from '../components/dashboard/MetricCard';
import { WeakTopicsWidget } from '../components/dashboard/WeakTopicsWidget';
import { ScoreTrendChart } from '../components/analytics/ScoreTrendChart';
import { ScoreTrendPoint } from '../types/analytics';
import { ActivityItem, HomeSummary, Subject, READINESS_LABELS } from '../types/subject';
import { readinessColor, readinessProgress } from '../components/common/readinessDisplay';
import { useTheme } from '@mui/material/styles';

/**
 * Home is the dashboard, rebuilt around what the application now knows.
 *
 * The shape is the old dashboard's -- headline metrics, a score chart, a
 * sidebar panel, a weak-topics widget, a recent-activity table -- because
 * that shape was right, and because the data behind it already existed and
 * was going unused. What changed is the honesty of the numbers:
 *
 *   1. The headline accuracy counts full mocks alone. The old figure averaged
 *      ten-question warm-ups with timed mocks, which is exactly why it could
 *      not answer whether you would pass.
 *   2. The score chart still plots every session, mocks and drills together,
 *      and says so -- it is history, not readiness, and the caption makes the
 *      difference explicit rather than leaving it to be inferred.
 *   3. Subject readiness replaces topic mastery as the main panel, because
 *      "would I pass" is the question a candidate has.
 *
 * What it does not do is tell you what to do next. A ranked list was built,
 * put to the user, and rejected as nagging -- so every number here is a
 * statement of what is true with a link to the thing it describes.
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [overview, setOverview] = useState<any | null>(null);
  const [trends, setTrends] = useState<ScoreTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getSubjects(),
      getHomeSummary(),
      getActivity(8),
      // The existing overview still owns questions-attempted, the streak and
      // the daily goal. Reused rather than recomputed -- but its accuracy
      // field is deliberately not displayed, because it mixes mocks with
      // drills and that is the figure this dashboard exists to replace.
      getDashboardOverview().catch(() => null),
      // Ten sessions and hundreds of answered questions already exist. There
      // is no reason for the dashboard to ignore them just because readiness
      // cannot count them.
      getScoreTrends().catch(() => [] as ScoreTrendPoint[]),
    ])
      .then(([s, h, a, o, t]) => {
        setSubjects(s);
        setSummary(h);
        setActivity(a);
        setOverview(o);
        setTrends(t);
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

  // A statement about where things stand, not an instruction about what to do.
  // The distinction matters: being told what to do next was rejected, but a
  // page with no voice at all reads as a report rather than as your own study
  // application.
  const headline = (): { title: string; line: string } => {
    if (subjects.length === 0) {
      return {
        title: 'Welcome to PrepBench',
        line: 'Import a question bank or a roadmap and it will start keeping track.',
      };
    }
    const ready = subjects.find((x) => x.readiness.state === 'ready');
    if (ready) {
      return {
        title: `You are ready for ${ready.name}`,
        line: 'Three consecutive mocks at or above the pass mark, nothing weak, nothing stale.',
      };
    }
    const close = subjects.find((x) => x.readiness.state === 'almost_there' || x.readiness.state === 'plateau');
    if (close) {
      const last = close.readiness.recent_scores.slice(-1)[0];
      return {
        title: `Close on ${close.name}`,
        line: `Last mock ${last}% against a ${close.readiness.pass_mark}% pass mark.`,
      };
    }
    if ((summary?.mock_count ?? 0) === 0) {
      return {
        title: `${subjects.length} subject${subjects.length === 1 ? '' : 's'} on the go`,
        line: 'Nothing measured yet — a full mock under exam conditions is what moves readiness.',
      };
    }
    return {
      title: `${subjects.length} subject${subjects.length === 1 ? '' : 's'} on the go`,
      line: 'Keep going. Readiness moves on full mocks; drills close the gaps between them.',
    };
  };

  // Each branch is a real study technique, not a restated stat -- the live data
  // only picks which technique is most relevant right now. Carried over from
  // the old dashboard, with the mock/drill distinction folded in.
  const adaptiveTip = (): string => {
    if ((summary?.due_for_review ?? 0) > 0) {
      const n = summary!.due_for_review;
      return `${n} question${n === 1 ? ' is' : 's are'} queued in spaced repetition. Review them in short, frequent bursts rather than one long session — retention comes from repeated brief exposure, not duration.`;
    }
    if ((summary?.unreviewed_total ?? 0) > 0) {
      const n = summary!.unreviewed_total;
      return `${n} wrong answer${n === 1 ? '' : 's'} from a mock ${n === 1 ? 'has' : 'have'} not been looked at. Reading the explanation and restating the rule yourself is what turns a guess into understanding — it moves the score more than another attempt does.`;
    }
    const weakest = overview?.weak_topics?.[0];
    if (weakest) {
      return `On a weak spot like "${weakest.topic}" (${weakest.accuracy_percentage}%), do not just re-answer the same question until it sticks. Read the full explanation and restate the underlying rule in your own words.`;
    }
    if ((summary?.mock_count ?? 0) === 0) {
      return 'A full mock under exam conditions calibrates everything else — weak-topic detection, the spaced-repetition schedule, and whether you would actually pass. Drills cannot do that job.';
    }
    if ((overview?.today_practiced_count ?? 0) === 0) {
      return 'Short, consistent sessions beat marathon cramming for retention. Even 10-15 questions keeps your spaced-repetition schedule on track.';
    }
    return 'Nothing outstanding and no weak areas detected. A full timed mock tests a different skill than untimed practice — pacing under pressure is its own thing.';
  };

  const hero = headline();

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ---- hero ---- */}
      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          boxShadow: 'none',
          // The one sanctioned gradient in the app, kept from the old
          // dashboard: decorative, non-interactive, both stops real MD3
          // tokens. Dark mode does not invert it -- that read as generic
          // navy SaaS -- and instead uses the same raised surface plus
          // pastel accent as every other card here.
          background: isDark ? theme.palette.surfaceContainerHigh.main : 'linear-gradient(135deg, #001D35, #0B57D0)',
          color: isDark ? theme.palette.text.primary : '#FFFFFF',
        }}
      >
        <CardContent
          sx={{
            py: 4, px: { xs: 3, md: 4 }, display: 'flex', gap: 2,
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: isDark ? 'primary.main' : 'inherit' }}>
              {hero.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: isDark ? 1 : 0.9, color: isDark ? 'text.secondary' : 'inherit' }}>
              {hero.line}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayCircle size={20} />}
            onClick={() => navigate('/practice')}
            sx={isDark ? undefined : { bgcolor: '#FFFFFF', color: '#0B57D0', '&:hover': { bgcolor: '#E8EEF9' } }}
          >
            Start practising
          </Button>
        </CardContent>
      </Card>

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

      {/* ---- score history and today's practice ---- */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%', border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Score history
              </Typography>
              {/* Says what it is rather than leaving it to be inferred. This
                  line counts every session, mocks and drills alike, which is
                  why it is history and not readiness. */}
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                Every completed session — mocks and drills together. Readiness counts mocks alone.
              </Typography>
              {/* ScoreTrendChart sets maintainAspectRatio:false, so Chart.js
                  sizes the canvas from its parent. Without an explicit height
                  the canvas collapses to zero width and nothing is drawn --
                  the same fixed box AnalyticsPage gives it. */}
              <Box sx={{ height: 300 }}>
                <ScoreTrendChart
                  trends={trends}
                  label="Session Score %"
                  rollingLabel="5-Session Rolling Avg %"
                  emptyMessage="Complete a session to see your score history here."
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
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
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Questions attempted</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {overview.total_questions_attempted}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Study streak</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {overview.study_streak_days} day{overview.study_streak_days === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Sessions completed</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{overview.total_exams}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Avg time / question</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {Math.round(overview.average_time_per_question_seconds)}s
                      </Typography>
                    </Box>
                  </Stack>

                  {/* The one bit of the old dashboard with an actual voice.
                      Each branch is a study technique; the data only chooses
                      which one is relevant, it is not the tip itself. */}
                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                      Adaptive learning tip
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {adaptiveTip()}
                    </Typography>
                  </Box>
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

      {/* ---- readiness and weak topics ---- */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
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

        {/* Weak topics come from every answered question, which is the whole
            point of showing them here: they are actionable long before enough
            mocks exist for readiness to say anything. */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <WeakTopicsWidget topics={overview?.weak_topics ?? []} />
            {/* Opening a study page on nothing but your five worst areas is a
                bleak way to be greeted, and it is only half the picture. */}
            <WeakTopicsWidget
              topics={overview?.strong_topics ?? []}
              title="Strongest Areas"
              emptyMessage="Answer more questions and your strongest topics will show up here."
              colorByAccuracy={false}
            />
          </Stack>
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
