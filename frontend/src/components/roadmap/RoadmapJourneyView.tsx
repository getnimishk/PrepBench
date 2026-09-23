// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { RoadmapPhase } from '../../types/roadmap';
import { Bar, Detail, Panel, PanelHead, Pill, Row, Section } from '../ui/primitives';

interface Props {
  roadmapId: number;
  phases: RoadmapPhase[];
  /** Opens the syllabus on one phase. */
  onOpenPhase: (phaseId: number) => void;
}

const hours = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

/**
 * Phase by phase: the prototype's phase overview. One row per phase with its
 * size, its first topics, and how far through it you are -- the plan's shape
 * at a glance, with the syllabus one click away for the topics themselves.
 *
 * Deliberately phase-level rather than topic-level: a 45-node map of topics is
 * a wall of dots, which is decoration rather than orientation.
 */
export const RoadmapJourneyView: React.FC<Props> = ({ roadmapId, phases, onOpenPhase }) => {
  if (phases.length === 0) {
    return (
      <Section>
        <Detail sx={{ py: 4, textAlign: 'center' }}>No phases yet. Import a syllabus or add a phase to see the plan.</Detail>
      </Section>
    );
  }

  return (
    <Section>
      <Panel component="section" aria-labelledby="phase-overview-heading">
        <PanelHead
          eyebrow="Plan"
          title="Phase by phase"
          titleId="phase-overview-heading"
          aside={<Button variant="outlined" component={RouterLink} to={`/roadmaps/${roadmapId}/edit`}>Edit plan</Button>}
        />
        {phases.map((phase, index) => {
          const counted = phase.topics.filter((t) => t.status !== 'skipped');
          const done = counted.filter((t) => t.status === 'completed').length;
          const pct = counted.length > 0 ? Math.round((done / counted.length) * 100) : 0;
          const phaseHours = phase.topics.length > 0 && phase.topics.every((t) => t.estimated_hours != null)
            ? phase.topics.reduce((n, t) => n + (t.estimated_hours ?? 0), 0)
            : null;
          const firstTopics = phase.topics.slice(0, 2).map((t) => t.title).join(', ')
            + (phase.topics.length > 2 ? '…' : '');
          // Where the learner is: the first phase with a topic still to do.
          const current = index === phases.findIndex((ph) => ph.topics.some((t) => t.status === 'not_started' || t.status === 'in_progress'));
          return (
            <Row
              key={phase.id}
              title={(
                <>
                  {phase.name}
                  {current && <Pill tone="accent" sx={{ ml: '8px' }}>You are here</Pill>}
                </>
              )}
              detail={[
                `${phase.topics.length} ${phase.topics.length === 1 ? 'topic' : 'topics'}`,
                ...(phaseHours != null ? [hours(phaseHours)] : []),
                ...(firstTopics ? [firstTopics] : []),
              ].join(' · ')}
              middle={(
                <Box sx={{ minWidth: 120 }}>
                  <Bar value={pct} label={`${phase.name}: ${done} of ${counted.length} topics complete`} />
                  <Detail sx={{ mt: '5px' }}>{done} / {counted.length}</Detail>
                </Box>
              )}
              action={(
                <Button variant="outlined" onClick={() => onOpenPhase(phase.id)} aria-label={`Open ${phase.name}`}>
                  Open
                </Button>
              )}
            />
          );
        })}
      </Panel>
    </Section>
  );
};
