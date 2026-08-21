import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, LinearProgress, Alert, Button, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import { ArrowLeft, Clock, CalendarDays } from 'lucide-react';
import {
  getRoadmap, getRoadmapSchedule, updateRoadmapTopic, updateRoadmap,
} from '../services/api';
import {
  RoadmapDetail, RoadmapSchedule, RoadmapTopic, RoadmapTopicStatus,
} from '../types/roadmap';
import { RoadmapTableView } from '../components/roadmap/RoadmapTableView';
import { RoadmapJourneyView } from '../components/roadmap/RoadmapJourneyView';
import { RoadmapGanttView } from '../components/roadmap/RoadmapGanttView';
import { formatPercentage, progressCaption, hoursCaption } from '../components/roadmap/progressDisplay';
import { apiErrorMessage } from '../services/apiError';

type ViewTab = 'table' | 'journey' | 'gantt' | 'resources';

export const RoadmapDetailPage: React.FC = () => {
  const { roadmapId } = useParams<{ roadmapId: string }>();
  const navigate = useNavigate();
  const id = roadmapId ? parseInt(roadmapId, 10) : 0;

  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);
  const [schedule, setSchedule] = useState<RoadmapSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>('table');
  const [busyTopicId, setBusyTopicId] = useState<number | null>(null);

  const [notesTopic, setNotesTopic] = useState<RoadmapTopic | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    Promise.all([getRoadmap(id), getRoadmapSchedule(id)])
      .then(([detail, sched]) => {
        setRoadmap(detail);
        setSchedule(sched);
        setStartDate(detail.start_date || '');
        setWeeklyHours(detail.weekly_hours_budget ? String(detail.weekly_hours_budget) : '');
      })
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load this roadmap. Please check backend connection.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshQuietly = async () => {
    // Re-fetch without flipping the page back into its loading skeleton --
    // a status change shouldn't blank the table the user is working in.
    try {
      const [detail, sched] = await Promise.all([getRoadmap(id), getRoadmapSchedule(id)]);
      setRoadmap(detail);
      setSchedule(sched);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (topic: RoadmapTopic, status: RoadmapTopicStatus) => {
    setBusyTopicId(topic.id);
    setActionError(null);
    try {
      await updateRoadmapTopic(id, topic.id, { status });
      await refreshQuietly();
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Failed to update this topic.'));
    } finally {
      setBusyTopicId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesTopic) return;
    setActionError(null);
    try {
      await updateRoadmapTopic(id, notesTopic.id, { evidence_notes: notesDraft || null });
      setNotesTopic(null);
      await refreshQuietly();
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Failed to save notes.'));
    }
  };

  const handleSaveSchedule = async () => {
    setActionError(null);
    try {
      await updateRoadmap(id, {
        start_date: startDate || null,
        weekly_hours_budget: weeklyHours ? Number(weeklyHours) : null,
      });
      setScheduleOpen(false);
      await refreshQuietly();
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Failed to update the schedule.'));
    }
  };

  if (!id) return <Alert severity="error">Invalid roadmap id.</Alert>;
  if (loading) return <LinearProgress />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (!roadmap) return <Alert severity="error">Roadmap #{id} not found.</Alert>;

  const pct = roadmap.progress.completion_percentage;
  const hours = hoursCaption(roadmap.progress);

  return (
    <Box>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate('/roadmaps')} sx={{ mb: 1 }}>
        All roadmaps
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{roadmap.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {progressCaption(roadmap.progress)}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<CalendarDays size={16} />} onClick={() => setScheduleOpen(true)}>
          Schedule settings
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mt: 0.5, mb: 1 }}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Topics complete</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{formatPercentage(pct)}</Typography>
              {pct !== null && (
                <LinearProgress
                  variant="determinate" value={pct}
                  color={pct >= 100 ? 'success' : 'primary'}
                  sx={{ mt: 1, height: 6, borderRadius: 5 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Hours complete</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {formatPercentage(roadmap.progress.hours_percentage)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {/* Null means at least one topic has no estimate, so an hours
                    figure would be measuring only part of the roadmap. */}
                {hours ?? 'Some topics have no hours estimate'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Projected finish</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                {schedule?.projected_end_date ?? '—'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {roadmap.weekly_hours_budget && (
                  <Chip size="small" variant="outlined" icon={<Clock size={13} />} label={`${roadmap.weekly_hours_budget}h / wk`} />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Table" value="table" />
        <Tab label="Journey" value="journey" />
        <Tab label="Schedule" value="gantt" />
        {roadmap.resources.length > 0 && (
          <Tab label={`Reference (${roadmap.resources.length})`} value="resources" />
        )}
      </Tabs>

      {tab === 'table' && (
        <RoadmapTableView
          phases={roadmap.phases}
          onStatusChange={handleStatusChange}
          busyTopicId={busyTopicId}
          onOpenNotes={(topic) => {
            setNotesTopic(topic);
            setNotesDraft(topic.evidence_notes || '');
          }}
        />
      )}

      {tab === 'journey' && (
        <Box sx={{ mt: 3 }}>
          <RoadmapJourneyView phases={roadmap.phases} />
        </Box>
      )}

      {tab === 'gantt' && schedule && (
        <RoadmapGanttView schedule={schedule} onConfigureSchedule={() => setScheduleOpen(true)} />
      )}

      {tab === 'resources' && (
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {roadmap.resources.map((resource) => (
            <Box key={resource.id}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{resource.title}</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {resource.columns.map((column) => (
                        <TableCell key={column} sx={{ fontWeight: 700 }}>{column}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resource.rows.map((row, index) => (
                      <TableRow key={index}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Typography variant="body2" sx={{ fontFamily: cellIndex > 0 ? 'monospace' : undefined, fontSize: '0.8rem' }}>
                              {cell}
                            </Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={!!notesTopic} onClose={() => setNotesTopic(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Evidence & notes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {notesTopic?.title}
          </Typography>
          {notesTopic?.success_criteria && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Success criteria:</strong> {notesTopic.success_criteria}
            </Alert>
          )}
          <TextField
            autoFocus fullWidth multiline minRows={4}
            label="What did you build or learn?"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNotesTopic(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveNotes}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Schedule settings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The timeline is projected from your estimated hours and how much you study each week —
            both are needed to draw it.
          </Typography>
          <TextField
            fullWidth type="date" label="Start date" sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <TextField
            fullWidth type="number" label="Study hours per week"
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(e.target.value)}
            inputProps={{ min: 1, step: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScheduleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSchedule}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
