import React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { AlertTriangle, Calculator, Ruler } from 'lucide-react';
import type { Coupling, CouplingType, ModelId } from '../../types/agileMetrics';
import { rankCouplings, type RankedCoupling } from '../../services/metrics/relevance';

// The callout surface: where the coupling ledger reaches the learner.
//
// This component is the entire reason the ledger types every edge as
// arithmetic, assumption or convention. An assumption that never reaches a
// chart is an assumption the reader takes for a fact -- and "high WIP raises
// defect injection" stated as a fact in an interview is a claim you cannot
// back up when someone asks for the evidence.
//
// Three rules, each of which exists because the card broke without it:
//
// 1. `effect` LEADS, `uiLabel` follows. Opening with "Model assumption:
//    incidents cost capacity in the following sprint" is true and useless as
//    an explanation -- it reads as timing mechanics, and a reader who meets
//    the same caveat under six flow charts concludes that incidents cause
//    cycle time directly. `effect` is written as the chain it travels.
//
// 2. WHAT MOVED IT leads WHAT IT DEPENDS ON. `consumes` is a standing
//    declaration, so a static list explained a WIP experiment with an
//    incident assumption. Edges originating in a model the learner just
//    touched come first, under a heading that says so.
//
// 3. Nothing is hidden. Assumptions and conventions always render as visible
//    blocks whether or not the current change drove them; only arithmetic
//    folds down to a chip, and only when it did not. Demoting a caveat out of
//    sight is how it gets read as a fact.
//
// The heading is honest about state too: at baseline nothing has moved, so it
// does not claim to say why anything did.

const STYLE: Record<CouplingType, { label: string; Icon: typeof AlertTriangle }> = {
  assumption: { label: 'Model assumption', Icon: AlertTriangle },
  convention: { label: 'Counting convention', Icon: Ruler },
  arithmetic: { label: 'Arithmetic', Icon: Calculator },
};

/** `uiLabel` already opens with its own category; printing both says it twice. */
const stripPrefix = (label: string) =>
  label.replace(/^(Model assumption|Sandbox counting convention):\s*/, '');

interface Props {
  /** Coupling ids the chart declares in its metadata. */
  consumes: string[];
  /** Models the learner has changed away from the baseline. */
  changedModels: Set<ModelId>;
}

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="caption"
    sx={{
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: 700,
      color: 'text.secondary',
    }}
  >
    {children}
  </Typography>
);

const CouplingDetail: React.FC<{ c: Coupling }> = ({ c }) => (
  <Box>
    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
      {c.formula}
    </Typography>
    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
      {c.description}
    </Typography>
    {c.calibrationParameter && (
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
        Calibration / teaching parameter: {c.calibrationParameter}. Chosen so the effect is
        legible, not estimated from industry data.
      </Typography>
    )}
  </Box>
);

const CouplingBlock: React.FC<{ c: Coupling }> = ({ c }) => {
  const { label, Icon } = STYLE[c.type];
  const accent =
    c.type === 'assumption' ? 'warning' : c.type === 'convention' ? 'info' : 'primary';

  return (
    <Box
      sx={{
        p: 1,
        borderRadius: 1,
        bgcolor: (t) => t.palette[accent].main + '14',
        borderLeft: (t) => `3px solid ${t.palette[accent].main}`,
      }}
    >
      {/* The chain, in the learner's terms. Arrows because the effect is
          usually indirect, and a flat sentence lets the reader collapse three
          hops into one false cause. */}
      <Typography variant="body2">{c.effect}</Typography>

      <Tooltip arrow placement="top" title={<CouplingDetail c={c} />}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'baseline', mt: 0.25, cursor: 'help', flexWrap: 'wrap' }}
        >
          <Icon size={12} style={{ flexShrink: 0, transform: 'translateY(2px)' }} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {label}
            {c.lagSprints === 1 && ' · lags one sprint'}:
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {stripPrefix(c.uiLabel)}
          </Typography>
        </Stack>
      </Tooltip>
    </Box>
  );
};

const ArithmeticChips: React.FC<{ items: RankedCoupling[] }> = ({ items }) => (
  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
    {items.map(({ coupling: c }) => (
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
              {c.effect}
            </Typography>
          </Box>
        }
      >
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
);

export const AssumptionCallouts: React.FC<Props> = ({ consumes, changedModels }) => {
  const ranked = rankCouplings(consumes, changedModels);

  if (ranked.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Plots a control directly — no modelled relationship in play.
      </Typography>
    );
  }

  const driven = ranked.filter((r) => r.drivenByChange);
  const standing = ranked.filter((r) => !r.drivenByChange);
  // Arithmetic earns a full block when the current change drove it, and folds
  // to a chip when it did not. Assumptions and conventions never fold.
  const standingBlocks = standing.filter((r) => r.coupling.type !== 'arithmetic');
  const standingChips = standing.filter((r) => r.coupling.type === 'arithmetic');

  return (
    <Stack spacing={0.75}>
      <SectionHeading>{driven.length > 0 ? 'Why this moved' : 'What this depends on'}</SectionHeading>

      {driven.map((r) => (
        <CouplingBlock key={r.coupling.id} c={r.coupling} />
      ))}

      {driven.length > 0 && (standingBlocks.length > 0 || standingChips.length > 0) && (
        <SectionHeading>Also in play</SectionHeading>
      )}

      {standingBlocks.map((r) => (
        <CouplingBlock key={r.coupling.id} c={r.coupling} />
      ))}

      {standingChips.length > 0 && <ArithmeticChips items={standingChips} />}
    </Stack>
  );
};
