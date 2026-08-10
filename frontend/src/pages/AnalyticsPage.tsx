import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, LinearProgress
} from '@mui/material';
import { TopicRadarChart } from '../components/analytics/TopicRadarChart';
import { ScoreTrendChart } from '../components/analytics/ScoreTrendChart';
import { getDomainPerformance, getScoreTrends } from '../services/api';
import { DomainMasteryItem, ScoreTrendPoint } from '../types/analytics';
import { BarChart2, TrendingUp } from 'lucide-react';

import { Alert, Button } from '@mui/material';

export const AnalyticsPage: React.FC = () => {
  const [domains, setDomains] = useState<DomainMasteryItem[]>([]);
  const [trends, setTrends] = useState<ScoreTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAnalytics = () => {
    setLoading(true);
    setFetchError(null);
    Promise.all([getDomainPerformance(), getScoreTrends()])
      .then(([d, t]) => { setDomains(d); setTrends(t); })
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load analytics data. Please check backend connection.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) return <LinearProgress />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchAnalytics}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>Learning Analytics</Typography>

      <Grid container spacing={3}>
        {/* Radar Chart — Domain Mastery */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%', borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChart2 size={20} /> Domain Mastery Radar
              </Typography>
              <Box sx={{ height: 320 }}>
                <TopicRadarChart domains={domains} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Score Trend Line Chart */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%', borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
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

        {/* Domain Performance Breakdown */}
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
                        sx={{
                          height: 10,
                          borderRadius: '8px',
                          bgcolor: 'background.default'
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
