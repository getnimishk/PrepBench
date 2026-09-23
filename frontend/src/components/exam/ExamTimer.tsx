// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState, useRef } from 'react';
import { Pill } from '../ui/primitives';
import { remainingSeconds } from '../../services/examClock';

interface ExamTimerProps {
  startTime?: string;
  timeAllowedSeconds?: number;
  onTimeUp?: () => void;
  /** Settings' "Timer sound alert (under 5 min)". */
  soundEnabled?: boolean;
}

/** When the alert fires. Named because Settings promises this number. */
const WARNING_SECONDS = 300;

/**
 * Two short tones, five minutes out.
 *
 * Synthesised rather than loaded from a file: this application is meant to
 * work with the network unplugged, and an asset that fails to fetch is a
 * setting that silently stops working -- which is the defect this exists to
 * fix. Settings has carried a "Timer sound alert (under 5 min)" switch since
 * before this function existed; nothing read it, so the control's only effect
 * was to be saved. Six other settings had already been removed for exactly
 * that, and this one was left because the job is real: in a 60-minute paper
 * people tunnel on the question and the on-screen clock stops being seen.
 *
 * Everything here is best-effort. A browser that refuses to make noise is not
 * a reason to interrupt an exam.
 */
function playTimeWarning(): void {
  try {
    const Ctx = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (at: number, hz: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      // Ramped rather than switched: an abrupt gate on a sine wave clicks.
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.25);
    };
    beep(0, 880);
    beep(0.28, 660);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* no audio available; the clock has already turned red */
  }
}



const computeRemainingSeconds = remainingSeconds;

export const ExamTimer: React.FC<ExamTimerProps> = ({
  startTime, timeAllowedSeconds, onTimeUp, soundEnabled = false,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number | undefined>(() =>
    computeRemainingSeconds(startTime, timeAllowedSeconds)
  );

  const hasTriggeredTimeUp = useRef(false);
  const hasWarned = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  const soundRef = useRef(soundEnabled);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    const remaining = computeRemainingSeconds(startTime, timeAllowedSeconds);
    setSecondsLeft(remaining);
    hasTriggeredTimeUp.current = false;
    // Already inside the window on load -- reopening a paper with four minutes
    // left should not sound an alert about a warning that has passed.
    hasWarned.current = remaining !== undefined && remaining <= WARNING_SECONDS;

    if (remaining === undefined) return;

    const interval = setInterval(() => {
      const currentRemaining = computeRemainingSeconds(startTime, timeAllowedSeconds);
      setSecondsLeft(currentRemaining);

      if (
        currentRemaining !== undefined
        && currentRemaining <= WARNING_SECONDS
        && currentRemaining > 0
        && !hasWarned.current
      ) {
        hasWarned.current = true;
        if (soundRef.current) playTimeWarning();
      }

      if (currentRemaining !== undefined && currentRemaining <= 0) {
        clearInterval(interval);
        if (!hasTriggeredTimeUp.current) {
          hasTriggeredTimeUp.current = true;
          onTimeUpRef.current?.();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, timeAllowedSeconds]);

  if (secondsLeft === undefined) {
    return <Pill>Unlimited Time</Pill>;
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isWarning = secondsLeft < WARNING_SECONDS;

  // The prototype's clock: an accent pill, "12:04 left" -- red for the last
  // five minutes.
  return (
    <Pill
      tone={isWarning ? 'danger' : 'accent'}
      sx={{ fontSize: (t) => t.typography.pxToRem(13), p: '6px 10px', fontVariantNumeric: 'tabular-nums' }}
    >
      {`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} left`}
    </Pill>
  );
};
