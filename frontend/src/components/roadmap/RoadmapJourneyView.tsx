// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography, Card, CardContent, Chip, LinearProgress, Tooltip } from '@mui/material';
import { CheckCircle2, CircleDot, Circle, MinusCircle } from 'lucide-react';
import { RoadmapPhase, RoadmapTopic } from '../../types/roadmap';

interface Props {
  phases: RoadmapPhase[];
}

interface PhaseStanding {
  countable: number;
  completed: number;
  inProgress: number;
  skipped: number;
  /** Null when the phase has nothing countable -- not 0%. */
  percentage: number | null;
  state: 'done' | 'active' | 'untouched' | 'all-skipped';
}

function standingFor(topics: RoadmapTopic[]): PhaseStanding {
  const countable = topics.filter((t) => t.status !== 'skipped');
  const completed = countable.filter((t) => t.status === 'completed').length;
  const inProgress = countable.filter((t) => t.status === 'in_progress').length;
  const skipped = topics.length - countable.length;

  const percentage = countable.length === 0 ? null : Math.round((completed / countable.length) * 100);

  let state: PhaseStanding['state'] = 'untouched';
  if (countable.length === 0) state = topics.length > 0 ? 'all-skipped' : 'untouched';
  else if (completed === countable.length) state = 'done';
  else if (completed > 0 || inProgress > 0) state = 'active';

  return { countable: countable.length, completed, inProgress, skipped, percentage, state };
}

const STATE_ICON = {
  done: <CheckCircle2 size={22} />,
  active: <CircleDot size={22} />,
  untouched: <Circle size={22} />,
  'all-skipped': <MinusCircle size={22} />,
} as const;

const STATE_COLOR = {
  done: 'success.main',
  active: 'primary.main',
  untouched: 'text.disabled',
  'all-skipped': 'text.disabled',
} as const;

/**
 * Where you are in the curriculum, at a glance.
 *
 * Deliberately phase-level rather than topic-level: a 45-node journey map is a
 * wall of dots, which is decoration rather than orientation. Topic detail
 * lives in the table view.
 */
export const RoadmapJourneyView: React.FC<Props> = ({ phases }) => {
  if (phases.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No phases yet. Import a syllabus or add a phase to see the journey.
      </Typography>
    );
  }

  const standings = phases.map((phase) => ({ phase, standing: standingFor(phase.topics) }));
  const currentIndex = standings.findIndex((s) => s.standing.state === 'active');
  const nextUpIndex = currentIndex >= 0
    ? currentIndex
    : standings.findIndex((s) => s.standing.state === 'untouched');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {standings.map(({ phase, standing }, index) => {
        const isHere = index === nextUpIndex;
        return (
          <Box key={phase.id} sx={{ display: 'flex', gap: 2 }}>
            {/* Rail: node + connector, so the phases read as one path rather
                than a stack of unrelated cards. */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <Box sx={{ color: STATE_COLOR[standing.state], display: 'flex', pt: 2.5 }}>
                {STATE_ICON[standing.state]}
              </Box>
              {index < standings.length - 1 && (
                <Box sx={{
                  flexGrow: 1, width: 2, minHeight: 32,
                  bgcolor: standing.state === 'done' ? 'success.main' : 'divider',
                }} />
              )}
            </Box>

            <Card
              variant="outlined"
              sx={{
                flexGrow: 1, mb: 2, borderRadius: 3, boxShadow: 'none',
                borderColor: isHere ? 'primary.main' : 'divider',
                borderWidth: isHere ? 2 : 1,
              }}
            >
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{phase.name}</Typography>
                    {isHere && <Chip size="small" color="primary" label="You are here" />}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {standing.percentage === null
                      ? `${standing.skipped} skipped`
                      : `${standing.completed} / ${standing.countable}`}
                  </Typography>
                </Box>

                {standing.percentage !== null && (
                  <LinearProgress
                    variant="determinate"
                    value={standing.percentage}
                    color={standing.state === 'done' ? 'success' : 'primary'}
                    sx={{ mt: 1.5, height: 6, borderRadius: 5 }}
                  />
                )}

                <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap' }}>
                  {phase.topics.map((topic) => (
                    <Tooltip key={topic.id} title={`${topic.title} — ${topic.status.replace('_', ' ')}`}>
                      <Box
                        sx={{
                          width: 10, height: 10, borderRadius: '50%',
                          bgcolor:
                            topic.status === 'completed' ? 'success.main'
                            : topic.status === 'in_progress' ? 'warning.main'
                            : topic.status === 'skipped' ? 'action.disabled'
                            : 'divider',
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        );
      })}
    </Box>
  );
};
