import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, LinearProgress, Tabs, Tab, Button, Alert, Chip
} from '@mui/material';
import { TrendingUp, Users, Briefcase, Network, MessageCircle, Mic, ArrowRight } from 'lucide-react';
import { ScoreTrendChart } from '../components/analytics/ScoreTrendChart';
import { CategoryScoreList } from '../components/common/CategoryScoreList';
import {
  getDomainPerformance, getScoreTrends,
  getSystemDesignAnalytics,
  getRecordingAnalytics,
} from '../services/api';
import { DomainMasteryItem, ScoreTrendPoint } from '../types/analytics';
import { SystemDesignAnalytics } from '../types/systemDesign';
import { RecordingAnalytics } from '../types/recording';

const ROUND_ICONS: Record<string, React.ComponentType<any>> = {
  hr_screening: Users,
  hiring_manager: Briefcase,
  system_design: Network,
  behavioral: MessageCircle,
};

type TabKey = 'exams' | 'system_design' | 'interview_practice';

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('exams');

  // Exams tab (unchanged data source)
  const [domains, setDomains] = useState<DomainMasteryItem[]>([]);
  const [trends, setTrends] = useState<ScoreTrendPoint[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState<string | null>(null);

  // System Design tab
  const [sdAnalytics, setSdAnalytics] = useState<SystemDesignAnalytics | null>(null);
  const [sdLoading, setSdLoading] = useState(true);
  const [sdError, setSdError] = useState<string | null>(null);

  // Interview Practice tab
  const [ipAnalytics, setIpAnalytics] = useState<RecordingAnalytics | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [ipError, setIpError] = useState<string | null>(null);

  const fetchExams = () => {
    setExamsLoading(true);
    setExamsError(null);
    Promise.all([getDomainPerformance(), getScoreTrends()])
      .then(([d, t]) => { setDomains(d); setTrends(t); })
      .catch(() => setExamsError('Failed to load analytics data. Please check backend connection.'))
      .finally(() => setExamsLoading(false));
  };

  const fetchSystemDesign = () => {
    setSdLoading(true);
    setSdError(null);
    getSystemDesignAnalytics()
      .then(setSdAnalytics)
      .catch(() => setSdError('Failed to load System Design analytics. Please check backend connection.'))
      .finally(() => setSdLoading(false));
  };

  const fetchInterviewPractice = () => {
    setIpLoading(true);
    setIpError(null);
    getRecordingAnalytics()
      .then(setIpAnalytics)
      .catch(() => setIpError('Failed to load Interview Practice analytics. Please check backend connection.'))
      .finally(() => setIpLoading(false));
  };

  useEffect(() => {
    fetchExams();
    fetchSystemDesign();
    fetchInterviewPractice();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>Learning Analytics</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Exams" value="exams" />
        <Tab label="System Design" value="system_design" />
        <Tab label="Interview Practice" value="interview_practice" />
      </Tabs>

      {tab === 'exams' && (
        examsLoading ? <LinearProgress /> : examsError ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchExams}>Retry</Button>}>
            {examsError}
          </Alert>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp size={20} /> Score Trend & Rolling Average
                  </Typography>
                  <Box sx={{ height: 320 }}>
                    <ScoreTrendChart trends={trends} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Domain Performance Breakdown</Typography>
                  {domains.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Complete exams to see per-domain accuracy tracking.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {[...domains].sort((a, b) => a.accuracy_percentage - b.accuracy_percentage).map((d) => (
                        <Box key={d.domain}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.domain}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {d.accuracy_percentage}% ({d.correct_count}/{d.total_attempted})
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={d.accuracy_percentage}
                            color={d.accuracy_percentage >= 70 ? 'success' : d.accuracy_percentage >= 50 ? 'warning' : 'error'}
                            sx={{ height: 10, borderRadius: '8px', bgcolor: 'background.default' }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )
      )}

      {tab === 'system_design' && (
        sdLoading ? <LinearProgress /> : sdError ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchSystemDesign}>Retry</Button>}>
            {sdError}
          </Alert>
        ) : sdAnalytics && sdAnalytics.graded_count === 0 ? (
          <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Complete a System Design practice attempt to see analytics here.
              </Typography>
            </CardContent>
          </Card>
        ) : sdAnalytics && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>{sdAnalytics.total_attempts}</Typography>
                      <Typography variant="caption" color="text.secondary">Total Attempts</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>{sdAnalytics.graded_count}</Typography>
                      <Typography variant="caption" color="text.secondary">Graded</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        {sdAnalytics.average_score !== null ? `${Math.round(sdAnalytics.average_score)}%` : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Average Score</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={7}>
              <Card sx={{ height: '100%', borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Score Trend</Typography>
                  <Box sx={{ height: 300 }}>
                    <ScoreTrendChart
                      trends={sdAnalytics.score_trend}
                      label="System Design Score %"
                      rollingLabel="5-Attempt Rolling Avg %"
                      emptyMessage="Complete a System Design practice attempt to see your score trend here."
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={5}>
              <Card sx={{ height: '100%', borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Category Averages</Typography>
                  <CategoryScoreList scores={sdAnalytics.category_averages} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Recent Attempts</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {sdAnalytics.recent_attempts.map((a) => (
                      <Box
                        key={a.id}
                        onClick={() => navigate(`/system-design/attempts/${a.id}`)}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          p: 1.5, borderRadius: 2, cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.prompt_title}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {a.overall_score !== null ? `${Math.round(a.overall_score)}%` : 'Not graded'}
                          </Typography>
                          <ArrowRight size={16} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )
      )}

      {tab === 'interview_practice' && (
        ipLoading ? <LinearProgress /> : ipError ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchInterviewPractice}>Retry</Button>}>
            {ipError}
          </Alert>
        ) : ipAnalytics && ipAnalytics.analyzed_count === 0 ? (
          <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Complete and analyze an Interview Practice recording to see analytics here.
              </Typography>
            </CardContent>
          </Card>
        ) : ipAnalytics && (
          <Grid container spacing={3}>
            {ipAnalytics.weakest_content_category && (
              <Grid item xs={12}>
                <Alert severity="warning" icon={<Mic size={20} />}>
                  Your weakest area: <strong>{ipAnalytics.weakest_content_category.category}</strong> in{' '}
                  <strong>{ipAnalytics.weakest_content_category.round_label}</strong> rounds, averaging{' '}
                  {Math.round(ipAnalytics.weakest_content_category.avg_score_pct)}%.
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <Grid container spacing={2}>
                {ipAnalytics.by_round.map((r) => {
                  const Icon = ROUND_ICONS[r.round_type] || Mic;
                  return (
                    <Grid item xs={12} sm={6} md={3} key={r.round_type}>
                      <Card sx={{ height: '100%', borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <Icon size={18} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{r.round_label}</Typography>
                          </Box>
                          <Chip label={`${r.attempt_count} recording${r.attempt_count === 1 ? '' : 's'}`} size="small" sx={{ mb: 1.5 }} />

                          <Typography variant="caption" color="text.secondary">Content</Typography>
                          {r.avg_content_score_pct !== null ? (
                            <LinearProgress variant="determinate" value={r.avg_content_score_pct} sx={{ height: 6, borderRadius: 3, mb: 1 }} />
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Not yet graded</Typography>
                          )}

                          <Typography variant="caption" color="text.secondary">Delivery</Typography>
                          {r.avg_delivery_score_pct !== null ? (
                            <LinearProgress variant="determinate" value={r.avg_delivery_score_pct} color="secondary" sx={{ height: 6, borderRadius: 3 }} />
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Not yet graded</Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Delivery Trend</Typography>
                  <Box sx={{ height: 300 }}>
                    <ScoreTrendChart
                      trends={ipAnalytics.delivery_trend}
                      label="Delivery Score %"
                      rollingLabel="5-Recording Rolling Avg %"
                      emptyMessage="Analyze a practice recording to see your delivery trend here."
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )
      )}
    </Box>
  );
};
