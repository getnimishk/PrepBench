// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Typography,
} from '@mui/material';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { backupDownloadUrl, getStorageReport, resetApplication } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import { formatBytes, fromServerTime } from '../../services/format';
import { SettingsRow, SettingsSection, SettingsSubpage } from '../../components/settings/SettingsSubpage';
import { usePreparation } from '../../context/PreparationContext';
import type { StorageReport } from '../../types/system';

/**
 * Where your data is, read from the running server.
 *
 * The file path, size and last write come from the database connection the
 * server is actually using -- not a path written into this page -- so a server
 * started against another file reports that file. Browser storage is listed
 * for what it is: two small conveniences, not your practice history.
 */

const COUNT_LABELS: Record<string, string> = {
  subjects: 'Preparations',
  questions: 'Questions',
  exam_sessions: 'Exam sessions',
  exam_answers: 'Answers',
  spaced_repetition: 'Review schedule entries',
  roadmaps: 'Roadmaps',
  roadmap_topics: 'Roadmap topics',
  practice_recordings: 'Recordings',
  interview_sessions: 'Interview sessions',
  system_design_attempts: 'System Design attempts',
  design_review_attempts: 'Design Review attempts',
  learning_attempts: 'Chart Sandbox answers',
};

/** What this app keeps in the browser, by key. */
const BROWSER_KEYS: { key: string; label: string }[] = [
  { key: 'prepbench.selectedPreparationId', label: 'The preparation picked in the header' },
  { key: 'prepbench.displayPreferences', label: 'A copy of your display preferences, so pages open in the right theme' },
  { key: 'prepbench.learning.attempts.v1', label: 'Chart Sandbox answers from before they were saved to the database, waiting to be moved' },
];

function browserStorage(): { label: string; bytes: number }[] | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const entries = BROWSER_KEYS
      .map(({ key, label }) => ({ label, value: ls.getItem(key) }))
      .filter((e): e is { label: string; value: string } => e.value !== null)
      .map((e) => ({ label: e.label, bytes: e.value.length }));
    // Work kept here because the server could not take it, waiting to be sent.
    let draftBytes = 0;
    let drafts = 0;
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (key?.startsWith('prepbench.draft.')) {
        drafts += 1;
        draftBytes += ls.getItem(key)?.length ?? 0;
      }
    }
    if (drafts > 0) {
      entries.push({
        label: `${drafts} ${drafts === 1 ? 'answer' : 'answers'} kept while the server was unreachable, waiting to be sent`,
        bytes: draftBytes,
      });
    }
    return entries;
  } catch {
    return null;
  }
}

export const DataSettingsPage: React.FC = () => {
  const { refresh: refreshPreparations } = usePreparation();
  const [report, setReport] = useState<StorageReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    getStorageReport()
      .then(setReport)
      .catch((err) => setLoadError(apiErrorMessage(err, 'Could not read the storage report.')));
  }, []);

  useEffect(() => { load(); }, [load]);

  const reset = async () => {
    if (confirm.trim().toUpperCase() !== 'RESET') return;
    setResetting(true);
    setResetError(null);
    try {
      await resetApplication();
      setResetOpen(false);
      setConfirm('');
      setResetDone(true);
      load();
      refreshPreparations().catch(() => {});
    } catch (err) {
      setResetError(apiErrorMessage(err, 'The reset did not happen. Your data is unchanged.'));
    } finally {
      setResetting(false);
    }
  };

  const browser = browserStorage();
  const db = report?.database;
  const modified = fromServerTime(db?.modified_at);

  return (
    <SettingsSubpage
      title="Data and storage"
      description="Your questions, answers, schedules and recordings live on this machine, in the files below. There is no server copy to recover from, so keep a backup."
    >
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {loadError}
        </Alert>
      )}
      {!report && !loadError && <CircularProgress aria-label="Loading the storage report" />}
      {resetDone && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setResetDone(false)}>
          Everything was reset to a fresh install: your data is gone, and the built-in content is back.
        </Alert>
      )}

      {report && db && (
        <>
          <SettingsSection title="Database">
            <SettingsRow
              label="File"
              detail={db.path
                ? <Box component="code" sx={{ wordBreak: 'break-all', fontSize: (t) => t.typography.pxToRem(13.6) }}>{db.path}</Box>
                : `A ${db.engine} database, not a file on this machine.`}
            />
            <SettingsRow
              label="Size"
              detail={db.path
                ? `${formatBytes(db.size_bytes)}${db.wal_bytes ? ` plus ${formatBytes(db.wal_bytes)} of recent writes not yet folded in` : ''}`
                : '—'}
            />
            <SettingsRow
              label="Last written"
              detail={modified ? modified.toLocaleString() : '—'}
            />
            <SettingsRow
              label="Backup"
              detail={db.backup_supported
                ? 'A complete, consistent copy of the database as one file. API keys are not in it: they were never in the database.'
                : 'Backups need a SQLite database file.'}
              control={db.backup_supported ? (
                <Button
                  component="a"
                  href={backupDownloadUrl()}
                  download
                  variant="outlined"
                  startIcon={<Download size={16} />}
                >
                  Download backup
                </Button>
              ) : undefined}
            />
          </SettingsSection>

          <SettingsSection title="What is in it">
            <Box sx={{ px: 2, py: 1.5, display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {Object.entries(report.counts).map(([key, n]) => (
                <Stack key={key} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">{COUNT_LABELS[key] ?? key}</Typography>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{n}</Typography>
                </Stack>
              ))}
            </Box>
          </SettingsSection>

          <SettingsSection title="By preparation">
            {report.preparations.map((p) => (
              <SettingsRow
                key={p.subject_id}
                label={`${p.name}${p.is_archived ? ' (archived)' : ''}`}
                detail={`${p.questions} questions · ${p.sessions} sessions · ${p.answers} answers`}
              />
            ))}
            {report.unassigned_questions > 0 && (
              <SettingsRow
                label="Not in any preparation"
                detail={`${report.unassigned_questions} questions. They appear in the Question Bank under All questions.`}
              />
            )}
          </SettingsSection>

          <SettingsSection title="Recordings">
            <SettingsRow
              label="Folder"
              detail={(
                <>
                  <Box component="code" sx={{ wordBreak: 'break-all', fontSize: (t) => t.typography.pxToRem(13.6) }}>{report.recordings.path}</Box>
                  <br />
                  {`${report.recordings.files} files · ${formatBytes(report.recordings.size_bytes)}. Audio is kept as files, not in the database, and is not in the backup.`}
                </>
              )}
            />
          </SettingsSection>
        </>
      )}

      <SettingsSection title="This browser">
        {browser === null ? (
          <SettingsRow label="Browser storage" detail="Not available in this browser. Nothing depends on it." />
        ) : browser.length === 0 ? (
          <SettingsRow label="Browser storage" detail="Nothing stored. Your practice history is in the database, not here." />
        ) : browser.map((entry) => (
          <SettingsRow key={entry.label} label={entry.label} detail={`${formatBytes(entry.bytes)} in this browser only`} />
        ))}
      </SettingsSection>

      <Box
        component="section"
        aria-label="Reset everything"
        sx={{ border: '1px solid', borderColor: 'error.main', borderRadius: 3, p: 2 }}
      >
        <Typography variant="subtitle1" component="h2" color="error" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={18} /> Reset everything
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
          Deletes every question, session, schedule, roadmap, recording record and setting, then restores
          the built-in content a fresh install has. Download a backup first if you might want any of it.
        </Typography>
        {resetError && <Alert severity="error" sx={{ mb: 1.5 }}>{resetError}</Alert>}
        <Button variant="outlined" color="error" startIcon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
          Reset the application
        </Button>
      </Box>

      <Dialog open={resetOpen} onClose={() => !resetting && setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main', fontWeight: 700 }}>Reset everything?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This cannot be undone. Type <strong>RESET</strong> to confirm.
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Type RESET"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            slotProps={{ htmlInput: { 'aria-label': 'Type RESET to confirm' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={confirm.trim().toUpperCase() !== 'RESET' || resetting}
            onClick={reset}
          >
            {resetting ? 'Resetting…' : 'Reset everything'}
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsSubpage>
  );
};
