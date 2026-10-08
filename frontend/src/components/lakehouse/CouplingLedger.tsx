// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { FactoryCoupling, FactoryCouplingType } from '../../services/lakehouse/factoryCouplings';
import { Detail, Panel, Pill } from '../ui/primitives';

const KIND: Record<FactoryCouplingType, { label: string; tone: 'neutral' | 'warning' | 'accent' }> = {
  arithmetic: { label: 'Arithmetic', tone: 'neutral' },
  assumption: { label: 'Assumption', tone: 'warning' },
  convention: { label: 'Convention', tone: 'accent' },
  fact: { label: 'From the ADF guide', tone: 'neutral' },
};

/**
 * What a station's model assumes, in full: every effect in its coupling ledger, with its
 * kind, and any teaching constants with the pack's own labels. An assumption that lives
 * only in a design document gets read as a fact, so none is left out: a test checks that
 * every entry's caveat and effect are on screen.
 */
export const CouplingLedger: React.FC<{
  idPrefix: string;
  couplings: FactoryCoupling[];
  /** The pack's teaching constants, each with the pack's own label. */
  constants?: string[];
  intro: string;
}> = ({ idPrefix, couplings, constants = [], intro }) => (
  <Panel component="section" aria-labelledby={`${idPrefix}-ledger`} sx={{ mt: '15px' }}>
    <Typography variant="h6" component="h3" id={`${idPrefix}-ledger`}>What this model assumes</Typography>
    <Detail sx={{ mt: '6px' }}>{intro}</Detail>

    {constants.length > 0 && (
      <Box component="ul" aria-label="Teaching constants" sx={{ listStyle: 'none', p: 0, m: '12px 0 0', display: 'grid', gap: '6px' }}>
        {constants.filter((label) => label.length > 0).map((label) => (
          <Box component="li" key={label}>
            <Pill tone="warning">Teaching constant</Pill>{' '}
            <Detail component="span">{label}</Detail>
          </Box>
        ))}
      </Box>
    )}

    <Box component="details" open sx={{ mt: '14px' }}>
      <Typography component="summary" variant="body2" sx={{ cursor: 'pointer', fontWeight: 700 }}>
        Every effect the model applies ({couplings.length})
      </Typography>
      <Box component="ul" aria-label="Effects the model applies" sx={{ listStyle: 'none', p: 0, m: '10px 0 0', display: 'grid', gap: '12px' }}>
        {couplings.map((c) => (
          <Box component="li" key={c.id}>
            <Pill tone={KIND[c.type].tone}>{KIND[c.type].label}</Pill>{' '}
            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>{c.uiLabel}</Typography>
            <Detail sx={{ mt: '2px' }}>{c.effect}</Detail>
          </Box>
        ))}
      </Box>
    </Box>
  </Panel>
);
