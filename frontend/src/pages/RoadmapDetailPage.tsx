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
  RoadmapDetail, RoadmapResource, RoadmapSchedule, RoadmapTopic, RoadmapTopicStatus,
} from '../types/roadmap';
import { RoadmapTableView, type StatusFilter } from '../components/roadmap/RoadmapTableView';
import { RoadmapJourneyView } from '../components/roadmap/RoadmapJourneyView';
import { RoadmapGanttView } from '../components/roadmap/RoadmapGanttView';
import { formatPercentage } from '../components/roadmap/progressDisplay';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { LoadingState } from '../components/common/States';
import { Bar, BigFigure, Detail, Eyebrow, Grid, PageHead, Panel, Section } from '../components/ui/primitives';
import { MONO_STACK } from '../theme/tokens';

/** What a tab shows. 'resources' is the single-sheet view's one tab holding every reference table. */
type TabKind = 'syllabus' | 'tracker' | 'resource' | 'journey' | 'gantt' | 'resources';

interface TabSpec {
  /** Stable across reloads: 'sheet:<index>', 'view:journey', 'view:schedule', ... */
  key: string;
  label: string;
  kind: TabKind;
  resource?: RoadmapResource;
  /** Further sheets of the same kind whose rows were merged into this one. */
  alsoFrom?: string[];
}

/**
 * The page's tabs. One roadmap sheet or none: exactly the original views. More
 * than one: a tab per sheet in workbook order, then the app's own views (Phase
 * overview only when no tracker sheet already shows the journey, then Schedule).
 * Several syllabus (or tracker) sheets have already been merged into one set of
 * topics, so they share the first one's tab.
 */
function buildTabs(roadmap: RoadmapDetail): TabSpec[] {
  const { sheets, resources } = roadmap;
  if (sheets.length <= 1) {
    const single: TabSpec[] = [
      { key: 'view:table', label: 'Syllabus', kind: 'syllabus' },
      { key: 'view:journey', label: 'Phase overview', kind: 'journey' },
      { key: 'view:schedule', label: 'Schedule', kind: 'gantt' },
    ];
    if (resources.length > 0) {
      single.push({ key: 'view:resources', label: `Reference tables (${resources.length})`, kind: 'resources' });
    }
    return single;
  }

  const tabs: TabSpec[] = [];
  const byKind = new Map<'syllabus' | 'tracker', TabSpec>();
  sheets.forEach((sheet, index) => {
    if (sheet.kind === 'resource') {
      const resource = resources.find((r) => r.id === sheet.resource_id);
      if (resource) tabs.push({ key: `sheet:${index}`, label: sheet.name, kind: 'resource', resource });
      return;
    }
    const first = byKind.get(sheet.kind);
    if (first) {
      first.alsoFrom = [...(first.alsoFrom ?? []), sheet.name];
      return;
    }
    const tab: TabSpec = { key: `sheet:${index}`, label: sheet.name, kind: sheet.kind };
    byKind.set(sheet.kind, tab);
    tabs.push(tab);
  });
  if (!byKind.has('tracker')) tabs.push({ key: 'view:journey', label: 'Phase overview', kind: 'journey' });
  tabs.push({ key: 'view:schedule', label: 'Schedule', kind: 'gantt' });
  return tabs;
}

const ResourceTable: React.FC<{ resource: RoadmapResource }> = ({ resource }) => (
  <Section>
    <Panel component="section" aria-labelledby={`resource-${resource.id}`}>
      <Eyebrow>Sheet</Eyebrow>
      <Typography variant="h5" component="h2" id={`resource-${resource.id}`} sx={{ mb: '12px' }}>
        {resource.title}
      </Typography>
      {/* Scrolls sideways on a phone, so it must be reachable from the keyboard. */}
      <TableContainer sx={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={`${resource.title} table`}>
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
);

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
  // A key, not a position: tabs come from the workbook and are rebuilt on every refresh.
  const [tabKey, setTabKey] = useState<string | null>(null);
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
  const tabs = buildTabs(roadmap);
  const activeTab = tabs.find((t) => t.key === tabKey) ?? tabs[0];
  const multiSheet = roadmap.sheets.length > 1;
  const journeyKey = tabs.find((t) => t.kind === 'tracker' || t.kind === 'journey')?.key ?? 'view:journey';
  const syllabusKey = tabs.find((t) => t.kind === 'syllabus')?.key;
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
            <Button variant="outlined" onClick={() => setTabKey(journeyKey)}>Phase overview</Button>
            <Button variant="outlined" component={RouterLink} to={`/roadmaps/${id}/edit`}>Edit plan</Button>
            {!multiSheet && roadmap.resources.length > 0 && (
              <Button variant="outlined" onClick={() => setTabKey('view:resources')}>
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
        value={activeTab.key}
        onChange={(_, value) => setTabKey(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Roadmap views"
        sx={{ mt: '22px', borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((t) => <Tab key={t.key} label={t.label} value={t.key} />)}
      </Tabs>

      {activeTab.alsoFrom && activeTab.alsoFrom.length > 0 && (
        <Detail sx={{ mt: '12px' }}>Also includes topics from: {activeTab.alsoFrom.join(', ')}</Detail>
      )}

      {activeTab.kind === 'syllabus' && (
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

      {(activeTab.kind === 'journey' || activeTab.kind === 'tracker') && (
        <RoadmapJourneyView
          roadmapId={id}
          phases={roadmap.phases}
          onOpenPhase={(phaseId) => {
            setPhaseFilter(phaseId);
            setStatusFilter('all');
            if (syllabusKey) setTabKey(syllabusKey);
          }}
        />
      )}

      {activeTab.kind === 'gantt' && schedule && (
        <RoadmapGanttView schedule={schedule} onConfigureSchedule={() => setScheduleOpen(true)} />
      )}

      {activeTab.kind === 'resource' && activeTab.resource && <ResourceTable resource={activeTab.resource} />}

      {activeTab.kind === 'resources' && (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {roadmap.resources.map((resource) => <ResourceTable key={resource.id} resource={resource} />)}
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
