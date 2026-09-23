// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Stack, TextField, Typography,
} from '@mui/material';
import { User } from 'lucide-react';
import { getProfile, updateProfile } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { formatBytes } from '../services/format';
import { ErrorState, LoadingState } from '../components/common/States';
import { PROFILE_UPDATED, initialsOf } from '../hooks/useProfileName';
import {
  BigFigure, Detail, Eyebrow, Grid, Metric, PageHead, Panel, PanelHead, Section,
} from '../components/ui/primitives';
import type { Profile } from '../types/profile';

/**
 * Who is using this copy of PrepBench, and what they have done in it.
 *
 * There is no account. PrepBench runs on this computer for one person, so there
 * is nothing to sign in to or out of, and the prototype's Sign out is left out
 * rather than drawn as a button that does nothing. The name and email are what
 * this page and the header show. The numbers are counted from the practice
 * data each time the page opens, not kept on the side.
 *
 * The timezone is reported, not chosen: days, due dates and schedules follow
 * this computer's clock, and a picker none of them read would be decoration.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function offsetText(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `GMT${sign}${hours}${mins ? `:${String(mins).padStart(2, '0')}` : ''}`;
}

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    getProfile()
      .then((p) => {
        setProfile(p);
        setName(p.display_name ?? '');
        setEmail(p.email ?? '');
      })
      .catch((err) => setLoadError(apiErrorMessage(err, '')));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loadError !== null) {
    return (
      <Box sx={{ maxWidth: 820 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 2 }}>Profile</Typography>
        <ErrorState what="Could not load your profile" saved="nothing_to_save" detail={loadError || undefined} onRetry={load} />
      </Box>
    );
  }
  if (!profile) return <LoadingState label="Loading your profile…" />;

  const trimmedEmail = email.trim();
  const emailInvalid = trimmedEmail !== '' && !EMAIL.test(trimmedEmail);
  const changed = name.trim() !== (profile.display_name ?? '') || trimmedEmail !== (profile.email ?? '');
  const initials = initialsOf(profile.display_name);
  const { stats, storage, timezone } = profile;
  const since = stats.active_since
    ? new Date(`${stats.active_since}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const next = await updateProfile({ display_name: name, email });
      setProfile(next);
      setName(next.display_name ?? '');
      setEmail(next.email ?? '');
      setSaved(true);
      window.dispatchEvent(new Event(PROFILE_UPDATED));
    } catch (err) {
      setSaveError(`${apiErrorMessage(err, 'Could not save your profile.')} Nothing was saved.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHead
        eyebrow="Account"
        title="Profile"
        sub="PrepBench runs on this computer for one person, so there is no account to sign in to or out of. The name and email here are shown on this page and in the header, and are not sent anywhere."
      />

      <Section>
        <Grid columns={2} sx={{ alignItems: 'start' }}>
          <Panel component="section" aria-labelledby="identity-heading">
            <PanelHead eyebrow="Account" title="Identity" titleId="identity-heading" />
            <Stack direction="row" sx={{ gap: 2, alignItems: 'center', my: 2 }}>
              <Avatar sx={{ width: 56, height: 56, fontSize: (t) => t.typography.pxToRem(18), fontWeight: 700, bgcolor: 'pb.accentSoft', color: 'pb.accent' }}>
                {initials ?? <User size={26} aria-hidden />}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" component="p" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                  {profile.display_name ?? 'No name yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  {profile.email ?? 'No email'}
                </Typography>
              </Box>
            </Stack>

            <Stack sx={{ gap: 2 }}>
              <TextField
                label="Display name"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaved(false); }}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                helperText="Its initials are what the header shows."
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
                error={emailInvalid}
                helperText={emailInvalid ? 'That does not look like an email address.' : 'Optional.'}
                slotProps={{ htmlInput: { maxLength: 254 } }}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Timezone</Typography>
                <Typography variant="body2">
                  {timezone.name} ({offsetText(timezone.utc_offset_minutes)})
                </Typography>
                <Detail sx={{ mt: '2px' }}>
                  Days, due dates and schedules follow this computer's clock. Change it in your system settings.
                </Detail>
              </Box>
            </Stack>

            {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
            <Stack direction="row" sx={{ gap: 1.5, mt: 2.5, alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={save}
                disabled={!changed || emailInvalid || saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {saved && !changed && (
                <Typography variant="body2" role="status" color="success.main">Saved.</Typography>
              )}
            </Stack>
          </Panel>

          <Panel soft component="section" aria-labelledby="totals-heading">
            <PanelHead eyebrow="Totals" title="Across all preparations" titleId="totals-heading" />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px', mt: '14px' }}>
              <Metric value={stats.preparations.toLocaleString()} label={stats.preparations === 1 ? 'preparation' : 'preparations'} />
              <Metric value={stats.questions.toLocaleString()} label={stats.questions === 1 ? 'question' : 'questions'} />
              <Metric value={stats.mocks_taken.toLocaleString()} label={stats.mocks_taken === 1 ? 'mock taken' : 'mocks taken'} />
              <Metric
                value={stats.days_active.toLocaleString()}
                label={stats.days_active === 1 ? 'day active' : 'days active'}
                detail={since ? `since ${since}` : null}
              />
              {stats.interview_answers !== undefined && (
                <Metric
                  value={stats.interview_answers.toLocaleString()}
                  label={stats.interview_answers === 1 ? 'interview answer' : 'interview answers'}
                />
              )}
              {stats.study_hours != null && stats.study_hours > 0 && (
                <Metric
                  value={`${stats.study_hours}h`}
                  label="planned hours completed"
                />
              )}
            </Box>
            <Detail sx={{ mt: '14px' }}>
              A day counts when something you did was recorded: a session, an answer, a demonstration, a
              guide section read, a recording, a design answer or a review check.
            </Detail>

            <Box sx={{ mt: '24px' }}>
              <Eyebrow component="h3">Storage</Eyebrow>
              <BigFigure size={28}>
                {storage.database_bytes == null ? 'Not measured' : formatBytes(storage.database_bytes)}
              </BigFigure>
              <Detail sx={{ mt: '4px' }}>
                {storage.database_bytes == null
                  ? 'The database is not a file this server can measure.'
                  : 'local database'}
                {storage.recordings_bytes > 0 ? `, plus ${formatBytes(storage.recordings_bytes)} of recordings` : ''}
              </Detail>
              <Button
                component={RouterLink}
                to="/settings/data"
                variant="outlined"
                sx={{ mt: 1.5 }}
              >
                Manage data
              </Button>
            </Box>
          </Panel>
        </Grid>
      </Section>
    </Box>
  );
};
