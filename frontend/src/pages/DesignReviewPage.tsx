// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Button, Chip, Alert,
  CircularProgress, TextField, Stack, Divider, Radio,
} from '@mui/material';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import {
  getDesignReview,
  getLatestDesignReviewAttempt,
  submitDesignReviewAttempt,
} from '../services/api';
import {
  DesignOption,
  DesignReviewAttempt,
  DesignReviewChoice,
  DesignReviewDetail,
} from '../types/designReview';
import { DesignFlow } from '../components/learning/DesignFlow';
import { apiErrorMessage } from '../services/apiError';

const CHOICE_LABELS: Record<DesignReviewChoice, string> = {
  A: 'Option A',
  B: 'Option B',
  ask_first: 'Neither — I would ask first',
};

/**
 * The verdict is about the reasoning, not the choice, so the wording says so.
 * "Missed the axis" rather than "Wrong": the option they picked may well have
 * been the one a strong candidate picks.
 */
const VERDICTS: Record<string, { label: string; color: 'success' | 'warning' | 'error' }> = {
  named: { label: 'You named the deciding axis', color: 'success' },
  partial: { label: 'Partly there', color: 'warning' },
  missed: { label: 'Missed the axis', color: 'error' },
};

export const DesignReviewPage: React.FC = () => {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const id = Number(reviewId);

  const [review, setReview] = useState<DesignReviewDetail | null>(null);
  const [attempt, setAttempt] = useState<DesignReviewAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [choice, setChoice] = useState<DesignReviewChoice | null>(null);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Reset on a retry, so the second attempt is timed from when it started
  // rather than from when the page was opened.
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([getDesignReview(id), getLatestDesignReviewAttempt(id).catch(() => null)])
      .then(([detail, latest]) => {
        if (cancelled) return;
        setReview(detail);
        if (latest) {
          // Reopening a completed review shows the learner their own reasoning
          // beside the reveal, so they can tell whether their thinking moved.
          setAttempt(latest);
          setChoice(latest.choice);
          setJustification(latest.justification);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Failed to load this design review.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  const canSubmit = useMemo(
    () => choice !== null && justification.trim().length > 0 && !submitting,
    [choice, justification, submitting]
  );

  const handleSubmit = async () => {
    if (!choice) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await submitDesignReviewAttempt({
        review_id: id,
        choice,
        justification: justification.trim(),
        time_spent_seconds: Math.round((Date.now() - startedAt) / 1000),
      });
      setAttempt(result);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Could not save your answer.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !review) {
    return <Alert severity="error">{loadError ?? 'Design review not found.'}</Alert>;
  }

  const revealed = attempt !== null;

  /**
   * Go again, having seen the reveal.
   *
   * The reveal was earned and then the exercise ended: there was no way to
   * restate the decision now that you know what the deciding axis was, which
   * is the moment the learning is actually available. Naming the axis in your
   * own words after seeing it is a different act from recognising it in a
   * list, and it is the one that sticks.
   *
   * The previous attempt is not deleted -- submitDesignReviewAttempt records
   * a new one, and getLatestDesignReviewAttempt returns the most recent, so
   * the history of how the reasoning changed stays intact.
   */
  const retry = () => {
    setAttempt(null);
    setChoice(null);
    setJustification('');
    setSubmitError(null);
    setStartedAt(Date.now());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderOption = (option: DesignOption) => {
    const selected = choice === option.label;
    return (
      <Card
        variant="outlined"
        onClick={() => !revealed && setChoice(option.label)}
        sx={{
          height: '100%',
          cursor: revealed ? 'default' : 'pointer',
          borderColor: selected ? 'primary.main' : 'divider',
          borderWidth: selected ? 2 : 1,
        }}
      >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            {!revealed && <Radio checked={selected} size="small" sx={{ p: 0, mt: 0.25 }} />}
            <Box>
              <Typography variant="overline" sx={{ color: 'primary.main', lineHeight: 1 }}>
                Option {option.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                {option.name}
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {option.summary}
          </Typography>

          <DesignFlow stages={option.flow} />

          <Box component="ul" sx={{ pl: 2.5, m: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {option.key_choices.map((kc) => (
              <Typography key={kc} component="li" variant="body2">{kc}</Typography>
            ))}
          </Box>

          {/* Holds/breaks/cost are the reveal, not the question -- showing them
              up front would hand over the reasoning the learner is here to do. */}
          {revealed && (
            <>
              <Divider />
              <Stack spacing={1}>
                <Box>
                  <Typography variant="overline" sx={{ color: 'success.main' }}>Holds when</Typography>
                  <Typography variant="body2">{option.holds_when}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" sx={{ color: 'warning.main' }}>Breaks when</Typography>
                  <Typography variant="body2">{option.breaks_when}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>Rough cost</Typography>
                  <Typography variant="body2">{option.rough_cost}</Typography>
                </Box>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Button
        startIcon={<ArrowLeft size={16} />}
        onClick={() => navigate('/design-reviews')}
        sx={{ mb: 2 }}
      >
        All design reviews
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
        {review.title}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>The brief</Typography>
          <Typography variant="body1" sx={{ mt: 0.5 }}>{review.brief}</Typography>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {review.options.map((option) => (
          <Grid key={option.id} size={{ xs: 12, md: 6 }}>
            {renderOption(option)}
          </Grid>
        ))}
      </Grid>

      {!revealed && (
        <Card
          variant="outlined"
          onClick={() => setChoice('ask_first')}
          sx={{
            mb: 3,
            cursor: 'pointer',
            borderColor: choice === 'ask_first' ? 'primary.main' : 'divider',
            borderWidth: choice === 'ask_first' ? 2 : 1,
          }}
        >
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
            <Radio checked={choice === 'ask_first'} size="small" sx={{ p: 0 }} />
            <HelpCircle size={18} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Neither — I would ask something first
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Sometimes the right answer is refusing to choose until you know more. Say what you would ask.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {revealed ? 'What you said' : 'Why?'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder={
              // "Neither" is only a strong answer when it names the question,
              // and the server enforces that -- so say so before they submit
              // rather than rejecting them afterwards.
              choice === 'ask_first'
                ? 'What would you ask? Name the question that would settle it.'
                : 'Two or three sentences. What is this decision actually about?'
            }
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            disabled={revealed}
            sx={{ mt: 1 }}
          />
          {submitError && <Alert severity="error" sx={{ mt: 2 }}>{submitError}</Alert>}
          {!revealed && (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!canSubmit}
              sx={{ mt: 2 }}
            >
              {submitting ? 'Saving…' : 'Commit and see the reveal'}
            </Button>
          )}
        </CardContent>
      </Card>

      {revealed && attempt?.reveal && (
        <>
          <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: 'primary.main' }}>
                The deciding axis
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                {attempt.reveal.deciding_axis}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Chip size="small" label={`You chose: ${CHOICE_LABELS[attempt.choice]}`} />
                {/* Never a zero. An attempt that was not graded has no verdict
                    at all, and says so rather than blaming the learner for a
                    missing API key. */}
                {attempt.grading_status === 'not_graded' && (
                  <Chip size="small" variant="outlined" label="Not graded" />
                )}
                {attempt.axis_verdict && (
                  <Chip
                    size="small"
                    color={VERDICTS[attempt.axis_verdict].color}
                    label={VERDICTS[attempt.axis_verdict].label}
                  />
                )}
              </Stack>

              {attempt.feedback && (
                <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
                  {attempt.feedback}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>What separates them</Typography>
              <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                {attempt.reveal.reveal}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: 'success.main' }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: 'success.main' }}>
                What the strongest answer asks
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                {attempt.reveal.elicit_answer}
              </Typography>
            </CardContent>
          </Card>

          {review.concepts.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Vocabulary this review used
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {review.concepts.map((c) => (
                    <Chip key={c} size="small" label={c} variant="outlined" />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap', rowGap: 1 }}>
            <Button variant="contained" onClick={retry} sx={{ borderRadius: '100px', boxShadow: 'none' }}>
              Try again
            </Button>
            <Button variant="outlined" onClick={() => navigate('/design-reviews')} sx={{ borderRadius: '100px' }}>
              Another review
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
};
