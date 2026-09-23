// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState } from 'react';
import {
  Alert, Box, CircularProgress, Stack, Switch, Typography,
} from '@mui/material';
import { SettingsRow, SettingsSection, SettingsSubpage } from '../../components/settings/SettingsSubpage';
import { usePreferences } from '../../hooks/usePreferences';
import { apiErrorMessage } from '../../services/apiError';
import { SHORTCUT_GROUPS } from '../../services/shortcuts';
import { ErrorState } from '../../components/common/States';

/**
 * The shortcuts that exist, from the same definitions the screens bind.
 *
 * No global search shortcut and no rebinding: neither exists, and a reference
 * listing keys that do nothing would teach the learner to stop trusting it.
 */
const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="kbd"
    sx={{
      display: 'inline-block', minWidth: 26, px: 0.75, py: 0.25, textAlign: 'center',
      fontFamily: 'inherit', fontSize: (t) => t.typography.pxToRem(12.8), fontWeight: 600,
      border: '1px solid', borderColor: 'divider', borderBottomWidth: 2, borderRadius: 1,
      bgcolor: 'action.hover',
    }}
  >
    {children}
  </Box>
);

export const ShortcutsSettingsPage: React.FC = () => {
  const { shortcutsEnabled, updatePreferences, preferencesStatus, reloadPreferences } = usePreferences();
  const [error, setError] = useState<string | null>(null);

  const toggle = (on: boolean) => {
    setError(null);
    updatePreferences({ shortcutsEnabled: on })
      .catch((err) => setError(apiErrorMessage(err, 'Not saved, so shortcuts are as they were.')));
  };

  return (
    <SettingsSubpage
      title="Keyboard shortcuts"
      description="Answering, flagging and grading from the keyboard. They never act while you are typing, and a focused button keeps its own Space and Enter."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {preferencesStatus === 'failed' && (
        <Box sx={{ mb: 2 }}>
          <ErrorState what="Could not read whether shortcuts are on" saved="nothing_to_save" onRetry={reloadPreferences} />
        </Box>
      )}

      <SettingsSection title="Options">
        <SettingsRow
          label="Enable shortcuts"
          detail="Turn off if they get in the way of a screen reader or a browser extension."
          control={preferencesStatus === 'ready' ? (
            <Switch
              checked={shortcutsEnabled}
              onChange={(e) => toggle(e.target.checked)}
              slotProps={{ input: { 'aria-label': 'Enable keyboard shortcuts' } }}
            />
          ) : preferencesStatus === 'loading' ? (
            // A switch drawn on or off before the setting is read claims one of them.
            <CircularProgress size={18} aria-label="Reading whether shortcuts are on" />
          ) : (
            <Typography variant="body2" color="text.secondary">Unknown</Typography>
          )}
        />
      </SettingsSection>

      {SHORTCUT_GROUPS.map((group) => (
        <SettingsSection key={group.title} title={group.title} hint={group.where}>
          {group.items.map((item) => (
            <Stack
              key={item.label}
              direction="row"
              sx={{ px: 2, py: 1.25, justifyContent: 'space-between', alignItems: 'center', gap: 2, opacity: shortcutsEnabled ? 1 : 0.6 }}
            >
              <Typography variant="body2">{item.label}</Typography>
              <Stack direction="row" sx={{ gap: 0.5, flexShrink: 0 }} aria-label={`Keys: ${item.keys.join(' ')}`}>
                {item.keys.map((k) => (k === '…'
                  ? <Typography key={k} variant="body2" component="span" sx={{ px: 0.25 }}>to</Typography>
                  : <Key key={k}>{k}</Key>))}
              </Stack>
            </Stack>
          ))}
        </SettingsSection>
      ))}
    </SettingsSubpage>
  );
};
