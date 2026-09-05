// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Chip, Alert, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Switch,
  CircularProgress, Tooltip,
} from '@mui/material';
import {
  Plus, Trash2, RefreshCw, Search, CheckCircle2, AlertTriangle,
  XCircle, Cloud, HardDrive, ChevronDown, KeyRound,
} from 'lucide-react';
import {
  getLLMProfiles, getLLMProviders, createLLMProvider, updateLLMProvider,
  deleteLLMProvider, verifyLLMProvider,
  detectLocalRunners,
} from '../../services/api';
import {
  LLMProfile, LLMProvider, DetectedRunner, LLMVerifyResult,
  CAPABILITY_LABELS,
} from '../../types/llm';
import { LocalSetupWizard } from './LocalSetupWizard';
import { apiErrorMessage } from '../../services/apiError';

const readinessStyles: Record<string, { color: 'success' | 'warning' | 'error'; Icon: typeof CheckCircle2 }> = {
  ready: { color: 'success', Icon: CheckCircle2 },
  slow: { color: 'warning', Icon: AlertTriangle },
  unreachable: { color: 'error', Icon: XCircle },
  error: { color: 'error', Icon: XCircle },
};

export const AIProvidersSection: React.FC = () => {
  const [profiles, setProfiles] = useState<LLMProfile[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detected, setDetected] = useState<DetectedRunner[] | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Verify results are held per provider rather than as one banner, so
  // checking a second provider doesn't erase what the first one said.
  const [verifying, setVerifying] = useState<number | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<number, LLMVerifyResult>>({});

  const [confirmDelete, setConfirmDelete] = useState<LLMProvider | null>(null);
  const [keyEdit, setKeyEdit] = useState<LLMProvider | null>(null);
  const [keyValue, setKeyValue] = useState('');

  const load = async () => {
    setError(null);
    try {
      const [p, pr] = await Promise.all([getLLMProfiles(), getLLMProviders()]);
      setProfiles(p);
      setProviders(pr);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load AI provider settings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDetect = async () => {
    setDetecting(true);
    setDetected(null);
    try {
      setDetected(await detectLocalRunners());
    } catch {
      setDetected([]);
    } finally {
      setDetecting(false);
    }
  };

  const handleVerify = async (provider: LLMProvider) => {
    setVerifying(provider.id);
    try {
      const result = await verifyLLMProvider(provider.id);
      setVerifyResults((prev) => ({ ...prev, [provider.id]: result }));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, `Could not check ${provider.name}.`));
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteLLMProvider(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove this provider.'));
    }
  };

  const handleToggleEnabled = async (provider: LLMProvider) => {
    try {
      await updateLLMProvider(provider.id, { is_enabled: !provider.is_enabled });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update this provider.'));
    }
  };

  const handleSaveKey = async () => {
    if (!keyEdit) return;
    try {
      await updateLLMProvider(keyEdit.id, { api_key: keyValue });
      setKeyEdit(null);
      setKeyValue('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the API key.'));
    }
  };

  if (loading) {
    return (
      <Box sx={{ mb: 5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">Loading AI providers…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 5 }}>
      {/* Same rhythm as the sections above it. This used to be a bordered
          card between two borderless sections, which made the optional part
          of Settings the loudest thing on the page. */}
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        AI providers
      </Typography>
      <Box sx={{ mt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
              PrepBench grades answers and generates questions using an AI model. Run one locally
              to keep everything on this machine, or connect a cloud API for sharper feedback.
              Everything else in PrepBench works without any of this.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HardDrive size={16} />}
              onClick={() => setWizardOpen(true)}
              sx={{ fontWeight: 700, borderRadius: '100px' }}
            >
              Set up a local model
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() => setAddOpen(true)}
              sx={{ fontWeight: 700, borderRadius: '100px' }}
            >
              Add
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ my: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Box sx={{ my: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={detecting ? <CircularProgress size={14} /> : <Search size={16} />}
            onClick={handleDetect}
            disabled={detecting}
            sx={{ borderRadius: '100px' }}
          >
            {detecting ? 'Scanning…' : 'Scan for local models'}
          </Button>
          {detected !== null && detected.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Nothing found on this machine. Start Ollama or a llamafile server, then scan again —
              or add a cloud provider instead.
            </Alert>
          )}
          {detected?.map((d) => (
            <Alert
              key={d.base_url}
              severity="success"
              sx={{ mt: 2 }}
              action={
                d.already_configured ? (
                  <Chip label="Already added" size="small" />
                ) : (
                  <Button size="small" onClick={() => { setAddOpen(true); setDetected(null); }}>
                    Add it
                  </Button>
                )
              }
            >
              Found <strong>{d.label}</strong> at {d.base_url}
              {d.models.length > 0 && ` — ${d.models.length} model(s) loaded`}
            </Alert>
          ))}
        </Box>

        {providers.length === 0 ? (
          <Alert severity="info">
            No AI provider set up yet. AI grading, question generation and recording analysis stay
            switched off until you add one — everything else works normally.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {providers.map((p) => {
              const result = verifyResults[p.id];
              const style = result ? readinessStyles[result.readiness] : null;
              return (
                <Box
                  key={p.id}
                  sx={{
                    border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 2,
                    opacity: p.is_enabled ? 1 : 0.6,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {p.is_local ? <HardDrive size={16} /> : <Cloud size={16} />}
                    <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
                    <Chip
                      label={p.is_local ? 'On this machine' : 'Cloud'}
                      size="small"
                      color={p.is_local ? 'success' : 'default'}
                      variant="outlined"
                    />
                    {p.capabilities.map((c) => (
                      <Chip key={c} label={CAPABILITY_LABELS[c] || c} size="small" variant="outlined" />
                    ))}
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title={p.is_enabled ? 'Disable' : 'Enable'}>
                      <Switch
                        size="small"
                        checked={p.is_enabled}
                        onChange={() => handleToggleEnabled(p)}
                      />
                    </Tooltip>
                    {/* Names include the provider, because these buttons repeat
                        once per provider -- a screen reader announcing six
                        identical "Check connection" buttons cannot tell the
                        user which one they are on. The label goes on the
                        button itself rather than relying on the Tooltip, whose
                        accessible name lands on its direct child (the span
                        below, not the button inside it). */}
                    <Tooltip title="Check connection">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Check connection for ${p.name}`}
                          onClick={() => handleVerify(p)}
                          disabled={verifying === p.id}
                        >
                          {verifying === p.id ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => setConfirmDelete(p)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {p.effective_base_url}
                    {p.default_text_model && ` · ${p.default_text_model}`}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    {p.has_api_key ? (
                      <Chip
                        icon={<KeyRound size={12} />}
                        label={
                          p.api_key_is_from_env
                            ? `Key from .env (…${p.api_key_hint})`
                            : `Key saved (…${p.api_key_hint})`
                        }
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      !p.is_local && <Chip label="No API key" size="small" color="warning" variant="outlined" />
                    )}
                    <Button
                      size="small"
                      onClick={() => { setKeyEdit(p); setKeyValue(''); }}
                      sx={{ textTransform: 'none' }}
                    >
                      {p.has_api_key ? 'Replace key' : 'Add key'}
                    </Button>
                  </Box>

                  {result && style && (
                    <Alert severity={style.color} sx={{ mt: 1.5 }} icon={<style.Icon size={18} />}>
                      {result.message}
                    </Alert>
                  )}
                  {!result && p.last_verify_error && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>{p.last_verify_error}</Alert>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* "Which provider handles what" -- a per-task provider override --
            used to sit here behind an accordion. It has been removed rather
            than demoted.

            The table backing it held zero rows across the product's whole
            life, and the gateway already resolves each task to the first
            enabled provider that can do it. So the control administered a
            subsystem: "task", "capability" and "binding" are implementation
            vocabulary, and AI is a capability of PrepBench rather than a
            platform the learner operates.

            Hiding it under "Advanced" would have kept the maintenance and
            test surface while removing the only feedback that might ever
            have justified it. If a real need for per-task routing appears,
            it can come back with a reason. */}
      </Box>

      <LocalSetupWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); load(); }}
        onConnected={load}
      />

      <AddProviderDialog
        open={addOpen}
        profiles={profiles}
        detected={detected ?? []}
        onClose={() => setAddOpen(false)}
        onCreated={async () => { setAddOpen(false); await load(); }}
        onError={setError}
      />

      <Dialog open={!!keyEdit} onClose={() => setKeyEdit(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {keyEdit?.has_api_key ? 'Replace API key' : 'Add API key'}
        </DialogTitle>
        <DialogContent>
          {keyEdit?.api_key_is_from_env && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This provider currently reads its key from backend/.env. Saving one here stores it in
              the app instead and takes over from the file.
            </Alert>
          )}
          <TextField
            fullWidth
            autoFocus
            type="password"
            label="API key"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            helperText="Stored on this machine and never shown again. Leave blank and save to remove it."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setKeyEdit(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveKey} sx={{ fontWeight: 700 }}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Remove provider?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <strong>{confirmDelete?.name}</strong> will be removed along with its saved key.
            Any feature set to use it falls back to another provider, or turns off if there
            isn't one.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ fontWeight: 700 }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

interface AddProviderDialogProps {
  open: boolean;
  profiles: LLMProfile[];
  detected: DetectedRunner[];
  onClose: () => void;
  onCreated: () => void;
  onError: (message: string) => void;
}

const AddProviderDialog: React.FC<AddProviderDialogProps> = ({
  open, profiles, detected, onClose, onCreated, onError,
}) => {
  const [profileKey, setProfileKey] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);

  const profile = profiles.find((p) => p.key === profileKey);
  const detectedForProfile = detected.find((d) => d.profile_key === profileKey);

  useEffect(() => {
    if (!profile) return;
    setName((current) => current || profile.label);
    setBaseUrl(profile.base_url || detectedForProfile?.base_url || '');
    setModel(profile.default_models?.text_json || detectedForProfile?.models?.[0] || '');
  }, [profileKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setProfileKey(''); setName(''); setBaseUrl(''); setApiKey(''); setModel('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await createLLMProvider({
        name: name.trim(),
        profile_key: profileKey,
        base_url: baseUrl.trim() || null,
        api_key: apiKey.trim() || null,
        default_text_model: model.trim() || null,
      });
      reset();
      onCreated();
    } catch (err) {
      onError(apiErrorMessage(err, 'Could not add this provider.'));
    } finally {
      setSaving(false);
    }
  };

  const localProfiles = profiles.filter((p) => p.is_local === true);
  const otherProfiles = profiles.filter((p) => p.is_local !== true);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add an AI provider</DialogTitle>
      <DialogContent>
        <TextField
          select
          fullWidth
          label="Provider type"
          value={profileKey}
          onChange={(e) => setProfileKey(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
        >
          <MenuItem disabled value="__local">
            <Typography variant="caption" sx={{ fontWeight: 700 }}>ON THIS MACHINE — free, private</Typography>
          </MenuItem>
          {localProfiles.map((p) => (
            <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
          ))}
          <MenuItem disabled value="__cloud">
            <Typography variant="caption" sx={{ fontWeight: 700 }}>CLOUD — needs your API key</Typography>
          </MenuItem>
          {otherProfiles.map((p) => (
            <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
          ))}
        </TextField>

        {profile && (
          <>
            {profile.is_local === true && (
              <Alert severity="info" sx={{ mb: 2 }}>
                PrepBench does not download or run the model for you. Start your local server
                first, then point this at it. Nothing you write leaves this machine.
              </Alert>
            )}

            <TextField
              fullWidth
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText="How this shows up in the list"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Server address"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:8080/v1"
              helperText={profile.base_url ? 'Leave as-is unless you changed the port' : 'Required'}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              helperText={
                detectedForProfile?.models?.length
                  ? `Detected: ${detectedForProfile.models.slice(0, 3).join(', ')}`
                  : 'The model name your server exposes'
              }
              sx={{ mb: 2 }}
            />

            {profile.requires_api_key && (
              <TextField
                fullWidth
                type="password"
                label="API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                helperText="Stored on this machine and never shown again"
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!profileKey || !name.trim() || saving}
          onClick={handleSave}
          sx={{ fontWeight: 700 }}
        >
          {saving ? 'Adding…' : 'Add provider'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIProvidersSection;
