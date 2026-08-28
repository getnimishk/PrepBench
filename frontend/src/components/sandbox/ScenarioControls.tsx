import React from 'react';
import { Box, Divider, Slider, Stack, Typography } from '@mui/material';
import type { ModelId, ScenarioParams } from '../../types/agileMetrics';
import { PARAM_SPECS, formatParamValue, type ParamSpec } from '../../services/metrics/params';

// The control panel.
//
// Only parameters marked `exposed` get a slider. Every calibration
// coefficient is deliberately absent: k1 through k4, deploymentIncidentRate,
// reworkPerIncident and incidentCostDays are teaching constants, and putting
// them on screen invites reading them as findings -- "we measured that WIP
// raises defects by 0.6" is not a thing this sandbox is entitled to say.
//
// The declared min/max on each slider are load-bearing, not cosmetic. They
// are chosen so no reachable combination can drive a calibration formula out
// of the domain where its output means anything, which is asserted by a
// corner sweep in params.test.ts. Widening one here without re-running that
// is how a 130% change fail rate reaches a chart.
//
// Laid out horizontally, in a band above the charts rather than a rail
// beside them. The rail measured 1737px in a 720px viewport, which put the
// first chart below the fold and left the numbers as the only thing that
// visibly responded to a drag -- on a page whose entire subject is reading
// shapes. The grouping survives the change, because which MODEL a control
// belongs to is the fact that makes a flow control reaching quality
// surprising.

const GROUPS: { model: ModelId | 'simulation'; label: string }[] = [
  { model: 'flow', label: 'Flow' },
  { model: 'quality', label: 'Quality' },
  { model: 'deployment', label: 'Deployment' },
  { model: 'reliability', label: 'Reliability' },
  { model: 'team', label: 'Team' },
  { model: 'simulation', label: 'Simulation' },
];

interface Props {
  params: ScenarioParams;
  onChange: (next: ScenarioParams) => void;
  /**
   * Fired when a drag or keypress finishes, not while it is in flight. The
   * page uses it to collapse this band once -- doing that on every `onChange`
   * would slam the panel shut mid-drag.
   */
  onCommit?: () => void;
}

/** The slider reading: the shared value format, plus the unit where there is one. */
function formatValue(spec: ParamSpec, value: number): string {
  const shown = formatParamValue(spec, value);
  return spec.unit && spec.unit !== 'share' ? `${shown} ${spec.unit}` : shown;
}

export const ScenarioControls: React.FC<Props> = ({ params, onChange, onCommit }) => {
  const exposed = PARAM_SPECS.filter((s) => s.exposed);

  const set = (spec: ParamSpec, value: number) => onChange({ ...params, [spec.key]: value });

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        {GROUPS.map((group) => {
          const specs = exposed.filter((s) => s.model === group.model);
          if (specs.length === 0) return null;

          return (
            <Box key={group.model} sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  fontWeight: 700,
                  color: 'text.secondary',
                }}
              >
                {group.label}
              </Typography>
              <Divider sx={{ mb: 1, mt: 0.5 }} />

              {specs.map((spec) => (
                <Box key={spec.key} sx={{ mb: 1 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
                  >
                    <Typography variant="body2" noWrap>
                      {spec.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatValue(spec, params[spec.key])}
                    </Typography>
                  </Stack>
                  <Slider
                    size="small"
                    value={params[spec.key]}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    aria-label={spec.label}
                    onChange={(_, value) => set(spec, Array.isArray(value) ? value[0] : value)}
                    onChangeCommitted={() => onCommit?.()}
                    sx={{ py: 0.75 }}
                  />
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Calibration coefficients are not exposed. They are teaching constants chosen so an
        effect is visible across a slider&apos;s range — not values measured from industry data.
      </Typography>
    </Box>
  );
};
