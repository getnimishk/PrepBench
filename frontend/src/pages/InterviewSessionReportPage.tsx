// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { getInterviewSessionReport } from '../services/api';
import { loadFailed } from '../services/apiError';
import { formatClock, WINDOW_FIT_LABEL, windowFit } from '../services/interviewText';
import type { InterviewSessionReport } from '../types/interviewSession';
import { LoadingState } from '../components/common/States';
import {
  Bar, BigFigure, Detail, Eyebrow, Grid, PageHead, Panel, PanelHead, Pill, Row, Section, type Tone,
} from '../components/ui/primitives';

/**
 * What a session came to, from the latest answer to each question.
 *
 * Averages cover analysed answers only, and say how many that was. Where nothing
 * was analysed the page says "Not graded" and why -- a missing provider is not a
 * score of zero, and the answers are still there to play back.
 */

/** The prototype's pill colours for a mark: green from 70, amber from 50. */
const toneFor = (percent: number): Tone => (percent >= 70 ? 'success' : percent >= 50 ? 'warning' : 'danger');

const STATUS_LABEL: Record<string, string> = {
  analyzed: 'Analysed',
  unavailable: 'Not graded',
  error: 'Analysis failed',
};

export const InterviewSessionReportPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sid = Number(sessionId);
  const [report, setReport] = useState<InterviewSessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    getInterviewSessionReport(sid)
      .then(setReport)
      .catch((err) => setError(loadFailed('Could not load this session report', err)));
  }, [sid, loadAttempt]);

  if (error) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button>}>
        {error}
      </Alert>
    );
  }
  if (!report) return <LoadingState label="Loading this session report…" />;

  const s = report.session;
  const againHref = `/interview-practice/setup?round=${s.round_type}`;

  const content = report.content_percent != null ? Math.round(report.content_percent) : null;
  const delivery = report.delivery_percent != null ? Math.round(report.delivery_percent) : null;

  return (
    <Box>
      <PageHead
        eyebrow={`Interview practice · ${s.round_label}`}
        title={`${report.answered} answer${report.answered === 1 ? '' : 's'} · ${formatClock(report.spoken_seconds)} speaking`}
        sub={report.analysed > 0
          ? `Content was graded against the ${s.round_label} rubric, delivery from the audio, over ${report.analysed} analysed answer${report.analysed === 1 ? '' : 's'}.`
          : 'Nothing in this session has been graded.'}
        actions={(
          <>
            <Button component={RouterLink} to="/interview-practice" variant="outlined">← Interview practice</Button>
            <Button component={RouterLink} to="/recordings" variant="outlined">Recordings</Button>
            <Button component={RouterLink} to={againHref} variant="contained" color="ink">
              Another {s.round_label} round
            </Button>
          </>
        )}
      />

      {report.not_graded_reason && (
        <Alert
          severity="info"
          action={<Button component={RouterLink} to="/settings/ai" color="inherit" size="small">Settings</Button>}
        >
          <strong>Not graded.</strong> {report.not_graded_reason}
        </Alert>
      )}

      <Section>
        <Grid columns={3}>
          <Panel>
            <Eyebrow>Content</Eyebrow>
            <BigFigure size={34} sx={{ mt: '6px' }}>{content != null ? `${content}%` : 'Not graded'}</BigFigure>
            {content != null && <Bar value={content} label={`Content ${content}%`} sx={{ mt: '10px' }} />}
          </Panel>
          <Panel>
            <Eyebrow>Delivery · from the audio</Eyebrow>
            <BigFigure size={34} sx={{ mt: '6px' }}>{delivery != null ? `${delivery}%` : 'Not graded'}</BigFigure>
            {delivery != null && <Bar value={delivery} label={`Delivery ${delivery}%`} sx={{ mt: '10px' }} />}
          </Panel>
          <Panel soft>
            <Eyebrow>Weakest this session</Eyebrow>
            {report.weakest_category ? (
              <>
                <Box component="h2" sx={{ m: 0, mt: '6px', fontSize: (t) => t.typography.pxToRem(22), fontWeight: 750, letterSpacing: '-0.02em' }}>
                  {report.weakest_category}
                </Box>
                <Detail>{Math.round(report.weakest_category_percent ?? 0)}% across the analysed answers.</Detail>
                <Button component={RouterLink} to={againHref} variant="contained" sx={{ mt: '14px' }}>
                  Work on it
                </Button>
              </>
            ) : (
              <Detail sx={{ mt: '8px' }}>Needs an analysed answer to say.</Detail>
            )}
          </Panel>
        </Grid>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="answers-heading">
          <PanelHead eyebrow="Answers" title="What you were asked" titleId="answers-heading" />
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {s.questions.map((q) => {
              const take = q.takes.length ? q.takes[q.takes.length - 1] : null;
              const seconds = take?.duration_seconds ?? 0;
              const analysed = take?.analysis_status === 'analyzed';
              return (
                <Row
                  key={q.id}
                  component="li"
                  title={q.question_text}
                  detail={take
                    ? [q.category, formatClock(seconds), WINDOW_FIT_LABEL[windowFit(seconds, s.target_min_seconds, s.target_max_seconds)],
                      q.takes.length > 1 ? `${q.takes.length} takes` : null].filter(Boolean).join(' · ')
                    : 'Not answered'}
                  middle={take && (
                    analysed && take.content_percent != null ? (
                      <Pill tone={toneFor(take.content_percent)}>{Math.round(take.content_percent)}% content</Pill>
                    ) : (
                      <Pill>{STATUS_LABEL[take.analysis_status ?? ''] ?? 'Not analysed yet'}</Pill>
                    )
                  )}
                  action={take && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Box component="b" sx={{ whiteSpace: 'nowrap', fontSize: (t) => t.typography.pxToRem(13) }}>
                        {analysed && take.delivery_percent != null ? `${Math.round(take.delivery_percent)}% delivery` : 'delivery not scored'}
                      </Box>
                      <Button component={RouterLink} to={`/interview-practice/recordings/${take.recording_id}/results`} variant="outlined">
                        Open
                      </Button>
                    </Box>
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
