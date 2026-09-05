// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, TextField, MenuItem,
  Chip, Alert, CircularProgress,
} from '@mui/material';
import { CheckCircle2 } from 'lucide-react';
import {
  getDesignReviews,
  getDesignReviewDomains,
  getDesignReviewAxes,
  getDesignReviewAnalytics,
} from '../services/api';
import { DesignReviewAnalytics, DesignReviewSummary } from '../types/designReview';
import { AxisPerformancePanel } from '../components/learning/AxisPerformancePanel';
import { QuestionDifficulty } from '../types/question';

const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

const DOMAIN_LABELS: Record<string, string> = {
  data_platform: 'Data Platform',
  ai_platform: 'AI Platform',
  request_serving: 'Request Serving',
};

const domainLabel = (value: string) =>
  DOMAIN_LABELS[value] ?? value.replace(/_/g, ' ');

export const DesignReviewListPage: React.FC = () => {
  const navigate = useNavigate();

  const [reviews, setReviews] = useState<DesignReviewSummary[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [axes, setAxes] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<DesignReviewAnalytics | null>(null);
  const [domainFilter, setDomainFilter] = useState('');
  const [axisFilter, setAxisFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    getDesignReviewDomains().then(setDomains).catch(() => {});
    getDesignReviewAxes().then(setAxes).catch(() => {});
    // Refetched only on mount: the numbers change when an attempt is submitted
    // on the review page, and returning here remounts this component.
    getDesignReviewAnalytics().then(setAnalytics).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    getDesignReviews({
      domain: domainFilter || undefined,
      axis_label: axisFilter || undefined,
      difficulty: (difficultyFilter as QuestionDifficulty) || undefined,
      limit: 100,
    })
      .then((res) => setReviews(res.items))
      .catch(() => setFetchError('Failed to load design reviews. Please check backend connection.'))
      .finally(() => setLoading(false));
  }, [domainFilter, axisFilter, difficultyFilter]);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
        Design Review
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3, maxWidth: 720 }}>
        Two defensible architectures for one requirement. Pick one and say why — you are
        judged on whether you named the factor the decision turns on, not on which option
        you chose.
      </Typography>

      {analytics && (
        <AxisPerformancePanel analytics={analytics} onPractiseAxis={setAxisFilter} />
      )}

      <Box sx={{ mb: 4 }}>
          <Grid container spacing={2} sx={{ maxWidth: 720 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Domain"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
              >
                <MenuItem value="">All domains</MenuItem>
                {domains.map((d) => (
                  <MenuItem key={d} value={d}>{domainLabel(d)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Deciding axis"
                value={axisFilter}
                onChange={(e) => setAxisFilter(e.target.value)}
              >
                <MenuItem value="">All axes</MenuItem>
                {axes.map((a) => (
                  <MenuItem key={a} value={a}>{a}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Difficulty"
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as QuestionDifficulty | '')}
              >
                <MenuItem value="">Any difficulty</MenuItem>
                {DIFFICULTIES.map((d) => (
                  <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
      </Box>

      {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : reviews.length === 0 ? (
        <Typography variant="body1" sx={{ color: 'text.secondary', py: 2 }}>
          No design reviews match these filters.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {reviews.map((review) => (
            <Grid key={review.id} size={{ xs: 12, md: 6 }}>
              <Card
                onClick={() => navigate(`/design-reviews/${review.id}`)}
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {review.title}
                    </Typography>
                    {review.attempted && (
                      <Chip
                        size="small"
                        icon={<CheckCircle2 size={14} />}
                        label="Done"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {/* The deciding axis and the concept trail are the answer.
                      The whole exercise is to name the factor the decision
                      turns on, and this list used to print it on the card --
                      "Freshness", then "Structured Streaming · Trigger
                      interval · Freshness tier" underneath. Both appear only
                      once the review has been attempted, where they are a
                      label for something you already worked out rather than a
                      hint at something you have not. */}
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {domainLabel(review.domain)} · {review.difficulty}
                    {review.attempted && review.axis_label && ` · ${review.axis_label}`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
