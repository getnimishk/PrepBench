import React from 'react';
import { Box, Button, Divider, Slider, Stack, Typography } from '@mui/material';
import { RotateCcw } from 'lucide-react';
import type { ModelId, ScenarioParams } from '../../types/agileMetrics';
import { DEFAULT_PARAMS, PARAM_SPECS, type ParamSpec } from '../../services/metrics/params';

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

const GROUPS: { model: ModelId | 'simulation'; label: string }[] = [
  { model: 'simulation', label: 'Simulation' },
  { model: 'flow', label: 'Flow' },
  { model: 'quality', label: 'Quality' },
  { model: 'deployment', label: 'Deployment' },
  { model: 'reliability', label: 'Reliability' },
  { model: 'team', label: 'Team' },
];

interface Props {
  params: ScenarioParams;
  onChange: (next: ScenarioParams) => void;
}

function formatValue(spec: ParamSpec, value: number): string {
  if (spec.unit === 'share') return `${(value * 100).toFixed(spec.step < 0.01 ? 2 : 0)}%`;
  return spec.unit ? `${value} ${spec.unit}` : String(value);
}

export const ScenarioControls: React.FC<Props> = ({ params, onChange }) => {
  const exposed = PARAM_SPECS.filter((s) => s.exposed);
  const dirty = exposed.some((s) => params[s.key] !== DEFAULT_PARAMS[s.key]);

  const set = (spec: ParamSpec, value: number) =>
    onChange({ ...params, [spec.key]: value });

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Scenario
        </Typography>
        <Button
          size="small"
          startIcon={<RotateCcw size={14} />}
          disabled={!dirty}
          onClick={() => onChange({ ...DEFAULT_PARAMS })}
        >
          Reset
        </Button>
      </Stack>

      {GROUPS.map((group) => {
        const specs = exposed.filter((s) => s.model === group.model);
        if (specs.length === 0) return null;

        return (
          <Box key={group.model} sx={{ mb: 2 }}>
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
              <Box key={spec.key} sx={{ mb: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Typography variant="body2">{spec.label}</Typography>
                  <Typography
                    variant="body2"
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
                />
              </Box>
            ))}
          </Box>
        );
      })}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Calibration coefficients are not exposed. They are teaching constants chosen so an
        effect is visible across a slider&apos;s range — not values measured from industry data.
      </Typography>
    </Box>
  );
};
