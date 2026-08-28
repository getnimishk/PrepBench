// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState, useRef } from 'react';
import { Box, Chip } from '@mui/material';
import { Timer } from 'lucide-react';

interface ExamTimerProps {
  startTime?: string;
  timeAllowedSeconds?: number;
  onTimeUp?: () => void;
}



const computeRemainingSeconds = (startISO?: string, allowedSecs?: number): number | undefined => {
  if (!allowedSecs || allowedSecs <= 0) return undefined;
  if (!startISO) return allowedSecs;

  let iso = startISO.trim();
  if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso += 'Z';
  }

  const startMs = new Date(iso).getTime();
  if (isNaN(startMs)) return allowedSecs;

  const nowMs = Date.now();
  const elapsedSecs = Math.floor((nowMs - startMs) / 1000);
  const remaining = allowedSecs - elapsedSecs;
  return remaining > 0 ? remaining : 0;
};

export const ExamTimer: React.FC<ExamTimerProps> = ({ startTime, timeAllowedSeconds, onTimeUp }) => {
  const [secondsLeft, setSecondsLeft] = useState<number | undefined>(() =>
    computeRemainingSeconds(startTime, timeAllowedSeconds)
  );

  const hasTriggeredTimeUp = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    const remaining = computeRemainingSeconds(startTime, timeAllowedSeconds);
    setSecondsLeft(remaining);
    hasTriggeredTimeUp.current = false;

    if (remaining === undefined) return;

    const interval = setInterval(() => {
      const currentRemaining = computeRemainingSeconds(startTime, timeAllowedSeconds);
      setSecondsLeft(currentRemaining);

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
    return (
      <Chip
        icon={<Timer size={16} />}
        label="Unlimited Time"
        sx={{
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
          color: 'primary.main',
          fontWeight: 600,
        }}
      />
    );
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isWarning = secondsLeft < 300; // Less than 5 minutes remaining

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip
        icon={<Timer size={16} />}
        label={`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
        sx={{
          fontWeight: 800,
          fontSize: '1.05rem',
          px: 1,
          bgcolor: isWarning ? 'error.light' : 'action.hover',
          border: '1px solid',
          borderColor: isWarning ? 'error.main' : 'divider',
          color: isWarning ? 'error.contrastText' : 'primary.main',
          boxShadow: 'none',
        }}
      />
    </Box>
  );
};
