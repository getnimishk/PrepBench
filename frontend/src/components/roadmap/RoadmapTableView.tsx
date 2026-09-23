// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Button, Chip, IconButton, Link, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import { FileText } from 'lucide-react';
import { RoadmapPhase, RoadmapTopic, RoadmapTopicStatus } from '../../types/roadmap';
import { Detail, Eyebrow, Panel, PanelHead, Pill, Section, type Tone } from '../ui/primitives';
import { NARROW_QUERY } from '../../theme/tokens';

export type StatusFilter = 'all' | RoadmapTopicStatus;

interface Props {
  /** Needed to link each topic to its own page. Optional so the view still
   *  renders where no roadmap id is known. */
  roadmapId?: number;
  phases: RoadmapPhase[];
  onStatusChange: (topic: RoadmapTopic, status: RoadmapTopicStatus) => void;
  onOpenNotes: (topic: RoadmapTopic) => void;
  busyTopicId?: number | null;
  /** 'all', or the id of the one phase to show. */
  phaseFilter: 'all' | number;
  onPhaseFilterChange: (value: 'all' | number) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
}

export const STATUS_LABELS: Record<RoadmapTopicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

const STATUS_TONE: Record<RoadmapTopicStatus, Tone> = {
  not_started: 'neutral',
  in_progress: 'accent',
  completed: 'success',
  skipped: 'neutral',
};

const hours = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

/** A phase's own state: complete when every counted topic is, started when any is. */
export function phaseState(topics: RoadmapTopic[]): RoadmapTopicStatus {
  const counted = topics.filter((t) => t.status !== 'skipped');
  if (counted.length > 0 && counted.every((t) => t.status === 'completed')) return 'completed';
  if (counted.some((t) => t.status === 'completed' || t.status === 'in_progress')) return 'in_progress';
  return 'not_started';
}

/**
 * The syllabus: every topic, phase by phase, with its learning objective, its
 * hours and its status -- the prototype's roadmap screen. Status is editable in
 * place, except completion, which is earned on the topic's own page.
 */
export const RoadmapTableView: React.FC<Props> = ({
  roadmapId, phases, onStatusChange, onOpenNotes, busyTopicId,
  phaseFilter, onPhaseFilterChange, statusFilter, onStatusFilterChange,
}) => {
  if (phases.length === 0) {
    return (
      <Section>
        <Detail sx={{ py: 4, textAlign: 'center' }}>No phases yet. Import a syllabus or add a phase to get started.</Detail>
      </Section>
    );
  }

  const total = phases.reduce((n, p) => n + p.topics.length, 0);
  const shownPhases = phases
    .filter((p) => phaseFilter === 'all' || p.id === phaseFilter)
    .map((p) => ({ phase: p, topics: p.topics.filter((t) => statusFilter === 'all' || t.status === statusFilter) }))
    .filter((x) => x.topics.length > 0 || (statusFilter === 'all' && x.phase.topics.length === 0));
  const shown = shownPhases.reduce((n, x) => n + x.topics.length, 0);

  return (
    <>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', mt: '20px', mb: '14px',
        }}
      >
        <Select
          value={phaseFilter === 'all' ? 'all' : String(phaseFilter)}
          onChange={(e) => onPhaseFilterChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          inputProps={{ 'aria-label': 'Phase' }}
          sx={{ minWidth: 220, maxWidth: 320, [NARROW_QUERY]: { minWidth: 0, maxWidth: 'none', width: '100%' } }}
        >
          <MenuItem value="all">All {phases.length} phases</MenuItem>
          {phases.map((p) => (
            <MenuItem key={p.id} value={String(p.id)}>
              {p.name} — {p.topics.length} {p.topics.length === 1 ? 'topic' : 'topics'}
            </MenuItem>
          ))}
        </Select>
        <Box role="group" aria-label="Status" sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(['all', 'not_started', 'in_progress', 'completed', 'skipped'] as StatusFilter[]).map((s) => (
            <Chip
              key={s}
              label={s === 'all' ? 'All' : STATUS_LABELS[s]}
              clickable
              color={statusFilter === s ? 'primary' : 'default'}
              aria-pressed={statusFilter === s}
              onClick={() => onStatusFilterChange(s)}
            />
          ))}
        </Box>
        <Detail sx={{ ml: 'auto' }}>{shown} of {total} topics</Detail>
      </Box>

      {shownPhases.length === 0 && (
        <Section><Detail sx={{ textAlign: 'center', py: 3 }}>No topic matches these filters.</Detail></Section>
      )}

      {shownPhases.map(({ phase, topics }) => {
        const counted = phase.topics.filter((t) => t.status !== 'skipped');
        const done = counted.filter((t) => t.status === 'completed').length;
        const phaseHours = phase.topics.every((t) => t.estimated_hours != null)
          ? phase.topics.reduce((n, t) => n + (t.estimated_hours ?? 0), 0)
          : null;
        const state = phaseState(phase.topics);
        return (
          <Box key={phase.id} sx={{ mb: '15px' }}>
            <Panel component="section" aria-labelledby={`phase-${phase.id}-title`} sx={{ pb: '8px' }}>
              <PanelHead
                eyebrow="Phase"
                title={phase.name}
                titleId={`phase-${phase.id}-title`}
                aside={(
                  <Pill tone={state === 'completed' ? 'success' : STATUS_TONE[state]}>
                    {state === 'completed' ? 'Complete' : STATUS_LABELS[state]}
                  </Pill>
                )}
              >
                <Detail>
                  {phase.topics.length} {phase.topics.length === 1 ? 'topic' : 'topics'}
                  {phaseHours != null ? ` · ${hours(phaseHours)}` : ''}
                  {` · ${done} complete`}
                </Detail>
              </PanelHead>

              {topics.length > 0 && (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Topic</TableCell>
                        <TableCell sx={{ [NARROW_QUERY]: { display: 'none' } }}>Learning objective</TableCell>
                        <TableCell sx={{ width: 64 }}>Hours</TableCell>
                        <TableCell sx={{ width: 170 }}>Status</TableCell>
                        <TableCell sx={{ width: 44, textAlign: 'center' }}>Notes</TableCell>
                        <TableCell sx={{ width: 72 }} aria-label="Open" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topics.map((topic) => (
                        <TableRow key={topic.id} hover>
                          <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>
                            {roadmapId != null ? (
                              <Link
                                component={RouterLink}
                                to={`/roadmaps/${roadmapId}/topics/${topic.id}`}
                                underline="hover"
                                sx={{ color: 'text.primary', fontWeight: 700 }}
                              >
                                {topic.title}
                              </Link>
                            ) : topic.title}
                          </TableCell>
                          <TableCell
                            title={topic.learning_objective ?? undefined}
                            sx={{ color: 'text.secondary', [NARROW_QUERY]: { display: 'none' } }}
                          >
                            {topic.learning_objective
                              ? (topic.learning_objective.length > 72
                                ? `${topic.learning_objective.slice(0, 72).trimEnd()}…`
                                : topic.learning_objective)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {/* Em-dash, not 0 -- "no estimate" and "zero hours" are
                                different claims, and only one of them is true here. */}
                            <Typography component="span" variant="body2" color={topic.estimated_hours == null ? 'text.secondary' : 'text.primary'}>
                              {topic.estimated_hours == null ? '—' : hours(topic.estimated_hours)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Select
                              fullWidth
                              value={topic.status}
                              disabled={busyTopicId === topic.id}
                              onChange={(e) => onStatusChange(topic, e.target.value as RoadmapTopicStatus)}
                              inputProps={{ 'aria-label': `Status for ${topic.title}` }}
                              renderValue={(value) => (
                                <Pill tone={STATUS_TONE[value as RoadmapTopicStatus]}>
                                  {STATUS_LABELS[value as RoadmapTopicStatus]}
                                </Pill>
                              )}
                              sx={{ '& .MuiSelect-select': { py: '5px' } }}
                            >
                              {(Object.keys(STATUS_LABELS) as RoadmapTopicStatus[]).map((status) => (
                                // Completed is listed so the current value can be shown,
                                // but it cannot be chosen: a topic is completed by
                                // demonstrating it against its success criterion, and the
                                // server refuses the shortcut regardless. Disabled with
                                // the reason, rather than hidden, so the rule is visible.
                                <MenuItem
                                  key={status}
                                  value={status}
                                  disabled={status === 'completed' && topic.status !== 'completed'}
                                >
                                  {status === 'completed' && topic.status !== 'completed'
                                    ? 'Completed — demonstrate the topic to complete it'
                                    : STATUS_LABELS[status]}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Tooltip title={topic.evidence_notes ? 'Edit notes' : 'Add notes'}>
                              <IconButton
                                size="small"
                                onClick={() => onOpenNotes(topic)}
                                aria-label={`Notes for ${topic.title}`}
                                color={topic.evidence_notes ? 'primary' : 'default'}
                              >
                                <FileText size={16} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {roadmapId != null && (
                              <Button
                                variant="outlined"
                                size="small"
                                component={RouterLink}
                                to={`/roadmaps/${roadmapId}/topics/${topic.id}`}
                                aria-label={`Open ${topic.title}`}
                              >
                                Open
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {topics.length === 0 && <Eyebrow sx={{ pb: '12px' }}>No topics in this phase yet</Eyebrow>}
            </Panel>
          </Box>
        );
      })}
    </>
  );
};
