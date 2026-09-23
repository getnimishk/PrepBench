// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack,
  Typography, alpha,
} from '@mui/material';
import { X } from 'lucide-react';
import {
  analyzeRecording, finishInterviewSession, getInterviewSession, getRecordingAudioUrl,
} from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { AnswerConsole, type AnswerPhase, TargetWindow } from '../components/interview/AnswerConsole';
import { formatClock, practisedLabel, WINDOW_FIT_LABEL, windowFit } from '../services/interviewText';
import type { InterviewSession } from '../types/interviewSession';
import type { PracticeRecording, RecordingAnalysis } from '../types/recording';
import { useShortcuts } from '../hooks/useShortcuts';
import { INTERVIEW_SHORTCUTS } from '../services/shortcuts';
import { LoadingState } from '../components/common/States';
import { Detail, Eyebrow, PageHead, Panel, Pill } from '../components/ui/primitives';
import { usePb } from '../theme/usePb';

/** The studio's column: the prototype centres the round in 810 pixels. */
const STUDIO = { maxWidth: 810, mx: 'auto', px: '16px', pt: '36px', pb: '64px' } as const;

/**
 * An interview session, as its own screen.
 *
 * One question at a time: think, answer, and the answer is saved and analysed.
 * Every answer is saved as it is given, so a reload comes back to the first
 * question without one, and ending early keeps everything said so far.
 *
 * While an answer is in progress nothing else on the screen can be pressed --
 * moving to another question mid-answer would throw the take away.
 */

interface Saved {
  recording: PracticeRecording;
  analysis: RecordingAnalysis | null;
  analysing: boolean;
  error: string | null;
}

const pct = (v?: number | null) => (v == null ? null : `${Math.round(v)}%`);

export const InterviewSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sid = Number(sessionId);
  const navigate = useNavigate();

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [phase, setPhase] = useState<AnswerPhase>('ready');
  const t = usePb();

  const refresh = useCallback(() => getInterviewSession(sid).then((s) => { setSession(s); return s; }), [sid]);

  useEffect(() => {
    setLoadError(null);
    refresh()
      .then((s) => {
        // Resume at the first question with no answer yet.
        const next = s.questions.findIndex((q) => q.takes.length === 0);
        setIndex(next === -1 ? s.questions.length : next);
      })
      .catch((err) => setLoadError(loadFailed('Could not load this session', err)));
  }, [refresh, loadAttempt]);

  const end = useCallback(async () => {
    setEnding(true);
    try {
      await finishInterviewSession(sid);
      navigate(`/interview-practice/sessions/${sid}/report`);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not end the session.'));
      setEnding(false);
      setConfirmEnd(false);
    }
  }, [sid, navigate]);

  // Esc ends the session, as the prototype has it -- but never mid-answer.
  useShortcuts([{
    shortcut: INTERVIEW_SHORTCUTS.end,
    run: () => { if (!busy && !confirmEnd) setConfirmEnd(true); },
  }]);

  const onSaved = useCallback(async (recording: PracticeRecording) => {
    setSaved({ recording, analysis: null, analysing: true, error: null });
    refresh().catch(() => {});
    try {
      const analysis = await analyzeRecording(recording.id);
      setSaved((cur) => (cur && cur.recording.id === recording.id ? { ...cur, analysis, analysing: false } : cur));
      refresh().catch(() => {});
    } catch (err) {
      setSaved((cur) => (cur && cur.recording.id === recording.id
        ? { ...cur, analysing: false, error: apiErrorMessage(err, 'The analysis did not run. The answer is saved.') }
        : cur));
    }
  }, [refresh]);

  const goTo = (i: number) => {
    setSaved(null);
    setIndex(i);
    setAttempt((a) => a + 1);
  };

  if (loadError && !session) {
    // Answers already given are saved with each take, so leaving loses nothing.
    return (
      <Box sx={STUDIO}>
      <Alert
        severity="error"
        action={(
          <Stack direction="row" sx={{ gap: 1 }}>
            <Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button>
            <Button color="inherit" size="small" onClick={() => navigate('/interview-practice')}>Leave</Button>
          </Stack>
        )}
      >
        {loadError}
      </Alert>
      </Box>
    );
  }
  if (!session) return <Box sx={STUDIO}><LoadingState label="Loading this session…" /></Box>;

  const total = session.questions.length;
  const question = index < total ? session.questions[index] : null;
  const unanswered = session.questions.filter((q) => q.takes.length === 0).length;
  const nextUnanswered = session.questions.findIndex((q, i) => i > index && q.takes.length === 0);

  if (session.ended_at) {
    return (
      <Box sx={STUDIO}>
        <PageHead
          eyebrow={`Interview practice · ${session.round_label}`}
          title="This session has ended"
          sub="Its answers are kept. Start another session to practise again."
          actions={(
            <>
              <Button component={RouterLink} to="/interview-practice/setup" variant="outlined">New session</Button>
              <Button component={RouterLink} to={`/interview-practice/sessions/${sid}/report`} variant="contained" color="ink">
                Session report
              </Button>
            </>
          )}
        />
      </Box>
    );
  }

  const takeSeconds = saved?.recording.duration_seconds ?? 0;
  const recording = phase === 'answering';

  return (
    <>
      {/* The prototype's studio bar: while a round is live it is the whole
          header -- what is happening, which question, and the way out. */}
      <Box
        component="header"
        sx={{
          position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: '14px',
          minHeight: 60, px: '25px', py: '8px', flexWrap: 'wrap',
          bgcolor: alpha(t.surface, 0.96), backdropFilter: 'blur(14px)',
          borderBottom: '1px solid', borderColor: 'divider',
          '@media (max-width:760px)': { px: '13px', gap: '8px' },
        }}
      >
        <Pill tone={recording ? 'danger' : 'accent'} sx={{ fontSize: (t) => t.typography.pxToRem(12), p: '6px 12px' }}>
          {recording ? '● Recording' : '● Interview session'}
        </Pill>
        <Box component="b" sx={{ fontWeight: 750 }}>{session.round_label}</Box>
        <Detail component="span" sx={{ fontSize: (t) => t.typography.pxToRem(13) }}>
          {question ? `Question ${index + 1} of ${total}` : `${total} of ${total} answered`}
        </Detail>
        <Stack direction="row" component="nav" sx={{ alignItems: 'center', gap: '6px' }} aria-label="Questions in this session">
          {session.questions.map((q, i) => (
            <Box
              key={q.id}
              component="button"
              type="button"
              disabled={busy}
              onClick={() => goTo(i)}
              aria-label={`Question ${i + 1}, ${q.takes.length ? 'answered' : 'not answered'}${i === index ? ', current' : ''}`}
              aria-current={i === index ? 'step' : undefined}
              sx={{
                width: 26, height: 26, borderRadius: '50%', border: '2px solid', font: 'inherit', fontSize: (t) => t.typography.pxToRem(11), fontWeight: 750,
                cursor: busy ? 'default' : 'pointer', p: 0,
                borderColor: i === index ? 'primary.main' : 'divider',
                bgcolor: q.takes.length ? 'pb.successSoft' : 'background.paper',
                color: q.takes.length ? 'pb.success' : 'text.secondary',
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
              }}
            >
              {i + 1}
            </Box>
          ))}
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          color="error"
          disabled={busy}
          onClick={() => setConfirmEnd(true)}
          endIcon={<X size={15} />}
        >
          End session
        </Button>
      </Box>

      <Box sx={STUDIO}>
        {loadError && <Alert severity="error" sx={{ mb: '14px' }}>{loadError}</Alert>}

        {question ? (
          <>
            {/* The prompter: the question, and what a good answer to it looks like. */}
            <Panel
              component="section"
              aria-labelledby="iv-question"
              sx={{ borderLeft: '4px solid', borderLeftColor: 'primary.main', p: '26px 30px', '@media (max-width:760px)': { p: '20px' } }}
            >
              <Eyebrow color="primary.main">
                {[session.round_label, question.category].filter(Boolean).join(' · ')}
              </Eyebrow>
              <Typography
                id="iv-question"
                component="h1"
                sx={{ fontSize: (t) => t.typography.pxToRem(26), fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.02em', mt: '12px', overflowWrap: 'break-word' }}
              >
                “{question.question_text}”
              </Typography>
              <Detail sx={{ mt: '12px' }}>
                {session.target_max_seconds > 0 && (
                  <>
                    Target answer{' '}
                    <Box component="b" sx={{ color: 'text.primary' }}>
                      {formatClock(session.target_min_seconds)}–{formatClock(session.target_max_seconds)}
                    </Box>
                    {' · '}
                  </>
                )}
                {practisedLabel(question.practice_count)}
              </Detail>
            </Panel>

            {!saved && (
              <AnswerConsole
                key={`${question.id}-${attempt}`}
                questionId={question.id}
                round={{
                  label: session.round_label,
                  target_min_seconds: session.target_min_seconds,
                  target_max_seconds: session.target_max_seconds,
                  plan_prompt: session.plan_prompt,
                  listening_for: session.listening_for,
                }}
                thinkingSeconds={session.thinking_seconds}
                title={`${session.round_label}: ${question.question_text.slice(0, 60)}`}
                sessionId={session.id}
                onSaved={onSaved}
                onBusyChange={setBusy}
                onPhaseChange={setPhase}
              />
            )}

            {saved && (
              <Panel component="section" aria-label="Your answer" sx={{ mt: '22px', p: '26px 30px', '@media (max-width:760px)': { p: '20px' } }}>
                <Eyebrow color="pb.success">
                  Saved · {formatClock(takeSeconds)} · {WINDOW_FIT_LABEL[windowFit(takeSeconds, session.target_min_seconds, session.target_max_seconds)]}
                </Eyebrow>
                <Box sx={{ mt: '12px', mb: '16px' }}>
                  <TargetWindow seconds={takeSeconds} min={session.target_min_seconds} max={session.target_max_seconds} />
                </Box>
                <Box component="audio" controls src={getRecordingAudioUrl(saved.recording.id)} sx={{ display: 'block', width: '100%' }} />

                <Box sx={{ mt: '16px' }} aria-live="polite">
                  {saved.analysing && (
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Analysing your answer. You can move on; it keeps going.
                      </Typography>
                    </Stack>
                  )}
                  {saved.error && <Alert severity="warning">{saved.error}</Alert>}
                  {saved.analysis?.analysis_status === 'analyzed' && (
                    <Typography sx={{ fontSize: (t) => t.typography.pxToRem(22), fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {pct(avg(saved.analysis.content_scores)) ? `Content ${pct(avg(saved.analysis.content_scores))} · ` : ''}
                      Delivery {pct(avg(saved.analysis.communication_scores)) ?? 'not graded'}
                    </Typography>
                  )}
                  {saved.analysis && saved.analysis.analysis_status !== 'analyzed' && (
                    <Alert severity="info">
                      <strong>Not graded.</strong>{' '}
                      {saved.analysis.analysis_status === 'unavailable'
                        ? 'No AI provider that can analyse audio is set up, so this answer is saved without feedback. Add one in Settings after the session, then analyse it from Recordings.'
                        : `The analysis failed: ${saved.analysis.analysis_error ?? 'no reason given'}. The answer is saved; you can run it again later.`}
                    </Alert>
                  )}
                </Box>

                <Stack direction="row" sx={{ gap: '10px', mt: '22px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {nextUnanswered !== -1 ? (
                    <Button variant="contained" onClick={() => goTo(nextUnanswered)}>
                      Next question
                    </Button>
                  ) : index + 1 < total ? (
                    <Button variant="contained" onClick={() => goTo(index + 1)}>
                      Next question
                    </Button>
                  ) : (
                    <Button variant="contained" disabled={ending} onClick={end}>
                      {ending ? 'Finishing…' : 'Finish session'}
                    </Button>
                  )}
                  <Button variant="outlined" onClick={() => goTo(index)}>
                    Retake it
                  </Button>
                </Stack>
              </Panel>
            )}
          </>
        ) : (
          <Panel component="section" aria-labelledby="iv-done" sx={{ p: '26px 30px' }}>
            <Typography id="iv-done" variant="h5" component="h1">Every question has an answer</Typography>
            <Detail sx={{ mt: '8px' }}>
              Retake any of them from the numbers above, or finish to see the report.
            </Detail>
            <Button variant="contained" disabled={ending} onClick={end} sx={{ mt: '18px' }}>
              {ending ? 'Finishing…' : 'Finish session'}
            </Button>
          </Panel>
        )}
      </Box>

      <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)} maxWidth="xs" fullWidth>
        <DialogTitle>End the session?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {unanswered > 0
              ? `${unanswered} question${unanswered === 1 ? ' has' : 's have'} no answer. `
              : ''}
            Everything you have said is kept.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmEnd(false)}>Keep going</Button>
          <Button variant="contained" color="ink" disabled={ending} onClick={end}>End session</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/** Average of graded categories, 0-100; null when none were graded. */
function avg(scores: { score: number; max_score: number }[]): number | null {
  const valid = scores.filter((s) => s.max_score > 0);
  if (!valid.length) return null;
  return valid.reduce((sum, s) => sum + (s.score / s.max_score) * 100, 0) / valid.length;
}
