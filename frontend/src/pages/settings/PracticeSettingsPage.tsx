// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Switch, TextField, Typography,
} from '@mui/material';
import { getReviewScheduleRules, getSettings, updateSettings } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import { SettingsRow, SettingsSection, SettingsSubpage } from '../../components/settings/SettingsSubpage';
import type { AppSettings } from '../../types/settings';
import type { ReviewScheduleRules } from '../../types/system';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * How practice behaves, as far as it is anyone's choice.
 *
 * The prototype offered session defaults -- question count, mode, when to show
 * explanations, option shuffling -- and an editable SM-2. Neither is here. A
 * mock takes its shape from the exam profile because the real exam does not
 * let you choose, and a drill from the screen it is started on; the review
 * schedule's numbers are the engine's, so they are explained, not offered as
 * dials that would change nothing.
 */
export const PracticeSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cap, setCap] = useState('20');
  const [role, setRole] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rules, setRules] = useState<ReviewScheduleRules | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getSettings()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setCap(String(s.review_daily_cap));
        setRole(s.default_target_role ?? '');
      })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your practice preferences.')); });
    getReviewScheduleRules().then((r) => { if (!cancelled) setRules(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [attempt]);

  const capNumber = Number.parseInt(cap, 10);
  const capValid = Number.isInteger(capNumber) && capNumber >= 1 && capNumber <= 200;
  const dirty = !!settings && (capNumber !== settings.review_daily_cap || (role.trim() || null) !== settings.default_target_role);

  const save = async (changes: Partial<AppSettings>) => {
    setSaving(true);
    setStatus(null);
    try {
      const updated = await updateSettings(changes);
      setSettings(updated);
      setCap(String(updated.review_daily_cap));
      setRole(updated.default_target_role ?? '');
      setStatus({ kind: 'saved', message: 'Saved.' });
    } catch (err) {
      setStatus({ kind: 'error', message: apiErrorMessage(err, 'Not saved. Your previous preferences are unchanged.') });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <SettingsSubpage title="Practice preferences" description="How practice behaves.">
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}>
          {loadError}
        </Alert>
      </SettingsSubpage>
    );
  }
  if (!settings) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress aria-label="Loading practice preferences" /></Box>;
  }

  return (
    <SettingsSubpage
      title="Practice preferences"
      description="A full mock takes its shape from the preparation's exam profile, and a drill from the screen you start it on. What is left to choose is here."
      actions={(
        <Button
          variant="contained"

          disabled={!dirty || !capValid || saving}
          onClick={() => save({ review_daily_cap: capNumber, default_target_role: role.trim() || null })}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}
    >
      {status && (
        <Alert severity={status.kind === 'saved' ? 'success' : 'error'} sx={{ mb: 2 }} role={status.kind === 'saved' ? 'status' : 'alert'}>
          {status.message}
        </Alert>
      )}

      <SettingsSection title="Review">
        <SettingsRow
          label="Daily review cap"
          detail="The most due reviews a single day's goal asks for. Anything beyond it waits for tomorrow rather than being dropped."
          control={(
            <TextField
              type="number"
              size="small"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              error={!capValid}
              helperText={capValid ? ' ' : 'Between 1 and 200'}
              slotProps={{ htmlInput: { min: 1, max: 200, 'aria-label': 'Daily review cap' } }}
              sx={{ width: 140 }}
            />
          )}
        />
        <SettingsRow
          label="How the review schedule works"
          detail={rules ? (
            <>
              {rules.algorithm}. A question recalled well comes back after {days(rules.first_interval_days)},
              then {days(rules.second_interval_days)}, then at a growing interval. A failed recall starts it
              over. Reading an explanation never moves it; only a recall does. These numbers are the
              engine&apos;s, not preferences.
            </>
          ) : 'Loading…'}
        />
      </SettingsSection>

      <SettingsSection title="Exams">
        <SettingsRow
          label="Timer sound"
          detail="A sound when a timed paper has five minutes left."
          control={(
            <Switch
              checked={settings.timer_sound_enabled}
              disabled={saving}
              onChange={(e) => save({ timer_sound_enabled: e.target.checked })}
              slotProps={{ input: { 'aria-label': 'Timer sound under five minutes' } }}
            />
          )}
        />
        <SettingsRow
          label="Keyboard shortcuts"
          detail={settings.shortcuts_enabled === false ? 'Off' : 'On in exams, spaced review and interview sessions'}
          control={<Button component={RouterLink} to="/settings/shortcuts" size="small">Open</Button>}
        />
      </SettingsSection>

      <SettingsSection title="System Design">
        <Box sx={{ px: 2, py: 1.5 }}>
          <TextField
            fullWidth
            label="Default target role"
            placeholder="e.g. Senior Backend Engineer, fintech"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Fills the target role when you start a System Design attempt, so feedback is calibrated to it.
            You can still change it per attempt.
          </Typography>
        </Box>
      </SettingsSection>
    </SettingsSubpage>
  );
};
