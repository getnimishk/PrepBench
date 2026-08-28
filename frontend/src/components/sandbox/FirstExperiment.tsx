// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Eye, FlaskConical, Ruler } from 'lucide-react';
import type { ScenarioParams } from '../../types/agileMetrics';
import { CHART_VIEWS, FAMILIES } from '../../services/metrics/charts';
import { FIRST_EXPERIMENT, applyExperiment, reachOf } from '../../services/metrics/experiments';

// The opening move.
//
// The single largest usability finding was that the page answered "here is
// everything" but never "what do I do". Twenty-seven charts and fourteen
// sliders is a laboratory with no first instruction, and a learner who does
// not know which control to touch touches none of them.
//
// The card says what to CHANGE and, separately, what to WATCH. That split is
// the point: this product teaches chart reading, and an instruction that only
// names an input leaves the observation to chance. It also names the families
// the change reaches, so the cross-family propagation is stated as the
// lesson rather than left as a scavenger hunt -- the count alone ("25 of 27
// charts") is a fact about the inventory, not a fact about systems.
//
// Every number in it is measured. Change a coupling and the sentence changes;
// remove one and a family drops out of the list.

/** "Flow, Quality and Team health" -- never a bare comma-joined list. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

interface Props {
  params: ScenarioParams;
  onApply: (next: ScenarioParams) => void;
  atBaseline: boolean;
}

export const FirstExperiment: React.FC<Props> = ({ params, onApply, atBaseline }) => {
  const e = FIRST_EXPERIMENT;
  const watch = CHART_VIEWS.find((v) => v.id === e.watchFirst)!;

  const reach = useMemo(
    () => reachOf(e, params),
    // Only the sprint count changes the answer; every other input is reset by
    // `applyExperiment` before the comparison runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.sprints],
  );

  const familyNames = FAMILIES.filter((f) => reach.families.includes(f.id)).map((f) => f.label);
  const run = () => onApply(applyExperiment(params, e));

  if (!atBaseline) {
    return (
      <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <FlaskConical size={15} />
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, minWidth: 180 }}>
            Suggested experiment, from wherever you are now:
          </Typography>
          <Button size="small" onClick={run} sx={{ textTransform: 'none' }}>
            {reach.label} {reach.from} → {reach.to}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, mb: 2, borderColor: 'primary.main', bgcolor: (t) => t.palette.primary.main + '0A' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ color: 'primary.main', mt: 0.25 }}>
          <FlaskConical size={22} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              fontWeight: 700,
              color: 'primary.main',
            }}
          >
            Try this first
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Increase {reach.label} from {reach.from} → {reach.to}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {e.question}
          </Typography>

          {/* The answer to "why that number and not the one before it". The
              target used to be authored -- "4 to 8" -- and had no answer at
              all. It is now the smallest step whose effect clears the
              variation this scenario already shows, and the card says so
              rather than asking to be trusted. */}
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ color: 'text.secondary', mt: '2px' }}>
              <Ruler size={14} />
            </Box>
            <Typography variant="caption" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 700 }}>
                Why {reach.to}:{' '}
              </Box>
              {reach.rationale}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
            <Box sx={{ color: 'primary.main', mt: '3px' }}>
              <Eye size={15} />
            </Box>
            <Typography variant="body2">
              <Box component="span" sx={{ fontWeight: 700 }}>
                Watch {watch.canonicalName} first.
              </Box>{' '}
              One change then propagates across {joinNames(familyNames)}. Explore the tabs to
              see where the effect appears.
            </Typography>
          </Stack>

          <Button
            variant="contained"
            size="small"
            disableElevation
            onClick={run}
            sx={{ mt: 1.5, textTransform: 'none' }}
          >
            Run experiment
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};
