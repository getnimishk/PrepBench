// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box } from '@mui/material';
import { MONO_STACK } from '../../theme/tokens';

export const LOOP_STEPS = ['Predict', 'Manipulate', 'Observe', 'Explain'] as const;

/** Where a station is in the Lab's loop. Each step's panel carries its own heading. */
export const LoopSteps: React.FC<{ active: number }> = ({ active }) => (
  <Box
    component="ol"
    aria-label={`Step ${active + 1} of 4: ${LOOP_STEPS[active]}`}
    sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', listStyle: 'none', p: 0, m: '14px 0 16px' }}
  >
    {LOOP_STEPS.map((step, i) => {
      const done = i < active;
      const now = i === active;
      return (
        <Box
          component="li"
          key={step}
          aria-current={now ? 'step' : undefined}
          sx={{
            display: 'flex', alignItems: 'center', gap: '7px', px: '11px', py: '5px', borderRadius: '20px',
            fontSize: (t) => t.typography.pxToRem(12), fontWeight: 700,
            bgcolor: now ? 'pb.accentSoft' : done ? 'pb.successSoft' : 'pb.chip',
            color: now ? 'pb.accent' : done ? 'pb.success' : 'pb.chipText',
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{
              display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%',
              bgcolor: 'background.paper', fontSize: (t) => t.typography.pxToRem(10),
            }}
          >
            {done ? '✓' : i + 1}
          </Box>
          {step}
        </Box>
      );
    })}
  </Box>
);

/** Monospace block for engine output and commands. Engine text goes in as it came. */
export const CodeBlock: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label }) => (
  <Box
    component="pre"
    tabIndex={0}
    aria-label={label}
    sx={{
      m: '10px 0 0', p: '11px 12px', borderRadius: '9px', bgcolor: 'pb.surface2', border: '1px solid',
      borderColor: 'divider', color: 'text.secondary', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      overflowX: 'auto', fontFamily: MONO_STACK, fontSize: (t) => t.typography.pxToRem(12),
    }}
  >
    {children}
  </Box>
);
