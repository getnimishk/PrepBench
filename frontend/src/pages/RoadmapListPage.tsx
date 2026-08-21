import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Grid, LinearProgress, Alert,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField,
} from '@mui/material';
import { Upload, Plus, Map, Trash2, Archive, Clock } from 'lucide-react';
import { getRoadmaps, createRoadmap, deleteRoadmap, updateRoadmap } from '../services/api';
import { RoadmapSummary } from '../types/roadmap';
import { RoadmapImportModal } from '../components/roadmap/RoadmapImportModal';
import { formatPercentage, progressCaption, hoursCaption } from '../components/roadmap/progressDisplay';
import { apiErrorMessage } from '../services/apiError';

export const RoadmapListPage: React.FC = () => {
  const navigate = useNavigate();
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
        setFetchError('Failed to load roadmaps. Please check backend connection.');
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
      const created = await createRoadmap({ title: newTitle.trim() });
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

  if (loading) return <LinearProgress />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchRoadmaps}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Learning Roadmaps</Typography>
          <Typography variant="body2" color="text.secondary">
            Track a curriculum end to end — import one, or build it yourself.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" startIcon={<Upload size={18} />} onClick={() => setImportOpen(true)}>
            Import Roadmap
          </Button>
          <Button variant="outlined" startIcon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
            New Roadmap
          </Button>
        </Box>
      </Box>

      {roadmaps.length === 0 ? (
        <Alert severity="info" icon={<Map size={20} />} sx={{ mt: 3 }}>
          No roadmaps yet. Import an <strong>.xlsx</strong>, <strong>.json</strong>, <strong>.md</strong>, or{' '}
          <strong>.csv</strong> syllabus to get started, or create an empty one and add phases yourself.
        </Alert>
      ) : (
        <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
          {roadmaps.map((roadmap) => {
            const pct = roadmap.progress.completion_percentage;
            const hours = hoursCaption(roadmap.progress);
            return (
              <Grid item xs={12} md={6} key={roadmap.id}>
                <Card
                  sx={{
                    height: '100%', borderRadius: 3, boxShadow: 'none',
                    border: '1px solid', borderColor: 'divider', cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  }}
                  onClick={() => navigate(`/roadmaps/${roadmap.id}`)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{roadmap.title}</Typography>
                        {roadmap.source_filename && (
                          <Typography variant="caption" color="text.secondary">
                            {roadmap.source_filename}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
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

                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        {formatPercentage(pct)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {progressCaption(roadmap.progress)}
                      </Typography>
                    </Box>

                    {/* An indeterminate-looking empty bar would read as "0% done".
                        With nothing to measure, show no bar at all. */}
                    {pct !== null && (
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{ mt: 1, height: 8, borderRadius: 5 }}
                        color={pct >= 100 ? 'success' : 'primary'}
                      />
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                      {hours && <Chip size="small" variant="outlined" icon={<Clock size={13} />} label={hours} />}
                      {roadmap.weekly_hours_budget && (
                        <Chip size="small" variant="outlined" label={`${roadmap.weekly_hours_budget}h / week`} />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <RoadmapImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(roadmapId) => {
          setImportOpen(false);
          navigate(`/roadmaps/${roadmapId}`);
        }}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New Roadmap</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Title" sx={{ mt: 1 }}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Apache Kafka Mastery"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete roadmap?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This permanently deletes <strong>{deleteTarget?.title}</strong> along with all its phases,
            topics, and recorded progress. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
