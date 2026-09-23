// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import { getDomainDetail, getSubjects } from '../services/api';
import { loadFailed } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import type { DomainDetail, DomainQuestionItem } from '../types/analytics';
import type { Subject } from '../types/subject';
import { drillHref, explainArea } from '../services/recommendation';
import { pct } from '../services/readinessText';
import { WhyThis } from '../components/common/WhyThis';
import { LoadingState } from '../components/common/States';
import {
  Bar, BigFigure, Detail, Eyebrow, Grid, PageHead, Panel, Pill, Row, Section, Sub, type Tone,
} from '../components/ui/primitives';

/**
 * One area of one preparation, read in full.
 *
 * Opened from an area in Insights. Every figure is counted from answers that
 * were given -- accuracy, misses, what the schedule has due -- and the page
 * names its population once, at the top, rather than leaving the learner to
 * wonder why it differs from the verdict. Whether the area is under the floor
 * is the verdict's call, from mocks only, so this page and Home cannot
 * disagree about it.
 */

const STATE_LABEL: Record<DomainQuestionItem['state'], { label: string; tone: Tone }> = {
  missed: { label: 'Missed', tone: 'danger' },
  correct: { label: 'Answered correctly', tone: 'success' },
  unseen: { label: 'Not attempted', tone: 'neutral' },
};

/** One of the prototype's four figures across the top. */
const Stat: React.FC<{ label: string; value: string; detail: string; color?: string; bar?: number | null }> = ({
  label, value, detail, color, bar,
}) => (
  <Panel>
    <Eyebrow>{label}</Eyebrow>
    <BigFigure size={26} color={color}>{value}</BigFigure>
    {bar != null && <Bar value={bar} label={`${label}: ${value}`} sx={{ mt: '9px', mb: '4px' }} />}
    <Detail>{detail}</Detail>
  </Panel>
);

export const InsightsDomainPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { selectedId } = usePreparation();
  const domain = params.get('domain') ?? '';
  const subjectParam = Number(params.get('subject'));
  const subjectId = Number.isInteger(subjectParam) && subjectParam > 0 ? subjectParam : selectedId;

  const [detail, setDetail] = useState<DomainDetail | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ notFound: boolean; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // An area belongs to one preparation. Picking another in the header leaves
  // this page describing something that is no longer on screen, so it goes
  // back to Insights, which describes the new one.
  const openedWith = useRef(selectedId);
  useEffect(() => {
    if (selectedId !== openedWith.current && selectedId !== null && selectedId !== subjectId) {
      navigate('/analytics', { replace: true });
    }
  }, [selectedId, subjectId, navigate]);

  useEffect(() => {
    if (!subjectId || !domain) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getDomainDetail(subjectId, domain), getSubjects()])
      .then(([d, subjects]) => {
        if (cancelled) return;
        setDetail(d);
        setSubject(subjects.find((s) => s.id === subjectId) ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError({
          notFound: status === 404,
          message: loadFailed('Could not load this area', err),
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [subjectId, domain, attempt]);

  const back = (
    <Button component={RouterLink} to="/analytics" variant="outlined">← Back to Insights</Button>
  );

  if (!subjectId || !domain) {
    return (
      <PageHead
        eyebrow="Insights"
        title="Area not chosen"
        sub="Open an area from Insights to see its misses, what is due and its questions."
        actions={back}
      />
    );
  }

  if (loading) {
    return <LoadingState label="Loading this area…" />;
  }

  if (error || !detail) {
    return (
      <Box>
        <PageHead eyebrow="Insights" title={domain} actions={back} />
        {error?.notFound ? (
          <Alert severity="info">
            This preparation has no questions and no answers in {domain}.
          </Alert>
        ) : (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}
          >
            {error?.message ?? 'Could not load this area.'}
          </Alert>
        )}
      </Box>
    );
  }

  const reading = explainArea(detail, subject?.readiness ?? null);
  const practise = subject ? drillHref(subject, detail.domain) : null;
  const reviewDue = `/practice/spaced?domain=${encodeURIComponent(detail.domain)}&from=area`;

  return (
    <Box>
      <PageHead
        eyebrow={`Insights${subject ? ` · ${subject.name}` : ''}`}
        title={detail.domain}
        sub={detail.answers > 0
          ? `${pct(detail.accuracy_percentage ?? 0)} across ${detail.answers} answer${detail.answers === 1 ? '' : 's'} in this area — every session, drills included.`
          : 'No question in this area has been answered yet.'}
        actions={(
          <>
            {back}
            {detail.unreviewed_misses > 0 && (
              <Button component={RouterLink} to="/review" variant="outlined">
                Review {detail.unreviewed_misses} {detail.unreviewed_misses === 1 ? 'miss' : 'misses'}
              </Button>
            )}
            {detail.due_now > 0 && (
              <Button component={RouterLink} to={reviewDue} variant="contained">
                Verify {detail.due_now} due
              </Button>
            )}
            {practise && (
              <Button component={RouterLink} to={practise} variant="contained" color="ink">
                Practise this area
              </Button>
            )}
          </>
        )}
      />

      <Grid columns={4}>
        <Stat
          label="Accuracy here"
          value={detail.accuracy_percentage != null ? pct(detail.accuracy_percentage) : '—'}
          detail={detail.answers > 0 ? `${detail.correct} of ${detail.answers} answers` : 'nothing answered'}
          bar={detail.accuracy_percentage}
        />
        <Stat
          label="Questions in area"
          value={String(detail.question_count)}
          detail={`${detail.attempted_questions} attempted`}
        />
        <Stat
          label="Missed"
          value={String(detail.missed_questions)}
          detail="answered wrong at least once"
          color={detail.missed_questions > 0 ? 'error.main' : undefined}
        />
        <Stat
          label="Due now"
          value={String(detail.due_now)}
          detail="awaiting retrieval"
          color={detail.due_now > 0 ? 'warning.main' : undefined}
        />
      </Grid>

      <Section>
        <Grid columns={2} sx={{ alignItems: 'start' }}>
          <Panel component="section" aria-label="By topic">
            <Eyebrow>Weakest topics · from your answers</Eyebrow>
            {detail.topics.length > 0 ? (
              <>
                <Detail sx={{ mt: '4px' }}>
                  Lowest first, from every answer here. A topic is listed once it has {detail.min_answers_per_topic} answers.
                </Detail>
                {detail.topics.map((t) => (
                  <Box key={t.topic} sx={{ py: '12px', borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <Typography component="b" variant="body1" sx={{ fontWeight: 700, minWidth: 0 }}>{t.topic}</Typography>
                      <Typography component="span" variant="body1" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {pct(t.accuracy_percentage)} · {t.correct} of {t.answers}
                      </Typography>
                    </Box>
                    <Bar value={t.accuracy_percentage} label={`${t.topic}: ${pct(t.accuracy_percentage)}`} sx={{ mt: '6px' }} />
                  </Box>
                ))}
              </>
            ) : (
              <Detail sx={{ mt: '4px' }}>
                Not enough answers yet. A topic appears here once it has {detail.min_answers_per_topic} answers.
              </Detail>
            )}
          </Panel>

          <Panel soft component="section" aria-label="What this means">
            <Eyebrow>Interpretation</Eyebrow>
            <Typography variant="h5" component="h2" sx={{ mt: '4px' }}>{reading.headline}</Typography>
            <Sub sx={{ mb: 0 }}>{reading.why}</Sub>
            <Sub sx={{ mb: 0 }}>Reading an explanation does not advance the schedule — only a correct retrieval does.</Sub>
            <WhyThis explanation={reading} sx={{ mt: '8px' }} />
          </Panel>
        </Grid>
      </Section>

      <Section>
        <Panel component="section" aria-label="Questions in this area">
          <Eyebrow>Questions in this area</Eyebrow>
          <Detail sx={{ mt: '4px' }}>
            {detail.question_count > detail.questions.length
              ? `Showing ${detail.questions.length} of ${detail.question_count}: missed first, then due, then not attempted.`
              : 'Missed first, then due, then not attempted.'}
          </Detail>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {detail.questions.map((q) => {
              const state = STATE_LABEL[q.state];
              return (
                <Row
                  key={q.id}
                  component="li"
                  title={(
                    <Box component="span" sx={{ fontWeight: 640, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {q.text}
                    </Box>
                  )}
                  detail={`${q.topic}${q.times_answered > 0 ? ` · answered ${q.times_answered}×, right ${q.times_correct}×` : ''}`}
                  middle={(
                    <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Pill tone={state.tone}>{state.label}</Pill>
                      {q.due && <Pill tone="warning">Due</Pill>}
                    </Box>
                  )}
                  action={(
                    <Button
                      component={RouterLink}
                      to={`/question-bank?question=${q.id}`}
                      variant="outlined"
                      aria-label={`Open question: ${q.text.slice(0, 60)}`}
                    >
                      Open
                    </Button>
                  )}
                />
              );
            })}
          </Box>
        </Panel>
      </Section>
    </Box>
  );
};
