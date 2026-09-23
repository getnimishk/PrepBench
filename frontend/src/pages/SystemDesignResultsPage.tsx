// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import {
  getSystemDesignAttempt, getSystemDesignPromptAttempts, regradeSystemDesignAttempt,
  SystemDesignAttemptHistoryItem,
} from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { SECTIONS } from '../services/systemDesignSections';
import { SystemDesignAttempt } from '../types/systemDesign';
import { LoadingState } from '../components/common/States';
import { NARROW_QUERY } from '../theme/tokens';
import {
  Bar, BigFigure, Detail, Eyebrow, Grid, PageHead, Panel, PanelHead, Row, Section, Sub,
} from '../components/ui/primitives';

/**
 * The result of one written design: the score out of ten, each rubric
 * dimension on its own, and the one thing to improve next -- the prototype's
 * results screen -- followed by the answer that was graded and every earlier
 * attempt at the same prompt.
 *
 * An answer that was not graded says so in the title. There is no score on the
 * screen at all then, rather than a zero or a placeholder that reads as one.
 */

/** The grader's overall score is out of 100; the rubric dimensions, and this page, count out of ten. */
const outOfTen = (score100: number) => (score100 / 10).toFixed(1);

const figure = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const SystemDesignResultsPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const aid = attemptId ? parseInt(attemptId, 10) : 0;

  const [attempt, setAttempt] = useState<SystemDesignAttempt | null>(null);
  const [history, setHistory] = useState<SystemDesignAttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [regrading, setRegrading] = useState(false);
  const [regradeError, setRegradeError] = useState<string | null>(null);

  const loadHistory = useCallback((promptId: number) => {
    getSystemDesignPromptAttempts(promptId)
      .then((h) => setHistory(h.items))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (isNaN(aid) || aid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getSystemDesignAttempt(aid)
      .then((a) => {
        setAttempt(a);
        loadHistory(a.prompt_id);
      })
      .catch((err) => setFetchError(loadFailed('Could not load these results', err)))
      .finally(() => setLoading(false));
  }, [aid, loadHistory, loadAttempt]);

  // Grade an answer that was saved without one -- after a provider is set up, or
  // after grading failed. The answer itself is not touched.
  const regrade = async () => {
    if (!attempt) return;
    setRegrading(true);
    setRegradeError(null);
    try {
      const updated = await regradeSystemDesignAttempt(attempt.id);
      setAttempt((prev) => ({ ...updated, prompt: updated.prompt ?? prev?.prompt }));
      loadHistory(updated.prompt_id);
    } catch (err) {
      setRegradeError(apiErrorMessage(err, 'Grading did not run. Your answer is still saved.'));
    } finally {
      setRegrading(false);
    }
  };

  if (isNaN(aid) || aid <= 0) {
    return <Alert severity="error">Invalid attempt.</Alert>;
  }

  if (loading) return <LoadingState label="Loading these results…" />;

  if (fetchError || !attempt) {
    return (
      <Alert severity="error" action={fetchError ? <Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button> : undefined}>
        {fetchError || 'Attempt not found.'}
      </Alert>
    );
  }

  const graded = attempt.grading_status === 'graded' && attempt.overall_score != null;
  const reviseHref = `/system-design/${attempt.prompt_id}/answer`;
  const title = attempt.prompt?.title || 'System design answer';
  // The lowest-scored rubric category: where the next revision should start.
  const weakest = attempt.category_scores.length
    ? attempt.category_scores.reduce((w, c) => (c.score / (c.max_score || 10) < w.score / (w.max_score || 10) ? c : w))
    : null;
  const improveNext = attempt.improvements[0] ?? weakest?.feedback ?? null;

  const actions = (
    <>
      <Button variant="outlined" onClick={() => navigate('/system-design')}>← System Design</Button>
      <Button component={RouterLink} to={reviseHref} variant="outlined">Revise your answer</Button>
      <Button variant="contained" onClick={() => navigate('/system-design')}>Practise another prompt</Button>
    </>
  );

  return (
    <Box>
      {graded ? (
        <PageHead
          eyebrow={`System Design · Results · ${title}`}
          title={`${outOfTen(attempt.overall_score ?? 0)} / 10`}
          sub={attempt.summary || 'Graded by the configured AI provider against the six-dimension rubric.'}
          actions={actions}
        >
          {attempt.target_role && <Detail>Graded for: <strong>{attempt.target_role}</strong></Detail>}
        </PageHead>
      ) : (
        <PageHead
          eyebrow={`System Design · Results · ${title}`}
          title="Not graded"
          sub={attempt.grading_status === 'unavailable'
            ? 'This answer was saved but not graded — no AI provider is set up yet. Add one in Settings → AI Providers, then grade it again.'
            : `Grading failed: ${attempt.grading_error || 'Unknown error'}. Your answer was saved; grade it again when you are ready.`}
          actions={(
            <>
              <Button component={RouterLink} to={reviseHref} variant="outlined">Revise your answer</Button>
              <Button component={RouterLink} to="/settings/ai" variant="outlined">AI settings</Button>
              <Button
                variant="contained"
                color="ink"
                disabled={regrading}
                onClick={regrade}
                startIcon={regrading ? <CircularProgress size={14} color="inherit" /> : undefined}
              >
                {regrading ? 'Grading…' : 'Grade again'}
              </Button>
            </>
          )}
        />
      )}

      {regradeError && <Alert severity="error" sx={{ mt: '14px' }}>{regradeError}</Alert>}

      {graded && (
        <>
          {attempt.category_scores.length > 0 && (
            <Section>
              <Grid columns={3} aria-label="Rubric dimensions">
                {attempt.category_scores.map((c) => {
                  const pct = c.max_score > 0 ? (c.score / c.max_score) * 100 : 0;
                  return (
                    <Panel key={c.category} component="section" aria-label={c.category}>
                      <Eyebrow>{c.category}</Eyebrow>
                      <BigFigure size={28}>{figure(c.score)}</BigFigure>
                      <Bar value={pct} label={`${c.category}: ${figure(c.score)} of ${c.max_score}`} />
                      {c.feedback && <Detail sx={{ mt: '8px' }}>{c.feedback}</Detail>}
                    </Panel>
                  );
                })}
              </Grid>
            </Section>
          )}

          {improveNext && (
            <Section>
              <Panel component="section" aria-labelledby="improve-next">
                <Eyebrow>Improve next</Eyebrow>
                <Typography variant="h5" component="h2" id="improve-next" sx={{ mt: '4px' }}>{improveNext}</Typography>
                {weakest && (
                  <Sub sx={{ mb: 0 }}>
                    Lowest-scored: {weakest.category} at {Math.round((weakest.score / (weakest.max_score || 10)) * 100)}%.
                  </Sub>
                )}
                <Box sx={{ mt: '12px' }}>
                  <Button component={RouterLink} to={reviseHref} variant="contained" color="ink">Revise your answer</Button>
                </Box>
              </Panel>
            </Section>
          )}

          {(attempt.strengths.length > 0 || attempt.improvements.length > 0) && (
            <Section>
              <Grid template="repeat(2, minmax(0,1fr))">
                <Panel component="section" aria-labelledby="strengths">
                  <PanelHead eyebrow="What held up" title="Strengths" titleId="strengths" />
                  <Points items={attempt.strengths} mark="✓" tone="success.main" empty="The grader named no strengths." />
                </Panel>
                <Panel component="section" aria-labelledby="to-improve">
                  <PanelHead eyebrow="What to work on" title="Areas to improve" titleId="to-improve" />
                  <Points items={attempt.improvements} mark="!" tone="warning.main" empty="The grader named nothing to improve." />
                </Panel>
              </Grid>
            </Section>
          )}
        </>
      )}

      <Section>
        <Panel component="section" aria-labelledby="your-answer">
          <PanelHead eyebrow="Your answer" title={title} titleId="your-answer" />
          {attempt.sections ? (
            <Box sx={{ display: 'grid', gap: '14px' }}>
              {SECTIONS.map((s) => (
                <Box key={s.key}>
                  <Typography variant="subtitle2" component="h3">{s.label}</Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: '2px', color: attempt.sections?.[s.key] ? 'text.primary' : 'text.secondary' }}>
                    {attempt.sections?.[s.key] || 'Not written.'}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{attempt.answer_text}</Typography>
          )}
        </Panel>
      </Section>

      <AttemptHistory items={history} currentId={aid} />
    </Box>
  );
};

const Points: React.FC<{ items: string[]; mark: string; tone: string; empty: string }> = ({ items, mark, tone, empty }) => (
  items.length === 0 ? (
    <Detail>{empty}</Detail>
  ) : (
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: '8px' }}>
      {items.map((text, i) => (
        <Box component="li" key={i} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: '6px', alignItems: 'baseline' }}>
          <Box component="span" aria-hidden sx={{ color: tone, fontWeight: 800 }}>{mark}</Box>
          <Typography variant="body1" component="span">{text}</Typography>
        </Box>
      ))}
    </Box>
  )
);

/**
 * Every attempt at this prompt, and what actually changed.
 *
 * `GET /system-design/attempts` shipped with the feature and no page ever
 * called it, so someone who answered the same prompt three times could not
 * find out whether the third was better than the first. "Am I improving at
 * this?" was a question the product stored the answer to and never asked.
 *
 * The change is shown only between two graded attempts. An ungraded one has no
 * score, and a line drawn through a missing number is a fabricated trend --
 * which is the same defect as a fabricated score, one step further away from
 * where anyone would look for it.
 */
const AttemptHistory: React.FC<{
  items: SystemDesignAttemptHistoryItem[];
  currentId: number;
}> = ({ items, currentId }) => {
  if (items.length <= 1) return null;

  const graded = items.filter((i) => i.overall_score !== null).length;

  return (
    <Section>
      <Panel component="section" aria-labelledby="attempt-history">
        <PanelHead eyebrow="History" title="Your attempts at this prompt" titleId="attempt-history" />
        {items.map((i) => {
          const current = i.attempt_id === currentId;
          const change = i.change_vs_previous === null
            ? null
            : `${i.change_vs_previous > 0 ? '+' : ''}${(i.change_vs_previous / 10).toFixed(1)}`;
          return (
            <Row
              key={i.attempt_id}
              // The score stays on a phone too: it is the point of the row.
              sx={{ [NARROW_QUERY]: { gridTemplateColumns: 'minmax(0,1fr) auto auto', '& > .pb-row-middle': { display: 'grid' } } }}
              title={current ? 'This one' : 'Earlier attempt'}
              detail={new Date(i.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              middle={(
                // Never a zero for an attempt that was never graded.
                <Typography variant="body1" component="span" sx={{ fontWeight: current ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                  {i.overall_score !== null ? `${outOfTen(i.overall_score)} / 10` : 'not graded'}
                </Typography>
              )}
              action={(
                <Detail component="span" sx={{ minWidth: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {change}
                </Detail>
              )}
            />
          );
        })}
        {graded < 2 && (
          <Detail sx={{ mt: '10px' }}>
            {graded === 0
              ? 'None of these were graded, so there is nothing to compare yet.'
              : 'Only one of these was graded, so there is nothing to compare it with yet.'}
          </Detail>
        )}
      </Panel>
    </Section>
  );
};
