// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material';
import { Actions, Detail, Grid, Panel, Sub } from '../ui/primitives';
import { LoopSteps } from './LoopSteps';

export interface ShellOption {
  id: string;
  text: string;
}

export interface ShellPrediction {
  prompt: React.ReactNode;
  options: ShellOption[];
  /** What is selected: the learner's choice, or the committed one. */
  value: string;
  /** Once committed it is locked: the server will not take a second one. */
  committed: boolean;
  saving: boolean;
  error?: string | null;
  onChange: (optionId: string) => void;
  onCommit: () => void;
}

/**
 * The loop every station shares: Predict, Manipulate, Observe, Explain.
 *
 * Predict is write-once. Once committed the options are disabled and the button
 * says so, and the Manipulate panel stays shut until then -- an operation names
 * its attempt, and the server refuses one whose prediction isn't on the record.
 * The shell only lays the loop out; each station says what goes in the panels.
 */
export const StationShell: React.FC<{
  idPrefix: string;
  prediction: ShellPrediction;
  manipulate: React.ReactNode;
  observe: React.ReactNode;
  explain: React.ReactNode;
  /** 0..3: how far the learner has got. */
  step: number;
}> = ({ idPrefix, prediction: p, manipulate, observe, explain, step }) => (
  <>
    <LoopSteps active={step} />
    <Grid columns={2}>
      <Box sx={{ display: 'grid', gap: '15px', alignContent: 'start' }}>
        <Panel component="section" aria-labelledby={`${idPrefix}-predict`}>
          <Typography variant="h6" component="h3" id={`${idPrefix}-predict`}>1 · Predict</Typography>
          <Sub>{p.prompt}</Sub>
          <RadioGroup
            aria-labelledby={`${idPrefix}-predict`}
            value={p.value}
            onChange={(e) => p.onChange(e.target.value)}
          >
            {p.options.map((o) => (
              <FormControlLabel key={o.id} value={o.id} control={<Radio />} label={o.text} disabled={p.committed || p.saving} />
            ))}
          </RadioGroup>
          <Actions sx={{ mt: '12px' }}>
            <Button
              variant="contained"
              color="ink"
              disabled={!p.value || p.committed || p.saving}
              onClick={p.onCommit}
            >
              {p.committed ? 'Prediction committed' : p.saving ? 'Committing…' : 'Commit prediction'}
            </Button>
          </Actions>
          <Detail sx={{ mt: '10px' }}>Your prediction can’t be changed once you commit it.</Detail>
          {p.error && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{p.error}</Detail></Box>}
        </Panel>

        <Panel component="section" aria-labelledby={`${idPrefix}-manipulate`}>
          <Typography variant="h6" component="h3" id={`${idPrefix}-manipulate`}>2 · Manipulate</Typography>
          {p.committed ? manipulate : <Detail sx={{ mt: '8px' }}>Commit a prediction first.</Detail>}
        </Panel>
      </Box>

      <Box sx={{ display: 'grid', gap: '15px', alignContent: 'start' }}>
        <Panel component="section" aria-labelledby={`${idPrefix}-observe`} aria-live="polite">
          <Typography variant="h6" component="h3" id={`${idPrefix}-observe`}>3 · Observe</Typography>
          {observe}
        </Panel>
        <Panel component="section" aria-labelledby={`${idPrefix}-explain`}>
          <Typography variant="h6" component="h3" id={`${idPrefix}-explain`}>4 · Explain</Typography>
          {explain}
        </Panel>
      </Box>
    </Grid>
  </>
);
