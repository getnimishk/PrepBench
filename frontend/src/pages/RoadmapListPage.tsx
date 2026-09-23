// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import { Archive, Link2, Trash2 } from 'lucide-react';
import { getRoadmaps, createRoadmap, deleteRoadmap, updateRoadmap } from '../services/api';
import { RoadmapSummary } from '../types/roadmap';
import { RoadmapImportModal } from '../components/roadmap/RoadmapImportModal';
import { formatPercentage } from '../components/roadmap/progressDisplay';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import { LoadingState } from '../components/common/States';
import {
  Bar, Detail, Eyebrow, Grid, Metric, MetricRow, Note, PageHead, Panel, PanelHead, Section,
} from '../components/ui/primitives';
import { chooseRoadmap } from '../services/roadmapChoice';

const hours = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

/**
 * Roadmaps: every plan this preparation works from, as the prototype lays them
 * out -- a card per roadmap with its shape (phases, topics, hours) and its
 * progress, then a way to bring in another and the totals across them.
 *
 * Three groups, not one list:
 *
 *   mine       this preparation's roadmaps
 *   unlinked   belong to no preparation -- every roadmap imported before
 *              preparations could own one is here, by design
 *   (hidden)   another preparation's; showing them would break the promise
 *              that nothing is shared between preparations
 *
 * Unlinked roadmaps are shown rather than hidden because the learner imported
 * them, and losing them from view would be worse than saying plainly that they
 * are not linked yet. Outside a PreparationProvider nothing is selected, so
 * everything is shown.
 */
export const RoadmapListPage: React.FC = () => {
  const navigate = useNavigate();
  const { selected: preparation } = usePreparation();
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoadmapSummary | null>(null);

  const fetchRoadmaps = () => {
    setLoading(true);
    setFetchError(null);
    getRoadmaps()
      .then(setRoadmaps)
      .catch((err) => {
        console.error(err);
        setFetchError(loadFailed('Could not load your roadmaps', err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRoadmaps();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setActionError(null);
    try {
      // A roadmap made while a preparation is selected belongs to it. Left
      // unlinked, it would land in the "not linked" group of a screen the
      // learner was deliberately viewing for one preparation.
      const created = await createRoadmap({
        title: newTitle.trim(),
        // Omitted rather than sent as null when nothing is selected, so the
        // request is exactly what it was before preparations existed.
        ...(preparation ? { subject_id: preparation.id } : {}),
      });
      setCreateOpen(false);
      setNewTitle('');
      navigate(`/roadmaps/${created.id}`);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Failed to create roadmap.'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteRoadmap(deleteTarget.id);
      setDeleteTarget(null);
      fetchRoadmaps();
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Failed to delete roadmap.'));
    }
  };

  const handleArchive = async (roadmap: RoadmapSummary) => {
    setActionError(null);
    try {
      await updateRoadmap(roadmap.id, { is_archived: true });
      fetchRoadmaps();
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Failed to archive roadmap.'));
    }
  };

  const handleLink = async (roadmap: RoadmapSummary) => {
    if (!preparation) return;
    setActionError(null);
    try {
      await updateRoadmap(roadmap.id, { subject_id: preparation.id });
      fetchRoadmaps();
    } catch (err) {
      setActionError(apiErrorMessage(err, `Failed to link ${roadmap.title}.`));
    }
  };

  const mine = preparation ? roadmaps.filter((r) => r.subject_id === preparation.id) : roadmaps;
  const unlinked = preparation ? roadmaps.filter((r) => r.subject_id == null) : [];
  const visible = [...mine, ...unlinked];
  const active = chooseRoadmap(roadmaps, preparation?.id ?? null);

  if (loading) return <LoadingState label="Loading your roadmaps…" />;

  if (fetchError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchRoadmaps}>Retry</Button>}>
        {fetchError}
      </Alert>
    );
  }

  const totals = {
    topics: visible.reduce((n, r) => n + r.progress.total_topics, 0),
    // Planned hours only when every roadmap counted has them: a total over some
    // of them would read as the whole.
    planned: visible.every((r) => r.progress.total_estimated_hours != null)
      ? visible.reduce((n, r) => n + (r.progress.total_estimated_hours ?? 0), 0)
      : null,
    complete: visible.reduce((n, r) => n + r.progress.completed_count, 0),
    started: visible.some((r) => r.progress.completed_count + r.progress.in_progress_count > 0),
  };

  const card = (roadmap: RoadmapSummary, isUnlinked: boolean) => {
    const p = roadmap.progress;
    const pct = p.completion_percentage;
    return (
      <Panel
        key={roadmap.id}
        component="article"
        aria-labelledby={`roadmap-${roadmap.id}-title`}
        sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
        // The card's click is a convenience for the mouse; the title is the real link.
      >
        <Box
          onClick={() => navigate(`/roadmaps/${roadmap.id}`)}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Eyebrow>{roadmap.source_filename ? 'Imported roadmap' : 'Built here'}</Eyebrow>
            <Typography variant="h5" component="h2" id={`roadmap-${roadmap.id}-title`} sx={{ mt: '7px' }}>
              <Box
                component={RouterLink}
                to={`/roadmaps/${roadmap.id}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {roadmap.title}
              </Box>
            </Typography>
            <Detail>{roadmap.source_filename ?? 'manually created'}</Detail>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {isUnlinked && preparation && (
              <Tooltip title={`Link to ${preparation.name}`}>
                <IconButton size="small" onClick={() => handleLink(roadmap)} aria-label={`Link ${roadmap.title} to ${preparation.name}`}>
                  <Link2 size={16} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Archive">
              <IconButton size="small" onClick={() => handleArchive(roadmap)} aria-label={`Archive ${roadmap.title}`}>
                <Archive size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => setDeleteTarget(roadmap)} aria-label={`Delete ${roadmap.title}`}>
                <Trash2 size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box onClick={() => navigate(`/roadmaps/${roadmap.id}`)}>
          <MetricRow sx={{ mt: '12px' }}>
            <Metric value={roadmap.phase_count ?? '—'} label="phases" />
            <Metric value={p.total_topics} label="topics" />
            <Metric value={p.total_estimated_hours != null ? hours(p.total_estimated_hours) : '—'} label="estimated" />
          </MetricRow>
          {/* An empty bar would read as "0% done". With nothing to measure, no bar. */}
          {pct !== null && (
            <Bar
              value={pct}
              label={`${roadmap.title}: ${formatPercentage(pct)} of the topics marked done`}
              color={pct >= 100 ? 'success' : 'primary'}
              sx={{ mt: '13px' }}
            />
          )}
          <Detail sx={{ mt: '7px' }}>
            {p.total_topics === 0
              ? 'No topics yet'
              : `${p.completed_count} of ${p.total_topics} complete`
                + `${p.in_progress_count > 0 ? ` · ${p.in_progress_count} in progress` : ''}`
                + `${p.skipped_count > 0 ? ` · ${p.skipped_count} skipped` : ''}`
                + ` · ${formatPercentage(pct)}`
                + (p.completed_estimated_hours != null && p.total_estimated_hours != null
                  ? ` · ${hours(p.completed_estimated_hours)} of ${hours(p.total_estimated_hours)}`
                  : '')}
            {roadmap.weekly_hours_budget ? ` · ${roadmap.weekly_hours_budget}h a week` : ''}
          </Detail>
        </Box>
      </Panel>
    );
  };

  return (
    <Box>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}

      <PageHead
        eyebrow="Study Planning & Syllabus"
        title="Roadmaps"
        sub="Track end-to-end curriculum, competencies, and topic mastery. Each roadmap manages phases, learning objectives, and verification criteria."
        actions={(
          <>
            <Button variant="contained" onClick={() => setImportOpen(true)}>+ Import Roadmap</Button>
            <Button variant="outlined" onClick={() => setCreateOpen(true)}>New roadmap</Button>
            {active && (
              <Button variant="outlined" component={RouterLink} to={`/roadmaps/${active.roadmap.id}`}>
                Active Syllabus ({active.roadmap.title}) →
              </Button>
            )}
          </>
        )}
      />

      {visible.length === 0 ? (
        <Section>
          <Note>
            No roadmaps yet. Import an .xlsx, .json, .md or .csv syllabus to get started, or create an empty one and
            add phases yourself.
          </Note>
        </Section>
      ) : (
        <>
          {mine.length === 0 && preparation && (
            <Section>
              <Note>{preparation.name} has no roadmap yet. Import or create one, or link one of the roadmaps below.</Note>
            </Section>
          )}
          {mine.length > 0 && (
            <Section>
              <Grid columns={2}>{mine.map((r) => card(r, false))}</Grid>
            </Section>
          )}
          {unlinked.length > 0 && (
            <Section component="section" aria-labelledby="unlinked-heading">
              <Eyebrow component="h2" id="unlinked-heading">Not linked to a preparation</Eyebrow>
              <Detail sx={{ mb: '12px' }}>
                These belong to no preparation yet. Link one to {preparation?.name} to track it there.
              </Detail>
              <Grid columns={2}>{unlinked.map((r) => card(r, true))}</Grid>
            </Section>
          )}
        </>
      )}

      <Section>
        <Grid columns={2}>
          <Panel component="section" aria-labelledby="roadmap-import-heading">
            <PanelHead
              eyebrow="Import"
              title="Bring in another roadmap"
              titleId="roadmap-import-heading"
              aside={<Button variant="contained" color="ink" onClick={() => setImportOpen(true)}>Import</Button>}
            />
            <Detail>Excel, CSV, JSON or Markdown — one row per topic, each with its learning objective and success criterion.</Detail>
          </Panel>
          <Panel soft component="section" aria-labelledby="roadmap-totals-heading">
            <Eyebrow component="h2" id="roadmap-totals-heading">Across all roadmaps</Eyebrow>
            <MetricRow>
              <Metric value={visible.length} label="roadmaps" />
              <Metric value={totals.topics} label="topics" />
              <Metric value={totals.planned != null ? hours(totals.planned) : '—'} label="planned" />
              <Metric value={totals.complete} label="complete" />
            </MetricRow>
            {visible.length > 0 && !totals.started && (
              <Note sx={{ mt: '14px' }}>
                Nothing has been started yet. A topic is complete only when it has been demonstrated against its
                success criterion.
              </Note>
            )}
          </Panel>
        </Grid>
      </Section>

      <RoadmapImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async (roadmapId) => {
          setImportOpen(false);
          // The import endpoint has no preparation field, so the link is made
          // here with the ordinary update. If it fails the roadmap still exists
          // -- it simply appears in the "not linked" group, one click from fixed
          // -- so the failure is reported rather than blocking the navigation.
          if (preparation) {
            try {
              await updateRoadmap(roadmapId, { subject_id: preparation.id });
            } catch (err) {
              setActionError(apiErrorMessage(
                err,
                `Imported, but could not link it to ${preparation.name}. Link it from the list.`,
              ));
              fetchRoadmaps();
              return;
            }
          }
          navigate(`/roadmaps/${roadmapId}`);
        }}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New roadmap</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Title" sx={{ mt: 1 }}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Apache Kafka Mastery"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete roadmap?</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            This permanently deletes <strong>{deleteTarget?.title}</strong> along with all its phases,
            topics, and recorded progress. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
