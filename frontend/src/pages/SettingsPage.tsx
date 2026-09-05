// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Switch, FormControlLabel,
  MenuItem, TextField, Button, Divider, Alert, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Save, Volume2, AlertTriangle, RotateCcw } from 'lucide-react';
import { getSettings, updateSettings, resetApplication } from '../services/api';
import { useThemeMode } from '../context/ThemeContext';
import { AppSettings } from '../types/settings';
import { AIProvidersSection } from '../components/settings/AIProvidersSection';

import { apiErrorMessage } from '../services/apiError';

export const SettingsPage: React.FC = () => {
  const { setThemeMode } = useThemeMode();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [openResetModal, setOpenResetModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = () => {
    setLoading(true);
    setFetchError(null);
    getSettings()
      .then((data) => {
        setSettings(data);
        if (data?.theme === 'dark' || data?.theme === 'light') {
          setThemeMode(data.theme);
        }
      })
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load settings from server. Please check backend connection.');
      })
      .finally(() => setLoading(false));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaveError(null);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      if (updated.theme === 'dark' || updated.theme === 'light') {
        setThemeMode(updated.theme);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings', err);
      setSaveError(apiErrorMessage(err, 'Failed to save settings. Please try again.'));
    }
  };

  const handleConfirmReset = async () => {
    if (confirmInput.trim().toUpperCase() !== 'RESET') return;
    setResetError(null);
    try {
      setResetting(true);
      await resetApplication();
      setResetSuccess(true);
      setOpenResetModal(false);
      setConfirmInput('');
      fetchSettings();
      setTimeout(() => setResetSuccess(false), 5000);
    } catch (err) {
      console.error('Failed to reset application', err);
      setResetError(apiErrorMessage(err, 'Failed to reset application state.'));
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <LinearProgress />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', mt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchSettings}>
              Retry
            </Button>
          }
        >
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (!settings) return null;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>Settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Stored locally, in the same SQLite file as everything else.
      </Typography>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Saved.</Alert>}
      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
      {resetError && <Alert severity="error" sx={{ mb: 2 }}>{resetError}</Alert>}
      {resetSuccess && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Application has been completely reset to fresh empty state.
        </Alert>
      )}

      <Box sx={{ mb: 5 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Appearance and audio
        </Typography>
        <Box sx={{ mt: 1.5 }}>
          <Grid container spacing={3}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField
                select
                fullWidth
                label="Theme"
                value={settings.theme}
                onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'dark' | 'light' })}
              >
                <MenuItem value="dark">Dark</MenuItem>
                <MenuItem value="light">Light</MenuItem>
              </TextField>
            </Grid>
            <Grid
              sx={{ display: 'flex', alignItems: 'center' }}
              size={{
                xs: 12,
                sm: 6
              }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.timer_sound_enabled}
                    onChange={(e) => setSettings({ ...settings, timer_sound_enabled: e.target.checked })}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Volume2 size={16} /> Timer sound alert (under 5 min)
                  </Box>
                }
              />
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* "Exam Defaults" -- default exam mode, default question count,
          default passing score and shuffle question order -- stood here.
          Nothing read any of them. A mock takes its shape from the subject's
          exam profile because the real exam does not let you choose, and a
          drill takes its shape from the screen you start it on. Four
          controls whose only effect was to be saved, which is the same
          defect as the "Shuffle Answer Options" switch that was removed
          before them: a false statement about the product that the learner
          has no way to catch. */}

      <Box sx={{ mb: 5 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          System Design
        </Typography>
        <Box sx={{ mt: 1.5 }}>
          <TextField
            fullWidth
            label="Default Target Role"
            placeholder="e.g. Senior Backend Engineer, fintech"
            value={settings.default_target_role || ''}
            onChange={(e) => setSettings({ ...settings, default_target_role: e.target.value || null })}
            helperText="Pre-fills the Target Role field when starting a new System Design attempt, so feedback is calibrated to this role by default. Leave blank for no default -- you can still override it per attempt."
          />
        </Box>
      </Box>

      <AIProvidersSection />

      {/* Danger Zone: Factory Reset */}
      <Card sx={{
        mb: 3,
        borderRadius: '12px',
        boxShadow: 'none',
        border: '1px solid',
        borderColor: 'error.main'
      }}>
        <CardContent>
          {/* The only bordered surface left on the page. Containment is
              doing real work here: it separates the one irreversible action
              from the reversible ones above it. */}
          <Typography variant="subtitle1" color="error" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={18} /> Reset everything
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Restore the application to a brand-new empty state. This will erase all questions, exam sessions, history, bookmarks, notes, and restore default settings.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<RotateCcw size={18} />}
            onClick={() => setOpenResetModal(true)}
            sx={{ fontWeight: 700 }}
          >
            Reset the application
          </Button>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<Save size={18} />}
          onClick={handleSave}
          sx={{
            px: 4,
            fontWeight: 700,
            borderRadius: '100px'
          }}
        >
          Save Settings
        </Button>
      </Box>

      {/* Reset Warning Confirmation Modal */}
      <Dialog
        open={openResetModal}
        onClose={() => !resetting && setOpenResetModal(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main', fontWeight: 800 }}>
          <AlertTriangle size={24} /> Reset Entire Application?
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2, fontWeight: 600 }}>
            WARNING: This action is permanent and cannot be undone!
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will permanently delete:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
            <li>All questions and answer options</li>
            <li>All exam history and score analytics</li>
            <li>All user notes, bookmarks, and spaced repetition schedules</li>
            <li>Restores all application settings to factory default</li>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Type <strong>RESET</strong> below to confirm:
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Type RESET"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenResetModal(false)} disabled={resetting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={confirmInput.trim().toUpperCase() !== 'RESET' || resetting}
            onClick={handleConfirmReset}
            sx={{ fontWeight: 700 }}
          >
            {resetting ? 'Resetting...' : 'Confirm Reset'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
