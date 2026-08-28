import React, { useMemo } from 'react';
import { Box, Chip, LinearProgress, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { Attempt } from '../../types/learning';
import { CONCEPT_LIST, CONCEPTS } from '../../services/learning/concepts';
import { masteryMap } from '../../services/learning/mastery';
import { inferPlacement, placementGap } from '../../services/learning/placement';

// Progress as COMPETENCE, not consumption.
//
// "73% of lessons complete" tells a learner nothing they can act on, and it
// certifies something nobody cares about. What is shown instead is the two
// axes of where they actually are, and -- the useful part -- exactly which
// evidence is still missing for the concept they are working on.
//
// The two axes are shown separately on purpose. They come apart badly in this
// audience: an engineering manager arrives knowing what DORA is and unable to
// diagnose from a chart, an analyst arrives with the reverse, and a single
// score would give both the wrong entry point.

const STATE_LABEL: Record<string, string> = {
  notStarted: 'Not started',
  introduced: 'Introduced',
  practiced: 'Practised',
  developing: 'Developing',
  demonstrated: 'Demonstrated',
  transferDemonstrated: 'Transfer shown',
  mastered: 'Mastered',
};

const SHOWN = new Set(['demonstrated', 'transferDemonstrated', 'mastered']);

interface Props {
  attempts: Attempt[];
  /** The concept the recommender is currently pointing at, if any. */
  focusConceptId?: string;
}

export const ProgressPanel: React.FC<Props> = ({ attempts, focusConceptId }) => {
  const mastery = useMemo(() => masteryMap(attempts), [attempts]);
  const placement = useMemo(() => inferPlacement(attempts), [attempts]);
  const gap = placementGap(placement);

  const demonstrated = CONCEPT_LIST.filter((c) => SHOWN.has(mastery[c.id].state)).length;
  const focus = focusConceptId ? CONCEPTS[focusConceptId as keyof typeof CONCEPTS] : undefined;
  const focusState = focus ? mastery[focus.id] : undefined;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1.5 }}
      >
        <Box sx={{ minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            What you know
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
            {placement.depth.replace(/([A-Z])/g, ' $1')}
          </Typography>
        </Box>

        <Box sx={{ minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            What you can do
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
            {placement.capability}
          </Typography>
        </Box>

        <Box sx={{ minWidth: 170 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Concepts demonstrated
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {demonstrated} / {CONCEPT_LIST.length}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(demonstrated / CONCEPT_LIST.length) * 100}
              sx={{ flexGrow: 1, height: 5, borderRadius: 3, minWidth: 60 }}
            />
          </Stack>
        </Box>

        {gap !== 'balanced' && (
          <Tooltip
            arrow
            title={
              gap === 'capability'
                ? 'You know more terms than you have used. The next tasks ask you to use them.'
                : 'You can already do more than you can name. The next tasks give you the words.'
            }
          >
            <Chip
              size="small"
              variant="outlined"
              label={gap === 'capability' ? 'Use what you know' : 'Name what you do'}
              sx={{ height: 22, fontSize: '0.65rem', alignSelf: 'center' }}
            />
          </Tooltip>
        )}
      </Stack>

      {focus && focusState && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">
              Working on
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {focus.canonicalName}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={STATE_LABEL[focusState.state]}
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          </Stack>

          {focusState.nextEvidenceNeeded.length > 0 && (
            // The honest replacement for a percentage: name the missing
            // evidence, so the learner knows what to do rather than how far
            // along a bar they are.
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Still needs: {focusState.nextEvidenceNeeded.join('; ')}.
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};
