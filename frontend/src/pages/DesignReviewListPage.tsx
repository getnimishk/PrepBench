// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import {
  getDesignReviews,
  getDesignReviewDomains,
  getDesignReviewAxes,
  getDesignReviewAnalytics,
} from '../services/api';
import { DesignReviewAnalytics, DesignReviewSummary } from '../types/designReview';
import { AxisPerformancePanel } from '../components/learning/AxisPerformancePanel';
import { QuestionDifficulty } from '../types/question';
import { loadFailed } from '../services/apiError';
import { capitalise, domainLabel } from '../services/designReviewText';
import { EmptyState, LoadingState } from '../components/common/States';
import { Actions, Detail, Grid, PageHead, Panel, Pill, Section } from '../components/ui/primitives';

/**
 * Design Reviews: every review as a card -- its domain, its difficulty, and the
 * way in -- as the prototype lists them.
 *
 * The deciding axis is the answer, so a card only names it once the review has
 * been committed; before that it says the axis is hidden, as the prototype does.
 */

const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

export const DesignReviewListPage: React.FC = () => {
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

  const [attempt, setAttempt] = useState(0);
  const filtered = !!(domainFilter || axisFilter || difficultyFilter);

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
      .catch((err) => setFetchError(loadFailed('Could not load design reviews', err)))
      .finally(() => setLoading(false));
  }, [domainFilter, axisFilter, difficultyFilter, attempt]);

  const committed = reviews.filter((r) => r.attempted).length;

  return (
    <Box>
      <PageHead
        eyebrow="Engineering reasoning"
        title="Design Reviews"
        sub="Choose between defensible architectures — or say what you need to know before deciding. The deciding axis is revealed after you commit."
      />

      {analytics && <AxisPerformancePanel analytics={analytics} onPractiseAxis={setAxisFilter} />}

      <Actions sx={{ mt: '18px', alignItems: 'center' }}>
        <TextField select label="Domain" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All domains</MenuItem>
          {domains.map((d) => <MenuItem key={d} value={d}>{domainLabel(d)}</MenuItem>)}
        </TextField>
        <TextField select label="Deciding axis" value={axisFilter} onChange={(e) => setAxisFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All axes</MenuItem>
          {axes.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField
          select
          label="Difficulty"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value as QuestionDifficulty | '')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Any difficulty</MenuItem>
          {DIFFICULTIES.map((d) => <MenuItem key={d} value={d}>{capitalise(d)}</MenuItem>)}
        </TextField>
        {!loading && !fetchError && reviews.length > 0 && (
          <Detail component="span">
            {reviews.length} review{reviews.length === 1 ? '' : 's'} · {committed} committed
          </Detail>
        )}
      </Actions>

      {fetchError && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}
        >
          {fetchError}
        </Alert>
      )}

      {loading ? (
        <LoadingState label="Loading design reviews…" />
      ) : fetchError ? null : reviews.length === 0 ? (
        <Section>
          <Panel>
            {filtered ? (
              <EmptyState
                title="No design reviews match these filters"
                why="Every review is still there; these filters leave none of them showing."
                action={(
                  <Button
                    variant="outlined"
                    onClick={() => { setDomainFilter(''); setAxisFilter(''); setDifficultyFilter(''); }}
                  >
                    Clear filters
                  </Button>
                )}
              />
            ) : (
              <EmptyState
                title="No design reviews yet"
                why="The built-in reviews come with a fresh install. Resetting the application under Settings, Data and storage restores them."
              />
            )}
          </Panel>
        </Section>
      ) : (
        <Section>
          <Grid template="repeat(2, minmax(0,1fr))" aria-label="Design reviews">
            {reviews.map((review) => (
              <Panel key={review.id} component="article" aria-label={review.title}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <Pill>{domainLabel(review.domain)}</Pill>
                  {review.attempted && <Pill tone="success">Committed</Pill>}
                </Box>
                <Typography variant="h5" component="h2" sx={{ mt: '9px' }}>
                  <Box
                    component={RouterLink}
                    to={`/design-reviews/${review.id}`}
                    sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {review.title}
                  </Box>
                </Typography>
                {/* The deciding axis is the answer. It is named on the card only
                    once the review has been committed, where it labels something
                    already worked out rather than hinting at something not. */}
                <Detail sx={{ mt: '4px' }}>
                  Difficulty {capitalise(review.difficulty)} ·{' '}
                  {review.attempted && review.axis_label ? `decided on ${review.axis_label}` : 'decision axis hidden'}
                </Detail>
                <Actions sx={{ mt: '10px' }}>
                  {review.attempted ? (
                    <>
                      <Button component={RouterLink} to={`/design-reviews/${review.id}?again=1`} variant="outlined">
                        Review again
                      </Button>
                      <Button component={RouterLink} to={`/design-reviews/${review.id}`} variant="outlined">
                        See result
                      </Button>
                    </>
                  ) : (
                    <Button
                      component={RouterLink}
                      to={`/design-reviews/${review.id}`}
                      variant="contained"
                      color="ink"
                      aria-label={`Start review: ${review.title}`}
                    >
                      Start review
                    </Button>
                  )}
                </Actions>
              </Panel>
            ))}
          </Grid>
        </Section>
      )}
    </Box>
  );
};
