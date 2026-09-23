// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton,
  InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import { getDraftRoadmapSchedule, getRoadmap, saveRoadmapPlan } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { ErrorState, LoadingState } from '../components/common/States';
import {
  Detail, Eyebrow, Grid, Metric, MetricRow, Note, PageHead, Panel, PanelHead, Section,
} from '../components/ui/primitives';
import type { RoadmapDetail, RoadmapSchedule } from '../types/roadmap';

/**
 * Edit plan: the shape of a roadmap and the time you can give it.
 *
 * Title, weekly budget, start date, and the phases -- renamed, reordered, added
 * or removed -- saved together or not at all. Topic status is not set here: a
 * topic is complete when its success criterion is demonstrated, and reshaping a
 * plan is not evidence of anything.
 *
 * So removing a phase never deletes topics. A phase that holds some asks where
 * they should go, and they move there with their status, notes and
 * demonstrations. Nothing is written until Save plan.
 *
 * The finish date shown while typing is the server's own projection of the
 * unsaved budget and start date, the same calculation as the saved schedule. With
 * either missing it says what is missing rather than assuming a pace.
 */

interface DraftPhase {
  /** Stable across reordering: `p-<id>` for a saved phase, `new-<n>` for an added one. */
  key: string;
  id: number | null;
  name: string;
  topics: number;
  completed: number;
  hours: number;
  unestimated: number;
}

interface DraftRemoval {
  id: number;
  name: string;
  topics: number;
  /** The key of the kept phase its topics move to; null when it held none. */
  moveTo: string | null;
}

const MAX_WEEKLY_HOURS = 168;

function phasesOf(roadmap: RoadmapDetail): DraftPhase[] {
  return roadmap.phases.map((phase) => ({
    key: `p-${phase.id}`,
    id: phase.id,
    name: phase.name,
    topics: phase.topics.length,
    completed: phase.topics.filter((t) => t.status === 'completed').length,
    hours: phase.topics.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0),
    unestimated: phase.topics.filter((t) => t.estimated_hours == null).length,
  }));
}

function hoursText(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The projection, in a sentence. Every figure in it came from the server. */
function projectionText(schedule: RoadmapSchedule): string {
  const left = schedule.remaining_estimated_hours;
  const leftText = left == null ? null : `${hoursText(left)} of estimated work left`;
  const unestimated = schedule.unschedulable_topic_count
    ? ` ${plural(schedule.unschedulable_topic_count, 'topic has', 'topics have')} no estimate and ${schedule.unschedulable_topic_count === 1 ? 'is' : 'are'} left out.`
    : '';

  if (schedule.schedule_available && schedule.projected_end_date && schedule.weekly_hours_budget) {
    const begin = localDate([schedule.start_date ?? todayIso(), todayIso()].sort()[1]);
    const end = localDate(schedule.projected_end_date);
    const days = Math.round((end.getTime() - begin.getTime()) / 86_400_000) + 1;
    const weeks = Math.max(1, Math.ceil(days / 7));
    const finish = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${leftText ?? 'The remaining work'} at ${hoursText(schedule.weekly_hours_budget)} a week: about ${plural(weeks, 'week', 'weeks')}, finishing ${finish}.${unestimated}`;
  }
  switch (schedule.reason) {
    case 'no_topics':
      return 'This plan has no topics yet, so there is nothing to schedule.';
    case 'no_time_estimates':
      return 'No topic has an hours estimate, so no finish date can be projected.';
    case 'no_start_date':
      return `${leftText ? `${leftText}. ` : ''}Set a start date to project a finish date.`;
    case 'no_weekly_budget':
      return `${leftText ? `${leftText}. ` : ''}Set a weekly budget to project a finish date.`;
    default:
      return 'No finish date can be projected yet.';
  }
}

export const RoadmapEditorPage: React.FC = () => {
  const { roadmapId } = useParams<{ roadmapId: string }>();
  const id = Number(roadmapId);
  const navigate = useNavigate();

  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [phases, setPhases] = useState<DraftPhase[]>([]);
  const [removals, setRemovals] = useState<DraftRemoval[]>([]);
  const added = useRef(0);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; stale: boolean } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removing, setRemoving] = useState<{ key: string; target: string } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setLoadError('There is no roadmap at this address.');
      return;
    }
    setLoadError(null);
    setRoadmap(null);
    getRoadmap(id)
      .then((detail) => {
        setRoadmap(detail);
        setTitle(detail.title);
        setBudget(detail.weekly_hours_budget != null ? String(detail.weekly_hours_budget) : '');
        setStartDate(detail.start_date ?? '');
        setPhases(phasesOf(detail));
        setRemovals([]);
        setSaveError(null);
      })
      .catch((err) => setLoadError(apiErrorMessage(err, '')));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const original = useMemo(
    () => new Map((roadmap ? phasesOf(roadmap) : []).map((p) => [p.key, p])),
    [roadmap],
  );

  // ---- validity and change ----------------------------------------------

  const budgetNumber = budget.trim() === '' ? null : Number(budget);
  const budgetInvalid = budgetNumber !== null
    && (!Number.isFinite(budgetNumber) || budgetNumber <= 0 || budgetNumber > MAX_WEEKLY_HOURS);
  const titleInvalid = title.trim() === '';
  const unnamed = phases.findIndex((p) => p.name.trim() === '');

  const dirty = useMemo(() => {
    if (!roadmap) return false;
    const now = JSON.stringify({
      title: title.trim(), budget: budgetNumber, start: startDate || null,
      phases: phases.map((p) => [p.id, p.name.trim()]), removals: removals.map((r) => [r.id, r.moveTo]),
    });
    const was = JSON.stringify({
      title: roadmap.title, budget: roadmap.weekly_hours_budget ?? null, start: roadmap.start_date ?? null,
      phases: roadmap.phases.map((p) => [p.id, p.name]), removals: [],
    });
    return now !== was;
  }, [roadmap, title, budgetNumber, startDate, phases, removals]);

  // Leaving the tab with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ---- the projection -----------------------------------------------------

  const [projection, setProjection] = useState<
    { state: 'waiting' } | { state: 'ready'; schedule: RoadmapSchedule } | { state: 'failed' }
  >({ state: 'waiting' });

  useEffect(() => {
    if (!roadmap || budgetInvalid) return undefined;
    let cancelled = false;
    setProjection({ state: 'waiting' });
    const timer = setTimeout(() => {
      getDraftRoadmapSchedule(id, { start_date: startDate || null, weekly_hours_budget: budgetNumber })
        .then((schedule) => { if (!cancelled) setProjection({ state: 'ready', schedule }); })
        .catch(() => { if (!cancelled) setProjection({ state: 'failed' }); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [roadmap, id, startDate, budgetNumber, budgetInvalid]);

  // ---- phases -------------------------------------------------------------

  const incoming = (key: string) => removals.filter((r) => r.moveTo === key);

  const rename = (key: string, name: string) =>
    setPhases((list) => list.map((p) => (p.key === key ? { ...p, name } : p)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= phases.length || from === to) return;
    setPhases((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const addPhase = () => {
    added.current += 1;
    setPhases((list) => [
      ...list,
      { key: `new-${added.current}`, id: null, name: '', topics: 0, completed: 0, hours: 0, unestimated: 0 },
    ]);
  };

  const applyRemoval = (key: string, target: string | null) => {
    const phase = phases.find((p) => p.key === key);
    if (!phase) return;
    setRemovals((list) => [
      ...list.map((r) => (r.moveTo === key ? { ...r, moveTo: target } : r)),
      ...(phase.id !== null
        ? [{ id: phase.id, name: original.get(phase.key)?.name ?? phase.name, topics: phase.topics, moveTo: phase.topics ? target : null }]
        : []),
    ]);
    setPhases((list) => list.filter((p) => p.key !== key));
    setRemoving(null);
  };

  const askToRemove = (key: string) => {
    const phase = phases.find((p) => p.key === key);
    if (!phase) return;
    const holding = phase.topics + incoming(key).reduce((n, r) => n + r.topics, 0);
    if (holding === 0) {
      applyRemoval(key, null);
      return;
    }
    const other = phases.find((p) => p.key !== key);
    setRemoving({ key, target: other?.key ?? '' });
  };

  const keep = (removal: DraftRemoval) => {
    const saved = original.get(`p-${removal.id}`);
    if (!saved) return;
    setRemovals((list) => list.filter((r) => r.id !== removal.id));
    setPhases((list) => [...list, { ...saved }]);
  };

  // ---- save ---------------------------------------------------------------

  const save = async () => {
    if (!roadmap) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveRoadmapPlan(roadmap.id, {
        title: title.trim(),
        start_date: startDate || null,
        weekly_hours_budget: budgetNumber,
        phases: phases.map((p) => ({ id: p.id, name: p.name.trim() })),
        removed_phases: removals.map((r) => ({
          id: r.id,
          move_topics_to: r.moveTo === null ? null : phases.findIndex((p) => p.key === r.moveTo),
        })),
      });
      navigate(`/roadmaps/${roadmap.id}`, { state: { notice: 'Plan saved.' } });
    } catch (err) {
      const stale = (err as { response?: { status?: number } })?.response?.status === 409;
      setSaveError({ message: `${apiErrorMessage(err, 'Could not save the plan.')}${stale ? '' : ' Nothing was saved.'}`, stale });
      setSaving(false);
    }
  };

  const leave = () => {
    if (dirty) setConfirmLeave(true);
    else navigate(`/roadmaps/${id}`);
  };

  // ---- render -------------------------------------------------------------

  if (loadError !== null) {
    return (
      <Box>
        <PageHead eyebrow="Roadmap · edit" title="Edit plan" />
        <ErrorState what="Could not load this plan" saved="nothing_to_save" detail={loadError || undefined} onRetry={load} />
      </Box>
    );
  }
  if (!roadmap) return <LoadingState label="Loading this plan…" />;

  const totalTopics = phases.reduce((n, p) => n + p.topics, 0) + removals.reduce((n, r) => n + r.topics, 0);
  const totalHours = phases.reduce((n, p) => n + p.hours, 0)
    + removals.reduce((n, r) => n + (original.get(`p-${r.id}`)?.hours ?? 0), 0);
  const totalUnestimated = phases.reduce((n, p) => n + p.unestimated, 0)
    + removals.reduce((n, r) => n + (original.get(`p-${r.id}`)?.unestimated ?? 0), 0);
  const blocked = titleInvalid || budgetInvalid || unnamed >= 0;
  const removingPhase = removing ? phases.find((p) => p.key === removing.key) : null;
  const removingHolds = removingPhase
    ? removingPhase.topics + incoming(removingPhase.key).reduce((n, r) => n + r.topics, 0)
    : 0;
  const nameOf = (key: string | null) => phases.find((p) => p.key === key)?.name.trim() || 'an unnamed phase';

  return (
    <Box>
      <PageHead
        eyebrow="Roadmap · edit"
        title="Edit plan"
        sub="Change the shape of the plan and the effort you can give it. Topic status is earned in the syllabus, not set here."
        actions={(
          <>
            <Button variant="outlined" onClick={leave}>← Cancel</Button>
            <Button variant="contained" color="ink" onClick={save} disabled={saving || blocked || !dirty}>
              {saving ? 'Saving…' : 'Save plan'}
            </Button>
          </>
        )}
        sx={{ mb: '28px' }}
      />

      {saveError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={saveError.stale ? <Button color="inherit" size="small" onClick={load}>Reload</Button> : undefined}
        >
          {saveError.message}
        </Alert>
      )}

      <Grid columns={2} sx={{ alignItems: 'start' }}>
        <Panel component="section" aria-labelledby="plan-heading">
          <Eyebrow component="h2" id="plan-heading">Roadmap</Eyebrow>
          <Box sx={{ display: 'grid', gap: 2, mt: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={titleInvalid}
              helperText={titleInvalid ? 'A roadmap needs a title.' : ' '}
              slotProps={{ htmlInput: { maxLength: 250 } }}
            />
            <TextField
              label="Source file"
              value={roadmap.source_filename ?? 'Created in PrepBench'}
              disabled
              helperText=" "
            />
            <TextField
              label="Weekly hours budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 6"
              error={budgetInvalid}
              helperText={budgetInvalid ? `More than 0 and at most ${MAX_WEEKLY_HOURS} hours a week.` : 'Hours you can study in a week.'}
              slotProps={{ htmlInput: { min: 0.5, max: MAX_WEEKLY_HOURS, step: 0.5 } }}
            />
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              helperText="Work before today is history; the projection runs from today."
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
          <Typography variant="body1" role="status" sx={{ mt: 2 }}>
            {budgetInvalid
              ? 'Fix the weekly budget to see a projected finish date.'
              : projection.state === 'ready'
                ? projectionText(projection.schedule)
                : projection.state === 'failed'
                  ? 'Could not project a finish date just now. Nothing was changed.'
                  : 'Projecting a finish date…'}
          </Typography>
        </Panel>

        <Panel soft component="section" aria-labelledby="totals-heading">
          <Eyebrow component="h2" id="totals-heading">Totals</Eyebrow>
          <MetricRow>
            <Metric value={phases.length} label={phases.length === 1 ? 'phase' : 'phases'} />
            <Metric value={totalTopics} label={totalTopics === 1 ? 'topic' : 'topics'} />
            <Metric value={hoursText(totalHours)} label="estimated" />
          </MetricRow>
          {totalUnestimated > 0 && (
            <Detail sx={{ mt: 1 }}>
              {plural(totalUnestimated, 'topic has', 'topics have')} no hours estimate and {totalUnestimated === 1 ? 'is' : 'are'} not in that figure.
            </Detail>
          )}
          <Note sx={{ mt: '14px' }}>
            Editing phases here does not change topic status. A topic is complete when its success
            criterion is met. Removing a phase moves its topics; it never deletes them.
          </Note>
        </Panel>
      </Grid>

      <Section>
      <Panel component="section" aria-labelledby="phases-heading">
        <PanelHead
          eyebrow="Phases"
          title="Reorder or retitle"
          titleId="phases-heading"
          aside={<Button startIcon={<Plus size={16} />} variant="outlined" onClick={addPhase}>Add phase</Button>}
        />

        {phases.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No phases. Add one to give the plan a shape.
          </Typography>
        )}

        <Box component="ol" aria-label="Phases in order" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>
          {phases.map((phase, index) => {
            const arriving = incoming(phase.key);
            const arrivingTopics = arriving.reduce((n, r) => n + r.topics, 0);
            const label = phase.name.trim() || `Phase ${index + 1}`;
            return (
              <Box
                component="li"
                key={phase.key}
                onDragOver={(e: React.DragEvent) => { if (dragKey) e.preventDefault(); }}
                onDrop={(e: React.DragEvent) => {
                  e.preventDefault();
                  const from = phases.findIndex((p) => p.key === dragKey);
                  if (from >= 0) move(from, index);
                  setDragKey(null);
                }}
                sx={{
                  display: 'grid', gridTemplateColumns: { xs: 'auto 1fr', md: 'auto minmax(0, 2fr) minmax(0, 1fr) auto' },
                  gap: 2, alignItems: 'center', py: 1.5,
                  borderTop: index === 0 ? 'none' : '1px solid', borderColor: 'divider',
                  opacity: dragKey === phase.key ? 0.5 : 1,
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', color: 'text.secondary' }}>
                  {/* The handle drags the row; the arrows beside it do the same for
                      the keyboard and for touch, where dragging is not offered. */}
                  <Box
                    aria-hidden
                    draggable
                    data-testid={`drag-${phase.key}`}
                    onDragStart={(e: React.DragEvent<HTMLElement>) => {
                      setDragKey(phase.key);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', phase.key);
                      const row = e.currentTarget.closest('li');
                      if (row) e.dataTransfer.setDragImage(row, 16, 16);
                    }}
                    onDragEnd={() => setDragKey(null)}
                    sx={{ display: { xs: 'none', md: 'flex' }, cursor: 'grab' }}
                  >
                    <GripVertical size={18} />
                  </Box>
                  <Stack>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton size="small" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                          <ArrowUp size={16} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton size="small" aria-label={`Move ${label} down`} disabled={index === phases.length - 1} onClick={() => move(index, index + 1)}>
                          <ArrowDown size={16} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
                <Box sx={{ minWidth: 0 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={phase.name}
                    onChange={(e) => rename(phase.key, e.target.value)}
                    placeholder="Phase name"
                    error={phase.name.trim() === ''}
                    slotProps={{ htmlInput: { 'aria-label': `Phase ${index + 1} name`, maxLength: 250 } }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {phase.id === null && phase.topics === 0 ? 'New · ' : ''}
                    {plural(phase.topics, 'topic', 'topics')} · {hoursText(phase.hours)}
                    {arrivingTopics > 0 && ` · ${arrivingTopics} more moving here from ${arriving.map((r) => r.name).join(', ')}`}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ gridColumn: { xs: '2', md: 'auto' } }}>
                  {phase.topics ? `${phase.completed} of ${phase.topics} complete` : 'No topics yet'}
                </Typography>
                <Box sx={{ gridColumn: { xs: '2', md: 'auto' } }}>
                  <Button color="error" onClick={() => askToRemove(phase.key)} aria-label={`Remove ${label}`}>
                    Remove
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>

        {removals.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Removed when you save</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {removals.map((r) => (
                <li key={r.id}>
                  <Typography variant="body2" component="span">
                    {r.name}
                    {r.topics > 0 ? ` (its ${plural(r.topics, 'topic moves', 'topics move')} to ${nameOf(r.moveTo)})` : ''}
                  </Typography>{' '}
                  <Button size="small" onClick={() => keep(r)} aria-label={`Keep ${r.name}`}>
                    Keep
                  </Button>
                </li>
              ))}
            </Box>
          </Box>
        )}
      </Panel>
      </Section>

      <Dialog open={removing !== null} onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove {removingPhase?.name.trim() || 'this phase'}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            It holds {plural(removingHolds, 'topic', 'topics')}. They move to the phase you choose, with their
            status, notes and demonstrations. Nothing is deleted.
          </Typography>
          {phases.length > 1 ? (
            <FormControl fullWidth size="small">
              <InputLabel id="move-to-label">Move the topics to</InputLabel>
              <Select
                labelId="move-to-label"
                label="Move the topics to"
                value={removing?.target ?? ''}
                onChange={(e) => setRemoving((r) => (r ? { ...r, target: String(e.target.value) } : r))}
              >
                {phases.filter((p) => p.key !== removing?.key).map((p, i) => (
                  <MenuItem key={p.key} value={p.key}>{p.name.trim() || `Unnamed phase ${i + 1}`}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Alert severity="warning">
              There is no other phase for them to go to. Add a phase first, then remove this one.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"

            disabled={!removing?.target}
            onClick={() => removing && applyRemoval(removing.key, removing.target)}
          >
            Remove and move topics
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Discard your changes?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Nothing you changed on this plan has been saved.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLeave(false)}>Keep editing</Button>
          <Button color="error" onClick={() => navigate(`/roadmaps/${id}`)}>Discard</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
