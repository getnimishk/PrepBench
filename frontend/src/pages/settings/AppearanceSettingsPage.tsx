// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState } from 'react';
import {
  Alert, Box, FormControlLabel, Radio, RadioGroup, Typography,
} from '@mui/material';
import { SettingsRow, SettingsSubpage } from '../../components/settings/SettingsSubpage';
import { useThemeMode } from '../../context/ThemeContext';
import { usePreferences } from '../../hooks/usePreferences';
import { apiErrorMessage } from '../../services/apiError';
import { ErrorState, LoadingState } from '../../components/common/States';
import { Detail, Eyebrow, Grid, Panel } from '../../components/ui/primitives';
import { TOKENS } from '../../theme/tokens';
import type { Preferences } from '../../context/ThemeContext';

/**
 * Visual preferences. Nothing here changes what is measured or recommended.
 *
 * Each choice applies the moment it is made and is saved with it. If the save
 * is refused, the choice is put back and the screen says so -- a theme that
 * looks applied and silently reverts on the next reload is worse than none.
 *
 * The prototype also draws an accent colour, a density switch and a numerals
 * row. None of them is a setting the app has, so none is drawn: a control that
 * changes nothing is a claim the screen cannot keep.
 */

/** Covering input pattern: covers the card so clicks and Playwright check() hit the radio. */
const visuallyHidden = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  margin: 0,
  padding: 0,
  cursor: 'pointer',
  zIndex: 1,
} as const;

const THEMES: { value: Preferences['theme']; label: string; swatch: string }[] = [
  { value: 'light', label: 'Light', swatch: TOKENS.light.bg },
  { value: 'dark', label: 'Dark', swatch: TOKENS.dark.bg },
  { value: 'system', label: 'System', swatch: `linear-gradient(105deg, ${TOKENS.light.bg} 50%, ${TOKENS.dark.bg} 50%)` },
];

export const AppearanceSettingsPage: React.FC = () => {
  const { mode } = useThemeMode();
  const { theme, textSize, reduceMotion, updatePreferences, preferencesStatus, reloadPreferences } = usePreferences();
  // Not offered as the setting until the setting has been read: a default shown
  // as if it were your choice is a claim about data the screen does not have.
  const ready = preferencesStatus === 'ready';
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null);

  const change = (changes: Partial<Preferences>) => {
    setStatus(null);
    updatePreferences(changes)
      .then(() => setStatus({ kind: 'saved', message: 'Saved.' }))
      .catch((err) => setStatus({ kind: 'error', message: apiErrorMessage(err, 'That change was not saved, so it has been undone.') }));
  };

  const current = THEMES.find((t) => t.value === theme);

  return (
    <SettingsSubpage
      title="Appearance"
      description="Visual preferences only. Nothing here changes what the app measures or recommends."
    >
      <Typography role="status" variant="body2" sx={{ minHeight: 20, mb: '4px', color: status?.kind === 'error' ? 'error.main' : 'text.secondary' }}>
        {status?.kind === 'saved' ? status.message : ''}
      </Typography>
      {status?.kind === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{status.message}</Alert>}
      {preferencesStatus === 'loading' && <LoadingState label="Reading your saved preferences…" />}
      {preferencesStatus === 'failed' && (
        <Box sx={{ mb: 2 }}>
          <ErrorState what="Could not read your saved preferences" saved="nothing_to_save" onRetry={reloadPreferences} />
        </Box>
      )}

      <Grid columns={2} sx={{ alignItems: 'start' }}>
        <Panel component="section" aria-label="Theme">
          <Eyebrow component="h2">Theme</Eyebrow>
          <Typography variant="h5" component="p" sx={{ mt: '4px' }}>{ready && current ? current.label : '—'}</Typography>
          <RadioGroup
            aria-label="Colour theme"
            value={ready ? theme : ''}
            onChange={(e) => change({ theme: e.target.value as Preferences['theme'] })}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px', mt: '14px' }}
          >
            {THEMES.map((t) => {
              const on = ready && theme === t.value;
              return (
                <FormControlLabel
                  key={t.value}
                  value={t.value}
                  disabled={!ready}
                  control={<Radio sx={visuallyHidden} />}
                  label={(
                    <Box component="span" sx={{ display: 'block' }}>
                      <Box
                        component="span"
                        aria-hidden
                        sx={{ display: 'block', height: 44, borderRadius: '7px', background: t.swatch, border: '1px solid', borderColor: 'divider' }}
                      />
                      <Box component="span" sx={{ display: 'block', mt: '8px', fontWeight: 750 }}>{t.label}</Box>
                    </Box>
                  )}
                  sx={{
                    position: 'relative',
                    m: 0, p: '12px', borderRadius: '11px', alignItems: 'stretch',
                    bgcolor: 'pb.surface2', border: on ? '2px solid' : '1px solid',
                    borderColor: on ? 'primary.main' : 'divider',
                    '& .MuiFormControlLabel-label': { width: '100%' },
                    '&:has(input:focus-visible)': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                />
              );
            })}
          </RadioGroup>
          <Detail sx={{ mt: '12px' }}>
            {!ready
              ? 'Light, dark, or whatever the system is set to.'
              : theme === 'system' ? `Follows your system setting, which is ${mode} right now.` : 'Stays the same whatever the system is set to.'}
          </Detail>
        </Panel>

        <Panel component="section" aria-label="Legibility and motion">
          <Eyebrow component="h2">Layout & legibility</Eyebrow>
          <SettingsRow
            label="Text size"
            detail="Scales the text across the whole interface."
            control={(
              <RadioGroup
                row
                aria-label="Text size"
                value={ready ? textSize : ''}
                onChange={(e) => change({ textSize: e.target.value as Preferences['textSize'] })}
              >
                <FormControlLabel value="standard" control={<Radio />} disabled={!ready} label="Standard" />
                <FormControlLabel value="large" control={<Radio />} disabled={!ready} label="Large" />
              </RadioGroup>
            )}
          />
          <SettingsRow
            label="Reduce motion"
            detail={!ready
              ? 'Animations and transitions, everywhere or only when the system asks.'
              : reduceMotion === 'always'
                ? 'Animations and transitions are off everywhere.'
                : 'Follows your system: off when it asks for reduced motion.'}
            control={(
              <RadioGroup
                row
                aria-label="Reduce motion"
                value={ready ? reduceMotion : ''}
                onChange={(e) => change({ reduceMotion: e.target.value as Preferences['reduceMotion'] })}
              >
                <FormControlLabel value="system" control={<Radio />} disabled={!ready} label="Follow system" />
                <FormControlLabel value="always" control={<Radio />} disabled={!ready} label="Always" />
              </RadioGroup>
            )}
          />
        </Panel>
      </Grid>
    </SettingsSubpage>
  );
};
