// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Radio, TextField, Typography } from '@mui/material';
import {
  getDesignReview,
  getDesignReviews,
  getLatestDesignReviewAttempt,
  regradeDesignReviewAttempt,
  submitDesignReviewAttempt,
} from '../services/api';
import {
  DesignOption,
  DesignReviewAttempt,
  DesignReviewChoice,
  DesignReviewDetail,
} from '../types/designReview';
import { DesignFlow } from '../components/learning/DesignFlow';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { CHOICE_LABELS, capitalise, domainLabel } from '../services/designReviewText';
import { LoadingState } from '../components/common/States';
import {
  Actions, Detail, Eyebrow, Grid, Note, PageHead, Panel, Pill, Section, type Tone,
} from '../components/ui/primitives';

/**
 * One design review: two defensible architectures for one requirement, or the
 * question that has to be asked first.
 *
 * Before committing, the page is the prototype's decision sheet -- the brief,
 * both options side by side, "ask first", and the reasoning. After, it is the
 * prototype's analysis: the deciding axis, whether the reasoning named it, and
 * each option's holds / breaks / cost, which were withheld until now because
 * they are the reasoning the learner is here to do.
 */

/**
 * The verdict is about the reasoning, not the choice, so the wording says so.
 * "Missed the axis" rather than "Wrong": the option they picked may well have
 * been the one a strong candidate picks.
 */
const VERDICTS: Record<string, { label: string; short: string; tone: Tone }> = {
  named: { label: 'You named the deciding axis', short: 'Named', tone: 'success' },
  partial: { label: 'Partly there', short: 'Partial', tone: 'warning' },
  missed: { label: 'Missed the axis', short: 'Missed', tone: 'danger' },
};

export const DesignReviewPage: React.FC = () => {
  const { reviewId } = useParams<{ reviewId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = Number(reviewId);
  // "Review again" from the list: a fresh commit, not the last one's reveal.
  const again = searchParams.has('again');

  const [review, setReview] = useState<DesignReviewDetail | null>(null);
  const [attempt, setAttempt] = useState<DesignReviewAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [choice, setChoice] = useState<DesignReviewChoice | null>(null);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [regrading, setRegrading] = useState(false);
  const [regradeError, setRegradeError] = useState<string | null>(null);
  const [findingNext, setFindingNext] = useState(false);
  // Reset on a retry, so the second attempt is timed from when it started
  // rather than from when the page was opened.
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    // Another review is another exercise. The page stays mounted when only the
    // id in the address changes, so without this "Next review" opened on the
    // previous review's reveal, with nothing left to commit.
    setAttempt(null);
    setChoice(null);
    setJustification('');
    setSubmitError(null);
    setRegradeError(null);
    setStartedAt(Date.now());

    Promise.all([getDesignReview(id), again ? Promise.resolve(null) : getLatestDesignReviewAttempt(id).catch(() => null)])
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
      .catch((err) => {
        if (!cancelled) setLoadError(loadFailed('Could not load this design review', err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, again, loadAttempt]);

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
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Could not save your answer.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Seek a verdict for reasoning committed while no provider could grade it.
  const regrade = async () => {
    if (!attempt) return;
    setRegrading(true);
    setRegradeError(null);
    try {
      setAttempt(await regradeDesignReviewAttempt(attempt.id));
    } catch (err) {
      setRegradeError(apiErrorMessage(err, 'Grading did not run. Your answer is still saved.'));
    } finally {
      setRegrading(false);
    }
  };

  // The next exercise: the first review not attempted yet, then simply the next
  // one along, so "Next review" always goes somewhere rather than back to a list.
  const nextReview = async () => {
    setFindingNext(true);
    try {
      const { items } = await getDesignReviews({ limit: 500 });
      const others = items.filter((r) => r.id !== id);
      const fresh = others.find((r) => !r.attempted);
      const after = others.find((r) => r.id > id) ?? others[0];
      const target = fresh ?? after;
      navigate(target ? `/design-reviews/${target.id}` : '/design-reviews');
    } catch {
      navigate('/design-reviews');
    } finally {
      setFindingNext(false);
    }
  };

  if (loading) return <LoadingState label="Loading this design review…" />;

  if (loadError || !review) {
    return (
      <Alert severity="error" action={loadError ? <Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button> : undefined}>
        {loadError ?? 'Design review not found.'}
      </Alert>
    );
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
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const context = `${domainLabel(review.domain)} · Difficulty ${capitalise(review.difficulty)}`;
  const options = (
    <Grid template="repeat(2, minmax(0,1fr))" aria-label="Options">
      {review.options.map((option) => (
        <OptionCard
          key={option.id}
          option={option}
          selected={choice === option.label}
          revealed={revealed}
          onSelect={() => setChoice(option.label)}
        />
      ))}
    </Grid>
  );

  if (!revealed || !attempt) {
    return (
      <Box>
        <PageHead
          eyebrow={`Design Review · ${context}`}
          title={review.title}
          actions={<Button variant="outlined" onClick={() => navigate('/design-reviews')}>← All reviews</Button>}
        />

        <Panel component="section" aria-label="The brief" sx={{ borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
          <Eyebrow sx={{ color: 'primary.main' }}>The brief</Eyebrow>
          <Typography sx={{ fontSize: (t) => t.typography.pxToRem(15), lineHeight: 1.55, mt: '6px' }}>{review.brief}</Typography>
        </Panel>

        <Section>{options}</Section>

        {/* Option C: sometimes the right answer is refusing to choose until you know more. */}
        <Box
          onClick={() => setChoice('ask_first')}
          sx={(t) => ({
            ...choiceSx(t, choice === 'ask_first'),
            mt: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px', p: '12px 16px',
          })}
        >
          <Radio
            checked={choice === 'ask_first'}
            onChange={() => setChoice('ask_first')}
            name="design-review-choice"
            value="ask_first"
            size="small"
            sx={{ p: '2px', mt: '-1px' }}
            slotProps={{ input: { 'aria-label': 'Neither — I would ask something first' } }}
          />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Box component="strong" sx={{ display: 'block', fontSize: (t) => t.typography.pxToRem(13), color: 'primary.main' }}>
              Option C · Neither — I would ask something first
            </Box>
            <Detail sx={{ mt: '2px' }}>
              Neither option can be committed responsibly yet. Name the question that would settle it.
            </Detail>
          </Box>
          {choice === 'ask_first' && <Detail component="span" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Selected</Detail>}
        </Box>

        <Section>
          <Panel component="section" aria-label="Your reasoning">
            <Box
              component="label"
              htmlFor="design-review-reasoning"
              sx={{ display: 'block', mb: '6px', fontSize: (t) => t.typography.pxToRem(11), fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary' }}
            >
              Your decision rationale
            </Box>
            <TextField
              id="design-review-reasoning"
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
            />
            {submitError && <Alert severity="error" sx={{ mt: '12px' }}>{submitError}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', mt: '16px', flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={() => navigate('/design-reviews')}>Cancel</Button>
              <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? 'Saving…' : 'Commit decision & reveal the deciding axis →'}
              </Button>
            </Box>
          </Panel>
        </Section>
      </Box>
    );
  }

  const verdict = attempt.axis_verdict ? VERDICTS[attempt.axis_verdict] : null;
  const notGraded = attempt.grading_status === 'not_graded';
  const askedFirst = attempt.choice === 'ask_first';
  const axisLabel = attempt.reveal?.axis_label;

  return (
    <Box>
      <PageHead
        eyebrow={`Design Review · Analysis · ${context}`}
        title={axisLabel ? `The deciding axis was ${axisLabel}` : 'The deciding axis'}
        sub={review.title}
        actions={(
          <>
            <Button variant="outlined" onClick={() => navigate('/design-reviews')}>← All reviews</Button>
            <Button variant="outlined" onClick={retry}>Change decision</Button>
            <Button variant="contained" color="ink" disabled={findingNext} onClick={nextReview}>
              {findingNext ? 'Finding one…' : 'Next review →'}
            </Button>
          </>
        )}
      />

      <Panel
        component="section"
        aria-label="Your decision"
        sx={{ borderLeft: '5px solid', borderLeftColor: askedFirst ? 'success.main' : 'primary.main' }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <Box sx={{ minWidth: 0 }}>
            <Eyebrow sx={{ color: askedFirst ? 'success.main' : 'primary.main' }}>Your selection · {CHOICE_LABELS[attempt.choice]}</Eyebrow>
            {/* Never a zero. An attempt that was not graded has no verdict at
                all, and says so rather than blaming the learner for a missing
                API key. */}
            <Typography variant="h5" component="h2" sx={{ mt: '4px' }}>
              {verdict ? verdict.label : notGraded ? 'Your reasoning has not been judged' : 'Waiting for a verdict'}
            </Typography>
          </Box>
          {verdict
            ? <Pill tone={verdict.tone}>{verdict.short}</Pill>
            : notGraded && <Pill>Not graded</Pill>}
        </Box>

        {attempt.reveal && (
          <Box sx={{ mt: '16px' }}>
            <Eyebrow>The deciding axis</Eyebrow>
            <Typography sx={{ fontSize: (t) => t.typography.pxToRem(16), fontWeight: 800, lineHeight: 1.4, mt: '4px' }}>
              {attempt.reveal.deciding_axis}
            </Typography>
          </Box>
        )}
        {attempt.feedback && <Detail sx={{ mt: '8px', fontSize: (t) => t.typography.pxToRem(13), lineHeight: 1.6 }}>{attempt.feedback}</Detail>}

        {notGraded && (
          <Note sx={{ mt: '14px' }}>
            No AI provider could judge your reasoning, so there is no verdict — the reveal below is the same
            either way. Set one up, then grade it again.
            <Actions sx={{ mt: '10px' }}>
              <Button component={RouterLink} to="/settings/ai" variant="outlined" size="small">AI settings</Button>
              <Button variant="contained" color="ink" size="small" disabled={regrading} onClick={regrade}>
                {regrading ? 'Grading…' : 'Grade again'}
              </Button>
            </Actions>
          </Note>
        )}
        {regradeError && <Alert severity="error" sx={{ mt: '12px' }}>{regradeError}</Alert>}
      </Panel>

      {attempt.reveal && (
        <>
          {/* Compare, side by side: what you committed to, and what the strongest
              answer was listening for. The learning is in the difference. */}
          <Section>
            <Panel component="section" aria-label="Compare your reasoning">
              <Eyebrow>Compare your reasoning</Eyebrow>
              <Grid template="repeat(2, minmax(0,1fr))" sx={{ mt: '10px' }}>
                <Box>
                  <Typography variant="subtitle2" component="h3">You said · {CHOICE_LABELS[attempt.choice]}</Typography>
                  <Typography variant="body1" sx={{ mt: '4px', whiteSpace: 'pre-line' }}>{attempt.justification}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" component="h3">The strongest answer asks</Typography>
                  <Typography variant="body1" sx={{ mt: '4px', whiteSpace: 'pre-line' }}>{attempt.reveal.elicit_answer}</Typography>
                </Box>
              </Grid>
            </Panel>
          </Section>

          <Section>
            <Panel component="section" aria-label="What separates them">
              <Eyebrow>What separates them</Eyebrow>
              <Typography variant="body1" sx={{ mt: '6px', whiteSpace: 'pre-line' }}>{attempt.reveal.reveal}</Typography>
            </Panel>
          </Section>
        </>
      )}

      <Section>{options}</Section>

      {review.concepts.length > 0 && (
        <Section>
          <Panel soft component="section" aria-label="Vocabulary this review used">
            <Eyebrow>Vocabulary this review used</Eyebrow>
            <Actions sx={{ mt: '8px', gap: '6px' }}>
              {review.concepts.map((c) => <Pill key={c}>{c}</Pill>)}
            </Actions>
          </Panel>
        </Section>
      )}
    </Box>
  );
};

/** The prototype's .choice: a bordered card that takes the accent when chosen. */
const choiceSx = (t: import('@mui/material').Theme, selected: boolean) => ({
  borderRadius: '10px',
  border: '1px solid',
  borderColor: selected ? t.palette.primary.main : t.palette.divider,
  bgcolor: selected ? (t.palette as { pb?: { accentSoft: string } }).pb?.accentSoft ?? 'transparent' : t.palette.background.paper,
  boxShadow: selected ? `inset 0 0 0 1px ${t.palette.primary.main}` : 'none',
  cursor: 'pointer',
  transition: 'border-color .15s ease, background-color .15s ease',
  '&:hover': { borderColor: t.palette.primary.main },
});

const OptionCard: React.FC<{
  option: DesignOption;
  selected: boolean;
  revealed: boolean;
  onSelect: () => void;
}> = ({ option, selected, revealed, onSelect }) => (
  <Box
    component="article"
    aria-label={`Option ${option.label}: ${option.name}`}
    onClick={() => !revealed && onSelect()}
    sx={(t) => ({
      ...choiceSx(t, selected && !revealed),
      ...(revealed ? { cursor: 'default', '&:hover': {} } : {}),
      p: '16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0,
    })}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* The radio is the control, not decoration beside one: the choice of
            the whole exercise has to be reachable by keyboard and announce itself. */}
        {!revealed && (
          <Radio
            checked={selected}
            onChange={onSelect}
            name="design-review-choice"
            value={option.label}
            size="small"
            // 24px, WCAG 2.2's smallest target.
            sx={{ p: '2px' }}
            slotProps={{ input: { 'aria-label': `Option ${option.label}: ${option.name}` } }}
          />
        )}
        <Pill tone="accent" sx={{ fontWeight: 800 }}>Option {option.label}</Pill>
      </Box>
      {selected && !revealed && <Detail component="span" sx={{ fontWeight: 700 }}>✓ Selected</Detail>}
    </Box>

    <Box>
      <Typography component="h2" sx={{ fontSize: (t) => t.typography.pxToRem(15), fontWeight: 800, lineHeight: 1.3 }}>{option.name}</Typography>
      <Detail sx={{ mt: '4px', lineHeight: 1.45 }}>{option.summary}</Detail>
    </Box>

    <DesignFlow stages={option.flow} />

    <Box component="ul" sx={{ pl: '18px', m: 0, display: 'grid', gap: '3px' }}>
      {option.key_choices.map((kc) => (
        <Typography key={kc} component="li" variant="body2">{kc}</Typography>
      ))}
    </Box>

    {/* Holds/breaks/cost are the reveal, not the question -- showing them
        up front would hand over the reasoning the learner is here to do. */}
    {revealed && (
      <Box sx={{ display: 'grid', gap: '8px', pt: '10px', borderTop: '1px solid', borderColor: 'divider' }}>
        <Box>
          <Eyebrow sx={{ color: 'success.main' }}>Holds when</Eyebrow>
          <Typography variant="body2" sx={{ mt: '2px' }}>{option.holds_when}</Typography>
        </Box>
        <Box>
          <Eyebrow sx={{ color: 'error.main' }}>Breaks when</Eyebrow>
          <Typography variant="body2" sx={{ mt: '2px' }}>{option.breaks_when}</Typography>
        </Box>
        <Box>
          <Eyebrow>Rough cost</Eyebrow>
          <Typography variant="body2" sx={{ mt: '2px' }}>{option.rough_cost}</Typography>
        </Box>
      </Box>
    )}
  </Box>
);
