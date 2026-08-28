// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo } from 'react';
import { Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { ArrowRight, Target } from 'lucide-react';
import type { FamilyId, ScenarioParams } from '../../types/agileMetrics';
import { CHART_VIEWS, FAMILIES } from '../../services/metrics/charts';
import { PARAM_SPECS, formatParamValue, paramSpec } from '../../services/metrics/params';
import type { Movement, Outcome } from '../../services/metrics/whatMoved';
import { EXPERIMENTS, applyExperiment, reachOf } from '../../services/metrics/experiments';

// The closing move: explain, conclude, then offer the next experiment.
//
// The loop this page teaches is experiment -> observe -> explore -> explain
// -> conclude, and usability testing found it stopping after "explore". The
// learner reached the bottom of twenty-seven charts and the page simply
// ended, which leaves the conclusion as something they were supposed to have
// formed on their own.
//
// Every sentence here is still computed. That is not a style preference -- a
// mockup of this card carried "increasing WIP above the system's sustainable
// level increases cycle time, reduces efficiency, and increases defects",
// which is a conclusion about a model, written by hand, in a place nothing
// can check it. Change a coefficient and the prose keeps asserting the old
// result; flip the sign of a coupling and it asserts the opposite of what
// the charts show.
//
// So the conclusion is a MEASUREMENT of the run: what rose, what fell, and --
// the part that carries the lesson -- what did not follow. It states no
// causes. The causes are on the charts, typed by the ledger, which is the
// only place they can be kept honest.

const EPSILON = 1e-6;
/** Below this relative change, an outcome is reported as having held. */
const FLAT = 0.05;

interface Props {
  params: ScenarioParams;
  baseline: ScenarioParams;
  outcomes: Outcome[];
  movement: Movement;
  atBaseline: boolean;
  onSelectFamily: (family: FamilyId) => void;
  onApply: (next: ScenarioParams) => void;
}

function formatOutcome(o: Outcome, value: number): string {
  return o.percent ? `${(value * 100).toFixed(o.precision)}%` : value.toFixed(o.precision);
}

type Direction = 'rose' | 'fell' | 'held';

/** Relative change, and null when the baseline is zero and a ratio would lie. */
function relative(o: Outcome): number | null {
  const denom = Math.abs(o.baseline);
  if (denom < EPSILON) return null;
  return (o.value - o.baseline) / denom;
}

function direction(o: Outcome): Direction {
  const delta = o.value - o.baseline;
  if (Math.abs(delta) < EPSILON) return 'held';
  const rel = relative(o);
  if (rel !== null && Math.abs(rel) < FLAT) return 'held';
  return delta > 0 ? 'rose' : 'fell';
}

/**
 * The verdict: a stated decision rule over two measured numbers.
 *
 * The loop ended at "here is what changed", which leaves the learner to form
 * the conclusion unaided -- and the conclusion is the entire point of running
 * an experiment. Writing it by hand was the other option and the wrong one: a
 * mockup did exactly that, and prose asserting "more WIP creates artificial
 * bottlenecks" keeps asserting it after someone flips the sign of a coupling.
 *
 * So: two axes, speed and output, each judged against the same 5% band the
 * rest of this card uses, and the rule is printed underneath. A reader who
 * disagrees with the verdict can see precisely which rule produced it.
 */
function verdict(outcomes: Outcome[]): string | null {
  const cycle = outcomes.find((o) => o.id === 'cycleTime');
  const output = outcomes.find((o) => o.id === 'throughput');
  if (!cycle || !output) return null;

  // Cycle time is better when lower, throughput when higher. Normalising to
  // "better / worse / held" first keeps the table below readable.
  const speed =
    direction(cycle) === 'held' ? 'held' : direction(cycle) === 'rose' ? 'worse' : 'better';
  const out =
    direction(output) === 'held' ? 'held' : direction(output) === 'rose' ? 'better' : 'worse';

  if (speed === 'worse' && out === 'held') return 'This cost speed and bought no extra output.';
  if (speed === 'worse' && out === 'better') return 'This bought output, and paid for it in speed.';
  if (speed === 'worse' && out === 'worse') return 'This made both speed and output worse.';
  if (speed === 'held' && out === 'better') return 'This bought output at no cost in speed.';
  if (speed === 'held' && out === 'worse') return 'This cost output and bought no speed.';
  if (speed === 'better' && out === 'held') return 'This bought speed, with output unchanged.';
  if (speed === 'better' && out === 'better') return 'This improved both speed and output.';
  if (speed === 'better' && out === 'worse') return 'This bought speed, and paid for it in output.';
  return 'Neither speed nor output moved outside the 5% band.';
}

function describe(o: Outcome): string {
  const rel = relative(o);
  if (rel === null) return `${o.label} ${formatOutcome(o, o.baseline)} → ${formatOutcome(o, o.value)}`;
  const sign = rel > 0 ? '+' : '−';
  return `${o.label} ${sign}${Math.abs(rel * 100).toFixed(0)}%`;
}

export const WhatChanged: React.FC<Props> = ({
  params,
  baseline,
  outcomes,
  movement,
  atBaseline,
  onSelectFamily,
  onApply,
}) => {
  // Whatever the learner is not already running. The target is derived, so
  // "already running it" means sitting on the value the rule would pick.
  const reaches = useMemo(
    () =>
      EXPERIMENTS.map((e) => ({ e, reach: reachOf(e, params) }))
        .filter(({ e, reach }) => formatParamValue(paramSpec(e.key), params[e.key]) !== reach.to)
        .slice(0, 2),
    [params],
  );

  if (atBaseline) return null;

  const changed = PARAM_SPECS.filter(
    (s) => s.exposed && Math.abs(params[s.key] - baseline[s.key]) > EPSILON,
  );
  const movedFamilies = FAMILIES.filter((f) => movement.movedFamilies.has(f.id));

  const rose = outcomes.filter((o) => direction(o) === 'rose');
  const fell = outcomes.filter((o) => direction(o) === 'fell');
  const held = outcomes.filter((o) => direction(o) === 'held');
  const call = verdict(outcomes);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, mt: 3, borderColor: 'warning.main', bgcolor: (t) => t.palette.warning.main + '0A' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ color: 'warning.main', mt: 0.25 }}>
          <Target size={20} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              fontWeight: 700,
              color: 'warning.dark',
            }}
          >
            What did we learn?
          </Typography>

          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
            You changed{' '}
            {changed
              .map(
                (s) =>
                  `${s.label} ${formatParamValue(s, baseline[s.key])} → ${formatParamValue(s, params[s.key])}`,
              )
              .join(', ')}
            {changed.length === 1 ? ' — one control, nothing else.' : '.'}
          </Typography>

          <Stack spacing={0.25} sx={{ mb: 1 }}>
            {rose.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                <Box component="span" sx={{ fontWeight: 700 }}>
                  Rose:{' '}
                </Box>
                {rose.map(describe).join(', ')}
              </Typography>
            )}
            {fell.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                <Box component="span" sx={{ fontWeight: 700 }}>
                  Fell:{' '}
                </Box>
                {fell.map(describe).join(', ')}
              </Typography>
            )}
            {held.length > 0 && (
              // The load-bearing line. What DIDN'T follow is usually the
              // lesson -- throughput holding while cycle time doubles is the
              // whole argument against raising WIP, and it is invisible if
              // the summary only lists what moved.
              <Typography variant="body2" color="text.secondary">
                <Box component="span" sx={{ fontWeight: 700 }}>
                  Held within {FLAT * 100}% of baseline:{' '}
                </Box>
                {held.map((o) => o.label).join(', ')}
              </Typography>
            )}
          </Stack>

          {call !== null && (
            <Box
              sx={{
                p: 1,
                mb: 1,
                borderRadius: 1,
                bgcolor: (t) => t.palette.warning.main + '1A',
                borderLeft: (t) => `3px solid ${t.palette.warning.main}`,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Verdict: {call}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Rule: cycle time and realised throughput, each judged against the same{' '}
                {FLAT * 100}% band. Nothing here is a recommendation — it is two numbers and a
                stated rule.
              </Typography>
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            That reached {movement.movedViews.size} of the {CHART_VIEWS.length} charts, across{' '}
            {movedFamilies.length} of {FAMILIES.length} families:
          </Typography>

          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {movedFamilies.map((f) => (
              <Chip
                key={f.id}
                size="small"
                color="warning"
                variant="outlined"
                clickable
                onClick={() => onSelectFamily(f.id)}
                label={`${f.label} · ${movement.countByFamily.get(f.id)} moved`}
                sx={{ height: 22, fontSize: '0.68rem' }}
              />
            ))}
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Why each of those moved is stated on the chart itself, and labelled as arithmetic,
            a model assumption or a counting convention. This summary reports what moved; it
            does not claim to know why.
          </Typography>

          {reaches.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                Try another experiment
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {reaches.map(({ e, reach }) => (
                  <Button
                    key={e.id}
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowRight size={14} />}
                    onClick={() => onApply(applyExperiment(params, e))}
                    sx={{ textTransform: 'none', textAlign: 'left' }}
                  >
                    {reach.label} {reach.from} → {reach.to}
                    <Box component="span" sx={{ opacity: 0.7, ml: 0.75 }}>
                      · {reach.families.length} {reach.families.length === 1 ? 'family' : 'families'}
                    </Box>
                  </Button>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};
