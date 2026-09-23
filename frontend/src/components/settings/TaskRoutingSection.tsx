// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { Detail, Panel, PanelHead } from '../ui/primitives';
import { getLLMProviders, getLLMTasks, setLLMTaskBinding } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import type { LLMProvider, LLMTaskBinding } from '../../types/llm';

/**
 * Which provider answers each task, and what happens when none can.
 *
 * Read from the same resolution the gateway uses when a task actually runs:
 * the chosen provider, else the first enabled one that can do the task, else
 * the environment. "Automatic" is that order. Each row shows who would answer
 * right now, the time allowed, and the feature's behaviour with no provider --
 * which is never an invented result.
 */
export const TaskRoutingSection: React.FC = () => {
  const [tasks, setTasks] = useState<LLMTaskBinding[] | null>(null);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ task: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [t, p] = await Promise.all([getLLMTasks(), getLLMProviders()]);
      setTasks(t);
      setProviders(p);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load task routing.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const choose = async (task: LLMTaskBinding, value: string) => {
    setSaving(task.task);
    setRowError(null);
    try {
      const updated = await setLLMTaskBinding(task.task, { provider_id: value === 'auto' ? null : Number(value) });
      setTasks((all) => all?.map((t) => (t.task === updated.task ? updated : t)) ?? all);
    } catch (err) {
      setRowError({ task: task.task, message: apiErrorMessage(err, 'That provider could not be chosen for this task.') });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Panel component="section" aria-label="Task routing" sx={{ mb: '28px' }}>
      <PanelHead eyebrow="Task routing" title="Which provider handles what" />
      <Detail sx={{ mb: '6px', maxWidth: 620 }}>
        Automatic uses the first enabled provider that can do the task. A cloud provider receives the
        text of the tasks routed to it, and nothing else.
      </Detail>

      {loadError && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {loadError}
        </Alert>
      )}
      {!tasks && !loadError && <CircularProgress size={20} aria-label="Loading task routing" />}

      {tasks && (
        <Stack>
          {tasks.map((t, i) => {
            const bound = providers.find((p) => p.id === t.bound_provider_id);
            const resolved = providers.find((p) => p.id === t.resolved_provider_id);
            const timeout = resolved?.is_local ? t.local_timeout_seconds : t.cloud_timeout_seconds;
            return (
              <Box
                key={t.task}
                sx={{ py: '14px', borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider' }}
                aria-label={t.label}
                role="group"
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  sx={{ gap: { xs: 1, md: 2 }, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{t.label}</Typography>
                      {t.is_available ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="success"
                          label={`${t.resolved_provider_name}${t.resolved_model ? ` · ${t.resolved_model}` : ''}`}
                        />
                      ) : (
                        <Chip size="small" variant="outlined" color="warning" label="No provider" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {t.is_available
                        ? `Allowed ${Math.round(timeout)} seconds${resolved?.is_local ? ' on this machine' : resolved ? ' in the cloud' : ''}.`
                        : t.unavailable_reason}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Without a provider: {t.fallback}
                    </Typography>
                  </Box>
                  <TextField
                    select
                    size="small"
                    label="Provider"
                    value={bound ? String(bound.id) : 'auto'}
                    onChange={(e) => choose(t, e.target.value)}
                    disabled={saving === t.task}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="auto">Automatic</MenuItem>
                    {providers.map((p) => (
                      <MenuItem key={p.id} value={String(p.id)} disabled={!p.is_enabled}>
                        {p.name}{p.is_local ? ' (this machine)' : ' (cloud)'}{p.is_enabled ? '' : ' — disabled'}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                {rowError?.task === t.task && (
                  <Alert severity="error" sx={{ mt: 1 }}>{rowError.message}</Alert>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Panel>
  );
};
