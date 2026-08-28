// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { apiErrorMessage } from '../../services/apiError';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stepper, Step,
  StepLabel, Box, Typography, Alert, Chip, CircularProgress, TextField,
  MenuItem, IconButton, Tooltip, Link, Divider,
} from '@mui/material';
import {
  Search, HardDrive, Download, Terminal, Copy, Check, ExternalLink,
  CheckCircle2, AlertTriangle, FileDown,
} from 'lucide-react';
import {
  detectLocalRunners, getSystemInfo, getLocalModelOptions, getLocalRunners,
  buildLauncherScript, createLLMProvider, verifyLLMProvider,
} from '../../services/api';
import {
  DetectedRunner, SystemInfo, LocalModelOption, RunnerInfo, LLMVerifyResult,
} from '../../types/llm';

const STEPS = ['Check', 'Choose a model', 'Start it', 'Connect'];

/** Copy-to-clipboard that confirms, because a silent copy button is untrustworthy. */
const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip title={copied ? 'Copied' : label}>
      <IconButton
        size="small"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* Clipboard can be blocked; the command is on screen to copy by hand. */
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </IconButton>
    </Tooltip>
  );
};

const CommandBlock: React.FC<{ command: string }> = ({ command }) => (
  <Box
    sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1, mb: 2, p: 1.5,
      borderRadius: '8px', bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider',
    }}
  >
    <Box
      component="code"
      sx={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.78rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
    >
      {command}
    </Box>
    <CopyButton text={command} label="Copy command" />
  </Box>
);

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export const LocalSetupWizard: React.FC<Props> = ({ open, onClose, onConnected }) => {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [runners, setRunners] = useState<RunnerInfo[]>([]);
  const [models, setModels] = useState<LocalModelOption[]>([]);

  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedRunner[] | null>(null);

  const [runnerKey, setRunnerKey] = useState('llamafile');
  const [modelId, setModelId] = useState('');
  const [modelFile, setModelFile] = useState('');
  const [command, setCommand] = useState('');

  const [connecting, setConnecting] = useState(false);
  const [verifyResult, setVerifyResult] = useState<LLMVerifyResult | null>(null);

  const runner = runners.find((r) => r.key === runnerKey);
  const model = models.find((m) => m.id === modelId);

  useEffect(() => {
    if (!open) return;
    setError(null);
    Promise.all([getSystemInfo(), getLocalRunners(), getLocalModelOptions()])
      .then(([sys, runnerList, modelList]) => {
        setSystem(sys);
        setRunners(runnerList);
        setModels(modelList);
        const recommended = modelList.find((m) => m.recommended);
        if (recommended) setModelId(recommended.id);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load setup information.')));
  }, [open]);

  // Regenerate the command whenever anything it depends on changes, so what is
  // shown can never drift from what the launcher script contains. Guarded on
  // `open` because this component stays mounted inside the Settings page --
  // without it, every visit to Settings fires a request for a command nobody
  // is looking at.
  useEffect(() => {
    if (!open || !runnerKey) return;
    const file = modelFile.trim() || (runnerKey === 'ollama' ? 'qwen2.5:7b' : 'your-model.gguf');
    buildLauncherScript({ runner_key: runnerKey, model_file: file, os_family: system?.os_family })
      .then((s) => setCommand(s.command))
      .catch(() => setCommand(''));
  }, [open, runnerKey, modelFile, system?.os_family]);

  const handleDetect = async () => {
    setDetecting(true);
    setDetected(null);
    try {
      const found = await detectLocalRunners();
      setDetected(found);
      if (found.length > 0) {
        setRunnerKey(found[0].profile_key);
        // Something is already serving -- the download and launch steps are
        // pointless, so go straight to connecting it.
        setStep(3);
      }
    } catch {
      setDetected([]);
    } finally {
      setDetecting(false);
    }
  };

  const handleDownloadScript = async () => {
    try {
      const script = await buildLauncherScript({
        runner_key: runnerKey,
        model_file: modelFile.trim() || 'your-model.gguf',
        os_family: system?.os_family,
      });
      // A Blob download, so the file lands wherever the user chooses. PrepBench
      // never writes an executable to disk itself.
      const blob = new Blob([script.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = script.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not build the start script.'));
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    setVerifyResult(null);
    try {
      const base = detected?.find((d) => d.profile_key === runnerKey)?.base_url;
      const created = await createLLMProvider({
        name: runner?.label || runnerKey,
        profile_key: runnerKey,
        base_url: base || null,
        default_text_model: modelFile.trim() || detected?.[0]?.models?.[0] || null,
      });
      const result = await verifyLLMProvider(created.id);
      setVerifyResult(result);
      if (result.ok) onConnected();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not connect to the model server.'));
    } finally {
      setConnecting(false);
    }
  };

  const osKey = system?.os_family || 'windows';
  const steps = runner?.steps?.[osKey] || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HardDrive size={20} /> Set up a local AI model
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 3, mt: 1 }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Step 1 -- is something already running? */}
        {step === 0 && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              If you already run Ollama, LM Studio or a llamafile server, PrepBench can just use it.
              Let's check before you download anything.
            </Typography>
            <Button
              variant="contained"
              startIcon={detecting ? <CircularProgress size={14} color="inherit" /> : <Search size={16} />}
              onClick={handleDetect}
              disabled={detecting}
              sx={{ borderRadius: '100px', fontWeight: 700 }}
            >
              {detecting ? 'Scanning…' : 'Scan this machine'}
            </Button>

            {detected !== null && detected.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Nothing is running yet. That's expected the first time — continue and we'll get one set up.
              </Alert>
            )}

            <Alert severity="info" icon={false} sx={{ mt: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                PrepBench will not download or run anything for you
              </Typography>
              <Typography variant="body2">
                It tells you what to fetch and gives you the exact command. You download the files and
                start the server yourself — the same care you'd take with any program off the internet.
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Step 2 -- pick a model the machine can actually run */}
        {step === 1 && (
          <Box>
            {system && (
              <Alert severity={system.total_ram_gb ? 'info' : 'warning'} sx={{ mb: 2 }}>
                {system.total_ram_gb
                  ? `This machine has ${system.total_ram_gb}GB of memory` +
                    (system.available_ram_gb ? `, about ${system.available_ram_gb}GB free right now.` : '.')
                  : 'Could not measure this machine\'s memory, so the guidance below is approximate.'}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {models.map((m) => {
                const selected = m.id === modelId;
                return (
                  <Box
                    key={m.id}
                    onClick={() => { setModelId(m.id); setError(null); }}
                    sx={{
                      border: '2px solid', borderColor: selected ? 'primary.main' : 'divider',
                      borderRadius: '10px', p: 2, cursor: 'pointer',
                      opacity: m.fits === false ? 0.55 : 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700 }}>{m.label}</Typography>
                      {m.recommended && <Chip label="Recommended" size="small" color="primary" />}
                      {m.fits === false && <Chip label="Too big for this machine" size="small" color="error" variant="outlined" />}
                      {m.fits === true && m.fits_now === false && (
                        <Chip label="Close some apps first" size="small" color="warning" variant="outlined" />
                      )}
                      <Box sx={{ flexGrow: 1 }} />
                      <Chip label={`${m.download_gb}GB download`} size="small" variant="outlined" />
                      <Tooltip title={m.licence_commercial_ok ? 'Permissive licence' : 'Licence restricts commercial use'}>
                        <Chip
                          label={m.licence}
                          size="small"
                          variant="outlined"
                          color={m.licence_commercial_ok ? 'success' : 'warning'}
                        />
                      </Tooltip>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {m.summary}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {m.fit_note}
                    </Typography>
                    {selected && (
                      <Link
                        href={m.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, fontSize: '0.85rem' }}
                      >
                        <Download size={14} /> Open the download page <ExternalLink size={12} />
                      </Link>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Step 3 -- how to start it */}
        {step === 2 && (
          <Box>
            <TextField
              select
              fullWidth
              label="How do you want to run it?"
              value={runnerKey}
              onChange={(e) => setRunnerKey(e.target.value)}
              sx={{ mb: 2 }}
            >
              {runners.map((r) => (
                <MenuItem key={r.key} value={r.key}>{r.label} — {r.summary}</MenuItem>
              ))}
            </TextField>

            {runner && (
              <>
                <Link
                  href={runner.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2, fontSize: '0.9rem' }}
                >
                  <Download size={15} /> Get {runner.label} <ExternalLink size={12} />
                </Link>

                <Box component="ol" sx={{ pl: 2.5, mb: 2 }}>
                  {steps.map((s, i) => (
                    <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5 }}>{s}</Typography>
                  ))}
                </Box>

                <Divider sx={{ my: 2 }} />

                <TextField
                  fullWidth
                  size="small"
                  label={runnerKey === 'ollama' ? 'Model name' : 'Model file name'}
                  value={modelFile}
                  onChange={(e) => setModelFile(e.target.value)}
                  placeholder={runnerKey === 'ollama' ? 'qwen2.5:7b' : 'qwen2.5-7b-instruct-q4_k_m.gguf'}
                  helperText={
                    model
                      ? `For ${model.label}, use the file you downloaded from its page.`
                      : 'Whatever the downloaded file is called.'
                  }
                  sx={{ mb: 1 }}
                />

                <Typography variant="body2" sx={{ fontWeight: 600, mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Terminal size={16} /> Run this
                </Typography>
                <CommandBlock command={command || '…'} />

                {runnerKey === 'llamafile' && (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      <strong>--ctx-size</strong> sets how much text the model can consider at once.
                      Larger handles longer answers but uses more memory; 4096 fits a full system
                      design answer.
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDown size={16} />}
                      onClick={handleDownloadScript}
                      sx={{ borderRadius: '100px' }}
                    >
                      Save as a start script
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Saves a small text file next to your model so you don't have to retype this.
                      Read it before running it.
                    </Typography>
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {/* Step 4 -- connect and prove it works */}
        {step === 3 && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              With the server running, PrepBench will connect to it and ask it one question to make
              sure it actually answers.
            </Typography>

            <TextField
              fullWidth
              size="small"
              label="Model name"
              value={modelFile}
              onChange={(e) => setModelFile(e.target.value)}
              placeholder="qwen2.5-7b-instruct-q4_k_m.gguf"
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              onClick={handleConnect}
              disabled={connecting}
              startIcon={connecting ? <CircularProgress size={14} color="inherit" /> : <CheckCircle2 size={16} />}
              sx={{ borderRadius: '100px', fontWeight: 700 }}
            >
              {connecting ? 'Checking…' : 'Connect and test'}
            </Button>

            {verifyResult && (
              <Alert
                severity={verifyResult.ok ? (verifyResult.readiness === 'slow' ? 'warning' : 'success') : 'error'}
                icon={verifyResult.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                sx={{ mt: 2 }}
              >
                {verifyResult.message}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{verifyResult?.ok ? 'Done' : 'Cancel'}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
        <Button
          variant="contained"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => s + 1)}
          sx={{ fontWeight: 700 }}
        >
          Next
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocalSetupWizard;
