// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Switch, Typography } from '@mui/material';
import { getSettings, updateSettings } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import { SettingsRow, SettingsSection, SettingsSubpage } from '../../components/settings/SettingsSubpage';
import type { AppSettings, NotificationTrigger } from '../../types/settings';

/**
 * What raises a notification, each one switchable.
 *
 * Only things that change what you should do next. Every notification is worked
 * out from your evidence when you look, and clears itself when the thing is
 * done. There is no desktop delivery, digest or quiet hours: nothing runs in the
 * background to deliver them, and a setting for a delivery that never happens
 * would be a promise the app cannot keep.
 */
const TRIGGERS: { key: NotificationTrigger; label: string; detail: string }[] = [
  { key: 'review_due', label: 'Reviews waiting', detail: 'Misses from your mocks not yet reviewed, and questions due on the review schedule.' },
  { key: 'mock_below_pass', label: 'Mock below the pass mark', detail: 'Your latest full mock came in under the pass mark.' },
  { key: 'evidence_stale', label: 'Readiness out of date', detail: 'Your last mock is too old for readiness to count it.' },
  { key: 'roadmap_slipping', label: 'Roadmap finishing after the exam', detail: "At your weekly hours, a roadmap is projected to finish after the preparation's exam date." },
  { key: 'import_unreviewed', label: 'Imported questions not reviewed', detail: 'Questions added in the last 30 days that have sat unreviewed for more than two days.' },
];

export const NotificationSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<NotificationTrigger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getSettings()
      .then((s) => { if (!cancelled) setSettings(s); })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your notification settings.')); });
    return () => { cancelled = true; };
  }, [attempt]);

  // Switched at once, and put back if the server refuses: a switch that waits
  // for the round trip reads as one that did not take the click.
  const setTrigger = (key: NotificationTrigger, on: boolean) =>
    setSettings((s) => (s ? { ...s, notification_triggers: { ...s.notification_triggers, [key]: on } } : s));

  const toggle = async (key: NotificationTrigger, on: boolean) => {
    setSaving(key);
    setError(null);
    setTrigger(key, on);
    try {
      setSettings(await updateSettings({ notification_triggers: { [key]: on } }));
    } catch (err) {
      setTrigger(key, !on);
      setError(apiErrorMessage(err, 'Not saved, so that notification is as it was.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <SettingsSubpage
      title="Notifications"
      description="A notification should change what you do next. If it cannot, it should not exist."
      actions={<Button component={RouterLink} to="/notifications" variant="outlined">View notifications</Button>}
    >
      {loadError && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}>
          {loadError}
        </Alert>
      )}
      {!settings && !loadError && <CircularProgress aria-label="Loading notification settings" />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {settings && (
        <>
          <SettingsSection title="What raises one">
            {TRIGGERS.map((t) => (
              <SettingsRow
                key={t.key}
                label={t.label}
                detail={t.detail}
                control={(
                  <Switch
                    checked={!!settings.notification_triggers?.[t.key]}
                    disabled={saving === t.key}
                    onChange={(e) => toggle(t.key, e.target.checked)}
                    slotProps={{ input: { 'aria-label': t.label } }}
                  />
                )}
              />
            ))}
          </SettingsSection>

          <SettingsSection title="Where they appear">
            <SettingsRow
              label="In the app"
              detail="A count on the bell in the header, and the list behind it. Nothing is sent anywhere."
            />
          </SettingsSection>

          <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>No streaks, no nudges</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Streaks reward opening the app, not learning, and punish the rest day spaced repetition
              depends on. Nothing due means no notification. That is the system working, not a missed day.
            </Typography>
          </Box>
        </>
      )}
    </SettingsSubpage>
  );
};
