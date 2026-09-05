// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { BookOpen, Eye, Lightbulb } from 'lucide-react';
import type { Concept } from '../../types/learning';
import { paramsFor } from '../../services/learning/scenarios';
import { simulate } from '../../services/metrics/compose';
import { buildChartPayload } from '../../services/metrics/chartData';
import { CHART_BY_ID } from '../../services/metrics/charts';
import { Sparkline } from '../sandbox/Sparkline';

// ORIENT -- the referential card, and the strictest content surface here.
//
// It answers "what is this?" and nothing else. It may say what the object is,
// where to see it, and that it matters. It may not say what it does to
// anything else, because the next step asks the learner to work that out and a
// card that gives it away turns the prediction into reading comprehension.
//
// The rule is enforced in integrity.test.ts rather than by care, since every
// individual sentence reads fine and a leak is only visible against the graph
// of what the learner has been told so far.
//
// The example is RENDERED, never authored. An illustration with numbers typed
// into it drifts from the simulation the moment a coefficient moves, and then
// the lesson is teaching something the sandbox no longer does.

interface Props {
  concept: Concept;
  /** Omitted when the card is opened by choice rather than met on the way in:
   *  there is nothing to continue to, because nothing was interrupted. */
  onContinue?: () => void;
  continueLabel?: string;
}

export const ConceptCard: React.FC<Props> = ({ concept, onContinue, continueLabel }) => {
  // Straight from the model, at the parameterisation the concept declares.
  const example = useMemo(() => {
    const chartId = concept.charts[0];
    if (!chartId) return null;
    const params = paramsFor(concept.liveScenario);
    const payload = buildChartPayload(chartId, simulate(params), params);
    const series = payload.series.find((s) => !s.reference);
    if (!series) return null;
    return {
      title: CHART_BY_ID.get(chartId)!.canonicalName,
      yLabel: payload.yLabel,
      values: series.data.filter((v): v is number => v !== null),
    };
  }, [concept]);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, mb: 2, borderColor: 'info.main', bgcolor: (t) => t.palette.info.main + '0A' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ color: 'info.main', mt: 0.25 }}>
          <BookOpen size={22} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontWeight: 700,
                color: 'info.main',
              }}
            >
              New idea
            </Typography>
            {/* concept.depth -- "vocabulary", "mechanism", "judgement" --
                described the card to the curriculum, not to the reader. It
                sat on the first thing anyone sees in the sandbox, which is
                exactly where the internal vocabulary should not be. */}
          </Stack>

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            {concept.canonicalName}
          </Typography>

          <Typography variant="body2" sx={{ mb: 1 }}>
            {concept.referentDefinition}
          </Typography>

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start', mb: 0.75 }}>
            <Box sx={{ color: 'text.secondary', mt: '3px' }}>
              <Eye size={14} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {concept.whereToSeeIt}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
            <Box sx={{ color: 'text.secondary', mt: '3px' }}>
              <Lightbulb size={14} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {concept.whyItMatters}
            </Typography>
          </Stack>

          {example && (
            <Paper variant="outlined" sx={{ p: 1.25, mt: 1.5, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {example.title} — {example.yLabel}, from the live model
              </Typography>
              <Box sx={{ color: 'info.main', mt: 0.5 }}>
                <Sparkline values={example.values} width={220} height={34} />
              </Box>
            </Paper>
          )}

          <Button
            variant="contained"
            size="small"
            disableElevation
            onClick={onContinue}
            sx={{ mt: 1.5, textTransform: 'none' }}
          >
            {continueLabel ?? 'Got it — show me'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};
