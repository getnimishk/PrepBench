import React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { AlertTriangle, Calculator, Ruler } from 'lucide-react';
import type { Coupling, CouplingType } from '../../types/agileMetrics';
import { COUPLING_BY_ID } from '../../services/metrics/couplings';

// The callout surface: where the coupling ledger reaches the learner.
//
// This component is the entire reason the ledger types every edge as
// arithmetic, assumption or convention. An assumption that never reaches a
// chart is an assumption the reader takes for a fact -- and "high WIP raises
// defect injection" stated as a fact in an interview is a claim you cannot
// back up when someone asks for the evidence.
//
// So assumptions and conventions are shown by default and cannot be
// dismissed. Arithmetic is available but folded away: it follows from
// definitions and needs no warning, and giving it equal weight would train
// the reader to skim past all of them.

const STYLE: Record<CouplingType, { label: string; Icon: typeof AlertTriangle }> = {
  assumption: { label: 'Model assumption', Icon: AlertTriangle },
  convention: { label: 'Counting convention', Icon: Ruler },
  arithmetic: { label: 'Arithmetic', Icon: Calculator },
};

interface Props {
  /** Coupling ids the chart declares in its metadata. */
  consumes: string[];
}

export const AssumptionCallouts: React.FC<Props> = ({ consumes }) => {
  const couplings = consumes
    .map((id) => COUPLING_BY_ID.get(id))
    .filter((c): c is Coupling => c !== undefined);

  const caveats = couplings.filter((c) => c.type !== 'arithmetic');
  const arithmetic = couplings.filter((c) => c.type === 'arithmetic');

  if (couplings.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Plots a control directly — no modelled relationship in play.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {caveats.map((c) => {
        const { label, Icon } = STYLE[c.type];
        return (
          <Tooltip
            key={c.id}
            arrow
            placement="top"
            title={
              <Box>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                  {c.formula}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {c.description}
                </Typography>
                {c.calibrationParameter && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                    Calibration / teaching parameter: {c.calibrationParameter}. Chosen so the
                    effect is legible, not estimated from industry data.
                  </Typography>
                )}
                {c.lagSprints === 1 && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    Lags one sprint — produced here, felt next sprint.
                  </Typography>
                )}
              </Box>
            }
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: (t) =>
                  c.type === 'assumption'
                    ? t.palette.warning.main + '14'
                    : t.palette.info.main + '14',
                borderLeft: (t) =>
                  `3px solid ${c.type === 'assumption' ? t.palette.warning.main : t.palette.info.main}`,
              }}
            >
              <Icon size={15} style={{ marginTop: 2, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  {label}
                  {c.lagSprints === 1 && ' · lags one sprint'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {/* uiLabel already opens with "Model assumption:" / "Sandbox
                      counting convention:", so strip the prefix rather than
                      printing the category twice. */}
                  {c.uiLabel.replace(/^(Model assumption|Sandbox counting convention):\s*/, '')}
                </Typography>
              </Box>
            </Box>
          </Tooltip>
        );
      })}

      {arithmetic.length > 0 && (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {arithmetic.map((c) => (
            <Tooltip key={c.id} arrow title={c.formula} placement="top">
              <Chip
                size="small"
                variant="outlined"
                icon={<Calculator size={12} />}
                label={c.uiLabel}
                sx={{ height: 22, fontSize: '0.68rem' }}
              />
            </Tooltip>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
