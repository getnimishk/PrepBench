// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControlLabel, Stack, Switch, TextField, Theme, Typography, alpha, useTheme,
} from '@mui/material';
import { Timer } from 'lucide-react';
import { Detail, Eyebrow, Panel, Section } from '../ui/primitives';
import { uploadRecording } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { formatClock, windowPrompt } from '../../services/interviewText';
import type { PracticeRecording } from '../../types/recording';
import { useShortcuts } from '../../hooks/useShortcuts';
import { INTERVIEW_SHORTCUTS } from '../../services/shortcuts';

/**
 * Answering one question: think, speak, stop, save.
 *
 * Shared by a single take and by an interview session, so the two cannot
 * drift into different ways of recording an answer. The guidance around it --
 * the target length, the shape to plan with, what the interviewer is listening
 * for -- comes from the round's rules on the server and is advice, not a score.
 *
 * A save that fails keeps the recording in memory and offers to try again. The
 * take is the learner's words; losing it to a network error, silently, would be
 * the worst thing this screen could do.
 */

export interface RoundGuide {
  label: string;
  target_min_seconds?: number;
  target_max_seconds?: number;
  plan_prompt?: string;
  listening_for?: string;
}

export type AnswerPhase = 'ready' | 'thinking' | 'answering' | 'saving' | 'failed';
type Phase = AnswerPhase;

/** The prototype's studio clock: large, monospaced, so the digits do not jump. */
const BIG_CLOCK = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: (t: Theme) => t.typography.pxToRem(46), fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', mt: '18px',
} as const;

/**
 * The studio's round button: the microphone ready, the clock while thinking, the
 * stop square while answering. A pointer target only -- the labelled buttons
 * below it are what a keyboard or a screen reader uses, so it is hidden from them.
 */
const StudioButton: React.FC<{ state: 'ready' | 'thinking' | 'recording'; onClick?: () => void }> = ({ state, onClick }) => {
  const recording = state === 'recording';
  return (
    <Box
      aria-hidden
      onClick={onClick}
      sx={{
        width: 104, height: 104, mx: 'auto', borderRadius: '50%', display: 'grid', placeItems: 'center',
        border: '2px solid', borderColor: recording ? 'error.main' : 'primary.main',
        bgcolor: recording ? 'pb.dangerSoft' : 'pb.accentSoft',
        color: recording ? 'error.main' : 'primary.main',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: (t) => (recording ? `0 0 0 8px ${alpha(t.palette.error.main, 0.08)}` : 'none'),
        transition: 'box-shadow .2s ease, border-color .2s ease',
      }}
    >
      {state === 'ready' && <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: 'primary.main' }} />}
      {state === 'thinking' && <Timer size={30} />}
      {recording && <Box sx={{ width: 28, height: 28, borderRadius: '3px', bgcolor: 'error.main' }} />}
    </Box>
  );
};

export const TargetWindow: React.FC<{ seconds: number; min: number; max: number }> = ({ seconds, min, max }) => {
  const theme = useTheme();
  const full = Math.max(max * 1.5, 1);
  return (
    <Box
      aria-hidden
      sx={{ position: 'relative', height: 8, borderRadius: 4, bgcolor: alpha(theme.palette.text.primary, 0.08), overflow: 'hidden' }}
    >
      <Box sx={{
        position: 'absolute', top: 0, bottom: 0, left: `${(min / full) * 100}%`,
        width: `${((max - min) / full) * 100}%`, bgcolor: alpha(theme.palette.success.main, 0.25),
      }}
      />
      <Box sx={{
        position: 'absolute', top: 0, bottom: 0, left: 0,
        width: `${Math.min(100, (seconds / full) * 100)}%`, bgcolor: 'primary.main', opacity: 0.8,
      }}
      />
    </Box>
  );
};

export const AnswerConsole: React.FC<{
  /** Null for "just talk": delivery only, nothing to grade content against. */
  questionId: number | null;
  round: RoundGuide | null;
  thinkingSeconds: number;
  title: string;
  sessionId?: number;
  preparedAnswer?: string | null;
  keyTalkingPoints?: string[] | null;
  onSaved: (recording: PracticeRecording) => void;
  /** True from thinking until the answer is saved, so the page around it can keep
   *  the learner from navigating away mid-answer and losing the take. */
  onBusyChange?: (busy: boolean) => void;
  /** Which step the answer is at, for a page that shows it elsewhere -- the
   *  studio bar says Recording while the microphone is on. */
  onPhaseChange?: (phase: AnswerPhase) => void;
}> = ({
  questionId, round, thinkingSeconds, title, sessionId,
  preparedAnswer, keyTalkingPoints,
  onSaved, onBusyChange, onPhaseChange,
}) => {
  const [phase, setPhase] = useState<Phase>('ready');
  useEffect(() => {
    onBusyChange?.(phase !== 'ready');
    onPhaseChange?.(phase);
  }, [phase, onBusyChange, onPhaseChange]);
  const [planNote, setPlanNote] = useState('');
  const [showCueCardDuringRecording, setShowCueCardDuringRecording] = useState(false);
  const [countdown, setCountdown] = useState(thinkingSeconds);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef<{ blob: Blob; seconds: number } | null>(null);

  const save = useCallback(async () => {
    const take = pending.current;
    if (!take) return;
    setPhase('saving');
    setSaveError(null);
    try {
      const recording = await uploadRecording(
        take.blob, title, take.seconds, questionId ?? undefined,
        { sessionId, planNote: planNote.trim() || undefined },
      );
      pending.current = null;
      onSaved(recording);
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Your answer was recorded but did not save.'));
      setPhase('failed');
    }
  }, [title, questionId, sessionId, planNote, onSaved]);

  const { isRecording, elapsed, recordError, start, stop } = useAudioRecorder((blob, seconds) => {
    pending.current = { blob, seconds };
    save();
  });

  // Through a ref, so the countdown's timer is not reset by every re-render
  // the recorder hook causes.
  const startRef = useRef(start);
  startRef.current = start;
  const answer = useCallback(async () => {
    await startRef.current();
  }, []);

  // The recorder decides when answering has really begun: a refused
  // microphone leaves the page on "ready" with the error, not on a timer.
  useEffect(() => {
    if (isRecording) setPhase('answering');
  }, [isRecording]);
  useEffect(() => {
    if (recordError) setPhase('ready');
  }, [recordError]);

  // Thinking time counts down, and answering starts on its own at zero.
  useEffect(() => {
    if (phase !== 'thinking') return undefined;
    if (countdown <= 0) {
      answer();
      return undefined;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, answer]);

  // Space starts and stops the answer, unless the learner is typing their plan.
  useShortcuts([{
    shortcut: INTERVIEW_SHORTCUTS.answer,
    run: () => {
      if (phase === 'ready' || phase === 'thinking') answer();
      else if (phase === 'answering') stop();
    },
  }]);

  const min = round?.target_min_seconds ?? 0;
  const max = round?.target_max_seconds ?? 0;
  const hasWindow = max > 0;

  return (
    <Box>
      <Panel component="section" aria-label="Answer" sx={{ mt: '22px', textAlign: 'center', py: '36px' }}>
        {phase === 'ready' && (
          <>
            <StudioButton state="ready" onClick={answer} />
            <Box sx={BIG_CLOCK}>{formatClock(0)}</Box>
            <Typography sx={{ color: 'text.secondary', fontWeight: 600, mt: '10px' }}>
              {thinkingSeconds > 0
                ? `Press to answer now, or take ${thinkingSeconds}s to think first`
                : 'Microphone ready · press to start your answer'}
            </Typography>
            {hasWindow && (
              <Detail sx={{ mt: '4px' }}>
                A good {round?.label.toLowerCase()} answer runs {formatClock(min)}–{formatClock(max)}.
              </Detail>
            )}
            <Stack direction="row" sx={{ gap: '10px', justifyContent: 'center', flexWrap: 'wrap', mt: '18px' }}>
              {thinkingSeconds > 0 && (
                <Button
                  variant="outlined"
                  onClick={() => { setCountdown(thinkingSeconds); setPhase('thinking'); }}
                >
                  Take {thinkingSeconds}s to think
                </Button>
              )}
              <Button variant="contained" onClick={answer}>
                Start answering
              </Button>
            </Stack>
            <Detail sx={{ mt: '14px' }}>Space starts the answer · Esc ends the session</Detail>
          </>
        )}

        {phase === 'thinking' && (
          <>
            <StudioButton state="thinking" />
            <Box aria-live="polite" sx={BIG_CLOCK}>{formatClock(countdown)}</Box>
            <Typography sx={{ color: 'text.secondary', fontWeight: 600, mt: '10px' }}>
              Thinking time · answering starts on its own when it runs out
            </Typography>
            <Box sx={{ maxWidth: 420, mx: 'auto', mt: '14px' }}>
              <TargetWindow seconds={thinkingSeconds - countdown} min={0} max={Math.max(thinkingSeconds / 1.5, 1)} />
            </Box>
            <Button variant="contained" onClick={answer} sx={{ mt: '18px' }}>
              Start answering now
            </Button>
          </>
        )}

        {phase === 'answering' && (
          <>
            <StudioButton state="recording" onClick={stop} />
            <Box sx={BIG_CLOCK}>{formatClock(elapsed)}</Box>
            {hasWindow && (
              <Box sx={{ maxWidth: 520, mx: 'auto', mt: '10px' }}>
                <Typography sx={{ color: 'text.secondary', fontWeight: 600, mb: '10px' }}>
                  {windowPrompt(elapsed, min, max)}
                </Typography>
                <TargetWindow seconds={elapsed} min={min} max={max} />
              </Box>
            )}
            <Button variant="contained" onClick={stop} sx={{ mt: '18px' }}>
              Stop answering
            </Button>
            <Detail sx={{ mt: '14px' }}>
              Space stops the answer{planNote.trim() ? ' · your plan is kept with the take' : ''}
            </Detail>
            {showCueCardDuringRecording && (preparedAnswer || (keyTalkingPoints && keyTalkingPoints.length > 0)) && (
              <Box sx={{ maxWidth: 560, mx: 'auto', mt: 3, textAlign: 'left', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block', mb: 0.75, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Cue Card · Reference Notes
                </Typography>
                {keyTalkingPoints && keyTalkingPoints.length > 0 && (
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                    {keyTalkingPoints.map((pt, i) => (
                      <Chip key={i} size="small" label={pt} color="primary" variant="outlined" sx={{ minHeight: 22, height: 'auto', fontSize: (t) => t.typography.pxToRem(12) }} />
                    ))}
                  </Stack>
                )}
                {preparedAnswer && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', display: 'block', maxHeight: 110, overflowY: 'auto', lineHeight: 1.5 }}>
                    {preparedAnswer}
                  </Typography>
                )}
              </Box>
            )}
          </>
        )}

        {phase === 'saving' && (
          <Stack sx={{ alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Saving your answer…</Typography>
          </Stack>
        )}

        {phase === 'failed' && (
          <Alert
            severity="error"
            sx={{ textAlign: 'left' }}
            action={<Button color="inherit" size="small" onClick={save}>Try saving again</Button>}
          >
            {saveError} It is still here — nothing has been lost yet.
          </Alert>
        )}

        {recordError && phase === 'ready' && (
          <Alert severity="error" sx={{ mt: 3, textAlign: 'left' }}>{recordError}</Alert>
        )}
      </Panel>

      {(phase === 'ready' || phase === 'thinking') && (
        <>
          {(preparedAnswer || (keyTalkingPoints && keyTalkingPoints.length > 0)) && (
            <Section>
              <Panel soft component="section" aria-label="Prepared notes">
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Eyebrow>Your prepared answer & key points</Eyebrow>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={showCueCardDuringRecording}
                        onChange={(e) => setShowCueCardDuringRecording(e.target.checked)}
                      />
                    }
                    label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Show notes while recording (Drill mode)</Typography>}
                  />
                </Stack>
                {keyTalkingPoints && keyTalkingPoints.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', display: 'block' }}>
                      Key points to hit ({keyTalkingPoints.length}):
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                      {keyTalkingPoints.map((pt, i) => (
                        <Chip key={i} size="small" label={pt} variant="filled" sx={{ bgcolor: 'action.selected', fontWeight: 500 }} />
                      ))}
                    </Stack>
                  </Box>
                )}
                {preparedAnswer && (
                  <Box sx={{ mt: 1.5, whiteSpace: 'pre-wrap', fontSize: (t) => t.typography.pxToRem(13.5), color: 'text.secondary', maxHeight: 200, overflowY: 'auto', lineHeight: 1.6 }}>
                    {preparedAnswer}
                  </Box>
                )}
              </Panel>
            </Section>
          )}

          <Section>
            <Panel soft>
              <Eyebrow>
                {phase === 'thinking' ? 'Your plan' : 'Your plan · optional'}
              </Eyebrow>
              <TextField
                id="answer-plan"
                multiline
                minRows={3}
                fullWidth
                value={planNote}
                onChange={(e) => setPlanNote(e.target.value)}
                placeholder={round?.plan_prompt || 'A few words on what you mean to say'}
                sx={{ mt: '8px' }}
                slotProps={{ htmlInput: { 'aria-label': 'Your plan' } }}
              />
              <Detail sx={{ mt: '8px' }}>
                Kept with the answer, so you can read what you meant beside what you said.
              </Detail>
            </Panel>
          </Section>
          {phase === 'ready' && round?.listening_for && (
            <Section>
              <Panel soft>
                <Eyebrow>What the interviewer is listening for</Eyebrow>
                <Detail sx={{ mt: '8px', lineHeight: 1.7 }}>{round.listening_for}</Detail>
              </Panel>
            </Section>
          )}
        </>
      )}

    </Box>
  );
};
