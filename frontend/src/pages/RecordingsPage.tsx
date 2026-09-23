// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, IconButton, LinearProgress, Tooltip } from '@mui/material';
import { Trash2 } from 'lucide-react';
import { deleteRecording, getRecordings } from '../services/api';
import { PracticeRecording } from '../types/recording';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { Actions, Detail, PageHead, Panel, PanelHead, Pill, Row, Section, Sub, type Tone } from '../components/ui/primitives';

/**
 * Recordings: every take kept on this machine, as the prototype lists them --
 * the take, when and how long, its content and delivery, and the way into it.
 *
 * The prototype also draws three "example takes" under the real ones, to show
 * what a filled library looks like. They are not drawn here: rows that look
 * like the learner's own work and are not would be invented evidence, even
 * labelled.
 */

const clock = (seconds: number | null | undefined) => {
  if (seconds == null) return null;
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const when = (iso: string) => {
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  analyzed: { label: 'Analysed', tone: 'success' },
  error: { label: 'Analysis failed', tone: 'danger' },
  unavailable: { label: 'Not graded', tone: 'neutral' },
};

export const RecordingsPage: React.FC = () => {
  const [recordings, setRecordings] = useState<PracticeRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRecordings = () => {
    setLoading(true);
    setFetchError(null);
    getRecordings({ limit: 200 })
      .then((res) => setRecordings(res.items))
      .catch((err) => setFetchError(loadFailed('Could not load your recordings', err)))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRecordings, []);

  const handleDelete = async (recording: PracticeRecording) => {
    setDeleteError(null);
    try {
      await deleteRecording(recording.id);
      setRecordings((prev) => prev.filter((r) => r.id !== recording.id));
    } catch (err) {
      setDeleteError(apiErrorMessage(err, `Could not delete ${recording.title}. Nothing was changed.`));
    }
  };

  return (
    <Box>
      <PageHead
        eyebrow="Interview practice"
        title="Recordings"
        sub="Every take stays available for comparison. Content and delivery are kept separate so a strong story is not hidden by a nervous delivery."
        actions={(
          <>
            <Button component={RouterLink} to="/interview-practice/library" variant="outlined">Question library</Button>
            <Button component={RouterLink} to="/interview-practice" variant="contained" color="ink">Record a new take</Button>
          </>
        )}
      />

      {deleteError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setDeleteError(null)}>{deleteError}</Alert>}

      <Section>
        <Panel component="section" aria-labelledby="your-takes">
          <PanelHead eyebrow="This machine" title="Your takes" titleId="your-takes" />

          {fetchError && (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchRecordings}>Retry</Button>}>
              {fetchError}
            </Alert>
          )}

          {loading ? (
            <LinearProgress aria-label="Loading recordings" />
          ) : recordings.length === 0 && !fetchError ? (
            // The prototype's .drop: a dashed empty area with the way to fill it.
            <Box
              sx={{
                p: '36px', borderRadius: '12px', border: '2px dashed', borderColor: 'pb.dash',
                bgcolor: 'pb.surface2', textAlign: 'center',
              }}
            >
              <Box component="b" sx={{ display: 'block' }}>No takes yet</Box>
              <Sub sx={{ mt: '4px', mb: 0, mx: 'auto' }}>A recorded answer appears here with its analysis.</Sub>
              <Actions sx={{ justifyContent: 'center', mt: '14px' }}>
                <Button component={RouterLink} to="/interview-practice" variant="contained" color="ink">
                  Record your first take
                </Button>
              </Actions>
            </Box>
          ) : (
            recordings.map((r) => {
              const status = r.analysis_status ? STATUS[r.analysis_status] : null;
              const facts = [
                when(r.created_at),
                clock(r.duration_seconds),
                r.content_percent != null ? `content ${Math.round(r.content_percent)}%` : null,
                r.delivery_percent != null ? `delivery ${Math.round(r.delivery_percent)}%` : null,
              ].filter(Boolean).join(' · ');
              return (
                <Row
                  key={r.id}
                  title={(
                    <Box component={RouterLink} to={`/recordings/${r.id}`} sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {r.title}
                    </Box>
                  )}
                  detail={facts || undefined}
                  middle={<Pill tone={status?.tone ?? 'neutral'}>{status?.label ?? 'Not analysed'}</Pill>}
                  action={(
                    <Actions sx={{ gap: '4px', flexWrap: 'nowrap' }}>
                      <Button component={RouterLink} to={`/recordings/${r.id}`} variant="outlined" aria-label={`Open ${r.title}`}>
                        Open
                      </Button>
                      <Tooltip title="Delete this take">
                        <IconButton size="small" color="error" onClick={() => void handleDelete(r)} aria-label={`Delete ${r.title}`}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </Actions>
                  )}
                />
              );
            })
          )}
          {recordings.length > 0 && (
            <Detail sx={{ mt: '10px' }}>
              Each row is an audio file on this machine plus, where one was run, one analysis from the configured
              provider. Audio is never uploaded anywhere else.
            </Detail>
          )}
        </Panel>
      </Section>
    </Box>
  );
};
