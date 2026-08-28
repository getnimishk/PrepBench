// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from 'lucide-react';
import type { Outcome } from '../../services/metrics/whatMoved';
import { Sparkline } from './Sparkline';

// "What the system is doing" -- the strip between the controls and the charts.
//
// It exists because the charts were six screens of scroll away from the
// sliders, which broke the one attachment the sandbox cannot afford to lose:
// move a control, watch something respond. But a summary on a page about
// chart literacy is dangerous. A learner whose feedback arrives as five
// numbers never learns to read the shapes underneath, which is the whole
// product. Hence the sparklines, and hence the fact that they are the real
// series rather than decoration: even the summary answers in shapes.
//
// These cards also carry the lesson the old derived-fields block carried.
// None of these five has a slider, and the placement is the argument: the
// learner goes looking for the knob, finds a lock, and reads the formula
// sitting next to it. Focusable rather than inert, because a disabled control
// is skipped by the tab order and the lesson would simply not exist for a
// keyboard or screen-reader user.
//
// The comparison is against the BASELINE SCENARIO -- the declared defaults,
// not a snapshot the user saved. Reset the controls and every delta returns
// to zero, because the thing being compared against is a definition rather
// than a moment.
//
// The card carries two different facts and they must not be conflated. The
// sparkline is the RUN: how the metric moved sprint to sprint under the
// current scenario. The figure beneath it is the COMPARISON: this scenario's
// latest sprint against the baseline's. A metric can vary wildly across
// sprints and still read "same as baseline" -- which is why that line says
// "same as baseline" rather than "unchanged", a word that would claim
// something false about the line directly above it.

const EPSILON = 1e-6;

interface Props {
  outcomes: Outcome[];
  /** True when the scenario IS the default, so there is nothing to compare. */
  atBaseline: boolean;
}

function format(o: Outcome, value: number): string {
  if (o.percent) return `${(value * 100).toFixed(o.precision)}%`;
  return value.toFixed(o.precision);
}

function formatDelta(o: Outcome, delta: number): string {
  const sign = delta > 0 ? '+' : '−';
  const magnitude = o.percent
    ? `${(Math.abs(delta) * 100).toFixed(o.precision)}pp`
    : Math.abs(delta).toFixed(o.precision);
  return `${sign}${magnitude}`;
}

export const KeyOutcomes: React.FC<Props> = ({ outcomes, atBaseline }) => (
  <Box sx={{ mb: 2 }}>
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'baseline', mb: 1, flexWrap: 'wrap', rowGap: 0.5 }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        What the system is doing
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {atBaseline
          ? 'baseline scenario · move a control to see what changes'
          : 'latest sprint, compared with the baseline'}
      </Typography>
    </Stack>

    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        },
      }}
    >
      {outcomes.map((o) => {
        const delta = o.value - o.baseline;
        const moved = Math.abs(delta) > EPSILON;
        const better = o.betterWhen === 'lower' ? delta < 0 : delta > 0;
        const Icon = !moved ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
        const tone = !moved ? 'text.secondary' : better ? 'success.main' : 'warning.main';

        return (
          <Tooltip
            key={o.id}
            arrow
            placement="bottom"
            title={
              <Box>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                  {o.formula}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {o.note}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {moved
                    ? `${format(o, o.baseline)} at baseline, ${format(o, o.value)} now.`
                    : 'The latest sprint matches the baseline. The line above still varies between sprints — that is the run, not the comparison.'}
                </Typography>
              </Box>
            }
          >
            <Paper
              variant="outlined"
              tabIndex={0}
              role="group"
              aria-label={`${o.label}: ${format(o, o.value)}${o.unit ? ` ${o.unit}` : ''}. Derived, not a control. ${o.formula}. ${o.note}`}
              sx={{
                p: 1.25,
                minWidth: 0,
                cursor: 'help',
                '&:focus-visible': {
                  outline: (t) => `2px solid ${t.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center', color: 'text.secondary', minWidth: 0 }}
              >
                {/* The lock is the whole argument for this block sitting
                    directly under the sliders: these look like the numbers
                    you would reach for, and none of them can be set. */}
                <Lock size={10} style={{ flexShrink: 0 }} />
                <Typography variant="caption" noWrap>
                  {o.label}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'baseline' }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}
                >
                  {format(o, o.value)}
                </Typography>
                {o.unit && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {o.unit}
                  </Typography>
                )}
              </Stack>

              <Box sx={{ color: 'primary.main', my: 0.5 }}>
                <Sparkline values={o.series} width={132} height={26} />
              </Box>

              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: tone }}>
                <Icon size={13} style={{ flexShrink: 0 }} />
                <Typography variant="caption" noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {moved ? `${formatDelta(o, delta)} vs baseline` : 'same as baseline'}
                </Typography>
              </Stack>
            </Paper>
          </Tooltip>
        );
      })}
    </Box>

    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
      None of these has a slider — they are what the controls above produce. The line is the
      run across sprints; the figure under it compares the latest sprint with the baseline.
    </Typography>
  </Box>
);
