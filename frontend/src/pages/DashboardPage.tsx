import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  useTheme
} from '@mui/material';
import {
  Brain,
  Award,
  Clock,
  Target,
  PlayCircle,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { MetricCard } from '../components/dashboard/MetricCard';
import { WeakTopicsWidget } from '../components/dashboard/WeakTopicsWidget';
import { getDashboardOverview, getSettings } from '../services/api';
import { DashboardOverview } from '../types/analytics';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [passingPercentage, setPassingPercentage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboard = () => {
    setLoading(true);
    setFetchError(null);
    Promise.all([getDashboardOverview(), getSettings()])
      .then(([overview, settings]) => {
        setData(overview);
        setPassingPercentage(settings.default_passing_percentage);
      })
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load dashboard data. Please check backend connection.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchDashboard}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (!data) return null;

  // Each branch is a real study technique, not a restated stat — the live data
  // only picks which technique is most relevant right now, it isn't the tip.
  const getAdaptiveTip = (d: DashboardOverview): string => {
    if (d.spaced_repetition_due_count > 0) {
      return `You have ${d.spaced_repetition_due_count} question${d.spaced_repetition_due_count === 1 ? '' : 's'} queued in Spaced Repetition. Review them in short, frequent bursts rather than one long session — retention comes from repeated brief exposure, not duration.`;
    }
    if (d.weak_topics.length > 0) {
      const weakest = d.weak_topics[0];
      return `On a weak spot like "${weakest.topic}" (${weakest.accuracy_percentage}%), don't just re-answer the same question until it sticks — read the full explanation and restate the underlying rule yourself. That's what turns a guess into understanding.`;
    }
    if (d.today_practiced_count === 0) {
      return d.study_streak_days > 0
        ? `Short, consistent sessions beat marathon cramming for retention. Even 10-15 questions keeps today's streak and your spaced-repetition schedule on track.`
        : 'Start small: 10-15 questions a day builds a habit that compounds, and it feeds the spaced-repetition and weak-topic detection that make later practice more targeted.';
    }
    if (d.total_exams === 0) {
      return "Your first exam is what calibrates everything else — weak-topic detection, spaced-repetition scheduling, and your accuracy trend all start from it.";
    }
    return `No weak areas detected and nothing due for review. At ${d.overall_accuracy_percentage}% overall, try a full timed exam under real conditions — time pressure tests a different skill than untimed practice.`;
  };

  const adaptiveTip = getAdaptiveTip(data);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Banner / Hero */}
      <Card
        sx={{
          borderRadius: 3,
          // Light mode: the one sanctioned gradient exception (decorative,
          // non-interactive), both stops real MD3 primary/primary-dark
          // tokens. Dark mode: NOT the same gradient inverted -- that read
          // as a generic navy-SaaS hero disconnected from the rest of dark
          // mode's actual palette, which uses neutral dark surfaces with the
          // light pastel primary (#A8C7FA) as the accent, not a saturated
          // color block. So dark mode instead reuses the same
          // surfaceContainerHigh + primary-accent language as every other
          // card on this page -- a cohesive "this app's dark mode" hero
          // rather than a borrowed light-mode formula.
          background: isDark ? 'surfaceContainerHigh.main' : 'linear-gradient(135deg, #001D35, #0B57D0)',
          color: isDark ? 'text.primary' : '#FFFFFF',
          boxShadow: 'none',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <CardContent sx={{ py: 4, px: { xs: 3, md: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: isDark ? 'primary.main' : 'inherit' }}>
              Welcome back to PrepBench
            </Typography>
            <Typography variant="body1" sx={{ opacity: isDark ? 1 : 0.9, color: isDark ? 'text.secondary' : 'inherit' }}>
              100% Offline Certification & Interview Preparation Platform
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayCircle size={20} />}
              onClick={() => navigate('/exam-setup')}
              // Light mode: fixed white/navy pair, not primary.contrastText --
              // that token is computed against theme.palette.primary.main, not
              // this card's own gradient, so it'd drift out of sync with what's
              // actually behind the button. Dark mode: plain color="primary"
              // is correct here since the card is a neutral surface now, not
              // a gradient -- contrastText is guaranteed accurate again.
              color={isDark ? 'primary' : undefined}
              sx={isDark
                ? { px: 3, py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: '100px' }
                : { px: 3, py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: '100px', bgcolor: '#FFFFFF', color: '#001D35', '&:hover': { bgcolor: 'rgba(255,255,255,0.85)' } }}
            >
              Start New Exam
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<RotateCcw size={20} />}
              onClick={() => navigate('/exam-setup?mode=weak_topic')}
              color={isDark ? 'primary' : undefined}
              sx={isDark
                ? { px: 3, py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: '100px' }
                : {
                    px: 3, py: 1.5, fontSize: '1rem', fontWeight: 700,
                    borderRadius: '100px',
                    borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
            >
              Weak Topic Practice
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* KPI Cards Grid */}
      <Grid container spacing={2.5}>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <MetricCard
            title="Total Exams Completed"
            value={data.total_exams}
            subtitle="Full exam history saved"
            icon={Award}
            color="#6366F1"
          />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <MetricCard
            title="Questions Attempted"
            value={data.total_questions_attempted}
            subtitle="Across all practice tests"
            icon={Brain}
            color="#D946EF"
          />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <MetricCard
            title="Overall Accuracy"
            value={`${data.overall_accuracy_percentage}%`}
            subtitle={passingPercentage !== null ? `Passing threshold: ${passingPercentage}%` : 'Overall accuracy'}
            icon={Target}
            color="#34D399"
          />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <MetricCard
            title="Avg Time / Question"
            value={`${data.average_time_per_question_seconds}s`}
            subtitle="Pacing metric"
            icon={Clock}
            color="#FBBF24"
          />
        </Grid>
      </Grid>

      {/* Second Row: Weak Topics & Today Goal */}
      <Grid container spacing={2.5}>
        <Grid
          size={{
            xs: 12,
            md: 7
          }}>
          <WeakTopicsWidget topics={data.weak_topics} />
        </Grid>

        <Grid
          size={{
            xs: 12,
            md: 5
          }}>
          <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 'none', bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Sparkles size={20} color="#FBBF24" /> Daily Practice Goal
              </Typography>
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                {(() => {
                  const safeGoal = Math.max(1, data.daily_goal);
                  const goalPct = Math.min(100, Math.round((data.today_practiced_count / safeGoal) * 100));

                  return (
                    <>
                      <Box sx={{ position: 'relative', display: 'inline-flex', width: 80, height: 80, flexShrink: 0 }}>
                        <CircularProgress
                          variant="determinate"
                          value={100}
                          size={80}
                          thickness={6}
                          sx={{ color: 'divider', position: 'absolute', left: 0 }}
                        />
                        <CircularProgress
                          variant="determinate"
                          value={goalPct}
                          size={80}
                          thickness={6}
                          sx={{ color: 'primary.main', position: 'absolute', left: 0 }}
                        />
                        <Box sx={{
                          top: 0, left: 0, bottom: 0, right: 0, position: 'absolute',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {goalPct}%
                          </Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Progress Today
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {data.today_practiced_count} / {safeGoal} Questions
                        </Typography>
                      </Box>
                    </>
                  );
                })()}
              </Box>

              <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                  Adaptive Learning Tip:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {adaptiveTip}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Third Row: Recent Exams Table */}
      <Card sx={{ borderRadius: 3, boxShadow: 'none', bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            Recent Exam Sessions
          </Typography>
          {data.recent_exams.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No recent exam sessions yet. Click "Start New Exam" above to take your first test!
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>Exam Title</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>Score %</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>Result</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recent_exams.map((exam) => {
                    const isPassed = exam.is_passed === 'passed';
                    const isFailed = exam.is_passed === 'failed';
                    const labelText = isPassed ? 'PASSED' : isFailed ? 'FAILED' : 'N/A';

                    const scoreColor = isPassed ? 'success.main' : isFailed ? 'error.main' : 'text.primary';

                    return (
                      <TableRow
                        key={exam.id}
                        sx={{
                          '&:hover': { bgcolor: 'action.hover' },
                          '& td': { borderBottom: '1px solid', borderColor: 'divider' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{exam.title}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{exam.date}</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: scoreColor }}>{exam.score_percentage}%</TableCell>
                        <TableCell>
                          <Chip
                            icon={isPassed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            label={labelText}
                            size="small"
                            color={isPassed ? 'success' : isFailed ? 'error' : 'default'}
                            variant="filled"
                            sx={{
                              fontWeight: 600,
                              borderRadius: '8px'
                            }}
                            aria-label={`Exam Result: ${labelText}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" sx={{ borderRadius: '100px' }} onClick={() => navigate(`/exam-review/${exam.id}`)}>
                            Review Answers
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};