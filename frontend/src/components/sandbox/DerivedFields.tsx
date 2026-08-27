import React from 'react';
import { Box, Divider, Stack, Tooltip, Typography } from '@mui/material';
import { Lock } from 'lucide-react';
import type { ScenarioParams, SprintResult } from '../../types/agileMetrics';

// Derived fields: locked, focusable, and sitting deliberately among the
// sliders.
//
// The placement IS the lesson. Cycle time is the single most misunderstood
// number in this whole model -- people reach for it as a target, as though a
// team could be instructed to have a shorter one. It cannot. It is WIP over
// throughput, and the only way to move it is to move one of those.
//
// Putting it in the control panel and refusing to let it be dragged says that
// far better than any caption underneath a chart. The learner goes looking
// for the knob, finds a lock, and reads the formula sitting next to it.
//
// Focusable rather than inert (`tabIndex={0}`) because a keyboard or screen
// reader user has to be able to reach these too -- a disabled input is
// skipped by the tab order, so the lesson would simply not exist for them.
// Each one announces its own formula.

interface DerivedField {
  label: string;
  value: string;
  formula: string;
  /** Why this cannot be a control. Shown on hover and read out on focus. */
  note: string;
}

interface Props {
  /** The sprint these readouts describe. */
  sprint: SprintResult;
  params: ScenarioParams;
}

function fieldsFor(sprint: SprintResult, p: ScenarioParams): DerivedField[] {
  const { flow } = sprint;
  return [
    {
      label: 'Cycle time',
      value: `${flow.cycleTimeDays.toFixed(2)} days`,
      formula: `WIP ÷ realised throughput × sprint length = ${p.wip} ÷ ${flow.deliveredItems.toFixed(2)} × ${p.sprintLengthDays}`,
      note:
        'An output, never a control. Little’s Law fixes it: the only way to move ' +
        'cycle time is to move WIP or throughput.',
    },
    {
      label: 'Realised throughput',
      value: `${flow.deliveredItems.toFixed(2)} items`,
      formula: `capacity × available capacity = ${p.throughput} × ${(flow.availableCapacityFraction * 100).toFixed(0)}%`,
      note:
        'What the team actually finished. Raising the WIP limit cannot raise this — ' +
        'WIP does not appear in the formula at all.',
    },
    {
      label: 'Flow efficiency',
      value: `${(flow.flowEfficiency * 100).toFixed(1)}%`,
      formula: `touch time ÷ cycle time = ${(p.sprintLengthDays / p.throughput).toFixed(2)} ÷ ${flow.cycleTimeDays.toFixed(2)}`,
      note:
        'The share of an item’s open time that was actual work. The rest was waiting, ' +
        'and high WIP is what creates the waiting.',
    },
    {
      label: 'Unplanned work carried in',
      value: `${flow.unplannedWorkDays.toFixed(2)} days`,
      formula: `baseline + incident load from sprint ${sprint.sprint - 1} = ${p.baseUnplannedDays} + ${sprint.carriedIn.incidentLoadDays.toFixed(2)}`,
      note:
        'Arrives from the PREVIOUS sprint, which is why a bad sprint so often gets ' +
        'blamed on the wrong one.',
    },
  ];
}

export const DerivedFields: React.FC<Props> = ({ sprint, params }) => {
  const fields = fieldsFor(sprint, params);

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Lock size={11} />
        <Typography
          variant="caption"
          sx={{
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            fontWeight: 700,
            color: 'text.secondary',
          }}
        >
          Derived · sprint {sprint.sprint}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 1, mt: 0.5 }} />

      {fields.map((f) => (
        <Tooltip
          key={f.label}
          arrow
          placement="right"
          title={
            <Box>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                {f.formula}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                {f.note}
              </Typography>
            </Box>
          }
        >
          <Box
            tabIndex={0}
            role="group"
            aria-label={`${f.label}: ${f.value}. Derived, not a control. ${f.formula}. ${f.note}`}
            sx={{
              mb: 1,
              px: 1,
              py: 0.75,
              borderRadius: 1,
              // Visually inset rather than raised: these are readouts, and a
              // control-shaped affordance would invite exactly the drag this
              // section exists to refuse.
              bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
              borderLeft: (t) => `2px solid ${t.palette.divider}`,
              cursor: 'help',
              '&:focus-visible': {
                outline: (t) => `2px solid ${t.palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="body2" color="text.secondary">
                {f.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {f.value}
              </Typography>
            </Stack>
          </Box>
        </Tooltip>
      ))}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        These have no sliders because nothing can set them directly. They are what the
        controls above produce.
      </Typography>
    </Box>
  );
};
