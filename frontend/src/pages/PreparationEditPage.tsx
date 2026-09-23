// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import {
  archiveSubject, deleteSubject, getSubject, updateSubject,
} from '../services/api';
import { loadFailed } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import type { Subject, SubjectUpdate } from '../types/subject';
import { LoadingState } from '../components/common/States';
import { Eyebrow, Grid, Note, PageHead, Panel, Row, Section } from '../components/ui/primitives';

/**
 * Preparation settings, and the danger zone.
 *
 * Two things are deliberately not editable, and both are absent rather than
 * disabled-with-a-tooltip:
 *
 *   kind -- switching a certification to a skill would strand its pass mark and
 *           orphan the mock evidence measured against it
 *   slug -- it is the preparation's stable identity, so a rename must not move it
 *
 * The danger zone holds two genuinely different actions. Archive hides and keeps.
 * Delete destroys, needs the name typed, and says exactly what it will destroy
 * using counts the server actually reports.
 */

export const PreparationEditPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { refresh } = usePreparation();

  const [prep, setPrep] = useState<Subject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [certification, setCertification] = useState('');
  const [questionCount, setQuestionCount] = useState('');
  const [minutes, setMinutes] = useState('');
  const [passMark, setPassMark] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    const id = Number(subjectId);
    if (!Number.isFinite(id)) {
      setLoadError('That is not a preparation id.');
      return;
    }
    getSubject(id)
      .then((found) => {
        setPrep(found);
        setName(found.name);
        setDescription(found.description ?? '');
        setCertification(found.certification ?? '');
        setQuestionCount(found.exam_question_count?.toString() ?? '');
        setMinutes(found.exam_minutes?.toString() ?? '');
        setPassMark(found.pass_mark?.toString() ?? '');
        setTargetDate(found.target_exam_date ?? '');
      })
      .catch((err) => setLoadError(loadFailed('Could not load that preparation', err)));
  }, [subjectId, loadAttempt]);

  const serverDetail = (e: unknown): string | null => {
    const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    return typeof detail === 'string' ? detail : null;
  };

  const save = async () => {
    if (!prep) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const payload: SubjectUpdate = {
      name: name.trim(),
      description: description.trim() || null,
      certification: certification.trim() || null,
      target_exam_date: targetDate || null,
    };
    // Only a certification has these, and sending them for a skill is refused.
    if (prep.kind === 'certification') {
      payload.pass_mark = passMark === '' ? null : Number(passMark);
      payload.exam_question_count = questionCount === '' ? null : Number(questionCount);
      payload.exam_minutes = minutes === '' ? null : Number(minutes);
    }

    try {
      const updated = await updateSubject(prep.id, payload);
      setPrep(updated);
      await refresh();
      setSaved(true);
    } catch (e: unknown) {
      setSaveError(serverDetail(e) ?? 'Could not save. Nothing was changed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!prep) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await archiveSubject(prep.id, !prep.is_archived);
      setPrep(updated);
      await refresh();
    } catch (e: unknown) {
      setSaveError(serverDetail(e) ?? 'Could not change the archive state.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!prep) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSubject(prep.id, typedName);
      // refresh() re-resolves the selection on its own: a stored id that is no
      // longer in the list falls back to the first preparation that is. Nothing
      // else is needed here, and an earlier version that also cleared the
      // selection by hand left the picker reading "No preparation" -- it
      // overwrote the good fallback with an id nothing matches.
      await refresh();
      navigate('/preparations');
    } catch (e: unknown) {
      setDeleteError(serverDetail(e) ?? 'Could not delete. Nothing was removed.');
    } finally {
      setDeleting(false);
    }
  };

  if (loadError) {
    return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button>}>{loadError}</Alert>;
  }

  if (!prep) return <LoadingState label="Loading this preparation…" />;

  const isCertification = prep.kind === 'certification';

  return (
    <Box>
      <PageHead
        eyebrow="Preparation settings"
        title={prep.name}
        sub="Change how this preparation is described and scheduled. Its questions and history are untouched."
        actions={(
          <>
            <Button variant="outlined" onClick={() => navigate('/preparations')}>← Cancel</Button>
            <Button
              variant="contained"
              color="ink"
              onClick={() => void save()}
              disabled={saving || name.trim().length === 0}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        )}
      />

      {saveError && <Alert severity="error" sx={{ mb: '14px', maxWidth: 880 }}>{saveError}</Alert>}
      {saved && !saveError && <Alert severity="success" sx={{ mb: '14px', maxWidth: 880 }}>Saved.</Alert>}

      <Panel component="section" aria-label="Details" sx={{ maxWidth: 880 }}>
        <Eyebrow>Details</Eyebrow>

        <Box sx={{ display: 'grid', gap: '13px', mt: '12px' }}>
          <Grid template="repeat(2, minmax(0,1fr))" gap="13px">
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField
              label="Type"
              value={isCertification ? 'Certification' : 'Skill'}
              disabled
              helperText="Fixed. Changing it would orphan the evidence measured against it."
            />
          </Grid>

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />

          {isCertification && (
            <>
              <TextField
                label="Certification name on your questions"
                value={certification}
                onChange={(e) => setCertification(e.target.value)}
                fullWidth
                helperText="Questions are matched to this preparation by this exact string."
              />
              <Grid template="repeat(2, minmax(0,1fr))" gap="13px">
                <TextField
                  label="Questions"
                  type="number"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  slotProps={{ htmlInput: { min: 1 } }}
                />
                <TextField
                  label="Time limit (minutes)"
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  slotProps={{ htmlInput: { min: 1 } }}
                />
                <TextField
                  label="Pass mark (%)"
                  type="number"
                  value={passMark}
                  onChange={(e) => setPassMark(e.target.value)}
                  slotProps={{ htmlInput: { min: 0, max: 100 } }}
                />
                <TextField
                  label="Target exam date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </Grid>
            </>
          )}

          {!isCertification && (
            <Note>
              A skill has no exam, so there is no pass mark, paper length or time
              limit to set. It can be practised but never reported as ready.
            </Note>
          )}
        </Box>
      </Panel>

      <Section>
        <Panel component="section" aria-label="Danger zone" sx={{ maxWidth: 880, borderColor: 'error.main' }}>
          <Eyebrow color="error.main">Danger zone</Eyebrow>
          <Row
            title={prep.is_archived ? 'Restore preparation' : 'Archive preparation'}
            detail={prep.is_archived
              ? 'Put it back in the picker.'
              : 'Hides it from the picker. History and questions are kept.'}
            action={(
              <Button variant="outlined" onClick={() => void toggleArchive()} disabled={saving}>
                {prep.is_archived ? 'Restore' : 'Archive'}
              </Button>
            )}
          />
          <Row
            title="Delete preparation"
            // Real counts, from the same columns the delete will act on.
            detail={`Permanently removes ${prep.question_count} question${prep.question_count === 1 ? '' : 's'}, `
              + `${prep.readiness.mock_count} mock${prep.readiness.mock_count === 1 ? '' : 's'} and all review state. `
              + 'Roadmaps are unlinked, not deleted. This cannot be undone.'}
            action={(
              <Button
                color="error"
                variant="outlined"
                onClick={() => { setTypedName(''); setDeleteError(null); setConfirmOpen(true); }}
              >
                Delete
              </Button>
            )}
          />
        </Panel>
      </Section>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 780 }}>Delete {prep.name}?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            This removes {prep.question_count} question
            {prep.question_count === 1 ? '' : 's'} and {prep.readiness.mock_count} mock
            {prep.readiness.mock_count === 1 ? '' : 's'} along with their review
            state. There is no undo and no backup. Type the name to confirm.
          </Typography>
          <TextField
            label="Preparation name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={prep.name}
            fullWidth
            autoFocus
          />
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void confirmDelete()}
            // Matched here too, so the button is not offered for a name that the
            // server will refuse. The server checks it regardless -- this is a
            // courtesy, not the guard.
            disabled={deleting || typedName.trim() !== prep.name}
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
