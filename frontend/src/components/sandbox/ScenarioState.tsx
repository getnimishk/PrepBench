// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { ArrowRight, RotateCcw } from 'lucide-react';
import type { ScenarioParams } from '../../types/agileMetrics';
import { PARAM_SPECS, formatParamValue } from '../../services/metrics/params';

// Baseline versus current, stated rather than implied.
//
// Every delta on this page is measured against the baseline scenario, and
// until now the only evidence of that was the phrase "vs baseline" under five
// numbers. A learner three experiments in could not answer "what am I
// actually running?" without reopening the control band and comparing
// fourteen sliders against a set of defaults they never saw.
//
// So the two states sit side by side, and only the controls that differ are
// listed -- a full parameter dump would be accurate and unreadable, and the
// question being answered is "what did I change", not "what is the scenario".

const EPSILON = 1e-6;

interface Props {
  params: ScenarioParams;
  baseline: ScenarioParams;
  atBaseline: boolean;
  onReset: () => void;
}

const StateChip: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <Chip
    size="small"
    label={label}
    color={active ? 'primary' : 'default'}
    variant={active ? 'filled' : 'outlined'}
    sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.5 }}
  />
);

export const ScenarioState: React.FC<Props> = ({ params, baseline, atBaseline, onReset }) => {
  const changed = PARAM_SPECS.filter(
    (s) => s.exposed && Math.abs(params[s.key] - baseline[s.key]) > EPSILON,
  );

  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1, mb: 2 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      >
        {atBaseline ? (
          <>
            <StateChip label="BASELINE" active />
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              The declared default scenario. Everything on this page is measured against it.
            </Typography>
          </>
        ) : (
          <>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <StateChip label="BASELINE" />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {changed.map((s) => `${s.label} ${formatParamValue(s, baseline[s.key])}`).join(' · ')}
              </Typography>
            </Stack>

            <Box sx={{ color: 'text.disabled', display: 'flex' }}>
              <ArrowRight size={15} />
            </Box>

            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexGrow: 1 }}>
              <StateChip label="CURRENT" active />
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                {changed.map((s) => `${s.label} ${formatParamValue(s, params[s.key])}`).join(' · ')}
              </Typography>
            </Stack>
          </>
        )}

        <Button
          size="small"
          startIcon={<RotateCcw size={14} />}
          disabled={atBaseline}
          onClick={onReset}
          sx={{ textTransform: 'none', flexShrink: 0 }}
        >
          Reset
        </Button>
      </Stack>
    </Paper>
  );
};
