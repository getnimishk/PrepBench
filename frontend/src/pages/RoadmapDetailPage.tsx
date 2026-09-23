// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import {
  getRoadmap, getRoadmapSchedule, updateRoadmapTopic, updateRoadmap,
} from '../services/api';
import {
  RoadmapDetail, RoadmapSchedule, RoadmapTopic, RoadmapTopicStatus,
} from '../types/roadmap';
import { RoadmapTableView, type StatusFilter } from '../components/roadmap/RoadmapTableView';
import { RoadmapJourneyView } from '../components/roadmap/RoadmapJourneyView';
import { RoadmapGanttView } from '../components/roadmap/RoadmapGanttView';
import { formatPercentage } from '../components/roadmap/progressDisplay';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { LoadingState } from '../components/common/States';
import { Bar, BigFigure, Detail, Eyebrow, Grid, PageHead, Panel, Section } from '../components/ui/primitives';
import { MONO_STACK } from '../theme/tokens';

type ViewTab = 'table' | 'journey' | 'gantt' | 'resources';

const hours = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

/**
 * One roadmap: the prototype's syllabus, with its phase overview, the schedule
 * and the reference tables as tabs of the same page.
 *
 * The four panels at the top are the prototype's -- progress, phases, effort,
 * weekly budget. They replaced a single line and bar that had in turn replaced
 * three KPI cards reading 0%, 0% and an em dash on an unstarted roadmap. What
 * made those cards wrong is kept out of these: a figure that cannot be computed
 * says why ("Not set", "Some topics have no estimate") rather than showing a
 * zero, and the progress is "marked done", the learner's own record, not a
 * measurement.
 */
export const RoadmapDetailPage: React.FC = () => {
  const { roadmapId } = useParams<{ roadmapId: string }>();
  const id = roadmapId ? parseInt(roadmapId, 10) : 0;

  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);
  const [schedule, setSchedule] = useState<RoadmapSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>('table');
  const [busyTopicId, setBusyTopicId] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<'all' | number>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [notesTopic, setNotesTopic] = useState<RoadmapTopic | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  // "Plan saved." from the editor, shown once on arrival.
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );

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
        setFetchError(loadFailed('Could not load this roadmap', err));
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshQuietly = async () => {
    // Re-fetch without flipping the page back into its loading state -- a
    // status change shouldn't blank the table the user is working in.
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
  if (loading) return <LoadingState label="Loading this roadmap…" />;

  if (fetchError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
        {fetchError}
      </Alert>
    );
  }

  if (!roadmap) return <Alert severity="error">Roadmap #{id} not found.</Alert>;

  const p = roadmap.progress;
  const pct = p.completion_percentage;
  const phaseCount = roadmap.phases.length;
  const phasesWithTopics = roadmap.phases.filter((ph) => ph.topics.length > 0).length;
  const totalHours = p.total_estimated_hours;
  const perTopic = totalHours != null && p.total_topics > 0 ? totalHours / p.total_topics : null;

  return (
    <Box>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      <PageHead
        eyebrow="Roadmap"
        title={roadmap.title}
        sub={`${roadmap.source_filename ?? 'Built here'} · every topic carries a learning objective and a success criterion, which is what marks it complete.`}
        actions={(
          <>
            <Button variant="outlined" component={RouterLink} to="/roadmaps">← All roadmaps</Button>
            <Button variant="outlined" onClick={() => setTab('journey')}>Phase overview</Button>
            <Button variant="outlined" component={RouterLink} to={`/roadmaps/${id}/edit`}>Edit plan</Button>
            {roadmap.resources.length > 0 && (
              <Button variant="outlined" onClick={() => setTab('resources')}>
                Reference tables ({roadmap.resources.length})
              </Button>
            )}
          </>
        )}
      />

      <Section>
        <Grid columns={4}>
          <Panel>
            <Eyebrow>Progress</Eyebrow>
            <BigFigure size={26}>{p.completed_count} / {p.total_topics}</BigFigure>
            {/* An empty bar would read as "0% done"; with nothing to measure, none. */}
            {pct !== null && (
              <Bar
                value={pct}
                label={`${formatPercentage(pct)} of the topics marked done`}
                color={pct >= 100 ? 'success' : 'primary'}
                sx={{ mt: '9px' }}
              />
            )}
            <Detail sx={{ mt: '7px' }}>
              {pct !== null ? `${formatPercentage(pct)} marked done` : 'No topics to count'}
              {p.in_progress_count > 0 ? ` · ${p.in_progress_count} in progress` : ''}
            </Detail>
          </Panel>
          <Panel>
            <Eyebrow>Phases</Eyebrow>
            <BigFigure size={26}>{phaseCount}</BigFigure>
            <Detail>{phasesWithTopics === phaseCount ? 'every one with topics' : `${phasesWithTopics} with topics`}</Detail>
          </Panel>
          <Panel>
            <Eyebrow>Estimated effort</Eyebrow>
            <BigFigure size={26}>{totalHours != null ? hours(totalHours) : '—'}</BigFigure>
            <Detail>
              {perTopic != null
                ? `${perTopic.toFixed(1)}h per topic average`
                // Null means at least one topic has no estimate, so a total would
                // measure only part of the roadmap. Said, not omitted.
                : 'Some topics have no hours estimate'}
            </Detail>
          </Panel>
          <Panel>
            <Eyebrow>Weekly budget</Eyebrow>
            <BigFigure size={26}>{roadmap.weekly_hours_budget ? `${roadmap.weekly_hours_budget}h` : 'Not set'}</BigFigure>
            <Detail>
              {schedule?.projected_end_date
                ? `on track to finish ${schedule.projected_end_date}`
                : roadmap.weekly_hours_budget
                  ? 'add a start date to project a finish date'
                  : 'set one to project a finish date'}
            </Detail>
            <Button variant="outlined" sx={{ mt: '9px' }} onClick={() => setScheduleOpen(true)}>
              {roadmap.weekly_hours_budget ? 'Change budget' : 'Set budget'}
            </Button>
          </Panel>
        </Grid>
      </Section>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Roadmap views"
        sx={{ mt: '22px', borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Syllabus" value="table" />
        <Tab label="Phase overview" value="journey" />
        <Tab label="Schedule" value="gantt" />
        {roadmap.resources.length > 0 && (
          <Tab label={`Reference tables (${roadmap.resources.length})`} value="resources" />
        )}
      </Tabs>

      {tab === 'table' && (
        <RoadmapTableView
          roadmapId={id}
          phases={roadmap.phases}
          onStatusChange={handleStatusChange}
          busyTopicId={busyTopicId}
          onOpenNotes={(topic) => {
            setNotesTopic(topic);
            setNotesDraft(topic.evidence_notes || '');
          }}
          phaseFilter={phaseFilter}
          onPhaseFilterChange={setPhaseFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      )}

      {tab === 'journey' && (
        <RoadmapJourneyView
          roadmapId={id}
          phases={roadmap.phases}
          onOpenPhase={(phaseId) => {
            setPhaseFilter(phaseId);
            setStatusFilter('all');
            setTab('table');
          }}
        />
      )}

      {tab === 'gantt' && schedule && (
        <RoadmapGanttView schedule={schedule} onConfigureSchedule={() => setScheduleOpen(true)} />
      )}

      {tab === 'resources' && (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {roadmap.resources.map((resource) => (
            <Section key={resource.id}>
              <Panel component="section" aria-labelledby={`resource-${resource.id}`}>
                <Eyebrow>Sheet</Eyebrow>
                <Typography variant="h5" component="h2" id={`resource-${resource.id}`} sx={{ mb: '12px' }}>
                  {resource.title}
                </Typography>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {resource.columns.map((column) => <TableCell key={column}>{column}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {resource.rows.map((row, index) => (
                        <TableRow key={index}>
                          {row.map((cell, cellIndex) => (
                            <TableCell
                              key={cellIndex}
                              sx={cellIndex > 0
                                ? { fontFamily: MONO_STACK, fontSize: (t) => t.typography.pxToRem(11), color: 'text.secondary' }
                                : { fontWeight: 700 }}
                            >
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Panel>
            </Section>
          ))}
        </Box>
      )}

      <Dialog open={!!notesTopic} onClose={() => setNotesTopic(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Evidence & notes</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
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
        <DialogActions>
          <Button variant="outlined" onClick={() => setNotesTopic(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveNotes}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Schedule settings</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            The timeline is projected from your estimated hours and how much you study each week —
            both are needed to draw it.
          </Typography>
          <TextField
            fullWidth type="date" label="Start date" sx={{ mb: 2 }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true }
            }}
          />
          <TextField
            fullWidth type="number" label="Study hours per week"
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(e.target.value)}
            slotProps={{
              htmlInput: { min: 1, step: 1 }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setScheduleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSchedule}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
