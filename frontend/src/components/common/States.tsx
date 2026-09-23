// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { CheckCircle2, CloudOff, HardDrive, Loader2, TriangleAlert } from 'lucide-react';

/**
 * The states every data-driven screen has to handle, built once.
 *
 * Each one carries the question the learner has at that moment, and will not
 * render without its answer:
 *
 *   loading  what is being fetched -- and nothing pretending to be the result
 *   empty    why it is empty, and what to do about it
 *   error    what failed, whether anything was saved, and a way on
 *   saving   where the work is: saved, waiting, or not saved
 */

/** Something is being fetched. Never a placeholder that looks like data. */
export const LoadingState: React.FC<{ label: string }> = ({ label }) => (
  <Stack role="status" direction="row" sx={{ alignItems: 'center', gap: 1.5, py: 4, justifyContent: 'center' }}>
    <CircularProgress size={20} aria-hidden />
    <Typography variant="body2" color="text.secondary">{label}</Typography>
  </Stack>
);

/** Nothing to show: why, and the way forward. */
export const EmptyState: React.FC<{
  title: string;
  /** Why there is nothing here. */
  why: string;
  /** What the learner can do next, when there is something. */
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, why, action, icon }) => (
  <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
    {icon && <Box sx={{ color: 'text.disabled', display: 'flex', justifyContent: 'center', mb: 1.5 }} aria-hidden>{icon}</Box>}
    <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 440, mx: 'auto', lineHeight: 1.6 }}>
      {why}
    </Typography>
    {action && <Box sx={{ mt: 2 }}>{action}</Box>}
  </Box>
);

const SAVED_SENTENCE = {
  saved: 'Your work is saved.',
  not_saved: 'This was not saved.',
  nothing_to_save: 'Nothing was changed.',
} as const;

/** Something failed: what, whether anything was saved, and how to go on. */
export const ErrorState: React.FC<{
  /** What failed, in the learner's terms. */
  what: string;
  saved: keyof typeof SAVED_SENTENCE;
  detail?: string;
  onRetry?: () => void;
  /** Another way on when retrying will not help. */
  recovery?: React.ReactNode;
}> = ({ what, saved, detail, onRetry, recovery }) => (
  <Alert
    severity="error"
    icon={<TriangleAlert size={20} />}
    action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : undefined}
  >
    <Typography variant="body2" sx={{ fontWeight: 600 }}>{what}</Typography>
    <Typography variant="body2">
      {SAVED_SENTENCE[saved]}{detail ? ` ${detail}` : ''}
    </Typography>
    {recovery && <Box sx={{ mt: 1 }}>{recovery}</Box>}
  </Alert>
);

export type SaveState = 'saved_locally' | 'pending_sync' | 'offline' | 'synced' | 'sync_failed';

const SAVE_STATES: Record<SaveState, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  saved_locally: { label: 'Saved on this device', tone: 'text.secondary', Icon: HardDrive },
  pending_sync: { label: 'Saving…', tone: 'text.secondary', Icon: Loader2 },
  offline: { label: 'Offline: not saved yet', tone: 'warning.main', Icon: CloudOff },
  synced: { label: 'Saved', tone: 'success.main', Icon: CheckCircle2 },
  sync_failed: { label: 'Not saved', tone: 'error.main', Icon: TriangleAlert },
};

/**
 * Where a piece of work is. Colour is never the only signal: every state has
 * its own words and its own icon.
 */
export const SaveStatus: React.FC<{ state: SaveState; detail?: string }> = ({ state, detail }) => {
  const { label, tone, Icon } = SAVE_STATES[state];
  return (
    <Stack role="status" direction="row" sx={{ alignItems: 'center', gap: 0.75, color: tone }}>
      <Icon size={16} aria-hidden />
      <Typography variant="body2" sx={{ color: 'inherit' }}>
        {label}{detail ? ` · ${detail}` : ''}
      </Typography>
    </Stack>
  );
};
