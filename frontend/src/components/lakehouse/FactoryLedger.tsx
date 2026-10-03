// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography } from '@mui/material';
import { FACTORY_COUPLINGS, type FactoryCouplingType } from '../../services/lakehouse/factoryCouplings';
import type { FactoryConfig } from '../../services/lakehouse/factoryModel';
import { Detail, Panel, Pill } from '../ui/primitives';

const KIND: Record<FactoryCouplingType, { label: string; tone: 'neutral' | 'warning' | 'accent' }> = {
  arithmetic: { label: 'Arithmetic', tone: 'neutral' },
  assumption: { label: 'Assumption', tone: 'warning' },
  convention: { label: 'Convention', tone: 'accent' },
};

/**
 * What the Factory assumes, in full: every effect in its coupling ledger, with its
 * kind, and the pack's teaching constants with the pack's own labels. An assumption
 * that is only in a design document gets read as a fact, so none is left out: a
 * test checks that every entry's caveat is on screen.
 */
export const FactoryLedger: React.FC<{ config: FactoryConfig }> = ({ config }) => (
  <Panel component="section" aria-labelledby="f-ledger" sx={{ mt: '15px' }}>
    <Typography variant="h6" component="h3" id="f-ledger">What this model assumes</Typography>
    <Detail sx={{ mt: '6px' }}>
      Every month and cost here is a teaching constant for a fictional scenario. None is an estimate of a real migration or a price.
    </Detail>

    <Box component="ul" aria-label="Teaching constants" sx={{ listStyle: 'none', p: 0, m: '12px 0 0', display: 'grid', gap: '6px' }}>
      {(Object.keys(config.constantLabels) as (keyof FactoryConfig['constantLabels'])[]).map((key) => (
        <Box component="li" key={key}>
          <Pill tone="warning">Teaching constant</Pill>{' '}
          <Detail component="span">{config.constantLabels[key]}</Detail>
        </Box>
      ))}
    </Box>

    <Box component="details" open sx={{ mt: '14px' }}>
      <Typography component="summary" variant="body2" sx={{ cursor: 'pointer', fontWeight: 700 }}>
        Every effect the model applies ({FACTORY_COUPLINGS.length})
      </Typography>
      <Box component="ul" aria-label="Effects the model applies" sx={{ listStyle: 'none', p: 0, m: '10px 0 0', display: 'grid', gap: '12px' }}>
        {FACTORY_COUPLINGS.map((c) => (
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
