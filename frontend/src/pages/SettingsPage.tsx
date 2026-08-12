import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Switch, FormControlLabel,
  Slider, MenuItem, TextField, Button, Divider, Alert, Chip, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Save, Settings as SettingsIcon, Moon, Volume2, AlertTriangle, RotateCcw, Network } from 'lucide-react';
import { getSettings, updateSettings, resetApplication } from '../services/api';
import { useThemeMode } from '../context/ThemeContext';
import { AppSettings } from '../types/settings';

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
    } catch (err: any) {
      console.error('Failed to save settings', err);
      setSaveError(err?.response?.data?.detail || 'Failed to save settings. Please try again.');
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
    } catch (err: any) {
      console.error('Failed to reset application', err);
      setResetError(err?.response?.data?.detail || 'Failed to reset application state.');
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
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        All settings are stored locally in your SQLite database.
      </Typography>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved successfully!</Alert>}
      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
      {resetError && <Alert severity="error" sx={{ mb: 2 }}>{resetError}</Alert>}
      {resetSuccess && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Application has been completely reset to fresh empty state.
        </Alert>
      )}

      <Card sx={{ mb: 3, borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Moon size={20} /> Appearance & Audio
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Theme Mode"
                value={settings.theme}
                onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'dark' | 'light' })}
              >
                <MenuItem value="dark">Dark Mode</MenuItem>
                <MenuItem value="light">Light Mode</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.timer_sound_enabled}
                    onChange={(e) => setSettings({ ...settings, timer_sound_enabled: e.target.checked })}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Volume2 size={16} /> Timer Sound Alert (&lt; 5 min)
                  </Box>
                }
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon size={20} /> Exam Defaults
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Default Exam Mode"
                value={settings.default_exam_mode}
                onChange={(e) => setSettings({ ...settings, default_exam_mode: e.target.value })}
              >
                <MenuItem value="practice">Practice Mode</MenuItem>
                <MenuItem value="timed">Timed Exam</MenuItem>
                <MenuItem value="custom">Custom Exam</MenuItem>
                <MenuItem value="weak_topic">Weak Topic Focus</MenuItem>
                <MenuItem value="spaced_repetition">Spaced Repetition</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Default Question Count: <Chip label={settings.default_questions_count} size="small" color="primary" />
              </Typography>
              <Slider
                value={settings.default_questions_count}
                onChange={(_, val) => setSettings({ ...settings, default_questions_count: val as number })}
                min={5}
                max={100}
                step={5}
                marks
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Default Passing Score: <Chip label={`${settings.default_passing_percentage}%`} size="small" color="success" />
              </Typography>
              <Slider
                value={settings.default_passing_percentage}
                onChange={(_, val) => setSettings({ ...settings, default_passing_percentage: val as number })}
                min={50}
                max={95}
                step={5}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Daily Practice Goal: <Chip label={`${settings.daily_practice_goal} questions`} size="small" color="warning" />
              </Typography>
              <Slider
                value={settings.daily_practice_goal}
                onChange={(_, val) => setSettings({ ...settings, daily_practice_goal: val as number })}
                min={5}
                max={100}
                step={5}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.shuffle_questions}
                      onChange={(e) => setSettings({ ...settings, shuffle_questions: e.target.checked })}
                    />
                  }
                  label="Shuffle Questions by Default"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.shuffle_options}
                      onChange={(e) => setSettings({ ...settings, shuffle_options: e.target.checked })}
                    />
                  }
                  label="Shuffle Answer Options"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Network size={20} /> System Design Defaults
          </Typography>
          <TextField
            fullWidth
            label="Default Target Role"
            placeholder="e.g. Senior Backend Engineer, fintech"
            value={settings.default_target_role || ''}
            onChange={(e) => setSettings({ ...settings, default_target_role: e.target.value || null })}
            helperText="Pre-fills the Target Role field when starting a new System Design attempt, so feedback is calibrated to this role by default. Leave blank for no default -- you can still override it per attempt."
          />
        </CardContent>
      </Card>

      {/* Danger Zone: Factory Reset */}
      <Card sx={{
        mb: 3,
        borderRadius: '12px',
        boxShadow: 'none',
        border: '1px solid',
        borderColor: 'error.main'
      }}>
        <CardContent>
          <Typography variant="h6" color="error" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={20} /> Reset System Data
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
            Reset Entire Application
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
