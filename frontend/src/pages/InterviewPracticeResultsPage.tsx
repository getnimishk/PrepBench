// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, Chip, CircularProgress, Stack,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell, TableHead,
  TableRow,
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
import {
  analyzeRecording, getInterviewQuestion, getInterviewRoundTypes, getRecording, getRecordingAnalysis,
  getRecordingAudioUrl, getRecordings,
} from '../services/api';
import { PracticeRecording, RecordingAnalysis } from '../types/recording';
import { InterviewQuestion, RoundTypeInfo } from '../types/interviewQuestion';
import { CategoryScoreList } from '../components/common/CategoryScoreList';
import { TargetWindow } from '../components/interview/AnswerConsole';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { formatClock, WINDOW_FIT_LABEL, windowFit } from '../services/interviewText';
import { LoadingState } from '../components/common/States';
import {
  Detail, Eyebrow, Grid, Note, PageHead, Panel, Pill, Section, Sub,
} from '../components/ui/primitives';

/**
 * One recorded answer: play it back, see what was measured, what the analysis
 * said, what to work on, and how it compares with the other takes.
 *
 * The plan's chain -- save, playback, transcript, content, delivery,
 * recommendation, retry, compare -- in one place. When nothing graded the
 * answer the page says "Not graded", says why, and offers the two things that
 * can change that: set up a provider, and run the analysis again. It never
 * shows a score it did not receive.
 */

const STATUS_LABEL: Record<string, string> = {
  analyzed: 'Analysed',
  unavailable: 'Not graded',
  error: 'Analysis failed',
};

const pct = (v?: number | null) => (v == null ? '—' : `${Math.round(v)}%`);

/** The server's figure for a set of scores: the mean of each category's share
 *  of its maximum. Null when nothing was graded -- never a zero. */
const meanPercent = (scores: { score: number; max_score: number }[]): number | null => {
  const graded = scores.filter((x) => x.max_score > 0);
  if (!graded.length) return null;
  return Math.round(graded.reduce((n, x) => n + (x.score / x.max_score) * 100, 0) / graded.length);
};

const takeDate = (iso: string) => {
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const InterviewPracticeResultsPage: React.FC = () => {
  const { recordingId } = useParams<{ recordingId: string }>();
  const rid = recordingId ? parseInt(recordingId, 10) : 0;

  const [recording, setRecording] = useState<PracticeRecording | null>(null);
  const [analysis, setAnalysis] = useState<RecordingAnalysis | null>(null);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [round, setRound] = useState<RoundTypeInfo | null>(null);
  const [takes, setTakes] = useState<PracticeRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTakes = useCallback((questionId: number) => {
    getRecordings({ interview_question_id: questionId, limit: 50 })
      .then((res) => setTakes(res.items))
      .catch(() => setTakes([]));
  }, []);

  const runAnalysis = useCallback((questionId?: number | null) => {
    setAnalyzing(true);
    setError(null);
    analyzeRecording(rid)
      .then((a) => {
        setAnalysis(a);
        if (questionId) loadTakes(questionId);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Failed to analyze recording.')))
      .finally(() => setAnalyzing(false));
  }, [rid, loadTakes]);

  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (isNaN(rid) || rid <= 0) return;
    setLoading(true);
    setError(null);
    getRecording(rid)
      .then((r) => {
        setRecording(r);
        if (r.interview_question_id) {
          const qid = r.interview_question_id;
          // Supporting detail: a failure here costs its own section, not the answer.
          Promise.resolve()
            .then(() => getInterviewQuestion(qid))
            .then((q) => {
              setQuestion(q);
              return getInterviewRoundTypes().then((rounds) => setRound(rounds.find((x) => x.value === q.round_type) ?? null));
            })
            .catch(() => {});
          Promise.resolve().then(() => loadTakes(qid)).catch(() => {});
        }
        return getRecordingAnalysis(rid).catch(() => null).then((existing) => {
          setLoading(false);
          if (existing) setAnalysis(existing);
          // Reached right after recording, so the analysis starts on its own
          // rather than waiting for a click.
          else runAnalysis(r.interview_question_id);
        });
      })
      .catch((err) => {
        setError(loadFailed('Could not load this recording', err));
        setLoading(false);
      });
  }, [rid, runAnalysis, loadTakes, loadAttempt]);

  const recommendation = useMemo(() => {
    if (!analysis || analysis.analysis_status !== 'analyzed') return null;
    const pool = analysis.content_scores.length ? analysis.content_scores : analysis.communication_scores;
    const graded = pool.filter((s) => s.max_score > 0);
    if (!graded.length) return null;
    return graded.reduce((worst, s) => (s.score / s.max_score < worst.score / worst.max_score ? s : worst));
  }, [analysis]);

  if (isNaN(rid) || rid <= 0) {
    return <Alert severity="error">Invalid recording.</Alert>;
  }

  if (loading) return <LoadingState label="Loading these results…" />;

  if (error && !recording) {
    return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button>}>{error}</Alert>;
  }

  const hasContent = analysis && analysis.analysis_status === 'analyzed' && analysis.content_scores.length > 0;
  const isGraded = analysis && analysis.analysis_status === 'analyzed';
  const seconds = recording?.duration_seconds ?? 0;
  const min = round?.target_min_seconds ?? 0;
  const max = round?.target_max_seconds ?? 0;
  const retakeHref = question ? `/interview-practice/${question.id}/record` : '/interview-practice/general/record';

  const title = question ? `“${question.question_text}”` : recording?.title || 'Results';
  const contentPct = isGraded ? meanPercent(analysis!.content_scores) : null;
  const deliveryPct = isGraded ? meanPercent(analysis!.communication_scores) : null;

  return (
    <Box>
      <PageHead
        eyebrow={round ? `Recording · ${round.label}` : 'Recording'}
        title={(
          // A question can run to two lines; the prototype's 42px is for a name.
          <Box component="span" sx={title.length > 70 ? { display: 'block', fontSize: (t) => t.typography.pxToRem(26), lineHeight: 1.3 } : undefined}>
            {title}
          </Box>
        )}
        sub="Content and delivery are scored separately, so a strong story is not hidden by a nervous delivery."
        actions={(
          <>
            {recording?.session_id != null && (
              <Button component={RouterLink} to={`/interview-practice/sessions/${recording.session_id}/report`} variant="outlined">
                ← Session report
              </Button>
            )}
            <Button component={RouterLink} to="/recordings" variant="outlined">← All recordings</Button>
            {takes.length > 1 && (
              <Button href="#takes" variant="outlined">Compare takes</Button>
            )}
            <Button component={RouterLink} to={retakeHref} variant="contained" color="ink">
              {question ? 'Retake this question' : 'Record again'}
            </Button>
          </>
        )}
      />

      {recording && (
        <Panel component="section" aria-label="Playback" sx={{ maxWidth: 960 }}>
          <Eyebrow>Playback</Eyebrow>
          <Box component="audio" controls src={getRecordingAudioUrl(recording.id)} sx={{ display: 'block', width: '100%', mt: '12px' }} />
        </Panel>
      )}

      {recording && (max > 0 || recording.plan_note) && (
        <Section>
          <Grid columns={2}>
            {max > 0 && (
              <Panel>
                <Eyebrow>Measured from this take</Eyebrow>
                <Box component="p" sx={{ m: 0, mt: '8px', fontWeight: 650 }}>
                  {formatClock(seconds)} · {WINDOW_FIT_LABEL[windowFit(seconds, min, max)]}
                </Box>
                <Detail sx={{ mb: '10px' }}>
                  A good {round?.label.toLowerCase()} answer runs {formatClock(min)}–{formatClock(max)}. This needs no AI: it is the clock.
                </Detail>
                <TargetWindow seconds={seconds} min={min} max={max} />
              </Panel>
            )}
            {recording.plan_note && (
              <Panel soft>
                <Eyebrow>The plan you wrote before answering</Eyebrow>
                <Box component="p" sx={{ m: 0, mt: '8px', whiteSpace: 'pre-wrap' }}>{recording.plan_note}</Box>
              </Panel>
            )}
          </Grid>
        </Section>
      )}

      {analyzing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
          <CircularProgress aria-hidden />
          <Typography color="text.secondary">Analysing your answer…</Typography>
        </Box>
      )}

      {error && !analyzing && <Alert severity="error" sx={{ mt: '18px' }}>{error}</Alert>}

      {analysis && !analyzing && analysis.analysis_status !== 'analyzed' && (
        <Section>
          <Alert
            severity={analysis.analysis_status === 'unavailable' ? 'info' : 'warning'}
            action={(
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button component={RouterLink} to="/settings/ai" color="inherit" size="small">Settings</Button>
                <Button color="inherit" size="small" variant="outlined" onClick={() => runAnalysis(recording?.interview_question_id)}>
                  Analyse again
                </Button>
              </Stack>
            )}
          >
            <strong>Not graded.</strong>{' '}
            {analysis.analysis_status === 'unavailable'
              ? 'This answer was saved but not analysed -- no AI provider is set up yet. Add one in Settings -> AI Providers, then analyse it again.'
              : `The analysis failed: ${analysis.analysis_error ?? 'no reason given'}. The answer is saved; try the analysis again.`}
          </Alert>
        </Section>
      )}

      {isGraded && recommendation && (
        <Section>
          <Panel soft component="section" aria-labelledby="work-on-heading">
            <Eyebrow>What to work on</Eyebrow>
            <Typography id="work-on-heading" variant="h5" component="h2" sx={{ mt: '6px' }}>
              {recommendation.category} · {Math.round((recommendation.score / recommendation.max_score) * 100)}%
            </Typography>
            <Sub sx={{ mb: 0 }}>The lowest-graded part of this answer. {recommendation.feedback}</Sub>
          </Panel>
        </Section>
      )}

      {isGraded && analysis!.answer_comparison && (
        <Section>
          <Panel component="section" aria-labelledby="plan-comparison-heading">
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Eyebrow>Plan Alignment · {analysis!.answer_comparison.alignment_score}%</Eyebrow>
                <Typography id="plan-comparison-heading" variant="h5" component="h2" sx={{ mt: '4px' }}>
                  Prepared Answer vs. What You Said
                </Typography>
              </Box>
              <Chip
                label={`${analysis!.answer_comparison.alignment_score}% Fidelity`}
                color={
                  analysis!.answer_comparison.alignment_score >= 80 ? 'success' :
                  analysis!.answer_comparison.alignment_score >= 50 ? 'warning' : 'default'
                }
                variant="outlined"
                sx={{ fontWeight: 700, minHeight: 28, height: 'auto', fontSize: (t) => t.typography.pxToRem(13.5) }}
              />

            </Stack>

            {analysis!.answer_comparison.key_point_matches.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Key Talking Points Coverage
                </Typography>
                <Table size="small" aria-label="Key talking points coverage">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 650 }}>Target Point</TableCell>
                      <TableCell sx={{ width: 110, fontWeight: 650 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 650 }}>Observed in Transcript</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis!.answer_comparison.key_point_matches.map((m, idx) => {
                      const statusColor = m.status === 'covered' ? 'success' : m.status === 'partial' ? 'warning' : 'error';
                      const statusLabel = m.status.charAt(0).toUpperCase() + m.status.slice(1);
                      return (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontWeight: 600, verticalAlign: 'top' }}>{m.point}</TableCell>
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            <Chip size="small" label={statusLabel} color={statusColor} variant="filled" sx={{ fontWeight: 600, height: 22 }} />
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', verticalAlign: 'top' }}>{m.evidence || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}

            {(analysis!.answer_comparison.gap_analysis || analysis!.answer_comparison.unplanned_additions) && (
              <Grid columns={2} sx={{ mt: 2 }}>
                {analysis!.answer_comparison.gap_analysis && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.main', textTransform: 'uppercase' }}>
                      Points or Metrics Left Out
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                      {analysis!.answer_comparison.gap_analysis}
                    </Typography>
                  </Box>
                )}
                {analysis!.answer_comparison.unplanned_additions && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'info.main', textTransform: 'uppercase' }}>
                      Unplanned Tangents / Rambling
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                      {analysis!.answer_comparison.unplanned_additions}
                    </Typography>
                  </Box>
                )}
              </Grid>
            )}

            {analysis!.answer_comparison.coaching_tips && (
              <Box sx={{ mt: 2, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'primary.main', bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase' }}>
                  Next Take Coaching Advice
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary', fontWeight: 500 }}>
                  {analysis!.answer_comparison.coaching_tips}
                </Typography>
              </Box>
            )}

            {question?.prepared_answer && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                  <Typography variant="body2" sx={{ fontWeight: 650 }}>
                    Compare Prepared Model Answer vs. Verbatim Transcript
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid columns={2}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                        Your Prepared Model Answer
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary', p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                        {question.prepared_answer}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                        What You Said (Transcript)
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary', p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                        {analysis!.transcript || '(No transcript available)'}
                      </Typography>
                    </Box>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            )}
          </Panel>
        </Section>
      )}

      {isGraded && (
        <Section>
          <Grid columns={hasContent ? 2 : undefined}>
            {hasContent && (
              <Panel component="section" aria-labelledby="content-heading">
                <Eyebrow>Content{contentPct != null ? ` · ${contentPct}%` : ''}</Eyebrow>
                <Typography id="content-heading" variant="h6" component="h2" sx={{ mt: '4px', mb: '12px' }}>What you said</Typography>
                {analysis!.content_summary && <Note sx={{ mb: '12px' }}>{analysis!.content_summary}</Note>}
                <CategoryScoreList scores={analysis!.content_scores} />
              </Panel>
            )}
            <Panel component="section" aria-labelledby="delivery-heading">
              <Eyebrow>Delivery{deliveryPct != null ? ` · ${deliveryPct}%` : ''}</Eyebrow>
              <Typography id="delivery-heading" variant="h6" component="h2" sx={{ mt: '4px', mb: '12px' }}>How you said it</Typography>
              {analysis!.summary && <Note sx={{ mb: '12px' }}>{analysis!.summary}</Note>}
              {analysis!.filler_word_count !== null && (
                <Pill sx={{ mb: '12px' }}>{analysis!.filler_word_count} filler words</Pill>
              )}
              <CategoryScoreList scores={analysis!.communication_scores} />
            </Panel>
          </Grid>

          {analysis!.transcript && (
            <Accordion sx={{ mt: '14px' }}>
              <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                <Typography variant="body2" sx={{ fontWeight: 650 }}>Transcript</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">{analysis!.transcript}</Typography>
              </AccordionDetails>
            </Accordion>
          )}
        </Section>
      )}

      {takes.length > 1 && (
        <Section>
          <Panel component="section" id="takes" aria-labelledby="takes-heading" sx={{ scrollMarginTop: 80 }}>
            <Eyebrow>Compare</Eyebrow>
            <Typography id="takes-heading" variant="h5" component="h2" sx={{ mt: '6px' }}>Every take of this question</Typography>
            <Box sx={{ overflowX: 'auto', mt: '10px' }}>
              <Table size="small" aria-label="Takes of this question">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Length</TableCell>
                    <TableCell align="right">Content</TableCell>
                    <TableCell align="right">Delivery</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Open</Box></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {takes.map((t) => (
                    <TableRow key={t.id} selected={t.id === rid}>
                      <TableCell>{takeDate(t.created_at)}</TableCell>
                      <TableCell align="right">
                        {formatClock(t.duration_seconds ?? 0)}
                        {max > 0 && (
                          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            {windowFit(t.duration_seconds ?? 0, min, max)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{pct(t.content_percent)}</TableCell>
                      <TableCell align="right">{pct(t.delivery_percent)}</TableCell>
                      <TableCell>{STATUS_LABEL[t.analysis_status ?? ''] ?? 'Not analysed yet'}</TableCell>
                      <TableCell align="right">
                        {t.id === rid
                          ? <Typography variant="caption" sx={{ fontWeight: 650 }}>This take</Typography>
                          : (
                            <Button component={RouterLink} to={`/interview-practice/recordings/${t.id}/results`} size="small" variant="outlined">
                              Open
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Panel>
        </Section>
      )}

      <Section>
        <Detail>
          Another question instead?{' '}
          <Box component={RouterLink} to="/interview-practice" sx={{ color: 'primary.main', fontWeight: 650 }}>
            Practise another question
          </Box>
        </Detail>
      </Section>
    </Box>
  );
};
